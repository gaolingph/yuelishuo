"""数据库初始化脚本 — 创建表结构 + 默认数据（支持 SQLite / PostgreSQL）"""
import sys
import os

# 确保 backend 目录在路径中
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

from database import engine, Base
from models import Campus, TeamMember, Deal, AuditLog, CommissionRule, CommissionRecord
from sqlalchemy.orm import Session
from sqlalchemy import text
from config import settings
import datetime


def init_database():
    """初始化数据库：创建表 + 插入默认数据"""

    is_sqlite = settings.DATABASE_URL.startswith("sqlite")

    # ===== 1. 创建所有表（PostgreSQL 先删再建） =====
    if is_sqlite:
        # SQLite：删除旧文件，干净重建
        db_path = os.path.join(script_dir, "marketing_tools.db")
        if os.path.exists(db_path):
            os.remove(db_path)
            print("  ✓ 已删除旧 SQLite 数据库文件")
        Base.metadata.create_all(bind=engine)
        print("  ✓ 所有数据表创建完成")
    else:
        # PostgreSQL：DROP 所有表后重建（生产环境请使用 Alembic 迁移）
        print("  → PostgreSQL 模式：删除旧表并重建...")
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        print("  ✓ 所有数据表重建完成")

    # ===== 2. 插入默认数据 =====
    session = Session(bind=engine)

    try:
        # --- 2a. 默认校区 ---
        hq = Campus(
            name="总部",
            code="HQ",
            address="默认地址",
            phone="010-88888888",
            contact_person="系统管理员",
            is_active=True
        )
        session.add(hq)
        session.flush()
        print(f"  ✓ 创建默认校区: 总部 (ID={hq.id})")

        # --- 2b. 默认超级管理员 ---
        admin = TeamMember(
            username="admin",
            display_name="超级管理员",
            phone="13800000000",
            role="super_admin",
            campus_id=hq.id,
            is_active=True,
            sms_code="888888",
            sms_code_expires=datetime.datetime.utcnow() + datetime.timedelta(days=365)
        )
        session.add(admin)
        session.flush()
        print(f"  ✓ 创建超级管理员: phone=13800000000, code=888888 (ID={admin.id})")

        # --- 2c. 测试校区 ---
        campus_b = Campus(
            name="朝阳校区",
            code="CY",
            address="北京市朝阳区",
            phone="010-66666666",
            contact_person="张校长",
            is_active=True
        )
        session.add(campus_b)
        session.flush()
        print(f"  ✓ 创建测试校区: 朝阳校区 (ID={campus_b.id})")

        # --- 2d. 测试校区管理员 ---
        campus_admin = TeamMember(
            display_name="朝阳管理员",
            phone="13900000001",
            role="campus_admin",
            campus_id=campus_b.id,
            is_active=True,
            sms_code="888888",
            sms_code_expires=datetime.datetime.utcnow() + datetime.timedelta(days=365)
        )
        session.add(campus_admin)
        session.flush()
        print(f"  ✓ 创建校区管理员: phone=13900000001, code=888888 (ID={campus_admin.id})")

        # --- 2e. 测试员工 ---
        staff1 = TeamMember(
            display_name="朝阳员工-张三",
            phone="13900000002",
            role="staff",
            campus_id=campus_b.id,
            is_active=True,
            sms_code="888888",
            sms_code_expires=datetime.datetime.utcnow() + datetime.timedelta(days=365)
        )
        session.add(staff1)
        session.flush()
        print(f"  ✓ 创建测试员工: phone=13900000002, code=888888 (ID={staff1.id})")

        # --- 2f. 默认佣金规则 ---
        rules = [
            CommissionRule(
                campus_id=campus_b.id, name="校区管理员成交提成",
                role_type="campus_admin", commission_type="percentage",
                commission_value=0.03, is_active=True
            ),
            CommissionRule(
                campus_id=campus_b.id, name="员工成交提成",
                role_type="staff", commission_type="percentage",
                commission_value=0.05, is_active=True
            ),
            CommissionRule(
                campus_id=hq.id, name="总部默认提成",
                role_type="staff", commission_type="percentage",
                commission_value=0.02, is_active=True
            ),
        ]
        for r in rules:
            session.add(r)
        session.flush()
        print(f"  ✓ 创建 {len(rules)} 条默认佣金规则")

        session.commit()
        print("  ✓ 默认数据全部写入成功")
        print()
        print("=" * 50)
        print("初始化完成！默认登录账号：")
        print("  超级管理员: 13800000000 / 888888")
        print("  校区管理员: 13900000001 / 888888")
        print("  测试员工:   13900000002 / 888888")
        print("=" * 50)

    except Exception as e:
        session.rollback()
        print(f"  ✗ 数据初始化失败: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    init_database()
