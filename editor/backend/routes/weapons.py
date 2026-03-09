"""Weapon CRUD routes — game data stored as JSON (consumed directly by Godot)."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request

from editor.backend.json_io import delete_json, list_json_files, read_json, write_json

router = APIRouter(prefix="/weapons", tags=["weapons"])


def _weapons_dir(request: Request) -> Path:
    return Path(request.app.state.game_data_path) / "weapons"


@router.get("")
async def list_weapons(request: Request) -> list[dict]:
    weapons_dir = _weapons_dir(request)
    results = []
    for path in list_json_files(weapons_dir):
        data = read_json(path)
        results.append({
            "id": data.get("id", path.stem),
            "name": data.get("name", ""),
            "rarity": data.get("rarity", "common"),
            "weapon_kind": data.get("weapon_kind", ""),
            "damage_type": data.get("damage_type", ""),
            "base_damage": data.get("base_damage", 0),
            "file": path.name,
        })
    return results


@router.get("/{weapon_id}")
async def get_weapon(weapon_id: str, request: Request) -> dict:
    path = _weapons_dir(request) / f"{weapon_id}.json"
    if not path.exists():
        raise HTTPException(404, f"Weapon not found: {weapon_id}")
    return read_json(path)


@router.post("")
async def create_weapon(data: dict, request: Request) -> dict:
    weapon_id = data.get("id", "")
    if not weapon_id:
        raise HTTPException(400, "Weapon must have an id")
    path = _weapons_dir(request) / f"{weapon_id}.json"
    if path.exists():
        raise HTTPException(409, f"Weapon already exists: {weapon_id}")
    path.parent.mkdir(parents=True, exist_ok=True)
    write_json(path, data)
    return {"status": "created", "id": weapon_id}


@router.put("/{weapon_id}")
async def update_weapon(weapon_id: str, data: dict, request: Request) -> dict:
    path = _weapons_dir(request) / f"{weapon_id}.json"
    if not path.exists():
        raise HTTPException(404, f"Weapon not found: {weapon_id}")
    new_id = data.get("id", weapon_id)
    if new_id != weapon_id:
        delete_json(path)
        path = _weapons_dir(request) / f"{new_id}.json"
    write_json(path, data)
    return {"status": "updated", "id": new_id}


@router.delete("/{weapon_id}")
async def delete_weapon(weapon_id: str, request: Request) -> dict:
    path = _weapons_dir(request) / f"{weapon_id}.json"
    if not delete_json(path):
        raise HTTPException(404, f"Weapon not found: {weapon_id}")
    return {"status": "deleted", "id": weapon_id}
