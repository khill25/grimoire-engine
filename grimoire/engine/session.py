"""Game session — orchestrates Engine + Director + Grimoire + LLM."""

from __future__ import annotations

from typing import Any

from grimoire.dialogue.matcher import DialogueMatcher
from grimoire.dialogue.tree_runner import DialogueState
from grimoire.director.director import Director, parse_story_bible
from grimoire.engine.context import build_writer_messages, build_writer_system_prompt
from grimoire.engine.events import create_event
from grimoire.engine.game_state import GameState, PlayerAction, SceneContext, TickResult
from grimoire.grimoire.storyteller import Storyteller
from grimoire.grimoire.writer import Writer, WriterResponse
from grimoire.llm.provider import EmbeddingProvider, LLMJob, LLMProvider
from grimoire.llm.token_tracker import TokenTracker
from grimoire.loader.world_loader import WorldData, load_world
from grimoire.models.character import Character
from grimoire.models.common import Relationship
from grimoire.models.dialogue import DialogueTree
from grimoire.storage.database import Database
from grimoire.storage.vector_store import VectorStore


class DialogueResult:
    """Result of a dialogue interaction."""

    def __init__(
        self,
        speaker: str,
        text: str,
        choices: list[dict[str, str]] | None = None,
        matched_choice: dict[str, Any] | None = None,
        is_ended: bool = False,
        flags_changed: dict[str, Any] | None = None,
        writer_response: WriterResponse | None = None,
    ):
        self.speaker = speaker
        self.text = text
        self.choices = choices or []
        self.matched_choice = matched_choice
        self.is_ended = is_ended
        self.flags_changed = flags_changed or {}
        self.writer_response = writer_response


