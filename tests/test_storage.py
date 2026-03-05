"""Tests for SQLite database and ChromaDB vector store."""

import pytest

from grimoire.models.event import Event
from grimoire.storage.database import Database
from grimoire.storage.vector_store import VectorStore


# --- Database tests ---

@pytest.fixture
async def db():
    database = Database(":memory:")
    await database.connect()
    yield database
    await database.close()


def _make_event(**overrides) -> Event:
    defaults = {
        "id": "evt_001",
        "timestamp": 5,
        "type": "interaction",
        "summary": "Player talked to Mira",
        "details": "A brief conversation at the bar.",
        "participants": ["mira"],
        "witnesses": [],
        "location": "rusty_tap",
        "visibility": "local",
        "tags": ["dialogue"],
        "severity": 0.3,
    }
    defaults.update(overrides)
    return Event(**defaults)


@pytest.mark.asyncio
async def test_db_insert_and_query(db):
    event = _make_event()
    await db.insert_event(event)

    results = await db.query_events()
    assert len(results) == 1
    assert results[0].id == "evt_001"
    assert results[0].summary == "Player talked to Mira"
    assert "mira" in results[0].participants


@pytest.mark.asyncio
async def test_db_query_by_location(db):
    await db.insert_event(_make_event(id="evt_loc1", location="rusty_tap"))
    await db.insert_event(_make_event(id="evt_loc2", location="dock_7"))

    results = await db.query_events(location="rusty_tap")
    assert len(results) == 1
    assert results[0].location == "rusty_tap"


@pytest.mark.asyncio
async def test_db_query_since_tick(db):
    await db.insert_event(_make_event(id="evt_t1", timestamp=3))
    await db.insert_event(_make_event(id="evt_t2", timestamp=10))

    results = await db.query_events(since_tick=5)
    assert len(results) == 1
    assert results[0].timestamp == 10


@pytest.mark.asyncio
async def test_db_query_by_participant(db):
    await db.insert_event(_make_event(id="evt_p1", participants=["mira"]))
    await db.insert_event(_make_event(id="evt_p2", participants=["bosk"]))

    results = await db.query_events(participant="bosk")
    assert len(results) == 1
    assert "bosk" in results[0].participants


@pytest.mark.asyncio
async def test_db_query_by_tags(db):
    await db.insert_event(_make_event(id="evt_tag1", tags=["dialogue", "quest"]))
    await db.insert_event(_make_event(id="evt_tag2", tags=["combat"]))

    results = await db.query_events(tags=["quest"])
    assert len(results) == 1
    assert "quest" in results[0].tags


@pytest.mark.asyncio
async def test_db_flags(db):
    await db.save_flags({"met_mira": True, "quest_started": "cargo"})
    flags = await db.load_flags()
    assert flags["met_mira"] is True
    assert flags["quest_started"] == "cargo"


@pytest.mark.asyncio
async def test_db_flags_overwrite(db):
    await db.save_flags({"old_flag": True})
    await db.save_flags({"new_flag": "value"})
    flags = await db.load_flags()
    assert "old_flag" not in flags
    assert flags["new_flag"] == "value"


@pytest.mark.asyncio
async def test_db_upsert_event(db):
    await db.insert_event(_make_event(id="evt_dup", summary="first"))
    await db.insert_event(_make_event(id="evt_dup", summary="updated"))

    results = await db.query_events()
    assert len(results) == 1
    assert results[0].summary == "updated"


# --- VectorStore tests ---

class MockEmbedder:
    def embed(self, text: str) -> list[float]:
        h = hash(text) % 1000
        return [float((h >> i) & 1) for i in range(8)]

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        return [self.embed(t) for t in texts]


def test_vector_store_init(tmp_path):
    vs = VectorStore(persist_directory=str(tmp_path / "chroma"))
    assert vs.event_count == 0
    assert vs.conversation_count == 0


def test_vector_store_add_event(tmp_path):
    vs = VectorStore(embedder=MockEmbedder(), persist_directory=str(tmp_path / "chroma"))
    event = _make_event()
    vs.add_event(event)
    assert vs.event_count == 1


def test_vector_store_query_events(tmp_path):
    vs = VectorStore(embedder=MockEmbedder(), persist_directory=str(tmp_path / "chroma"))
    vs.add_event(_make_event(id="evt_q1", summary="Player fought a pirate"))
    vs.add_event(_make_event(id="evt_q2", summary="Player bought a drink at the bar"))

    results = vs.query_events("combat with pirates", n_results=2)
    assert len(results) == 2
    assert all("id" in r for r in results)
    assert all("text" in r for r in results)
    assert all("similarity" in r for r in results)


def test_vector_store_add_conversation(tmp_path):
    vs = VectorStore(embedder=MockEmbedder(), persist_directory=str(tmp_path / "chroma"))
    vs.add_conversation_summary("conv_001", "mira", "Discussed cargo theft", tick=5)
    assert vs.conversation_count == 1


def test_vector_store_query_conversations(tmp_path):
    vs = VectorStore(embedder=MockEmbedder(), persist_directory=str(tmp_path / "chroma"))
    vs.add_conversation_summary("conv_001", "mira", "Discussed cargo theft", tick=5)
    vs.add_conversation_summary("conv_002", "bosk", "Talked about union dues", tick=8)

    results = vs.query_conversations("stealing cargo")
    assert len(results) >= 1
    assert all("text" in r for r in results)


def test_vector_store_query_by_character(tmp_path):
    vs = VectorStore(embedder=MockEmbedder(), persist_directory=str(tmp_path / "chroma"))
    vs.add_conversation_summary("conv_001", "mira", "Discussed cargo", tick=5)
    vs.add_conversation_summary("conv_002", "bosk", "Union business", tick=8)

    results = vs.query_conversations("cargo", character_id="mira")
    assert all(r.get("character_id") == "mira" for r in results)


def test_vector_store_no_embedder(tmp_path):
    """VectorStore should work without an embedder (uses ChromaDB's default)."""
    vs = VectorStore(persist_directory=str(tmp_path / "chroma"))
    event = _make_event(id="evt_no_embed")
    vs.add_event(event)
    assert vs.event_count == 1
