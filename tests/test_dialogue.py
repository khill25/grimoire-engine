"""Tests for dialogue matching and tree traversal."""

from __future__ import annotations

from grimoire.dialogue.matcher import DialogueMatcher, _cosine_similarity
from grimoire.dialogue.tree_runner import DialogueState
from grimoire.models.dialogue import DialogueChoice, DialogueNode, DialogueTree


# --- Tree runner tests ---

def _make_tree() -> DialogueTree:
    return DialogueTree(
        id="test_tree",
        character_id="npc1",
        context="test",
        root_node="start",
        nodes=[
            DialogueNode(
                id="start",
                speaker="npc1",
                text="Hello traveler.",
                state_changes={"met_npc": True},
                choices=[
                    DialogueChoice(id="c_friendly", text="Hello!", next_node="friendly"),
                    DialogueChoice(id="c_hostile", text="Get lost.", next_node="hostile"),
                    DialogueChoice(
                        id="c_conditional",
                        text="I know your secret.",
                        next_node="secret",
                        condition="has_intel == true",
                    ),
                ],
            ),
            DialogueNode(
                id="friendly",
                speaker="npc1",
                text="Welcome! Let me help you.",
                state_changes={"npc_friendly": True},
                choices=[],
            ),
            DialogueNode(
                id="hostile",
                speaker="npc1",
                text="Fine. Leave.",
                choices=[],
            ),
            DialogueNode(
                id="secret",
                speaker="npc1",
                text="How did you find out?!",
                state_changes={"secret_revealed": True},
                choices=[],
            ),
        ],
    )


def test_tree_runner_initial_state():
    state = DialogueState(_make_tree())
    assert state.current_node_id == "start"
    assert not state.is_ended
    assert state.current_node.text == "Hello traveler."


def test_tree_runner_available_choices():
    state = DialogueState(_make_tree())
    choices = state.get_available_choices()
    # Conditional choice should be filtered out (no flag set)
    assert len(choices) == 2
    assert {c.id for c in choices} == {"c_friendly", "c_hostile"}


def test_tree_runner_conditional_choice():
    state = DialogueState(_make_tree(), flags={"has_intel": True})
    choices = state.get_available_choices()
    assert len(choices) == 3
    assert "c_conditional" in {c.id for c in choices}


def test_tree_runner_select_choice():
    state = DialogueState(_make_tree())
    node = state.select_choice("c_friendly")
    assert node is not None
    assert node.id == "friendly"
    assert state.is_ended
    assert state.flags.get("met_npc") is True
    assert state.flags.get("npc_friendly") is True


def test_tree_runner_select_invalid():
    state = DialogueState(_make_tree())
    assert state.select_choice("nonexistent") is None
    assert state.current_node_id == "start"


def test_tree_runner_conditional_blocked():
    state = DialogueState(_make_tree())
    # Try to select conditional choice without flag
    assert state.select_choice("c_conditional") is None


def test_tree_runner_state_changes():
    state = DialogueState(_make_tree(), flags={"has_intel": True})
    state.select_choice("c_conditional")
    assert state.flags.get("met_npc") is True
    assert state.flags.get("secret_revealed") is True


def test_tree_runner_history():
    state = DialogueState(_make_tree())
    state.select_choice("c_friendly")
    assert state.history == ["start"]


# --- Matcher tests (unit, no model needed) ---

def test_cosine_similarity_identical():
    v = [1.0, 0.0, 0.0]
    assert abs(_cosine_similarity(v, v) - 1.0) < 1e-6


def test_cosine_similarity_orthogonal():
    a = [1.0, 0.0, 0.0]
    b = [0.0, 1.0, 0.0]
    assert abs(_cosine_similarity(a, b)) < 1e-6


def test_cosine_similarity_opposite():
    a = [1.0, 0.0]
    b = [-1.0, 0.0]
    assert abs(_cosine_similarity(a, b) - (-1.0)) < 1e-6


def test_cosine_similarity_zero_vector():
    a = [0.0, 0.0]
    b = [1.0, 1.0]
    assert _cosine_similarity(a, b) == 0.0


class FakeEmbedder:
    """Deterministic embedder for testing — maps text to a fixed-size vector."""
    def embed(self, text: str) -> list[float]:
        # Simple hash-based embedding for testing
        h = hash(text) % 1000
        return [float((h >> i) & 1) for i in range(8)]

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [self.embed(t) for t in texts]


def test_matcher_with_precomputed():
    embedder = FakeEmbedder()
    matcher = DialogueMatcher(embedder)

    choices = [
        DialogueChoice(
            id="c1",
            text="Hello",
            next_node="n1",
            embedding=embedder.embed("Hello"),
        ),
        DialogueChoice(
            id="c2",
            text="Goodbye",
            next_node="n2",
            embedding=embedder.embed("Goodbye"),
        ),
    ]

    # Exact match should return the matching choice
    match, sim = matcher.match_choice("Hello", choices, threshold=0.5)
    assert match is not None
    assert match.id == "c1"
    assert sim >= 0.5


def test_matcher_no_match():
    embedder = FakeEmbedder()
    matcher = DialogueMatcher(embedder)

    choices = [
        DialogueChoice(
            id="c1",
            text="Hello",
            next_node="n1",
            embedding=embedder.embed("Hello"),
        ),
    ]

    # With threshold=1.0, only exact embedding match works
    match, sim = matcher.match_choice("completely different text", choices, threshold=1.0)
    # May or may not match depending on hash collisions, but we test the interface works
    assert match is None or sim >= 1.0


def test_matcher_precompute_embeddings():
    embedder = FakeEmbedder()
    matcher = DialogueMatcher(embedder)

    tree = _make_tree()
    # No embeddings initially
    assert all(c.embedding is None for n in tree.nodes for c in n.choices)

    updated = matcher.precompute_embeddings(tree)
    # All choices should have embeddings now
    for node in updated.nodes:
        for choice in node.choices:
            assert choice.embedding is not None
            assert len(choice.embedding) == 8

    # Original tree should be unchanged
    assert all(c.embedding is None for n in tree.nodes for c in n.choices)
