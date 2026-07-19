"""教师端课堂管理系统 — 班级花名册、学生学习报告、课堂统计、异常预警.

教师(教练)可以查看自己校区下的学生学习情况、
课堂表现数据, 以及识别需要额外关注的学生.
"""

from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, cast, Date
from sqlalchemy.orm import Session

from database import get_db
from models import User, Campus, LearningRecord, WrongRecord, Checkin, MemoryScan, CapabilityRecord
from schemas import ChildStatsResponse
from routers.auth import get_current_user, require_role

router = APIRouter(prefix="/api/teacher", tags=["教师端"])

coach_only = require_role(["coach", "campus_admin", "group_admin"])


def _get_visible_student_ids(db: Session, teacher: User) -> list[int]:
    """Get student IDs that this teacher can see based on their role/campus."""
    query = db.query(User).filter(User.role == "student")

    if teacher.role == "coach":
        if teacher.campus_id:
            query = query.filter(User.campus_id == teacher.campus_id)
        elif teacher.group_id:
            cids = [c.id for c in db.query(Campus).filter(
                Campus.group_id == teacher.group_id
            ).all()]
            if cids:
                query = query.filter(User.campus_id.in_(cids))
            else:
                return []
    elif teacher.role == "campus_admin":
        query = query.filter(User.campus_id == teacher.campus_id)
    elif teacher.role == "group_admin" and teacher.group_id:
        cids = [c.id for c in db.query(Campus).filter(
            Campus.group_id == teacher.group_id
        ).all()]
        if cids:
            query = query.filter(User.campus_id.in_(cids))
        else:
            return []

    return [u.id for u in query.all()]


# ── Helper to build per-student stats ──────────────────────────────

def _build_student_stats(db: Session, student_id: int) -> dict:
    """Build comprehensive stats for a single student."""
    total_learned = db.query(LearningRecord).filter(
        LearningRecord.user_id == student_id
    ).count()

    mastered = db.query(LearningRecord).filter(
        LearningRecord.user_id == student_id,
        LearningRecord.is_mastered == True
    ).count()

    to_review = db.query(LearningRecord).filter(
        LearningRecord.user_id == student_id,
        LearningRecord.next_review <= datetime.utcnow(),
        LearningRecord.is_mastered == False
    ).count()

    today = datetime.utcnow().date()
    today_learned = db.query(LearningRecord).filter(
        LearningRecord.user_id == student_id,
        cast(LearningRecord.created_at, Date) == today
    ).count()

    today_review = 0  # Calculated from review-scheduled items

    # Wrong book count
    wrong_count = db.query(WrongRecord).filter(
        WrongRecord.user_id == student_id
    ).count()

    # Streak
    streak = _calc_streak(db, student_id)

    # 7-day new words
    week_ago = datetime.utcnow() - timedelta(days=7)
    week_new = db.query(LearningRecord).filter(
        LearningRecord.user_id == student_id,
        LearningRecord.created_at >= week_ago
    ).count()

    # Memory scan summary (most recent)
    latest_scan = db.query(MemoryScan).filter(
        MemoryScan.user_id == student_id
    ).order_by(MemoryScan.created_at.desc()).first()

    scan_info = None
    if latest_scan:
        scan_info = {
            "total_words": latest_scan.total_words,
            "green_count": len(latest_scan.zone_green) if latest_scan.zone_green else 0,
            "yellow_count": len(latest_scan.zone_yellow) if latest_scan.zone_yellow else 0,
            "red_count": len(latest_scan.zone_red) if latest_scan.zone_red else 0,
        }

    return {
        "total_learned": total_learned,
        "mastered": mastered,
        "to_review": to_review,
        "today_learned": today_learned,
        "today_review": today_review,
        "wrong_count": wrong_count,
        "streak_days": streak,
        "week_new_words": week_new,
        "memory_scan": scan_info,
    }


def _calc_streak(db: Session, user_id: int) -> int:
    """Calculate consecutive check-in streak."""
    records = db.query(Checkin).filter(
        Checkin.user_id == user_id
    ).order_by(Checkin.checkin_date.desc()).all()

    if not records:
        return 0

    streak = 0
    check_date = datetime.utcnow().date()

    for r in records:
        if r.checkin_date == check_date:
            streak += 1
            check_date -= timedelta(days=1)
        elif r.checkin_date == check_date - timedelta(days=1):
            # Allow yesterday as start
            streak += 1
            check_date = r.checkin_date - timedelta(days=1)
        else:
            break
    return streak


