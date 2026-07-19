"""获客转化工具系统 — FastAPI 主应用（含多校区、手机登录、操作留痕、成交佣金）"""
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

# 将 backend 目录加入 path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import engine, Base
from routers import leads, schools, interactions, stats, auth, campus, staff, deals, commission, audit, social

# 创建所有数据库表
Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动时注册定时采集任务，关闭时清理"""
    from services.social.task_manager import start_scheduler, stop_scheduler
    await start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="K12获客转化工具系统 v2.0",
    description="多校区 · 手机登录 · 操作留痕 · 成交佣金管理",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS
from config import settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册所有 API 路由
app.include_router(auth.router)
app.include_router(campus.router)
app.include_router(staff.router)
app.include_router(leads.router)
app.include_router(schools.router)
app.include_router(interactions.router)
app.include_router(deals.router)
app.include_router(commission.router)
app.include_router(audit.router)

app.include_router(stats.router)

app.include_router(social.router, prefix="/api")


@app.get("/api/health")
def health_check():
    """健康检查"""
    return {"status": "ok", "service": "marketing-tools", "version": "2.0.0"}


# 挂载前端静态文件（必须在 API 路由之后）
frontend_dir = Path(__file__).parent.parent / "frontend"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
