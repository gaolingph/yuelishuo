"""
小红书采集器 — 通过公开搜索接口 + Cookie 方式采集

注意:
    - 小红书当前对抓取管控严格，建议使用官方开放平台（企业资质）
    - Cookie 方案仅用于初步验证，生产环境请使用开放平台 API
    - 请求频率务必控制在较低水平，避免触发反爬
"""
import logging
from typing import List, Optional
import json

from services.social.collector_base import CollectorBase
from config import settings

logger = logging.getLogger(__name__)

# 小红书搜索端点（公开接口，需要 Cookie）
XHS_SEARCH_URL = "https://edith.xiaohongshu.com/api/sns/web/v1/search/notes"


class XiaohongshuCollector(CollectorBase):
    """小红书内容采集器"""

    def __init__(self, cookie: str = None):
        super().__init__(qps=0.3)  # 每 3 秒一次，严格限流
        self.cookie = cookie or settings.XHS_COOKIE

    async def search_keywords(self, keywords: List[str], **kwargs) -> List[dict]:
        """
        按关键词搜索小红书笔记

        返回:
            [
                {
                    "platform": "xiaohongshu",
                    "post_id": "...",
                    "author_id": "...",
                    "author_name": "...",
                    "title": "...",
                    "content": "...",
                    "like_count": 0,
                    "comment_count": 0,
                    "collected_count": 0,
                    "posted_at": None,
                    "url": "...",
                    "images": [...],
                }
            ]
        """
        keyword = keywords[0] if keywords else ""
        if not keyword:
            return []

        headers = {
            "Cookie": self.cookie,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Content-Type": "application/json",
        }

        payload = {
            "keyword": keyword,
            "page": 1,
            "page_size": 20,
            "sort": "general",
            "note_type": 0,
        }

        data = await self._safe_request(
            "POST",
            XHS_SEARCH_URL,
            headers=headers,
            json=payload,
        )
        if not data:
            return []

        # 解析响应（根据实际 API 响应结构调整）
        items = data.get("data", {}).get("items", []) or data.get("items", [])
        results = []
        for item in items:
            note = item.get("note", {}) if isinstance(item, dict) else item
            results.append({
                "platform": "xiaohongshu",
                "post_id": note.get("id") or note.get("note_id", ""),
                "author_id": note.get("user", {}).get("user_id", ""),
                "author_name": note.get("user", {}).get("nickname", ""),
                "title": note.get("title", ""),
                "content": note.get("desc", ""),
                "images": note.get("image_list", []) or note.get("images", []),
                "like_count": note.get("liked_count", 0) or note.get("likes", 0),
                "comment_count": note.get("comment_count", 0) or note.get("comments", 0),
                "collected_count": note.get("collected_count", 0) or note.get("collects", 0),
                "posted_at": None,
                "url": f"https://www.xiaohongshu.com/explore/{note.get('id', '')}",
            })
        return results


# 便捷函数
async def collect_xiaohongshu(keywords: List[str]) -> List[dict]:
    """快速采集小红书关键词内容"""
    async with XiaohongshuCollector() as collector:
        return await collector.collect_to_leads(keywords)
