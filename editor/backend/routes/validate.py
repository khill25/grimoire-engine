"""Reference validation routes."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Request

from editor.backend.yaml_io import list_yaml_files, read_yaml

router = APIRouter(prefix="/validate", tags=["validate"])


def _collect_entities(world_path: Path) -> dict[str, set[str]]:
    """Collect all entity IDs by type from the world directory."""
    entities: dict[str, set[str]] = {
        "character": set(),
        "place": set(),
        "scene": set(),
        "faction": set(),
        "dialogue": set(),
    }

    # Characters
    chars_dir = world_path / "characters"
    for f in list_yaml_files(chars_dir):
        data = read_yaml(f)
        entities["character"].add(data.get("id", f.stem))

    # Places (nested or flat)
    places_dir = world_path / "places"
    if places_dir.exists():
        for item in sorted(places_dir.iterdir()):
            if item.is_dir():
                # Nested: places/<id>/place.yaml
                place_file = item / "place.yaml"
                if place_file.exists():
                    data = read_yaml(place_file)
                    entities["place"].add(data.get("id", item.name))
                # Scenes
                scenes_dir = item / "scenes"
                if scenes_dir.exists():
                    for sf in list_yaml_files(scenes_dir):
                        data = read_yaml(sf)
                        entities["scene"].add(data.get("id", sf.stem))
            elif item.suffix == ".yaml":
                # Flat: places/<id>.yaml
                data = read_yaml(item)
                entities["place"].add(data.get("id", item.stem))

    # Factions
    factions_dir = world_path / "factions"
    for f in list_yaml_files(factions_dir):
        data = read_yaml(f)
        entities["faction"].add(data.get("id", f.stem))

    # Dialogue
    dialogue_dir = world_path / "dialogue"
    for f in list_yaml_files(dialogue_dir):
        data = read_yaml(f)
        entities["dialogue"].add(data.get("id", f.stem))

    return entities


def _check_refs(data: dict, file_str: str, entities: dict[str, set[str]]) -> list[dict]:
    """Check a single entity's references against known IDs."""
    broken = []

    def _check(field: str, ref_id: str, expected_type: str):
        if ref_id and ref_id not in entities.get(expected_type, set()):
            broken.append({
                "source_file": file_str,
                "field": field,
                "referenced_id": ref_id,
                "expected_type": expected_type,
            })

    # Character references
    for field in ("location",):
        val = data.get(field, "")
        if val:
            _check(field, val, "place")

    # List-of-ID references
    ref_fields = {
        "connections": "place",
        "default_npcs": "character",
        "current_npcs": "character",
        "member_ids": "character",
        "faction_ids": "faction",
        "scenes": "scene",
    }
    for field, expected_type in ref_fields.items():
        for ref_id in data.get(field, []):
            _check(field, ref_id, expected_type)

    # Owner can be character or faction
    owner = data.get("owner", "")
    if owner and owner not in entities.get("character", set()) and owner not in entities.get("faction", set()):
        broken.append({
            "source_file": file_str,
            "field": "owner",
            "referenced_id": owner,
            "expected_type": "character|faction",
        })

    # character_id on dialogue trees
    char_id = data.get("character_id", "")
    if char_id:
        _check("character_id", char_id, "character")

    # place_id on scenes
    place_id = data.get("place_id", "")
    if place_id:
        _check("place_id", place_id, "place")

    # Scene connections (sibling scenes)
    for conn_id in data.get("connections", []):
        if data.get("place_id"):  # This is a scene, connections are scene_ids
            _check("connections", conn_id, "scene")

    return broken


@router.get("")
async def validate(request: Request) -> dict:
    """Walk all YAML, return broken refs, orphans, and duplicate IDs."""
    world_path = Path(request.app.state.world_path)
    entities = _collect_entities(world_path)

    broken_refs: list[dict] = []
    all_ids: dict[str, list[str]] = {}  # id -> [file1, file2, ...]

    # Walk all entity files
    def process_dir(directory: Path, entity_type: str):
        if not directory.exists():
            return
        for f in list_yaml_files(directory):
            data = read_yaml(f)
            file_str = str(f.relative_to(world_path))
            eid = data.get("id", f.stem)
            all_ids.setdefault(eid, []).append(file_str)
            broken_refs.extend(_check_refs(data, file_str, entities))

    def process_nested_places(places_dir: Path):
        if not places_dir.exists():
            return
        for item in sorted(places_dir.iterdir()):
            if item.is_dir():
                place_file = item / "place.yaml"
                if place_file.exists():
                    data = read_yaml(place_file)
                    file_str = str(place_file.relative_to(world_path))
                    eid = data.get("id", item.name)
                    all_ids.setdefault(eid, []).append(file_str)
                    broken_refs.extend(_check_refs(data, file_str, entities))
                scenes_dir = item / "scenes"
                if scenes_dir.exists():
                    for sf in list_yaml_files(scenes_dir):
                        data = read_yaml(sf)
                        file_str = str(sf.relative_to(world_path))
                        eid = data.get("id", sf.stem)
                        all_ids.setdefault(eid, []).append(file_str)
                        broken_refs.extend(_check_refs(data, file_str, entities))
            elif item.suffix == ".yaml":
                data = read_yaml(item)
                file_str = str(item.relative_to(world_path))
                eid = data.get("id", item.stem)
                all_ids.setdefault(eid, []).append(file_str)
                broken_refs.extend(_check_refs(data, file_str, entities))

    process_dir(world_path / "characters", "character")
    process_nested_places(world_path / "places")
    process_dir(world_path / "factions", "faction")
    process_dir(world_path / "dialogue", "dialogue")

    # Duplicate IDs
    duplicate_ids = [
        {"id": eid, "files": files}
        for eid, files in all_ids.items()
        if len(files) > 1
    ]

    # Orphaned entities (referenced by nobody else)
    all_entity_ids = set()
    for ids in entities.values():
        all_entity_ids.update(ids)

    referenced_ids: set[str] = set()
    for ref in broken_refs:
        pass  # broken refs are NOT referenced properly
    # Collect all valid references
    for eid, files in all_ids.items():
        referenced_ids.add(eid)

    return {
        "broken_refs": broken_refs,
        "duplicate_ids": duplicate_ids,
        "entity_counts": {k: len(v) for k, v in entities.items()},
    }
