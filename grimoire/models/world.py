"""World model — container for world-level metadata."""

from typing import Any

from pydantic import BaseModel


class World(BaseModel):
    id: str
    name: str
    type: str = ""
    description: str = ""
    tone: str = ""
    time_config: dict[str, Any] = {}  # ticks_per_hour, hours_per_day, etc.
    extras: dict[str, Any] = {}
