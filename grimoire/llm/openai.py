"""OpenAI LLM provider — cloud fallback."""

from __future__ import annotations

import os

import httpx

from grimoire.llm.provider import LLMResponse, TokenUsage


class OpenAIProvider:
    def __init__(self, model: str = "gpt-4o", api_key: str | None = None):
        self._model = model
        self._api_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        self._client = httpx.AsyncClient(
            base_url="https://api.openai.com",
            timeout=120.0,
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
        )

    @property
    def provider_name(self) -> str:
        return "openai"

    @property
    def model_name(self) -> str:
        return self._model

    async def generate(
        self,
        messages: list[dict[str, str]],
        system: str = "",
        temperature: float = 0.7,
        max_tokens: int = 1000,
        response_format: type | None = None,
    ) -> LLMResponse:
        all_messages = messages.copy()
        if system:
            all_messages = [{"role": "system", "content": system}] + all_messages

        payload: dict = {
            "model": self._model,
            "messages": all_messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if response_format is not None:
            payload["response_format"] = {"type": "json_object"}

        resp = await self._client.post("/v1/chat/completions", json=payload)
        resp.raise_for_status()
        data = resp.json()

        text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        usage_data = data.get("usage", {})
        usage = TokenUsage(
            prompt_tokens=usage_data.get("prompt_tokens", 0),
            completion_tokens=usage_data.get("completion_tokens", 0),
            total_tokens=usage_data.get("total_tokens", 0),
        )
        return LLMResponse(text=text, raw=data, usage=usage)

    async def close(self) -> None:
        await self._client.aclose()
