"""Game types/enums route — defines valid stats, damage types, slots, etc.

Stored as JSON for direct consumption by Godot.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Request

from editor.backend.json_io import read_json, write_json

router = APIRouter(prefix="/game-types", tags=["game-types"])


def _types_path(request: Request) -> Path:
    return Path(request.app.state.game_data_path) / "types.json"


@router.get("")
async def get_types(request: Request) -> dict:
    path = _types_path(request)
    if not path.exists():
        return {}
    return read_json(path)


@router.put("")
async def update_types(data: dict, request: Request) -> dict:
    path = _types_path(request)
    path.parent.mkdir(parents=True, exist_ok=True)
    write_json(path, data)
    return {"status": "updated"}
