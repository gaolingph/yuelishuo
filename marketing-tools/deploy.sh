#!/bin/bash
# ─── 乐说邦客户服务系统 · 生产部署脚本 ───
# 适用环境：Ubuntu 22.04 / Debian 12 + Docker
#
# 首次部署：
#   bash deploy.sh
#
# 日常更新（重新构建并重启）：
#   bash deploy.sh update
#
# 查看状态：
#   bash deploy.sh status

set -euo pipefail

cd "$(dirname "$0")"

PROJECT="乐说邦"
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"

# ─── 颜色 ───
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }

# ─── 前置检查 ───
check_prerequisites() {
    echo "────────────────────────────────────────"
    echo "  $PROJECT 客户服务系统 · 部署脚本"
    echo "────────────────────────────────────────"
    echo ""

    # 检查 Docker
    if ! command -v docker &> /dev/null; then
        error "Docker 未安装！请先安装 Docker："
        error "  curl -fsSL https://get.docker.com | sh"
        exit 1
    fi
    info "Docker: $(docker --version)"

    # 检查 Docker Compose
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    elif docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        error "Docker Compose 未安装！"
        exit 1
    fi
    info "Docker Compose: $($COMPOSE_CMD version)"

    # 检查 .env 文件
    if [ ! -f "$ENV_FILE" ]; then
        error ".env 文件不存在！请先创建："
        error "  cp .env.example .env"
        exit 1
    fi
    info "配置文件: $ENV_FILE"
}

# ─── 创建必要目录 ───
setup_directories() {
    mkdir -p nginx/ssl
    info "目录结构检查完成"
}

# ─── 首次部署 ───
deploy_first() {
    check_prerequisites
    setup_directories

    echo ""
    echo "🚀 开始首次部署..."

    # 启动数据库和缓存
    warn "正在启动 PostgreSQL 和 Redis..."
    $COMPOSE_CMD up -d postgres redis
    sleep 5

    # 初始化数据库
    warn "正在初始化数据库..."
    $COMPOSE_CMD run --rm backend python backend/init_db.py

    # 构建并启动所有服务
    warn "正在构建并启动所有服务..."
    $COMPOSE_CMD up -d --build

    echo ""
    info "✅ 部署完成！"
    info "   后端 API:  http://localhost:8080"
    info "   请配置 Nginx 域名和 SSL 证书后对外提供服务"
    echo ""
    warn "   📌 下一步：配置域名和 SSL"
    warn "      bash nginx/ssl-setup.sh yourdomain.com"
    echo ""
}

# ─── 更新部署 ───
deploy_update() {
    echo ""
    echo "🔄 开始更新..."

    $COMPOSE_CMD down
    $COMPOSE_CMD up -d --build

    info "✅ 更新完成！"
}

# ─── 查看状态 ───
show_status() {
    echo ""
    echo "📊 服务状态："
    $COMPOSE_CMD ps

    echo ""
    echo "📈 资源占用："
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" \
        $(docker compose ps -q) 2>/dev/null || true
}

# ─── 备份数据库 ───
backup_database() {
    BACKUP_DIR="./backups"
    mkdir -p "$BACKUP_DIR"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)

    echo ""
    echo "💾 开始备份数据库..."

    if [ -f "./backend/marketing_tools.db" ]; then
        # SQLite 备份
        cp ./backend/marketing_tools.db "$BACKUP_DIR/marketing_tools_$TIMESTAMP.db"
        info "SQLite 已备份: $BACKUP_DIR/marketing_tools_$TIMESTAMP.db"
    else
        # PostgreSQL 备份（通过 Docker）
        docker exec leshuobang-postgres pg_dump -U leshuobang marketing_tools \
            > "$BACKUP_DIR/marketing_tools_$TIMESTAMP.sql"
        info "PostgreSQL 已备份: $BACKUP_DIR/marketing_tools_$TIMESTAMP.sql"
    fi
}

# ─── 主入口 ───
case "${1:-deploy}" in
    deploy)
        deploy_first
        ;;
    update)
        deploy_update
        ;;
    status)
        show_status
        ;;
    backup)
        backup_database
        ;;
    restart)
        echo "🔄 重启所有服务..."
        $COMPOSE_CMD restart
        info "✅ 重启完成！"
        ;;
    logs)
        $COMPOSE_CMD logs -f
        ;;
    stop)
        $COMPOSE_CMD down
        info "✅ 已停止所有服务"
        ;;
    *)
        echo "用法: bash deploy.sh [command]"
        echo ""
        echo "命令:"
        echo "  deploy   首次部署（默认）"
        echo "  update   重新构建并更新"
        echo "  status   查看服务状态"
        echo "  logs     查看实时日志"
        echo "  restart  重启所有服务"
        echo "  stop     停止所有服务"
        echo "  backup   备份数据库"
        ;;
esac
