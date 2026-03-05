"""Dialogue tree models — authored conversation structures."""

from typing import Any

from pydantic import BaseModel


class DialogueChoice(BaseModel):
    id: str
    text: str  # authored player option
    next_node: str  # dialogue_node_id
    condition: str | None = None  # state condition for this choice to appear
    embedding: list[float] | None = None  # precomputed for free-text matching


class DialogueNode(BaseModel):
    id: str
    speaker: str  # character_id
    text: str  # what the NPC says at this node
    condition: str | None = None  # state condition to reach this node
    state_changes: dict[str, Any] | None = None  # flags/state to set when this node fires
    choices: list[DialogueChoice] = []
    llm_escape: bool = False  # if True, LLM can generate responses at this node
    is_key_moment: bool = False  # if True, always use authored text, never LLM


class DialogueTree(BaseModel):
    id: str
    character_id: str
    context: str  # when this tree activates (e.g. "first_meeting", "quest_active")
    root_node: str  # starting dialogue_node_id
    nodes: list[DialogueNode]
