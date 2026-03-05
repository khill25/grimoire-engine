"""Writer — LLM-powered text generation for the 6 jobs."""

from __future__ import annotations

import json

from grimoire.engine.context import build_writer_messages, build_writer_system_prompt
from grimoire.engine.game_state import GameState, SceneContext
from grimoire.llm.provider import LLMJob, LLMProvider
from grimoire.llm.token_tracker import TokenTracker
from grimoire.models.character import Character
from grimoire.models.common import Relationship
from grimoire.models.event import Event


class WriterResponse:
    def __init__(self, dialogue: str, action: str | None = None,
                 emotion: str = "", internal: str = ""):
        self.dialogue = dialogue
        self.action = action
        self.emotion = emotion
        self.internal = internal

    @classmethod
    def from_json(cls, text: str) -> WriterResponse:
        try:
            data = json.loads(text)
            return cls(
                dialogue=data.get("dialogue", text),
                action=data.get("action"),
                emotion=data.get("emotion", ""),
                internal=data.get("internal", ""),
            )
        except (json.JSONDecodeError, AttributeError):
            return cls(dialogue=text)


class Writer:
    """Produces LLM-generated text for the 6 writing jobs."""

    def __init__(self, llm: LLMProvider, tracker: TokenTracker | None = None):
        self._llm = llm
        self._tracker = tracker or TokenTracker()

    async def generate_dialogue_response(
        self,
        character: Character,
        scene: SceneContext,
        player_input: str,
        events: list[Event] | None = None,
        player_relationship: Relationship | None = None,
        storyteller_goal: str | None = None,
        conversation_history: list[dict[str, str]] | None = None,
    ) -> WriterResponse:
        """Generate an in-character response (LLM job: free_text_interpretation)."""
        system = build_writer_system_prompt(
            character, scene, events or [],
            player_relationship, storyteller_goal,
        )
        messages = build_writer_messages(player_input, conversation_history)

        response = await self._llm.generate(
            messages=messages, system=system,
            temperature=0.7, response_format=dict,
        )
        self._tracker.record_response(
            self._llm.provider_name, self._llm.model_name,
            LLMJob.FREE_TEXT, response, entity_id=character.id,
        )
        return WriterResponse.from_json(response.text)

    async def generate_ambient_dialogue(
        self,
        character: Character,
        scene: SceneContext,
        events: list[Event] | None = None,
    ) -> WriterResponse:
        """Generate an ambient one-liner (LLM job: ambient_npc_dialogue)."""
        system = build_writer_system_prompt(character, scene, events or [])
        messages = [{"role": "user", "content":
            "Generate a brief ambient line — something this character would "
            "mutter, say to someone nearby, or think out loud. Keep it to "
            "one or two sentences. Stay in character."}]

        response = await self._llm.generate(
            messages=messages, system=system,
            temperature=0.9, max_tokens=200, response_format=dict,
        )
        self._tracker.record_response(
            self._llm.provider_name, self._llm.model_name,
            LLMJob.AMBIENT_DIALOGUE, response, entity_id=character.id,
        )
        return WriterResponse.from_json(response.text)

    async def generate_narration(
        self,
        event_description: str,
        scene: SceneContext,
        tone: str = "",
    ) -> str:
        """Narrate a dynamic event (LLM job: dynamic_event_narration)."""
        system = f"You are a narrator for a {tone or 'gritty sci-fi'} story. " \
                 f"Describe what happens concisely and vividly. 2-3 sentences max."
        messages = [{"role": "user", "content":
            f"Narrate this event at {scene.place.name}: {event_description}"}]

        response = await self._llm.generate(
            messages=messages, system=system,
            temperature=0.8, max_tokens=500,
        )
        self._tracker.record_response(
            self._llm.provider_name, self._llm.model_name,
            LLMJob.DYNAMIC_NARRATION, response,
        )
        return response.text

    async def generate_convergence(
        self,
        character: Character,
        scene: SceneContext,
        current_context: str,
        target_node_text: str,
    ) -> str:
        """Bridge from unauthored branch back to authored node (LLM job: dialogue_convergence)."""
        system = build_writer_system_prompt(character, scene, [])
        messages = [{"role": "user", "content":
            f"The conversation has gone off-script. Current context: {current_context}\n\n"
            f"You need to naturally steer the conversation toward this topic/line: "
            f"\"{target_node_text}\"\n\n"
            f"Write a brief in-character transition line (1-2 sentences) that bridges "
            f"from the current context to that topic."}]

        response = await self._llm.generate(
            messages=messages, system=system,
            temperature=0.7, max_tokens=200,
        )
        self._tracker.record_response(
            self._llm.provider_name, self._llm.model_name,
            LLMJob.CONVERGENCE, response, entity_id=character.id,
        )
        return response.text
