"""学校信息管理 API 路由（含校区隔离）"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import Optional

from database import get_db
from models import School, Lead, TeamMember
from schemas import SchoolCreate, SchoolResponse, SchoolCollectRequest
from auth import get_current_user

router = APIRouter(prefix="/api/schools", tags=["学校管理"])


def _get_filtered_query(db: Session, user: TeamMember):
    query = db.query(School)
    if user.role == "super_admin":
        pass
    elif user.role == "principal":
        query = query.filter(School.campus_id == user.campus_id)
        if user.school_id:
            query = query.filter(School.id == user.school_id)
    else:
        query = query.filter(School.campus_id == user.campus_id)
    return query


@router.get("")
def list_schools(
    city: Optional[str] = None,
    district: Optional[str] = None,
    school_type: Optional[str] = None,
    keyword: Optional[str] = None,
    campus_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """获取学校列表（校区隔离）"""
    query = _get_filtered_query(db, user)

    if user.role == "super_admin" and campus_id:
        query = query.filter(School.campus_id == campus_id)
    if city:
        query = query.filter(School.city == city)
    if district:
        query = query.filter(School.district == district)
    if school_type:
        query = query.filter(School.school_type == school_type)
    if keyword:
        like = f"%{keyword}%"
        query = query.filter(School.name.like(like))

    total = query.count()
    items = (
        query.order_by(School.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return {"total": total, "items": items}


@router.get("/{school_id}", response_model=SchoolResponse)
def get_school(
    school_id: int,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """获取学校详情"""
    school = _get_filtered_query(db, user).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(404, "学校不存在")
    return school


@router.post("", response_model=SchoolResponse)
def create_school(
    data: SchoolCreate,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """创建学校记录"""
    existing = db.query(School).filter(
        School.name == data.name,
        School.city == data.city
    ).first()
    if existing:
        raise HTTPException(400, "该学校已存在")

    school = School(**data.model_dump())
    if user.role != "super_admin":
        school.campus_id = user.campus_id

    db.add(school)
    db.commit()
    db.refresh(school)
    return school


@router.delete("/{school_id}")
def delete_school(
    school_id: int,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """删除学校"""
    school = _get_filtered_query(db, user).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(404, "学校不存在")
    db.delete(school)
    db.commit()
    return {"ok": True}


@router.post("/collect")
def collect_schools(
    request_data: SchoolCollectRequest,
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """采集指定区域的学校信息"""
    from services.school_collector import collect_schools as do_collect

    schools_data = do_collect(
        city=request_data.city,
        district=request_data.district,
        school_type=request_data.school_type,
    )

    count = 0
    for s in schools_data:
        existing = db.query(School).filter(
            School.name == s["name"],
            School.city == s["city"],
        ).first()
        if existing:
            continue
        school = School(**s)
        if user.role != "super_admin":
            school.campus_id = user.campus_id
        db.add(school)
        count += 1

    db.commit()
    return {"ok": True, "count": count, "total_found": len(schools_data)}


@router.get("/stats/summary")
def school_stats(
    db: Session = Depends(get_db),
    user: TeamMember = Depends(get_current_user),
):
    """学校统计（校区隔离）"""
    base = _get_filtered_query(db, user)
    total = base.with_entities(func.count(School.id)).scalar() or 0
    by_type = (
        base.with_entities(School.school_type, func.count(School.id))
        .group_by(School.school_type)
        .all()
    )
    by_city = (
        base.with_entities(School.city, func.count(School.id))
        .group_by(School.city)
        .all()
    )
    return {
        "total": total,
        "by_type": {row[0] or "unknown": row[1] for row in by_type},
        "by_city": {row[0] or "unknown": row[1] for row in by_city},
    }
