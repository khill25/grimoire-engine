"""Character CRUD routes."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from pydantic import ValidationError

from grimoire.models.character import Character
from editor.backend.yaml_io import delete_yaml, list_yaml_files, read_yaml, write_yaml

router = APIRouter(prefix="/characters", tags=["characters"])


def _characters_dir(request: Request) -> Path:
    return Path(request.app.state.world_path) / "characters"


@router.get("")
async def list_characters(request: Request) -> list[dict]:
    chars_dir = _characters_dir(request)
    results = []
    for path in list_yaml_files(chars_dir):
        data = read_yaml(path)
        results.append({
            "id": data.get("id", path.stem),
            "name": data.get("name", ""),
            "occupation": data.get("occupation", ""),
            "location": data.get("location", ""),
            "status": data.get("status", "alive"),
            "file": path.name,
        })
    return results


@router.get("/{character_id}")
async def get_character(character_id: str, request: Request) -> dict:
    path = _characters_dir(request) / f"{character_id}.yaml"
    if not path.exists():
        raise HTTPException(404, f"Character not found: {character_id}")
    data = read_yaml(path)
    # Validate through Pydantic to ensure consistency
    try:
        char = Character(**data)
        return char.model_dump()
    except ValidationError:
        # Return raw data if it doesn't fully validate yet
        return data


@router.post("")
async def create_character(char: Character, request: Request) -> dict:
    path = _characters_dir(request) / f"{char.id}.yaml"
    if path.exists():
        raise HTTPException(409, f"Character already exists: {char.id}")
    write_yaml(path, char.model_dump())
    return {"status": "created", "id": char.id}


@router.put("/{character_id}")
async def update_character(character_id: str, char: Character, request: Request) -> dict:
    path = _characters_dir(request) / f"{character_id}.yaml"
    if not path.exists():
        raise HTTPException(404, f"Character not found: {character_id}")
    # If ID changed, delete old file and write new one
    if char.id != character_id:
        delete_yaml(path)
        path = _characters_dir(request) / f"{char.id}.yaml"
    write_yaml(path, char.model_dump())
    return {"status": "updated", "id": char.id}


@router.delete("/{character_id}")
async def delete_character(character_id: str, request: Request) -> dict:
    path = _characters_dir(request) / f"{character_id}.yaml"
    if not delete_yaml(path):
        raise HTTPException(404, f"Character not found: {character_id}")
    return {"status": "deleted", "id": character_id}
