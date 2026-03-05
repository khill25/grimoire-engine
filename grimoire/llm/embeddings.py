"""Local embedding provider using sentence-transformers (all-MiniLM-L6-v2)."""

from __future__ import annotations

from sentence_transformers import SentenceTransformer


class LocalEmbeddingProvider:
    """Wraps all-MiniLM-L6-v2 for local CPU embedding."""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self._model = SentenceTransformer(model_name)

    def embed(self, text: str) -> list[float]:
        return self._model.encode(text, convert_to_numpy=True).tolist()

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        embeddings = self._model.encode(texts, convert_to_numpy=True)
        return [e.tolist() for e in embeddings]
