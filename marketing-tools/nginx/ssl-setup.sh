#!/bin/bash
# ─── 乐说邦 · Let's Encrypt SSL 证书自动申请脚本 ───
# 使用说明：
#   1. 将域名 DNS 解析到服务器 IP
#   2. 确保 80 端口已开放
#   3. 运行本脚本：bash ssl-setup.sh yourdomain.com
#
# 前置依赖：
#   - Docker Compose 已启动（Nginx 监听 80 端口）
#   - certbot（自动安装）

set -euo pipefail

DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
    echo "❌ 用法: bash ssl-setup.sh yourdomain.com"
    exit 1
fi

echo "🔐 开始为 $DOMAIN 申请 Let's Encrypt SSL 证书..."
echo ""

# 1. 安装 certbot
if ! command -v certbot &> /dev/null; then
    echo "📦 安装 certbot..."
    apt-get update && apt-get install -y certbot
fi

# 2. 停止 Nginx 容器（临时释放 80 端口）
echo "⏸️  停止 Nginx 容器..."
docker compose stop nginx || true

# 3. 申请证书（standalone 模式）
echo "🌐 向 Let's Encrypt 申请证书..."
certbot certonly --standalone \
    -d "$DOMAIN" \
    --email "admin@${DOMAIN}" \
    --agree-tos \
    --non-interactive \
    --preferred-challenges http

# 4. 复制证书到 Nginx SSL 目录
echo "📂 复制证书到 nginx/ssl/..."
mkdir -p ./nginx/ssl
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
cp "$CERT_DIR/fullchain.pem" ./nginx/ssl/
cp "$CERT_DIR/privkey.pem"   ./nginx/ssl/
chmod 600 ./nginx/ssl/privkey.pem

# 5. 更新 Nginx 配置（启用 HTTPS）
cat > ./nginx/nginx.conf << NGINX
# ─── 乐说邦客户服务系统 · Nginx 配置（HTTPS）───

upstream backend {
    server backend:8080;
}

# HTTP → HTTPS 重定向
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    client_max_body_size 50M;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # 安全头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";

    # 静态文件
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files \$uri \$uri/ /index.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Service Worker
    location /sw.js {
        root /usr/share/nginx/html;
        add_header Cache-Control "no-cache";
        add_header Service-Worker-Allowed "/";
    }

    # API 代理
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }

    location /health {
        proxy_pass http://backend;
        proxy_set_header Host \$host;
    }
}
NGINX

echo "  ✓ Nginx 配置已更新为 HTTPS"

# 6. 重启 Nginx
echo "🚀 重启 Nginx..."
docker compose up -d nginx

# 7. 设置自动续期（每月执行）
echo "🔄 设置证书自动续期..."
cat > /etc/cron.monthly/certbot-renew << 'CRON'
#!/bin/sh
cd /path/to/your/project && docker compose stop nginx && certbot renew && docker compose up -d nginx
CRON
chmod +x /etc/cron.monthly/certbot-renew

echo ""
echo "✅ SSL 证书配置完成！"
echo "   访问 https://$DOMAIN 查看效果"
echo "   证书自动续期已通过 cron 设置（每月）"
echo ""
echo "⚠️  注意：如果用 docker compose down 需要重新 start nginx"
echo "   请将 /etc/cron.monthly/certbot-renew 中的路径替换为实际项目路径"
