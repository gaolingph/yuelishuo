"""
自媒体采集器 — 抽象基类

提供所有平台采集器的公共能力：
- 异步 HTTP 客户端 (httpx.AsyncClient)
- 自动限流 (token bucket)
- 统一错误重试 (指数退避)
- collect_to_leads() 公共入口
"""
import asyncio
import logging
from abc import ABC, abstractmethod
from typing import List, Optional, Callable
from urllib.parse import urlencode

import httpx

from config import settings

logger = logging.getLogger(__name__)


class RateLimiter:
    """简易令牌桶限流器"""

    def __init__(self, qps: float = 1.0):
        self.interval = 1.0 / qps
        self.last_call = 0.0

    async def wait(self):
        now = asyncio.get_event_loop().time()
        wait_time = self.interval - (now - self.last_call)
        if wait_time > 0:
            await asyncio.sleep(wait_time)
        self.last_call = asyncio.get_event_loop().time()


class CollectorBase(ABC):
    """采集器抽象基类 — 所有平台采集器继承此基类"""

    def __init__(self, qps: float = 1.0, timeout: float = 30.0):
        self.client = httpx.AsyncClient(timeout=timeout)
        self.limiter = RateLimiter(qps)
        self.timeout = timeout

    @abstractmethod
    async def search_keywords(self, keywords: List[str], **kwargs) -> List[dict]:
        """按关键词搜索公开内容（子类必须实现）"""
        ...

    async def search_comments(self, post_id: str, **kwargs) -> List[dict]:
        """获取帖子评论（可选实现）"""
        return []

    async def search_competitors(self, account_name: str, **kwargs) -> List[dict]:
        """搜索竞品账号相关内容（可选实现）"""
        return []

    async def collect_to_leads(
        self,
        keywords: List[str],
        on_post_found: Optional[Callable] = None,
        **kwargs,
    ) -> List[dict]:
        """
        一站式采集：搜索 → 解析 → 返回结构化结果（上层调用评分引擎后写入 Lead）

        参数:
            keywords: 搜索关键词列表
            on_post_found: 每找到一条帖子时的回调（用于进度跟踪）

        返回:
            解析后的帖子字典列表，结构：
            [
                {
                    "platform": "douyin",
                    "post_id": "...",
                    "author_id": "...",
                    "author_name": "...",
                    "title": "...",
                    "content": "...",
                    "like_count": 0,
                    "comment_count": 0,
                    "posted_at": datetime or None,
                    "url": "...",
                }
            ]
        """
        results = []
        for kw in keywords:
            try:
                posts = await self.search_keywords([kw], **kwargs)
                for post in posts:
                    post["source_keywords"] = kw
                    results.append(post)
                    if on_post_found:
                        await on_post_found(post)
                # 跨关键词延迟，避免触发限流
                await asyncio.sleep(0.5)
            except Exception as e:
                logger.error(f"关键词 [{kw}] 采集失败: {e}")
                continue
        return results

    async def close(self):
        """关闭 HTTP 客户端"""
        await self.client.aclose()

    def _build_url(self, base: str, params: dict) -> str:
        """构建带参数的 URL"""
        return f"{base}?{urlencode({k: v for k, v in params.items() if v is not None})}"

    async def _safe_request(
        self,
        method: str,
        url: str,
        retries: int = 2,
        **kwargs,
    ) -> Optional[dict]:
        """带重试的安全请求"""
        for attempt in range(retries + 1):
            try:
                await self.limiter.wait()
                resp = await self.client.request(method, url, **kwargs)
                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPStatusError as e:
                if attempt < retries and e.response.status_code >= 500:
                    wait = 2 ** attempt
                    logger.warning(f"请求失败 (HTTP {e.response.status_code}), {wait}s 后重试...")
                    await asyncio.sleep(wait)
                    continue
                logger.error(f"HTTP 错误: {e}")
                return None
            except httpx.RequestError as e:
                if attempt < retries:
                    wait = 2 ** attempt
                    logger.warning(f"网络错误: {e}, {wait}s 后重试...")
                    await asyncio.sleep(wait)
                    continue
                logger.error(f"请求异常: {e}")
                return None
            except Exception as e:
                logger.error(f"未知错误: {e}")
                return None
        return None

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
