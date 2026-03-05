# Grimoire Engine

A self-contained Python backend that powers dynamic RPG world simulation. Combines authored dialogue trees with LLM inference for NPC conversations, world events, and narrative direction. Designed as the simulation layer a game client (Godot, CLI, etc.) connects to via REST/WebSocket API.

## Quick Start

Requires [uv](https://docs.astral.sh/uv/) and Python 3.11+.

```bash
# Clone and install
git clone https://github.com/khill25/grimoire-engine.git
cd grimoire-engine
uv sync --dev

# Run the CLI (includes a sample world)
uv run grimoire-cli

# Run tests
uv run pytest tests/ --ignore=tests/test_ollama_live.py --ignore=tests/test_embeddings_live.py

# Start the API server
uv run uvicorn grimoire.api.app:app --port 14123 --reload
```

## LLM Setup

The engine uses [Ollama](https://ollama.com/) for local LLM inference. By default it connects to `http://192.168.50.181:11434` with the `Qwen3-30B-A3B` model. To use a different instance, set the `OLLAMA_HOST` environment variable or pass the URL when constructing the provider.

The engine works without an LLM — dialogue trees and authored content function fully. LLM adds free-text matching, ambient NPC reactions, and dynamic narration.

Embeddings use `all-MiniLM-L6-v2` (downloaded automatically on first run, ~80MB).

## CLI Commands

```
look              — Describe current location
go <place>        — Move to a connected place
talk <character>  — Start conversation with an NPC
do <action>       — Perform an action (LLM-narrated)
attack <character>— Attack a character (protection enforced)
wait <hours>      — Wait N hours (advances time)
status            — Show game state
flags             — Show current world flags
beats             — Show active story beats
tokens            — Show LLM token usage
save [path]       — Save game state
load [path]       — Load game state
quit              — Exit

In dialogue:
  1, 2, 3...      — Pick a numbered choice
  *<text>          — Force free-text input (embedding match + LLM)
  leave            — End conversation
```

## Architecture

```
[ Game Client (CLI/Godot) ]
         | REST + WebSocket API
+---------------------------------------+
|         Grimoire Engine (Python)       |
|                                        |
|  +-----------+  +----------+  +------+ |
|  | Grimoire  |<>| Director |<>|Engine| |
|  |Storyteller|  |          |  |World | |
|  |  Writer   |  |          |  |State | |
|  +-----------+  +----------+  +------+ |
+---------------------------------------+
         |              |           |
  [ Ollama (LLM) ] [ ChromaDB ] [ SQLite ]
```

- **Engine** — World state, tick loop, event log (source of truth)
- **Director** — Story beat tracking, trigger evaluation, NPC protection
- **Grimoire** — Storyteller (goals/context) + Writer (LLM dialogue generation)

## Project Structure

```
grimoire/
  models/        # Pydantic data models
  engine/        # Game state, session orchestrator, context assembly
  director/      # Beat tracking, triggers, protection
  grimoire/      # Storyteller + Writer (LLM generation)
  dialogue/      # Free-text matcher + tree runner
  llm/           # Provider interface (Ollama/Anthropic/OpenAI) + embeddings
  api/           # FastAPI routes + WebSocket
  loader/        # YAML world loader
  storage/       # SQLite, ChromaDB, save/load
  cli/           # CLI harness
world/           # Sample world (YAML)
tests/           # 112 unit tests
```
