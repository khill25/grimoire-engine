# Project Status

Current state of Grimoire Engine, World Builder Editor, and Shattered Kingdom.

## Engine — Core Backend

### Complete
- [x] Pydantic models for all entities (Character, Place, Scene, Faction, Dialogue, Event, Story)
- [x] YAML world loader (flat + nested layouts)
- [x] GameState — flags, dispositions, faction reputation, inventory, tick counter
- [x] GameSession — single orchestrator for CLI + API
- [x] Director — beat tracking, trigger evaluation (automatic/event/flag), deadline checking
- [x] NPC protection enforcement (none/soft/hard/immortal)
- [x] Dialogue tree runner with condition evaluation and state_changes
- [x] Free-text matching via embeddings (all-MiniLM-L6-v2, cosine similarity >0.75)
- [x] Writer — LLM-powered NPC dialogue generation with structured output
- [x] Storyteller — goal/context assembly for Writer
- [x] Context assembly (character core → scene → relationships → events → history)
- [x] LLM providers: Ollama (primary), Anthropic, OpenAI (fallbacks)
- [x] Think tag stripping for Qwen3 model
- [x] Token tracking on every LLM call
- [x] SQLite event log (append-only, async)
- [x] ChromaDB vector store (dialogue embeddings, event search, conversation summaries)
- [x] Save/load game state
- [x] REST API (start, action, state, scene, dialogue, characters, events, beats, save, load)
- [x] WebSocket endpoint (scaffolded for Godot)
- [x] CLI test harness
- [x] 133 unit tests + 14 live tests

### Missing / Planned
- [ ] NPC schedule-driven movement (schedules exist but don't drive position changes during ticks)
- [ ] Ambient NPC dialogue generation (job type defined, not wired)
- [ ] Side quest generation from templates (job type defined, not wired)
- [ ] Dialogue convergence — bridge unauthored branches back to authored nodes (job type defined, not wired)
- [ ] Storyteller hook generation when beats expire past deadline
- [ ] LLM-compressed conversation summaries stored in ChromaDB
- [ ] Tension management in Director (designed but not implemented)
- [ ] Player trajectory reasoning in Director
- [ ] Multi-world support (model supports it, loader doesn't fully)
- [ ] Bundled deployment (player shouldn't need to install Python/Ollama)

## World Builder Editor

### Complete
- [x] Backend CRUD API for all entities (characters, places, scenes, factions, dialogue, story/acts/beats)
- [x] YAML read/write (editor modifies the same files the engine loads)
- [x] Validation endpoint (broken references, duplicate IDs, entity counts)
- [x] LLM generation: full character, dialogue tree, story beats, field-level assist
- [x] React frontend with dark theme, sidebar navigation
- [x] Character editor (all fields: relationships, schedule, protection, goals, affinities)
- [x] Place editor (connections, NPCs, atmosphere)
- [x] Scene editor
- [x] Faction editor (values, members, reputation)
- [x] Dialogue tree editor (node list, node editing, choice editing)
- [x] Dialogue graph visualization
- [x] World graph visualization (place connections)
- [x] Story page — dashboard with metadata, grimoire, acts & beats
- [x] Story Beats page — dedicated beat editor with trigger editor
- [x] Generate modal (prompt + provider selection)
- [x] Field assist (inline AI button on text fields)
- [x] Entity select component (searchable picker for IDs)
- [x] Validation page
- [x] Condition builder component (structured flag/event conditions)
- [x] State changes editor component (key/value with type selectors)
- [x] Trigger editor component (type dropdown + contextual conditions)

### Known Issues
- [ ] **Story page beat editor still uses raw text inputs** for trigger type/condition — needs TriggerEditor component (the dedicated Story Beats page has it, but Story page sidebar doesn't)
- [ ] Dialogue editor node conditions don't support compound `and` (engine dialogue conditions don't either, so this is consistent but limiting)
- [ ] No undo/redo in any editor
- [ ] No confirmation before navigating away with unsaved changes
- [ ] `editor/PROGRESS.md` has wrong port numbers (says 15231/17413, actual is 5173/14200)

### Future Enhancements
- [ ] Visual node graph editor for dialogue (canvas drag-and-drop, not just visualization)
- [ ] Place connection graph editing (add/remove connections visually)
- [ ] Beat dependency graph visualization
- [ ] Inline dialogue tree preview/playtest from editor
- [ ] Save game state viewer/editor (load a save, inspect world state)
- [ ] Character relationship graph
- [ ] Search across all entities
- [ ] Bulk operations (delete multiple, move beats between acts)
- [ ] Import/export (JSON, other formats)

## Shattered Kingdom — Godot Client

### Complete
- [x] Godot 4.4 project scaffold
- [x] API client connecting to engine on port 14123
- [x] Basic game loop (start → action → display)

### Status
Early stage. Focus has been on engine and editor. See `~/shattered-kingdom/` for current state.

## Sample World

The test world in `world/` contains:
- 3 places: Rusty Tap bar, Dock 7, Mira's Quarters
- 5 characters: Mira, Bosk, Kael, Vera, Tam
- 1 faction: Dockworkers Union
- 2 dialogue trees: Mira first meeting (~15 nodes), Bosk union talk (~18 nodes)
- 1 grimoire: Act 1 with 6 beats

## Running Everything

```bash
# Engine API
uv run uvicorn grimoire.api.app:app --port 14123 --reload

# Editor backend
uv run python -m editor.backend.app world --port 14200

# Editor frontend (dev)
cd editor/frontend && npm run dev
# Opens at http://localhost:5173

# Tests
uv run pytest tests/ --ignore=tests/test_ollama_live.py --ignore=tests/test_embeddings_live.py

# CLI
uv run grimoire-cli
```
