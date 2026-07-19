@echo off
echo ================================
echo  英语单词速记系统 - 启动脚本
echo ================================
echo.

echo [1/2] 构建Docker镜像...
docker-compose build

echo.
echo [2/2] 启动服务...
docker-compose up -d

echo.
echo ================================
echo  启动完成！
echo  前端: http://localhost
echo  后端: http://localhost:8000
echo  API文档: http://localhost:8000/docs
echo ================================
pause
