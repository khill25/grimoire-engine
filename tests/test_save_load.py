"""Tests for save/load functionality."""

import json
import tempfile
from pathlib import Path

from grimoire.director.director import Director, parse_story_bible
from grimoire.engine.game_state import GameState, PlayerAction
from grimoire.loader.world_loader import load_world
from grimoire.storage.save_load import load_game, restore_game_state, save_game

WORLD_PATH = str(Path(__file__).parent.parent / "world")


def _setup():
    world = load_world(WORLD_PATH)
    state = GameState(world)
    state.player_location = "rusty_tap"
    bible = parse_story_bible(world.story_bible)
    director = Director(bible)
    return world, state, director


def test_save_and_load():
    _, state, director = _setup()

    # Make some changes
    state.process_action(PlayerAction(type="move", target="dock_7"))
    state.process_action(PlayerAction(type="wait", detail="5"))
    state.flags["test_flag"] = True
    director.complete_beat("beat_arrive")

    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        save_path = f.name

    save_game(state, WORLD_PATH, save_path, director)

    # Verify file exists and is valid JSON
    with open(save_path) as f:
        data = json.load(f)
    assert data["version"] == 1
    assert data["player_location"] == "dock_7"
    assert data["flags"]["test_flag"] is True
    assert data["tick"] == 6  # 1 from move + 5 from wait
    assert len(data["events"]) > 0


def test_restore():
    _, state, director = _setup()

    # Make changes and save
    state.process_action(PlayerAction(type="move", target="dock_7"))
    state.flags["restored_flag"] = "yes"
    director.check_triggers(
        state.event_log.all_events, state.flags, state.tick)

    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        save_path = f.name

    save_game(state, WORLD_PATH, save_path, director)

    # Load into a fresh game state
    world2 = load_world(WORLD_PATH)
    state2 = GameState(world2)
    bible2 = parse_story_bible(world2.story_bible)
    director2 = Director(bible2)

    save_data = load_game(save_path)
    restore_game_state(save_data, state2, director2)

    assert state2.player_location == "dock_7"
    assert state2.flags["restored_flag"] == "yes"
    assert state2.tick == state.tick
    assert len(state2.event_log) == len(state.event_log)


def test_save_data_roundtrip():
    _, state, director = _setup()

    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        save_path = f.name

    save_game(state, WORLD_PATH, save_path, director)
    save_data = load_game(save_path)

    assert save_data.world_path == WORLD_PATH
    assert save_data.tick == 0
    assert save_data.player_location == "rusty_tap"