class GameSession:
    """Top-level orchestrator — the single entry point for all game interactions.

    Ties together: GameState, Director, Storyteller, Writer, DialogueMatcher.
    Both the CLI and API should use this instead of calling components directly.
    """

    def __init__(
        self,
        world_data: WorldData,
        llm: LLMProvider | None = None,
        embedder: EmbeddingProvider | None = None,
        start_location: str = "",
        db: Database | None = None,
        vector_store: VectorStore | None = None,
    ):
        self.world_data = world_data
        self.game_state = GameState(world_data)
        self.tracker = TokenTracker()

        # Storage (optional — falls back to in-memory)
        self.db = db
        self.vector_store = vector_store

        # Director
        if world_data.story_bible:
            bible = parse_story_bible(world_data.story_bible)
            self.director = Director(bible)
        else:
            self.director = Director(parse_story_bible({"acts": []}))

        # Storyteller
        self.storyteller = Storyteller(self.director, self.game_state)

        # LLM-powered components (optional — graceful degradation without LLM)
        self.llm = llm
        self.writer = Writer(llm, self.tracker) if llm else None
        self.matcher = DialogueMatcher(embedder) if embedder else None

        # Active dialogue states per character
        self._dialogues: dict[str, DialogueState] = {}

        # Precompute embeddings for all dialogue trees if matcher available
        if self.matcher:
            for tree_id, tree in list(world_data.dialogue_trees.items()):
                world_data.dialogue_trees[tree_id] = self.matcher.precompute_embeddings(tree)

        # Set start location
        if start_location and start_location in world_data.places:
            self.game_state.player_location = start_location
        elif world_data.places:
            self.game_state.player_location = next(iter(world_data.places))

    # --- Actions ---

    async def process_action(self, action: PlayerAction) -> TickResult:
        """Process a player action with full LLM integration."""
        # Protection check for attack actions
        if action.type == "attack" and action.target:
            allowed, narration = self.check_protection(action.target)
            if not allowed:
                event = create_event(
                    timestamp=self.game_state.tick,
                    type="interaction",
                    summary=f"Player attempted to attack {action.target} (protected)",
                    participants=[action.target],
                    location=self.game_state.player_location,
                    tags=["attack", "blocked"],
                    severity=0.8,
                )
                self.game_state.event_log.append(event)
                await self._persist_event(event)
                self.game_state.advance_tick()
                return TickResult(narration=narration, events=[event])

        result = self.game_state.process_action(action)

        # Persist any new events to DB + vector store
        for event in result.events:
            await self._persist_event(event)

        # Director trigger check on all accumulated events
        all_events = self.game_state.event_log.all_events
        activated = self.director.check_triggers(
            all_events, self.game_state.flags, self.game_state.tick)
        for beat in activated:
            result.npc_responses.append({
                "system": f"Story beat activated: {beat.name}",
            })

        # Check deadlines
        expired = self.director.check_deadlines(self.game_state.tick)
        for beat in expired:
            result.npc_responses.append({
                "system": f"Story beat deadline passed: {beat.name}",
            })

        # Generate ambient NPC reactions for significant events
        if self.writer and action.type in ("move", "interact") and result.scene:
            ambient = await self._generate_ambient_reactions(result.scene, action)
            result.npc_responses.extend(ambient)

        # LLM narration for interact actions
        if self.writer and action.type == "interact" and result.scene:
            narration = await self.writer.generate_narration(
                f"{action.detail or action.target}",
                result.scene,
                tone=self.world_data.tone,
            )
            result.narration = narration

        return result

    # --- Dialogue ---

    async def start_dialogue(self, character_id: str) -> DialogueResult:
        """Start a conversation with an NPC. Returns the opening node."""
        char = self.game_state.get_character(character_id)
        if char is None:
            return DialogueResult(speaker="", text=f"Unknown character: {character_id}", is_ended=True)

        place = self.game_state.get_place(self.game_state.player_location)
        if place and character_id not in place.current_npcs:
            return DialogueResult(speaker=char.name, text=f"{char.name} isn't here.", is_ended=True)

        # Log the interaction
        self.game_state.process_action(PlayerAction(type="talk", target=character_id))

        # Find dialogue tree
        tree = self._find_tree(character_id)
        if tree:
            dlg = DialogueState(tree, flags=dict(self.game_state.flags))
            self._dialogues[character_id] = dlg
            node = dlg.current_node
            if node:
                choices = dlg.get_available_choices()
                return DialogueResult(
                    speaker=char.name,
                    text=node.text,
                    choices=[{"id": c.id, "text": c.text} for c in choices],
                )

        # No tree — generate a greeting with LLM
        if self.writer:
            scene = self.game_state.get_scene(self.game_state.player_location)
            goal = self.storyteller.get_storyteller_goal(character_id)
            resp = await self.writer.generate_dialogue_response(
                char, scene, "Hello.",
                events=scene.recent_events,
                player_relationship=self.storyteller.get_player_relationship(character_id),
                storyteller_goal=goal,
            )
            return DialogueResult(
                speaker=char.name, text=resp.dialogue,
                is_ended=True, writer_response=resp,
            )

        return DialogueResult(
            speaker=char.name,
            text=f"{char.name} nods at you but doesn't seem to have much to say.",
            is_ended=True,
        )

    async def dialogue_input(self, character_id: str, player_text: str) -> DialogueResult:
        """Send player text during an active dialogue."""
        char = self.game_state.get_character(character_id)
        if char is None:
            return DialogueResult(speaker="", text="Unknown character.", is_ended=True)

        dlg = self._dialogues.get(character_id)

        # No active dialogue — pure LLM conversation
        if dlg is None or dlg.is_ended:
            return await self._llm_dialogue(char, player_text)

        choices = dlg.get_available_choices()

        # 1. Try exact choice ID or text match (for numbered/direct selection)
        for c in choices:
            if player_text == c.id or player_text.strip().lower() == c.text.strip().lower():
                return self._advance_tree(character_id, char, dlg, c.id, similarity=1.0)

        # 2. Try embedding match via DialogueMatcher
        if self.matcher and choices:
            matched, similarity = self.matcher.match_choice(player_text, choices)
            if matched:
                return self._advance_tree(
                    character_id, char, dlg, matched.id, similarity=similarity)

        # 3. No match — LLM fallback if node allows it
        node = dlg.current_node
        if node and node.llm_escape and self.writer:
            scene = self.game_state.get_scene(self.game_state.player_location)
            goal = self.storyteller.get_storyteller_goal(character_id)
            resp = await self.writer.generate_dialogue_response(
                char, scene, player_text,
                events=scene.recent_events,
                player_relationship=self.storyteller.get_player_relationship(character_id),
                storyteller_goal=goal,
            )
            # Stay on the same node — return choices again
            return DialogueResult(
                speaker=char.name,
                text=resp.dialogue,
                choices=[{"id": c.id, "text": c.text} for c in choices],
                writer_response=resp,
            )

        # 4. No LLM, no match
        return DialogueResult(
            speaker=char.name,
            text=node.text if node else "...",
            choices=[{"id": c.id, "text": c.text} for c in choices],
        )

    async def end_dialogue_async(self, character_id: str) -> None:
        """End an active dialogue (async — persists flags + conversation summary)."""
        dlg = self._dialogues.pop(character_id, None)
        self.game_state.flags[f"met_{character_id}"] = True
        await self._persist_flags()

        # Store conversation summary in vector store
        if dlg and self.vector_store:
            summary = self._build_conversation_summary(character_id, dlg)
            if summary:
                import uuid
                conv_id = f"conv_{character_id}_{uuid.uuid4().hex[:8]}"
                self.vector_store.add_conversation_summary(
                    conv_id, character_id, summary, self.game_state.tick)

    def end_dialogue(self, character_id: str) -> None:
        """End an active dialogue (sync — does not persist flags to DB)."""
        self._dialogues.pop(character_id, None)
        self.game_state.flags[f"met_{character_id}"] = True

    def get_active_dialogue(self, character_id: str) -> DialogueState | None:
        return self._dialogues.get(character_id)

    # --- Protection ---

    def check_protection(self, character_id: str) -> tuple[bool, str]:
        """Check if an action against a character is allowed."""
        result = self.director.evaluate_protection(
            character_id, self.game_state.world.characters)
        return result.allowed, result.narration

    # --- Internals ---

    def _advance_tree(
        self, character_id: str, char: Character,
        dlg: DialogueState, choice_id: str, similarity: float = 1.0,
    ) -> DialogueResult:
        """Select a choice in the dialogue tree and return the result."""
        choice = next((c for c in dlg.get_available_choices() if c.id == choice_id), None)
        new_node = dlg.select_choice(choice_id)

        # Propagate flags back to game state
        self.game_state.flags.update(dlg.flags)

        matched_info = None
        if choice:
            matched_info = {"id": choice.id, "text": choice.text, "similarity": round(similarity, 2)}

        if new_node is None or dlg.is_ended:
            self.end_dialogue(character_id)
            return DialogueResult(
                speaker=char.name,
                text=new_node.text if new_node else "...",
                is_ended=True,
                matched_choice=matched_info,
                flags_changed=dlg.flags,
            )

        new_choices = dlg.get_available_choices()
        return DialogueResult(
            speaker=char.name,
            text=new_node.text,
            choices=[{"id": c.id, "text": c.text} for c in new_choices],
            matched_choice=matched_info,
            flags_changed=dlg.flags,
        )

    async def _llm_dialogue(self, char: Character, player_text: str) -> DialogueResult:
        """Pure LLM dialogue — no tree."""
        if not self.writer:
            return DialogueResult(
                speaker=char.name,
                text=f"{char.name} doesn't have much to say right now.",
                is_ended=True,
            )

        scene = self.game_state.get_scene(self.game_state.player_location)
        goal = self.storyteller.get_storyteller_goal(char.id)

        # Enrich events with vector store results if available
        events = list(scene.recent_events)
        relevant = self._query_relevant_events(
            player_text, location=self.game_state.player_location)
        if relevant:
            from grimoire.models.event import Event
            for r in relevant:
                # Avoid duplicates — check by id
                if not any(e.id == r["id"] for e in events):
                    events.append(Event(
                        id=r["id"], timestamp=r.get("timestamp", 0),
                        type=r.get("type", "unknown"), summary=r["text"],
                    ))

        resp = await self.writer.generate_dialogue_response(
            char, scene, player_text,
            events=events,
            player_relationship=self.storyteller.get_player_relationship(char.id),
            storyteller_goal=goal,
        )
        return DialogueResult(
            speaker=char.name, text=resp.dialogue,
            is_ended=True, writer_response=resp,
        )

    async def _generate_ambient_reactions(
        self, scene: SceneContext, action: PlayerAction,
    ) -> list[dict[str, str]]:
        """Generate ambient NPC reactions to a player action."""
        reactions: list[dict[str, str]] = []
        if not self.writer:
            return reactions

        for npc in scene.npcs_present:
            # Only react sometimes — check if the action is relevant to their affinities
            if not self._should_npc_react(npc, action):
                continue
            try:
                resp = await self.writer.generate_ambient_dialogue(
                    npc, scene, events=scene.recent_events)
                if resp.dialogue:
                    reactions.append({"character_id": npc.id, "text": resp.dialogue})
            except Exception:
                pass  # Ambient dialogue is non-critical

        return reactions

    def _should_npc_react(self, npc: Character, action: PlayerAction) -> bool:
        """Simple heuristic: NPCs react to interactions targeting them or notable events."""
        if action.target == npc.id:
            return True
        # React to moves only ~30% of the time (simulate selective attention)
        if action.type == "move":
            return hash(f"{npc.id}{self.game_state.tick}") % 3 == 0
        return action.type == "interact"

    async def _persist_event(self, event: Any) -> None:
        """Persist an event to SQLite and vector store (if available)."""
        if self.db:
            try:
                await self.db.insert_event(event)
            except Exception:
                pass  # Storage is non-critical
        if self.vector_store:
            try:
                self.vector_store.add_event(event)
            except Exception:
                pass

    async def _persist_flags(self) -> None:
        """Save current flags to SQLite (if available)."""
        if self.db:
            try:
                await self.db.save_flags(self.game_state.flags)
            except Exception:
                pass

    def _query_relevant_events(self, query: str, location: str | None = None) -> list[Any]:
        """Query vector store for semantically relevant events."""
        if not self.vector_store:
            return []
        try:
            return self.vector_store.query_events(
                query, n_results=5, location=location)
        except Exception:
            return []

    def _query_conversation_history(
        self, query: str, character_id: str | None = None,
    ) -> list[Any]:
        """Query vector store for relevant past conversations."""
        if not self.vector_store:
            return []
        try:
            return self.vector_store.query_conversations(
                query, character_id=character_id, n_results=3)
        except Exception:
            return []

    def _build_conversation_summary(
        self, character_id: str, dlg: DialogueState,
    ) -> str:
        """Build a text summary of a completed dialogue for vector storage."""
        char = self.game_state.get_character(character_id)
        name = char.name if char else character_id
        node_map = {n.id: n for n in dlg.tree.nodes}
        visited = []
        for node_id in dlg.history:
            node = node_map.get(node_id)
            if node:
                visited.append(f"{node.speaker or name}: {node.text[:100]}")
        if not visited:
            return ""
        return f"Conversation with {name}: " + " | ".join(visited[:10])

    def _find_tree(self, character_id: str) -> DialogueTree | None:
        trees = [t for t in self.game_state.world.dialogue_trees.values()
                 if t.character_id == character_id]
        if not trees:
            return None
        for tree in trees:
            if tree.context == "first_meeting" and not self.game_state.flags.get(f"met_{character_id}"):
                return tree
        return trees[0]
