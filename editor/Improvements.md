CLAUDE Read This and provide feedback on the proposed changes. The user needs help designing this editor in a way that affects the objects referenced by the grimoire-engine and game client. This editor is akin to bethesda's creation kit. The story and everything within should be able to be edited in here. As an additional phase it is desired to load a save and view/edit the world state. Please carefuly evaluate changes and check for blind spots. This edtior is a tool that  supports creation of an rpg game.

# The Overview
This is an editor for the game story. Story is used to reference all the information needed to bootstrap the game and get the grimoire-engine running. The 'grimoire' is used to refer to the entirety of the game's story information.

These changes may require This would also alterations to existing object definitions and database schema. This is considered a nonbreaking change as we are still iterating on what is needed, what works, and what doesn't work, don't worry about migrations. Old data is not important at this stage of the project.

Right now a `world` has `places` and places seem to have "regions" but region is simply a string with no real meaning. This new framing is very similar to the old but some properties move or become expanded.

A `Story` will replace what `World` is now, it's a root to hold many worlds. In all likelyhood there may only ever be one world but if there are dlc's or expansions, adding more worlds would make sense. They contain a set of places.

Story-(potentially many)>World-(many)>Places-(many)->Scenes

# Design Overview
Some of yaml definitions are more complete than others. I'm not sure what's needed at this point and I'd like it to be flexible. I'd like at least these to be included but would like a way to dynamically add new fields. Things may not be complete, as such, a plan should be devised to align on what this editor is doing, how it's used, and it's part in game creation. 

#### Scene
In game terms, a scene is portion of a Place's map. This represents what the player actually moves around in. This can be loaded and unloaded, and/or stitched together to create a larger area. This is where life happens. I dont think that Scene's really know anything about other scenes. It's a Place's job to contain and relate scenes.
```
id: str
name: str
type: str
description: str
current_state: str
current_npcs: list[str] # NPCs that are currently here
```

#### Place
A place is a collection of scenes. 
This is the existing schema for Place, it would need to updated to include a collection of scenes. default_npcs and current_npcs might make more sense in scene.
```
id: str
name: str
type: str
description: str
current_state: str
connections: list[str]   # place_ids
region: str
default_npcs: list[str]  # character_ids
current_npcs: list[str]
is_public: bool
owner: str               # character_id or faction_id
atmosphere: str
```

#### World
Is a collection of places.
A world contains factions, characters, places, regions
```
id: str
name: str
type: str
description: str
```

#### Story
Everything happens inside the story. It's the container than houses the overall story plot(story beats), tone, descripion, endings. --This is subject to discussion. I could use some guidance on what else may be needed--
```
name: str
tone: str
description: str
story_beats: list[str] # list of story_beat_ids
worlds: list[str] # world_ids
```

## Game Objects
These entities/classes/objects are not part of the Grimoire, but reference it. These are used by the game-client.

#### Map
This is a game object it represents the ground, buildings, npc placement, items placement, etc. This is effectively a game object extension of a Place.
This would basically be a 2d top down rpg representation, althought likely simplified. This should be 2d base layout for creating 3d maps/environments.

-- Unsure what the schema for this looks like and is up for discussion. --
* The editor should allow creation and editing of maps. Maps are to start as simple 2d represetations of the game space.
* Adding entities - characters, items, triggers, etc
    * Search to add entities
    * Creation of new entities right from the map editor. Modal or new tab that allows editing of the newly created entity type.
* Basic tileset - Dev can place ground, walls, doors, etc 

# New Editor Features
* Addition of dynamic fields to add to objects. Object structures should allow new fields to be added/removed such that we can update our models to load thenew fields and have them be available for the grimoire-engine and game to use.
* Any fields that are references to other objects should have a drop down filtered with search so editors don't need to guess about ids.
* id fields and references should have a linter -> A way to make sure that things are referenced correctly. There may be orphaned objects and that's okay sometimes you want to create content that isn't connected to anything because you are sure where it goes yet.


# Proposed file structure for a story's yaml files. 
-- This is open to discussion --
```
story/
  grimoire.yaml   # acts, beats, endings (Director uses this)
  game/
    maps/
      docking_bay/ # houses a specific map's required files, tile information, items, etc
        tileset.yaml
        office.yaml
        werehouse.yaml
    ... # other future game specific directories and files 
  world/
    world.yaml          # global settings, tone, time config
    characters/
      mira.yaml
      bosk.yaml
      ...
    places/
      docking_bay.yaml
      rusty_tap_bar.yaml
      ...
    scenes/
      docking_bay_office.yaml
      docking_bay_warehouse.yaml
      ...
    factions/
      dockworkers_union.yaml
      ...
    dialogue/
      mira_conversations.yaml
      bosk_conversations.yaml
      ...
```