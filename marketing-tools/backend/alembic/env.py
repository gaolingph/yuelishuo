"""Alembic 迁移环境配置 — 自包含版本"""
import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import create_engine

# ── 确保 backend 在 sys.path 中 ──
_this_dir = os.path.dirname(os.path.abspath(__file__))
_backend_dir = os.path.join(_this_dir, "..")
sys.path.insert(0, _backend_dir)

# ── 加载 .env ──
_env_path = Path(_backend_dir).parent / ".env"
load_dotenv(_env_path)

# ── 解析数据库 URL（兼容 SQLite 相对路径）──
raw_db_url = os.environ.get("DATABASE_URL", f"sqlite:///{_backend_dir}/marketing_tools.db")
if raw_db_url.startswith("sqlite"):
    db_path = raw_db_url.replace("sqlite:///", "", 1)
    if not os.path.isabs(db_path):
        db_path = os.path.join(_backend_dir, db_path)
    DATABASE_URL = f"sqlite:///{db_path}"
    connect_args = {"check_same_thread": False}
else:
    DATABASE_URL = raw_db_url
    connect_args = {}

# 创建引擎（不依赖 database.py，避免 SQLite 路径解析差异）
engine = create_engine(DATABASE_URL, connect_args=connect_args)

# 导入所有模型（它们注册在 database.Base 上）
# 使用 database.Base 的 metadata，确保所有表都被 alembic 识别
from database import Base  # noqa: E402
import models  # noqa: F401, E402 — 导入触发模型注册到 Base.metadata

# ── Alembic 配置 ──
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = str(engine.url)
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
