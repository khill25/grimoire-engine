"""Save/load game state to/from a file."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from grimoire.engine.events import EventLog
from grimoire.engine.game_state import GameState
from grimoire.models.event import Event


class SaveData:
    """Serializable snapshot of all game state."""

    def __init__(
        self,
        world_path: str,
        tick: int,
        player_location: str,
        flags: dict[str, Any],
        quest_states: dict[str, str],
        events: list[dict],
        character_locations: dict[str, str],
        director_beats: list[dict] | None = None,
    ):
        self.world_path = world_path
        self.tick = tick
        self.player_location = player_location
        self.flags = flags
        self.quest_states = quest_states
        self.events = events
        self.character_locations = character_locations
        self.director_beats = director_beats or []

    def to_dict(self) -> dict:
        return {
            "version": 1,
            "world_path": self.world_path,
            "tick": self.tick,
            "player_location": self.player_location,
            "flags": self.flags,
            "quest_states": self.quest_states,
            "events": self.events,
            "character_locations": self.character_locations,
            "director_beats": self.director_beats,
        }

    @classmethod
    def from_dict(cls, data: dict) -> SaveData:
        return cls(
            world_path=data["world_path"],
            tick=data["tick"],
            player_location=data["player_location"],
            flags=data["flags"],
            quest_states=data["quest_states"],
            events=data["events"],
            character_locations=data["character_locations"],
            director_beats=data.get("director_beats", []),
        )


def save_game(game_state: GameState, world_path: str, save_path: str,
              director=None) -> None:
    """Save the current game state to a JSON file."""
    char_locations = {
        cid: char.location
        for cid, char in game_state.world.characters.items()
    }

    director_beats = []
    if director:
        for beat in director.story_bible.beats:
            director_beats.append(beat.model_dump())

    save_data = SaveData(
        world_path=world_path,
        tick=game_state.tick,
        player_location=game_state.player_location,
        flags=game_state.flags,
        quest_states=game_state.quest_states,
        events=[e.model_dump() for e in game_state.event_log.all_events],
        character_locations=char_locations,
        director_beats=director_beats,
    )

    path = Path(save_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(save_data.to_dict(), f, indent=2, default=str)


def load_game(save_path: str) -> SaveData:
    """Load game state from a save file. Returns SaveData for the caller to restore."""
    with open(save_path) as f:
        data = json.load(f)
    return SaveData.from_dict(data)


def restore_game_state(save_data: SaveData, game_state: GameState,
                       director=None) -> None:
    """Apply loaded save data to an initialized GameState."""
    game_state.time.tick = save_data.tick
    game_state.player_location = save_data.player_location
    game_state.flags = save_data.flags
    game_state.quest_states = save_data.quest_states

    # Restore events
    game_state.event_log = EventLog()
    for event_data in save_data.events:
        game_state.event_log.append(Event.model_validate(event_data))

    # Restore character locations
    for cid, loc in save_data.character_locations.items():
        if cid in game_state.world.characters:
            game_state.world.characters[cid].location = loc

    # Restore director beat states
    if director and save_data.director_beats:
        for beat_data in save_data.director_beats:
            beat = director.get_beat(beat_data["id"])
            if beat:
                beat.status = beat_data["status"]
                beat.activated_at = beat_data.get("activated_at")


async def restore_with_storage(
    save_data: SaveData, game_state: GameState,
    director=None, db=None, vector_store=None,
) -> None:
    """Restore game state and re-populate storage backends."""
    restore_game_state(save_data, game_state, director=director)

    # Re-populate DB with events
    if db:
        for event in game_state.event_log.all_events:
            await db.insert_event(event)
        await db.save_flags(game_state.flags)

    # Re-populate vector store with events
    if vector_store:
        for event in game_state.event_log.all_events:
            vector_store.add_event(event)
