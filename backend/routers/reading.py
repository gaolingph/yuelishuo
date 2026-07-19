from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime

from database import get_db
from models import User, Word, WordPack, LearningRecord, ReadingPassage, UserReadingProgress, WrongRecord
from schemas import (
    ReadingPassageResponse, ReadingPassageListItem,
    ReadingCompleteRequest, ReadingCompleteResponse,
    ReadingProgressResponse,
    ReadingGenerateRequest, ReadingGenerateResponse,
)
from routers.auth import get_current_user
from services.ai.client import llm_client
from services.ai.prompts import get_system_prompt

router = APIRouter(prefix="/api/reading", tags=["阅读"])


# ── Pack → level mapping ──────────────────────────────────────────────
LEVEL_INFO = {
    12: ("primary", "外研小学基础", "掌握基础词汇和简单句型的初级阶段"),
    13: ("primary", "外研小学进阶", "扩展日常词汇和简单对话阶段"),
    14: ("junior", "外研初中基础", "初中基础阶段，学习常用词汇和基础语法"),
    15: ("junior", "外研初中进阶", "初中进阶阶段，扩展词汇量和复杂句型"),
    16: ("senior", "外研高中基础", "高中必修阶段，接触学术词汇和抽象概念"),
    17: ("senior", "外研高中进阶", "高中选修+高考阶段，掌握高级词汇和复杂语篇"),
}


def get_level_info(pack_id: int) -> tuple:
    """Get (level_key, level_name, level_description) for a pack_id."""
    info = LEVEL_INFO.get(pack_id)
    if info:
        return info
    # Fallback: try to determine from pack
    if pack_id <= 13:
        return ("primary", "外研小学", "小学阶段")
    elif pack_id <= 15:
        return ("junior", "外研初中", "初中阶段")
    else:
        return ("senior", "外研高中", "高中阶段")


def get_learned_word_ids(user_id: int, pack_id: int, db: Session) -> set:
    """Get IDs of words the user has learned in a given pack."""
    records = db.query(LearningRecord.word_id).filter(
        LearningRecord.user_id == user_id,
        LearningRecord.word_id.in_(
            db.query(Word.id).filter(Word.pack_id == pack_id)
        )
    ).all()
    return {r[0] for r in records}


@router.get("/passages", response_model=ReadingProgressResponse)
def get_reading_passages(pack_id: int = None,
                         db: Session = Depends(get_db),
                         user: User = Depends(get_current_user)):
    """Get reading passages available for the user, with progress."""
    query = db.query(ReadingPassage).order_by(ReadingPassage.sort_order)

    if pack_id:
        query = query.filter(ReadingPassage.pack_id == pack_id)

    passages = query.all()

    # Get user's reading progress
    progress_records = db.query(UserReadingProgress).filter(
        UserReadingProgress.user_id == user.id
    ).all()
    progress_map = {p.passage_id: p for p in progress_records}

    total_words_covered = 0
    passage_items = []
    completed_count = 0
    total_score = 0

    for p in passages:
        prog = progress_map.get(p.id)
        item_progress = None
        if prog:
            item_progress = {
                "is_completed": prog.is_completed,
                "score": prog.score,
                "questions_correct": prog.questions_correct,
                "questions_total": prog.questions_total,
            }
            if prog.is_completed:
                completed_count += 1
                total_score += prog.score

        passage_items.append(ReadingPassageListItem(
            id=p.id,
            pack_id=p.pack_id,
            level=p.level,
            title=p.title,
            word_count=p.word_count,
            progress=item_progress,
        ))
        total_words_covered += p.word_count

    avg_score = round(total_score / max(completed_count, 1), 1) if completed_count > 0 else 0.0

    return ReadingProgressResponse(
        total_passages=len(passages),
        completed_passages=completed_count,
        average_score=avg_score,
        total_words_covered=total_words_covered,
        passages=passage_items,
    )


@router.get("/passages/{passage_id}", response_model=ReadingPassageResponse)
def get_reading_passage(passage_id: int,
                        db: Session = Depends(get_db),
                        user: User = Depends(get_current_user)):
    """Get a specific reading passage with vocabulary and questions."""
    passage = db.query(ReadingPassage).filter(ReadingPassage.id == passage_id).first()
    if not passage:
        raise HTTPException(status_code=404, detail="阅读篇章不存在")

    return passage


