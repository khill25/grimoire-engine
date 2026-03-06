"""Tests for the FastAPI endpoints."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from grimoire.api.app import create_app
from grimoire.engine.session import GameSession
from grimoire.loader.world_loader import load_world

WORLD_PATH = str(Path(__file__).parent.parent / "world")


@pytest.fixture
def client():
    app = create_app()
    return TestClient(app)


@pytest.fixture
def started_client(client):
    resp = client.post("/game/start", json={
        "world_path": WORLD_PATH,
        "player_start": "rusty_tap",
        "llm_provider": "none",
    })
    assert resp.status_code == 200
    return client


def test_start_game(client):
    resp = client.post("/game/start", json={
        "world_path": WORLD_PATH,
        "player_start": "rusty_tap",
        "llm_provider": "none",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "started"
    assert data["world"] == "Shattered Kingdom"
    assert "mira" in data["characters"]


def test_state_before_start(client):
    resp = client.get("/game/state")
    assert resp.status_code == 400


def test_get_state(started_client):
    resp = started_client.get("/game/state")
    assert resp.status_code == 200
    data = resp.json()
    assert data["player_location"] == "rusty_tap"
    assert data["tick"] == 0


def test_get_scene(started_client):
    resp = started_client.get("/game/scene/rusty_tap")
    assert resp.status_code == 200
    data = resp.json()
    assert data["place"]["name"] == "The Rusty Tap"


def test_scene_not_found(started_client):
    resp = started_client.get("/game/scene/nonexistent")
    assert resp.status_code == 404


def test_action_move(started_client):
    resp = started_client.post("/game/action", json={"type": "move", "target": "dock_7"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["narration"]

    state = started_client.get("/game/state").json()
    assert state["player_location"] == "dock_7"


def test_action_look(started_client):
    resp = started_client.post("/game/action", json={"type": "look"})
    assert resp.status_code == 200
    assert resp.json()["narration"]


def test_action_wait(started_client):
    resp = started_client.post("/game/action", json={"type": "wait", "detail": "3"})
    assert resp.status_code == 200
    state = started_client.get("/game/state").json()
    assert state["tick"] == 3


def test_list_characters(started_client):
    resp = started_client.get("/game/characters")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 5
    names = {c["name"] for c in data}
    assert "Mira Vasik" in names


def test_get_events(started_client):
    started_client.post("/game/action", json={"type": "move", "target": "dock_7"})
    resp = started_client.get("/game/events")
    assert resp.status_code == 200
    assert len(resp.json()) > 0


def test_get_beats(started_client):
    resp = started_client.get("/game/beats")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1


def test_dialogue_start(started_client):
    resp = started_client.post("/game/dialogue", json={
        "character_id": "mira",
        "text": "hello",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["speaker"] == "Mira Vasik"
    assert len(data["choices"]) > 0


def test_dialogue_select_choice(started_client):
    started_client.post("/game/dialogue", json={
        "character_id": "mira", "text": "hello",
    })
    resp = started_client.post("/game/dialogue", json={
        "character_id": "mira", "text": "just_a_drink",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["speaker"] == "Mira Vasik"


def test_dialogue_unknown_character(started_client):
    resp = started_client.post("/game/dialogue", json={
        "character_id": "nobody", "text": "hello",
    })
    assert resp.status_code == 404
