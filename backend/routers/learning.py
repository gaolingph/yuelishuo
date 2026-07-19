from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, date

from database import get_db
from models import User, Word, WordPack, LearningRecord, UserPackProgress, Checkin, Pet
from schemas import StudyAction, ReviewAction, BatchStudyAction, LearningRecordResponse, WordResponse
from routers.auth import get_current_user
from services.srs import calculate_next_review, get_review_priority

router = APIRouter(prefix="/api/learning", tags=["学习"])


def update_pack_progress(user_id: int, pack_id: int, db: Session):
    """Update the progress stats for a user's pack."""
    progress = db.query(UserPackProgress).filter(
        UserPackProgress.user_id == user_id,
        UserPackProgress.pack_id == pack_id
    ).first()
    
    if progress:
        progress.learned_words = db.query(LearningRecord).filter(
            LearningRecord.user_id == user_id,
            LearningRecord.word_id.in_(
                db.query(Word.id).filter(Word.pack_id == pack_id)
            )
        ).count()
        
        progress.mastered_words = db.query(LearningRecord).filter(
            LearningRecord.user_id == user_id,
            LearningRecord.is_mastered == True,
            LearningRecord.word_id.in_(
                db.query(Word.id).filter(Word.pack_id == pack_id)
            )
        ).count()
        
        progress.last_study_date = datetime.utcnow()
        db.commit()


