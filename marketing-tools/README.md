# 🎯 K12获客转化工具系统

**英语单词速记 — 营销获客一体化系统**

一套面向K12教育行业的营销工具，帮助机构解决**抖音短视频获客**、**学校线索采集**、**客户跟踪转化**三大核心问题。

---

## 📦 功能模块

### 1. 线索管理 (CRM)
- 线索全生命周期管理：新线索 → 已联系 → 有意向 → 已安排试听 → 已试听 → 报价中 → 已成交/已流失
- 多维度筛选：状态、来源、负责人、关键词、学科
- 跟进记录：每次沟通自动记录，支持备注下次跟进时间
- 批量导入：支持 JSON 格式批量导入线索
- 数据看板：管道统计、每日新增趋势、来源分布

### 2. 学校名录采集
- 基于 **高德地图 POI API** 采集周边学校信息（名称、地址、电话、类型）
- 支持按城市、区域、学校类型筛选
- 一键将学校转为线索跟进
- 数据来源合法合规，仅采集公开登记的学校信息

### 3. 短视频自动生成
- 单词记忆卡视频：输入单词、释义、记忆技巧、例句，自动生成抖音竖版短视频
- 选择题视频：生成英语选择题互动视频
- 多种视觉主题（英语/数学/语文/通用）
- 自动语音合成（edge-tts，女声/男声 可选）
- 输出：1080×1920 竖屏 MP4，适配抖音发布

### 4. 统计分析与团队管理
- 销售漏斗分析
- 30天趋势图表
- 团队成员业绩排名
- 转换率统计

---

## 🚀 快速启动

### 系统要求
- Windows 10/11 或 macOS/Linux
- Python 3.10+
- 网络连接（用于 TTS 和地图 API）

### 1. 安装 Python

**Windows 用户：**
```bash
winget install Python.Python.3.12 --accept-source-agreements --accept-package-agreements
```

**macOS 用户：**
```bash
brew install python@3.12
```

**Linux 用户：**
```bash
sudo apt install python3.12 python3.12-venv python3.12-pip
```

### 2. 安装依赖

```bash
cd marketing-tools

# Windows:
set PATH=%USERPROFILE%\AppData\Local\Programs\Python\Python312\;%PATH%
pip install -r requirements.txt

# macOS/Linux:
pip install -r requirements.txt
```

### 3. 配置环境变量（可选）

如需使用**学校采集**功能，需配置高德地图 API Key：

```bash
# Windows:
set AMAP_API_KEY=你的高德地图Key

# macOS/Linux:
export AMAP_API_KEY=你的高德地图Key
```

> 申请地址：https://lbs.amap.com/ （控制台 → 应用管理 → 我的应用 → 创建新应用 → 添加Key）
>
> 选择「Web服务」类型，免费版每日调用限额充足。

### 4. 启动服务

```bash
cd marketing-tools\backend
python -m uvicorn main:app --host 0.0.0.0 --port 8080
```

**或直接双击 `start.bat`**（Windows 快捷启动）

### 5. 访问系统

| 地址 | 说明 |
|------|------|
| http://localhost:8080 | 前端管理界面 |
| http://localhost:8080/docs | API 交互文档 (Swagger) |
| http://localhost:8080/api/health | 健康检查 |

---

## 📖 使用指南

### 👥 线索管理流程

1. **添加线索** → 点击「线索管理」→「新增线索」
2. **跟进记录** → 点击线索右侧「查看」→「添加跟进」
3. **更新状态** → 在详情页顶部选择新状态
4. **批量导入** → 「批量导入」→ 粘贴 JSON 数据

### 🏫 学校采集流程

1. 进入「学校名录」页面
2. 点击「采集学校」按钮
3. 输入**城市名**（如「北京」）、**区名**（可选，如「海淀区」）、**学校类型**（小学/初中/高中）
4. 系统自动从高德地图采集公开数据
5. 采集完成后，可在列表中点击「转为线索」跟进

### 🎬 视频生成流程

1. 进入「短视频生成」页面
2. 填写单词信息：单词、释义、记忆技巧、例句
3. 选择视觉主题
4. 点击「生成视频」
5. 系统自动合成视频，包含画面帧 + 语音朗读
6. 在「视频记录」列表中查看、发布标记

### 📊 数据看板

- **概览**：全部线索、今日新增、跟进提醒、未读消息等
- **转化漏斗**：各阶段线索数量及转换率
- **趋势图表**：近30天新增趋势
- **团队排名**：各成员业绩对比

---

## 🧩 项目结构

```
marketing-tools/
├── backend/
│   ├── main.py                 # FastAPI 主应用入口
│   ├── database.py             # 数据库配置（SQLite）
│   ├── models.py               # 数据模型定义
│   ├── schemas.py              # Pydantic 序列化/验证
│   ├── routers/
│   │   ├── leads.py            # 线索管理 API
│   │   ├── schools.py          # 学校名录 API
│   │   ├── interactions.py     # 跟进记录 API
│   │   ├── video.py            # 短视频模板/记录 API
│   │   └── stats.py            # 统计分析 API
│   └── services/
│       ├── school_collector.py  # 高德地图学校采集服务
│       └── video_generator.py   # 视频生成服务（TTS+帧合成）
├── frontend/
│   ├── index.html              # SPA 主页面
│   ├── css/style.css           # 样式文件
│   └── js/app.js               # 前端应用逻辑
├── requirements.txt            # Python 依赖清单
├── start.bat                   # Windows 一键启动脚本
└── README.md                   # 本文件
```

---

## 🔧 技术栈

| 层级 | 技术 |
|------|------|
| **后端框架** | Python FastAPI |
| **数据库** | SQLite + SQLAlchemy ORM |
| **前端** | 原生 HTML/CSS/JS (SPA) |
| **视频生成** | moviepy + Pillow + edge-tts |
| **学校数据** | 高德地图 POI API |
| **部署** | uvicorn (单机), 可扩展至 docker/nginx |

---

## 📌 部署到服务器（团队使用）

### 方式一：直接部署（推荐小团队）

```bash
# 服务器上执行
pip install -r requirements.txt
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8080
```

团队成员通过 `http://服务器IP:8080` 访问。

### 方式二：使用 Nginx 反向代理（推荐生产环境）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 方式三：使用 systemd 守护进程（Linux）

创建 `/etc/systemd/system/marketing-tools.service`：

```ini
[Unit]
Description=K12 Marketing Tools
After=network.target

[Service]
User=www-data
WorkingDirectory=/path/to/marketing-tools/backend
ExecStart=/usr/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port 8080
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable marketing-tools
sudo systemctl start marketing-tools
```

---

## 🔐 注意事项

1. **高德地图 API Key**：采集学校功能需要申请高德 API Key，注册地址 `https://lbs.amap.com/`
2. **数据合规**：系统仅采集高德地图上公开登记的学校信息，不涉及个人隐私数据
3. **语音合成**：edge-tts 需要网络连接，首次使用会下载语音模型
4. **视频生成**：首次使用 moviepy 时会自动下载 ffmpeg
5. **数据库备份**：定期备份项目目录下的 `marketing_tools.db` 文件

---

## 📝 后续扩展

- [ ] 多学科支持（数学、语文等）
- [ ] 微信小程序对接
- [ ] 抖音内容发布 API
- [ ] 短信/电话营销集成
- [ ] 数据导出（Excel/CSV）
- [ ] 用户权限分级管理
- [ ] Docker 容器化部署
