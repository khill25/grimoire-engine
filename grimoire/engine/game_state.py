"""Game state manager — tick loop, world management, source of truth."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel

from grimoire.engine.events import EventLog, create_event
from grimoire.engine.schedules import get_scheduled_location
from grimoire.loader.world_loader import WorldData
from grimoire.models.character import Character
from grimoire.models.common import GameTime
from grimoire.models.event import Event
from grimoire.models.place import Place


class PlayerAction(BaseModel):
    type: Literal["move", "talk", "interact", "wait", "look", "attack"]
    target: str = ""  # place_id, character_id, or item_id
    detail: str = ""  # free text or additional context


class SceneContext(BaseModel):
    place: Place
    npcs_present: list[Character]
    recent_events: list[Event]
    atmosphere: str = ""


class TickResult(BaseModel):
    narration: str
    events: list[Event] = []
    scene: SceneContext | None = None
    npc_responses: list[dict[str, str]] = []  # [{character_id, text}]


class GameState:
    """Core game state — source of truth for the world."""

    def __init__(self, world_data: WorldData) -> None:
        self.world = world_data
        self.time = GameTime(
            ticks_per_hour=world_data.time_config.get("ticks_per_hour", 1),
            hours_per_day=world_data.time_config.get("hours_per_day", 24),
        )
        self.flags: dict[str, Any] = {}
        self.quest_states: dict[str, str] = {}
        self.event_log = EventLog()
        self.player_location: str = ""  # place_id

        # Initialize NPC locations from their defaults
        self._update_npc_locations()

    @property
    def tick(self) -> int:
        return self.time.tick

    def get_character(self, char_id: str) -> Character | None:
        return self.world.characters.get(char_id)

    def get_place(self, place_id: str) -> Place | None:
        return self.world.places.get(place_id)

    def get_scene(self, place_id: str) -> SceneContext:
        place = self.world.places.get(place_id)
        if place is None:
            raise ValueError(f"Unknown place: {place_id}")

        npcs = [self.world.characters[cid]
                for cid in place.current_npcs
                if cid in self.world.characters]

        recent = self.event_log.query(location=place_id, limit=10)

        return SceneContext(
            place=place,
            npcs_present=npcs,
            recent_events=recent,
            atmosphere=place.atmosphere,
        )

    def process_action(self, action: PlayerAction) -> TickResult:
        """Process a player action and return the result."""
        if action.type == "move":
            return self._handle_move(action)
        elif action.type == "look":
            return self._handle_look(action)
        elif action.type == "wait":
            return self._handle_wait(action)
        elif action.type == "talk":
            return self._handle_talk(action)
        elif action.type == "interact":
            return self._handle_interact(action)
        elif action.type == "attack":
            return self._handle_attack(action)
        else:
            return TickResult(narration="You're not sure what to do.")

    def advance_tick(self, count: int = 1) -> list[Event]:
        """Advance the game clock and update the world."""
        events: list[Event] = []
        for _ in range(count):
            self.time.tick += 1
            move_events = self._update_npc_locations()
            events.extend(move_events)
        return events

    def _handle_move(self, action: PlayerAction) -> TickResult:
        target = action.target
        current_place = self.get_place(self.player_location)

        if current_place and target not in current_place.connections:
            return TickResult(narration=f"You can't get to {target} from here.")

        place = self.get_place(target)
        if place is None:
            return TickResult(narration=f"Unknown location: {target}")

        self.player_location = target
        event = create_event(
            timestamp=self.tick,
            type="interaction",
            summary=f"Player moved to {place.name}",
            location=target,
            visibility="local",
            tags=["movement"],
        )
        self.event_log.append(event)
        tick_events = self.advance_tick()

        scene = self.get_scene(target)
        return TickResult(
            narration=place.description,
            events=[event] + tick_events,
            scene=scene,
        )

    def _handle_look(self, action: PlayerAction) -> TickResult:
        if not self.player_location:
            return TickResult(narration="You're nowhere in particular.")
        scene = self.get_scene(self.player_location)
        place = scene.place
        npc_names = [npc.name for npc in scene.npcs_present]
        npc_text = ""
        if npc_names:
            npc_text = " " + ", ".join(npc_names) + " " + ("is" if len(npc_names) == 1 else "are") + " here."
        return TickResult(
            narration=place.description + npc_text,
            scene=scene,
        )

    def _handle_wait(self, action: PlayerAction) -> TickResult:
        try:
            hours = max(1, int(action.detail)) if action.detail else 1
        except ValueError:
            hours = 1

        ticks = hours * self.time.ticks_per_hour
        events = self.advance_tick(ticks)
        scene = self.get_scene(self.player_location) if self.player_location else None
        return TickResult(
            narration=f"{hours} hour{'s' if hours != 1 else ''} pass{'es' if hours == 1 else ''}.",
            events=events,
            scene=scene,
        )

    def _handle_talk(self, action: PlayerAction) -> TickResult:
        # Talk initiation — actual dialogue handled by the dialogue system
        char = self.get_character(action.target)
        if char is None:
            return TickResult(narration=f"There's nobody called '{action.target}' here.")

        place = self.get_place(self.player_location)
        if place and action.target not in place.current_npcs:
            return TickResult(narration=f"{char.name} isn't here right now.")

        event = create_event(
            timestamp=self.tick,
            type="interaction",
            summary=f"Player initiated conversation with {char.name}",
            participants=[action.target],
            location=self.player_location,
            tags=["dialogue"],
        )
        self.event_log.append(event)

        return TickResult(
            narration=f"You approach {char.name}.",
            events=[event],
        )

    def _handle_interact(self, action: PlayerAction) -> TickResult:
        event = create_event(
            timestamp=self.tick,
            type="interaction",
            summary=f"Player interacted with {action.target}: {action.detail}",
            location=self.player_location,
            tags=["interaction"],
            participants=[action.target] if action.target else [],
        )
        self.event_log.append(event)
        self.advance_tick()
        return TickResult(
            narration=f"You {action.detail or 'interact with ' + action.target}.",
            events=[event],
        )

    def _handle_attack(self, action: PlayerAction) -> TickResult:
        """Handle attack on unprotected characters. Protected ones are blocked in session."""
        char = self.get_character(action.target)
        if char is None:
            return TickResult(narration=f"There's nobody called '{action.target}' here.")

        place = self.get_place(self.player_location)
        if place and action.target not in place.current_npcs:
            return TickResult(narration=f"{char.name} isn't here right now.")

        event = create_event(
            timestamp=self.tick,
            type="interaction",
            summary=f"Player attacked {char.name}",
            participants=[action.target],
            witnesses=[npc_id for npc_id in (place.current_npcs if place else [])
                       if npc_id != action.target],
            location=self.player_location,
            tags=["attack", "combat"],
            severity=0.9,
        )
        self.event_log.append(event)
        self.advance_tick()
        return TickResult(
            narration=f"You attack {char.name}.",
            events=[event],
        )

    def _update_npc_locations(self) -> list[Event]:
        """Move NPCs to their scheduled locations. Returns movement events."""
        events: list[Event] = []
        for char in self.world.characters.values():
            scheduled = get_scheduled_location(char, self.time)
            if scheduled and scheduled != char.location:
                old_loc = char.location
                char.location = scheduled

                # Update place NPC lists
                if old_loc in self.world.places and char.id in self.world.places[old_loc].current_npcs:
                    self.world.places[old_loc].current_npcs.remove(char.id)
                if scheduled in self.world.places and char.id not in self.world.places[scheduled].current_npcs:
                    self.world.places[scheduled].current_npcs.append(char.id)

                events.append(create_event(
                    timestamp=self.tick,
                    type="off_screen",
                    summary=f"{char.name} moved to {scheduled}",
                    participants=[char.id],
                    location=scheduled,
                    visibility="local",
                    tags=["npc_movement"],
                    severity=0.1,
                ))
        return events