@router.get("/passages/{passage_id}/learned-vocabulary")
def get_passage_learned_vocabulary(passage_id: int,
                                    db: Session = Depends(get_db),
                                    user: User = Depends(get_current_user)):
    """Get which vocabulary words in this passage the user has learned."""
    passage = db.query(ReadingPassage).filter(ReadingPassage.id == passage_id).first()
    if not passage:
        raise HTTPException(status_code=404, detail="阅读篇章不存在")

    learned_ids = get_learned_word_ids(user.id, passage.pack_id, db)

    vocab_status = []
    for v in passage.vocabulary:
        word = db.query(Word).filter(
            Word.pack_id == passage.pack_id,
            Word.english == v.get("word", "")
        ).first()
        is_learned = word is not None and word.id in learned_ids
        vocab_status.append({
            "word": v.get("word", ""),
            "chinese": v.get("chinese", ""),
            "phonetic": v.get("phonetic", ""),
            "is_learned": is_learned,
        })

    return {"vocabulary": vocab_status}


@router.post("/complete", response_model=ReadingCompleteResponse)
def complete_reading_passage(data: ReadingCompleteRequest,
                              db: Session = Depends(get_db),
                              user: User = Depends(get_current_user)):
    """Submit reading quiz answers and mark passage as completed."""
    passage = db.query(ReadingPassage).filter(ReadingPassage.id == data.passage_id).first()
    if not passage:
        raise HTTPException(status_code=404, detail="阅读篇章不存在")

    questions = passage.questions or []
    if not questions:
        # No questions — just mark as read
        existing = db.query(UserReadingProgress).filter(
            UserReadingProgress.user_id == user.id,
            UserReadingProgress.passage_id == data.passage_id
        ).first()

        if existing:
            existing.is_completed = True
            existing.completed_at = datetime.utcnow()
        else:
            existing = UserReadingProgress(
                user_id=user.id,
                passage_id=data.passage_id,
                is_completed=True,
                questions_correct=0,
                questions_total=0,
                score=100,
                read_at=datetime.utcnow(),
                completed_at=datetime.utcnow(),
            )
            db.add(existing)

        db.commit()
        return ReadingCompleteResponse(
            passage_id=data.passage_id,
            is_completed=True,
            correct_count=0,
            total_questions=0,
            score=100,
            message="阅读完成！",
        )

    if len(data.answers) != len(questions):
        raise HTTPException(status_code=400, detail="答案数量与题目数量不匹配")

    correct_count = 0
    for i, question in enumerate(questions):
        if i < len(data.answers) and data.answers[i] == question.get("correct_index", -1):
            correct_count += 1

    total = len(questions)
    score = round(correct_count / max(total, 1) * 100, 1)

    # Save or update progress
    existing = db.query(UserReadingProgress).filter(
        UserReadingProgress.user_id == user.id,
        UserReadingProgress.passage_id == data.passage_id
    ).first()

    if existing:
        existing.is_completed = True
        existing.questions_correct = correct_count
        existing.questions_total = total
        existing.score = score
        existing.completed_at = datetime.utcnow()
    else:
        existing = UserReadingProgress(
            user_id=user.id,
            passage_id=data.passage_id,
            is_completed=True,
            questions_correct=correct_count,
            questions_total=total,
            score=score,
            read_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
        )
        db.add(existing)

    db.commit()

    # Generate message
    if score >= 80:
        message = f"太棒了！答对{correct_count}/{total}题，继续保持！🎉"
    elif score >= 60:
        message = f"不错！答对{correct_count}/{total}题，再仔细读一遍文章吧！💪"
    else:
        message = f"答对{correct_count}/{total}题，建议重新阅读文章再试一次！📖"

    return ReadingCompleteResponse(
        passage_id=data.passage_id,
        is_completed=True,
        correct_count=correct_count,
        total_questions=total,
        score=score,
        message=message,
    )


@router.get("/progress")
def get_reading_progress(db: Session = Depends(get_db),
                          user: User = Depends(get_current_user)):
    """Get overall reading progress for the user."""
    total_passages = db.query(ReadingPassage).count()

    completed = db.query(UserReadingProgress).filter(
        UserReadingProgress.user_id == user.id,
        UserReadingProgress.is_completed == True
    )

    completed_count = completed.count()
    avg_score = db.query(func.avg(UserReadingProgress.score)).filter(
        UserReadingProgress.user_id == user.id,
        UserReadingProgress.is_completed == True
    ).scalar() or 0

    total_words_covered = db.query(func.sum(ReadingPassage.word_count)).filter(
        ReadingPassage.id.in_(
            db.query(UserReadingProgress.passage_id).filter(
                UserReadingProgress.user_id == user.id,
                UserReadingProgress.is_completed == True
            )
        )
    ).scalar() or 0

    return {
        "total_passages": total_passages,
        "completed_passages": completed_count,
        "average_score": round(float(avg_score), 1),
        "total_words_covered": total_words_covered,
    }