@router.get("/today")
def get_today_tasks(pack_id: int = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Get today's learning tasks: new words to learn + words to review."""
    now = datetime.utcnow()
    today = date.today()
    
    # Get checked in today
    checked_in = db.query(Checkin).filter(
        Checkin.user_id == user.id,
        Checkin.checkin_date == today
    ).first() is not None
    
    # Base query for user's packs
    user_packs = db.query(UserPackProgress).filter(
        UserPackProgress.user_id == user.id,
        UserPackProgress.is_unlocked == True
    ).all()
    
    pack_ids = [p.pack_id for p in user_packs]
    if pack_id:
        pack_ids = [pid for pid in pack_ids if pid == pack_id]
    
    if not pack_ids:
        return {
            "checked_in": checked_in,
            "to_review": [],
            "new_words": [],
            "stats": {"new_available": 0, "review_count": 0, "total_learned": 0, "total_mastered": 0}
        }
    
    # Words to review (overdue)
    to_review_records = db.query(LearningRecord).filter(
        LearningRecord.user_id == user.id,
        LearningRecord.next_review <= now,
        LearningRecord.is_mastered == False,
        LearningRecord.word_id.in_(
            db.query(Word.id).filter(Word.pack_id.in_(pack_ids))
        )
    ).order_by(LearningRecord.next_review.asc()).limit(20).all()
    
    to_review_words = []
    for rec in to_review_records:
        word = db.query(Word).filter(Word.id == rec.word_id).first()
        if word:
            to_review_words.append(WordResponse.model_validate(word))
    
    # Already learned word IDs
    learned_word_ids = db.query(LearningRecord.word_id).filter(
        LearningRecord.user_id == user.id,
        LearningRecord.word_id.in_(
            db.query(Word.id).filter(Word.pack_id.in_(pack_ids))
        )
    ).all()
    learned_ids_set = set(w[0] for w in learned_word_ids)
    
    # New words available (not yet learned)
    new_words = db.query(Word).filter(
        Word.pack_id.in_(pack_ids),
        ~Word.id.in_(learned_ids_set) if learned_ids_set else True
    ).order_by(Word.sort_order).limit(10).all()
    
    # Stats
    total_learned = len(learned_ids_set)
    total_mastered = db.query(LearningRecord).filter(
        LearningRecord.user_id == user.id,
        LearningRecord.is_mastered == True,
        LearningRecord.word_id.in_(
            db.query(Word.id).filter(Word.pack_id.in_(pack_ids))
        )
    ).count()
    
    return {
        "checked_in": checked_in,
        "to_review": [WordResponse.model_validate(w) for w in to_review_words],
        "new_words": [WordResponse.model_validate(w) for w in new_words],
        "stats": {
            "new_available": len(new_words),
            "review_count": len(to_review_words),
            "total_learned": total_learned,
            "total_mastered": total_mastered
        }
    }


@router.post("/study")
def study_word(data: StudyAction, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Study a new word for the first time."""
    word = db.query(Word).filter(Word.id == data.word_id).first()
    if not word:
        raise HTTPException(status_code=404, detail="单词不存在")
    
    existing = db.query(LearningRecord).filter(
        LearningRecord.user_id == user.id,
        LearningRecord.word_id == data.word_id
    ).first()
    
    if existing:
        return {"message": "already_learned", "word_id": data.word_id}
    
    # Create first learning record with initial SM-2 values
    from services.srs import calculate_next_review
    ease_factor, interval, repetitions, next_review = calculate_next_review(3, 2.5, 0, 0)
    
    record = LearningRecord(
        user_id=user.id,
        word_id=data.word_id,
        ease_factor=ease_factor,
        interval=interval,
        repetitions=repetitions,
        next_review=next_review,
        last_quality=3,
        is_mastered=False
    )
    db.add(record)
    
    # Update pack progress
    update_pack_progress(user.id, word.pack_id, db)
    
    db.commit()
    
    return {
        "message": "success",
        "word_id": data.word_id,
        "next_review": next_review.isoformat(),
        "interval": interval
    }


@router.get("/batch-new")
def get_new_words_batch(
    pack_id: int,
    batch_size: int = 5,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Get a batch of new (unstudied) words for batch read-aloud learning."""
    # Verify the pack exists and is unlocked
    progress = db.query(UserPackProgress).filter(
        UserPackProgress.user_id == user.id,
        UserPackProgress.pack_id == pack_id,
        UserPackProgress.is_unlocked == True
    ).first()
    if not progress:
        raise HTTPException(status_code=404, detail="词包未解锁或不存在")

    # Already learned word IDs
    learned_ids = set(
        w[0] for w in db.query(LearningRecord.word_id).filter(
            LearningRecord.user_id == user.id,
            LearningRecord.word_id.in_(
                db.query(Word.id).filter(Word.pack_id == pack_id)
            )
        ).all()
    )

    # Get unlearned words
    query = db.query(Word).filter(Word.pack_id == pack_id)
    if learned_ids:
        query = query.filter(~Word.id.in_(learned_ids))

    words = query.order_by(Word.sort_order).limit(batch_size).all()

    return {
        "batch_size": len(words),
        "pack_id": pack_id,
        "words": [WordResponse.model_validate(w) for w in words],
    }


@router.post("/batch-study")
def batch_study_words(
    data: BatchStudyAction,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Batch-create LearningRecords for a list of word_ids."""
    if not data.word_ids:
        raise HTTPException(status_code=400, detail="单词列表不能为空")

    from services.srs import calculate_next_review
    ease_factor, interval, repetitions, next_review = calculate_next_review(3, 2.5, 0, 0)

    studied_count = 0
    pack_ids_updated = set()

    for word_id in data.word_ids:
        word = db.query(Word).filter(Word.id == word_id).first()
        if not word:
            continue

        existing = db.query(LearningRecord).filter(
            LearningRecord.user_id == user.id,
            LearningRecord.word_id == word_id
        ).first()
        if existing:
            continue

        record = LearningRecord(
            user_id=user.id,
            word_id=word_id,
            ease_factor=ease_factor,
            interval=interval,
            repetitions=repetitions,
            next_review=next_review,
            last_quality=3,
            is_mastered=False
        )
        db.add(record)
        studied_count += 1
        pack_ids_updated.add(word.pack_id)

    # Update pack progress for each affected pack
    for pid in pack_ids_updated:
        update_pack_progress(user.id, pid, db)

    db.commit()

    return {
        "message": "success",
        "studied_count": studied_count,
        "word_ids": data.word_ids,
    }


@router.post("/review")
def review_word(data: ReviewAction, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Review a word and apply SM-2 algorithm."""
    if data.quality < 0 or data.quality > 5:
        raise HTTPException(status_code=400, detail="评分必须在0-5之间")
    
    record = db.query(LearningRecord).filter(
        LearningRecord.user_id == user.id,
        LearningRecord.word_id == data.word_id
    ).first()
    
    if not record:
        raise HTTPException(status_code=404, detail="没有找到该单词的学习记录")
    
    # Apply SM-2 algorithm
    ease_factor, interval, repetitions, next_review = calculate_next_review(
        data.quality, record.ease_factor, record.interval, record.repetitions
    )
    
    record.ease_factor = ease_factor
    record.interval = interval
    record.repetitions = repetitions
    record.next_review = next_review
    record.last_quality = data.quality
    record.updated_at = datetime.utcnow()
    
    # Mark as mastered if interval >= 21 days (3 weeks)
    if interval >= 21:
        record.is_mastered = True

    # Award pet food for reviewing (gamification)
    food_earned = 0
    if data.quality >= 3:
        food_earned = 1  # 1 food for correct recall
    if data.quality >= 4:
        food_earned = 2  # 2 food for good recall
    if data.quality == 5:
        food_earned = 3  # 3 food for perfect recall

    if food_earned > 0:
        pet = db.query(Pet).filter(Pet.user_id == user.id).first()
        if pet:
            pet.food += food_earned
        else:
            pet = Pet(user_id=user.id, name="小乐", level=1, exp=0, food=5 + food_earned)
            db.add(pet)

    word = db.query(Word).filter(Word.id == data.word_id).first()
    if word:
        update_pack_progress(user.id, word.pack_id, db)

    db.commit()

    return {
        "message": "success",
        "word_id": data.word_id,
        "ease_factor": ease_factor,
        "interval": interval,
        "repetitions": repetitions,
        "next_review": next_review.isoformat(),
        "is_mastered": record.is_mastered,
        "food_earned": food_earned,
    }


@router.get("/review-list", response_model=List[WordResponse])
def get_review_list(pack_id: int = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Get all words pending review."""
    now = datetime.utcnow()
    
    query = db.query(LearningRecord).filter(
        LearningRecord.user_id == user.id,
        LearningRecord.next_review <= now,
        LearningRecord.is_mastered == False
    )
    
    if pack_id:
        query = query.filter(
            LearningRecord.word_id.in_(
                db.query(Word.id).filter(Word.pack_id == pack_id)
            )
        )
    
    records = query.order_by(LearningRecord.next_review.asc()).limit(50).all()
    
    words = []
    for rec in records:
        word = db.query(Word).filter(Word.id == rec.word_id).first()
        if word:
            words.append(WordResponse.model_validate(word))
    
    return words


@router.get("/mastered", response_model=List[WordResponse])
def get_mastered_words(pack_id: int = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Get all mastered words."""
    query = db.query(LearningRecord).filter(
        LearningRecord.user_id == user.id,
        LearningRecord.is_mastered == True
    )
    
    if pack_id:
        query = query.filter(
            LearningRecord.word_id.in_(
                db.query(Word.id).filter(Word.pack_id == pack_id)
            )
        )
    
    records = query.all()
    
    words = []
    for rec in records:
        word = db.query(Word).filter(Word.id == rec.word_id).first()
        if word:
            words.append(WordResponse.model_validate(word))
    
    return words


@router.get("/word-status/{word_id}")
def get_word_status(word_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Get learning status for a specific word."""
    record = db.query(LearningRecord).filter(
        LearningRecord.user_id == user.id,
        LearningRecord.word_id == word_id
    ).first()
    
    if not record:
        return {"status": "new", "word_id": word_id}
    
    return {
        "status": "review" if not record.is_mastered else "mastered",
        "word_id": word_id,
        "ease_factor": record.ease_factor,
        "interval": record.interval,
        "repetitions": record.repetitions,
        "next_review": record.next_review.isoformat() if record.next_review else None,
        "last_quality": record.last_quality,
        "is_mastered": record.is_mastered
    }


@router.get("/today-review-count")
def get_today_review_count(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get today's review count and remaining daily quota (max 300)."""
    from datetime import datetime
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    count = db.query(LearningRecord).filter(
        LearningRecord.user_id == user.id,
        LearningRecord.updated_at >= today_start,
    ).count()

    limit = 300
    return {
        "count": count,
        "limit": limit,
        "remaining": max(0, limit - count),
    }
