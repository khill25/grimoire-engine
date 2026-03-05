"""Tests for Pydantic models and world loading."""

from pathlib import Path

import pytest

from grimoire.models import (
    Affinity,
    Character,
    DialogueChoice,
    DialogueNode,
    DialogueTree,
    Event,
    Faction,
    GameTime,
    Goal,
    Place,
    ProtectionLevel,
    Relationship,
    ScheduleEntry,
)
from grimoire.loader.world_loader import load_world


# --- Model unit tests ---

def test_goal():
    g = Goal(id="g1", description="Test goal", motivation="Testing")
    assert g.status == "active"


def test_affinity_bounds():
    a = Affinity(target="test", score=0.5)
    assert a.score == 0.5
    with pytest.raises(Exception):
        Affinity(target="test", score=1.5)


def test_relationship_defaults():
    r = Relationship(target_id="char1", types=["friend"])
    assert r.trust == 0.0
    assert r.familiarity == 0.0


def test_schedule_entry():
    s = ScheduleEntry(time_start=6, time_end=14, location="bar", activity="work")
    assert s.interruptible is True


def test_protection_level_defaults():
    p = ProtectionLevel()
    assert p.level == "none"


def test_game_time():
    t = GameTime(tick=25, ticks_per_hour=1, hours_per_day=24)
    assert t.hour == 1
    assert t.day == 1


def test_character_minimal():
    c = Character(
        id="test",
        name="Test",
        age=30,
        backstory="A test character.",
        personality="Bland.",
        speech_style="monotone",
        motivations=["testing"],
    )
    assert c.status == "alive"
    assert c.goals == []


def test_place_minimal():
    p = Place(id="p1", name="Test Place", type="room", description="A room.")
    assert p.is_public is True
    assert p.connections == []


def test_event():
    e = Event(id="e1", timestamp=0, type="interaction", summary="Something happened")
    assert e.visibility == "local"
    assert e.severity == 0.0


def test_faction():
    f = Faction(id="f1", name="Test Faction", description="A faction.")
    assert f.reputation_with_player == 0.0


def test_dialogue_tree():
    tree = DialogueTree(
        id="t1",
        character_id="npc1",
        context="test",
        root_node="n1",
        nodes=[
            DialogueNode(
                id="n1",
                speaker="npc1",
                text="Hello.",
                choices=[
                    DialogueChoice(id="c1", text="Hi.", next_node="n2"),
                ],
            ),
            DialogueNode(id="n2", speaker="npc1", text="Bye.", choices=[]),
        ],
    )
    assert len(tree.nodes) == 2
    assert tree.nodes[0].choices[0].next_node == "n2"


# --- World loader tests ---

WORLD_PATH = str(Path(__file__).parent.parent / "world")


def test_load_world():
    world = load_world(WORLD_PATH)
    assert world.name == "Lowport Station"
    assert len(world.characters) == 5
    assert len(world.places) == 3
    assert len(world.factions) == 1
    assert len(world.dialogue_trees) == 2


def test_load_characters():
    world = load_world(WORLD_PATH)
    mira = world.characters["mira"]
    assert mira.name == "Mira Vasik"
    assert mira.age == 34
    assert len(mira.relationships) == 4
    assert mira.protection.level == "hard"

    bosk = world.characters["bosk"]
    assert bosk.occupation == "Dockworker, Union Representative"
    assert "dockworkers_union" in bosk.faction_ids


def test_load_places():
    world = load_world(WORLD_PATH)
    tap = world.places["rusty_tap"]
    assert "dock_7" in tap.connections
    assert tap.owner == "mira"

    dock = world.places["dock_7"]
    assert dock.is_public is True


def test_load_dialogue_trees():
    world = load_world(WORLD_PATH)
    mira_tree = world.dialogue_trees["mira_first_meeting"]
    assert mira_tree.character_id == "mira"
    assert mira_tree.root_node == "greeting"
    assert len(mira_tree.nodes) > 5

    bosk_tree = world.dialogue_trees["bosk_union_talk"]
    assert bosk_tree.character_id == "bosk"


def test_load_story_bible():
    world = load_world(WORLD_PATH)
    assert world.story_bible["title"] == "Lowport Station — Act 1"
    assert len(world.story_bible["acts"]) == 1
    beats = world.story_bible["acts"][0]["beats"]
    assert len(beats) >= 5


def test_load_world_missing_dir():
    with pytest.raises(FileNotFoundError):
        load_world("/nonexistent/path")
