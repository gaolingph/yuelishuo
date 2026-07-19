"""
抖音采集器 — 通过抖音开放平台公开 API 采集内容

接口文档:
    https://developer.open-douyin.com/

注意:
    - 需要注册抖音开放平台开发者，创建应用获取 app_id / app_secret
    - 每日 API 配额约 1000 次，合理规划调用
    - 仅采集公开内容，不涉及用户隐私
"""
import logging
from typing import List, Optional

from services.social.collector_base import CollectorBase
from config import settings

logger = logging.getLogger(__name__)

# 抖音开放平台 API 端点
DOUYIN_API_BASE = "https://open.douyin.com"
DOUYIN_VIDEO_SEARCH = f"{DOUYIN_API_BASE}/api/search/video/"  # 关键词搜索视频


class DouyinCollector(CollectorBase):
    """抖音内容采集器"""

    def __init__(self, app_id: str = None, app_secret: str = None):
        super().__init__(qps=0.5)  # 每 2 秒一次
        self.app_id = app_id or settings.DOUYIN_APP_ID
        self.app_secret = app_secret or settings.DOUYIN_APP_SECRET
        self.access_token: Optional[str] = None

    async def _get_access_token(self) -> Optional[str]:
        """获取 access_token（客户端凭证模式）"""
        if self.access_token:
            return self.access_token

        url = f"{DOUYIN_API_BASE}/oauth/client_token/"
        params = {
            "client_key": self.app_id,
            "client_secret": self.app_secret,
            "grant_type": "client_credential",
        }
        data = await self._safe_request("POST", url, json=params)
        if data and data.get("data", {}).get("access_token"):
            self.access_token = data["data"]["access_token"]
            return self.access_token
        logger.error("获取抖音 access_token 失败")
        return None

    async def search_keywords(self, keywords: List[str], **kwargs) -> List[dict]:
        """
        按关键词搜索抖音视频

        返回:
            [
                {
                    "platform": "douyin",
                    "post_id": "...
                    "author_id": "...",
                    "author_name": "...",
                    "title": "...",
                    "content": "...",
                    "like_count": 0,
                    "comment_count": 0,
                    "share_count": 0,
                    "posted_at": None,
                    "url": "...",
                }
            ]
        """
        token = await self._get_access_token()
        if not token:
            return []

        keyword = keywords[0] if keywords else ""
        if not keyword:
            return []

        params = {
            "keyword": keyword,
            "count": 20,
            "cursor": 0,
        }
        headers = {"Authorization": f"Bearer {token}"}

        data = await self._safe_request(
            "GET",
            DOUYIN_VIDEO_SEARCH,
            params=params,
            headers=headers,
        )
        if not data:
            return []

        videos = data.get("data", {}).get("list", [])
        results = []
        for v in videos:
            results.append({
                "platform": "douyin",
                "post_id": v.get("item_id", ""),
                "author_id": v.get("author", {}).get("author_id", ""),
                "author_name": v.get("author", {}).get("nickname", ""),
                "title": v.get("title", ""),
                "content": v.get("desc", ""),
                "like_count": v.get("statistics", {}).get("digg_count", 0),
                "comment_count": v.get("statistics", {}).get("comment_count", 0),
                "share_count": v.get("statistics", {}).get("share_count", 0),
                "posted_at": None,  # 开放平台不直接返回发布时间
                "url": f"https://www.douyin.com/video/{v.get('item_id', '')}",
            })
        return results


# 便捷函数
async def collect_douyin(keywords: List[str]) -> List[dict]:
    """快速采集抖音关键词内容"""
    async with DouyinCollector() as collector:
        return await collector.collect_to_leads(keywords)
