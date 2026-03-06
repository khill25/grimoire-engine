"""Place CRUD routes — supports both flat and nested directory layouts."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from pydantic import ValidationError

from grimoire.models.place import Place
from editor.backend.yaml_io import delete_yaml, list_yaml_files, read_yaml, write_yaml

router = APIRouter(prefix="/places", tags=["places"])


def _places_dir(request: Request) -> Path:
    return Path(request.app.state.world_path) / "places"


def _find_place_file(places_dir: Path, place_id: str) -> Path | None:
    """Find a place file in either flat or nested layout."""
    # Nested: places/<id>/place.yaml
    nested = places_dir / place_id / "place.yaml"
    if nested.exists():
        return nested
    # Flat: places/<id>.yaml
    flat = places_dir / f"{place_id}.yaml"
    if flat.exists():
        return flat
    return None


def _all_place_files(places_dir: Path) -> list[tuple[Path, str]]:
    """List all place files. Returns (path, place_id) pairs."""
    results = []
    if not places_dir.exists():
        return results
    for item in sorted(places_dir.iterdir()):
        if item.is_dir():
            place_file = item / "place.yaml"
            if place_file.exists():
                results.append((place_file, item.name))
        elif item.suffix == ".yaml":
            results.append((item, item.stem))
    return results


@router.get("")
async def list_places(request: Request) -> list[dict]:
    places_dir = _places_dir(request)
    results = []
    for path, pid in _all_place_files(places_dir):
        data = read_yaml(path)
        results.append({
            "id": data.get("id", pid),
            "name": data.get("name", ""),
            "type": data.get("type", ""),
            "region": data.get("region", ""),
            "connections": data.get("connections", []),
            "scenes": data.get("scenes", []),
            "file": str(path.relative_to(places_dir)),
        })
    return results


@router.get("/{place_id}")
async def get_place(place_id: str, request: Request) -> dict:
    path = _find_place_file(_places_dir(request), place_id)
    if path is None:
        raise HTTPException(404, f"Place not found: {place_id}")
    data = read_yaml(path)
    try:
        place = Place(**data)
        return place.model_dump()
    except ValidationError:
        return data


@router.post("")
async def create_place(place: Place, request: Request) -> dict:
    places_dir = _places_dir(request)
    # Always create in nested layout
    place_dir = places_dir / place.id
    place_dir.mkdir(parents=True, exist_ok=True)
    (place_dir / "scenes").mkdir(exist_ok=True)
    path = place_dir / "place.yaml"
    if path.exists():
        raise HTTPException(409, f"Place already exists: {place.id}")
    write_yaml(path, place.model_dump())
    return {"status": "created", "id": place.id}


@router.put("/{place_id}")
async def update_place(place_id: str, place: Place, request: Request) -> dict:
    places_dir = _places_dir(request)
    path = _find_place_file(places_dir, place_id)
    if path is None:
        raise HTTPException(404, f"Place not found: {place_id}")
    if place.id != place_id:
        # ID changed — remove old file/dir, create new nested dir
        old_dir = places_dir / place_id
        if old_dir.is_dir():
            import shutil
            new_dir = places_dir / place.id
            shutil.move(str(old_dir), str(new_dir))
            path = new_dir / "place.yaml"
        else:
            delete_yaml(path)
            place_dir = places_dir / place.id
            place_dir.mkdir(parents=True, exist_ok=True)
            path = place_dir / "place.yaml"
    write_yaml(path, place.model_dump())
    return {"status": "updated", "id": place.id}


@router.delete("/{place_id}")
async def delete_place(place_id: str, request: Request) -> dict:
    places_dir = _places_dir(request)
    path = _find_place_file(places_dir, place_id)
    if path is None:
        raise HTTPException(404, f"Place not found: {place_id}")
    # For nested layout, remove the entire place directory
    place_dir = places_dir / place_id
    if place_dir.is_dir():
        import shutil
        shutil.rmtree(str(place_dir))
    else:
        delete_yaml(path)
    return {"status": "deleted", "id": place_id}