# ── Endpoints ──────────────────────────────────────────────────────

@router.get("/students")
def list_class_students(
    db: Session = Depends(get_db),
    teacher: User = Depends(coach_only),
):
    """获取班级学生列表及学习概况 (一次API返回所有学生数据)."""
    student_ids = _get_visible_student_ids(db, teacher)
    students = db.query(User).filter(User.id.in_(student_ids)).order_by(User.nickname).all()

    result = []
    for stu in students:
        stats = _build_student_stats(db, stu.id)
        result.append({
            "user_id": stu.id,
            "username": stu.username,
            "nickname": stu.nickname or stu.username,
            "campus_id": stu.campus_id,
            "created_at": stu.created_at.isoformat() if stu.created_at else None,
            **stats,
        })
    return result


@router.get("/students/alerts")
def get_student_alerts(
    min_wrongs: int = Query(10, description="最低错题数触发预警"),
    db: Session = Depends(get_db),
    teacher: User = Depends(coach_only),
):
    """获取需要重点关注的学生列表 (异常预警).

    预警规则:
    - 错题数 >= min_wrongs (默认10)
    - 连续3天未学习 (inactive)
    - 生词扫描红区占比 >= 80%
    """
    student_ids = _get_visible_student_ids(db, teacher)
    alerts = []

    three_days_ago = datetime.utcnow() - timedelta(days=3)
    today = datetime.utcnow().date()

    for sid in student_ids:
        stu = db.query(User).filter(User.id == sid).first()
        if not stu:
            continue

        student_alerts = []
        priority = "low"

        # 1. High wrong count
        wc = db.query(WrongRecord).filter(WrongRecord.user_id == sid).count()
        if wc >= min_wrongs:
            student_alerts.append({"type": "high_wrongs", "detail": f"错题数 {wc} 条", "value": wc})
            priority = "high" if wc >= 20 else "medium"

        # 2. Inactive (3+ days)
        last = db.query(LearningRecord).filter(
            LearningRecord.user_id == sid
        ).order_by(LearningRecord.created_at.desc()).first()
        if last is None or last.created_at < three_days_ago:
            days_since = (datetime.utcnow() - (last.created_at if last else stu.created_at)).days
            student_alerts.append({"type": "inactive", "detail": f"{days_since}天未学习", "value": days_since})
            priority = "high" if days_since >= 7 else "medium"

        # 3. Memory scan red zone >= 80%
        latest_scan = db.query(MemoryScan).filter(
            MemoryScan.user_id == sid
        ).order_by(MemoryScan.created_at.desc()).first()
        if latest_scan and latest_scan.total_words > 0:
            red_pct = (len(latest_scan.zone_red) / latest_scan.total_words) * 100
            if red_pct >= 80:
                student_alerts.append({
                    "type": "high_red_zone",
                    "detail": f"红区占比 {red_pct:.0f}%",
                    "value": round(red_pct, 1),
                })
                priority = "high"

        if student_alerts:
            alerts.append({
                "user_id": stu.id,
                "nickname": stu.nickname or stu.username,
                "alerts": student_alerts,
                "priority": priority,
            })

    # Sort: high priority first
    priority_order = {"high": 0, "medium": 1, "low": 2}
    alerts.sort(key=lambda a: priority_order.get(a["priority"], 3))

    return alerts


@router.get("/students/{student_id}")
def get_student_detail(
    student_id: int,
    db: Session = Depends(get_db),
    teacher: User = Depends(coach_only),
):
    """获取单个学生的详细学习报告."""
    student = db.query(User).filter(
        User.id == student_id, User.role == "student"
    ).first()
    if not student:
        raise HTTPException(status_code=404, detail="学生不存在")

    # Verify teacher can see this student
    visible_ids = _get_visible_student_ids(db, teacher)
    if student_id not in visible_ids:
        raise HTTPException(status_code=403, detail="无权查看该学生")

    stats = _build_student_stats(db, student_id)

    # Weekly learning curve (last 7 days)
    week_data = []
    for i in range(6, -1, -1):
        day = datetime.utcnow().date() - timedelta(days=i)
        count = db.query(LearningRecord).filter(
            LearningRecord.user_id == student_id,
            cast(LearningRecord.created_at, Date) == day
        ).count()
        week_data.append({"date": day.isoformat(), "count": count})

    # Capability dimensions
    capabilities = db.query(CapabilityRecord).filter(
        CapabilityRecord.user_id == student_id
    ).all()

    cap_map = {}
    for cap in capabilities:
        cap_map[cap.dimension] = {
            "score": cap.score,
            "total_attempts": cap.total_attempts,
            "correct_attempts": cap.correct_attempts,
        }

    return {
        "user_id": student.id,
        "username": student.username,
        "nickname": student.nickname or student.username,
        "campus_id": student.campus_id,
        "created_at": student.created_at.isoformat() if student.created_at else None,
        **stats,
        "weekly_curve": week_data,
        "capabilities": cap_map,
    }


