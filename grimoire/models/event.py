"""Event model — append-only event log entries."""

from typing import Literal

from pydantic import BaseModel, Field


class Event(BaseModel):
    id: str
    timestamp: int  # game tick
    type: Literal["interaction", "observation", "world_change", "off_screen", "system"]
    summary: str
    details: str = ""
    participants: list[str] = []  # character_ids
    witnesses: list[str] = []
    location: str = ""  # place_id
    visibility: Literal["private", "local", "regional", "global"] = "local"
    tags: list[str] = []
    severity: float = Field(default=0.0, ge=0.0, le=1.0)
