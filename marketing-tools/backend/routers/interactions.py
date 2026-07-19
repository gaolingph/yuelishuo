"""沟通记录 API 路由（含操作留痕）"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional
import datetime

from database import get_db
from models import Interaction, Lead, TeamMember
from schemas import InteractionCreate, InteractionResponse
from auth import get_current_user
from services.audit_logger import AuditLogger

router = APIRouter(prefix="/api/interactions", tags=["沟通记录"])


def _verify_lead_access(lead_id: int, db: Session, user: TeamMember) -> Lead:
    """验证线索存在且用户有权访问"""
    query = db.query(Lead)
    if user.role == "super_admin":
        pass
    elif user.role == "principal":
        query = query.filter(Lead.campus_id == user.campus_id)
        if user.school_id:
            query = query.filter(Lead.school_id == user.school_id)
    else:
        query = query.filter(Lead.campus_id == user.campus_id)
    lead = query.filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(404, "线索不存在或无权访问")
    return lead


@router.get("/lead/{lead_id}")
def list_interactions(
    lead_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """获取某个线索的所有沟通记录"""
    _verify_lead_access(lead_id, db, user)

    total = db.query(Interaction).filter(Interaction.lead_id == lead_id).count()
    items = (
        db.query(Interaction)
        .filter(Interaction.lead_id == lead_id)
        .order_by(desc(Interaction.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"total": total, "items": items}


@router.post("", response_model=InteractionResponse)
def create_interaction(
    data: InteractionCreate,
    request: Request = None,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """创建沟通记录"""
    lead = _verify_lead_access(data.lead_id, db, user)

    interaction = Interaction(**data.model_dump())

    if data.next_followup:
        lead.next_followup_at = data.next_followup
        lead.updated_at = datetime.datetime.utcnow()

    db.add(interaction)
    db.commit()
    db.refresh(interaction)

    # 审计日志
    ip = request.client.host if request else None
    AuditLogger.log(db, user, "create", "interaction", interaction.id,
                   field_name="content", new_value=interaction.content[:100] if interaction.content else "",
                   ip_address=ip)

    return interaction


@router.delete("/{interaction_id}")
def delete_interaction(
    interaction_id: int,
    request: Request = None,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """删除沟通记录"""
    interaction = db.query(Interaction).filter(Interaction.id == interaction_id).first()
    if not interaction:
        raise HTTPException(404, "沟通记录不存在")

    _verify_lead_access(interaction.lead_id, db, user)

    ip = request.client.host if request else None
    AuditLogger.log(db, user, "delete", "interaction", interaction.id,
                   field_name="content", old_value=interaction.content[:100] if interaction.content else "",
                   ip_address=ip)

    db.delete(interaction)
    db.commit()
    return {"ok": True}
