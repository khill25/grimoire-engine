"""World Builder Editor — FastAPI backend."""

from __future__ import annotations

import argparse
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRouter

from editor.backend.routes import characters, places, factions, dialogue, story, generate, scenes, validate, items, game_types, project
from editor.backend.yaml_io import read_yaml, write_yaml


def create_app(world_path: str = "", game_data_path: str = "") -> FastAPI:
    app = FastAPI(
        title="Grimoire World Builder",
        description="Content authoring tool for Grimoire Engine",
        version="0.3.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Store world path in app state
    wp = Path(world_path) if world_path else Path(".")
    app.state.world_path = str(wp)

    # Game data path (items, equipment, etc.) — separate from world/story content
    if game_data_path:
        gdp = Path(game_data_path)
    else:
        gdp = wp / "game_data"
    app.state.game_data_path = str(gdp)

    # World/story info endpoints — read from grimoire.yaml
    world_router = APIRouter(prefix="/world", tags=["world"])

    @world_router.get("")
    async def get_world_info(request: Request):
        grimoire_path = Path(request.app.state.world_path) / "grimoire.yaml"
        if grimoire_path.exists():
            data = read_yaml(grimoire_path)
            return {
                "name": data.get("name", ""),
                "tone": data.get("tone", ""),
                "description": data.get("description", ""),
                "time": data.get("time", {}),
            }
        return {"name": "", "tone": "", "description": "", "time": {}}

    @world_router.put("")
    async def update_world_info(data: dict, request: Request):
        grimoire_path = Path(request.app.state.world_path) / "grimoire.yaml"
        if grimoire_path.exists():
            grimoire = read_yaml(grimoire_path)
        else:
            grimoire = {}
        # Update only world-level fields
        for key in ("name", "tone", "description", "time"):
            if key in data:
                grimoire[key] = data[key]
        write_yaml(grimoire_path, grimoire)
        return {"status": "updated"}

    # Mount all routes under /api/editor
    api = APIRouter(prefix="/api/editor")
    api.include_router(world_router)
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
    parser.add_argument("world_path", help="Path to world directory")
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
