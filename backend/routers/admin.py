from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional

from database import get_db
from models import User, Group, Campus, ParentStudent, LearningRecord, Checkin, WordPack, Story
from schemas import (
    UserResponse, GroupCreate, GroupResponse, CampusCreate, CampusResponse,
    AdminUserCreate, AdminUserUpdate, ParentStudentCreate, ParentStudentResponse,
    StatsOverview, ChildStatsResponse, StoryCreate, StoryUpdate, StoryAdminResponse,
)
from routers.auth import get_current_user, require_role, _hash_password

router = APIRouter(prefix="/api/admin", tags=["管理端"])

# 管理员可访问（集团管理员 + 校区管理员 + 教练查看）
admin_only = require_role(["group_admin", "campus_admin", "coach"])
# 仅集团管理员
group_admin_only = require_role(["group_admin"])
# 仅管理层（不含教练）- 用于写操作
admin_only_no_coach = require_role(["group_admin", "campus_admin"])


# ==================== 用户管理 ====================

@router.post("/users", response_model=UserResponse)
def create_user(data: AdminUserCreate, db: Session = Depends(get_db),
                admin: User = Depends(admin_only_no_coach)):
    """创建任意角色账号（仅管理员可操作）"""
    existing = db.query(User).filter(User.username == data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")

    if data.phone:
        existing_phone = db.query(User).filter(User.phone == data.phone).first()
        if existing_phone:
            raise HTTPException(status_code=400, detail="手机号已被注册")

    # 校区管理员只能创建学生和家长，不能创建管理员
    if admin.role == "campus_admin" and data.role in ("group_admin", "campus_admin"):
        raise HTTPException(status_code=403, detail="无权创建管理员账号")

    # 校区管理员只能在本校区范围内创建
    if admin.role == "campus_admin":
        data.group_id = admin.group_id
        data.campus_id = admin.campus_id

    user = User(
        username=data.username,
        password_hash=_hash_password(data.password),
        nickname=data.nickname or data.username,
        phone=data.phone,
        role=data.role,
        group_id=data.group_id,
        campus_id=data.campus_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)


@router.get("/users", response_model=List[UserResponse])
def list_users(role: Optional[str] = None, campus_id: Optional[int] = None,
               db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    """查看用户列表（按角色/校区过滤）"""
    query = db.query(User)

    # 校区管理员只能看本校区的用户
    if admin.role == "campus_admin":
        query = query.filter(User.campus_id == admin.campus_id)
    # 集团管理员可以看本集团的所有用户
    elif admin.role == "group_admin" and admin.group_id:
        # 如果指定了校区且属于本集团
        if campus_id:
            campus = db.query(Campus).filter(Campus.id == campus_id, Campus.group_id == admin.group_id).first()
            if not campus:
                raise HTTPException(status_code=404, detail="校区不存在")
            query = query.filter(User.campus_id == campus_id)
        else:
            # 查看本集团下所有校区的用户
            campus_ids = [c.id for c in db.query(Campus).filter(Campus.group_id == admin.group_id).all()]
            query = query.filter(User.campus_id.in_(campus_ids) if campus_ids else False)

    if role:
        query = query.filter(User.role == role)

    users = query.order_by(User.created_at.desc()).all()
    return [UserResponse.model_validate(u) for u in users]


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(user_id: int, data: AdminUserUpdate,
                db: Session = Depends(get_db), admin: User = Depends(admin_only_no_coach)):
    """编辑用户信息"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # 校区管理员只能修改本校区用户
    if admin.role == "campus_admin" and user.campus_id != admin.campus_id:
        raise HTTPException(status_code=403, detail="无权修改其他校区用户")

    if data.nickname is not None:
        user.nickname = data.nickname
    if data.phone is not None:
        user.phone = data.phone
    if data.role is not None:
        if admin.role == "campus_admin" and data.role in ("group_admin", "campus_admin"):
            raise HTTPException(status_code=403, detail="无权修改角色为管理员")
        user.role = data.role
    if data.group_id is not None:
        user.group_id = data.group_id
    if data.campus_id is not None:
        user.campus_id = data.campus_id
    if data.password:
        user.password_hash = _hash_password(data.password)

    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db),
                admin: User = Depends(admin_only_no_coach)):
    """删除用户（仅管理员）"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    if admin.role == "campus_admin" and user.campus_id != admin.campus_id:
        raise HTTPException(status_code=403, detail="无权删除其他校区用户")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="不能删除自己")

    db.delete(user)
    db.commit()
    return {"message": "删除成功"}


# ==================== 集团管理 ====================

@router.post("/groups", response_model=GroupResponse)
def create_group(data: GroupCreate, db: Session = Depends(get_db),
                 admin: User = Depends(group_admin_only)):
    """创建集团"""
    group = Group(name=data.name, contact_info=data.contact_info)
    db.add(group)
    db.commit()
    db.refresh(group)
    # 创建者自动关联到该集团
    admin.group_id = group.id
    db.commit()
    return GroupResponse.model_validate(group)


@router.get("/groups", response_model=List[GroupResponse])
def list_groups(db: Session = Depends(get_db), admin: User = Depends(group_admin_only)):
    """查看所有集团"""
    groups = db.query(Group).all()
    result = []
    for g in groups:
        campus_count = db.query(Campus).filter(Campus.group_id == g.id).count()
        result.append(GroupResponse(
            id=g.id, name=g.name, contact_info=g.contact_info or "",
            created_at=g.created_at, campus_count=campus_count,
        ))
    return result


@router.put("/groups/{group_id}", response_model=GroupResponse)
def update_group(group_id: int, data: GroupCreate,
                 db: Session = Depends(get_db), admin: User = Depends(group_admin_only)):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="集团不存在")
    group.name = data.name
    group.contact_info = data.contact_info
    db.commit()
    db.refresh(group)
    campus_count = db.query(Campus).filter(Campus.group_id == group.id).count()
    return GroupResponse(
        id=group.id, name=group.name, contact_info=group.contact_info or "",
        created_at=group.created_at, campus_count=campus_count,
    )


