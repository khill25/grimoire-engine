"""Game constants route — global tuning values (resistance cap, per-point multipliers, etc.).

Stored as a single JSON file for direct consumption by Godot.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Request

from editor.backend.json_io import read_json, write_json

router = APIRouter(prefix="/game-constants", tags=["game-constants"])


def _constants_path(request: Request) -> Path:
    return Path(request.app.state.game_data_path) / "game_constants.json"


@router.get("")
async def get_constants(request: Request) -> dict:
    path = _constants_path(request)
    if not path.exists():
        return {}
    return read_json(path)


@router.put("")
async def update_constants(data: dict, request: Request) -> dict:
    path = _constants_path(request)
    path.parent.mkdir(parents=True, exist_ok=True)
    write_json(path, data)
    return {"status": "updated"}
