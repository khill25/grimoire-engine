"""ChromaDB wrapper for vector storage — dialogue matching, event retrieval."""

from __future__ import annotations

from typing import Any

import chromadb

from grimoire.llm.provider import EmbeddingProvider
from grimoire.models.event import Event


class VectorStore:
    """ChromaDB-backed vector store for semantic search."""

    def __init__(self, embedder: EmbeddingProvider | None = None,
                 persist_directory: str | None = None):
        if persist_directory:
            self._client = chromadb.PersistentClient(path=persist_directory)
        else:
            self._client = chromadb.EphemeralClient()
        self._embedder = embedder

        # Collections
        self._events = self._client.get_or_create_collection(
            name="events",
            metadata={"hnsw:space": "cosine"},
        )
        self._conversations = self._client.get_or_create_collection(
            name="conversations",
            metadata={"hnsw:space": "cosine"},
        )

    def add_event(self, event: Event) -> None:
        """Embed and store an event for contextual retrieval."""
        text = f"{event.summary}. {event.details}" if event.details else event.summary
        embedding = self._embedder.embed(text) if self._embedder else None

        kwargs: dict[str, Any] = {
            "ids": [event.id],
            "documents": [text],
            "metadatas": [{
                "timestamp": event.timestamp,
                "type": event.type,
                "location": event.location,
                "visibility": event.visibility,
                "severity": event.severity,
                "participants": ",".join(event.participants),
                "tags": ",".join(event.tags),
            }],
        }
        if embedding:
            kwargs["embeddings"] = [embedding]

        self._events.add(**kwargs)

    def query_events(
        self,
        query_text: str,
        n_results: int = 5,
        location: str | None = None,
        min_severity: float = 0.0,
    ) -> list[dict]:
        """Find events semantically similar to query text."""
        where_filters = {}
        if location:
            where_filters["location"] = location
        if min_severity > 0:
            where_filters["severity"] = {"$gte": min_severity}

        kwargs: dict[str, Any] = {
            "query_texts": [query_text],
            "n_results": n_results,
        }
        if where_filters:
            kwargs["where"] = where_filters

        if self._embedder:
            embedding = self._embedder.embed(query_text)
            kwargs["query_embeddings"] = [embedding]
            del kwargs["query_texts"]

        try:
            results = self._events.query(**kwargs)
        except Exception:
            return []

        events = []
        if results and results["documents"]:
            for i, doc in enumerate(results["documents"][0]):
                meta = results["metadatas"][0][i] if results["metadatas"] else {}
                distance = results["distances"][0][i] if results["distances"] else 0
                events.append({
                    "id": results["ids"][0][i],
                    "text": doc,
                    "similarity": 1 - distance,  # cosine distance to similarity
                    **meta,
                })
        return events

    def add_conversation_summary(
        self,
        conversation_id: str,
        character_id: str,
        summary: str,
        tick: int,
    ) -> None:
        """Store an LLM-compressed conversation summary."""
        embedding = self._embedder.embed(summary) if self._embedder else None

        kwargs: dict[str, Any] = {
            "ids": [conversation_id],
            "documents": [summary],
            "metadatas": [{
                "character_id": character_id,
                "tick": tick,
            }],
        }
        if embedding:
            kwargs["embeddings"] = [embedding]

        self._conversations.add(**kwargs)

    def query_conversations(
        self,
        query_text: str,
        character_id: str | None = None,
        n_results: int = 3,
    ) -> list[dict]:
        """Find conversation summaries relevant to a query."""
        kwargs: dict[str, Any] = {
            "query_texts": [query_text],
            "n_results": n_results,
        }
        if character_id:
            kwargs["where"] = {"character_id": character_id}

        if self._embedder:
            embedding = self._embedder.embed(query_text)
            kwargs["query_embeddings"] = [embedding]
            del kwargs["query_texts"]

        try:
            results = self._conversations.query(**kwargs)
        except Exception:
            return []

        convos = []
        if results and results["documents"]:
            for i, doc in enumerate(results["documents"][0]):
                meta = results["metadatas"][0][i] if results["metadatas"] else {}
                convos.append({
                    "id": results["ids"][0][i],
                    "text": doc,
                    **meta,
                })
        return convos

    @property
    def event_count(self) -> int:
        return self._events.count()

    @property
    def conversation_count(self) -> int:
        return self._conversations.count()
