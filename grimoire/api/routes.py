"""API route definitions — powered by GameSession."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request, WebSocket
from pydantic import BaseModel

logger = logging.getLogger(__name__)

from grimoire.engine.game_state import PlayerAction
from grimoire.engine.session import GameSession
from grimoire.loader.world_loader import load_world

router = APIRouter(prefix="/game")


def _get_session(request: Request) -> GameSession:
    session: GameSession | None = getattr(request.app, "session", None)
    if session is None:
        raise HTTPException(status_code=400, detail="Game not started. POST /game/start first.")
    return session


# --- Request/response models ---

class StartRequest(BaseModel):
    world_path: str
    player_start: str = ""
    llm_provider: str = "ollama"
    llm_model: str = ""


class DialogueInput(BaseModel):
    character_id: str
    text: str


# --- Routes ---

@router.post("/start")
async def start_game(req: StartRequest, request: Request):
    logger.info("Starting game with world_path=%r, player_start=%r", req.world_path, req.player_start)
    world_data = load_world(req.world_path)
    logger.info("World loaded: characters=%s, places=%s", list(world_data.characters.keys()), list(world_data.places.keys()))

    llm = _create_llm_provider(req.llm_provider, req.llm_model)

    # Try to load embeddings
    embedder = None
    try:
        from grimoire.llm.embeddings import LocalEmbeddingProvider
        embedder = LocalEmbeddingProvider()
    except Exception:
        pass

    # Set up storage
    db = None
    vector_store = None
    try:
        from grimoire.storage.database import Database
        db = Database()
        await db.connect()
    except Exception:
        pass

    try:
        from grimoire.storage.vector_store import VectorStore
        vector_store = VectorStore(embedder=embedder)
    except Exception:
        pass

    session = GameSession(
        world_data, llm=llm, embedder=embedder, start_location=req.player_start,
        db=db, vector_store=vector_store,
    )
    request.app.session = session  # type: ignore[attr-defined]

    return {
        "status": "started",
        "world": world_data.name,
        "player_location": session.game_state.player_location,
        "characters": list(world_data.characters.keys()),
        "places": list(world_data.places.keys()),
        "llm": llm.provider_name if llm else "none",
        "embeddings": embedder is not None,
        "storage": {"db": db is not None, "vector_store": vector_store is not None},
    }


@router.post("/action")
async def player_action(action: PlayerAction, request: Request):
    session = _get_session(request)
    result = await session.process_action(action)
    return result.model_dump()


@router.get("/state")
async def get_state(request: Request):
    session = _get_session(request)
    gs = session.game_state
    return {
        "tick": gs.tick,
        "hour": gs.time.hour,
        "day": gs.time.day,
        "player_location": gs.player_location,
        "flags": gs.flags,
        "quest_states": gs.quest_states,
        "event_count": len(gs.event_log),
        "token_usage": session.tracker.total_tokens,
        "token_by_job": session.tracker.summary_by_job(),
    }


@router.get("/scene/{place_id}")
async def get_scene(place_id: str, request: Request):
    session = _get_session(request)
    try:
        scene = session.game_state.get_scene(place_id)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"Unknown place: {place_id}")
    return {
        "place": scene.place.model_dump(),
        "npcs": [npc.model_dump(include={"id", "name", "occupation"})
                 for npc in scene.npcs_present],
        "recent_events": [e.model_dump() for e in scene.recent_events],
        "atmosphere": scene.atmosphere,
    }


@router.post("/dialogue")
async def dialogue(input: DialogueInput, request: Request):
    session = _get_session(request)
    gs = session.game_state
    char_id = input.character_id
    logger.info("Dialogue request: character_id=%r, text=%r, known_characters=%s", char_id, input.text, list(gs.world.characters.keys()))

    char = gs.get_character(char_id)
    if char is None:
        raise HTTPException(status_code=404, detail=f"Unknown character: {char_id}")

    place = gs.get_place(gs.player_location)
    if place and char_id not in place.current_npcs:
        raise HTTPException(status_code=400, detail=f"{char.name} is not here.")

    # Check if there's an active dialogue already
    active = session.get_active_dialogue(char_id)
    if active is None:
        # Start new dialogue
        result = await session.start_dialogue(char_id)
    else:
        # Continue existing dialogue
        result = await session.dialogue_input(char_id, input.text)

    resp: dict[str, Any] = {
        "speaker": result.speaker,
        "text": result.text,
        "choices": result.choices,
        "is_ended": result.is_ended,
        "flags_changed": result.flags_changed,
    }
    if result.matched_choice:
        resp["matched_choice"] = result.matched_choice
    if result.writer_response:
        resp["llm_generated"] = True
        resp["emotion"] = result.writer_response.emotion
        resp["action"] = result.writer_response.action
        resp["internal"] = result.writer_response.internal
    return resp


@router.post("/dialogue/end")
async def end_dialogue(request: Request, character_id: str):
    session = _get_session(request)
    session.end_dialogue(character_id)
    return {"status": "ended"}


@router.get("/characters")
async def list_characters(request: Request):
    session = _get_session(request)
    chars = session.game_state.world.characters
    return [
        {"id": c.id, "name": c.name, "occupation": c.occupation, "location": c.location}
        for c in chars.values()
    ]


@router.get("/events")
async def get_events(request: Request, location: str = None, participant: str = None,
                     since_tick: int = None, limit: int = 50):
    session = _get_session(request)
    events = session.game_state.event_log.query(
        location=location, participant=participant,
        since_tick=since_tick, limit=limit,
    )
    return [e.model_dump() for e in events]


@router.get("/beats")
async def get_beats(request: Request):
    session = _get_session(request)
    return [b.model_dump() for b in session.director.get_active_beats()]


class SaveRequest(BaseModel):
    save_path: str


@router.post("/save")
async def save_game_endpoint(req: SaveRequest, request: Request):
    from grimoire.storage.save_load import save_game
    session = _get_session(request)
    world_path = getattr(request.app, "world_path", "")
    save_game(session.game_state, world_path, req.save_path, director=session.director)
    return {"status": "saved", "path": req.save_path}


class LoadRequest(BaseModel):
    save_path: str


@router.post("/load")
async def load_game_endpoint(req: LoadRequest, request: Request):
    from grimoire.storage.save_load import load_game, restore_game_state
    session = _get_session(request)
    save_data = load_game(req.save_path)
    restore_game_state(save_data, session.game_state, director=session.director)
    return {
        "status": "loaded",
        "tick": session.game_state.tick,
        "player_location": session.game_state.player_location,
    }


@router.websocket("/stream")
async def websocket_stream(websocket: WebSocket):
    await websocket.accept()
    await websocket.send_json({"type": "connected", "message": "Grimoire Engine stream ready"})
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_json({"type": "ack", "received": data})
    except Exception:
        pass


def _create_llm_provider(provider_name: str, model: str = ""):
    if provider_name == "ollama":
        from grimoire.llm.ollama import OllamaProvider
        return OllamaProvider(model=model or "hf.co/unsloth/Qwen3-30B-A3B-GGUF:Q4_K_M")
    elif provider_name == "anthropic":
        from grimoire.llm.anthropic import AnthropicProvider
        return AnthropicProvider(model=model or "claude-sonnet-4-20250514")
    elif provider_name == "openai":
        from grimoire.llm.openai import OpenAIProvider
        return OpenAIProvider(model=model or "gpt-4o")
    return None
