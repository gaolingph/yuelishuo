"""LLM provider client — wraps OpenAI SDK for DeepSeek (or any OpenAI-compatible API).

Supports both standard completions and SSE streaming for real-time chat.
"""

import json
from typing import AsyncGenerator, Optional

from openai import AsyncOpenAI, APIError

from .config import settings


class LLMClient:
    """Agnostic LLM client — works with DeepSeek, OpenAI, or any OpenAI-compatible provider."""

    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.llm_api_key,
            base_url=settings.llm_base_url,
        )
        self.model = settings.llm_model
        self.fast_model = settings.llm_fast_model

    # ------------------------------------------------------------------
    # Standard (non-streaming) completion
    # ------------------------------------------------------------------
    async def chat(
        self,
        messages: list[dict],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> str:
        """Send a chat completion request and return the full response text."""
        try:
            response = await self.client.chat.completions.create(
                model=model or self.model,
                messages=messages,
                temperature=temperature or settings.temperature,
                max_tokens=max_tokens or settings.max_tokens,
                stream=False,
            )
            return response.choices[0].message.content or ""
        except APIError as e:
            return f"【AI 服务暂时不可用，请稍后再试】\n错误信息: {str(e)}"

    # ------------------------------------------------------------------
    # Streaming completion — yields SSE text chunks
    # ------------------------------------------------------------------
    async def chat_stream(
        self,
        messages: list[dict],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
    ) -> AsyncGenerator[str, None]:
        """Stream a chat completion, yielding text chunks as they arrive."""
        try:
            stream = await self.client.chat.completions.create(
                model=model or self.model,
                messages=messages,
                temperature=temperature or settings.temperature,
                max_tokens=max_tokens or settings.max_tokens,
                stream=True,
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta if chunk.choices else None
                if delta and delta.content:
                    yield delta.content
        except APIError as e:
            yield f"\n\n【AI 服务暂时不可用，请稍后再试】错误: {str(e)}"

    # ------------------------------------------------------------------
    # Structured output via JSON mode
    # ------------------------------------------------------------------
    async def chat_structured(
        self,
        messages: list[dict],
        response_schema: dict,
        model: Optional[str] = None,
    ) -> dict:
        """Request a structured JSON response. Schema is injected into the system prompt."""
        try:
            response = await self.client.chat.completions.create(
                model=model or self.model,
                messages=messages,
                temperature=0.3,  # lower temperature for structured output
                max_tokens=settings.max_tokens,
                response_format={"type": "json_object"},
                stream=False,
            )
            content = response.choices[0].message.content or "{}"
            return json.loads(content)
        except (APIError, json.JSONDecodeError) as e:
            return {"error": str(e)}

    # ------------------------------------------------------------------
    # Quick classification / short answer (uses fast model)
    # ------------------------------------------------------------------
    async def quick_judge(self, prompt: str) -> str:
        """Fast, low-cost single-turn answer — suitable for classification."""
        messages = [
            {"role": "system", "content": "你是一个高效的英语学习助手。请用简洁的语言回答。"},
            {"role": "user", "content": prompt},
        ]
        try:
            response = await self.client.chat.completions.create(
                model=self.fast_model,
                messages=messages,
                temperature=0.3,
                max_tokens=512,
                stream=False,
            )
            return response.choices[0].message.content or ""
        except APIError:
            return ""


# Singleton for reuse across the app
llm_client = LLMClient()
