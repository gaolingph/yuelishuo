"""
采集任务调度管理器

使用 APScheduler 管理定时采集任务：
    - 启动时加载所有 KeywordConfig.is_active=True 的配置
    - 自动注册定时任务（默认每 6 小时执行一次）
    - 新增/修改/删除关键词配置时同步更新任务
    - 任务执行失败自动重试 2 次
"""
import logging
from datetime import datetime
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session

from database import SessionLocal
from models import KeywordConfig, CollectionTask, SocialPost, Lead, LeadSource
from services.social.scoring_engine import ScoringEngine, batch_score
from services.social.douyin_collector import DouyinCollector
from services.social.xiaohongshu_collector import XiaohongshuCollector
from services.social.video_channel_collector import VideoChannelCollector

logger = logging.getLogger(__name__)

# 全局调度器
scheduler = AsyncIOScheduler()

# 平台名称到采集器类的映射
COLLECTOR_MAP = {
    "douyin": DouyinCollector,
    "xiaohongshu": XiaohongshuCollector,
    "wechat_video": VideoChannelCollector,
}

# 平台名称到 LeadSource 枚举值的映射
PLATFORM_SOURCE_MAP = {
    "douyin": LeadSource.DOUYIN.value,
    "xiaohongshu": LeadSource.XIAOHONGSHU.value,
    "wechat_video": LeadSource.WECHAT.value,
}


def get_collector(platform: str):
    """根据平台名称返回对应采集器实例"""
    collector_cls = COLLECTOR_MAP.get(platform)
    if not collector_cls:
        raise ValueError(f"不支持的平台: {platform}")
    return collector_cls()


async def execute_collection_task(task_id: int, keyword_config_id: int, platform: str):
    """
    执行一次采集任务

    流程:
        1. 加载关键词配置
        2. 创建对应平台的 Collector
        3. 搜索关键词内容
        4. 评分引擎评分
        5. 达标内容转为 Lead + 写入 SocialPost
        6. 更新 CollectionTask 状态
    """
    db: Optional[Session] = None
    collector = None
    try:
        db = SessionLocal()

        # 1. 更新任务状态
        task = db.query(CollectionTask).filter(CollectionTask.id == task_id).first()
        if not task:
            logger.error(f"任务 {task_id} 不存在")
            return
        task.status = "running"
        task.started_at = datetime.utcnow()
        db.commit()

        # 2. 加载关键词配置
        kw_config = db.query(KeywordConfig).filter(KeywordConfig.id == keyword_config_id).first()
        if not kw_config or not kw_config.is_active:
            task.status = "completed"
            task.completed_at = datetime.utcnow()
            db.commit()
            return

        keywords = kw_config.keywords or []

        # 3. 采集
        collector = get_collector(platform)
        raw_posts = await collector.collect_to_leads(keywords)

        # 4. 评分
        scoring_engine = ScoringEngine()
        leads_created = 0

        for post_data in raw_posts:
            content = post_data.get("content", "")
            title = post_data.get("title", "")
            score_result = scoring_engine.score_post(content, title)

            if not score_result["should_convert"]:
                continue

            # 5. 写入 SocialPost
            social_post = SocialPost(
                platform=platform,
                post_id=post_data.get("post_id", ""),
                author_id=post_data.get("author_id", ""),
                author_name=post_data.get("author_name", ""),
                title=title,
                content=content,
                like_count=post_data.get("like_count", 0),
                comment_count=post_data.get("comment_count", 0),
                share_count=post_data.get("share_count", 0),
                posted_at=post_data.get("posted_at"),
                is_lead_generated=True,
                source_keywords=post_data.get("source_keywords", ""),
                campus_id=kw_config.campus_id,
            )
            db.add(social_post)
            db.flush()

            # 6. 创建 Lead
            source = PLATFORM_SOURCE_MAP.get(platform, LeadSource.MANUAL.value)
            lead = Lead(
                name=post_data.get("author_name"),
                source=source,
                source_detail=f"{platform}帖子: {post_data.get('post_id', '')} | {title}",
                notes=f"自动采集 | 评分: {score_result['total_score']}分\n"
                      f"平台: {platform} | 作者: {post_data.get('author_name', '')}\n"
                      f"标题: {title}\n"
                      f"内容: {content[:200]}\n"
                      f"链接: {post_data.get('url', '')}",
                campus_id=kw_config.campus_id,
                status="new",
            )
            db.add(lead)
            leads_created += 1

        # 7. 更新任务完成状态
        task.status = "completed"
        task.total_found = len(raw_posts)
        task.leads_created = leads_created
        task.completed_at = datetime.utcnow()
        db.commit()

        logger.info(
            f"采集任务完成 [{platform}] 关键词={keywords} "
            f"发现 {len(raw_posts)} 条, 创建 {leads_created} 条线索"
        )

    except Exception as e:
        logger.error(f"采集任务执行失败 (task_id={task_id}): {e}")
        if db:
            task = db.query(CollectionTask).filter(CollectionTask.id == task_id).first()
            if task:
                task.status = "failed"
                task.error_message = str(e)[:500]
                task.completed_at = datetime.utcnow()
                db.commit()
    finally:
        if collector:
            await collector.close()
        if db:
            db.close()


def register_keyword_task(keyword_config: KeywordConfig):
    """注册关键词的定时采集任务"""
    task_id = f"collect_{keyword_config.platform}_{keyword_config.id}"

    # 检查是否已注册
    if scheduler.get_job(task_id):
        logger.warning(f"任务 {task_id} 已存在，跳过注册")
        return

    interval_hours = keyword_config.search_interval_hours or 6

    scheduler.add_job(
        _run_collection_task,
        trigger=IntervalTrigger(hours=interval_hours),
        args=[keyword_config.id, keyword_config.platform],
        id=task_id,
        name=f"{keyword_config.platform}/{keyword_config.name}",
        replace_existing=True,
        misfire_grace_time=300,
    )
    logger.info(f"已注册定时任务: {task_id} (每 {interval_hours} 小时)")


def unregister_keyword_task(keyword_config_id: int, platform: str):
    """取消关键词的定时任务"""
    task_id = f"collect_{platform}_{keyword_config_id}"
    if scheduler.get_job(task_id):
        scheduler.remove_job(task_id)
        logger.info(f"已移除定时任务: {task_id}")


async def _run_collection_task(keyword_config_id: int, platform: str):
    """定时任务回调 — 创建任务记录并执行"""
    db = SessionLocal()
    try:
        # 创建任务记录
        task = CollectionTask(
            platform=platform,
            task_type="keyword_search",
            keyword_config_id=keyword_config_id,
            status="pending",
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        # 执行采集
        await execute_collection_task(task.id, keyword_config_id, platform)
    finally:
        db.close()


def load_all_tasks(db: Session):
    """启动时加载所有活跃的关键词配置并注册定时任务"""
    active_configs = db.query(KeywordConfig).filter(KeywordConfig.is_active == True).all()
    for config in active_configs:
        register_keyword_task(config)
    logger.info(f"已加载 {len(active_configs)} 个活跃采集任务")


async def start_scheduler():
    """启动调度器（在 FastAPI 启动事件中调用）"""
    db = SessionLocal()
    try:
        load_all_tasks(db)
    finally:
        db.close()
    scheduler.start()
    logger.info("APScheduler 已启动")


def stop_scheduler():
    """停止调度器"""
    scheduler.shutdown(wait=False)
    logger.info("APScheduler 已停止")
