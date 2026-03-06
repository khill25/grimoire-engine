"""Game session — orchestrates Engine + Director + Grimoire + LLM."""

from __future__ import annotations

from typing import Any

from grimoire.dialogue.matcher import DialogueMatcher
from grimoire.dialogue.tree_runner import DialogueState
from grimoire.director.director import Director, parse_grimoire
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
        if world_data.grimoire:
            grimoire = parse_grimoire(world_data.grimoire)
            self.director = Director(grimoire)
        else:
            self.director = Director(parse_grimoire({"acts": []}))

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
                # Consequences: flag + disposition hit
                self._apply_attack_consequences(action.target, blocked=True)
                self.game_state.advance_tick()
                return TickResult(narration=narration, events=[event])

        result = self.game_state.process_action(action)

        # Consequences for unprotected attacks
        if action.type == "attack" and action.target:
            self._apply_attack_consequences(action.target, blocked=False)

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
        """Start a conversation with an NPC.

        Considers context: hostility, prior meetings, recent events, relationship state.
        Decides whether to run an authored tree, generate an LLM response, or refuse.
        """
        char = self.game_state.get_character(character_id)
        if char is None:
            return DialogueResult(speaker="", text=f"Unknown character: {character_id}", is_ended=True)

        place = self.game_state.get_place(self.game_state.player_location)
        if place and character_id not in place.current_npcs:
            return DialogueResult(speaker=char.name, text=f"{char.name} isn't here.", is_ended=True)

        # Log the interaction
        self.game_state.process_action(PlayerAction(type="talk", target=character_id))

        # --- Context assessment ---
        relationship = self.storyteller.get_player_relationship(character_id)
        was_attacked = self.game_state.flags.get(f"attacked_{character_id}", 0)
        is_hostile = self.game_state.flags.get(f"hostile_to_{character_id}", False)
        has_met = self.game_state.flags.get(f"met_{character_id}", False)
        witnessed = self.game_state.flags.get(f"witnessed_attack_{character_id}")

        # --- Hostile NPC: refuses tree, LLM or canned response ---
        if was_attacked or is_hostile:
            return await self._hostile_greeting(char, character_id, was_attacked, relationship)

        # --- Witnessed violence: wary/scared response ---
        if witnessed:
            return await self._wary_greeting(char, character_id, witnessed, relationship)

        # --- Normal flow: find appropriate tree or LLM ---
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

        # No tree — LLM greeting with full context
        if self.writer:
            return await self._contextual_greeting(char, character_id, has_met, relationship)

        # No LLM, no tree
        if has_met:
            return DialogueResult(
                speaker=char.name,
                text=f"{char.name} acknowledges you with a nod.",
                is_ended=True,
            )
        return DialogueResult(
            speaker=char.name,
            text=f"{char.name} nods at you but doesn't seem to have much to say.",
            is_ended=True,
        )

    async def _hostile_greeting(
        self, char: Character, character_id: str,
        attack_count: int, relationship: Relationship | None,
    ) -> DialogueResult:
        """NPC was attacked by the player — hostile or refusing interaction."""
        if self.writer:
            scene = self.game_state.get_scene(self.game_state.player_location)
            goal = self.storyteller.get_storyteller_goal(character_id)
            # Override the storyteller goal with hostility context
            hostile_context = (
                f"The player has attacked you {attack_count} time(s). "
                "You are hostile, angry, or afraid. You do NOT want to talk. "
                "React accordingly — refuse conversation, threaten, or back away. "
                "Do not be friendly. Do not pretend nothing happened."
            )
            if goal:
                hostile_context = f"{hostile_context} Also: {goal}"
            resp = await self.writer.generate_dialogue_response(
                char, scene, "The player approaches you.",
                events=scene.recent_events,
                player_relationship=relationship,
                storyteller_goal=hostile_context,
            )
            return DialogueResult(
                speaker=char.name, text=resp.dialogue,
                is_ended=True, writer_response=resp,
            )

        # No LLM — canned hostile responses
        if attack_count >= 3:
            text = f"{char.name} backs away from you, eyes fixed on your hands. They won't speak to you."
        elif attack_count >= 2:
            text = f"{char.name} glares at you. \"Get away from me.\""
        else:
            text = f"{char.name} flinches as you approach. \"What do you want?\" Their voice is hard."
        return DialogueResult(speaker=char.name, text=text, is_ended=True)

    async def _wary_greeting(
        self, char: Character, character_id: str,
        witnessed_target: str, relationship: Relationship | None,
    ) -> DialogueResult:
        """NPC witnessed the player attack someone else."""
        target_char = self.game_state.get_character(witnessed_target)
        target_name = target_char.name if target_char else witnessed_target

        if self.writer:
            scene = self.game_state.get_scene(self.game_state.player_location)
            goal = self.storyteller.get_storyteller_goal(character_id)
            wary_context = (
                f"You saw the player attack {target_name}. "
                "You are uneasy, cautious, or scared. Adjust your behavior — "
                "you might be terse, guarded, or try to end the conversation quickly."
            )
            if goal:
                wary_context = f"{wary_context} Also: {goal}"
            resp = await self.writer.generate_dialogue_response(
                char, scene, "The player approaches you.",
                events=scene.recent_events,
                player_relationship=relationship,
                storyteller_goal=wary_context,
            )
            return DialogueResult(
                speaker=char.name, text=resp.dialogue,
                is_ended=True, writer_response=resp,
            )

        text = f"{char.name} eyes you warily. \"I saw what you did to {target_name}.\" They keep their distance."
        return DialogueResult(speaker=char.name, text=text, is_ended=True)

    async def _contextual_greeting(
        self, char: Character, character_id: str,
        has_met: bool, relationship: Relationship | None,
    ) -> DialogueResult:
        """LLM-generated greeting with full context (no tree available)."""
        scene = self.game_state.get_scene(self.game_state.player_location)
        goal = self.storyteller.get_storyteller_goal(character_id)

        # Enrich with vector store context
        events = list(scene.recent_events)
        relevant = self._query_relevant_events(
            f"conversation with {char.name}",
            location=self.game_state.player_location)
        if relevant:
            from grimoire.models.event import Event
            for r in relevant:
                if not any(e.id == r["id"] for e in events):
                    events.append(Event(
                        id=r["id"], timestamp=r.get("timestamp", 0),
                        type=r.get("type", "unknown"), summary=r["text"],
                    ))

        greeting_context = "The player approaches to talk."
        if has_met:
            greeting_context = "The player approaches. You have met before."

        resp = await self.writer.generate_dialogue_response(
            char, scene, greeting_context,
            events=events,
            player_relationship=relationship,
            storyteller_goal=goal,
        )
        return DialogueResult(
            speaker=char.name, text=resp.dialogue,
            is_ended=True, writer_response=resp,
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

    def _apply_attack_consequences(self, target_id: str, blocked: bool) -> None:
        """Apply lasting consequences for attacking an NPC."""
        # Track attack count and flag
        attack_key = f"attacked_{target_id}"
        count = self.game_state.flags.get(attack_key, 0)
        self.game_state.flags[attack_key] = count + 1
        self.game_state.flags[f"hostile_to_{target_id}"] = True

        # Disposition hit on the target
        self._degrade_player_relationship(target_id, trust_delta=-0.3, disp_delta=-0.4)

        # Witnesses also react
        place = self.game_state.get_place(self.game_state.player_location)
        if place:
            for npc_id in place.current_npcs:
                if npc_id == target_id:
                    continue
                self.game_state.flags[f"witnessed_attack_{npc_id}"] = target_id
                self._degrade_player_relationship(npc_id, trust_delta=-0.2, disp_delta=-0.2)

    def _degrade_player_relationship(
        self, character_id: str, trust_delta: float, disp_delta: float,
    ) -> None:
        """Shift a character's relationship with the player (creates one if needed)."""
        char = self.game_state.get_character(character_id)
        if not char:
            return

        # Find or create the player relationship
        rel = None
        for r in char.relationships:
            if r.target_id == "player":
                rel = r
                break

        if rel is None:
            rel = Relationship(
                target_id="player", types=["stranger"],
                trust=0.0, familiarity=0.1, disposition=0.0, history="",
            )
            char.relationships.append(rel)

        rel.trust = max(-1.0, rel.trust + trust_delta)
        rel.disposition = max(-1.0, rel.disposition + disp_delta)

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

        has_met = self.game_state.flags.get(f"met_{character_id}", False)

        # First meeting tree — only if we haven't met
        for tree in trees:
            if tree.context == "first_meeting" and not has_met:
                return tree

        # Other trees (non-first_meeting) — use the first match
        for tree in trees:
            if tree.context != "first_meeting":
                return tree

        # Only first_meeting trees exist and we've already met — no tree
        return None
