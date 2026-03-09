"""Loot table CRUD routes — game data stored as JSON (consumed directly by Godot)."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request

from editor.backend.json_io import delete_json, list_json_files, read_json, write_json

router = APIRouter(prefix="/loot-tables", tags=["loot-tables"])


def _loot_dir(request: Request) -> Path:
    return Path(request.app.state.game_data_path) / "loot_tables"


def _name_to_filename(name: str) -> str:
    return name.lower().replace(" ", "_")


@router.get("")
async def list_loot_tables(request: Request) -> list[dict]:
    loot_dir = _loot_dir(request)
    results = []
    for path in list_json_files(loot_dir):
        data = read_json(path)
        results.append({
            "name": data.get("name", path.stem),
            "chance_any_drop": data.get("chance_any_drop", 0),
            "min_items": data.get("min_items", 0),
            "max_items": data.get("max_items", 0),
            "entry_count": len(data.get("entries", [])),
            "file": path.name,
        })
    return results


@router.get("/{table_name}")
async def get_loot_table(table_name: str, request: Request) -> dict:
    path = _loot_dir(request) / f"{table_name}.json"
    if not path.exists():
        raise HTTPException(404, f"Loot table not found: {table_name}")
    return read_json(path)


@router.post("")
async def create_loot_table(data: dict, request: Request) -> dict:
    name = data.get("name", "")
    if not name:
        raise HTTPException(400, "Loot table must have a name")
    filename = _name_to_filename(name)
    path = _loot_dir(request) / f"{filename}.json"
    if path.exists():
        raise HTTPException(409, f"Loot table already exists: {name}")
    path.parent.mkdir(parents=True, exist_ok=True)
    write_json(path, data)
    return {"status": "created", "name": filename}


@router.put("/{table_name}")
async def update_loot_table(table_name: str, data: dict, request: Request) -> dict:
    path = _loot_dir(request) / f"{table_name}.json"
    if not path.exists():
        raise HTTPException(404, f"Loot table not found: {table_name}")
    new_name = _name_to_filename(data.get("name", table_name))
    if new_name != table_name:
        delete_json(path)
        path = _loot_dir(request) / f"{new_name}.json"
    write_json(path, data)
    return {"status": "updated", "name": new_name}


@router.delete("/{table_name}")
async def delete_loot_table(table_name: str, request: Request) -> dict:
    path = _loot_dir(request) / f"{table_name}.json"
    if not delete_json(path):
        raise HTTPException(404, f"Loot table not found: {table_name}")
    return {"status": "deleted", "name": table_name}
