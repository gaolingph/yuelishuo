"""校区管理 API（仅 super_admin 可操作）"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models import Campus, TeamMember
from schemas import CampusCreate, CampusUpdate, CampusResponse
from auth import get_current_user, check_role

router = APIRouter(prefix="/api/campus", tags=["校区管理"])


@router.get("")
def list_campuses(
    keyword: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """获取校区列表（super_admin 看全部，campus_admin/staff 只看自己校区）"""
    query = db.query(Campus)

    if keyword:
        like = f"%{keyword}%"
        query = query.filter(Campus.name.like(like))

    # 非 super_admin 只能看自己校区
    if user.role != "super_admin":
        if user.campus_id:
            query = query.filter(Campus.id == user.campus_id)
        else:
            return {"total": 0, "items": []}

    total = query.count()
    items = (
        query.order_by(Campus.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"total": total, "items": items}


@router.get("/{campus_id}", response_model=CampusResponse)
def get_campus(
    campus_id: int,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """获取校区详情"""
    if user.role != "super_admin" and user.campus_id != campus_id:
        raise HTTPException(403, "权限不足")

    campus = db.query(Campus).filter(Campus.id == campus_id).first()
    if not campus:
        raise HTTPException(404, "校区不存在")
    return campus


@router.post("", response_model=CampusResponse)
def create_campus(
    data: CampusCreate,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """创建校区（仅 super_admin）"""
    check_role(user, ["super_admin"])

    campus = Campus(**data.model_dump())
    db.add(campus)
    db.commit()
    db.refresh(campus)
    return campus


@router.put("/{campus_id}", response_model=CampusResponse)
def update_campus(
    campus_id: int,
    data: CampusUpdate,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """更新校区信息（仅 super_admin）"""
    check_role(user, ["super_admin"])

    campus = db.query(Campus).filter(Campus.id == campus_id).first()
    if not campus:
        raise HTTPException(404, "校区不存在")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(campus, key, value)
    db.commit()
    db.refresh(campus)
    return campus


@router.delete("/{campus_id}")
def delete_campus(
    campus_id: int,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """删除校区（仅 super_admin）"""
    check_role(user, ["super_admin"])

    campus = db.query(Campus).filter(Campus.id == campus_id).first()
    if not campus:
        raise HTTPException(404, "校区不存在")
    db.delete(campus)
    db.commit()
    return {"ok": True}
