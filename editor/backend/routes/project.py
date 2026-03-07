"""Project settings routes — configure world and game data paths at runtime."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Request

router = APIRouter(prefix="/project", tags=["project"])


@router.get("")
async def get_project(request: Request) -> dict:
    """Return current project paths."""
    return {
        "world_path": request.app.state.world_path,
        "game_data_path": request.app.state.game_data_path,
    }


@router.put("")
async def update_project(data: dict, request: Request) -> dict:
    """Update project paths at runtime."""
    if "world_path" in data:
        wp = Path(data["world_path"])
        if not wp.exists():
            wp.mkdir(parents=True, exist_ok=True)
        request.app.state.world_path = str(wp)
    if "game_data_path" in data:
        gdp = Path(data["game_data_path"])
        if not gdp.exists():
            gdp.mkdir(parents=True, exist_ok=True)
        request.app.state.game_data_path = str(gdp)
    return await get_project(request)


@router.get("/browse")
async def browse_directory(path: str = "~") -> dict:
    """List directories at a given path for folder browsing."""
    target = Path(path).expanduser().resolve()
    if not target.exists():
        return {"path": str(target), "exists": False, "dirs": [], "parent": str(target.parent)}
    if not target.is_dir():
        target = target.parent

    dirs = []
    try:
        for entry in sorted(target.iterdir()):
            if entry.is_dir() and not entry.name.startswith("."):
                dirs.append({
                    "name": entry.name,
                    "path": str(entry),
                })
    except PermissionError:
        pass

    return {
        "path": str(target),
        "exists": True,
        "dirs": dirs,
        "parent": str(target.parent) if target != target.parent else None,
    }
