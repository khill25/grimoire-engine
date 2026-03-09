"""Story metadata route — top-level story info (name, tone, description, worlds)."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Request

from editor.backend.yaml_io import read_yaml, write_yaml

router = APIRouter(prefix="/story-meta", tags=["story-meta"])


def _meta_path(request: Request) -> Path:
    return Path(request.app.state.world_path) / "story_meta.yaml"


@router.get("")
async def get_story_meta(request: Request) -> dict:
    path = _meta_path(request)
    if not path.exists():
        return {"name": "", "description": "", "tone": "", "worlds": []}
    return read_yaml(path)


@router.put("")
async def update_story_meta(data: dict, request: Request) -> dict:
    path = _meta_path(request)
    path.parent.mkdir(parents=True, exist_ok=True)
    write_yaml(path, data)
    return {"status": "updated"}
