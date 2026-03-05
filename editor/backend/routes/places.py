"""Place CRUD routes."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from pydantic import ValidationError

from grimoire.models.place import Place
from editor.backend.yaml_io import delete_yaml, list_yaml_files, read_yaml, write_yaml

router = APIRouter(prefix="/places", tags=["places"])


def _places_dir(request: Request) -> Path:
    return Path(request.app.state.world_path) / "places"


@router.get("")
async def list_places(request: Request) -> list[dict]:
    places_dir = _places_dir(request)
    results = []
    for path in list_yaml_files(places_dir):
        data = read_yaml(path)
        results.append({
            "id": data.get("id", path.stem),
            "name": data.get("name", ""),
            "type": data.get("type", ""),
            "region": data.get("region", ""),
            "connections": data.get("connections", []),
            "file": path.name,
        })
    return results


@router.get("/{place_id}")
async def get_place(place_id: str, request: Request) -> dict:
    path = _places_dir(request) / f"{place_id}.yaml"
    if not path.exists():
        raise HTTPException(404, f"Place not found: {place_id}")
    data = read_yaml(path)
    try:
        place = Place(**data)
        return place.model_dump()
    except ValidationError:
        return data


@router.post("")
async def create_place(place: Place, request: Request) -> dict:
    path = _places_dir(request) / f"{place.id}.yaml"
    if path.exists():
        raise HTTPException(409, f"Place already exists: {place.id}")
    write_yaml(path, place.model_dump())
    return {"status": "created", "id": place.id}


@router.put("/{place_id}")
async def update_place(place_id: str, place: Place, request: Request) -> dict:
    path = _places_dir(request) / f"{place_id}.yaml"
    if not path.exists():
        raise HTTPException(404, f"Place not found: {place_id}")
    if place.id != place_id:
        delete_yaml(path)
        path = _places_dir(request) / f"{place.id}.yaml"
    write_yaml(path, place.model_dump())
    return {"status": "updated", "id": place.id}


@router.delete("/{place_id}")
async def delete_place(place_id: str, request: Request) -> dict:
    path = _places_dir(request) / f"{place_id}.yaml"
    if not delete_yaml(path):
        raise HTTPException(404, f"Place not found: {place_id}")
    return {"status": "deleted", "id": place_id}
