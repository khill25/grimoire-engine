# Architecture Reference

Module-by-module guide to how the Grimoire Engine works. Updated as the codebase evolves.

## Engine Core (`grimoire/`)

### Models (`grimoire/models/`)
Pydantic models that define every data structure. These are the contract — used for DB schema, API responses, YAML validation, and editor types.

| File | What it defines |
|---|---|
| `character.py` | `Character`, `Goal`, `Affinity`, `Relationship`, `ScheduleEntry`, `ProtectionLevel` |
| `place.py` | `Place` — locations with connections, NPCs, atmosphere |
| `scene.py` | `Scene` — sub-locations within a place |
| `faction.py` | `Faction` — groups with values, members, reputation |
| `dialogue.py` | `DialogueTree`, `DialogueNode`, `DialogueChoice` |
| `event.py` | `Event` — append-only event log entries |
| `story.py` | `StoryMeta` — top-level story metadata (name, tone, worlds) |
| `world.py` | `WorldData` — container loaded by the YAML loader |
| `common.py` | Shared utilities |

### Engine (`grimoire/engine/`)
World simulation — the source of truth for game state.

| File | Role |
|---|---|
| `game_state.py` | `GameState` — flags dict, character dispositions, faction reputation, inventory, tick counter. Mutated by game actions. |
| `session.py` | `GameSession` — **the single orchestrator**. Both CLI and API use it. Ties together: GameState + Director + Storyteller + Writer + DialogueMatcher + Database + VectorStore. All game actions flow through here. |
| `context.py` | Assembles LLM context for Writer calls (system prompt → character core → scene → relationships → events → history → storyteller goal). |
| `events.py` | Event creation helpers, event log queries. |
| `schedules.py` | NPC schedule evaluation (where should a character be at tick N). |

### Director (`grimoire/director/director.py`)
Bridges narrative and simulation. Single file containing:

- **`StoryBeat`** — model for a narrative beat (id, trigger_type, trigger_condition, status, deadline, allow_off_rails)
- **`Grimoire`** — model holding title, description, and flat list of beats (parsed from nested acts/beats YAML)
- **`Director`** — the beat tracker:
  - `check_triggers(events, flags, tick)` — evaluates pending beats against game state
  - `check_deadlines(tick)` — finds expired active beats
  - `evaluate_protection(character_id, characters)` — NPC protection enforcement
- **Trigger types:** `automatic` (instant), `event` (talked_to/visited), `flag` (== != > comparisons)
- **Condition syntax:** `"talked_to:mira"`, `"visited:dock_7"`, `"flag == true"`, compound with ` and `

### Grimoire (`grimoire/grimoire/`)
The writing system — generates NPC dialogue and narration.

| File | Role |
|---|---|
| `storyteller.py` | `Storyteller` — creates goals/context for the Writer. "Get secrets out of Mira." |
| `writer.py` | `Writer` — takes Storyteller instructions + context → LLM call → structured output `{dialogue, action, emotion, internal}` |

### Dialogue (`grimoire/dialogue/`)
Handles player interaction with dialogue trees.

| File | Role |
|---|---|
| `tree_runner.py` | `TreeRunner` — walks authored dialogue trees. Tracks current node, evaluates choice conditions against flags, applies state_changes when nodes fire. |
| `matcher.py` | `DialogueMatcher` — embeds player free-text, cosine-compares to authored choices (threshold >0.75). Match → take that branch. No match → LLM one-off response, stay on same node. |

**Condition syntax in dialogue** (evaluated by `TreeRunner._check_condition`):
- `flag_name == value` / `flag_name != value` — equality/inequality
- `flag_name` (bare) — truthy check
- Does NOT support `>`, `and`, or event conditions (those are Director-only)

**State changes** (`DialogueNode.state_changes`): dict of `{flag_name: value}` applied when a node fires. These flags feed back into conditions and beat triggers.

### LLM (`grimoire/llm/`)
Provider interface with three backends.

| File | Role |
|---|---|
| `provider.py` | `LLMProvider` — abstract interface (generate, generate_json) |
| `ollama.py` | Primary provider. Does NOT use `format: json` — lets model think freely. Strips `<think>...</think>` blocks via `_strip_think_tags()`. |
| `anthropic.py` | Cloud fallback (Claude) |
| `openai.py` | Cloud fallback (OpenAI) |
| `embeddings.py` | `EmbeddingModel` — all-MiniLM-L6-v2, 384 dimensions, local CPU |
| `token_tracker.py` | `TokenTracker` — logs every LLM call with provider, model, job type, entity_id, token counts |

### Other Modules

| Module | Role |
|---|---|
| `loader/world_loader.py` | Loads YAML world files into `WorldData`. Supports two layouts: flat (`world/`) and nested (`story/`). |
| `storage/database.py` | Async SQLite via aiosqlite. Append-only event log. All calls wrapped in try/except (degrades gracefully). |
| `storage/vector_store.py` | ChromaDB wrapper. Stores dialogue choice embeddings, event embeddings, conversation summaries. |
| `storage/save_load.py` | Game state serialization to/from file. |
| `api/app.py` | FastAPI app setup |
| `api/routes.py` | REST endpoints (start, action, state, scene, dialogue, characters, events, beats, save, load) + WebSocket stream |
| `cli/harness.py` | CLI test harness — REPL that drives GameSession |

## World Data (`world/` and `story/`)

Two directory layouts coexist:

### Flat layout (`world/`)
```
world/
  characters/       # One YAML per character
  places/           # One YAML per place
  factions/         # One YAML per faction
  dialogue/         # One YAML per dialogue tree
  story/
    grimoire.yaml   # Acts, beats, endings
  world.yaml        # World-level metadata
```

