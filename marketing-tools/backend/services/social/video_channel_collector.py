"""
微信视频号采集器 — 通过微信开放平台 API 采集

注意:
    - 需要注册微信开放平台开发者，创建应用获取 app_id / app_secret
    - 视频号搜索能力需要通过微信开放平台 SNS 接口
    - 目前视频号对外 API 有限，主要依赖搜一搜能力
"""
import logging
from typing import List, Optional

from services.social.collector_base import CollectorBase
from config import settings

logger = logging.getLogger(__name__)

# 微信开放平台 API 端点
WECHAT_API_BASE = "https://api.weixin.qq.com"


class VideoChannelCollector(CollectorBase):
    """微信视频号内容采集器"""

    def __init__(self, app_id: str = None, app_secret: str = None):
        super().__init__(qps=1.0)
        self.app_id = app_id or settings.WECHAT_APP_ID
        self.app_secret = app_secret or settings.WECHAT_APP_SECRET
        self.access_token: Optional[str] = None

    async def _get_access_token(self) -> Optional[str]:
        """获取微信 access_token"""
        if self.access_token:
            return self.access_token

        url = f"{WECHAT_API_BASE}/cgi-bin/token"
        params = {
            "grant_type": "client_credential",
            "appid": self.app_id,
            "secret": self.app_secret,
        }
        data = await self._safe_request("GET", url, params=params)
        if data and data.get("access_token"):
            self.access_token = data["access_token"]
            return self.access_token
        logger.error(f"获取微信 access_token 失败: {data}")
        return None

    async def search_keywords(self, keywords: List[str], **kwargs) -> List[dict]:
        """
        按关键词搜索视频号内容（通过微信搜一搜能力）

        返回:
            [
                {
                    "platform": "wechat_video",
                    "post_id": "...",
                    "author_id": "...",
                    "author_name": "...",
                    "title": "...",
                    "content": "...",
                    "like_count": 0,
                    "comment_count": 0,
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

        # 微信搜一搜接口（开放平台能力有限，此为示意）
        search_url = f"{WECHAT_API_BASE}/wxa/search/weapp"
        params = {
            "access_token": token,
            "keyword": keyword,
            "offset": 0,
            "limit": 20,
        }

        data = await self._safe_request("POST", search_url, params=params)
        if not data:
            return []

        # 解析搜索结果（根据微信实际返回结构调整）
        results = []
        items = data.get("results", []) or data.get("items", [])
        for item in items:
            results.append({
                "platform": "wechat_video",
                "post_id": item.get("id", "") or item.get("item_id", ""),
                "author_id": item.get("author_id", ""),
                "author_name": item.get("author", "") or item.get("nickname", ""),
                "title": item.get("title", ""),
                "content": item.get("description", "") or item.get("desc", ""),
                "like_count": item.get("like_count", 0),
                "comment_count": item.get("comment_count", 0),
                "posted_at": None,
                "url": item.get("url", "") or item.get("link", ""),
            })
        return results


# 便捷函数
async def collect_video_channel(keywords: List[str]) -> List[dict]:
    """快速采集视频号关键词内容"""
    async with VideoChannelCollector() as collector:
        return await collector.collect_to_leads(keywords)
