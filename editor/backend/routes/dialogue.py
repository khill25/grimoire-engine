"""Dialogue tree CRUD routes."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from pydantic import ValidationError

from grimoire.models.dialogue import DialogueTree
from editor.backend.yaml_io import delete_yaml, list_yaml_files, read_yaml, write_yaml

router = APIRouter(prefix="/dialogue", tags=["dialogue"])


def _dialogue_dir(request: Request) -> Path:
    return Path(request.app.state.world_path) / "dialogue"


@router.get("")
async def list_dialogue_trees(request: Request) -> list[dict]:
    dialogue_dir = _dialogue_dir(request)
    results = []
    for path in list_yaml_files(dialogue_dir):
        data = read_yaml(path)
        results.append({
            "id": data.get("id", path.stem),
            "character_id": data.get("character_id", ""),
            "context": data.get("context", ""),
            "node_count": len(data.get("nodes", [])),
            "file": path.name,
        })
    return results


@router.get("/{tree_id}")
async def get_dialogue_tree(tree_id: str, request: Request) -> dict:
    # Search by ID since filename may differ from tree ID
    dialogue_dir = _dialogue_dir(request)
    for path in list_yaml_files(dialogue_dir):
        data = read_yaml(path)
        if data.get("id") == tree_id or path.stem == tree_id:
            try:
                tree = DialogueTree(**data)
                return tree.model_dump()
            except ValidationError:
                return data
    raise HTTPException(404, f"Dialogue tree not found: {tree_id}")


@router.post("")
async def create_dialogue_tree(tree: DialogueTree, request: Request) -> dict:
    path = _dialogue_dir(request) / f"{tree.id}.yaml"
    if path.exists():
        raise HTTPException(409, f"Dialogue tree already exists: {tree.id}")
    write_yaml(path, tree.model_dump())
    return {"status": "created", "id": tree.id}


@router.put("/{tree_id}")
async def update_dialogue_tree(tree_id: str, tree: DialogueTree, request: Request) -> dict:
    dialogue_dir = _dialogue_dir(request)
    # Find existing file
    existing_path = None
    for path in list_yaml_files(dialogue_dir):
        data = read_yaml(path)
        if data.get("id") == tree_id or path.stem == tree_id:
            existing_path = path
            break
    if existing_path is None:
        raise HTTPException(404, f"Dialogue tree not found: {tree_id}")
    # If ID changed, delete old and write new
    if tree.id != tree_id:
        delete_yaml(existing_path)
    new_path = dialogue_dir / f"{tree.id}.yaml"
    write_yaml(new_path, tree.model_dump())
    return {"status": "updated", "id": tree.id}


@router.delete("/{tree_id}")
async def delete_dialogue_tree(tree_id: str, request: Request) -> dict:
    dialogue_dir = _dialogue_dir(request)
    for path in list_yaml_files(dialogue_dir):
        data = read_yaml(path)
        if data.get("id") == tree_id or path.stem == tree_id:
            delete_yaml(path)
            return {"status": "deleted", "id": tree_id}
    raise HTTPException(404, f"Dialogue tree not found: {tree_id}")