### Nested layout (`story/`)
```
story/
  story.yaml        # Story-level metadata (name, tone, worlds)
  grimoire.yaml     # Acts + beats
  world/
    characters/
    places/
    factions/
    dialogue/
    world.yaml
```

The loader tries nested first, falls back to flat.

## Editor (`editor/`)

Web-based content authoring tool — reads/writes YAML files directly.

### Backend (`editor/backend/`)
- FastAPI app on port 17413, all routes under `/api/editor/`
- `yaml_io.py` — YAML read/write helpers
- Routes: `characters.py`, `places.py`, `scenes.py`, `factions.py`, `dialogue.py`, `story.py`, `generate.py`, `validate.py`, `items.py`, `game_types.py`
- Supports two data roots: **world path** (story content) and **game data path** (items, types, etc.)
- `--game-data` CLI flag to point at a separate game data directory (defaults to `<world_path>/game_data/`)
- Reuses Pydantic models from `grimoire/models/`
- Generation routes connect to engine's LLM providers

### Frontend (`editor/frontend/`)
React + TypeScript + Vite. No external UI library — plain React + inline styles. Dark theme.

#### Pages
| Page | Route | Purpose |
|---|---|---|
| `StorySettings.tsx` | `/` | **Main dashboard.** Story metadata, grimoire title/description, acts & beats management. Beat editing in right sidebar panel. |
| `WorldInfo.tsx` | `/world` | World-level metadata editor |
| `WorldGraph.tsx` | `/world-graph` | Visual place connection graph |
| `Characters.tsx` | `/characters` | Character list |
| `CharacterEditor.tsx` | `/characters/:id` | Full character editor (all fields, relationships, schedule, protection) |
| `Places.tsx` | `/places` | Place list |
| `PlaceEditor.tsx` | `/places/:id` | Place editor |
| `Scenes.tsx` | `/scenes` | Scene list |
| `SceneEditor.tsx` | `/scenes/:id` | Scene editor |
| `Factions.tsx` | `/factions` | Faction list |
| `FactionEditor.tsx` | `/factions/:id` | Faction editor |
| `Dialogue.tsx` | `/dialogue` | Dialogue tree list |
| `DialogueEditor.tsx` | `/dialogue/:id` | Node-by-node dialogue editor with condition builders and state change editors |
| `DialogueGraph.tsx` | `/dialogue/:id/graph` | Visual dialogue node graph |
| `StoryBeats.tsx` | `/story` | Dedicated beat editor (grouped by act, full trigger editor) |
| `GameTypes.tsx` | `/game-types` | Game type/enum editor (stats, damage types, slots, rarities, etc.) |
| `Items.tsx` | `/items` | Item list |
| `ItemEditor.tsx` | `/items/:id` | Dynamic item editor (type-specific fields for weapon/armor/consumable/etc.) |
| `Validate.tsx` | `/validate` | Cross-reference validation (broken refs, duplicate IDs) |

#### Components
| Component | Purpose |
|---|---|
| `Layout.tsx` | Sidebar navigation + main content area |
| `EntityList.tsx` | Reusable sortable table list |
| `EntitySelect.tsx` | Searchable entity picker (single + multi) |
| `FormField.tsx` | Form field wrapper + shared input/button styles |
| `ConditionBuilder.tsx` | Structured condition editor (flag comparisons, event conditions with entity pickers) |
| `StateChangesEditor.tsx` | Key/value pair editor for flag mutations (bool/text/num type selector) |
| `TriggerEditor.tsx` | Beat trigger editor (type dropdown + contextual condition builder) |
| `GenerateModal.tsx` | LLM generation prompt modal with provider selector |
| `FieldAssist.tsx` | Inline AI button for individual text fields |
| `ExtrasEditor.tsx` | Generic key/value extras dict editor |
| `TypeSelect.tsx` | Schema-validated dropdown (reads from GameTypes context) |
| `ValidationPanel.tsx` | Validation results display |
| `GraphSidePanel.tsx` | Side panel for graph views |

## Data Flow

```
YAML files ──load──> WorldData ──init──> GameSession
                                            ├── GameState (flags, dispositions, events)
                                            ├── Director (beat tracking, triggers)
                                            ├── Storyteller → Writer (LLM generation)
                                            ├── DialogueMatcher + TreeRunner
                                            ├── Database (SQLite event log)
                                            └── VectorStore (ChromaDB embeddings)

Player action ──> GameSession.process_action()
                    ├── GameState.update()
                    ├── Director.check_triggers()
                    ├── Writer.generate() (if LLM needed)
                    └── returns TickResult

Editor ──YAML read/write──> world/ files (same files the engine loads)
```

## Test Coverage

133 unit tests across 10 test files + 14 live tests (require Ollama + embeddings).

| File | Count | What it covers |
|---|---|---|
| `test_models.py` | 17 | Pydantic model validation |
| `test_dialogue.py` | 15 | Tree runner, condition evaluation, state changes |
| `test_director.py` | 10 | Beat triggers, deadlines, protection |
| `test_engine.py` | 12 | Game state, events, schedules |
| `test_session.py` | 17 | Full GameSession orchestration |
| `test_llm.py` | 5 | Provider interface, think tag stripping |
| `test_api.py` | 14 | FastAPI endpoint tests |
| `test_storage.py` | 15 | SQLite + ChromaDB operations |
| `test_save_load.py` | 3 | Game state serialization |
| `test_ollama_live.py` | 6 | Live Ollama LLM calls |
| `test_embeddings_live.py` | 8 | Live embedding model tests |
