"""Abstract LLM and embedding provider interfaces."""

from __future__ import annotations

from enum import Enum
from typing import Any, Protocol, runtime_checkable

from pydantic import BaseModel


class LLMJob(str, Enum):
    """The 6 LLM jobs — every call must be tagged with one."""
    FREE_TEXT = "free_text_interpretation"
    DYNAMIC_NARRATION = "dynamic_event_narration"
    AMBIENT_DIALOGUE = "ambient_npc_dialogue"
    SIDE_QUEST = "side_quest_generation"
    CONVERGENCE = "dialogue_convergence"
    EDGE_CASE = "edge_case_handling"


class TokenUsage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class LLMResponse(BaseModel):
    text: str
    raw: dict[str, Any] = {}
    usage: TokenUsage = TokenUsage()


class LLMCallRecord(BaseModel):
    """Logged for every LLM call — token budget tracking."""
    provider: str
    model: str
    job: LLMJob
    entity_id: str = ""
    usage: TokenUsage = TokenUsage()


@runtime_checkable
class LLMProvider(Protocol):
    async def generate(
        self,
        messages: list[dict[str, str]],
        system: str = "",
        temperature: float = 0.7,
        max_tokens: int = 1000,
        response_format: type | None = None,
    ) -> LLMResponse: ...

    @property
    def provider_name(self) -> str: ...

    @property
    def model_name(self) -> str: ...


@runtime_checkable
class EmbeddingProvider(Protocol):
    def embed(self, text: str) -> list[float]: ...
    def embed_batch(self, texts: list[str]) -> list[list[float]]: ...
