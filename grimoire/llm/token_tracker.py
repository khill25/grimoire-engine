"""Token budget tracker — logs every LLM call."""

from __future__ import annotations

from grimoire.llm.provider import LLMCallRecord, LLMJob, LLMResponse, TokenUsage


class TokenTracker:
    """Accumulates LLM call records for cost tracking."""

    def __init__(self) -> None:
        self._records: list[LLMCallRecord] = []

    def record(
        self,
        provider: str,
        model: str,
        job: LLMJob,
        usage: TokenUsage,
        entity_id: str = "",
    ) -> None:
        self._records.append(LLMCallRecord(
            provider=provider,
            model=model,
            job=job,
            entity_id=entity_id,
            usage=usage,
        ))

    def record_response(
        self,
        provider_name: str,
        model_name: str,
        job: LLMJob,
        response: LLMResponse,
        entity_id: str = "",
    ) -> None:
        self.record(provider_name, model_name, job, response.usage, entity_id)

    @property
    def records(self) -> list[LLMCallRecord]:
        return list(self._records)

    @property
    def total_tokens(self) -> int:
        return sum(r.usage.total_tokens for r in self._records)

    def summary_by_job(self) -> dict[str, int]:
        totals: dict[str, int] = {}
        for r in self._records:
            totals[r.job] = totals.get(r.job, 0) + r.usage.total_tokens
        return totals
