"""World Builder Editor — FastAPI backend."""

from __future__ import annotations

import argparse
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRouter

from editor.backend.routes import characters, places, factions, dialogue, story, generate
from editor.backend.yaml_io import read_yaml, write_yaml


def create_app(world_path: str = "") -> FastAPI:
    app = FastAPI(
        title="Grimoire World Builder",
        description="Content authoring tool for Grimoire Engine",
        version="0.1.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Store world path in app state
    app.state.world_path = world_path

    # World info endpoints
    world_router = APIRouter(prefix="/world", tags=["world"])

    @world_router.get("")
    async def get_world_info(request: Request):
        wp = Path(request.app.state.world_path)
        world_yaml = wp / "world.yaml"
        if world_yaml.exists():
            return read_yaml(world_yaml)
        return {"name": "", "path": str(wp)}

    @world_router.put("")
    async def update_world_info(data: dict, request: Request):
        wp = Path(request.app.state.world_path)
        world_yaml = wp / "world.yaml"
        write_yaml(world_yaml, data)
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

    app.include_router(api)

    return app


def main():
    import uvicorn
    parser = argparse.ArgumentParser(description="Grimoire World Builder")
    parser.add_argument("world_path", help="Path to world directory")
    parser.add_argument("--port", type=int, default=17413)
    parser.add_argument("--host", default="0.0.0.0")
    args = parser.parse_args()

    world_path = str(Path(args.world_path).resolve())
    if not Path(world_path).exists():
        print(f"World path does not exist: {world_path}")
        return

    app = create_app(world_path)
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
