"""数据库配置与连接管理"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config import settings

# 判断数据库类型
if settings.DATABASE_URL.startswith("sqlite"):
    # SQLite — 使用绝对路径
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    db_path = settings.DATABASE_URL.replace("sqlite:///./", "").replace("sqlite:///", "")
    if not os.path.isabs(db_path):
        db_path = os.path.join(BASE_DIR, db_path)
    DATABASE_URL = f"sqlite:///{db_path}"
    connect_args = {"check_same_thread": False}
else:
    # PostgreSQL / MySQL
    DATABASE_URL = settings.DATABASE_URL
    connect_args = {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI 依赖注入 — 获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
