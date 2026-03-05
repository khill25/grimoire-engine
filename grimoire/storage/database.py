"""SQLite storage for events and game state via aiosqlite."""

from __future__ import annotations

import json
from pathlib import Path

import aiosqlite

from grimoire.models.event import Event


class Database:
    """Async SQLite database for persistent event storage."""

    def __init__(self, db_path: str = ":memory:"):
        self._db_path = db_path
        self._db: aiosqlite.Connection | None = None

    async def connect(self) -> None:
        if self._db_path != ":memory:":
            Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
        self._db = await aiosqlite.connect(self._db_path)
        await self._db.execute("PRAGMA journal_mode=WAL")
        await self._create_tables()

    async def close(self) -> None:
        if self._db:
            await self._db.close()
            self._db = None

    async def _create_tables(self) -> None:
        await self._db.executescript("""
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                timestamp INTEGER NOT NULL,
                type TEXT NOT NULL,
                summary TEXT NOT NULL,
                details TEXT DEFAULT '',
                participants TEXT DEFAULT '[]',
                witnesses TEXT DEFAULT '[]',
                location TEXT DEFAULT '',
                visibility TEXT DEFAULT 'local',
                tags TEXT DEFAULT '[]',
                severity REAL DEFAULT 0.0
            );
            CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
            CREATE INDEX IF NOT EXISTS idx_events_location ON events(location);

            CREATE TABLE IF NOT EXISTS game_flags (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        """)
        await self._db.commit()

    async def insert_event(self, event: Event) -> None:
        await self._db.execute(
            """INSERT OR REPLACE INTO events
               (id, timestamp, type, summary, details, participants, witnesses,
                location, visibility, tags, severity)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (event.id, event.timestamp, event.type, event.summary, event.details,
             json.dumps(event.participants), json.dumps(event.witnesses),
             event.location, event.visibility, json.dumps(event.tags), event.severity),
        )
        await self._db.commit()

    async def query_events(
        self,
        location: str | None = None,
        participant: str | None = None,
        since_tick: int | None = None,
        tags: list[str] | None = None,
        limit: int = 50,
    ) -> list[Event]:
        conditions = []
        params: list = []

        if location:
            conditions.append("location = ?")
            params.append(location)
        if since_tick is not None:
            conditions.append("timestamp >= ?")
            params.append(since_tick)

        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        query = f"SELECT * FROM events {where} ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)

        async with self._db.execute(query, params) as cursor:
            rows = await cursor.fetchall()

        events = []
        for row in rows:
            event = Event(
                id=row[0], timestamp=row[1], type=row[2], summary=row[3],
                details=row[4], participants=json.loads(row[5]),
                witnesses=json.loads(row[6]), location=row[7],
                visibility=row[8], tags=json.loads(row[9]), severity=row[10],
            )
            # Post-filter by participant and tags (JSON fields)
            if participant and participant not in event.participants and participant not in event.witnesses:
                continue
            if tags and not set(tags) & set(event.tags):
                continue
            events.append(event)

        events.reverse()  # Return in chronological order
        return events

    async def get_all_events(self) -> list[Event]:
        return await self.query_events(limit=10000)

    async def save_flags(self, flags: dict) -> None:
        await self._db.execute("DELETE FROM game_flags")
        for key, value in flags.items():
            await self._db.execute(
                "INSERT INTO game_flags (key, value) VALUES (?, ?)",
                (key, json.dumps(value)),
            )
        await self._db.commit()

    async def load_flags(self) -> dict:
        flags = {}
        async with self._db.execute("SELECT key, value FROM game_flags") as cursor:
            async for row in cursor:
                flags[row[0]] = json.loads(row[1])
        return flags
