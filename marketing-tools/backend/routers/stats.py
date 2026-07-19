"""统计看板 API 路由（含校区隔离 + 成交统计）"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
import datetime

from database import get_db
from models import Lead, Interaction, School, VideoRecord, Deal, TeamMember
from schemas import StatsOverview
from auth import get_current_user

router = APIRouter(prefix="/api/stats", tags=["数据统计"])


def _get_lead_query(db, user):
    """根据角色返回带校区/学校过滤的 Lead 查询"""
    query = db.query(Lead)
    if user.role == "super_admin":
        pass
    elif user.role == "principal":
        query = query.filter(Lead.campus_id == user.campus_id)
        if user.school_id:
            query = query.filter(Lead.school_id == user.school_id)
    else:
        query = query.filter(Lead.campus_id == user.campus_id)
    return query


def _get_deal_query(db, user):
    query = db.query(Deal)
    if user.role == "super_admin":
        pass
    elif user.role == "principal":
        query = query.filter(Deal.campus_id == user.campus_id)
    else:
        query = query.filter(Deal.campus_id == user.campus_id)
    return query


@router.get("/overview", response_model=StatsOverview)
def get_overview(
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """获取总览统计数据（校区隔离）"""
    lead_base = _get_lead_query(db, user)

    total_leads = lead_base.with_entities(func.count(Lead.id)).scalar() or 0
    new_leads = lead_base.filter(Lead.status == "new").count()
    interested = (
        lead_base.filter(Lead.status.in_(["interested", "trial_set", "trial_done", "negotiating"]))
        .count()
    )
    converted = lead_base.filter(Lead.status == "converted").count()
    lost = lead_base.filter(Lead.status == "lost").count()
    conversion_rate = round(converted / total_leads * 100, 1) if total_leads > 0 else 0.0

    # 学校统计
    school_base = db.query(School)
    if user.role == "super_admin":
        pass
    elif user.role == "principal":
        school_base = school_base.filter(School.campus_id == user.campus_id)
        if user.school_id:
            school_base = school_base.filter(School.id == user.school_id)
    else:
        school_base = school_base.filter(School.campus_id == user.campus_id)
    total_schools = school_base.with_entities(func.count(School.id)).scalar() or 0

    total_videos = db.query(func.count(VideoRecord.id)).scalar() or 0

    # 成交统计
    deal_base = _get_deal_query(db, user)
    total_deals = deal_base.filter(Deal.status == "confirmed").count()
    total_revenue = deal_base.filter(Deal.status == "confirmed").with_entities(func.sum(Deal.amount)).scalar() or 0

    return StatsOverview(
        total_leads=total_leads,
        new_leads=new_leads,
        interested=interested,
        converted=converted,
        lost=lost,
        conversion_rate=conversion_rate,
        total_schools=total_schools,
        total_videos=total_videos,
        total_deals=total_deals,
        total_revenue=float(total_revenue),
    )


@router.get("/conversion-funnel")
def conversion_funnel(
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """转化漏斗数据（校区隔离）"""
    base = _get_lead_query(db, user)
    stages = [
        ("new", "新线索"),
        ("first_contact", "已联系"),
        ("interested", "有意向"),
        ("trial_set", "已安排试听"),
        ("trial_done", "已试听"),
        ("negotiating", "报价中"),
        ("converted", "已成交"),
    ]
    total = base.with_entities(func.count(Lead.id)).scalar() or 1
    result = []
    for stage_key, stage_label in stages:
        count = base.filter(Lead.status == stage_key).count()
        result.append({
            "key": stage_key,
            "label": stage_label,
            "count": count,
            "percentage": round(count / total * 100, 1),
        })
    return result


@router.get("/weekly-trend")
def weekly_trend(
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """最近30天的新增趋势（校区隔离）"""
    base = _get_lead_query(db, user)
    now = datetime.datetime.utcnow()
    since = now - datetime.timedelta(days=30)
    rows = (
        base.with_entities(func.date(Lead.created_at), func.count(Lead.id))
        .filter(Lead.created_at >= since)
        .group_by(func.date(Lead.created_at))
        .all()
    )
    return {str(row[0]): row[1] for row in rows}


@router.get("/owner-performance")
def owner_performance(
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """各负责人业绩统计（校区隔离）"""
    base = _get_lead_query(db, user)
    owners = base.with_entities(Lead.owner).distinct().all()
    result = []
    for (owner,) in owners:
        if not owner:
            continue
        total = base.filter(Lead.owner == owner).with_entities(func.count(Lead.id)).scalar() or 0
        converted = base.filter(Lead.owner == owner, Lead.status == "converted").count()
        result.append({
            "owner": owner,
            "total_leads": total,
            "converted": converted,
            "rate": round(converted / total * 100, 1) if total > 0 else 0,
        })
    return result
