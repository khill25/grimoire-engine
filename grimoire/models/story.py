"""Story model — top-level narrative container."""

from typing import Any

from pydantic import BaseModel


class Story(BaseModel):
    name: str
    description: str = ""
    tone: str = ""  # overall tone guidance
    worlds: list[str] = []  # world_ids
    extras: dict[str, Any] = {}
