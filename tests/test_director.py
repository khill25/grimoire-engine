"""Tests for the Director system."""

from pathlib import Path

from grimoire.director.director import Director, ProtectionResult, StoryBeat, Grimoire, parse_grimoire
from grimoire.engine.events import create_event
from grimoire.loader.world_loader import load_world


WORLD_PATH = str(Path(__file__).parent / "fixtures" / "world")


def _make_grimoire() -> Grimoire:
    return Grimoire(
        title="Test",
        description="Test story",
        beats=[
            StoryBeat(id="b1", name="Start", description="Begin",
                      trigger_type="automatic", status="pending"),
            StoryBeat(id="b2", name="Meet NPC", description="Talk to mira",
                      trigger_type="event", trigger_condition="talked_to:mira"),
            StoryBeat(id="b3", name="Got Flag", description="Flag triggered",
                      trigger_type="flag", trigger_condition="quest_started == true"),
            StoryBeat(id="b4", name="Deadline Beat", description="Has deadline",
                      trigger_type="flag", trigger_condition="some_flag == true",
                      deadline=10),
        ],
    )


def test_director_auto_activate():
    d = Director(_make_grimoire())
    active = d.get_active_beats()
    assert len(active) == 1
    assert active[0].id == "b1"


def test_director_event_trigger():
    d = Director(_make_grimoire())
    events = [
        create_event(timestamp=5, type="interaction", summary="Talked to Mira",
                     participants=["mira"], location="rusty_tap", tags=["dialogue"]),
    ]
    activated = d.check_triggers(events, {}, tick=5)
    assert len(activated) == 1
    assert activated[0].id == "b2"
    assert activated[0].status == "active"


def test_director_flag_trigger():
    d = Director(_make_grimoire())
    flags = {"quest_started": True}
    activated = d.check_triggers([], flags, tick=10)
    assert len(activated) == 1
    assert activated[0].id == "b3"


def test_director_no_double_activate():
    d = Director(_make_grimoire())
    flags = {"quest_started": True}
    d.check_triggers([], flags, tick=10)
    # Second check shouldn't activate again
    activated = d.check_triggers([], flags, tick=11)
    assert len(activated) == 0


def test_director_deadline():
    d = Director(_make_grimoire())
    flags = {"some_flag": True}
    d.check_triggers([], flags, tick=5)
    # Beat b4 activated at tick 5, deadline is 10
    assert len(d.check_deadlines(10)) == 0  # Not yet (5 ticks passed, need 10)
    assert len(d.check_deadlines(15)) == 1  # 10 ticks passed


def test_director_complete_beat():
    d = Director(_make_grimoire())
    d.complete_beat("b1")
    assert d.get_beat("b1").status == "completed"
    assert len(d.get_active_beats()) == 0


def test_director_protection():
    world = load_world(WORLD_PATH)
    d = Director(_make_grimoire())

    # Mira has hard protection
    result = d.evaluate_protection("mira", world.characters)
    assert result.allowed is False
    assert result.narration  # Should have fallback text

    # Kael has no protection
    result = d.evaluate_protection("kael", world.characters)
    assert result.allowed is True

    # Bosk has soft protection
    result = d.evaluate_protection("bosk", world.characters)
    assert result.allowed is False


def test_parse_grimoire():
    world = load_world(WORLD_PATH)
    grimoire = parse_grimoire(world.grimoire)
    assert grimoire.title == "Lowport Station — Act 1"
    assert len(grimoire.beats) >= 5
    # Check the automatic beat
    auto_beats = [b for b in grimoire.beats if b.trigger_type == "automatic"]
    assert len(auto_beats) >= 1


def test_director_compound_flag_condition():
    grimoire = Grimoire(
        title="Test",
        description="",
        beats=[
            StoryBeat(id="compound", name="Compound", description="Both flags needed",
                      trigger_type="flag",
                      trigger_condition="flag_a == true and flag_b == true"),
        ],
    )
    d = Director(grimoire)

    # Only one flag
    assert len(d.check_triggers([], {"flag_a": True}, tick=1)) == 0
    # Both flags
    assert len(d.check_triggers([], {"flag_a": True, "flag_b": True}, tick=2)) == 1


def test_director_event_visited_condition():
    grimoire = Grimoire(
        title="Test",
        description="",
        beats=[
            StoryBeat(id="visit", name="Visit", description="Visit dock",
                      trigger_type="event",
                      trigger_condition="visited:dock_7"),
        ],
    )
    d = Director(grimoire)
    events = [
        create_event(timestamp=1, type="interaction", summary="Moved",
                     location="dock_7", tags=["movement"]),
    ]
    assert len(d.check_triggers(events, {}, tick=1)) == 1
