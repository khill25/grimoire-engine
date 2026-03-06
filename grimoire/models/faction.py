"""Faction model — simplified for MVP."""

from typing import Any

from pydantic import BaseModel, Field


class Faction(BaseModel):
    id: str
    name: str
    description: str
    values: list[str] = []
    member_ids: list[str] = []
    reputation_with_player: float = Field(default=0.0, ge=-1.0, le=1.0)
    extras: dict[str, Any] = {}
