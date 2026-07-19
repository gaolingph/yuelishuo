"""佣金管理 API（规则 + 发放记录）"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
import datetime

from database import get_db
from models import CommissionRule, CommissionRecord, TeamMember, Deal, Campus
from schemas import (
    CommissionRuleCreate, CommissionRuleUpdate, CommissionRuleResponse,
    CommissionRecordResponse, CommissionRecordListResponse,
)
from auth import get_current_user, check_role

router = APIRouter(prefix="/api/commission", tags=["佣金管理"])


# ═══════════════════════════════════════
# 佣金规则
# ═══════════════════════════════════════

@router.get("/rules")
def list_rules(
    campus_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """获取佣金规则列表"""
    query = db.query(CommissionRule)

    if user.role == "super_admin":
        if campus_id:
            query = query.filter(CommissionRule.campus_id == campus_id)
    elif user.role == "principal":
        query = query.filter(CommissionRule.campus_id == user.campus_id)
    else:
        query = query.filter(CommissionRule.campus_id == user.campus_id)

    items = query.order_by(CommissionRule.created_at.desc()).all()
    result = []
    for rule in items:
        campus_name = None
        campus = db.query(Campus).filter(Campus.id == rule.campus_id).first()
        if campus:
            campus_name = campus.name
        result.append(CommissionRuleResponse(
            **{c.name: getattr(rule, c.name) for c in rule.__table__.columns},
            campus_name=campus_name,
        ))
    return {"total": len(result), "items": result}


@router.post("/rules", response_model=CommissionRuleResponse)
def create_rule(
    data: CommissionRuleCreate,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """创建佣金规则"""
    check_role(user, ["super_admin", "campus_admin"])

    if user.role == "campus_admin":
        data.campus_id = user.campus_id

    rule = CommissionRule(**data.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)

    campus = db.query(Campus).filter(Campus.id == rule.campus_id).first()
    return CommissionRuleResponse(
        **{c.name: getattr(rule, c.name) for c in rule.__table__.columns},
        campus_name=campus.name if campus else None,
    )


@router.put("/rules/{rule_id}", response_model=CommissionRuleResponse)
def update_rule(
    rule_id: int,
    data: CommissionRuleUpdate,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """更新佣金规则"""
    check_role(user, ["super_admin", "campus_admin"])

    rule = db.query(CommissionRule).filter(CommissionRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "佣金规则不存在")

    if user.role == "campus_admin" and rule.campus_id != user.campus_id:
        raise HTTPException(403, "权限不足")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(rule, key, value)
    db.commit()
    db.refresh(rule)

    campus = db.query(Campus).filter(Campus.id == rule.campus_id).first()
    return CommissionRuleResponse(
        **{c.name: getattr(rule, c.name) for c in rule.__table__.columns},
        campus_name=campus.name if campus else None,
    )


@router.delete("/rules/{rule_id}")
def delete_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """删除佣金规则"""
    check_role(user, ["super_admin", "campus_admin"])

    rule = db.query(CommissionRule).filter(CommissionRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "佣金规则不存在")

    if user.role == "campus_admin" and rule.campus_id != user.campus_id:
        raise HTTPException(403, "权限不足")

    db.delete(rule)
    db.commit()
    return {"ok": True}


# ═══════════════════════════════════════
# 佣金发放记录
# ═══════════════════════════════════════

@router.get("/records")
def list_records(
    status: Optional[str] = None,
    user_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """获取佣金发放记录"""
    query = db.query(CommissionRecord)

    if user.role == "super_admin":
        if user_id:
            query = query.filter(CommissionRecord.user_id == user_id)
    elif user.role == "principal":
        query = query.filter(CommissionRecord.campus_id == user.campus_id)
    elif user.role == "campus_admin":
        query = query.filter(CommissionRecord.campus_id == user.campus_id)
    else:
        # 员工只看自己的佣金
        query = query.filter(CommissionRecord.user_id == user.id)

    if status:
        query = query.filter(CommissionRecord.status == status)

    total = query.count()
    items = (
        query.order_by(CommissionRecord.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    result = []
    for r in items:
        member = db.query(TeamMember).filter(TeamMember.id == r.user_id).first()
        deal = db.query(Deal).filter(Deal.id == r.deal_id).first()
        deal_info = f"{deal.course_name} - ¥{deal.amount}" if deal else "-"
        result.append(CommissionRecordResponse(
            **{c.name: getattr(r, c.name) for c in r.__table__.columns},
            user_name=member.display_name if member else "未知",
            deal_info=deal_info,
        ))

    return CommissionRecordListResponse(total=total, items=result)


@router.post("/records/{record_id}/pay")
def pay_commission(
    record_id: int,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """标记佣金已发放"""
    check_role(user, ["super_admin", "campus_admin"])

    record = db.query(CommissionRecord).filter(CommissionRecord.id == record_id).first()
    if not record:
        raise HTTPException(404, "佣金记录不存在")

    if user.role == "campus_admin" and record.campus_id != user.campus_id:
        raise HTTPException(403, "权限不足")

    if record.status == "paid":
        raise HTTPException(400, "该佣金已发放")

    record.status = "paid"
    record.paid_at = datetime.datetime.utcnow()
    db.commit()
    return {"ok": True, "message": "已标记为已发放"}
