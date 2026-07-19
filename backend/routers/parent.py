from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from typing import List
from datetime import datetime, date, timedelta

from database import get_db
from models import User, ParentStudent, LearningRecord, Checkin, WrongRecord, Word, CapabilityRecord
from schemas import ChildStatsResponse
from routers.auth import get_current_user, require_role

router = APIRouter(prefix="/api/parent", tags=["家长端"])

parent_only = require_role(["parent"])


@router.get("/children")
def get_children(db: Session = Depends(get_db), user: User = Depends(parent_only)):
    """获取关联的孩子列表"""
    links = db.query(ParentStudent).filter(ParentStudent.parent_id == user.id).all()
    result = []
    for link in links:
        student = db.query(User).filter(User.id == link.student_id).first()
        if not student:
            continue

        # 学习概览
        learned = db.query(LearningRecord).filter(
            LearningRecord.user_id == student.id
        ).count()
        mastered = db.query(LearningRecord).filter(
            LearningRecord.user_id == student.id,
            LearningRecord.is_mastered == True
        ).count()
        to_review = db.query(LearningRecord).filter(
            LearningRecord.user_id == student.id,
            LearningRecord.next_review <= datetime.utcnow(),
            LearningRecord.is_mastered == False
        ).count()
        today = date.today()
        today_learned = db.query(LearningRecord).filter(
            LearningRecord.user_id == student.id,
            cast(LearningRecord.created_at, Date) == today
        ).count()

        # 连续签到
        streak = 0
        d = today
        while True:
            c = db.query(Checkin).filter(
                Checkin.user_id == student.id, Checkin.checkin_date == d
            ).first()
            if c:
                streak += 1
                d -= timedelta(days=1)
            else:
                break

        result.append({
            "user_id": student.id,
            "username": student.username,
            "nickname": student.nickname or student.username,
            "relationship": link.relationship or "",
            "total_learned": learned,
            "total_mastered": mastered,
            "to_review": to_review,
            "today_learned": today_learned,
            "streak_days": streak,
        })
    return result


@router.get("/children/{student_id}/stats", response_model=ChildStatsResponse)
def get_child_stats(student_id: int, db: Session = Depends(get_db),
                    user: User = Depends(parent_only)):
    """查看孩子的学习概览"""
    _check_child_access(user.id, student_id, db)

    student = db.query(User).filter(User.id == student_id).first()
    learned = db.query(LearningRecord).filter(LearningRecord.user_id == student_id).count()
    mastered = db.query(LearningRecord).filter(
        LearningRecord.user_id == student_id, LearningRecord.is_mastered == True
    ).count()
    to_review = db.query(LearningRecord).filter(
        LearningRecord.user_id == student_id,
        LearningRecord.next_review <= datetime.utcnow(),
        LearningRecord.is_mastered == False
    ).count()
    today = date.today()
    today_learned = db.query(LearningRecord).filter(
        LearningRecord.user_id == student_id,
        cast(LearningRecord.created_at, Date) == today
    ).count()
    today_review = db.query(LearningRecord).filter(
        LearningRecord.user_id == student_id,
        cast(LearningRecord.updated_at, Date) == today,
        LearningRecord.repetitions > 0
    ).count()

    # 连续签到
    streak = 0
    d = today
    while True:
        c = db.query(Checkin).filter(
            Checkin.user_id == student_id, Checkin.checkin_date == d
        ).first()
        if c:
            streak += 1
            d -= timedelta(days=1)
        else:
            break
    total_days = db.query(Checkin).filter(
        Checkin.user_id == student_id
    ).distinct(Checkin.checkin_date).count()

    avg_quality = db.query(func.avg(LearningRecord.last_quality)).filter(
        LearningRecord.user_id == student_id, LearningRecord.last_quality > 0
    ).scalar() or 0
    accuracy = round(avg_quality / 5 * 100, 1) if avg_quality else 0

    return ChildStatsResponse(
        user_id=student_id,
        username=student.username,
        nickname=student.nickname or student.username,
        total_learned=learned,
        total_mastered=mastered,
        to_review=to_review,
        today_learned=today_learned,
        today_review=today_review,
        streak_days=streak,
        total_days=total_days,
        accuracy=accuracy,
    )


