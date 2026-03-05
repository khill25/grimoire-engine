"""LLM generation routes for content authoring."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter(prefix="/generate", tags=["generate"])
logger = logging.getLogger(__name__)


class GenerateRequest(BaseModel):
    prompt: str
    provider: str = "ollama"
    model: str = ""


class FieldAssistRequest(BaseModel):
    field: str
    context: dict[str, Any] = {}
    prompt: str = ""
    provider: str = "ollama"
    model: str = ""


def _extract_json(text: str) -> dict:
    """Extract JSON from LLM response, handling markdown code blocks."""
    # Try direct parse first
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # Try extracting from markdown code block
    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            pass
    # Try finding first { to last }
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass
    raise ValueError(f"Could not extract JSON from response: {text[:200]}")


async def _get_llm(provider: str = "ollama", model: str = ""):
    """Get an LLM provider instance."""
    if provider == "ollama":
        from grimoire.llm.ollama import OllamaProvider
        return OllamaProvider(model=model or "hf.co/unsloth/Qwen3-30B-A3B-GGUF:Q4_K_M")
    elif provider == "anthropic":
        from grimoire.llm.anthropic import AnthropicProvider
        return AnthropicProvider(model=model or "claude-sonnet-4-20250514")
    elif provider == "openai":
        from grimoire.llm.openai import OpenAIProvider
        return OpenAIProvider(model=model or "gpt-4o")
    raise HTTPException(400, f"Unknown provider: {provider}")


CHARACTER_SYSTEM = """You are a game content author for an RPG. Generate a character definition as JSON.
The character must fit the world context and be interesting for gameplay.

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "id": "snake_case_id",
  "name": "Full Name",
  "age": 30,
  "status": "alive",
  "backstory": "2-3 paragraphs of backstory",
  "personality": "Personality description",
  "speech_style": "How they talk",
  "motivations": ["motivation 1", "motivation 2", "motivation 3"],
  "goals": [{"id": "goal_id", "description": "goal desc", "motivation": "which motivation", "status": "active", "progress": ""}],
  "wants": ["immediate want 1", "immediate want 2"],
  "affinities": [{"target": "topic_or_entity", "score": 0.5, "reason": "why"}],
  "occupation": "Their job",
  "location": "place_id",
  "schedule": [{"time_start": 8, "time_end": 18, "location": "place_id", "activity": "what they do", "interruptible": true}],
  "relationships": [],
  "faction_ids": [],
  "protection": {"level": "none", "reason": "", "fallback": ""}
}"""

DIALOGUE_SYSTEM = """You are a game content author for an RPG. Generate a dialogue tree as JSON.
Create branching dialogue with multiple choices and meaningful consequences.

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "id": "tree_id",
  "character_id": "character_id",
  "context": "when this plays (e.g. first_meeting, quest_active)",
  "root_node": "greeting",
  "nodes": [
    {
      "id": "greeting",
      "speaker": "character_id",
      "text": "What the NPC says",
      "condition": null,
      "state_changes": null,
      "choices": [
        {"id": "choice_1", "text": "Player response", "next_node": "next_node_id", "condition": null, "embedding": null}
      ],
      "llm_escape": true,
      "is_key_moment": false
    }
  ]
}

Create at least 4-6 nodes with branching paths. Include state_changes on important nodes.
Mark greeting and climactic nodes as is_key_moment: true."""

STORY_BEAT_SYSTEM = """You are a game narrative designer. Generate story beats for an RPG.
Story beats are key narrative moments that drive the plot forward.

Return ONLY valid JSON array (no markdown, no explanation):
[
  {
    "id": "beat_id",
    "name": "Beat Name",
    "description": "What happens in this beat",
    "trigger": {"type": "event|flag|automatic", "condition": "trigger condition"},
    "status": "pending",
    "deadline": null,
    "allow_off_rails": false
  }
]

