"""Item CRUD routes — game data (separate from world/story content)."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request

from editor.backend.yaml_io import delete_yaml, list_yaml_files, read_yaml, write_yaml

router = APIRouter(prefix="/items", tags=["items"])


def _items_dir(request: Request) -> Path:
    return Path(request.app.state.game_data_path) / "items"


@router.get("")
async def list_items(request: Request) -> list[dict]:
    items_dir = _items_dir(request)
    results = []
    for path in list_yaml_files(items_dir):
        data = read_yaml(path)
        results.append({
            "id": data.get("id", path.stem),
            "name": data.get("name", ""),
            "type": data.get("type", ""),
            "rarity": data.get("rarity", "common"),
            "value": data.get("value", 0),
            "file": path.name,
        })
    return results


@router.get("/{item_id}")
async def get_item(item_id: str, request: Request) -> dict:
    path = _items_dir(request) / f"{item_id}.yaml"
    if not path.exists():
        raise HTTPException(404, f"Item not found: {item_id}")
    return read_yaml(path)


@router.post("")
async def create_item(data: dict, request: Request) -> dict:
    item_id = data.get("id", "")
    if not item_id:
        raise HTTPException(400, "Item must have an id")
    path = _items_dir(request) / f"{item_id}.yaml"
    if path.exists():
        raise HTTPException(409, f"Item already exists: {item_id}")
    path.parent.mkdir(parents=True, exist_ok=True)
    write_yaml(path, data)
    return {"status": "created", "id": item_id}


@router.put("/{item_id}")
async def update_item(item_id: str, data: dict, request: Request) -> dict:
    path = _items_dir(request) / f"{item_id}.yaml"
    if not path.exists():
        raise HTTPException(404, f"Item not found: {item_id}")
    new_id = data.get("id", item_id)
    if new_id != item_id:
        delete_yaml(path)
        path = _items_dir(request) / f"{new_id}.yaml"
    write_yaml(path, data)
    return {"status": "updated", "id": new_id}


@router.delete("/{item_id}")
async def delete_item(item_id: str, request: Request) -> dict:
    path = _items_dir(request) / f"{item_id}.yaml"
    if not delete_yaml(path):
        raise HTTPException(404, f"Item not found: {item_id}")
    return {"status": "deleted", "id": item_id}
