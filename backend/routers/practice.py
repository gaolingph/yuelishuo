from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import random

from sqlalchemy import func
from database import get_db
from models import User, Word, WordPack, LearningRecord, WrongRecord, CapabilityRecord
from schemas import ChoiceQuestion, SpellingQuestion, ListeningQuestion, SpeakingQuestion, PracticeAnswer
from routers.auth import get_current_user

router = APIRouter(prefix="/api/practice", tags=["练习"])


def record_wrong_answer(user_id: int, word_id: int, practice_type: str, db: Session):
    """Record a wrong answer in the wrong book."""
    existing = db.query(WrongRecord).filter(
        WrongRecord.user_id == user_id,
        WrongRecord.word_id == word_id,
        WrongRecord.practice_type == practice_type
    ).first()
    
    if existing:
        existing.wrong_count += 1
        existing.last_wrong_at = datetime.utcnow()
    else:
        record = WrongRecord(
            user_id=user_id,
            word_id=word_id,
            practice_type=practice_type,
            wrong_count=1
        )
        db.add(record)
    db.commit()


def get_practice_words(user_id: int, pack_id: Optional[int], count: int, db: Session):
    """Get words for practice, prioritizing wrong words and review words."""
    # Get user's pack IDs
    if pack_id:
        pack_ids = [pack_id]
    else:
        packs = db.query(WordPack).all()
        pack_ids = [p.id for p in packs]
    
    # Get wrong words first (highest priority)
    wrong_records = db.query(WrongRecord).filter(
        WrongRecord.user_id == user_id,
        WrongRecord.word_id.in_(
            db.query(Word.id).filter(Word.pack_id.in_(pack_ids))
        )
    ).order_by(WrongRecord.wrong_count.desc()).limit(count).all()
    
    wrong_word_ids = [w.word_id for w in wrong_records]
    
    # Get review words (second priority)
    review_records = db.query(LearningRecord).filter(
        LearningRecord.user_id == user_id,
        LearningRecord.next_review <= datetime.utcnow(),
        LearningRecord.is_mastered == False,
        LearningRecord.word_id.in_(
            db.query(Word.id).filter(Word.pack_id.in_(pack_ids))
        )
    ).order_by(LearningRecord.next_review.asc()).limit(count).all()
    
    review_word_ids = [r.word_id for r in review_records if r.word_id not in wrong_word_ids]
    
    # Get random new words (third priority)
    learned_ids = set(wrong_word_ids + review_word_ids)
    learned_from_records = db.query(LearningRecord.word_id).filter(
        LearningRecord.user_id == user_id
    ).all()
    learned_ids.update(l[0] for l in learned_from_records)
    
    new_words = db.query(Word).filter(
        Word.pack_id.in_(pack_ids),
        ~Word.id.in_(learned_ids) if learned_ids else True
    ).order_by(func.random()).limit(max(0, count - len(wrong_word_ids) - len(review_word_ids))).all()
    
    # Combine, prioritizing wrong words
    all_words = []
    seen_ids = set()
    
    for w in wrong_records:
        word = db.query(Word).filter(Word.id == w.word_id).first()
        if word and word.id not in seen_ids:
            all_words.append(word)
            seen_ids.add(word.id)
    
    for wid in review_word_ids:
        word = db.query(Word).filter(Word.id == wid).first()
        if word and word.id not in seen_ids:
            all_words.append(word)
            seen_ids.add(word.id)
    
    for w in new_words:
        if w.id not in seen_ids:
            all_words.append(w)
            seen_ids.add(w.id)
    
    return all_words[:count]


def generate_distractors(correct_word: Word, pack_id: int, count: int = 3, db: Session = None):
    """Generate wrong options for multiple choice."""
    distractors = db.query(Word).filter(
        Word.pack_id == pack_id,
        Word.id != correct_word.id
    ).order_by(func.random()).limit(count).all()
    
    # If not enough in same pack, get from other packs
    if len(distractors) < count:
        more = db.query(Word).filter(
            Word.id != correct_word.id
        ).order_by(func.random()).limit(count - len(distractors)).all()
        distractors.extend(more)
    
    return [d.chinese for d in distractors[:count]]