@router.post("/generate", response_model=ReadingGenerateResponse)
async def generate_reading_passage(
    data: ReadingGenerateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """AI-generate a reading passage based on the user's target vocabulary (陌生单词).

    Uses the LLM to create a passage that naturally incorporates the given words,
    then generates comprehension questions. This is the core of the 陌生单词→阅读 auto-generation flow.
    """
    # 1. Look up the target words
    words = db.query(Word).filter(Word.id.in_(data.word_ids)).all()
    if not words:
        raise HTTPException(status_code=400, detail="未找到指定的单词")

    # 2. Look up the word pack for level context
    pack = db.query(WordPack).filter(WordPack.id == data.pack_id).first()
    if not pack:
        raise HTTPException(status_code=400, detail="词包不存在")

    # 3. Determine level info
    level_key, level_name, level_desc = get_level_info(data.pack_id)

    # 4. Limit the number of target words (max 15 for a single passage)
    target_words = words[:15]
    target_words_text = "\n".join(
        f"- {w.english} /{w.phonetic}/ {w.chinese} 例: {w.example_en}"
        for w in target_words
    )

    # 5. Determine question count (3 for primary, 4 for junior, 5 for senior)
    question_count = {"primary": 3, "junior": 4, "senior": 5}.get(level_key, 4)

    # 6. Build the system prompt
    system_prompt = get_system_prompt(
        "reading_generation",
        target_words_text=target_words_text,
        level_name=level_name,
        level_description=level_desc,
        question_count=question_count,
    )

    # 7. Call the LLM
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"请根据以上{len(target_words)}个目标单词，生成一篇{level_name}水平的英语阅读文章和{question_count}道选择题。文章必须自然地融入所有目标词汇。"},
    ]

    result = await llm_client.chat_structured(messages, response_schema={
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "text": {"type": "string"},
            "vocabulary": {"type": "array", "items": {"type": "object"}},
            "questions": {"type": "array", "items": {"type": "object"}},
        },
        "required": ["title", "text", "vocabulary", "questions"],
    })

    if "error" in result:
        raise HTTPException(status_code=503, detail=f"AI生成失败: {result['error']}")

    # 8. Compute word count (approximate from text)
    text = result.get("text", "")
    word_count = len(text.split()) if text else 0

    # 9. Save the generated passage to the database so it can be completed later
    passage_record = ReadingPassage(
        pack_id=data.pack_id,
        level=level_key,
        title=result.get("title", "AI生成阅读"),
        text=text,
        vocabulary=result.get("vocabulary", []),
        questions=result.get("questions", []),
        word_count=word_count,
        sort_order=0,
    )
    db.add(passage_record)
    db.commit()
    db.refresh(passage_record)

    # 10. Return structured response with the saved passage ID
    return ReadingGenerateResponse(
        id=passage_record.id,
        title=passage_record.title,
        text=passage_record.text,
        vocabulary=passage_record.vocabulary,
        questions=passage_record.questions,
        word_count=passage_record.word_count,
        pack_id=data.pack_id,
        level=level_key,
    )


@router.get("/unknown-words")
def get_unknown_words(
    pack_id: int = None,
    limit: int = 15,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get the user's '陌生单词' (unknown/unmastered words) for AI reading generation.

    Returns words with highest wrong counts from the wrong record book,
    optionally filtered by pack. These are the words that should be incorporated
    into AI-generated reading passages for targeted learning.
    """
    query = (
        db.query(Word, WrongRecord.wrong_count)
        .join(WrongRecord, WrongRecord.word_id == Word.id)
        .filter(WrongRecord.user_id == user.id)
        .order_by(WrongRecord.wrong_count.desc())
    )

    if pack_id:
        query = query.filter(Word.pack_id == pack_id)

    results = query.limit(limit).all()

    words = []
    for word, wrong_count in results:
        words.append({
            "id": word.id,
            "english": word.english,
            "chinese": word.chinese,
            "phonetic": word.phonetic,
            "pack_id": word.pack_id,
            "wrong_count": wrong_count,
        })

    return {"words": words, "total": len(words)}
