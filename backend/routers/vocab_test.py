"""Vocabulary assessment test router + 记忆扫描 (Memory Scan).

Students take a 15-question test covering all difficulty levels.
Results are scored and mapped to a proficiency level with estimated vocabulary size.

记忆扫描: 基于学习记录自动将单词归入绿/黄/红三区 (智牛复刻).
"""

import random
import time
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User, Word, WordPack, VocabTestRecord, MemoryScan, LearningRecord, WrongRecord
from routers.auth import get_current_user
from schemas import MemoryScanResultResponse, MemoryScanWordItem

router = APIRouter(prefix="/api/vocab-test", tags=["vocab-test"])

# ── Level group definitions ─────────────────────────────────────────
# Each group maps to a set of word pack IDs and contributes 3 questions.
LEVEL_GROUPS = [
    {
        "key": "primary",
        "name": "外研小学",
        "pack_ids": [12, 13],
        "count": 5,
    },
    {
        "key": "junior",
        "name": "外研初中",
        "pack_ids": [14, 15],
        "count": 5,
    },
    {
        "key": "senior",
        "name": "外研高中",
        "pack_ids": [16, 17],
        "count": 5,
    },
]

# ── Level scoring thresholds ────────────────────────────────────────
LEVEL_THRESHOLDS = [
    {"max_score": 3, "key": "beginner", "label": "🌱 初学者", "vocab": 300},
    {"max_score": 6, "key": "elementary", "label": "📗 基础级", "vocab": 800},
    {"max_score": 9, "key": "intermediate", "label": "📘 进阶级", "vocab": 1500},
    {"max_score": 12, "key": "advanced", "label": "📙 高级", "vocab": 2800},
    {"max_score": 15, "key": "proficient", "label": "📕 精通级", "vocab": 4500},
]

RECOMMENDATIONS = {
    "beginner": "建议从 **外研社小学基础词汇** 开始学习，打好基础后再逐步进阶。推荐报名《单词速记 · 入门班》。",
    "elementary": "已有一定基础，建议系统学习 **外研社小学进阶 + 初中基础词汇**，巩固提升。推荐报名《单词速记 · 基础班》。",
    "intermediate": "词汇量处于中等水平，建议学习 **外研社初中进阶 + 高中基础词汇** 来突破瓶颈。推荐报名《单词速记 · 进阶班》。",
    "advanced": "词汇量不错！建议学习 **外研社高中进阶词汇** 向高阶冲刺。推荐报名《单词速记 · 强化班》。",
    "proficient": "词汇量非常出色！建议继续学习 **外研社全部词汇** 巩固提升。推荐报名《单词速记 · 冲刺班》。",
}


# ── In-memory test session store ────────────────────────────────────
# Structure: {test_id: {"user_id": int, "answers": {word_id: correct_chinese}, "questions": [...], "created_at": float}}
_test_sessions: dict = {}
_SESSION_TTL = 3600  # 1 hour


def _cleanup_expired_sessions():
    """Remove expired test sessions."""
    now = time.time()
    expired = [tid for tid, s in _test_sessions.items() if now - s["created_at"] > _SESSION_TTL]
    for tid in expired:
        del _test_sessions[tid]


def _get_level_for_score(score: int) -> dict:
    """Map a score (0-15) to the corresponding level definition."""
    for level in LEVEL_THRESHOLDS:
        if score <= level["max_score"]:
            return level
    return LEVEL_THRESHOLDS[-1]


# ── Memory Scan ─────────────────────────────────────────────────────

def _classify_word(
    user_id: int,
    word: Word,
    learning_record: Optional[LearningRecord],
    wrong_records: list,
) -> str:
    """Classify a word into green/yellow/red zone.
    
    绿区(已会): mastered=True, 且近期无错
    黄区(模糊): 学习过但未掌握, 或错1-2次
    红区(不会): 从未学, 或错3次+
    """
    if learning_record is None:
        # 从未学习过 → 红区
        return "red"

    if learning_record.is_mastered:
        # 已掌握 → 检查近期是否有错
        recent_wrong = [
            wr for wr in wrong_records
            if wr.last_wrong_at and wr.last_wrong_at > datetime.utcnow() - timedelta(days=7)
        ]
        if not recent_wrong:
            return "green"
        else:
            # 已掌握但近期有错 → 降级为黄
            return "yellow"

    # 学习过但未掌握
    total_wrong = sum(wr.wrong_count for wr in wrong_records) if wrong_records else 0
    if total_wrong >= 3:
        return "red"
    elif total_wrong >= 1:
        return "yellow"
    else:
        # 学习过, 无错, 但未掌握 → 黄区(还需巩固)
        return "yellow"


