"""Tests for LLM provider interfaces and token tracking."""

from grimoire.llm.provider import LLMCallRecord, LLMJob, LLMResponse, TokenUsage
from grimoire.llm.token_tracker import TokenTracker


def test_token_usage():
    u = TokenUsage(prompt_tokens=10, completion_tokens=5, total_tokens=15)
    assert u.total_tokens == 15


def test_llm_response():
    r = LLMResponse(text="Hello", usage=TokenUsage(prompt_tokens=5, completion_tokens=2, total_tokens=7))
    assert r.text == "Hello"
    assert r.usage.total_tokens == 7


def test_llm_call_record():
    rec = LLMCallRecord(
        provider="ollama",
        model="llama3:32b",
        job=LLMJob.FREE_TEXT,
        entity_id="mira",
        usage=TokenUsage(prompt_tokens=100, completion_tokens=50, total_tokens=150),
    )
    assert rec.job == LLMJob.FREE_TEXT


def test_token_tracker():
    tracker = TokenTracker()
    assert tracker.total_tokens == 0

    tracker.record("ollama", "llama3:32b", LLMJob.FREE_TEXT,
                   TokenUsage(prompt_tokens=100, completion_tokens=50, total_tokens=150))
    tracker.record("ollama", "llama3:32b", LLMJob.AMBIENT_DIALOGUE,
                   TokenUsage(prompt_tokens=80, completion_tokens=30, total_tokens=110))
    tracker.record("ollama", "llama3:32b", LLMJob.FREE_TEXT,
                   TokenUsage(prompt_tokens=90, completion_tokens=40, total_tokens=130))

    assert tracker.total_tokens == 390
    assert len(tracker.records) == 3

    by_job = tracker.summary_by_job()
    assert by_job[LLMJob.FREE_TEXT] == 280
    assert by_job[LLMJob.AMBIENT_DIALOGUE] == 110


def test_token_tracker_record_response():
    tracker = TokenTracker()
    resp = LLMResponse(
        text="test",
        usage=TokenUsage(prompt_tokens=10, completion_tokens=5, total_tokens=15),
    )
    tracker.record_response("anthropic", "claude-3", LLMJob.DYNAMIC_NARRATION, resp, entity_id="bosk")
    assert tracker.total_tokens == 15
    assert tracker.records[0].entity_id == "bosk"
