"""Shared types used across multiple models."""

from typing import Literal

from pydantic import BaseModel, Field


class Goal(BaseModel):
    id: str
    description: str
    motivation: str  # which motivation this serves
    status: Literal["active", "completed", "failed", "abandoned"] = "active"
    progress: str = ""


class Affinity(BaseModel):
    target: str  # topic, trait, or entity_id
    score: float = Field(ge=-1.0, le=1.0)
    reason: str = ""


class Relationship(BaseModel):
    target_id: str  # character_id
    types: list[str]  # friend, rival, spouse, employer, etc.
    trust: float = Field(default=0.0, ge=-1.0, le=1.0)
    familiarity: float = Field(default=0.0, ge=0.0, le=1.0)
    disposition: float = Field(default=0.0, ge=-1.0, le=1.0)
    history: str = ""  # compressed narrative


class ScheduleEntry(BaseModel):
    time_start: int  # tick of day
    time_end: int
    location: str  # place_id
    activity: str
    interruptible: bool = True


class ProtectionLevel(BaseModel):
    level: Literal["none", "soft", "hard", "immortal"] = "none"
    reason: str = ""
    fallback: str = ""  # what happens on kill attempt


class GameTime(BaseModel):
    tick: int = 0
    ticks_per_hour: int = 1
    hours_per_day: int = 24

    @property
    def hour(self) -> int:
        return (self.tick // self.ticks_per_hour) % self.hours_per_day

    @property
    def day(self) -> int:
        return self.tick // (self.ticks_per_hour * self.hours_per_day)
