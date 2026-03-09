"""Armor CRUD routes — game data stored as JSON (consumed directly by Godot)."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request

from editor.backend.json_io import delete_json, list_json_files, read_json, write_json

router = APIRouter(prefix="/armor", tags=["armor"])


def _armor_dir(request: Request) -> Path:
    return Path(request.app.state.game_data_path) / "armor"


@router.get("")
async def list_armor(request: Request) -> list[dict]:
    armor_dir = _armor_dir(request)
    results = []
    for path in list_json_files(armor_dir):
        data = read_json(path)
        results.append({
            "id": data.get("id", path.stem),
            "name": data.get("name", ""),
            "rarity": data.get("rarity", "common"),
            "equip_weight": data.get("equip_weight", 0),
            "mod_slots": data.get("mod_slots", 0),
            "file": path.name,
        })
    return results


@router.get("/{armor_id}")
async def get_armor(armor_id: str, request: Request) -> dict:
    path = _armor_dir(request) / f"{armor_id}.json"
    if not path.exists():
        raise HTTPException(404, f"Armor not found: {armor_id}")
    return read_json(path)


@router.post("")
async def create_armor(data: dict, request: Request) -> dict:
    armor_id = data.get("id", "")
    if not armor_id:
        raise HTTPException(400, "Armor must have an id")
    path = _armor_dir(request) / f"{armor_id}.json"
    if path.exists():
        raise HTTPException(409, f"Armor already exists: {armor_id}")
    path.parent.mkdir(parents=True, exist_ok=True)
    write_json(path, data)
    return {"status": "created", "id": armor_id}


@router.put("/{armor_id}")
async def update_armor(armor_id: str, data: dict, request: Request) -> dict:
    path = _armor_dir(request) / f"{armor_id}.json"
    if not path.exists():
        raise HTTPException(404, f"Armor not found: {armor_id}")
    new_id = data.get("id", armor_id)
    if new_id != armor_id:
        delete_json(path)
        path = _armor_dir(request) / f"{new_id}.json"
    write_json(path, data)
    return {"status": "updated", "id": new_id}


@router.delete("/{armor_id}")
async def delete_armor(armor_id: str, request: Request) -> dict:
    path = _armor_dir(request) / f"{armor_id}.json"
    if not delete_json(path):
        raise HTTPException(404, f"Armor not found: {armor_id}")
    return {"status": "deleted", "id": armor_id}
