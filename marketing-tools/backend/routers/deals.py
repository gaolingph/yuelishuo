"""成交记录 API（含佣金自动计算）"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import Optional
from decimal import Decimal
import datetime

from database import get_db
from models import Deal, Lead, TeamMember, CommissionRule, CommissionRecord, Campus
from schemas import DealCreate, DealUpdate, DealResponse, DealListResponse, DealStatsResponse
from auth import get_current_user, check_role
from services.audit_logger import AuditLogger

router = APIRouter(prefix="/api/deals", tags=["成交管理"])


def _get_deal_campus_filter(db, user):
    """获取成交记录的校区/学校过滤条件"""
    if user.role == "super_admin":
        return db.query(Deal)
    elif user.role == "principal":
        q = db.query(Deal).filter(Deal.campus_id == user.campus_id)
        if user.school_id:
            q = q.join(Lead).filter(Lead.school_id == user.school_id)
        return q
    else:
        return db.query(Deal).filter(Deal.campus_id == user.campus_id)


@router.get("", response_model=DealListResponse)
def list_deals(
    status: Optional[str] = None,
    campus_id: Optional[int] = None,
    keyword: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """获取成交记录列表"""
    query = _get_deal_campus_filter(db, user)

    if status:
        query = query.filter(Deal.status == status)
    if campus_id and user.role == "super_admin":
        query = query.filter(Deal.campus_id == campus_id)
    if keyword:
        like = f"%{keyword}%"
        query = query.join(Lead).filter(
            Lead.name.like(like) | Lead.phone.like(like) | Deal.course_name.like(like)
        )
    if date_from:
        query = query.filter(Deal.deal_date >= datetime.datetime.strptime(date_from, "%Y-%m-%d"))
    if date_to:
        query = query.filter(Deal.deal_date <= datetime.datetime.strptime(date_to, "%Y-%m-%d") + datetime.timedelta(days=1))

    total = query.count()
    items = (
        query.order_by(desc(Deal.deal_date))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # 拼接待显示的线索名称和电话
    result = []
    for deal in items:
        lead = db.query(Lead).filter(Lead.id == deal.lead_id).first()
        result.append(DealResponse(
            **{c.name: getattr(deal, c.name) for c in deal.__table__.columns},
            lead_name=lead.name if lead else "未知",
            lead_phone=lead.phone if lead else "",
        ))

    return DealListResponse(total=total, items=result)


@router.post("", response_model=DealResponse)
def create_deal(
    data: DealCreate,
    request=None,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """创建成交记录（并自动计算佣金）"""
    # 权限检查：仅 super_admin 和 campus_admin 可以创建成交
    check_role(user, ["super_admin", "campus_admin"])

    # 验证线索
    lead = db.query(Lead).filter(Lead.id == data.lead_id).first()
    if not lead:
        raise HTTPException(404, "线索不存在")

    # 确定校区
    campus_id = user.campus_id
    if user.role == "super_admin" and lead.campus_id:
        campus_id = lead.campus_id
    elif not campus_id:
        campus_id = lead.campus_id

    if not campus_id:
        raise HTTPException(400, "无法确定所属校区")

    deal = Deal(
        lead_id=data.lead_id,
        campus_id=campus_id,
        course_name=data.course_name,
        amount=data.amount,
        deal_date=data.deal_date or datetime.datetime.utcnow(),
        status=data.status,
        notes=data.notes,
        created_by_id=user.id,
    )
    db.add(deal)
    db.flush()  # 获取 ID

    # 自动更新线索状态为"已成交"
    lead.status = "converted"
    lead.status_updated_at = datetime.datetime.utcnow()
    lead.updated_at = datetime.datetime.utcnow()

    # 自动计算佣金
    _auto_calculate_commission(db, deal, user, campus_id)

    # 审计日志
    ip = request.client.host if request else None
    AuditLogger.log_create(db, user, "deal", deal.id, {
        "lead_id": deal.lead_id,
        "course_name": deal.course_name,
        "amount": str(deal.amount),
        "campus_id": campus_id,
    }, ip_address=ip)

    db.commit()
    db.refresh(deal)

    # 返回
    return DealResponse(
        **{c.name: getattr(deal, c.name) for c in deal.__table__.columns},
        lead_name=lead.name,
        lead_phone=lead.phone,
    )


def _auto_calculate_commission(db: Session, deal: Deal, user: TeamMember, campus_id: int):
    """自动计算并创建佣金记录"""
    # 查找该校区适用的佣金规则
    rules = db.query(CommissionRule).filter(
        CommissionRule.campus_id == campus_id,
        CommissionRule.is_active == True,
    ).all()

    if not rules:
        return

    # 获取该校区所有相关人员
    staff_list = db.query(TeamMember).filter(
        TeamMember.campus_id == campus_id,
        TeamMember.is_active == True,
    ).all()

    for rule in rules:
        for staff in staff_list:
            if staff.role == rule.role_type:
                # 计算佣金金额
                commission_amount = Decimal('0.00')
                if rule.commission_type == "percentage":
                    commission_amount = deal.amount * rule.commission_value
                elif rule.commission_type == "fixed":
                    commission_amount = rule.commission_value

                if commission_amount > 0:
                    record = CommissionRecord(
                        deal_id=deal.id,
                        user_id=staff.id,
                        campus_id=campus_id,
                        commission_amount=commission_amount,
                        status="pending",
                    )
                    db.add(record)


@router.get("/stats", response_model=DealStatsResponse)
def deal_stats(
    campus_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """成交统计"""
    query = _get_deal_campus_filter(db, user).filter(Deal.status == "confirmed")

    if campus_id and user.role == "super_admin":
        query = query.filter(Deal.campus_id == campus_id)
    if date_from:
        query = query.filter(Deal.deal_date >= datetime.datetime.strptime(date_from, "%Y-%m-%d"))
    if date_to:
        query = query.filter(Deal.deal_date <= datetime.datetime.strptime(date_to, "%Y-%m-%d") + datetime.timedelta(days=1))

    total_deals = query.count()
    total_amount = query.with_entities(func.sum(Deal.amount)).scalar() or 0

    # 按课程统计
    by_course_rows = query.with_entities(Deal.course_name, func.count(Deal.id), func.sum(Deal.amount)).group_by(Deal.course_name).all()
    by_course = {r[0]: {"count": r[1], "amount": float(r[2])} for r in by_course_rows}

    # 按校区统计（super_admin）
    by_campus = {}
    if user.role == "super_admin":
        by_campus_rows = query.with_entities(Deal.campus_id, func.count(Deal.id), func.sum(Deal.amount)).group_by(Deal.campus_id).all()
        for r in by_campus_rows:
            campus = db.query(Campus).filter(Campus.id == r[0]).first()
            name = campus.name if campus else f"校区#{r[0]}"
            by_campus[name] = {"count": r[1], "amount": float(r[2])}

    # 月度统计
    monthly_rows = query.with_entities(
        func.strftime("%Y-%m", Deal.deal_date),
        func.count(Deal.id),
        func.sum(Deal.amount),
    ).group_by(func.strftime("%Y-%m", Deal.deal_date)).all()
    monthly = {r[0]: {"count": r[1], "amount": float(r[2])} for r in monthly_rows}

    return DealStatsResponse(
        total_deals=total_deals,
        total_amount=float(total_amount),
        by_course=by_course,
        by_campus=by_campus,
        monthly=monthly,
    )
