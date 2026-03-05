"""Load world definitions from YAML files, validate against Pydantic models."""

from pathlib import Path

import yaml

from grimoire.models.character import Character
from grimoire.models.dialogue import DialogueTree
from grimoire.models.faction import Faction
from grimoire.models.place import Place


class WorldData:
    """Container for all loaded world data."""

    def __init__(self) -> None:
        self.name: str = ""
        self.tone: str = ""
        self.description: str = ""
        self.time_config: dict = {}
        self.characters: dict[str, Character] = {}
        self.places: dict[str, Place] = {}
        self.factions: dict[str, Faction] = {}
        self.dialogue_trees: dict[str, DialogueTree] = {}
        self.story_bible: dict = {}


def _load_yaml(path: Path) -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


def _load_directory(directory: Path, model_class: type, key: str = "id") -> dict:
    """Load all YAML files in a directory and validate against a Pydantic model."""
    items = {}
    if not directory.exists():
        return items
    for file in sorted(directory.glob("*.yaml")):
        data = _load_yaml(file)
        item = model_class.model_validate(data)
        items[getattr(item, key)] = item
    return items


def load_world(path: str) -> WorldData:
    """Load a complete world definition from a directory of YAML files.

    Reads characters, places, factions, dialogue trees, and story bible.
    Validates all data against Pydantic models.
    """
    root = Path(path)
    if not root.exists():
        raise FileNotFoundError(f"World directory not found: {path}")

    world = WorldData()

    # Global settings
    world_file = root / "world.yaml"
    if world_file.exists():
        world_config = _load_yaml(world_file)
        world.name = world_config.get("name", "")
        world.tone = world_config.get("tone", "")
        world.description = world_config.get("description", "")
        world.time_config = world_config.get("time", {})

    # Entities
    world.characters = _load_directory(root / "characters", Character)
    world.places = _load_directory(root / "places", Place)
    world.factions = _load_directory(root / "factions", Faction)
    world.dialogue_trees = _load_directory(root / "dialogue", DialogueTree)

    # Story bible (raw dict for now — Director will parse it)
    story_file = root / "story" / "story_bible.yaml"
    if story_file.exists():
        world.story_bible = _load_yaml(story_file)

    return world
