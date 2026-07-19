# ─── 乐说邦客户服务系统 · Docker 镜像 ───
# 多阶段构建：Python 运行时 + 前端静态资源

# ─── Stage 1: 构建 Python 依赖 ───
FROM python:3.12-slim AS builder

WORKDIR /build

# 系统依赖（ffmpeg 用于视频生成、编译依赖）
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ffmpeg \
        gcc \
        libffi-dev \
        libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ─── Stage 2: 运行镜像 ───
FROM python:3.12-slim

WORKDIR /app

# 仅复制已安装的 Python 包
COPY --from=builder /root/.local /root/.local

# 运行时系统依赖（仅 ffmpeg）
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ffmpeg \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/*

# 将用户安装的 bin 加入 PATH
ENV PATH=/root/.local/bin:$PATH

# 复制应用代码
COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY .env ./

EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -s http://localhost:8080/ > /dev/null || exit 1

# 启动命令（使用 uvicorn）
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
