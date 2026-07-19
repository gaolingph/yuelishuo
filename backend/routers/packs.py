from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import User, WordPack, Word, UserPackProgress, LearningRecord
from schemas import WordPackResponse, WordResponse
from routers.auth import get_current_user

router = APIRouter(prefix="/api/packs", tags=["词包"])


@router.get("/", response_model=List[WordPackResponse])
def get_packs(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    packs = db.query(WordPack).order_by(WordPack.sort_order).all()
    result = []
    
    for pack in packs:
        progress = db.query(UserPackProgress).filter(
            UserPackProgress.user_id == user.id,
            UserPackProgress.pack_id == pack.id
        ).first()
        
        is_unlocked = progress.is_unlocked if progress else False
        
        # Auto-unlock if not yet unlocked
        if not progress:
            progress = UserPackProgress(
                user_id=user.id,
                pack_id=pack.id,
                is_unlocked=True,
                total_words=pack.word_count
            )
            db.add(progress)
            db.commit()
            is_unlocked = True
        elif not is_unlocked:
            progress.is_unlocked = True
            db.commit()
            is_unlocked = True
        
        progress_data = None
        if progress:
            progress_data = {
                "total": progress.total_words,
                "learned": progress.learned_words,
                "mastered": progress.mastered_words,
                "percent": round(progress.learned_words / max(progress.total_words, 1) * 100, 1)
            }
        
        pack_resp = WordPackResponse(
            id=pack.id,
            name=pack.name,
            level=pack.level,
            pack_type=pack.pack_type,
            description=pack.description,
            word_count=pack.word_count,
            sort_order=pack.sort_order,
            is_free=pack.is_free,
            is_unlocked=is_unlocked,
            progress=progress_data
        )
        result.append(pack_resp)
    
    return result


@router.get("/{pack_id}/words", response_model=List[WordResponse])
def get_pack_words(pack_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    pack = db.query(WordPack).filter(WordPack.id == pack_id).first()
    if not pack:
        raise HTTPException(status_code=404, detail="词包不存在")
    
    words = db.query(Word).filter(Word.pack_id == pack_id).order_by(Word.sort_order).all()
    return [WordResponse.model_validate(w) for w in words]


@router.get("/{pack_id}/learning-status")
def get_pack_learning_status(pack_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    pack = db.query(WordPack).filter(WordPack.id == pack_id).first()
    if not pack:
        raise HTTPException(status_code=404, detail="词包不存在")
    
    progress = db.query(UserPackProgress).filter(
        UserPackProgress.user_id == user.id,
        UserPackProgress.pack_id == pack_id
    ).first()
    
    total_words = db.query(Word).filter(Word.pack_id == pack_id).count()
    learned = db.query(LearningRecord).filter(
        LearningRecord.user_id == user.id,
        LearningRecord.word_id.in_(
            db.query(Word.id).filter(Word.pack_id == pack_id)
        )
    ).count()
    
    mastered = db.query(LearningRecord).filter(
        LearningRecord.user_id == user.id,
        LearningRecord.is_mastered == True,
        LearningRecord.word_id.in_(
            db.query(Word.id).filter(Word.pack_id == pack_id)
        )
    ).count()
    
    # Words to review today
    from datetime import datetime
    to_review = db.query(LearningRecord).filter(
        LearningRecord.user_id == user.id,
        LearningRecord.next_review <= datetime.utcnow(),
        LearningRecord.is_mastered == False,
        LearningRecord.word_id.in_(
            db.query(Word.id).filter(Word.pack_id == pack_id)
        )
    ).count()
    
    return {
        "total_words": total_words,
        "learned": learned,
        "mastered": mastered,
        "to_review": to_review,
        "progress_percent": round(learned / max(total_words, 1) * 100, 1)
    }