@router.get("/memory-scan/{pack_id}", response_model=MemoryScanResultResponse)
def memory_scan(
    pack_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """执行记忆扫描: 将指定词包中的所有单词自动归入绿/黄/红三区.
    
    返回单词地图, 包含每个区域的单词明细和统计数据.
    同时将扫描结果保存到DB, 用于后续追踪.
    """
    # 1. Verify pack exists
    pack = db.query(WordPack).filter(WordPack.id == pack_id).first()
    if not pack:
        raise HTTPException(status_code=404, detail="词包不存在")

    # 2. Get all words in the pack
    words = db.query(Word).filter(Word.pack_id == pack_id).order_by(Word.sort_order).all()
    if not words:
        raise HTTPException(status_code=404, detail="词包中无单词")

    # 3. Get user's learning records and wrong records for these words
    word_ids = [w.id for w in words]
    learning_records = {
        lr.word_id: lr
        for lr in db.query(LearningRecord).filter(
            LearningRecord.user_id == current_user.id,
            LearningRecord.word_id.in_(word_ids),
        ).all()
    }
    wrong_records_map: dict[int, list] = {wid: [] for wid in word_ids}
    for wr in db.query(WrongRecord).filter(
        WrongRecord.user_id == current_user.id,
        WrongRecord.word_id.in_(word_ids),
    ).all():
        wrong_records_map.setdefault(wr.word_id, []).append(wr)

    # 4. Classify each word
    green_words: list[dict] = []
    yellow_words: list[dict] = []
    red_words: list[dict] = []

    for word in words:
        lr = learning_records.get(word.id)
        wrs = wrong_records_map.get(word.id, [])
        zone = _classify_word(current_user.id, word, lr, wrs)

        item = {
            "word_id": word.id,
            "english": word.english,
            "chinese": word.chinese,
            "phonetic": word.phonetic or "",
            "zone": zone,
        }

        if zone == "green":
            green_words.append(item)
        elif zone == "yellow":
            yellow_words.append(item)
        else:
            red_words.append(item)

    # 5. Save scan result to DB
    scan = MemoryScan(
        user_id=current_user.id,
        pack_id=pack_id,
        total_words=len(words),
        zone_green=[w["word_id"] for w in green_words],
        zone_yellow=[w["word_id"] for w in yellow_words],
        zone_red=[w["word_id"] for w in red_words],
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    # 6. Build response
    return MemoryScanResultResponse(
        id=scan.id,
        pack_id=pack_id,
        pack_name=pack.name,
        total_words=len(words),
        green_count=len(green_words),
        yellow_count=len(yellow_words),
        red_count=len(red_words),
        green_words=[MemoryScanWordItem(**gw) for gw in green_words],
        yellow_words=[MemoryScanWordItem(**gw) for gw in yellow_words],
        red_words=[MemoryScanWordItem(**gw) for gw in red_words],
        scan_date=scan.created_at,
    )


# ── Endpoints ───────────────────────────────────────────────────────

@router.get("/start")
def start_test(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a 15-question vocabulary assessment test.

    Questions are stratified across 5 difficulty levels (3 per level).
    Each question presents an English word with 4 Chinese options.
    """
    _cleanup_expired_sessions()

    questions = []
    answer_key = {}  # word_id -> correct chinese text

    for group in LEVEL_GROUPS:
        # Get all words from the packs in this group
        words = (
            db.query(Word)
            .filter(Word.pack_id.in_(group["pack_ids"]))
            .all()
        )

        if len(words) < group["count"]:
            # Not enough words in this group — fallback to fewer questions
            continue

        # Randomly select words for this group
        selected = random.sample(words, min(group["count"], len(words)))

        for word in selected:
            # Build 4 options: 1 correct + 3 distractors from same group
            correct_chinese = word.chinese

            # Get distractors (other words' Chinese translations)
            distractors_pool = [
                w.chinese
                for w in words
                if w.id != word.id and w.chinese != correct_chinese
            ]
            # Shuffle and pick 3
            random.shuffle(distractors_pool)
            distractors = distractors_pool[:3]

            # If not enough unique distractors, pad with empty strings (shouldn't happen given word counts)
            while len(distractors) < 3:
                distractors.append("———")

            options = [correct_chinese] + distractors
            random.shuffle(options)

            # Record the correct answer
            answer_key[str(word.id)] = correct_chinese

            questions.append({
                "word_id": word.id,
                "english": word.english,
                "phonetic": word.phonetic or "",
                "options": options,
                "level": group["key"],
                "level_name": group["name"],
            })

    # Shuffle questions so levels are interleaved
    random.shuffle(questions)

    # Generate a test ID (timestamp + user_id)
    test_id = f"vt_{int(time.time())}_{current_user.id}"

    # Store session
    _test_sessions[test_id] = {
        "user_id": current_user.id,
        "answers": answer_key,
        "questions": questions,
        "created_at": time.time(),
    }

    return {
        "test_id": test_id,
        "total": len(questions),
        "questions": questions,
    }


@router.post("/submit")
def submit_test(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit test answers and receive a level report.

    Body: { "test_id": "...", "answers": [{ "word_id": 1, "selected": "中文选项" }, ...] }
    """
    test_id = data.get("test_id")
    user_answers = data.get("answers", [])

    if not test_id or test_id not in _test_sessions:
        raise HTTPException(status_code=404, detail="测试已过期或不存在，请重新开始")

    session = _test_sessions[test_id]

    if session["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="无权提交此测试")

    answer_key = session["answers"]
    questions = session["questions"]

    # Score
    correct_count = 0
    details = []

    # Build a map of word_id -> question info for quick lookup
    question_map = {q["word_id"]: q for q in questions}

    for ans in user_answers:
        word_id = ans.get("word_id")
        selected = ans.get("selected", "")
        correct = answer_key.get(str(word_id), "")

        is_correct = selected == correct
        if is_correct:
            correct_count += 1

        q_info = question_map.get(word_id, {})
        details.append({
            "word_id": word_id,
            "english": q_info.get("english", ""),
            "level": q_info.get("level", ""),
            "level_name": q_info.get("level_name", ""),
            "is_correct": is_correct,
            "correct_answer": correct,
            "user_answer": selected,
        })

    # Calculate level
    level_info = _get_level_for_score(correct_count)
    estimated_vocab = level_info["vocab"]

    # Per-level breakdown
    level_breakdown = {}
    for d in details:
        lk = d["level"]
        if lk not in level_breakdown:
            level_breakdown[lk] = {"correct": 0, "total": 0}
        level_breakdown[lk]["total"] += 1
        if d["is_correct"]:
            level_breakdown[lk]["correct"] += 1

    # Calculate percentage
    total = len(questions)
    percentage = round((correct_count / total) * 100) if total > 0 else 0

    # Build recommendation
    recommendation = RECOMMENDATIONS.get(level_info["key"], "")

    report = {
        "score": correct_count,
        "total": total,
        "percentage": percentage,
        "level_key": level_info["key"],
        "level_label": level_info["label"],
        "estimated_vocab": estimated_vocab,
        "recommendation": recommendation,
        "level_breakdown": level_breakdown,
        "details": details,
    }

    # Save to database
    record = VocabTestRecord(
        user_id=current_user.id,
        score=correct_count,
        total_questions=total,
        level=level_info["key"],
        estimated_vocab=estimated_vocab,
        details={
            "level_label": level_info["label"],
            "percentage": percentage,
            "level_breakdown": level_breakdown,
            "recommendation": recommendation,
        },
    )
    db.add(record)
    db.commit()

    # Clean up session
    del _test_sessions[test_id]

    return report


@router.get("/history")
def get_test_history(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the user's test history, most recent first."""
    records = (
        db.query(VocabTestRecord)
        .filter(VocabTestRecord.user_id == current_user.id)
        .order_by(VocabTestRecord.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": r.id,
            "score": r.score,
            "total": r.total_questions,
            "percentage": round((r.score / r.total_questions) * 100) if r.total_questions > 0 else 0,
            "level": r.level,
            "level_label": r.details.get("level_label", "") if r.details else "",
            "estimated_vocab": r.estimated_vocab,
            "taken_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in records
    ]
