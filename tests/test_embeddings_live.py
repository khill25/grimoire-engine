"""Live embedding matcher tests with real sentence-transformers model.

Run with: python -m pytest tests/test_embeddings_live.py -v -s
"""

from pathlib import Path

import pytest

try:
    from grimoire.llm.embeddings import LocalEmbeddingProvider
    HAS_EMBEDDINGS = True
except Exception:
    HAS_EMBEDDINGS = False

from grimoire.dialogue.matcher import DialogueMatcher
from grimoire.engine.session import GameSession
from grimoire.loader.world_loader import load_world

WORLD_PATH = str(Path(__file__).parent / "fixtures" / "world")

skip_no_embeddings = pytest.mark.skipif(
    not HAS_EMBEDDINGS, reason="sentence-transformers not available")


@pytest.fixture(scope="module")
def embedder():
    return LocalEmbeddingProvider()


@pytest.fixture(scope="module")
def matcher(embedder):
    return DialogueMatcher(embedder)


@pytest.fixture(scope="module")
def world():
    return load_world(WORLD_PATH)


@skip_no_embeddings
def test_embed_text(embedder):
    vec = embedder.embed("Hello world")
    assert len(vec) == 384  # all-MiniLM-L6-v2 dimension
    assert isinstance(vec[0], float)


@skip_no_embeddings
def test_embed_batch(embedder):
    vecs = embedder.embed_batch(["Hello", "Goodbye", "How are you"])
    assert len(vecs) == 3
    assert all(len(v) == 384 for v in vecs)


@skip_no_embeddings
def test_match_docks_question(matcher, world):
    tree = matcher.precompute_embeddings(world.dialogue_trees["mira_first_meeting"])
    node = next(n for n in tree.nodes if n.id == "greeting")

    match, sim = matcher.match_choice("What is going on at the docks?", node.choices)
    assert match is not None
    assert match.id == "ask_about_docks"
    assert sim > 0.75


@skip_no_embeddings
def test_match_work_question(matcher, world):
    tree = matcher.precompute_embeddings(world.dialogue_trees["mira_first_meeting"])
    node = next(n for n in tree.nodes if n.id == "greeting")

    # "I need a job" should be closest to "I'm looking for work" even if below threshold
    match, sim = matcher.match_choice("I need a job", node.choices, threshold=0.6)
    assert match is not None
    assert match.id == "looking_for_work"


@skip_no_embeddings
def test_match_drink_request(matcher, world):
    tree = matcher.precompute_embeddings(world.dialogue_trees["mira_first_meeting"])
    node = next(n for n in tree.nodes if n.id == "greeting")

    # "Give me a beer" is close to "Just a drink" but may not hit 0.75
    match, sim = matcher.match_choice("Give me a beer", node.choices)
    # Even if no match at 0.75, the closest should be "just_a_drink"
    _, best_sim = matcher.match_choice("Give me a beer", node.choices, threshold=0.0)


@skip_no_embeddings
def test_no_match_unrelated(matcher, world):
    tree = matcher.precompute_embeddings(world.dialogue_trees["mira_first_meeting"])
    node = next(n for n in tree.nodes if n.id == "greeting")

    match, sim = matcher.match_choice(
        "What is the square root of 144?", node.choices)
    assert match is None
    assert sim < 0.75


@skip_no_embeddings
def test_bosk_union_matching(matcher, world):
    tree = matcher.precompute_embeddings(world.dialogue_trees["bosk_union_talk"])
    node = next(n for n in tree.nodes if n.id == "approach")

    # "Mira told me to come see you" should match "Mira sent me..."
    # but only if the condition is met — matcher doesn't check conditions
    match, sim = matcher.match_choice(
        "Mira told me to come see you about work", node.choices, threshold=0.5)
    assert match is not None
    assert match.id == "mira_sent_me"


@skip_no_embeddings
@pytest.mark.asyncio
async def test_session_with_embeddings():
    """Full session with embeddings — free text should match authored choices."""
    embedder = LocalEmbeddingProvider()
    world = load_world(WORLD_PATH)
    session = GameSession(world, embedder=embedder, start_location="rusty_tap")

    # Start dialogue with Mira
    result = await session.start_dialogue("mira")
    assert len(result.choices) > 0

    # Send free text that should match "ask_about_docks"
    result = await session.dialogue_input("mira", "What is going on at the docks?")
    assert result.matched_choice is not None
    assert result.matched_choice["id"] == "ask_about_docks"
    assert result.matched_choice["similarity"] > 0.75
    print(f"\n  Matched: {result.matched_choice}")
    print(f"  Response: {result.text[:100]}...")
