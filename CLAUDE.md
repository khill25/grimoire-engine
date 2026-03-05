# Grimoire Engine

A self-contained Python backend service that powers dynamic RPG world simulation. It exposes a REST/WebSocket API for game clients (eventually Godot). Three core components: **Grimoire** (writing/dialogue), **Director** (narrative-simulation bridge), **Engine** (world state, source of truth).

## Tech Stack

- Python 3.11+, FastAPI (async + WebSocket), SQLAlchemy (async) + SQLite, ChromaDB (embedded), Pydantic everywhere
- LLM: Ollama (primary, local, 32b model) with Anthropic and OpenAI as cloud fallbacks. Use litellm or thin wrapper to normalize.
- Embeddings: all-MiniLM-L6-v2 (local CPU model)
- World content authored in YAML
- Testing: pytest

## Project Structure

```
grimoire/
  models/              # Pydantic models (character, place, event, faction, dialogue, common)
  grimoire/            # Writing system (storyteller.py, writer.py)
  director/            # Beat tracking, trigger eval, protection enforcement
  engine/              # Game state, tick loop, context assembly, events, schedules
  llm/                 # Provider interface + ollama/anthropic/openai/embeddings
  dialogue/            # Free-text matcher + dialogue tree runner
  api/                 # FastAPI app + routes
  loader/              # YAML world loader
  storage/             # SQLAlchemy DB, ChromaDB wrapper, save/load
  cli/                 # CLI test harness
world/                 # Sample YAML world files (characters/, places/, factions/, dialogue/, story/)
tests/                 # pytest tests per component
```

## Key Architecture Decisions

- **Pydantic models are the contract** — they define DB schema, API responses, and YAML validation. All data flows through them.
- **Append-only event log** in SQLite. Events are also embedded in ChromaDB for contextual retrieval.
- **Dialogue trees are the backbone.** Every choice node has authored options + `[Free Response]`. Free-text is embedded and cosine-compared to authored choices (threshold >0.75). No match = LLM one-off response, return to same node.
- **The Engine is the source of truth.** The Director reads from it; the Grimoire requests details from it. Never store authoritative state outside the Engine.
- **Director is lightweight for MVP** — beat tracking + trigger checking + deadline monitoring + protection enforcement. No tension management or trajectory reasoning yet.
- **LLM responses must not create major story changes** unless the developer explicitly flags a beat as off-rails-allowed.

## The 6 LLM Jobs

Each has an authored/template fallback. Tag every LLM call with its job type for token tracking.

1. Free-text interpretation — map input to authored branch or generate contextual reply
2. Dynamic event narration — narrate unpredicted player actions
3. Ambient NPC dialogue — contextual one-liners for background characters
4. Side quest generation — fill structural templates with creative details
5. Dialogue convergence — bridge unauthored branches back to authored nodes
6. Edge case handling — catch-all for weird player actions

## Data Models (Pydantic)

All defined in `grimoire/models/`. Key models:

- **Character**: id, name, age, status, backstory, personality, speech_style, motivations, goals (Goal), wants, affinities (Affinity), occupation, location, schedule (ScheduleEntry), relationships (Relationship), faction_ids, protection (ProtectionLevel)
- **Place**: id, name, type, description, current_state, connections, region, default_npcs, current_npcs, is_public, owner, atmosphere
- **Event**: id, timestamp (game tick), type (interaction/observation/world_change/off_screen/system), summary, details, participants, witnesses, location, visibility (private/local/regional/global), tags, severity
- **Faction**: id, name, description, values, member_ids, reputation_with_player
- **DialogueTree/DialogueNode/DialogueChoice**: tree has character_id, context, root_node, nodes. Node has speaker, text, condition, state_changes, choices, llm_escape, is_key_moment. Choice has text, next_node, condition, embedding.

## Context Assembly (Writer Prompts)

When assembling LLM context for Writer calls, include in this order:
1. System prompt (engine instructions + tone)
2. Character core: backstory, personality, speech_style, motivations, goals, wants, affinities
3. Scene: location, who's present, what just happened
4. Relationship with player (trust, disposition, history)
5. Recent relevant events (ChromaDB by relevance + SQLite for location-recent)
6. Conversation history (LLM-compressed summaries from ChromaDB)
7. Storyteller goal (if provided)

Writer responses use structured JSON: `{dialogue, action, emotion, internal}`

## API Endpoints

```
POST   /game/start          — Load world, init state
POST   /game/action          — Player action -> tick result
GET    /game/state           — World state snapshot
GET    /game/scene/{place}   — Location description
POST   /game/dialogue        — Player dialogue input -> NPC response
GET    /game/characters      — List known characters
GET    /game/events          — Query event log (filterable)
GET    /game/beats           — Director story beat status
WS     /game/stream          — Real-time updates (scaffolded for Godot)
```

## Token Budget Tracking

Every LLM call logs: provider, model, prompt_tokens, completion_tokens, call_type (which of the 6 jobs), entity_id.

## Sample Test World

3 places (Rusty Tap bar, Dock 7, Mira's Quarters), 5 characters (Mira, Bosk, Kael, Vera, Tam), 1 faction (Dockworkers Union). Authored dialogue trees for Mira (first meeting) and Bosk (asking about Union) with 3-4 depth branching, conditional nodes, and free response slots.

## MVP Definition of Done

- Load world from YAML (including dialogue trees)
- Walk between connected places, see descriptions
- Talk to NPCs via authored dialogue trees with branching
- Free-text matching to authored branches (>0.75 similarity)
- LLM in-character responses on free-text miss
- NPCs reference relationships, goals, recent events
- Actions generate events, logged to SQLite + embedded in ChromaDB
- NPC schedules (they move between locations over time)
- Protected NPC enforcement with narrated outcomes
- Director beat tracking + trigger checks
- LLM provider switching via config (Ollama/Anthropic/OpenAI)
- Save/load game state (SQLite + ChromaDB + Director state)
- CLI and REST API access to all interactions
- Token usage tracking per call, tagged by LLM job type
- Self-contained, no player-managed dependencies

## Build Order

1. Data models (Pydantic) in `grimoire/models/`
2. World loader (YAML -> validated models -> DB + ChromaDB)
3. Dialogue matching system (embedding + cosine similarity)
4. Game state manager / Engine (tick loop, process_action, advance_tick)
5. Director (beat tracker, trigger eval, deadlines, protection)
6. LLM provider interface + implementations (Ollama, Anthropic, OpenAI, embeddings)
7. Context assembly (Storyteller -> Writer pipeline)
8. API layer (FastAPI routes)
9. CLI test harness
10. Save/load system
