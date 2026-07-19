"""自媒体拓客 — 社交媒体采集与线索评分服务"""

from .collector_base import CollectorBase, RateLimiter
from .scoring_engine import ScoringEngine, score_post, batch_score
from .douyin_collector import DouyinCollector
from .xiaohongshu_collector import XiaohongshuCollector
from .video_channel_collector import VideoChannelCollector
from .task_manager import (
    execute_collection_task,
    register_keyword_task,
    unregister_keyword_task,
    start_scheduler,
    stop_scheduler,
)

__all__ = [
    "CollectorBase",
    "RateLimiter",
    "ScoringEngine",
    "score_post",
    "batch_score",
    "DouyinCollector",
    "XiaohongshuCollector",
    "VideoChannelCollector",
    "execute_collection_task",
    "register_keyword_task",
    "unregister_keyword_task",
    "start_scheduler",
    "stop_scheduler",
]
