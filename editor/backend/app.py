"""World Builder Editor — FastAPI backend."""

from __future__ import annotations

import argparse
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRouter

from editor.backend.routes import characters, places, factions, dialogue, story, generate, scenes, validate, items, game_types, project
from editor.backend.yaml_io import read_yaml, write_yaml


def _detect_layout(world_path: Path) -> str:
    """Detect directory layout: 'story' (new nested) or 'world' (old flat)."""
    if (world_path / "story.yaml").exists() and (world_path / "world").exists():
        return "story"
    if (world_path / "world" / "world.yaml").exists():
        try:
            data = read_yaml(world_path / "world" / "world.yaml")
            if "id" in data:
                return "story"
        except Exception:
            pass
    return "world"


def create_app(world_path: str = "", game_data_path: str = "") -> FastAPI:
    app = FastAPI(
        title="Grimoire World Builder",
        description="Content authoring tool for Grimoire Engine",
        version="0.2.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Store world path and layout in app state
    wp = Path(world_path) if world_path else Path(".")
    layout = _detect_layout(wp)
    app.state.layout = layout

    if layout == "story":
        # New layout: story root, content under world/
        app.state.world_path = str(wp / "world")
        app.state.story_path = str(wp)
    else:
        # Old layout: world/ is the root
        app.state.world_path = str(wp)
        app.state.story_path = str(wp)

    # Game data path (items, equipment, etc.) — separate from world/story content
    if game_data_path:
        gdp = Path(game_data_path)
    else:
        gdp = Path(app.state.world_path) / "game_data"
    app.state.game_data_path = str(gdp)

    # World info endpoints
    world_router = APIRouter(prefix="/world", tags=["world"])

    @world_router.get("")
    async def get_world_info(request: Request):
        layout = request.app.state.layout
        if layout == "story":
            world_yaml = Path(request.app.state.world_path) / "world.yaml"
        else:
            world_yaml = Path(request.app.state.world_path) / "world.yaml"
        if world_yaml.exists():
            return read_yaml(world_yaml)
        return {"name": "", "path": str(wp)}

    @world_router.put("")
    async def update_world_info(data: dict, request: Request):
        layout = request.app.state.layout
        if layout == "story":
            world_yaml = Path(request.app.state.world_path) / "world.yaml"
        else:
            world_yaml = Path(request.app.state.world_path) / "world.yaml"
        write_yaml(world_yaml, data)
        return {"status": "updated"}

    # Story metadata endpoints (new layout only)
    story_meta_router = APIRouter(prefix="/story-meta", tags=["story-meta"])

    @story_meta_router.get("")
    async def get_story_meta(request: Request):
        story_yaml = Path(request.app.state.story_path) / "story.yaml"
        if story_yaml.exists():
            return read_yaml(story_yaml)
        return {"name": "", "description": "", "tone": "", "worlds": []}

    @story_meta_router.put("")
    async def update_story_meta(data: dict, request: Request):
        story_yaml = Path(request.app.state.story_path) / "story.yaml"
        write_yaml(story_yaml, data)
        return {"status": "updated"}

    # Mount all routes under /api/editor
    api = APIRouter(prefix="/api/editor")
    api.include_router(world_router)
    api.include_router(story_meta_router)
    api.include_router(characters.router)
    api.include_router(places.router)
    api.include_router(factions.router)
    api.include_router(dialogue.router)
    api.include_router(story.router)
    api.include_router(generate.router)
    api.include_router(scenes.router)
    api.include_router(validate.router)
    api.include_router(items.router)
    api.include_router(game_types.router)
    api.include_router(project.router)

    app.include_router(api)

    return app


def main():
    import uvicorn
    parser = argparse.ArgumentParser(description="Grimoire World Builder")
    parser.add_argument("world_path", help="Path to world or story directory")
    parser.add_argument("--game-data", help="Path to game data directory (items, etc.). Defaults to <world_path>/game_data")
    parser.add_argument("--port", type=int, default=17413)
    parser.add_argument("--host", default="0.0.0.0")
    args = parser.parse_args()

    world_path = str(Path(args.world_path).resolve())
    if not Path(world_path).exists():
        print(f"World path does not exist: {world_path}")
        return

    game_data_path = str(Path(args.game_data).resolve()) if args.game_data else ""
    app = create_app(world_path, game_data_path)
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
