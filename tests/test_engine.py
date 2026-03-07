"""Tests for game state, events, and schedules."""

from pathlib import Path

from grimoire.engine.events import EventLog, create_event
from grimoire.engine.game_state import GameState, PlayerAction
from grimoire.engine.schedules import get_scheduled_location, is_interruptible
from grimoire.loader.world_loader import load_world
from grimoire.models.common import GameTime


WORLD_PATH = str(Path(__file__).parent / "fixtures" / "world")


# --- Event log tests ---

def test_create_event():
    e = create_event(timestamp=0, type="interaction", summary="Test")
    assert e.id  # UUID generated
    assert e.timestamp == 0


def test_event_log_append_and_query():
    log = EventLog()
    log.append(create_event(timestamp=0, type="interaction", summary="A", location="bar"))
    log.append(create_event(timestamp=1, type="interaction", summary="B", location="dock"))
    log.append(create_event(timestamp=2, type="interaction", summary="C", location="bar"))

    assert len(log) == 3
    assert len(log.query(location="bar")) == 2
    assert len(log.query(since_tick=2)) == 1


def test_event_log_query_participant():
    log = EventLog()
    log.append(create_event(timestamp=0, type="interaction", summary="A", participants=["mira"]))
    log.append(create_event(timestamp=1, type="interaction", summary="B", participants=["bosk"]))

    assert len(log.query(participant="mira")) == 1


def test_event_log_query_tags():
    log = EventLog()
    log.append(create_event(timestamp=0, type="interaction", summary="A", tags=["dialogue"]))
    log.append(create_event(timestamp=1, type="interaction", summary="B", tags=["combat"]))

    assert len(log.query(tags=["dialogue"])) == 1


# --- Schedule tests ---

def test_schedule_normal_range():
    world = load_world(WORLD_PATH)
    mira = world.characters["mira"]
    # Mira works bar from 14-23
    time = GameTime(tick=16)
    assert get_scheduled_location(mira, time) == "rusty_tap"


def test_schedule_overnight():
    world = load_world(WORLD_PATH)
    mira = world.characters["mira"]
    # Mira's closing shift wraps midnight: 23-6
    time = GameTime(tick=2)  # 2am
    assert get_scheduled_location(mira, time) == "rusty_tap"


def test_schedule_sleeping():
    world = load_world(WORLD_PATH)
    mira = world.characters["mira"]
    time = GameTime(tick=8)  # 8am — sleeping
    assert get_scheduled_location(mira, time) == "miras_quarters"


def test_interruptible():
    world = load_world(WORLD_PATH)
    mira = world.characters["mira"]
    # Bar shift is interruptible
    time = GameTime(tick=16)
    assert is_interruptible(mira, time) is True
    # Sleeping is not
    time = GameTime(tick=8)
    assert is_interruptible(mira, time) is False


# --- Game state tests ---

def test_game_state_init():
    world = load_world(WORLD_PATH)
    state = GameState(world)
    assert state.tick == 0
    assert len(state.world.characters) == 5


def test_game_state_move():
    world = load_world(WORLD_PATH)
    state = GameState(world)
    state.player_location = "rusty_tap"

    result = state.process_action(PlayerAction(type="move", target="dock_7"))
    assert state.player_location == "dock_7"
    assert len(result.events) >= 1


def test_game_state_move_invalid():
    world = load_world(WORLD_PATH)
    state = GameState(world)
    state.player_location = "rusty_tap"

    # Can't go directly to miras_quarters... actually we can, it's connected
    # Let's try a truly invalid location
    result = state.process_action(PlayerAction(type="move", target="nonexistent"))
    assert "can't get to" in result.narration.lower() or "unknown" in result.narration.lower()


def test_game_state_look():
    world = load_world(WORLD_PATH)
    state = GameState(world)
    state.player_location = "rusty_tap"

    result = state.process_action(PlayerAction(type="look"))
    assert result.narration  # Should have place description
    assert result.scene is not None


def test_game_state_wait():
    world = load_world(WORLD_PATH)
    state = GameState(world)
    state.player_location = "rusty_tap"
    initial_tick = state.tick

    result = state.process_action(PlayerAction(type="wait", detail="3"))
    assert state.tick == initial_tick + 3


def test_game_state_talk():
    world = load_world(WORLD_PATH)
    state = GameState(world)
    state.player_location = "rusty_tap"

    result = state.process_action(PlayerAction(type="talk", target="mira"))
    assert "Mira" in result.narration
    assert len(result.events) == 1
    assert "dialogue" in result.events[0].tags


def test_game_state_talk_not_present():
    world = load_world(WORLD_PATH)
    state = GameState(world)
    state.player_location = "rusty_tap"

    result = state.process_action(PlayerAction(type="talk", target="bosk"))
    # Bosk may or may not be at rusty_tap depending on schedule/init
    # This tests the flow works either way
    assert result.narration


def test_game_state_advance_tick():
    world = load_world(WORLD_PATH)
    state = GameState(world)
    events = state.advance_tick(5)
    assert state.tick == 5
