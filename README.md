# 英语单词速记系统

基于艾宾浩斯遗忘曲线与 SM-2 算法的智能单词记忆系统。

## 快速启动（Docker 一键运行）

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止
docker-compose down
```

启动后访问：
- **前端界面**：http://localhost
- **后端 API**：http://localhost:8000
- **API 文档**：http://localhost:8000/docs

## 本地开发

### 后端

```bash
cd backend
pip install -r requirements.txt
python main.py
# → http://localhost:8000
```

### 前端

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

## 功能特性

| 功能 | 说明 |
|------|------|
| 📚 分级词库 | 小学→TOEFL，11个级别，~1100词 |
| 🧠 SM-2 算法 | 智能间隔重复，科学记忆 |
| 🔄 学习→复习闭环 | 学习新词 → 按时复习 → SM-2评分 |
| ✍️ 三种练习模式 | 选择题、拼写题、听力题 |
| 📕 错题本 | 自动记录错题，针对性巩固 |
| ⚔️ PK 对战 | 限时答题挑战，冲排行榜 |
| 🏆 成就系统 | 12个成就待解锁 |
| 📊 学习统计 | 学习曲线、日历打卡、数据概览 |
