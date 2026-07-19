from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime, date, timedelta

from database import get_db
from models import User, Word, LearningRecord, Checkin, WrongRecord, UserAchievement, PKRecord, WordPack, CapabilityRecord
from schemas import StatsOverview, DayStats, WrongWordResponse, AchievementResponse, WordResponse
from routers.auth import get_current_user

router = APIRouter(prefix="/api/stats", tags=["统计"])

# All six dimensions with their Chinese labels
ALL_DIMENSIONS = [
    {"key": "listening", "name": "听力"},
    {"key": "discrimination", "name": "辨音"},
    {"key": "writing", "name": "拼写"},
    {"key": "reading", "name": "阅读"},
    {"key": "speaking", "name": "口语"},
    {"key": "usage", "name": "语用"},
]


@router.get("/capabilities")
def get_capabilities(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Get the user's six-dimension capability scores."""
    records = db.query(CapabilityRecord).filter(
        CapabilityRecord.user_id == user.id
    ).all()

    record_map = {r.dimension: r for r in records}

    dimensions = []
    for dim in ALL_DIMENSIONS:
        r = record_map.get(dim["key"])
        dimensions.append({
            "key": dim["key"],
            "name": dim["name"],
            "score": r.score if r else 0.0,
            "total_attempts": r.total_attempts if r else 0,
            "correct_attempts": r.correct_attempts if r else 0,
        })

    return {"dimensions": dimensions}


@router.get("/overview")
def get_overview(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Get learning overview statistics."""
    now = datetime.utcnow()
    today = date.today()
    today_start = datetime(today.year, today.month, today.day)
    
    # Total stats
    total_learned = db.query(LearningRecord).filter(
        LearningRecord.user_id == user.id
    ).count()
    
    total_mastered = db.query(LearningRecord).filter(
        LearningRecord.user_id == user.id,
        LearningRecord.is_mastered == True
    ).count()
    
    # Today stats
    today_learned = db.query(LearningRecord).filter(
        LearningRecord.user_id == user.id,
        LearningRecord.created_at >= today_start
    ).count()
    
    today_review = db.query(LearningRecord).filter(
        LearningRecord.user_id == user.id,
        LearningRecord.updated_at >= today_start,
        LearningRecord.repetitions > 0
    ).count()
    
    # Review queue
    to_review = db.query(LearningRecord).filter(
        LearningRecord.user_id == user.id,
        LearningRecord.next_review <= now,
        LearningRecord.is_mastered == False
    ).count()
    
    # Streak days
    streak = 0
    check_date = today
    while True:
        checkin = db.query(Checkin).filter(
            Checkin.user_id == user.id,
            Checkin.checkin_date == check_date
        ).first()
        if checkin:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            break
    
    total_active_days = db.query(Checkin).filter(
        Checkin.user_id == user.id
    ).distinct(Checkin.checkin_date).count()
    
    # Pack count
    packs_learning = db.query(LearningRecord).distinct(
        LearningRecord.word_id
    ).filter(
        LearningRecord.user_id == user.id
    ).count()
    
    # Accuracy (based on last quality scores)
    avg_quality = db.query(func.avg(LearningRecord.last_quality)).filter(
        LearningRecord.user_id == user.id,
        LearningRecord.last_quality > 0
    ).scalar() or 0
    
    accuracy = round(avg_quality / 5 * 100, 1) if avg_quality else 0
    
    return {
        "total_learned": total_learned,
        "total_mastered": total_mastered,
        "to_review": to_review,
        "today_learned": today_learned,
        "today_review": today_review,
        "streak_days": streak,
        "total_days": total_active_days,
        "pack_count": packs_learning,
        "accuracy": accuracy
    }


@router.get("/calendar")
def get_calendar(year: int = None, month: int = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Get check-in calendar data."""
    now = datetime.utcnow()
    if not year:
        year = now.year
    if not month:
        month = now.month
    
    # Get all check-ins for the month
    month_start = date(year, month, 1)
    if month == 12:
        month_end = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        month_end = date(year, month + 1, 1) - timedelta(days=1)
    
    checkins = db.query(Checkin).filter(
        Checkin.user_id == user.id,
        Checkin.checkin_date >= month_start,
        Checkin.checkin_date <= month_end
    ).all()
    
    checkin_dates = set(c.checkin_date.isoformat() for c in checkins)
    
    # Get daily learning counts
    daily_counts = {}
    for c in checkins:
        day_learned = db.query(LearningRecord).filter(
            LearningRecord.user_id == user.id,
            func.date(LearningRecord.created_at) == c.checkin_date
        ).count()
        daily_counts[c.checkin_date.isoformat()] = day_learned
    
    days = []
    d = month_start
    while d <= month_end:
        days.append({
            "date": d.isoformat(),
            "checked_in": d.isoformat() in checkin_dates,
            "count": daily_counts.get(d.isoformat(), 0)
        })
        d += timedelta(days=1)
    
    return {
        "year": year,
        "month": month,
        "days": days,
        "total": len(checkins)
    }


@router.get("/wrong-book")
def get_wrong_book(pack_id: int = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Get wrong word book."""
    query = db.query(WrongRecord).filter(WrongRecord.user_id == user.id)
    
    if pack_id:
        query = query.filter(
            WrongRecord.word_id.in_(
                db.query(Word.id).filter(Word.pack_id == pack_id)
            )
        )
    
    records = query.order_by(WrongRecord.wrong_count.desc()).all()
    
    result = []
    for rec in records:
        word = db.query(Word).filter(Word.id == rec.word_id).first()
        if word:
            result.append({
                "id": rec.id,
                "word": WordResponse.model_validate(word),
                "wrong_count": rec.wrong_count,
                "practice_type": rec.practice_type,
                "last_wrong_at": rec.last_wrong_at
            })
    
    return result


@router.delete("/wrong-book/{word_id}")
def remove_from_wrong_book(word_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Remove a word from wrong book (after re-learning)."""
    records = db.query(WrongRecord).filter(
        WrongRecord.user_id == user.id,
        WrongRecord.word_id == word_id
    ).all()
    
    for rec in records:
        db.delete(rec)
    db.commit()
    
    return {"message": "success"}


@router.get("/achievements")
def get_achievements(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Get all achievements with earned status."""
    all_achievements = [
        {"key": "first_study", "name": "初次学习", "desc": "完成第一次单词学习"},
        {"key": "study_7_days", "name": "坚持一周", "desc": "连续学习7天"},
        {"key": "study_30_days", "name": "坚持一个月", "desc": "连续学习30天"},
        {"key": "learn_100", "name": "百词达人", "desc": "累计学习100个单词"},
        {"key": "learn_500", "name": "词汇新星", "desc": "累计学习500个单词"},
        {"key": "learn_1000", "name": "千词挑战", "desc": "累计学习1000个单词"},
        {"key": "master_50", "name": "初露锋芒", "desc": "掌握50个单词"},
        {"key": "master_200", "name": "渐入佳境", "desc": "掌握200个单词"},
        {"key": "review_100", "name": "复习达人", "desc": "完成100次复习"},
        {"key": "perfect_pk", "name": "PK新秀", "desc": "赢得一次PK对战"},
        {"key": "first_checkin", "name": "初次打卡", "desc": "完成第一次打卡"},
        {"key": "no_wrong", "name": "完美一天", "desc": "一天内练习全部正确"},
    ]
    
    earned = db.query(UserAchievement).filter(
        UserAchievement.user_id == user.id
    ).all()
    
    earned_keys = {e.achievement_key: e.earned_at for e in earned}
    
    result = []
    for ach in all_achievements:
        result.append({
            "key": ach["key"],
            "name": ach["name"],
            "description": ach["desc"],
            "earned_at": earned_keys.get(ach["key"]),
            "is_earned": ach["key"] in earned_keys
        })
    
    return result


@router.get("/learning-curve")
def get_learning_curve(days: int = 30, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Get learning curve data for the last N days."""
    today = date.today()
    result = []
    
    for i in range(days - 1, -1, -1):
        d = today - timedelta(days=i)
        count = db.query(LearningRecord).filter(
            LearningRecord.user_id == user.id,
            func.date(LearningRecord.created_at) == d
        ).count()
        
        review_count = db.query(LearningRecord).filter(
            LearningRecord.user_id == user.id,
            func.date(LearningRecord.updated_at) == d,
            LearningRecord.repetitions > 0
        ).count()
        
        result.append({
            "date": d.isoformat(),
            "learned": count,
            "reviewed": review_count
        })
    
    return result


@router.post("/checkin")
def checkin(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Daily check-in."""
    today = date.today()
    existing = db.query(Checkin).filter(
        Checkin.user_id == user.id,
        Checkin.checkin_date == today
    ).first()
    
    if existing:
        return {"message": "already_checked_in", "date": today.isoformat()}
    
    checkin = Checkin(user_id=user.id, checkin_date=today)
    db.add(checkin)
    db.commit()
    
    # Check achievements
    check_streak = db.query(Checkin).filter(
        Checkin.user_id == user.id
    ).order_by(Checkin.checkin_date.desc()).count()
    
    if check_streak >= 7:
        _earn_achievement(user.id, "study_7_days", "坚持一周", db)
    if check_streak >= 30:
        _earn_achievement(user.id, "study_30_days", "坚持一个月", db)
    
    _earn_achievement(user.id, "first_checkin", "初次打卡", db)
    
    return {"message": "success", "date": today.isoformat(), "streak": check_streak}


def _earn_achievement(user_id: int, key: str, name: str, db: Session):
    existing = db.query(UserAchievement).filter(
        UserAchievement.user_id == user_id,
        UserAchievement.achievement_key == key
    ).first()
    
    if not existing:
        achievement = UserAchievement(
            user_id=user_id,
            achievement_key=key,
            achievement_name=name
        )
        db.add(achievement)
        db.commit()


@router.post("/check-achievements")
def check_achievements(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Check and award achievements based on current stats."""
    # Learn count achievements
    total_learned = db.query(LearningRecord).filter(
        LearningRecord.user_id == user.id
    ).count()
    
    if total_learned >= 1:
        _earn_achievement(user.id, "first_study", "初次学习", db)
    if total_learned >= 100:
        _earn_achievement(user.id, "learn_100", "百词达人", db)
    if total_learned >= 500:
        _earn_achievement(user.id, "learn_500", "词汇新星", db)
    if total_learned >= 1000:
        _earn_achievement(user.id, "learn_1000", "千词挑战", db)
    
    # Master count achievements
    total_mastered = db.query(LearningRecord).filter(
        LearningRecord.user_id == user.id,
        LearningRecord.is_mastered == True
    ).count()
    
    if total_mastered >= 50:
        _earn_achievement(user.id, "master_50", "初露锋芒", db)
    if total_mastered >= 200:
        _earn_achievement(user.id, "master_200", "渐入佳境", db)
    
    # Review achievements
    total_reviews = db.query(LearningRecord).filter(
        LearningRecord.user_id == user.id,
        LearningRecord.repetitions > 0
    ).count()
    
    if total_reviews >= 100:
        _earn_achievement(user.id, "review_100", "复习达人", db)
    
    return {"message": "checked"}
