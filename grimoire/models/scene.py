"""Scene model — sub-locations within a place."""

from typing import Any

from pydantic import BaseModel


class Scene(BaseModel):
    id: str
    name: str
    place_id: str  # parent place reference
    type: str = ""
    description: str = ""
    current_state: str = ""
    default_npcs: list[str] = []  # character_ids
    current_npcs: list[str] = []
    connections: list[str] = []  # sibling scene_ids within same place
    atmosphere: str = ""
    is_public: bool = True
    owner: str = ""  # character_id or faction_id
    extras: dict[str, Any] = {}
