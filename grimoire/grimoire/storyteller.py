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
        """Find the character's relationship with the player, if any."""
        char = self._state.get_character(character_id)
        if not char:
            return None
        # For MVP, look for a relationship tagged with "player"
        for rel in char.relationships:
            if rel.target_id == "player":
                return rel
        return None

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