@router.get("/choice")
def get_choice_questions(
    pack_id: int = None,
    count: int = 10,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get multiple choice questions (English -> Chinese)."""
    words = get_practice_words(user.id, pack_id, count, db)
    
    questions = []
    for word in words:
        options = generate_distractors(word, word.pack_id, 3, db)
        correct_answer = word.chinese
        all_options = [correct_answer] + options
        random.shuffle(all_options)
        correct_index = all_options.index(correct_answer)
        
        questions.append({
            "id": word.id,
            "word_id": word.id,
            "english": word.english,
            "phonetic": word.phonetic,
            "options": all_options,
            "correct_index": correct_index
        })
    
    return questions


@router.get("/spelling")
def get_spelling_questions(
    pack_id: int = None,
    count: int = 10,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get spelling questions (Chinese -> English spelling)."""
    words = get_practice_words(user.id, pack_id, count, db)
    
    questions = []
    for word in words:
        questions.append({
            "id": word.id,
            "word_id": word.id,
            "chinese": word.chinese,
            "phonetic": word.phonetic,
            "word_length": len(word.english),
            "hint": word.english[0] + "_" * (len(word.english) - 1)
        })
    
    return questions


@router.get("/listening")
def get_listening_questions(
    pack_id: int = None,
    count: int = 10,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get listening questions (hear word -> choose Chinese meaning)."""
    words = get_practice_words(user.id, pack_id, count, db)
    
    questions = []
    for word in words:
        options = generate_distractors(word, word.pack_id, 3, db)
        correct_answer = word.chinese
        all_options = [correct_answer] + options
        random.shuffle(all_options)
        correct_index = all_options.index(correct_answer)
        
        questions.append({
            "id": word.id,
            "word_id": word.id,
            "english": word.english,
            "phonetic": word.phonetic,
            "options": all_options,
            "correct_index": correct_index
        })
    
    return questions


@router.get("/chinese_to_english")
def get_chinese_to_english_questions(
    pack_id: int = None,
    count: int = 10,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get Chinese→English multiple choice questions (看中文选英文)."""
    words = get_practice_words(user.id, pack_id, count, db)

    questions = []
    for word in words:
        options = generate_distractors(word, word.pack_id, 3, db)
        # Distractors are Chinese, but we need English distractors for this mode
        # So get English words for distractors
        distractor_words = db.query(Word).filter(
            Word.pack_id == word.pack_id,
            Word.id != word.id
        ).order_by(func.random()).limit(3).all()

        if len(distractor_words) < 3:
            more = db.query(Word).filter(
                Word.id != word.id
            ).order_by(func.random()).limit(3 - len(distractor_words)).all()
            distractor_words.extend(more)

        correct_answer = word.english
        all_options = [correct_answer] + [w.english for w in distractor_words[:3]]
        random.shuffle(all_options)
        correct_index = all_options.index(correct_answer)

        questions.append({
            "id": word.id,
            "word_id": word.id,
            "chinese": word.chinese,
            "phonetic": word.phonetic,
            "options": all_options,
            "correct_index": correct_index
        })

    return questions


@router.get("/speaking")
def get_speaking_questions(
    pack_id: int = None,
    count: int = 10,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get speaking practice questions (看中文/音标 → 开口说英文).
    
    Frontend uses Web Speech API for speech recognition.
    User sees Chinese + phonetic, attempts to say the word aloud.
    """
    words = get_practice_words(user.id, pack_id, count, db)

    questions = []
    for word in words:
        questions.append({
            "id": word.id,
            "word_id": word.id,
            "english": word.english,
            "chinese": word.chinese,
            "phonetic": word.phonetic or ""
        })

    return questions


PRACTICE_TO_DIMENSION = {
    "choice": "discrimination",       # 辨
    "spelling": "writing",            # 写
    "listening": "listening",         # 听
    "chinese_to_english": "reading",  # 读
    "speaking": "speaking",           # 说
    "usage": "usage",                 # 用
}


def update_capability(user_id: int, practice_type: str, is_correct: bool, db: Session):
    """Update the six-dimension capability record for a user."""
    dimension = PRACTICE_TO_DIMENSION.get(practice_type)
    if not dimension:
        return

    record = db.query(CapabilityRecord).filter(
        CapabilityRecord.user_id == user_id,
        CapabilityRecord.dimension == dimension
    ).first()

    if not record:
        record = CapabilityRecord(
            user_id=user_id,
            dimension=dimension,
            total_attempts=0,
            correct_attempts=0,
            score=0.0
        )
        db.add(record)

    record.total_attempts += 1
    if is_correct:
        record.correct_attempts += 1
    record.score = round((record.correct_attempts / record.total_attempts) * 100, 1)
    record.last_practice_at = datetime.utcnow()


@router.post("/submit")
def submit_answer(
    data: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Submit a practice answer and get feedback.
    
    For choice/listening: send is_correct (bool).
    For spelling: send user_answer (string) and the server validates it.
    """
    word_id = data.get("word_id")
    practice_type = data.get("practice_type", "choice")
    is_correct = data.get("is_correct", False)
    user_answer = data.get("user_answer")
    
    word = db.query(Word).filter(Word.id == word_id).first()
    if not word:
        raise HTTPException(status_code=404, detail="单词不存在")
    
    # For spelling, validate user_answer server-side
    if practice_type == "spelling" and user_answer is not None:
        is_correct = user_answer.strip().lower() == word.english.lower()
    
    # For speaking, if user_answer is provided (fallback/typing), validate it
    if practice_type == "speaking" and user_answer is not None:
        is_correct = user_answer.strip().lower() == word.english.lower()
    
    if not is_correct:
        record_wrong_answer(user.id, word_id, practice_type, db)
    else:
        # Remove from wrong book if answered correctly
        existing_wrong = db.query(WrongRecord).filter(
            WrongRecord.user_id == user.id,
            WrongRecord.word_id == word_id,
            WrongRecord.practice_type == practice_type
        ).first()
        if existing_wrong:
            db.delete(existing_wrong)
    
    # Update six-dimension capability tracking
    update_capability(user.id, practice_type, is_correct, db)
    
    db.commit()
    
    # Determine the correct answer string for feedback
    if practice_type in ("spelling", "chinese_to_english"):
        correct_answer = word.english
    else:
        correct_answer = word.chinese

    return {
        "message": "success",
        "word_id": word_id,
        "is_correct": is_correct,
        "correct_answer": correct_answer
    }
