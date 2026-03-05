"""Storyteller — beat management, context goals, Writer orchestration."""

from __future__ import annotations

from grimoire.director.director import Director, StoryBeat
from grimoire.engine.game_state import GameState
from grimoire.models.character import Character
from grimoire.models.common import Relationship


class Storyteller:
    """Manages the Writer by providing context goals based on active beats."""

    def __init__(self, director: Director, game_state: GameState):
        self._director = director
        self._state = game_state

    def get_storyteller_goal(self, character_id: str) -> str | None:
        """Determine what the Writer should try to achieve in this interaction.

        Based on active story beats and character relationships.
        """
        active_beats = self._director.get_active_beats()
        char = self._state.get_character(character_id)
        if not char:
            return None

        goals: list[str] = []
        for beat in active_beats:
            relevance = self._beat_relevance(beat, char)
            if relevance:
                goals.append(relevance)

        return "; ".join(goals) if goals else None

    def get_player_relationship(self, character_id: str) -> Relationship | None:
        """Find the character's relationship with the player.

        If no explicit relationship exists, creates one from flags/interaction history.
        """
        char = self._state.get_character(character_id)
        if not char:
            return None

        # Look for an existing player relationship
        for rel in char.relationships:
            if rel.target_id == "player":
                return rel

        # Build one from game state — tracks how the player has behaved
        has_met = self._state.flags.get(f"met_{character_id}", False)
        was_attacked = self._state.flags.get(f"attacked_{character_id}", 0)
        is_hostile = self._state.flags.get(f"hostile_to_{character_id}", False)

        if not has_met and not was_attacked:
            return None  # Genuinely a stranger

        # Create a dynamic relationship and attach it to the character
        trust = 0.0
        disposition = 0.0
        types = ["acquaintance"]
        history = "Met recently."

        if was_attacked:
            trust = max(-1.0, -0.3 * was_attacked)
            disposition = max(-1.0, -0.4 * was_attacked)
            types = ["hostile"]
            history = f"The player attacked {char.name}" + (
                f" {was_attacked} times." if was_attacked > 1 else ".")

        if is_hostile:
            types = ["hostile"]

        rel = Relationship(
            target_id="player",
            types=types,
            trust=trust,
            familiarity=min(1.0, 0.3 + 0.1 * was_attacked),
            disposition=disposition,
            history=history,
        )
        char.relationships.append(rel)
        return rel

    def _beat_relevance(self, beat: StoryBeat, character: Character) -> str | None:
        """Determine if/how a beat is relevant to a character interaction."""
        # Simple keyword matching for MVP
        desc_lower = beat.description.lower()
        name_lower = character.name.lower()
        id_lower = character.id.lower()

        if name_lower in desc_lower or id_lower in desc_lower:
            return f"Story beat '{beat.name}': {beat.description}"

        # Check if the character's goals/motivations relate to the beat
        for goal in character.goals:
            if any(word in desc_lower for word in goal.description.lower().split()
                   if len(word) > 4):
                return f"Story beat '{beat.name}' relates to {character.name}'s goal: {goal.description}"

        return None
