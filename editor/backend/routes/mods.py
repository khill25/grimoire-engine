"""Mod CRUD routes — game data stored as JSON (consumed directly by Godot)."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request

from editor.backend.json_io import delete_json, list_json_files, read_json, write_json

router = APIRouter(prefix="/mods", tags=["mods"])


def _mods_dir(request: Request) -> Path:
    return Path(request.app.state.game_data_path) / "mods"


@router.get("")
async def list_mods(request: Request) -> list[dict]:
    mods_dir = _mods_dir(request)
    results = []
    for path in list_json_files(mods_dir):
        data = read_json(path)
        results.append({
            "id": data.get("id", path.stem),
            "name": data.get("name", ""),
            "rarity": data.get("rarity", "common"),
            "kind": data.get("kind", ""),
            "slot_type": data.get("slot_type", ""),
            "file": path.name,
        })
    return results


@router.get("/{mod_id}")
async def get_mod(mod_id: str, request: Request) -> dict:
    path = _mods_dir(request) / f"{mod_id}.json"
    if not path.exists():
        raise HTTPException(404, f"Mod not found: {mod_id}")
    return read_json(path)


@router.post("")
async def create_mod(data: dict, request: Request) -> dict:
    mod_id = data.get("id", "")
    if not mod_id:
        raise HTTPException(400, "Mod must have an id")
    path = _mods_dir(request) / f"{mod_id}.json"
    if path.exists():
        raise HTTPException(409, f"Mod already exists: {mod_id}")
    path.parent.mkdir(parents=True, exist_ok=True)
    write_json(path, data)
    return {"status": "created", "id": mod_id}


@router.put("/{mod_id}")
async def update_mod(mod_id: str, data: dict, request: Request) -> dict:
    path = _mods_dir(request) / f"{mod_id}.json"
    if not path.exists():
        raise HTTPException(404, f"Mod not found: {mod_id}")
    new_id = data.get("id", mod_id)
    if new_id != mod_id:
        delete_json(path)
        path = _mods_dir(request) / f"{new_id}.json"
    write_json(path, data)
    return {"status": "updated", "id": new_id}


@router.delete("/{mod_id}")
async def delete_mod(mod_id: str, request: Request) -> dict:
    path = _mods_dir(request) / f"{mod_id}.json"
    if not delete_json(path):
        raise HTTPException(404, f"Mod not found: {mod_id}")
    return {"status": "deleted", "id": mod_id}
