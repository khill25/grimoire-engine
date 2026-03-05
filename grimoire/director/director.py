"""Director — beat tracking, trigger evaluation, deadlines."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel

from grimoire.models.event import Event


class StoryBeat(BaseModel):
    id: str
    name: str
    description: str
    trigger_type: Literal["automatic", "event", "flag"]
    trigger_condition: str = ""
    status: Literal["pending", "active", "completed", "failed"] = "pending"
    deadline: int | None = None  # tick deadline
    activated_at: int | None = None
    allow_off_rails: bool = False


class StoryBible(BaseModel):
    title: str
    description: str
    beats: list[StoryBeat]


class ProtectionResult(BaseModel):
    allowed: bool
    narration: str = ""


def parse_story_bible(raw: dict) -> StoryBible:
    """Parse a raw story bible dict into structured StoryBible."""
    beats: list[StoryBeat] = []
    for act in raw.get("acts", []):
        for beat_data in act.get("beats", []):
            trigger = beat_data.get("trigger", {})
            beats.append(StoryBeat(
                id=beat_data["id"],
                name=beat_data["name"],
                description=beat_data["description"],
                trigger_type=trigger.get("type", "event"),
                trigger_condition=trigger.get("condition", ""),
                status=beat_data.get("status", "pending"),
                deadline=beat_data.get("deadline"),
                allow_off_rails=beat_data.get("allow_off_rails", False),
            ))
    return StoryBible(
        title=raw.get("title", ""),
        description=raw.get("description", ""),
        beats=beats,
    )


class Director:
    """Lightweight MVP director — beat tracking and trigger evaluation."""

    def __init__(self, story_bible: StoryBible) -> None:
        self.story_bible = story_bible
        self._beats = {b.id: b for b in story_bible.beats}

        # Auto-activate any automatic beats
        for beat in self._beats.values():
            if beat.trigger_type == "automatic" and beat.status == "pending":
                beat.status = "active"

    def check_triggers(self, events: list[Event], flags: dict[str, Any], tick: int) -> list[StoryBeat]:
        """Check if events or flags trigger any pending beats. Returns newly activated beats."""
        activated: list[StoryBeat] = []

        for beat in self._beats.values():
            if beat.status != "pending":
                continue

            if beat.trigger_type == "event" and self._check_event_condition(beat.trigger_condition, events):
                beat.status = "active"
                beat.activated_at = tick
                activated.append(beat)
            elif beat.trigger_type == "flag" and self._check_flag_condition(beat.trigger_condition, flags):
                beat.status = "active"
                beat.activated_at = tick
                activated.append(beat)

        return activated

    def check_deadlines(self, tick: int) -> list[StoryBeat]:
        """Return active beats that have passed their deadline."""
        expired: list[StoryBeat] = []
        for beat in self._beats.values():
            if beat.status != "active" or beat.deadline is None:
                continue
            if beat.activated_at is not None and (tick - beat.activated_at) >= beat.deadline:
                expired.append(beat)
        return expired

    def get_active_beats(self) -> list[StoryBeat]:
        return [b for b in self._beats.values() if b.status == "active"]

    def get_beat(self, beat_id: str) -> StoryBeat | None:
        return self._beats.get(beat_id)

    def complete_beat(self, beat_id: str) -> None:
        beat = self._beats.get(beat_id)
        if beat:
            beat.status = "completed"

    def evaluate_protection(self, character_id: str, characters: dict) -> ProtectionResult:
        """Check if a character is protected from harm."""
        from grimoire.models.character import Character
        char: Character | None = characters.get(character_id)
        if char is None:
            return ProtectionResult(allowed=True)

        level = char.protection.level
        if level == "none":
            return ProtectionResult(allowed=True)
        elif level == "immortal":
            return ProtectionResult(
                allowed=False,
                narration=char.protection.fallback or f"{char.name} cannot be harmed.",
            )
        elif level == "hard":
            return ProtectionResult(
                allowed=False,
                narration=char.protection.fallback or f"{char.name} avoids the attack.",
            )
        elif level == "soft":
            return ProtectionResult(
                allowed=False,
                narration=char.protection.fallback or f"{char.name} survives, barely.",
            )
        return ProtectionResult(allowed=True)

    def _check_event_condition(self, condition: str, events: list[Event]) -> bool:
        """Check event-based trigger conditions.

        Supports: 'talked_to:char_id', 'visited:place_id',
        compound with 'and'.
        """
        if not condition:
            return False

        parts = [p.strip() for p in condition.split(" and ")]
        for part in parts:
            if ":" in part:
                action, target = part.split(":", 1)
                if action == "talked_to":
                    if not any(target in e.participants and "dialogue" in e.tags for e in events):
                        return False
                elif action == "visited":
                    if not any(e.location == target and "movement" in e.tags for e in events):
                        return False
                else:
                    return False
            else:
                return False
        return True

    def _check_flag_condition(self, condition: str, flags: dict[str, Any]) -> bool:
        """Check flag-based trigger conditions.

        Supports: 'flag == value', compound with 'and'.
        """
        if not condition:
            return False

        parts = [p.strip() for p in condition.split(" and ")]
        for part in parts:
            if "==" in part:
                key, val = [s.strip() for s in part.split("==", 1)]
                actual = flags.get(key)
                if val.lower() == "true":
                    if actual is not True:
                        return False
                elif val.lower() == "false":
                    if actual is not False:
                        return False
                else:
                    if str(actual) != val:
                        return False
            elif ">" in part:
                key, val = [s.strip() for s in part.split(">", 1)]
                actual = flags.get(key, 0)
                try:
                    if float(actual) <= float(val):
                        return False
                except (ValueError, TypeError):
                    return False
            else:
                # Bare flag — truthy check
                if not flags.get(part.strip()):
                    return False
        return True
