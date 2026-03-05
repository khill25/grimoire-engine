"""Free-text to authored dialogue branch matching via embeddings."""

from __future__ import annotations

import math

from grimoire.llm.provider import EmbeddingProvider
from grimoire.models.dialogue import DialogueChoice, DialogueTree


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


class DialogueMatcher:
    """Matches free-text player input to authored dialogue choices."""

    def __init__(self, embedding_provider: EmbeddingProvider):
        self._embedder = embedding_provider

    def embed_text(self, text: str) -> list[float]:
        return self._embedder.embed(text)

    def match_choice(
        self,
        player_input: str,
        available_choices: list[DialogueChoice],
        threshold: float = 0.75,
    ) -> tuple[DialogueChoice | None, float]:
        """Compare player input to authored choices.

        Returns (best_match, similarity) if above threshold, else (None, best_sim).
        """
        if not available_choices:
            return None, 0.0

        input_embedding = self.embed_text(player_input)

        best_choice: DialogueChoice | None = None
        best_sim = 0.0

        for choice in available_choices:
            if choice.embedding is None:
                choice_emb = self.embed_text(choice.text)
            else:
                choice_emb = choice.embedding

            sim = _cosine_similarity(input_embedding, choice_emb)
            if sim > best_sim:
                best_sim = sim
                best_choice = choice

        if best_sim >= threshold:
            return best_choice, best_sim
        return None, best_sim

    def precompute_embeddings(self, tree: DialogueTree) -> DialogueTree:
        """Precompute embeddings for all choices in a dialogue tree.

        Returns a new tree with embeddings populated.
        """
        texts = []
        indices: list[tuple[int, int]] = []  # (node_idx, choice_idx)

        for ni, node in enumerate(tree.nodes):
            for ci, choice in enumerate(node.choices):
                if choice.embedding is None:
                    texts.append(choice.text)
                    indices.append((ni, ci))

        if not texts:
            return tree

        embeddings = self._embedder.embed_batch(texts)

        # Build updated tree
        nodes = [n.model_copy(deep=True) for n in tree.nodes]
        for (ni, ci), emb in zip(indices, embeddings):
            nodes[ni].choices[ci].embedding = emb

        return tree.model_copy(update={"nodes": nodes})
