"""Game types/enums route — defines valid stats, damage types, slots, etc."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Request

from editor.backend.yaml_io import read_yaml, write_yaml

router = APIRouter(prefix="/game-types", tags=["game-types"])


def _types_path(request: Request) -> Path:
    return Path(request.app.state.game_data_path) / "types.yaml"


@router.get("")
async def get_types(request: Request) -> dict:
    path = _types_path(request)
    if not path.exists():
        return {}
    return read_yaml(path)


@router.put("")
async def update_types(data: dict, request: Request) -> dict:
    path = _types_path(request)
    path.parent.mkdir(parents=True, exist_ok=True)
    write_yaml(path, data)
    return {"status": "updated"}