Generate 3-5 beats that form a coherent narrative arc."""

FIELD_PROMPTS = {
    "backstory": "Write a compelling 2-3 paragraph backstory for this character. Include formative experiences, secrets, and connections to the world. Character context: {context}",
    "personality": "Write a vivid personality description for this character. Include their temperament, quirks, strengths, and flaws. Character context: {context}",
    "speech_style": "Describe how this character speaks in a brief phrase. Include accent, vocabulary level, verbal tics, and tone. Character context: {context}",
    "description": "Write an atmospheric description of this location. Include sensory details, mood, and notable features. Context: {context}",
    "atmosphere": "Write a short atmospheric description capturing the feel of this place. Context: {context}",
}


@router.post("/character")
async def generate_character(req: GenerateRequest) -> dict:
    llm = await _get_llm(req.provider, req.model)
    try:
        response = await llm.generate(
            messages=[{"role": "user", "content": req.prompt}],
            system=CHARACTER_SYSTEM,
            temperature=0.8,
            max_tokens=2000,
        )
        data = _extract_json(response.text)
        return {"generated": data, "usage": response.usage.model_dump()}
    except Exception as e:
        logger.error("Character generation failed: %s", e)
        raise HTTPException(500, f"Generation failed: {e}")
    finally:
        if hasattr(llm, "close"):
            await llm.close()


@router.post("/dialogue")
async def generate_dialogue(req: GenerateRequest) -> dict:
    llm = await _get_llm(req.provider, req.model)
    try:
        response = await llm.generate(
            messages=[{"role": "user", "content": req.prompt}],
            system=DIALOGUE_SYSTEM,
            temperature=0.8,
            max_tokens=3000,
        )
        data = _extract_json(response.text)
        return {"generated": data, "usage": response.usage.model_dump()}
    except Exception as e:
        logger.error("Dialogue generation failed: %s", e)
        raise HTTPException(500, f"Generation failed: {e}")
    finally:
        if hasattr(llm, "close"):
            await llm.close()


@router.post("/story-beats")
async def generate_story_beats(req: GenerateRequest) -> dict:
    llm = await _get_llm(req.provider, req.model)
    try:
        response = await llm.generate(
            messages=[{"role": "user", "content": req.prompt}],
            system=STORY_BEAT_SYSTEM,
            temperature=0.8,
            max_tokens=2000,
        )
        text = response.text.strip()
        # Could be array or object
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            data = _extract_json(text)
            if isinstance(data, dict) and "beats" in data:
                data = data["beats"]
        if not isinstance(data, list):
            data = [data]
        return {"generated": data, "usage": response.usage.model_dump()}
    except Exception as e:
        logger.error("Story beat generation failed: %s", e)
        raise HTTPException(500, f"Generation failed: {e}")
    finally:
        if hasattr(llm, "close"):
            await llm.close()


@router.post("/field")
async def generate_field(req: FieldAssistRequest) -> dict:
    """Generate content for a specific field (backstory, personality, etc.)."""
    if req.field not in FIELD_PROMPTS and not req.prompt:
        raise HTTPException(400, f"Unknown field: {req.field}. Provide a custom prompt.")

    template = FIELD_PROMPTS.get(req.field, "{context}")
    context_str = ", ".join(f"{k}: {v}" for k, v in req.context.items() if v)
    system = "You are a game content writer. Write creative, concise content. Return ONLY the requested text, no JSON, no explanation."
    prompt = req.prompt if req.prompt else template.format(context=context_str)

    llm = await _get_llm(req.provider, req.model)
    try:
        response = await llm.generate(
            messages=[{"role": "user", "content": prompt}],
            system=system,
            temperature=0.8,
            max_tokens=500,
        )
        return {"generated": response.text, "usage": response.usage.model_dump()}
    except Exception as e:
        logger.error("Field generation failed: %s", e)
        raise HTTPException(500, f"Generation failed: {e}")
    finally:
        if hasattr(llm, "close"):
            await llm.close()