@router.get("/children/{student_id}/calendar")
def get_child_calendar(student_id: int, year: int = None, month: int = None,
                       db: Session = Depends(get_db), user: User = Depends(parent_only)):
    """查看孩子的签到日历"""
    _check_child_access(user.id, student_id, db)

    now = datetime.utcnow()
    year = year or now.year
    month = month or now.month

    month_start = date(year, month, 1)
    if month == 12:
        month_end = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        month_end = date(year, month + 1, 1) - timedelta(days=1)

    checkins = db.query(Checkin).filter(
        Checkin.user_id == student_id,
        Checkin.checkin_date >= month_start,
        Checkin.checkin_date <= month_end
    ).all()
    checkin_dates = {c.checkin_date.isoformat() for c in checkins}

    days = []
    d = month_start
    while d <= month_end:
        day_learned = db.query(LearningRecord).filter(
            LearningRecord.user_id == student_id,
            cast(LearningRecord.created_at, Date) == d
        ).count()
        days.append({
            "date": d.isoformat(),
            "checked_in": d.isoformat() in checkin_dates,
            "count": day_learned,
        })
        d += timedelta(days=1)

    return {"year": year, "month": month, "days": days, "total": len(checkins)}


@router.get("/children/{student_id}/curve")
def get_child_learning_curve(student_id: int, days: int = 30,
                             db: Session = Depends(get_db), user: User = Depends(parent_only)):
    """查看孩子的学习曲线"""
    _check_child_access(user.id, student_id, db)

    today = date.today()
    result = []
    for i in range(days - 1, -1, -1):
        d = today - timedelta(days=i)
        learned = db.query(LearningRecord).filter(
            LearningRecord.user_id == student_id,
            cast(LearningRecord.created_at, Date) == d
        ).count()
        reviewed = db.query(LearningRecord).filter(
            LearningRecord.user_id == student_id,
            cast(LearningRecord.updated_at, Date) == d,
            LearningRecord.repetitions > 0
        ).count()
        result.append({"date": d.isoformat(), "learned": learned, "reviewed": reviewed})
    return result


@router.get("/children/{student_id}/wrong-book")
def get_child_wrong_book(student_id: int, pack_id: int = None,
                         db: Session = Depends(get_db), user: User = Depends(parent_only)):
    """查看孩子的错题本"""
    _check_child_access(user.id, student_id, db)

    query = db.query(WrongRecord).filter(WrongRecord.user_id == student_id)
    if pack_id:
        query = query.filter(
            WrongRecord.word_id.in_(db.query(Word.id).filter(Word.pack_id == pack_id))
        )
    records = query.order_by(WrongRecord.wrong_count.desc()).all()

    result = []
    for rec in records:
        word = db.query(Word).filter(Word.id == rec.word_id).first()
        if word:
            result.append({
                "id": rec.id,
                "word": {"id": word.id, "english": word.english, "chinese": word.chinese,
                         "phonetic": word.phonetic},
                "wrong_count": rec.wrong_count,
                "practice_type": rec.practice_type,
                "last_wrong_at": rec.last_wrong_at,
            })
    return result


@router.get("/children/{student_id}/achievements")
def get_child_achievements(student_id: int, db: Session = Depends(get_db),
                           user: User = Depends(parent_only)):
    """查看孩子的成就"""
    _check_child_access(user.id, student_id, db)

    from models import UserAchievement
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
        UserAchievement.user_id == student_id
    ).all()
    earned_keys = {e.achievement_key: e.earned_at for e in earned}

    result = []
    for ach in all_achievements:
        result.append({
            "key": ach["key"], "name": ach["name"], "description": ach["desc"],
            "earned_at": earned_keys.get(ach["key"]),
            "is_earned": ach["key"] in earned_keys,
        })
    return result


@router.get("/children/{student_id}/capabilities")
def get_child_capabilities(student_id: int, db: Session = Depends(get_db),
                           user: User = Depends(parent_only)):
    """查看孩子的六维能力雷达图"""
    _check_child_access(user.id, student_id, db)

    ALL_DIMENSIONS = [
        {"key": "listening", "name": "听力"},
        {"key": "discrimination", "name": "辨音"},
        {"key": "writing", "name": "拼写"},
        {"key": "reading", "name": "阅读"},
        {"key": "speaking", "name": "口语"},
        {"key": "usage", "name": "语用"},
    ]

    records = db.query(CapabilityRecord).filter(
        CapabilityRecord.user_id == student_id
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


def _check_child_access(parent_id: int, student_id: int, db: Session):
    """验证家长是否有权限查看该学生的数据"""
    link = db.query(ParentStudent).filter(
        ParentStudent.parent_id == parent_id,
        ParentStudent.student_id == student_id,
    ).first()
    if not link:
        raise HTTPException(status_code=403, detail="无权查看该学生的数据")
