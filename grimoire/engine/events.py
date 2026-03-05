"""Event creation and logging."""

from __future__ import annotations

import uuid

from grimoire.models.event import Event


def create_event(
    timestamp: int,
    type: str,
    summary: str,
    details: str = "",
    participants: list[str] | None = None,
    witnesses: list[str] | None = None,
    location: str = "",
    visibility: str = "local",
    tags: list[str] | None = None,
    severity: float = 0.0,
) -> Event:
    return Event(
        id=str(uuid.uuid4()),
        timestamp=timestamp,
        type=type,
        summary=summary,
        details=details,
        participants=participants or [],
        witnesses=witnesses or [],
        location=location,
        visibility=visibility,
        tags=tags or [],
        severity=severity,
    )


class EventLog:
    """Append-only in-memory event log. Backed by SQLite in production."""

    def __init__(self) -> None:
        self._events: list[Event] = []

    def append(self, event: Event) -> None:
        self._events.append(event)

    def query(
        self,
        location: str | None = None,
        participant: str | None = None,
        since_tick: int | None = None,
        tags: list[str] | None = None,
        limit: int = 50,
    ) -> list[Event]:
        results = self._events
        if location:
            results = [e for e in results if e.location == location]
        if participant:
            results = [e for e in results
                       if participant in e.participants or participant in e.witnesses]
        if since_tick is not None:
            results = [e for e in results if e.timestamp >= since_tick]
        if tags:
            tag_set = set(tags)
            results = [e for e in results if tag_set & set(e.tags)]
        return results[-limit:]

    @property
    def all_events(self) -> list[Event]:
        return list(self._events)

    def __len__(self) -> int:
        return len(self._events)
