@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ================================
echo  K12获客转化工具系统 - 启动脚本
echo ================================
echo.

set PYTHON_PATH=C:\Users\Lenovo\AppData\Local\Programs\Python\Python312
set PATH=%PYTHON_PATH%;%PYTHON_PATH%\Scripts;%PATH%

echo [1/3] 检查数据库...
python -c "import sys; sys.path.insert(0, 'backend'); from database import engine, Base; from backend.models import *; Base.metadata.create_all(bind=engine); print('  数据库表初始化完成')" 2>&1

echo.
echo [2/3] 启动后端服务...
cd backend
start "获客系统" cmd /c "title 获客系统后端 & python -m uvicorn main:app --host 0.0.0.0 --port 8080 & pause"

echo.
echo [3/3] 等待服务就绪...
timeout /t 3 /nobreak >nul

echo.
echo ================================
echo  启动完成！
echo.
echo  前端访问: http://localhost:8080
echo  API文档:   http://localhost:8080/docs
echo  健康检查:  http://localhost:8080/api/health
echo ================================
echo.
pause
