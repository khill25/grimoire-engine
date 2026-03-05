"""Ollama LLM provider — primary local inference."""

from __future__ import annotations

import re

import httpx

from grimoire.llm.provider import LLMResponse, TokenUsage


def _strip_think_tags(text: str) -> str:
    """Strip <think>...</think> blocks from thinking models like Qwen3.

    Handles both complete (<think>...</think>) and truncated (<think>... with
    no closing tag, which happens when the model hits the token limit mid-thought).
    """
    # Strip complete think blocks
    text = re.sub(r"<think>.*?</think>\s*", "", text, flags=re.DOTALL)
    # Strip truncated think blocks (no closing tag — model hit token limit)
    text = re.sub(r"<think>.*$", "", text, flags=re.DOTALL)
    return text.strip()


class OllamaProvider:
    def __init__(self, model: str = "hf.co/unsloth/Qwen3-30B-A3B-GGUF:Q4_K_M",
                 base_url: str = "http://192.168.50.181:11434"):
        self._model = model
        self._base_url = base_url
        self._client = httpx.AsyncClient(base_url=base_url, timeout=120.0)

    @property
    def provider_name(self) -> str:
        return "ollama"

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
        payload: dict = {
            "model": self._model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }
        if system:
            payload["messages"] = [{"role": "system", "content": system}] + messages
        # Don't force format:json — let thinking models think first.
        # JSON structure is requested in the system prompt instead.

        resp = await self._client.post("/api/chat", json=payload)
        resp.raise_for_status()
        data = resp.json()

        text = data.get("message", {}).get("content", "")
        text = _strip_think_tags(text)

        usage = TokenUsage(
            prompt_tokens=data.get("prompt_eval_count", 0),
            completion_tokens=data.get("eval_count", 0),
            total_tokens=data.get("prompt_eval_count", 0) + data.get("eval_count", 0),
        )
        return LLMResponse(text=text, raw=data, usage=usage)

    async def close(self) -> None:
        await self._client.aclose()
