"""Tests for the GameSession orchestrator."""

import asyncio
from pathlib import Path

import pytest

from grimoire.engine.game_state import PlayerAction
from grimoire.engine.session import GameSession
from grimoire.llm.provider import LLMResponse, TokenUsage
from grimoire.loader.world_loader import load_world

WORLD_PATH = str(Path(__file__).parent.parent / "world")


class MockLLM:
    """Mock LLM provider for testing — returns canned responses."""

    @property
    def provider_name(self) -> str:
        return "mock"

    @property
    def model_name(self) -> str:
        return "mock-1"

    async def generate(self, messages, system="", temperature=0.7,
                       max_tokens=1000, response_format=None) -> LLMResponse:
        return LLMResponse(
            text='{"dialogue": "Mock NPC response.", "action": null, '
                 '"emotion": "neutral", "internal": "thinking..."}',
            usage=TokenUsage(prompt_tokens=50, completion_tokens=20, total_tokens=70),
        )

    async def close(self):
        pass


class MockEmbedder:
    """Mock embedder that returns fixed vectors based on text hash."""

    def embed(self, text: str) -> list[float]:
        h = hash(text) % 1000
        return [float((h >> i) & 1) for i in range(8)]

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [self.embed(t) for t in texts]


def _make_session(llm=None, embedder=None) -> GameSession:
    world = load_world(WORLD_PATH)
    return GameSession(world, llm=llm, embedder=embedder, start_location="rusty_tap")


@pytest.fixture
def session():
    return _make_session()


@pytest.fixture
def session_with_llm():
    return _make_session(llm=MockLLM())


@pytest.fixture
def session_full():
    return _make_session(llm=MockLLM(), embedder=MockEmbedder())


# --- Basic session tests ---

def test_session_init(session):
    assert session.game_state.player_location == "rusty_tap"
    assert session.llm is None
    assert session.writer is None
    assert session.matcher is None


def test_session_with_llm(session_with_llm):
    assert session_with_llm.llm is not None
    assert session_with_llm.writer is not None


def test_session_full(session_full):
    assert session_full.matcher is not None
    # Embeddings should be precomputed
    for tree in session_full.world_data.dialogue_trees.values():
        for node in tree.nodes:
            for choice in node.choices:
                assert choice.embedding is not None


# --- Action tests ---

@pytest.mark.asyncio
async def test_session_move(session):
    result = await session.process_action(PlayerAction(type="move", target="dock_7"))
    assert session.game_state.player_location == "dock_7"
    assert result.narration


@pytest.mark.asyncio
async def test_session_interact_with_llm(session_with_llm):
    result = await session_with_llm.process_action(
        PlayerAction(type="interact", detail="examine the cargo containers"))
    assert result.narration  # Should be LLM-generated


# --- Dialogue tests ---

@pytest.mark.asyncio
async def test_session_dialogue_start(session):
    result = await session.start_dialogue("mira")
    assert result.speaker == "Mira Vasik"
    assert len(result.choices) > 0
    assert not result.is_ended


@pytest.mark.asyncio
async def test_session_dialogue_select(session):
    await session.start_dialogue("mira")
    result = await session.dialogue_input("mira", "just_a_drink")
    assert result.speaker == "Mira Vasik"
    assert result.matched_choice is not None


@pytest.mark.asyncio
async def test_session_dialogue_tree_traversal(session):
    await session.start_dialogue("mira")
    # Pick "just a drink"
    result = await session.dialogue_input("mira", "just_a_drink")
    assert "drink" in result.text.lower() or "glass" in result.text.lower() or "credit" in result.text.lower()


@pytest.mark.asyncio
async def test_session_dialogue_llm_fallback(session_with_llm):
    await session_with_llm.start_dialogue("mira")
    # Send something that won't match any choice
    result = await session_with_llm.dialogue_input(
        "mira", "Tell me about the quantum fluctuations in the docking array")
    # Should get an LLM response since node has llm_escape=True
    assert result.text
    assert result.writer_response is not None
    # Should still be in dialogue (returned to same node)
    assert not result.is_ended


@pytest.mark.asyncio
async def test_session_dialogue_no_tree_llm(session_with_llm):
    # Tam has no dialogue tree — should get pure LLM response
    # First move to dock_7 where Tam is
    await session_with_llm.process_action(PlayerAction(type="move", target="dock_7"))
    result = await session_with_llm.start_dialogue("tam")
    assert result.speaker == "Tam Sola"
    assert result.text  # LLM-generated


@pytest.mark.asyncio
async def test_session_dialogue_end(session):
    await session.start_dialogue("mira")
    assert session.get_active_dialogue("mira") is not None
    session.end_dialogue("mira")
    assert session.get_active_dialogue("mira") is None
    assert session.game_state.flags.get("met_mira") is True


@pytest.mark.asyncio
async def test_session_dialogue_not_present(session):
    # Bosk isn't at the rusty_tap at tick 0 (he's at dock_7)
    result = await session.start_dialogue("bosk")
    assert result.is_ended
    assert "isn't here" in result.text.lower() or "not here" in result.text.lower()


# --- Protection tests ---

def test_session_protection(session):
    allowed, narration = session.check_protection("mira")
    assert allowed is False
    assert narration  # Should have fallback text

    allowed, narration = session.check_protection("kael")
    assert allowed is True


@pytest.mark.asyncio
async def test_session_attack_protected_npc(session):
    """Attacking a protected NPC should be blocked with narration."""
    result = await session.process_action(
        PlayerAction(type="attack", target="mira"))
    assert "bar" in result.narration.lower() or "try harder" in result.narration.lower()
    # Mira should still be alive
    assert session.game_state.get_character("mira").status == "alive"
    # Event should be logged
    assert any("blocked" in e.tags for e in session.game_state.event_log.all_events)


@pytest.mark.asyncio
async def test_session_attack_unprotected_npc(session):
    """Attacking an unprotected NPC should go through."""
    # Move to dock_7 where Kael is
    await session.process_action(PlayerAction(type="move", target="dock_7"))
    result = await session.process_action(
        PlayerAction(type="attack", target="kael"))
    assert "attack" in result.narration.lower() or "kael" in result.narration.lower()
    assert any("attack" in e.tags and "blocked" not in e.tags
               for e in session.game_state.event_log.all_events)


@pytest.mark.asyncio
async def test_session_attack_soft_protected(session):
    """Attacking a soft-protected NPC should be blocked."""
    await session.process_action(PlayerAction(type="move", target="dock_7"))
    result = await session.process_action(
        PlayerAction(type="attack", target="bosk"))
    # Bosk has soft protection — should survive
    assert session.game_state.get_character("bosk").status == "alive"
    assert result.narration  # Should have fallback narration


# --- Token tracking ---

@pytest.mark.asyncio
async def test_session_token_tracking(session_with_llm):
    await session_with_llm.start_dialogue("mira")
    await session_with_llm.dialogue_input(
        "mira", "Tell me about something random")
    assert session_with_llm.tracker.total_tokens > 0
    assert len(session_with_llm.tracker.records) > 0
