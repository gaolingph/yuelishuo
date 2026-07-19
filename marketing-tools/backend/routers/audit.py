"""审计日志 API — 操作留痕查看"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models import AuditLog, TeamMember
from schemas import AuditLogResponse, AuditLogListResponse
from auth import get_current_user

router = APIRouter(prefix="/api/audit-logs", tags=["操作留痕"])


@router.get("", response_model=AuditLogListResponse)
def list_audit_logs(
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
    action_type: Optional[str] = None,
    user_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """获取审计日志列表（按校区隔离）"""
    query = db.query(AuditLog)

    # 数据隔离：非 super_admin 只能看本校区的日志
    if user.role == "super_admin":
        pass
    elif user.role == "principal":
        query = query.filter(AuditLog.campus_id == user.campus_id)
    else:
        query = query.filter(AuditLog.campus_id == user.campus_id)

    if target_type:
        query = query.filter(AuditLog.target_type == target_type)
    if target_id:
        query = query.filter(AuditLog.target_id == target_id)
    if action_type:
        query = query.filter(AuditLog.action_type == action_type)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if date_from:
        from datetime import datetime
        query = query.filter(AuditLog.created_at >= datetime.strptime(date_from, "%Y-%m-%d"))
    if date_to:
        from datetime import datetime, timedelta
        query = query.filter(AuditLog.created_at <= datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1))

    total = query.count()
    items = (
        query.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return AuditLogListResponse(
        total=total,
        items=[AuditLogResponse(
            **{c.name: getattr(log, c.name) for c in log.__table__.columns}
        ) for log in items]
    )


@router.get("/target/{target_type}/{target_id}")
def get_target_audit_logs(
    target_type: str,
    target_id: int,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """获取某个对象的完整修改历史"""
    query = db.query(AuditLog).filter(
        AuditLog.target_type == target_type,
        AuditLog.target_id == target_id,
    )

    # 数据隔离
    if user.role == "super_admin":
        pass
    elif user.role == "principal":
        query = query.filter(AuditLog.campus_id == user.campus_id)
    else:
        query = query.filter(AuditLog.campus_id == user.campus_id)

    items = query.order_by(AuditLog.created_at.desc()).all()
    return {
        "total": len(items),
        "items": [AuditLogResponse(
            **{c.name: getattr(log, c.name) for c in log.__table__.columns}
        ) for log in items]
    }
