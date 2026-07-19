"""员工管理 API（super_admin / campus_admin）"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models import TeamMember, Campus
from schemas import StaffCreate, StaffUpdate, StaffResponse
from auth import get_current_user, check_role

router = APIRouter(prefix="/api/staff", tags=["员工管理"])


@router.get("")
def list_staff(
    role: Optional[str] = None,
    campus_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """获取员工列表"""
    query = db.query(TeamMember)

    # 权限控制
    if user.role == "super_admin":
        if campus_id:
            query = query.filter(TeamMember.campus_id == campus_id)
    elif user.role == "principal":
        # 校长只能看本校区的本校员工
        query = query.filter(TeamMember.campus_id == user.campus_id)
        if user.school_id:
            query = query.filter(TeamMember.school_id == user.school_id)
    elif user.role == "campus_admin":
        # 校区管理员只能看本校区员工
        query = query.filter(TeamMember.campus_id == user.campus_id)
    else:
        # 普通员工只能看自己
        query = query.filter(TeamMember.id == user.id)

    if role:
        query = query.filter(TeamMember.role == role)

    total = query.count()
    items = (
        query.order_by(TeamMember.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"total": total, "items": items}


@router.post("", response_model=StaffResponse)
def create_staff(
    data: StaffCreate,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """创建员工（super_admin / campus_admin）"""
    check_role(user, ["super_admin", "campus_admin"])

    # 校区管理员只能在自己校区创建员工
    if user.role == "campus_admin":
        data.campus_id = user.campus_id

    # 检查手机号唯一
    existing = db.query(TeamMember).filter(TeamMember.phone == data.phone).first()
    if existing:
        raise HTTPException(400, "该手机号已注册")

    # 检查校区存在
    if data.campus_id:
        campus = db.query(Campus).filter(Campus.id == data.campus_id).first()
        if not campus:
            raise HTTPException(404, "校区不存在")

    member = TeamMember(**data.model_dump())
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


@router.put("/{staff_id}", response_model=StaffResponse)
def update_staff(
    staff_id: int,
    data: StaffUpdate,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """更新员工信息"""
    check_role(user, ["super_admin", "campus_admin"])

    member = db.query(TeamMember).filter(TeamMember.id == staff_id).first()
    if not member:
        raise HTTPException(404, "员工不存在")

    # 校区管理员只能更新本校区的员工
    if user.role == "campus_admin" and member.campus_id != user.campus_id:
        raise HTTPException(403, "权限不足")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(member, key, value)
    db.commit()
    db.refresh(member)
    return member


@router.delete("/{staff_id}")
def delete_staff(
    staff_id: int,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """删除员工"""
    check_role(user, ["super_admin", "campus_admin"])

    member = db.query(TeamMember).filter(TeamMember.id == staff_id).first()
    if not member:
        raise HTTPException(404, "员工不存在")

    if user.role == "campus_admin" and member.campus_id != user.campus_id:
        raise HTTPException(403, "权限不足")

    # 不允许删除自己
    if member.id == user.id:
        raise HTTPException(400, "不能删除自己")

    db.delete(member)
    db.commit()
    return {"ok": True}
