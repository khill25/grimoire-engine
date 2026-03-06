"""Story bible CRUD routes."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request

from editor.backend.yaml_io import read_yaml, write_yaml

router = APIRouter(prefix="/story", tags=["story"])


def _story_path(request: Request) -> Path:
    """Find story bible — checks new layout (grimoire.yaml) then old (story/story_bible.yaml)."""
    story_root = Path(request.app.state.story_path)
    # New layout
    grimoire = story_root / "grimoire.yaml"
    if grimoire.exists():
        return grimoire
    # Old layout
    old = Path(request.app.state.world_path) / "story" / "story_bible.yaml"
    if old.exists():
        return old
    # Default to new layout path for creation
    if request.app.state.layout == "story":
        return grimoire
    return old


@router.get("")
async def get_story_bible(request: Request) -> dict:
    path = _story_path(request)
    if not path.exists():
        return {"title": "", "description": "", "acts": []}
    return read_yaml(path)


@router.put("")
async def update_story_bible(request: Request, data: dict) -> dict:
    path = _story_path(request)
    write_yaml(path, data)
    return {"status": "updated"}


@router.get("/beats")
async def list_beats(request: Request) -> list[dict]:
    path = _story_path(request)
    if not path.exists():
        return []
    bible = read_yaml(path)
    beats = []
    for act in bible.get("acts", []):
        for beat in act.get("beats", []):
            beat["act_id"] = act.get("id", "")
            beat["act_name"] = act.get("name", "")
            beats.append(beat)
    return beats


@router.put("/beats/{beat_id}")
async def update_beat(beat_id: str, beat_data: dict, request: Request) -> dict:
    path = _story_path(request)
    if not path.exists():
        raise HTTPException(404, "Story bible not found")
    bible = read_yaml(path)
    found = False
    for act in bible.get("acts", []):
        for i, beat in enumerate(act.get("beats", [])):
            if beat.get("id") == beat_id:
                # Preserve act-level keys we added
                beat_data.pop("act_id", None)
                beat_data.pop("act_name", None)
                act["beats"][i] = beat_data
                found = True
                break
        if found:
            break
    if not found:
        raise HTTPException(404, f"Beat not found: {beat_id}")
    write_yaml(path, bible)
    return {"status": "updated", "id": beat_id}
