"""Character model — full-tier, hand-authored for MVP."""

from typing import Any, Literal

from pydantic import BaseModel

from grimoire.models.common import Affinity, Goal, ProtectionLevel, Relationship, ScheduleEntry


class Character(BaseModel):
    id: str
    name: str
    age: int
    status: Literal["alive", "dead", "missing", "unknown"] = "alive"
    backstory: str  # prose, ~200 words
    personality: str  # prose sketch
    speech_style: str  # e.g. "terse and sarcastic", "formal, avoids contractions"
    motivations: list[str]  # 2-3 deep drivers
    goals: list[Goal] = []
    wants: list[str] = []  # immediate, mutable
    affinities: list[Affinity] = []
    occupation: str = ""
    location: str = ""  # place_id
    schedule: list[ScheduleEntry] = []
    relationships: list[Relationship] = []
    faction_ids: list[str] = []
    protection: ProtectionLevel = ProtectionLevel()
    extras: dict[str, Any] = {}
