"""手机验证码登录 API"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import datetime

from database import get_db
from models import TeamMember
from schemas import SendCodeRequest, LoginRequest, LoginResponse, CurrentUser
from auth import create_access_token, get_current_user
from services.sms import send_sms_code, verify_sms_code

router = APIRouter(prefix="/api/auth", tags=["认证管理"])


@router.post("/send-code")
def send_code(data: SendCodeRequest, db: Session = Depends(get_db)):
    """发送短信验证码（模拟）"""
    phone = data.phone.strip()

    # 验证手机号是否存在系统中
    user = db.query(TeamMember).filter(TeamMember.phone == phone).first()
    if not user:
        raise HTTPException(404, "该手机号未注册，请联系管理员")

    if not user.is_active:
        raise HTTPException(400, "该账号已被禁用")

    import asyncio
    code = asyncio.run(send_sms_code(phone))

    # 保存到数据库
    user.sms_code = code
    user.sms_code_expires = datetime.datetime.utcnow() + datetime.timedelta(seconds=300)
    db.commit()

    return {
        "ok": True,
        "message": "验证码已发送",
        # 开发阶段返回验证码方便调试，生产环境应移除
        "debug_code": code,
    }


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    """手机号 + 验证码登录"""
    phone = data.phone.strip()
    code = data.code.strip()

    user = db.query(TeamMember).filter(TeamMember.phone == phone).first()
    if not user:
        raise HTTPException(404, "该手机号未注册")

    if not user.is_active:
        raise HTTPException(400, "该账号已被禁用")

    # 验证验证码（优先检查数据库存储的验证码，再检查内存中的短信验证码）
    code_valid = False

    # 1. 检查数据库中的验证码（预设码 / 未过期的已发送码）
    if user.sms_code and user.sms_code == code:
        if user.sms_code_expires and datetime.datetime.utcnow() <= user.sms_code_expires:
            code_valid = True

    # 2. 检查内存中的短信验证码（通过 send-code 发送的）
    if not code_valid:
        code_valid = verify_sms_code(phone, code)

    if not code_valid:
        raise HTTPException(400, "验证码错误或已过期")

    # 生成 JWT Token
    token = create_access_token({
        "user_id": user.id,
        "phone": user.phone,
        "role": user.role,
        "campus_id": user.campus_id,
        "school_id": user.school_id,
    })

    # 查询校区信息
    campus_info = None
    if user.campus_id:
        from models import Campus
        campus = db.query(Campus).filter(Campus.id == user.campus_id).first()
        if campus:
            from schemas import CampusResponse
            campus_info = CampusResponse(
                id=campus.id,
                name=campus.name,
                code=campus.code,
                address=campus.address,
                phone=campus.phone,
                contact_person=campus.contact_person,
                is_active=campus.is_active,
                created_at=campus.created_at,
            )

    return LoginResponse(
        token=token,
        user=user,
        campus=campus_info,
    )


@router.get("/me", response_model=LoginResponse)
def get_me(user: TeamMember = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取当前登录用户信息"""
    campus_info = None
    if user.campus_id:
        from models import Campus
        from schemas import CampusResponse
        campus = db.query(Campus).filter(Campus.id == user.campus_id).first()
        if campus:
            campus_info = CampusResponse(
                id=campus.id,
                name=campus.name,
                code=campus.code,
                address=campus.address,
                phone=campus.phone,
                contact_person=campus.contact_person,
                is_active=campus.is_active,
                created_at=campus.created_at,
            )

    # 重新生成token以刷新过期时间
    token = create_access_token({
        "user_id": user.id,
        "phone": user.phone,
        "role": user.role,
        "campus_id": user.campus_id,
        "school_id": user.school_id,
    })

    return LoginResponse(
        token=token,
        user=user,
        campus=campus_info,
    )
