"""Faction CRUD routes."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from pydantic import ValidationError

from grimoire.models.faction import Faction
from editor.backend.yaml_io import delete_yaml, list_yaml_files, read_yaml, write_yaml

router = APIRouter(prefix="/factions", tags=["factions"])


def _factions_dir(request: Request) -> Path:
    return Path(request.app.state.world_path) / "factions"


@router.get("")
async def list_factions(request: Request) -> list[dict]:
    factions_dir = _factions_dir(request)
    results = []
    for path in list_yaml_files(factions_dir):
        data = read_yaml(path)
        results.append({
            "id": data.get("id", path.stem),
            "name": data.get("name", ""),
            "member_ids": data.get("member_ids", []),
            "reputation_with_player": data.get("reputation_with_player", 0.0),
            "file": path.name,
        })
    return results


@router.get("/{faction_id}")
async def get_faction(faction_id: str, request: Request) -> dict:
    path = _factions_dir(request) / f"{faction_id}.yaml"
    if not path.exists():
        raise HTTPException(404, f"Faction not found: {faction_id}")
    data = read_yaml(path)
    try:
        faction = Faction(**data)
        return faction.model_dump()
    except ValidationError:
        return data


@router.post("")
async def create_faction(faction: Faction, request: Request) -> dict:
    path = _factions_dir(request) / f"{faction.id}.yaml"
    if path.exists():
        raise HTTPException(409, f"Faction already exists: {faction.id}")
    write_yaml(path, faction.model_dump())
    return {"status": "created", "id": faction.id}


@router.put("/{faction_id}")
async def update_faction(faction_id: str, faction: Faction, request: Request) -> dict:
    path = _factions_dir(request) / f"{faction_id}.yaml"
    if not path.exists():
        raise HTTPException(404, f"Faction not found: {faction_id}")
    if faction.id != faction_id:
        delete_yaml(path)
        path = _factions_dir(request) / f"{faction.id}.yaml"
    write_yaml(path, faction.model_dump())
    return {"status": "updated", "id": faction.id}


@router.delete("/{faction_id}")
async def delete_faction(faction_id: str, request: Request) -> dict:
    path = _factions_dir(request) / f"{faction_id}.yaml"
    if not delete_yaml(path):
        raise HTTPException(404, f"Faction not found: {faction_id}")
    return {"status": "deleted", "id": faction_id}
