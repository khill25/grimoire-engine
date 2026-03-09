"""Spell CRUD routes — game data stored as JSON (consumed directly by Godot)."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request

from editor.backend.json_io import delete_json, list_json_files, read_json, write_json

router = APIRouter(prefix="/spells", tags=["spells"])


def _spells_dir(request: Request) -> Path:
    return Path(request.app.state.game_data_path) / "spells"


@router.get("")
async def list_spells(request: Request) -> list[dict]:
    spells_dir = _spells_dir(request)
    results = []
    for path in list_json_files(spells_dir):
        data = read_json(path)
        results.append({
            "id": data.get("id", path.stem),
            "name": data.get("name", ""),
            "rarity": data.get("rarity", "common"),
            "damage_type": data.get("damage_type", ""),
            "mana_cost": data.get("mana_cost", 0),
            "base_damage": data.get("base_damage", 0),
            "file": path.name,
        })
    return results


@router.get("/{spell_id}")
async def get_spell(spell_id: str, request: Request) -> dict:
    path = _spells_dir(request) / f"{spell_id}.json"
    if not path.exists():
        raise HTTPException(404, f"Spell not found: {spell_id}")
    return read_json(path)


@router.post("")
async def create_spell(data: dict, request: Request) -> dict:
    spell_id = data.get("id", "")
    if not spell_id:
        raise HTTPException(400, "Spell must have an id")
    path = _spells_dir(request) / f"{spell_id}.json"
    if path.exists():
        raise HTTPException(409, f"Spell already exists: {spell_id}")
    path.parent.mkdir(parents=True, exist_ok=True)
    write_json(path, data)
    return {"status": "created", "id": spell_id}


@router.put("/{spell_id}")
async def update_spell(spell_id: str, data: dict, request: Request) -> dict:
    path = _spells_dir(request) / f"{spell_id}.json"
    if not path.exists():
        raise HTTPException(404, f"Spell not found: {spell_id}")
    new_id = data.get("id", spell_id)
    if new_id != spell_id:
        delete_json(path)
        path = _spells_dir(request) / f"{new_id}.json"
    write_json(path, data)
    return {"status": "updated", "id": new_id}


@router.delete("/{spell_id}")
async def delete_spell(spell_id: str, request: Request) -> dict:
    path = _spells_dir(request) / f"{spell_id}.json"
    if not delete_json(path):
        raise HTTPException(404, f"Spell not found: {spell_id}")
    return {"status": "deleted", "id": spell_id}
