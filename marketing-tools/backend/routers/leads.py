"""线索管理 API 路由（含校区隔离 + 操作留痕）"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import Optional, List
import datetime

from database import get_db
from models import Lead, Interaction, TeamMember
from schemas import (
    LeadCreate, LeadUpdate, LeadResponse, LeadListResponse
)
from auth import get_current_user
from services.audit_logger import AuditLogger

router = APIRouter(prefix="/api/leads", tags=["线索管理"])


def _get_filtered_query(db: Session, user: TeamMember):
    """根据用户角色返回带校区/学校过滤的查询"""
    query = db.query(Lead)
    if user.role == "super_admin":
        pass  # 看全部
    elif user.role == "principal":
        # 校长 — 看本校
        query = query.filter(Lead.campus_id == user.campus_id)
        if user.school_id:
            query = query.filter(Lead.school_id == user.school_id)
    else:
        # campus_admin / staff — 看本校区
        query = query.filter(Lead.campus_id == user.campus_id)
    return query


@router.get("", response_model=LeadListResponse)
def list_leads(
    status: Optional[str] = None,
    source: Optional[str] = None,
    owner: Optional[str] = None,
    keyword: Optional[str] = None,
    subject: Optional[str] = None,
    campus_id: Optional[int] = None,
    school_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """获取线索列表（校区隔离）"""
    query = _get_filtered_query(db, user)

    if user.role == "super_admin" and campus_id:
        query = query.filter(Lead.campus_id == campus_id)

    if school_id:
        query = query.filter(Lead.school_id == school_id)
    if status:
        query = query.filter(Lead.status == status)
    if source:
        query = query.filter(Lead.source == source)
    if owner:
        query = query.filter(Lead.owner == owner)
    if keyword:
        like = f"%{keyword}%"
        query = query.filter(
            Lead.name.like(like) | Lead.phone.like(like) | Lead.school_name.like(like)
        )
    if subject:
        query = query.filter(Lead.subjects.contains(subject))

    total = query.count()
    items = (
        query.order_by(desc(Lead.updated_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    result = []
    for lead in items:
        interaction_count = db.query(func.count(Interaction.id)).filter(
            Interaction.lead_id == lead.id
        ).scalar() or 0
        resp = LeadResponse(
            **{c.name: getattr(lead, c.name) for c in lead.__table__.columns},
            interaction_count=interaction_count,
        )
        result.append(resp)

    return LeadListResponse(total=total, items=result)


@router.get("/{lead_id}", response_model=LeadResponse)
def get_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """获取单个线索详情"""
    lead = _get_filtered_query(db, user).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(404, "线索不存在")
    interaction_count = db.query(func.count(Interaction.id)).filter(
        Interaction.lead_id == lead.id
    ).scalar() or 0
    resp = LeadResponse(
        **{c.name: getattr(lead, c.name) for c in lead.__table__.columns},
        interaction_count=interaction_count,
    )
    return resp


@router.post("", response_model=LeadResponse)
def create_lead(
    data: LeadCreate,
    request: Request = None,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """创建新线索（自动归属校区和创建人）"""
    lead = Lead(**data.model_dump(exclude_unset=True))

    # 自动设置校区、学校和创建人
    if user.role == "super_admin":
        pass
    else:
        lead.campus_id = user.campus_id
        if user.role == "principal" and user.school_id:
            lead.school_id = user.school_id
    lead.created_by_id = user.id

    db.add(lead)
    db.commit()
    db.refresh(lead)

    # 审计日志
    ip = request.client.host if request else None
    AuditLogger.log_create(db, user, "lead", lead.id, {
        "name": lead.name,
        "phone": lead.phone,
        "source": lead.source,
        "campus_id": lead.campus_id,
    }, ip_address=ip)

    return get_lead(lead.id, db, user=user)


@router.put("/{lead_id}", response_model=LeadResponse)
def update_lead(
    lead_id: int,
    data: LeadUpdate,
    request: Request = None,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """更新线索信息（记录字段级修改历史）"""
    lead = _get_filtered_query(db, user).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(404, "线索不存在")

    old_values = {c.name: getattr(lead, c.name) for c in lead.__table__.columns}

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(lead, key, value)
    lead.updated_at = datetime.datetime.utcnow()
    if "status" in update_data:
        lead.status_updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(lead)

    # 审计日志（字段级差异）
    ip = request.client.host if request else None
    AuditLogger.log_update(db, user, "lead", lead.id, old_values, update_data,
                         ip_address=ip, sensitive_fields=["phone"])

    return get_lead(lead.id, db, user=user)


@router.delete("/{lead_id}")
def delete_lead(
    lead_id: int,
    request: Request = None,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """删除线索"""
    lead = _get_filtered_query(db, user).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(404, "线索不存在")

    ip = request.client.host if request else None
    AuditLogger.log_delete(db, user, "lead", lead.id, {
        "name": lead.name,
        "phone": lead.phone,
    }, ip_address=ip)

    db.delete(lead)
    db.commit()
    return {"ok": True}


@router.post("/batch-import")
def batch_import_leads(db: Session = Depends(get_db)):
    return {"ok": True, "message": "请使用 POST JSON 数组到 /api/leads/batch-import-exec"}


@router.post("/batch-import-exec")
def batch_import_exec(
    data: List[LeadCreate],
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """执行批量导入"""
    count = 0
    for item in data:
        lead = Lead(**item.model_dump(exclude_unset=True))
        if user.role == "super_admin":
            pass
        else:
            lead.campus_id = user.campus_id
            if user.role == "principal" and user.school_id:
                lead.school_id = user.school_id
        lead.created_by_id = user.id
        db.add(lead)
        count += 1
    db.commit()
    return {"ok": True, "imported": count}


@router.get("/stats/pipeline")
def pipeline_stats(
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """获取管道各阶段数量（校区隔离）"""
    base = _get_filtered_query(db, user)
    stages = [
        "new", "first_contact", "interested", "trial_set",
        "trial_done", "negotiating", "converted", "lost", "not_contacted"
    ]
    result = {}
    for stage in stages:
        result[stage] = base.filter(Lead.status == stage).count()
    return result


@router.get("/stats/daily-new")
def daily_new_leads(
    days: int = 7,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """每日新增线索数（校区隔离）"""
    base = _get_filtered_query(db, user)
    since = datetime.datetime.utcnow() - datetime.timedelta(days=days)
    rows = (
        base.with_entities(func.date(Lead.created_at), func.count(Lead.id))
        .filter(Lead.created_at >= since)
        .group_by(func.date(Lead.created_at))
        .all()
    )
    return {str(row[0]): row[1] for row in rows}


@router.get("/stats/by-source")
def leads_by_source(
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """按来源统计线索（校区隔离）"""
    base = _get_filtered_query(db, user)
    rows = (
        base.with_entities(Lead.source, func.count(Lead.id))
        .group_by(Lead.source)
        .all()
    )
    return {row[0] or "unknown": row[1] for row in rows}
