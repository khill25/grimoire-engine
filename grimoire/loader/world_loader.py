"""Load world definitions from YAML files, validate against Pydantic models."""

from pathlib import Path

import yaml

from grimoire.models.character import Character
from grimoire.models.dialogue import DialogueTree
from grimoire.models.faction import Faction
from grimoire.models.place import Place
from grimoire.models.scene import Scene
from grimoire.models.story import Story
from grimoire.models.world import World


class WorldData:
    """Container for all loaded world data."""

    def __init__(self) -> None:
        self.name: str = ""
        self.tone: str = ""
        self.description: str = ""
        self.time_config: dict = {}
        self.characters: dict[str, Character] = {}
        self.places: dict[str, Place] = {}
        self.scenes: dict[str, Scene] = {}
        self.factions: dict[str, Faction] = {}
        self.dialogue_trees: dict[str, DialogueTree] = {}
        self.grimoire: dict = {}
        self.world_model: World | None = None
        self.story_model: Story | None = None


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


def _detect_layout(root: Path) -> str:
    """Detect whether root is a story/ dir (new layout) or world/ dir (old layout)."""
    # New layout: root has story.yaml and world/ subdir
    if (root / "story.yaml").exists() and (root / "world").exists():
        return "story"
    # New layout: root/world/world.yaml has an 'id' field (World model)
    if (root / "world" / "world.yaml").exists():
        try:
            data = _load_yaml(root / "world" / "world.yaml")
            if "id" in data:
                return "story"
        except Exception:
            pass
    # Old layout: root has world.yaml with 'name' but no 'id'
    if (root / "world.yaml").exists():
        return "world"
    # Fallback: check for characters/ dir directly under root
    if (root / "characters").exists():
        return "world"
    return "story"


def _load_places_nested(places_dir: Path) -> tuple[dict[str, Place], dict[str, Scene]]:
    """Load places from nested directory structure (place_id/place.yaml + scenes/)."""
    places = {}
    scenes = {}
    if not places_dir.exists():
        return places, scenes
    for place_dir in sorted(places_dir.iterdir()):
        if not place_dir.is_dir():
            continue
        place_file = place_dir / "place.yaml"
        if not place_file.exists():
            continue
        data = _load_yaml(place_file)
        place = Place.model_validate(data)
        places[place.id] = place

        # Load scenes under this place
        scenes_dir = place_dir / "scenes"
        if scenes_dir.exists():
            for scene_file in sorted(scenes_dir.glob("*.yaml")):
                scene_data = _load_yaml(scene_file)
                # Ensure place_id is set from directory context
                scene_data.setdefault("place_id", place.id)
                scene = Scene.model_validate(scene_data)
                scenes[scene.id] = scene
    return places, scenes


def load_world(path: str) -> WorldData:
    """Load a complete world definition from a directory of YAML files.

    Supports two layouts:
    - Old: world/ with flat structure (world.yaml, characters/, places/*.yaml, etc.)
    - New: story/ with nested structure (story.yaml, world/world.yaml, world/places/*/place.yaml, etc.)
    """
    root = Path(path)
    if not root.exists():
        raise FileNotFoundError(f"World directory not found: {path}")

    world = WorldData()
    layout = _detect_layout(root)

    if layout == "story":
        _load_story_layout(root, world)
    else:
        _load_world_layout(root, world)

    return world


def _load_world_layout(root: Path, world: WorldData) -> None:
    """Load from old flat world/ directory structure."""
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

    # Grimoire (old layout: story/grimoire.yaml)
    story_file = root / "story" / "grimoire.yaml"
    if story_file.exists():
        world.grimoire = _load_yaml(story_file)


def _load_story_layout(root: Path, world: WorldData) -> None:
    """Load from new nested story/ directory structure."""
    world_dir = root / "world"

    # Story metadata
    story_file = root / "story.yaml"
    if story_file.exists():
        data = _load_yaml(story_file)
        world.story_model = Story.model_validate(data)

    # World metadata
    world_yaml = world_dir / "world.yaml"
    if world_yaml.exists():
        data = _load_yaml(world_yaml)
        world.world_model = World.model_validate(data)
        world.name = world.world_model.name
        world.tone = world.world_model.tone
        world.description = world.world_model.description
        world.time_config = world.world_model.time_config

    # Entities
    world.characters = _load_directory(world_dir / "characters", Character)
    world.factions = _load_directory(world_dir / "factions", Faction)
    world.dialogue_trees = _load_directory(world_dir / "dialogue", DialogueTree)

    # Places + scenes (nested structure)
    world.places, world.scenes = _load_places_nested(world_dir / "places")

    # Grimoire (grimoire.yaml at story root)
    grimoire_file = root / "grimoire.yaml"
    if grimoire_file.exists():
        world.grimoire = _load_yaml(grimoire_file)
