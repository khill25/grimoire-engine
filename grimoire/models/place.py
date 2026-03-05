"""Place model — locations in the game world."""

from pydantic import BaseModel


class Place(BaseModel):
    id: str
    name: str
    type: str  # bar, docking_bay, residence, etc.
    description: str
    current_state: str = ""
    connections: list[str] = []  # place_ids
    region: str = ""
    default_npcs: list[str] = []  # character_ids
    current_npcs: list[str] = []
    is_public: bool = True
    owner: str = ""  # character_id or faction_id
    atmosphere: str = ""
