"""Live integration test against the Ollama instance.

Run with: python -m pytest tests/test_ollama_live.py -v -s
Requires Ollama running at 192.168.50.181:11434
"""

from pathlib import Path

import pytest
import httpx

from grimoire.engine.game_state import PlayerAction
from grimoire.engine.session import GameSession
from grimoire.llm.ollama import OllamaProvider, _strip_think_tags
from grimoire.loader.world_loader import load_world

WORLD_PATH = str(Path(__file__).parent / "fixtures" / "world")
OLLAMA_URL = "http://192.168.50.181:11434"


def ollama_available() -> bool:
    try:
        r = httpx.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        return r.status_code == 200
    except Exception:
        return False


skip_no_ollama = pytest.mark.skipif(
    not ollama_available(), reason="Ollama not available")


# --- Unit test for think tag stripping ---

def test_strip_think_tags():
    assert _strip_think_tags("<think>\nsome reasoning\n</think>\nHello!") == "Hello!"
    assert _strip_think_tags("No tags here") == "No tags here"
    assert _strip_think_tags("<think>short</think>Result") == "Result"
    assert _strip_think_tags("") == ""
    # Truncated think block (model hit token limit mid-thought)
    assert _strip_think_tags("<think>\nstill thinking...") == ""
    assert _strip_think_tags("<think>\nthinking\n</think>Answer\n<think>\nmore") == "Answer"


# --- Live Ollama tests ---

@skip_no_ollama
@pytest.mark.asyncio
async def test_ollama_json_via_thinking():
    """Test that the model thinks first, then outputs valid JSON."""
    llm = OllamaProvider()
    try:
        resp = await llm.generate(
            messages=[{"role": "user", "content": "Say hello."}],
            system='Respond in JSON: {"greeting": "..."}',
            max_tokens=500,
        )
        print(f"\n  Response: {resp.text}")
        print(f"  Tokens: {resp.usage.prompt_tokens} + {resp.usage.completion_tokens}")
        assert resp.text
        assert "<think>" not in resp.text  # Think tags should be stripped
        assert resp.usage.total_tokens > 0
        import json
        data = json.loads(resp.text)
        assert "greeting" in data
    finally:
        await llm.close()


@skip_no_ollama
@pytest.mark.asyncio
async def test_ollama_npc_response():
    """Test a full NPC-style response with thinking enabled."""
    llm = OllamaProvider()
    try:
        resp = await llm.generate(
            messages=[{"role": "user", "content": "What do you think about the weather?"}],
            system='You are a gruff bartender. Respond in JSON: {"dialogue": "...", "emotion": "..."}',
            max_tokens=500,
        )
        print(f"\n  Response: {resp.text}")
        print(f"  Tokens: {resp.usage.prompt_tokens} + {resp.usage.completion_tokens}")
        assert resp.text
        import json
        data = json.loads(resp.text)
        assert "dialogue" in data
        print(f"  Dialogue: {data['dialogue']}")
        print(f"  Emotion: {data.get('emotion', 'n/a')}")
    finally:
        await llm.close()


@skip_no_ollama
@pytest.mark.asyncio
async def test_session_dialogue_with_llm():
    """Test full dialogue flow with live LLM — authored tree + LLM fallback."""
    llm = OllamaProvider()
    try:
        world = load_world(WORLD_PATH)
        session = GameSession(world, llm=llm, start_location="rusty_tap")

        # Start dialogue with Mira (has authored tree)
        result = await session.start_dialogue("mira")
        print(f"\n  MIRA: {result.text.strip()}")
        assert result.speaker == "Mira Vasik"
        assert len(result.choices) > 0
        print(f"  Choices: {[c['text'] for c in result.choices]}")

        # Select an authored choice
        result = await session.dialogue_input("mira", "ask_about_docks")
        print(f"\n  MIRA: {result.text.strip()}")
        assert result.text

        # Now send free text that won't match — should get LLM response
        result = await session.dialogue_input(
            "mira", "Have you ever thought about leaving this station?")
        print(f"\n  [LLM fallback] MIRA: {result.text.strip()}")
        if result.writer_response:
            print(f"  Emotion: {result.writer_response.emotion}")
            print(f"  Internal: {result.writer_response.internal}")
        assert result.text
        # Should still be in dialogue (returned to same node)
        assert not result.is_ended

        print(f"\n  Tokens used: {session.tracker.total_tokens}")
        print(f"  By job: {session.tracker.summary_by_job()}")
    finally:
        await llm.close()


@skip_no_ollama
@pytest.mark.asyncio
async def test_session_no_tree_character():
    """Test LLM dialogue with a character that has no authored tree."""
    llm = OllamaProvider()
    try:
        world = load_world(WORLD_PATH)
        session = GameSession(world, llm=llm, start_location="dock_7")

        # Tam has no dialogue tree
        result = await session.start_dialogue("tam")
        print(f"\n  TAM: {result.text.strip()}")
        assert result.speaker == "Tam Sola"
        assert result.text
        if result.writer_response:
            print(f"  Emotion: {result.writer_response.emotion}")
    finally:
        await llm.close()


@skip_no_ollama
@pytest.mark.asyncio
async def test_session_narrated_interact():
    """Test LLM-narrated interaction."""
    llm = OllamaProvider()
    try:
        world = load_world(WORLD_PATH)
        session = GameSession(world, llm=llm, start_location="rusty_tap")

        result = await session.process_action(
            PlayerAction(type="interact", detail="examine the old photo behind the bar"))
        print(f"\n  Narration: {result.narration}")
        assert result.narration
    finally:
        await llm.close()