@router.get("/class-overview")
def get_class_overview(
    db: Session = Depends(get_db),
    teacher: User = Depends(coach_only),
):
    """获取班级整体统计概览."""
    student_ids = _get_visible_student_ids(db, teacher)
    total = len(student_ids)
    if total == 0:
        return {
            "total_students": 0,
            "total_learned": 0,
            "total_mastered": 0,
            "avg_accuracy": 0,
            "active_today": 0,
            "struggling_count": 0,
            "class_rank": None,
        }

    # Total learned across class
    total_learned = db.query(LearningRecord).filter(
        LearningRecord.user_id.in_(student_ids)
    ).count()

    total_mastered = db.query(LearningRecord).filter(
        LearningRecord.user_id.in_(student_ids),
        LearningRecord.is_mastered == True
    ).count()

    today = datetime.utcnow().date()
    active_today = db.query(Checkin).filter(
        Checkin.user_id.in_(student_ids),
        Checkin.checkin_date == today
    ).distinct(Checkin.user_id).count()

    # Students with high wrong count (struggling)
    struggling_ids = set()
    for sid in student_ids:
        wc = db.query(WrongRecord).filter(WrongRecord.user_id == sid).count()
        if wc >= 10:
            struggling_ids.add(sid)

    return {
        "total_students": total,
        "total_learned": total_learned,
        "total_mastered": total_mastered,
        "avg_accuracy": round((total_mastered / total_learned * 100) if total_learned > 0 else 0, 1),
        "active_today": active_today,
        "struggling_count": len(struggling_ids),
        "class_rank": None,  # TODO: rank vs other classes
    }


@router.get("/class-today")
def get_class_today(
    db: Session = Depends(get_db),
    teacher: User = Depends(coach_only),
):
    """获取今日课堂动态."""
    student_ids = _get_visible_student_ids(db, teacher)
    today = datetime.utcnow().date()

    # Students who studied today
    active_ids = set()
    for sid in student_ids:
        c = db.query(LearningRecord).filter(
            LearningRecord.user_id == sid,
            cast(LearningRecord.created_at, Date) == today
        ).first()
        if c:
            active_ids.add(sid)

    active_students = []
    for sid in active_ids:
        stu = db.query(User).filter(User.id == sid).first()
        if stu:
            day_count = db.query(LearningRecord).filter(
                LearningRecord.user_id == sid,
                cast(LearningRecord.created_at, Date) == today
            ).count()
            active_students.append({
                "user_id": stu.id,
                "nickname": stu.nickname or stu.username,
                "today_count": day_count,
            })

    # Students not studied recently (3+ days no activity)
    three_days_ago = datetime.utcnow() - timedelta(days=3)
    inactive_ids = []
    for sid in student_ids:
        last = db.query(LearningRecord).filter(
            LearningRecord.user_id == sid
        ).order_by(LearningRecord.created_at.desc()).first()
        if last is None or last.created_at < three_days_ago:
            inactive_ids.append(sid)

    inactive_students = []
    for sid in inactive_ids:
        stu = db.query(User).filter(User.id == sid).first()
        if stu:
            last_record = db.query(LearningRecord).filter(
                LearningRecord.user_id == sid
            ).order_by(LearningRecord.created_at.desc()).first()
            inactive_students.append({
                "user_id": stu.id,
                "nickname": stu.nickname or stu.username,
                "last_active": last_record.created_at.isoformat() if last_record else None,
            })

    return {
        "active_count": len(active_ids),
        "inactive_count": len(inactive_ids),
        "total_students": len(student_ids),
        "active_students": sorted(active_students, key=lambda x: x["today_count"], reverse=True)[:20],
        "inactive_students": inactive_students[:20],
    }
