"""Scene CRUD routes."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from pydantic import ValidationError

from grimoire.models.scene import Scene
from editor.backend.yaml_io import delete_yaml, read_yaml, write_yaml

router = APIRouter(prefix="/scenes", tags=["scenes"])


def _places_dir(request: Request) -> Path:
    return Path(request.app.state.world_path) / "places"


def _scene_path(request: Request, place_id: str, scene_id: str) -> Path:
    return _places_dir(request) / place_id / "scenes" / f"{scene_id}.yaml"


def _all_scenes(request: Request, place_id: str | None = None) -> list[tuple[Path, dict]]:
    """Walk all scenes, optionally filtered by place_id."""
    places_dir = _places_dir(request)
    results = []
    if not places_dir.exists():
        return results
    dirs = [places_dir / place_id] if place_id else sorted(places_dir.iterdir())
    for place_dir in dirs:
        if not place_dir.is_dir():
            continue
        scenes_dir = place_dir / "scenes"
        if not scenes_dir.exists():
            continue
        for scene_file in sorted(scenes_dir.glob("*.yaml")):
            data = read_yaml(scene_file)
            results.append((scene_file, data))
    return results


@router.get("")
async def list_scenes(request: Request, place_id: str | None = None) -> list[dict]:
    results = []
    for path, data in _all_scenes(request, place_id):
        results.append({
            "id": data.get("id", path.stem),
            "name": data.get("name", ""),
            "place_id": data.get("place_id", ""),
            "type": data.get("type", ""),
            "default_npcs": data.get("default_npcs", []),
            "file": str(path.relative_to(Path(request.app.state.world_path))),
        })
    return results


@router.get("/{scene_id}")
async def get_scene(scene_id: str, request: Request) -> dict:
    # Search across all places
    for path, data in _all_scenes(request):
        if data.get("id") == scene_id or path.stem == scene_id:
            try:
                scene = Scene(**data)
                return scene.model_dump()
            except ValidationError:
                return data
    raise HTTPException(404, f"Scene not found: {scene_id}")


@router.post("")
async def create_scene(scene: Scene, request: Request) -> dict:
    if not scene.place_id:
        raise HTTPException(400, "place_id is required")
    place_dir = _places_dir(request) / scene.place_id
    if not place_dir.exists():
        raise HTTPException(404, f"Place not found: {scene.place_id}")
    scenes_dir = place_dir / "scenes"
    scenes_dir.mkdir(exist_ok=True)
    path = scenes_dir / f"{scene.id}.yaml"
    if path.exists():
        raise HTTPException(409, f"Scene already exists: {scene.id}")
    write_yaml(path, scene.model_dump())

    # Add scene_id to the place's scenes list
    place_file = place_dir / "place.yaml"
    if place_file.exists():
        place_data = read_yaml(place_file)
        scenes_list = place_data.get("scenes", [])
        if scene.id not in scenes_list:
            scenes_list.append(scene.id)
            place_data["scenes"] = scenes_list
            write_yaml(place_file, place_data)

    return {"status": "created", "id": scene.id}


@router.put("/{scene_id}")
async def update_scene(scene_id: str, scene: Scene, request: Request) -> dict:
    # Find existing scene
    for path, data in _all_scenes(request):
        if data.get("id") == scene_id or path.stem == scene_id:
            if scene.id != scene_id:
                delete_yaml(path)
            new_path = _places_dir(request) / scene.place_id / "scenes" / f"{scene.id}.yaml"
            new_path.parent.mkdir(parents=True, exist_ok=True)
            write_yaml(new_path, scene.model_dump())
            return {"status": "updated", "id": scene.id}
    raise HTTPException(404, f"Scene not found: {scene_id}")


@router.delete("/{scene_id}")
async def delete_scene(scene_id: str, request: Request) -> dict:
    for path, data in _all_scenes(request):
        if data.get("id") == scene_id or path.stem == scene_id:
            place_id = data.get("place_id", "")
            delete_yaml(path)

            # Remove from place's scenes list
            if place_id:
                place_file = _places_dir(request) / place_id / "place.yaml"
                if place_file.exists():
                    place_data = read_yaml(place_file)
                    scenes_list = place_data.get("scenes", [])
                    if scene_id in scenes_list:
                        scenes_list.remove(scene_id)
                        place_data["scenes"] = scenes_list
                        write_yaml(place_file, place_data)

            return {"status": "deleted", "id": scene_id}
    raise HTTPException(404, f"Scene not found: {scene_id}")
