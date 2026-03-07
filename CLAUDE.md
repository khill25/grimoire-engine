# Grimoire Engine

A self-contained Python backend service that powers dynamic RPG world simulation. It exposes a REST/WebSocket API for game clients (eventually Godot). Three core components: **Grimoire** (writing/dialogue), **Director** (narrative-simulation bridge), **Engine** (world state, source of truth).

## Tech Stack

- Python 3.11+, FastAPI (async + WebSocket), aiosqlite (async SQLite), ChromaDB (embedded), Pydantic everywhere
- LLM: Ollama (primary, local) with Anthropic and OpenAI as cloud fallbacks. Thin wrapper per provider.
- Primary model: `hf.co/unsloth/Qwen3-30B-A3B-GGUF:Q4_K_M` on `192.168.50.181:11434`
- Embeddings: all-MiniLM-L6-v2 (local CPU model via sentence-transformers, 384 dimensions)
- World content authored in YAML
- Testing: pytest + pytest-asyncio

## Build / Test / Run

```bash
# Install (creates .venv, installs all deps from lockfile)
uv sync --dev

# Run all tests (excluding live LLM/embedding tests)
uv run pytest tests/ --ignore=tests/test_ollama_live.py --ignore=tests/test_embeddings_live.py

# Run live tests (requires Ollama instance + sentence-transformers)
uv run pytest tests/test_ollama_live.py tests/test_embeddings_live.py -v

# Run single test
uv run pytest tests/test_session.py::test_session_dialogue_start -v

# CLI harness
uv run grimoire-cli [world_path] [start_location]

# API server
uv run uvicorn grimoire.api.app:app --reload
```

## Project Structure

```
grimoire/
  models/              # Pydantic models (character, place, event, faction, dialogue, common)
  grimoire/            # Writing system (storyteller.py, writer.py)
  director/            # Beat tracking, trigger eval, protection enforcement
  engine/              # Game state, tick loop, context assembly, events, schedules, session
  llm/                 # Provider interface + ollama/anthropic/openai/embeddings/token_tracker
  dialogue/            # Free-text matcher + dialogue tree runner
  api/                 # FastAPI app + routes
  loader/              # YAML world loader
  storage/             # SQLite DB, ChromaDB wrapper, save/load
  cli/                 # CLI test harness
world/                 # Sample YAML world files (characters/, places/, factions/, dialogue/, story/)
tests/                 # pytest tests per component
```

## Key Architecture Decisions

- **GameSession is the single orchestrator.** Both CLI and API use it. It ties together: GameState + Director + Storyteller + Writer + DialogueMatcher + Database + VectorStore.
- **Pydantic models are the contract** — they define DB schema, API responses, and YAML validation. All data flows through them.
- **Append-only event log** in SQLite. Events are also embedded in ChromaDB for contextual retrieval.
- **Dialogue trees are the backbone.** Every choice node has authored options + `[Free Response]`. Free-text is embedded and cosine-compared to authored choices (threshold >0.75). No match = LLM one-off response, return to same node.
- **The Engine is the source of truth.** The Director reads from it; the Grimoire requests details from it.
- **Thinking mode over JSON mode.** Qwen3 outputs `<think>...</think>` blocks. We strip them rather than suppressing via JSON mode, because thinking produces higher quality responses. `_strip_think_tags()` handles both complete and truncated think blocks.
- **Storage is non-critical.** All DB/ChromaDB calls are wrapped in try/except. The engine degrades gracefully without persistence.
- **Protection enforcement flow:** Director evaluates protection level → Session blocks attack if protected → GameState handles unprotected attacks.
- **Token tracking is always on.** Every LLM call logs provider, model, job type, entity_id, token counts via TokenTracker.

## The 6 LLM Jobs

Each has an authored/template fallback. Tag every LLM call with its job type for token tracking.

1. Free-text interpretation — map input to authored branch or generate contextual reply
2. Dynamic event narration — narrate unpredicted player actions
3. Ambient NPC dialogue — contextual one-liners for background characters
4. Side quest generation — fill structural templates with creative details
5. Dialogue convergence — bridge unauthored branches back to authored nodes
6. Edge case handling — catch-all for weird player actions

## LLM Provider Notes

- **Ollama** (`grimoire/llm/ollama.py`): Primary provider. Does NOT use `format: json` — lets the model think freely. JSON format requested in system prompts.
- **Think tag stripping**: `_strip_think_tags()` strips `<think>...</think>` blocks and truncated `<think>` blocks (when model hits token limit mid-thought).
- All Writer calls request JSON in the system prompt: `{dialogue, action, emotion, internal}`

## Context Assembly (Writer Prompts)

When assembling LLM context for Writer calls, include in this order:
1. System prompt (engine instructions + tone)
2. Character core: backstory, personality, speech_style, motivations, goals, wants, affinities
3. Scene: location, who's present, what just happened
4. Relationship with player (trust, disposition, history)
5. Recent relevant events (ChromaDB by relevance + in-memory event log for recency)
6. Conversation history (LLM-compressed summaries from ChromaDB)
7. Storyteller goal (if provided by Director)

## API Endpoints

```
POST   /game/start          — Load world, init state
POST   /game/action          — Player action -> tick result
GET    /game/state           — World state snapshot
GET    /game/scene/{place}   — Location description
POST   /game/dialogue        — Player dialogue input -> NPC response
POST   /game/dialogue/end    — End active dialogue
GET    /game/characters      — List known characters
GET    /game/events          — Query event log (filterable)
GET    /game/beats           — Director story beat status
POST   /game/save            — Save game state to file
POST   /game/load            — Load game state from file
WS     /game/stream          — Real-time updates (scaffolded for Godot)
```

## Sample Test World

3 places (Rusty Tap bar, Dock 7, Mira's Quarters), 5 characters (Mira, Bosk, Kael, Vera, Tam), 1 faction (Dockworkers Union). Authored dialogue trees for Mira (first meeting, ~15 nodes) and Bosk (union talk, ~18 nodes) with conditional nodes and free response slots. Grimoire with 6 beats.

## Test Suite

- test_models.py (17), test_dialogue.py (15), test_director.py (10), test_engine.py (12)
- test_llm.py (5), test_api.py (14), test_session.py (17), test_save_load.py (3), test_storage.py (15)
- test_ollama_live.py (6), test_embeddings_live.py (8) — require external services
- **127 unit tests + 14 live tests**