# ==================== 校区管理 ====================

@router.post("/campuses", response_model=CampusResponse)
def create_campus(data: CampusCreate, db: Session = Depends(get_db),
                  admin: User = Depends(group_admin_only)):
    """创建校区"""
    # 验证集团存在
    group = db.query(Group).filter(Group.id == data.group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="集团不存在")
    campus = Campus(
        group_id=data.group_id, name=data.name,
        address=data.address, contact_info=data.contact_info,
    )
    db.add(campus)
    db.commit()
    db.refresh(campus)
    return CampusResponse(
        id=campus.id, group_id=campus.group_id, name=campus.name,
        address=campus.address or "", contact_info=campus.contact_info or "",
        created_at=campus.created_at, student_count=0,
    )


@router.get("/campuses", response_model=List[CampusResponse])
def list_campuses(group_id: Optional[int] = None,
                  db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    """查看校区列表"""
    query = db.query(Campus)
    if admin.role == "group_admin" and admin.group_id:
        query = query.filter(Campus.group_id == admin.group_id)
    elif admin.role == "campus_admin":
        query = query.filter(Campus.id == admin.campus_id)
    if group_id:
        query = query.filter(Campus.group_id == group_id)

    campuses = query.all()
    result = []
    for c in campuses:
        student_count = db.query(User).filter(
            User.campus_id == c.id, User.role == "student"
        ).count()
        result.append(CampusResponse(
            id=c.id, group_id=c.group_id, name=c.name,
            address=c.address or "", contact_info=c.contact_info or "",
            created_at=c.created_at, student_count=student_count,
        ))
    return result


@router.put("/campuses/{campus_id}", response_model=CampusResponse)
def update_campus(campus_id: int, data: CampusCreate,
                  db: Session = Depends(get_db), admin: User = Depends(group_admin_only)):
    campus = db.query(Campus).filter(Campus.id == campus_id).first()
    if not campus:
        raise HTTPException(status_code=404, detail="校区不存在")
    campus.name = data.name
    campus.address = data.address
    campus.contact_info = data.contact_info
    db.commit()
    db.refresh(campus)
    student_count = db.query(User).filter(
        User.campus_id == campus.id, User.role == "student"
    ).count()
    return CampusResponse(
        id=campus.id, group_id=campus.group_id, name=campus.name,
        address=campus.address or "", contact_info=campus.contact_info or "",
        created_at=campus.created_at, student_count=student_count,
    )


# ==================== 家长-学生关联 ====================

@router.post("/parent-student", response_model=ParentStudentResponse)
def link_parent_student(data: ParentStudentCreate, db: Session = Depends(get_db),
                         admin: User = Depends(admin_only_no_coach)):
    """关联家长和学生"""
    parent = db.query(User).filter(User.id == data.parent_id, User.role == "parent").first()
    if not parent:
        raise HTTPException(status_code=400, detail="家长用户不存在或角色不是家长")
    student = db.query(User).filter(User.id == data.student_id, User.role == "student").first()
    if not student:
        raise HTTPException(status_code=400, detail="学生用户不存在或角色不是学生")

    existing = db.query(ParentStudent).filter(
        ParentStudent.parent_id == data.parent_id,
        ParentStudent.student_id == data.student_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="已存在关联关系")

    ps = ParentStudent(
        parent_id=data.parent_id, student_id=data.student_id,
        relationship=data.relationship,
    )
    db.add(ps)
    db.commit()
    db.refresh(ps)
    return ParentStudentResponse(
        id=ps.id, parent_id=ps.parent_id, student_id=ps.student_id,
        relationship=ps.relationship or "", created_at=ps.created_at,
        student_name=student.nickname or student.username,
        parent_name=parent.nickname or parent.username,
    )


@router.get("/parent-student", response_model=List[ParentStudentResponse])
def list_parent_student(db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    """查看所有关联关系"""
    query = db.query(ParentStudent)
    # 校区管理员只能看本校区的关联
    if admin.role == "campus_admin":
        query = query.join(
            User, User.id == ParentStudent.student_id
        ).filter(User.campus_id == admin.campus_id)

    links = query.all()
    result = []
    for ps in links:
        parent = db.query(User).filter(User.id == ps.parent_id).first()
        student = db.query(User).filter(User.id == ps.student_id).first()
        result.append(ParentStudentResponse(
            id=ps.id, parent_id=ps.parent_id, student_id=ps.student_id,
            relationship=ps.relationship or "", created_at=ps.created_at,
            student_name=student.nickname or student.username if student else "",
            parent_name=parent.nickname or parent.username if parent else "",
        ))
    return result


@router.delete("/parent-student/{link_id}")
def delete_parent_student(link_id: int, db: Session = Depends(get_db),
                           admin: User = Depends(admin_only_no_coach)):
    link = db.query(ParentStudent).filter(ParentStudent.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="关联不存在")
    db.delete(link)
    db.commit()
    return {"message": "删除成功"}


# ==================== 统计 ====================

@router.get("/stats/overview")
def admin_overview(db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    """管理端总览统计"""
    # 根据管理员角色确定数据范围
    from sqlalchemy import cast, Date

    user_query = db.query(User)
    if admin.role == "campus_admin":
        user_query = user_query.filter(User.campus_id == admin.campus_id)
    elif admin.role == "group_admin" and admin.group_id:
        campus_ids = [c.id for c in db.query(Campus).filter(Campus.group_id == admin.group_id).all()]
        user_query = user_query.filter(User.campus_id.in_(campus_ids) if campus_ids else False)
    elif admin.role == "coach":
        # 教练只能看到学生
        user_query = user_query.filter(User.role == "student")
        if admin.campus_id:
            user_query = user_query.filter(User.campus_id == admin.campus_id)
        elif admin.group_id:
            campus_ids = [c.id for c in db.query(Campus).filter(Campus.group_id == admin.group_id).all()]
            user_query = user_query.filter(User.campus_id.in_(campus_ids) if campus_ids else False)

    total_students = user_query.filter(User.role == "student").count()
    total_parents = user_query.filter(User.role == "parent").count()

    # 学习统计
    student_ids = [u.id for u in user_query.filter(User.role == "student").all()]
    if student_ids:
        total_learned = db.query(LearningRecord).filter(
            LearningRecord.user_id.in_(student_ids)
        ).count()
        total_mastered = db.query(LearningRecord).filter(
            LearningRecord.user_id.in_(student_ids),
            LearningRecord.is_mastered == True
        ).count()
        today = datetime.utcnow().date()
        today_learned = db.query(LearningRecord).filter(
            LearningRecord.user_id.in_(student_ids),
            cast(LearningRecord.created_at, Date) == today
        ).count()
        active_users = db.query(Checkin).filter(
            Checkin.user_id.in_(student_ids),
            Checkin.checkin_date == today
        ).distinct(Checkin.user_id).count()
    else:
        total_learned = total_mastered = today_learned = active_users = 0

    return {
        "total_students": total_students,
        "total_parents": total_parents,
        "total_learned": total_learned,
        "total_mastered": total_mastered,
        "today_learned": today_learned,
        "active_users_today": active_users,
    }


@router.get("/stats/students")
def admin_student_stats(campus_id: Optional[int] = None,
                        db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    """查看学生学习数据列表"""
    query = db.query(User).filter(User.role == "student")

    if admin.role == "campus_admin":
        query = query.filter(User.campus_id == admin.campus_id)
    elif admin.role == "group_admin" and admin.group_id:
        cids = [c.id for c in db.query(Campus).filter(Campus.group_id == admin.group_id).all()]
        query = query.filter(User.campus_id.in_(cids) if cids else False)
    elif admin.role == "coach":
        if admin.campus_id:
            query = query.filter(User.campus_id == admin.campus_id)
        elif admin.group_id:
            cids = [c.id for c in db.query(Campus).filter(Campus.group_id == admin.group_id).all()]
            query = query.filter(User.campus_id.in_(cids) if cids else False)
    if campus_id:
        query = query.filter(User.campus_id == campus_id)

    students = query.all()
    result = []
    for s in students:
        learned = db.query(LearningRecord).filter(LearningRecord.user_id == s.id).count()
        mastered = db.query(LearningRecord).filter(
            LearningRecord.user_id == s.id, LearningRecord.is_mastered == True
        ).count()
        to_review = db.query(LearningRecord).filter(
            LearningRecord.user_id == s.id,
            LearningRecord.next_review <= datetime.utcnow(),
            LearningRecord.is_mastered == False
        ).count()
        result.append(ChildStatsResponse(
            user_id=s.id, username=s.username, nickname=s.nickname or s.username,
            total_learned=learned, total_mastered=mastered, to_review=to_review,
        ))
    return result


@router.get("/stats/campuses")
def admin_campus_stats(db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    """各校区数据对比"""
    query = db.query(Campus)
    if admin.role == "group_admin" and admin.group_id:
        query = query.filter(Campus.group_id == admin.group_id)
    elif admin.role == "campus_admin":
        query = query.filter(Campus.id == admin.campus_id)

    campuses = query.all()
    result = []
    for c in campuses:
        student_ids = [u.id for u in db.query(User).filter(
            User.campus_id == c.id, User.role == "student"
        ).all()]
        total_learned = 0
        total_mastered = 0
        if student_ids:
            total_learned = db.query(LearningRecord).filter(
                LearningRecord.user_id.in_(student_ids)
            ).count()
            total_mastered = db.query(LearningRecord).filter(
                LearningRecord.user_id.in_(student_ids),
                LearningRecord.is_mastered == True
            ).count()
        result.append({
            "campus_id": c.id,
            "campus_name": c.name,
            "student_count": len(student_ids),
            "total_learned": total_learned,
            "total_mastered": total_mastered,
        })
    return result


# ==================== 故事管理 ====================

@router.get("/stories", response_model=List[StoryAdminResponse])
def admin_list_stories(level: str = None,
                        db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    """管理员查看故事列表（支持按级别过滤）"""
    query = db.query(Story)
    if level:
        query = query.filter(Story.level == level)
    stories = query.order_by(Story.level, Story.sort_order).all()
    return [StoryAdminResponse.model_validate(s) for s in stories]


@router.get("/stories/{story_id}", response_model=StoryAdminResponse)
def admin_get_story(story_id: int, db: Session = Depends(get_db),
                     admin: User = Depends(admin_only)):
    """管理员获取单个故事详情"""
    story = db.query(Story).filter(Story.id == story_id).first()
    if not story:
        raise HTTPException(status_code=404, detail="故事不存在")
    return StoryAdminResponse.model_validate(story)


@router.post("/stories", response_model=StoryAdminResponse)
def admin_create_story(data: StoryCreate, db: Session = Depends(get_db),
                        admin: User = Depends(admin_only_no_coach)):
    """管理员创建新故事"""
    if data.level not in ("L1", "L2", "L3"):
        raise HTTPException(status_code=400, detail="级别必须为 L1/L2/L3")
    story = Story(
        level=data.level,
        title=data.title,
        text=data.text,
        vocabulary=data.vocabulary or [],
        question=data.question,
        sort_order=data.sort_order or 0,
    )
    db.add(story)
    db.commit()
    db.refresh(story)
    return StoryAdminResponse.model_validate(story)


@router.put("/stories/{story_id}", response_model=StoryAdminResponse)
def admin_update_story(story_id: int, data: StoryUpdate,
                        db: Session = Depends(get_db), admin: User = Depends(admin_only_no_coach)):
    """管理员更新故事"""
    story = db.query(Story).filter(Story.id == story_id).first()
    if not story:
        raise HTTPException(status_code=404, detail="故事不存在")

    if data.level is not None:
        if data.level not in ("L1", "L2", "L3"):
            raise HTTPException(status_code=400, detail="级别必须为 L1/L2/L3")
        story.level = data.level
    if data.title is not None:
        story.title = data.title
    if data.text is not None:
        story.text = data.text
    if data.vocabulary is not None:
        story.vocabulary = data.vocabulary
    if data.question is not None:
        story.question = data.question
    if data.sort_order is not None:
        story.sort_order = data.sort_order

    db.commit()
    db.refresh(story)
    return StoryAdminResponse.model_validate(story)


@router.delete("/stories/{story_id}")
def admin_delete_story(story_id: int, db: Session = Depends(get_db),
                        admin: User = Depends(admin_only_no_coach)):
    """管理员删除故事"""
    story = db.query(Story).filter(Story.id == story_id).first()
    if not story:
        raise HTTPException(status_code=404, detail="故事不存在")
    db.delete(story)
    db.commit()
    return {"message": "故事已删除"}
