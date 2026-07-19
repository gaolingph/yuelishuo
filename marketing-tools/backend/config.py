"""
应用配置管理

从 .env 文件 + 环境变量读取所有配置。
使用 python-dotenv 加载 .env 文件，
环境变量优先级高于 .env 文件。
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# 项目根目录（backend 上级）
BASE_DIR = Path(__file__).parent.parent
# 加载 .env 文件（从项目根目录）
load_dotenv(BASE_DIR / ".env")


class Settings:
    """应用设置 — 所有配置集中管理"""

    # ─── JWT ───
    JWT_SECRET: str = os.environ.get("JWT_SECRET", "marketing-tools-jwt-secret-key-2025")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_DAYS: int = 7

    # ─── 数据库 ───
    DATABASE_URL: str = os.environ.get("DATABASE_URL", f"sqlite:///{BASE_DIR / 'backend' / 'marketing_tools.db'}")

    # ─── 高德地图 ───
    AMAP_API_KEY: str = os.environ.get("AMAP_API_KEY", "")
    AMAP_SEARCH_URL: str = "https://restapi.amap.com/v3/place/text"
    AMAP_DISTRICT_URL: str = "https://restapi.amap.com/v3/config/district"

    # ─── 短信网关 ───
    SMS_PROVIDER: str = os.environ.get("SMS_PROVIDER", "mock")
    SMS_ACCESS_KEY_ID: str = os.environ.get("SMS_ACCESS_KEY_ID", "")
    SMS_ACCESS_KEY_SECRET: str = os.environ.get("SMS_ACCESS_KEY_SECRET", "")
    SMS_SIGN_NAME: str = os.environ.get("SMS_SIGN_NAME", "乐说邦")
    SMS_TEMPLATE_CODE: str = os.environ.get("SMS_TEMPLATE_CODE", "")
    SMS_CODE_EXPIRE_SECONDS: int = 300

    # ─── 邮件服务 ───
    MAIL_PROVIDER: str = os.environ.get("MAIL_PROVIDER", "mock")
    SENDGRID_API_KEY: str = os.environ.get("SENDGRID_API_KEY", "")
    MAIL_FROM: str = os.environ.get("MAIL_FROM", "noreply@leshuobang.com")

    # ─── 服务器 ───
    HOST: str = os.environ.get("HOST", "0.0.0.0")
    PORT: int = int(os.environ.get("PORT", "8080"))
    DEBUG: bool = os.environ.get("DEBUG", "true").lower() == "true"

    # ─── Redis ───
    REDIS_URL: str = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

    # ─── CORS ───
    CORS_ORIGINS: list = ["*"]  # 生产环境应限制

    # ─── 社交媒体平台（自媒体拓客）───
    DOUYIN_APP_ID: str = os.environ.get("DOUYIN_APP_ID", "")
    DOUYIN_APP_SECRET: str = os.environ.get("DOUYIN_APP_SECRET", "")
    XHS_COOKIE: str = os.environ.get("XHS_COOKIE", "")           # 小红书 Cookie（手动提供）
    WECHAT_APP_ID: str = os.environ.get("WECHAT_APP_ID", "")
    WECHAT_APP_SECRET: str = os.environ.get("WECHAT_APP_SECRET", "")


# 全局单例
settings = Settings()
