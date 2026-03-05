"""NPC schedule processing — move NPCs based on time of day."""

from __future__ import annotations

from grimoire.models.character import Character
from grimoire.models.common import GameTime


def get_scheduled_location(character: Character, time: GameTime) -> str | None:
    """Return where a character should be based on their schedule and current hour.

    Returns None if no schedule entry covers the current hour.
    Schedule entries can wrap around midnight (e.g. time_start=22, time_end=6).
    """
    hour = time.hour
    for entry in character.schedule:
        if entry.time_start <= entry.time_end:
            # Normal range (e.g. 6 to 14)
            if entry.time_start <= hour < entry.time_end:
                return entry.location
        else:
            # Wraps midnight (e.g. 22 to 6)
            if hour >= entry.time_start or hour < entry.time_end:
                return entry.location
    return None


def is_interruptible(character: Character, time: GameTime) -> bool:
    """Check if a character can be interrupted at the current time."""
    hour = time.hour
    for entry in character.schedule:
        if entry.time_start <= entry.time_end:
            if entry.time_start <= hour < entry.time_end:
                return entry.interruptible
        else:
            if hour >= entry.time_start or hour < entry.time_end:
                return entry.interruptible
    return True  # Default to interruptible if no schedule
