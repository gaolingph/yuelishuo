from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import random

from sqlalchemy import func
from database import get_db
from models import User, Word, WordPack, PKRecord, LearningRecord, UserAchievement
from schemas import WordResponse
from routers.auth import get_current_user

router = APIRouter(prefix="/api/pk", tags=["PK对战"])


@router.get("/start")
def start_pk(
    pack_id: int = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Start a PK challenge - get a set of words to compete on."""
    if pack_id:
        words = db.query(Word).filter(Word.pack_id == pack_id).order_by(
            func.random()
        ).limit(10).all()
    else:
        words = db.query(Word).order_by(func.random()).limit(10).all()
    
    if len(words) < 5:
        raise HTTPException(status_code=400, detail="词库单词不足")
    
    return {
        "pk_id": int(datetime.utcnow().timestamp() * 1000) % 1000000,
        "words": [WordResponse.model_validate(w) for w in words],
        "time_limit": 60,  # seconds
        "total_questions": len(words)
    }


@router.post("/finish")
def finish_pk(
    data: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Finish a PK and record the result."""
    score = data.get("score", 0)
    total = data.get("total", 0)
    is_win = data.get("is_win", None)
    
    # Record PK
    pk = PKRecord(
        user_id=user.id,
        score=score,
        opponent_score=total - score if total else 0,
        is_win=is_win,
        played_at=datetime.utcnow()
    )
    db.add(pk)
    
    # Check achievement
    if is_win:
        existing = db.query(UserAchievement).filter(
            UserAchievement.user_id == user.id,
            UserAchievement.achievement_key == "perfect_pk"
        ).first()
        if not existing:
            ach = UserAchievement(
                user_id=user.id,
                achievement_key="perfect_pk",
                achievement_name="PK新秀"
            )
            db.add(ach)
    
    db.commit()
    
    return {
        "message": "success",
        "score": score,
        "total": total,
        "accuracy": round(score / max(total, 1) * 100, 1)
    }


@router.get("/history")
def get_pk_history(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Get PK history."""
    records = db.query(PKRecord).filter(
        PKRecord.user_id == user.id
    ).order_by(PKRecord.played_at.desc()).limit(20).all()
    
    return [{
        "id": r.id,
        "score": r.score,
        "opponent_score": r.opponent_score,
        "is_win": r.is_win,
        "played_at": r.played_at.isoformat()
    } for r in records]


@router.get("/leaderboard")
def get_leaderboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Get user leaderboard based on mastered words."""
    # Top users by mastered count
    top_users = db.query(
        LearningRecord.user_id,
        User.nickname,
        User.username,
        func.count(LearningRecord.id).label('mastered_count')
    ).join(User, LearningRecord.user_id == User.id).filter(
        LearningRecord.is_mastered == True
    ).group_by(
        LearningRecord.user_id
    ).order_by(
        func.count(LearningRecord.id).desc()
    ).limit(20).all()
    
    leaderboard = []
    for i, (uid, nickname, username, count) in enumerate(top_users):
        leaderboard.append({
            "rank": i + 1,
            "user_id": uid,
            "nickname": nickname or username,
            "mastered_count": count,
            "is_me": uid == user.id
        })
    
    return leaderboard
