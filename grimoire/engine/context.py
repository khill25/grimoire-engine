"""Context assembly — Storyteller -> Writer pipeline."""

from __future__ import annotations

from grimoire.engine.game_state import GameState, SceneContext
from grimoire.models.character import Character
from grimoire.models.common import Relationship
from grimoire.models.event import Event


SYSTEM_PROMPT_TEMPLATE = """You are simulating {name}, a character in a living world.

PERSONALITY: {personality}
SPEECH STYLE: {speech_style}
MOTIVATIONS: {motivations}
CURRENT GOALS: {goals}
CURRENT WANTS: {wants}

You are currently at {location}. {scene_name}{atmosphere}
{scene_description}

RELATIONSHIP WITH PLAYER: {relationship_summary}

RECENT EVENTS YOU KNOW ABOUT:
{events}

{storyteller_direction}

Respond ONLY as {name}. Stay in character. Do not break the fourth wall.
You know ONLY what is described above. Do not invent additional facts about the world.
Your response should NOT create major story changes unless explicitly directed.

Respond in this JSON format:
{{
  "dialogue": "What you say out loud",
  "action": "Physical action you take, or null",
  "emotion": "Your current emotional state",
  "internal": "What you're thinking but not saying"
}}"""


def _format_goals(character: Character) -> str:
    active = [g for g in character.goals if g.status == "active"]
    if not active:
        return "None currently"
    return "; ".join(f"{g.description} ({g.progress})" if g.progress else g.description
                     for g in active)


def _format_events(events: list[Event]) -> str:
    if not events:
        return "Nothing notable recently."
    lines = []
    for e in events[-10:]:  # Last 10 events
        lines.append(f"- {e.summary}")
    return "\n".join(lines)


def _format_relationship(rel: Relationship | None) -> str:
    if rel is None:
        return "You don't know this person."
    parts = [f"Relationship: {', '.join(rel.types)}"]
    if rel.trust > 0.5:
        parts.append("You trust them.")
    elif rel.trust < -0.3:
        parts.append("You don't trust them.")
    if rel.disposition > 0.5:
        parts.append("You like them.")
    elif rel.disposition < -0.3:
        parts.append("You dislike them.")
    if rel.history:
        parts.append(f"History: {rel.history}")
    return " ".join(parts)


def build_writer_system_prompt(
    character: Character,
    scene: SceneContext,
    events: list[Event],
    player_relationship: Relationship | None = None,
    storyteller_goal: str | None = None,
) -> str:
    """Build the system prompt for a Writer LLM call."""
    npcs_here = ", ".join(npc.name for npc in scene.npcs_present if npc.id != character.id)
    scene_desc = f"Others present: {npcs_here}" if npcs_here else "You are alone here."

    direction = ""
    if storyteller_goal:
        direction = f"STORYTELLER DIRECTION: {storyteller_goal}"

    # Include scene-level detail if available
    scene_name = ""
    if scene.scene and scene.scene.name:
        scene_name = f"Specifically in the {scene.scene.name}. "

    return SYSTEM_PROMPT_TEMPLATE.format(
        name=character.name,
        personality=character.personality,
        speech_style=character.speech_style,
        motivations=", ".join(character.motivations),
        goals=_format_goals(character),
        wants=", ".join(character.wants) if character.wants else "Nothing pressing",
        location=scene.place.name,
        scene_name=scene_name,
        atmosphere=scene.atmosphere,
        scene_description=scene_desc,
        relationship_summary=_format_relationship(player_relationship),
        events=_format_events(events),
        storyteller_direction=direction,
    )


def build_writer_messages(
    player_input: str,
    conversation_history: list[dict[str, str]] | None = None,
) -> list[dict[str, str]]:
    """Build the message list for a Writer LLM call."""
    messages: list[dict[str, str]] = []
    if conversation_history:
        messages.extend(conversation_history)
    messages.append({"role": "user", "content": player_input})
    return messages
