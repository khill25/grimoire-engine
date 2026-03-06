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
    Scene,
    ScheduleEntry,
    Story,
    World,
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
    assert s.scene == ""


def test_schedule_entry_with_scene():
    s = ScheduleEntry(time_start=6, time_end=14, location="bar", scene="bar_main", activity="work")
    assert s.scene == "bar_main"


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
    assert c.extras == {}


def test_character_extras():
    c = Character(
        id="test", name="Test", age=30,
        backstory="bg", personality="p", speech_style="s",
        motivations=["m"], extras={"custom_trait": "brave", "power_level": 9001},
    )
    assert c.extras["custom_trait"] == "brave"
    assert c.extras["power_level"] == 9001
    # Round-trip serialization
    data = c.model_dump()
    c2 = Character.model_validate(data)
    assert c2.extras == c.extras


def test_place_minimal():
    p = Place(id="p1", name="Test Place", type="room", description="A room.")
    assert p.is_public is True
    assert p.connections == []
    assert p.scenes == []
    assert p.extras == {}


def test_place_with_scenes():
    p = Place(id="p1", name="Test Place", type="room", description="A room.",
              scenes=["s1", "s2"])
    assert p.scenes == ["s1", "s2"]


def test_event():
    e = Event(id="e1", timestamp=0, type="interaction", summary="Something happened")
    assert e.visibility == "local"
    assert e.severity == 0.0
    assert e.extras == {}


def test_faction():
    f = Faction(id="f1", name="Test Faction", description="A faction.")
    assert f.reputation_with_player == 0.0
    assert f.extras == {}


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
    assert tree.extras == {}


def test_scene_model():
    s = Scene(id="s1", name="Main Hall", place_id="tavern")
    assert s.type == ""
    assert s.default_npcs == []
    assert s.connections == []
    assert s.is_public is True
    assert s.extras == {}


def test_scene_full():
    s = Scene(
        id="s1", name="Main Hall", place_id="tavern",
        type="bar_floor", description="The main area.",
        default_npcs=["barkeeper"], current_npcs=["barkeeper", "patron"],
        connections=["back_room"], atmosphere="Warm and dim.",
        is_public=True, owner="barkeeper",
        extras={"lighting": "amber"},
    )
    assert s.place_id == "tavern"
    assert len(s.current_npcs) == 2
    assert s.extras["lighting"] == "amber"


def test_world_model():
    w = World(id="w1", name="Test World")
    assert w.type == ""
    assert w.tone == ""
    assert w.time_config == {}
    assert w.extras == {}


def test_world_full():
    w = World(
        id="w1", name="Test World", type="space_station",
        description="A test world", tone="dark sci-fi",
        time_config={"ticks_per_hour": 2, "hours_per_day": 24},
        extras={"gravity": 0.8},
    )
    assert w.time_config["ticks_per_hour"] == 2
    assert w.extras["gravity"] == 0.8


def test_story_model():
    s = Story(name="Test Story")
    assert s.description == ""
    assert s.tone == ""
    assert s.worlds == []
    assert s.extras == {}


def test_story_full():
    s = Story(
        name="Test Story", description="An epic tale.",
        tone="dark fantasy", worlds=["world1", "world2"],
        extras={"difficulty": "hard"},
    )
    assert len(s.worlds) == 2
    assert s.extras["difficulty"] == "hard"


# --- World loader tests (old layout) ---

WORLD_PATH = str(Path(__file__).parent.parent / "world")


def test_load_world():
    world = load_world(WORLD_PATH)
    assert world.name == "Shattered Kingdom"
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


def test_load_grimoire():
    world = load_world(WORLD_PATH)
    assert world.grimoire["title"] == "Lowport Station — Act 1"
    assert len(world.grimoire["acts"]) == 1
    beats = world.grimoire["acts"][0]["beats"]
    assert len(beats) >= 5


def test_load_world_missing_dir():
    with pytest.raises(FileNotFoundError):
        load_world("/nonexistent/path")


# --- World loader tests (new story layout) ---

STORY_PATH = str(Path(__file__).parent.parent / "story")


def test_load_story_layout():
    world = load_world(STORY_PATH)
    assert world.name == "Shattered Kingdom"
    assert len(world.characters) == 5
    assert len(world.places) == 3
    assert len(world.factions) == 1
    assert len(world.dialogue_trees) == 2


def test_load_story_layout_world_model():
    world = load_world(STORY_PATH)
    assert world.world_model is not None
    assert world.world_model.id == "shattered_kingdom"
    assert world.world_model.name == "Shattered Kingdom"


def test_load_story_layout_story_model():
    world = load_world(STORY_PATH)
    assert world.story_model is not None
    assert world.story_model.name == "Lowport Station"
    assert "shattered_kingdom" in world.story_model.worlds


def test_load_story_layout_scenes():
    world = load_world(STORY_PATH)
    assert len(world.scenes) >= 3
    # Check a specific scene
    assert "rusty_tap_main_hall" in world.scenes
    hall = world.scenes["rusty_tap_main_hall"]
    assert hall.place_id == "rusty_tap"
    assert hall.name == "Main Hall"


def test_load_story_layout_places_have_scenes():
    world = load_world(STORY_PATH)
    tap = world.places["rusty_tap"]
    assert "rusty_tap_main_hall" in tap.scenes


def test_load_story_layout_grimoire():
    world = load_world(STORY_PATH)
    assert world.grimoire["title"] == "Lowport Station — Act 1"
    assert len(world.grimoire["acts"]) >= 1
