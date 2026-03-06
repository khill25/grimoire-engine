"""Story bible CRUD routes — acts and beats."""

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


def _read_bible(request: Request) -> dict:
    path = _story_path(request)
    if not path.exists():
        return {"title": "", "description": "", "acts": []}
    return read_yaml(path)


def _write_bible(request: Request, bible: dict) -> None:
    path = _story_path(request)
    path.parent.mkdir(parents=True, exist_ok=True)
    write_yaml(path, bible)


# --- Story bible ---

@router.get("")
async def get_story_bible(request: Request) -> dict:
    return _read_bible(request)


@router.put("")
async def update_story_bible(request: Request, data: dict) -> dict:
    _write_bible(request, data)
    return {"status": "updated"}


# --- Acts ---

@router.get("/acts")
async def list_acts(request: Request) -> list[dict]:
    bible = _read_bible(request)
    return bible.get("acts", [])


@router.post("/acts")
async def create_act(data: dict, request: Request) -> dict:
    bible = _read_bible(request)
    acts = bible.setdefault("acts", [])
    if not data.get("id"):
        data["id"] = f"act_{len(acts) + 1}"
    if not data.get("name"):
        data["name"] = data["id"]
    data.setdefault("description", "")
    data.setdefault("beats", [])
    acts.append(data)
    _write_bible(request, bible)
    return data


@router.put("/acts/{act_id}")
async def update_act(act_id: str, data: dict, request: Request) -> dict:
    bible = _read_bible(request)
    for i, act in enumerate(bible.get("acts", [])):
        if act.get("id") == act_id:
            # Preserve beats if not provided
            if "beats" not in data:
                data["beats"] = act.get("beats", [])
            bible["acts"][i] = data
            _write_bible(request, bible)
            return {"status": "updated", "id": act_id}
    raise HTTPException(404, f"Act not found: {act_id}")


@router.delete("/acts/{act_id}")
async def delete_act(act_id: str, request: Request) -> dict:
    bible = _read_bible(request)
    acts = bible.get("acts", [])
    bible["acts"] = [a for a in acts if a.get("id") != act_id]
    if len(bible["acts"]) == len(acts):
        raise HTTPException(404, f"Act not found: {act_id}")
    _write_bible(request, bible)
    return {"status": "deleted", "id": act_id}


# --- Beats ---

@router.get("/beats")
async def list_beats(request: Request) -> list[dict]:
    bible = _read_bible(request)
    beats = []
    for act in bible.get("acts", []):
        for beat in act.get("beats", []):
            beat["act_id"] = act.get("id", "")
            beat["act_name"] = act.get("name", "")
            beats.append(beat)
    return beats


@router.post("/acts/{act_id}/beats")
async def create_beat(act_id: str, data: dict, request: Request) -> dict:
    bible = _read_bible(request)
    for act in bible.get("acts", []):
        if act.get("id") == act_id:
            beats = act.setdefault("beats", [])
            if not data.get("id"):
                data["id"] = f"beat_{len(beats) + 1}"
            if not data.get("name"):
                data["name"] = data["id"]
            data.setdefault("description", "")
            data.setdefault("status", "pending")
            data.setdefault("trigger", {})
            beats.append(data)
            _write_bible(request, bible)
            return data
    raise HTTPException(404, f"Act not found: {act_id}")


@router.put("/beats/{beat_id}")
async def update_beat(beat_id: str, beat_data: dict, request: Request) -> dict:
    bible = _read_bible(request)
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
    _write_bible(request, bible)
    return {"status": "updated", "id": beat_id}


@router.delete("/beats/{beat_id}")
async def delete_beat(beat_id: str, request: Request) -> dict:
    bible = _read_bible(request)
    found = False
    for act in bible.get("acts", []):
        beats = act.get("beats", [])
        for i, beat in enumerate(beats):
            if beat.get("id") == beat_id:
                beats.pop(i)
                found = True
                break
        if found:
            break
    if not found:
        raise HTTPException(404, f"Beat not found: {beat_id}")
    _write_bible(request, bible)
    return {"status": "deleted", "id": beat_id}
