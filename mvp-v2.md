# Grimoire Engine — MVP Build Spec

## Architecture Overview

The Grimoire Engine is a **self-contained Python backend service** that exposes a REST/WebSocket API. It is NOT a game — it is the simulation layer a game client (eventually Godot) connects to. The game launches it in the background; the player should not need to manage any extra dependencies (Python, pip, Ollama, etc.). For MVP, the "client" is a simple CLI test harness or a minimal web UI for poking the system.

The system has three major components: the **Grimoire** (manages writing and dialogue), the **Director** (bridges narrative and simulation), and the **Engine** (world simulation, source of truth).

```
[ Game Client (CLI/Godot) ]
         ↕ REST + WebSocket API
┌─────────────────────────────────────────┐
│           Grimoire Engine (Python)       │
│                                         │
│  ┌───────────┐  ┌──────────┐  ┌───────┐│
│  │ Grimoire  │←→│ Director │←→│Engine ││
│  │Storyteller│  │          │  │ World ││
│  │  Writer   │  │          │  │ State ││
│  └───────────┘  └──────────┘  └───────┘│
└─────────────────────────────────────────┘
         ↕              ↕             ↕
  [ Ollama (LLM) ] [ ChromaDB ]  [ SQLite ]
```

### Grimoire (Manages the Writing)

- **Storyteller:** Creates story beats, transitions, events. Bigger-picture story management. Gives the Writer necessary character details (e.g. "You are Enforcement Interrogator Jan") and context (mood, scene) to achieve a goal (e.g. "Get secrets out of Mira").
- **Writer:** Dialogue filling, dynamic player interactions, quest text. Takes information from the Storyteller and produces output to achieve its given goal.

### Director (Narrative ↔ Simulation Bridge)

Sits between the Grimoire and the Engine to facilitate data transfer. Tracks beat progress, evaluates trigger conditions, fires events, manages deadlines. If no authored path to a beat triggers within a timeout, asks the Storyteller to generate one. Can manage tension and reason about player trajectory. The Engine is the source of truth; the Director just lives between it and the Grimoire.

### Engine (World Simulation)

Manages world state: flags dict, character dispositions, faction reputation scores, inventory, append-only event log, conversation summaries (LLM-compressed or node-list), quest states. ChromaDB holds embedded dialogue choices (for free-text matching), conversation summaries, and event entries (for contextual retrieval).

## Tech Stack

- **Language:** Python 3.11+
- **Web framework:** FastAPI (async, WebSocket support, auto-generated API docs)
- **Database:** SQLite via SQLAlchemy (async) — single file, no infra needed
- **Vector store:** ChromaDB (embedded mode) — for dialogue matching, conversation summaries, and event retrieval
- **LLM integration:** Ollama for local LLM (32b model) as primary provider. Abstract provider interface with additional Anthropic (Claude) and OpenAI adapters for optional cloud fallback. Use litellm or a thin wrapper to normalize the interface.
- **Embedding model:** all-MiniLM-L6-v2 (small CPU model, runs locally)
- **Data format:** Pydantic models everywhere — they serve as both validation and documentation.
- **World definitions:** YAML files. The storyteller authors characters, places, grimoires, and **dialogue trees** in YAML (custom format with conditional text, state-setting, and LLM escape hatches). The engine loads them at startup.
- **Testing:** pytest. The test harness should be able to run a scripted sequence of player actions and assert on world state.
- **Deployment:** Self-contained. The game client launches the engine as a background process. All dependencies (Ollama, ChromaDB, models) are bundled or bootstrapped automatically.

## How Dialogue Works

Authored dialogue trees are the backbone. Every choice node has hand-written options plus a `[Free Response]` slot.

1. Free-text input from the player gets **embedded** (all-MiniLM-L6-v2) and compared to authored choices via cosine similarity.
2. If **close match** (>0.75 similarity) → take that authored branch seamlessly.
3. If **no match** → the LLM generates a one-off in-character response and returns the player to the same node.
4. Key dialogue moments are **always authored**. The LLM writes bridge/transition lines to converge unauthored branches back to authored waypoints.

### The 6 LLM Jobs

Each job has an authored/template fallback. Edge case responses should **not** by default create major story changes. The game developer can flag particular beats that are allowed to go off-rails.

1. **Free-text interpretation** — map player input to authored branch or generate contextual reply
2. **Dynamic event narration** — narrate unpredicted player actions
3. **Ambient NPC dialogue** — contextual one-liners for background characters
4. **Side quest generation** — fill structural templates with creative details
5. **Dialogue convergence** — bridge unauthored branches back to authored nodes
6. **Edge case handling** — catch-all for "player did something weird"

## What to Build (in order)

### 1. Data Models (Pydantic)

Define these as Pydantic models. They map to both the DB schema and the API responses.

**Character** (Full tier only for MVP — hand-authored):
```python
class Character(BaseModel):
    id: str
    name: str
    age: int
    status: Literal["alive", "dead", "missing", "unknown"]
    backstory: str           # prose, ~200 words
    personality: str         # prose sketch
    speech_style: str        # "terse and sarcastic", "formal, avoids contractions"
    motivations: list[str]   # 2-3 deep drivers
    goals: list[Goal]
    wants: list[str]         # immediate, mutable
    affinities: list[Affinity]
    occupation: str
    location: str            # place_id
    schedule: list[ScheduleEntry]
    relationships: list[Relationship]
    faction_ids: list[str]
    protection: ProtectionLevel  # for Director system

class Goal(BaseModel):
    id: str
    description: str
    motivation: str          # which motivation this serves
    status: Literal["active", "completed", "failed", "abandoned"]
    progress: str

class Affinity(BaseModel):
    target: str              # topic, trait, or entity_id
    score: float             # -1.0 to 1.0
    reason: str

class Relationship(BaseModel):
    target_id: str           # character_id
    types: list[str]         # friend, rival, spouse, employer, etc.
    trust: float             # -1.0 to 1.0
    familiarity: float       # 0.0 to 1.0
    disposition: float       # -1.0 to 1.0
    history: str             # compressed narrative

class ScheduleEntry(BaseModel):
    time_start: int          # tick of day
    time_end: int
    location: str            # place_id
    activity: str
    interruptible: bool

class ProtectionLevel(BaseModel):
    level: Literal["none", "soft", "hard", "immortal"]
    reason: str
    fallback: str            # what happens on kill attempt
```

**Place:**
```python
class Place(BaseModel):
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

**Event:**
```python
class Event(BaseModel):
    id: str
    timestamp: int           # game tick
    type: Literal["interaction", "observation", "world_change", "off_screen", "system"]
    summary: str
    details: str
    participants: list[str]  # character_ids
    witnesses: list[str]
    location: str            # place_id
    visibility: Literal["private", "local", "regional", "global"]
    tags: list[str]
    severity: float          # 0.0 to 1.0
```

**Faction** (simplified for MVP):
```python
class Faction(BaseModel):
    id: str
    name: str
    description: str
    values: list[str]
    member_ids: list[str]
    reputation_with_player: float  # -1.0 to 1.0
```

**Dialogue Tree** (authored conversation structure):
```python
class DialogueNode(BaseModel):
    id: str
    speaker: str             # character_id
    text: str                # what the NPC says at this node
    condition: str | None    # state condition to reach this node (e.g. "trust > 0.5")
    state_changes: dict[str, Any] | None  # flags/state to set when this node fires
    choices: list[DialogueChoice]
    llm_escape: bool         # if True, LLM can generate responses at this node
    is_key_moment: bool      # if True, always use authored text, never LLM

class DialogueChoice(BaseModel):
    id: str
    text: str                # authored player option
    next_node: str           # dialogue_node_id
    condition: str | None    # state condition for this choice to appear
    embedding: list[float] | None  # precomputed for free-text matching

class DialogueTree(BaseModel):
    id: str
    character_id: str
    context: str             # when this tree activates (e.g. "first_meeting", "quest_active")
    root_node: str           # starting dialogue_node_id
    nodes: list[DialogueNode]
```

### 2. World Loader

Load world definitions from YAML files. Directory structure:

```
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
  factions/
    dockworkers_union.yaml
    ...
  dialogue/
    mira_conversations.yaml
    bosk_conversations.yaml
    ...
  story/
    grimoire.yaml      # acts, beats, endings (Director uses this)
```

The loader reads these, validates them against Pydantic models, and populates the database. Dialogue choice embeddings are precomputed and stored in ChromaDB. Write a `load_world(path: str)` function that does this idempotently.

### 3. Dialogue Matching System

The free-text matching pipeline:

```python
class DialogueMatcher:
    def __init__(self, chroma_client: ChromaDB, embedding_model: EmbeddingModel): ...

    def embed_text(self, text: str) -> list[float]:
        """Embed player input using all-MiniLM-L6-v2."""

    def match_choice(self, player_input: str, available_choices: list[DialogueChoice],
                     threshold: float = 0.75) -> DialogueChoice | None:
        """Compare player input embedding to authored choices.
        Returns the best match if similarity > threshold, else None."""

    def index_dialogue_tree(self, tree: DialogueTree) -> None:
        """Precompute and store embeddings for all choices in a tree."""
```

When the player types freely during dialogue:
1. Embed their input.
2. Compare against available authored choices at the current node.
3. If similarity > 0.75 → follow authored branch.
4. If no match → send to Writer LLM for a one-off in-character response, then return player to the same node.

### 4. Game State Manager (Engine)

Owns the world clock and the simulation loop. This is the **source of truth** for all world state.

```python
class GameState:
    tick: int
    world: World           # all entities, queryable
    flags: dict[str, Any]  # global state flags
    quest_states: dict[str, str]

    def process_action(self, action: PlayerAction) -> TickResult
    def get_scene(self, place_id: str) -> SceneContext
    def get_character(self, char_id: str) -> Character
    def advance_tick(self) -> list[Event]
```

`process_action` is the main entry point. The game client sends a PlayerAction (move, talk, interact, wait), and the engine returns a TickResult containing: narration text, any NPC responses, events generated, and updated world state.

**The tick loop for MVP** (simplified — Director is scaffolded but lightweight):
```
1. Receive player action
2. Validate action (can you do this? are you in the right place?)
3. Execute action → generate events
4. Director checks: does this event trigger any story beats? Update beat progress.
5. For each NPC in current location:
   - Are they affected by the events?
   - Do they want to react? (check: is the event relevant to their affinities/goals?)
6. Log all events to SQLite (append-only) + embed summaries in ChromaDB
7. Update NPC locations based on schedules
8. Return result to client
```

### 5. Director (MVP — Lightweight)

For MVP, the Director is a simple beat tracker. Full tension management and trajectory reasoning come later.

```python
class Director:
    def __init__(self, grimoire: Grimoire, game_state: GameState): ...

    def check_triggers(self, events: list[Event]) -> list[StoryBeat]:
        """Check if any events trigger story beat transitions."""

    def get_active_beats(self) -> list[StoryBeat]:
        """Return currently active story beats."""

    def check_deadlines(self, tick: int) -> list[StoryBeat]:
        """Check if any beats have timed out. If so, flag for Storyteller generation."""

    def evaluate_protection(self, target: Character, action: PlayerAction) -> ProtectionResult:
        """Enforce entity protection levels on player actions."""
```

### 6. LLM Provider Interface

Abstract interface so we can swap providers. **Ollama is the primary provider** for local inference.

```python
class LLMProvider(Protocol):
    async def generate(self, messages: list[dict], system: str,
                       response_format: type | None = None,
                       temperature: float = 0.7,
                       max_tokens: int = 1000) -> LLMResponse: ...

class LLMResponse(BaseModel):
    text: str
    raw: dict              # full provider response for debugging
    usage: TokenUsage      # track costs

class EmbeddingProvider(Protocol):
    def embed(self, text: str) -> list[float]: ...
    def embed_batch(self, texts: list[str]) -> list[list[float]]: ...
```

Implement `OllamaProvider` (primary, local), `AnthropicProvider`, and `OpenAIProvider` (cloud fallbacks). Implement `LocalEmbeddingProvider` wrapping all-MiniLM-L6-v2 for the embedding interface.

Use structured output (JSON mode / tool use) to get parseable NPC responses. Configure which provider is used via environment variable or config file.

**Token budget tracking:** Every LLM call should log: provider, model, prompt tokens, completion tokens, call type (which of the 6 LLM jobs), entity_id. This data is critical for cost management.

### 7. Context Assembly (Storyteller → Writer Pipeline)

The Storyteller assembles context and goals; the Writer produces output.

**For authored dialogue** (most interactions):
1. Look up the active dialogue tree for this character + context.
2. Present the current node's text.
3. On player input, run through the DialogueMatcher.
4. If matched → follow branch. If not → assemble Writer context for a one-off response.

**For LLM-generated responses** (free-text misses, ambient dialogue, dynamic narration):

```python
def build_writer_context(character: Character, scene: SceneContext,
                         events: list[Event], player_relationship: Relationship | None,
                         storyteller_goal: str | None = None) -> list[dict]:
    """Assemble the LLM messages for a Writer call."""
```

Context assembly pulls from:
1. System prompt (engine instructions + tone)
2. Character core: backstory, personality, speech_style, motivations, goals, wants, affinities
3. Scene: where are we, who's here, what just happened
4. Relationship with player (if any): trust, disposition, history
5. Recent events this character knows about — retrieved from ChromaDB by relevance + recency, plus SQLite event log for events at this location in last N ticks
6. Conversation history (if mid-dialogue — LLM-compressed summaries from ChromaDB)
7. Storyteller goal (if provided): what the Writer should accomplish with this response

**System prompt template** (adapt per character):
```
You are simulating {name}, a character in a living world.

PERSONALITY: {personality}
SPEECH STYLE: {speech_style}
MOTIVATIONS: {motivations}
CURRENT GOALS: {goals}
CURRENT WANTS: {wants}

You are currently at {location}. {atmosphere}
{scene_description}

RELATIONSHIP WITH PLAYER: {relationship_summary}

RECENT EVENTS YOU KNOW ABOUT:
{events}

STORYTELLER DIRECTION: {storyteller_goal}

Respond ONLY as {name}. Stay in character. Do not break the fourth wall.
You know ONLY what is described above. Do not invent additional facts about the world.
Your response should NOT create major story changes unless explicitly directed.

Respond in this JSON format:
{
  "dialogue": "What you say out loud",
  "action": "Physical action you take, or null",
  "emotion": "Your current emotional state",
  "internal": "What you're thinking but not saying"
}
```

### 8. API Layer

FastAPI endpoints:

```
POST   /game/start          — Load a world, initialize game state
POST   /game/action          — Send a player action, receive tick result
GET    /game/state           — Current world state snapshot
GET    /game/scene/{place}   — What the player sees at a location
POST   /game/dialogue        — Send player dialogue to current NPC, get response
GET    /game/characters      — List all known characters
GET    /game/events          — Query event log (with filters)
GET    /game/beats           — Current story beat status (Director state)
WebSocket /game/stream       — Real-time updates (for future Godot integration)
```

Every endpoint returns structured JSON (Pydantic models serialized). The WebSocket endpoint is scaffolded but doesn't need to do much for MVP — it's there so the architecture is ready for Godot.

### 9. CLI Test Harness

A simple command-line interface for playing the game:

```
> look
You're in the Rusty Tap, a dim bar on the lower docks. The air smells
like engine coolant and cheap whiskey. Mira is behind the bar, polishing
a glass. Bosk sits in the corner, nursing a drink.

> talk mira
Mira looks up. "What'll it be?"

  [1] "What's the word on the docks today?"
  [2] "I'm looking for work."
  [3] "Just a drink."
  [*] Type something else...

> *What do you know about the Union's plans?
(embedding match: "What's the word on the docks today?" — similarity 0.81)

Mira glances at the door before answering. "Same as always. Ships come
in, ships go out. Though I heard the Union's planning something..."
She leans in. "You didn't hear that from me."

> wait 3
Three hours pass. Bosk has left. A pilot you don't recognize has taken
his seat.
```

This is a thin wrapper around the API. It's for testing, not for the final game. The CLI should surface the dialogue tree choices and show when free-text input gets matched to an authored branch (for debugging).

### 10. Save/Load

Serialize the entire game state (SQLite DB + ChromaDB state + game clock + active conversations + Director beat state) to a save file. Load it back.

```python
def save_game(state: GameState, path: str) -> None
def load_game(path: str) -> GameState
```

## Definition of Done (MVP)

You can:
- [x] Load a world (including dialogue trees) from YAML files
- [x] Walk between connected places and see descriptions
- [x] Talk to NPCs via authored dialogue trees with branching choices
- [x] Type free-text responses that get matched to authored branches (>0.75 similarity)
- [x] Get LLM-generated in-character responses when free-text doesn't match
- [x] NPCs reference their relationships, goals, and recent events in dialogue
- [x] Perform actions that generate events (buying something, helping someone, attacking)
- [x] Events are logged (SQLite) and embedded (ChromaDB); NPCs in the same location know about them
- [x] NPCs follow schedules — they move between locations as time passes
- [x] Protected NPCs survive kill attempts with narrated outcomes
- [x] Director tracks story beat progress and checks triggers
- [x] LLM responses do not create major story changes unless developer-flagged
- [x] Switch between LLM providers (Ollama/Anthropic/OpenAI) via config
- [x] Save and load game state (including ChromaDB and Director state)
- [x] All interactions available via both CLI and REST API
- [x] Token usage is tracked per call, tagged by which of the 6 LLM jobs
- [x] System runs self-contained — `uv sync` and go (Ollama is external by design)

## Sample World for Testing

Create a small test world:
- **3 places:** The Rusty Tap (bar), Dock 7 (docking bay), Mira's Quarters (residence)
- **5 characters:** Mira (bartender, secret rebel), Bosk (dockworker, union rep), Kael (pilot, owes Mira money), Vera (station security, suspicious of everyone), Tam (shopkeeper, gossip)
- **1 faction:** Dockworkers Union
- **Relationships:** Mira and Bosk are allies (trust: 0.8). Kael owes Mira (trust: 0.3, disposition: -0.2). Vera suspects Mira (trust: -0.4). Tam knows everyone's business (familiarity: 0.7 with all).
- **Dialogue trees:** At minimum, author a conversation tree for Mira (first meeting) and Bosk (asking about the Union) with 3–4 depth branching, conditional nodes, and `[Free Response]` slots.

Author these in YAML as part of the build.

## Project Structure

```
grimoire-engine/
  README.md
  pyproject.toml
  grimoire/
    __init__.py
    models/              # Pydantic models
      character.py
      place.py
      event.py
      faction.py
      dialogue.py        # DialogueTree, DialogueNode, DialogueChoice
      common.py          # shared types (GameTime, Affinity, etc.)
    grimoire/            # writing system
      storyteller.py     # beat management, context goals
      writer.py          # LLM-powered text generation (the 6 jobs)
    director/
      director.py        # beat tracking, trigger evaluation, deadlines
      protection.py      # entity protection enforcement
    engine/
      game_state.py      # tick loop, world management
      context.py         # Storyteller→Writer context assembly
      events.py          # event creation, logging
      schedules.py       # NPC schedule processing
    llm/
      provider.py        # abstract interface
      ollama.py          # primary local provider
      anthropic.py       # cloud fallback
      openai.py          # cloud fallback
      embeddings.py      # all-MiniLM-L6-v2 wrapper
    dialogue/
      matcher.py         # free-text → authored branch matching
      tree_runner.py     # dialogue tree traversal logic
    api/
      app.py             # FastAPI application
      routes.py          # endpoint definitions
    loader/
      world_loader.py    # YAML → DB + ChromaDB
    storage/
      database.py        # SQLAlchemy models + queries
      vector_store.py    # ChromaDB wrapper
      save_load.py
    cli/
      harness.py         # CLI test interface
  world/                 # sample world YAML files
    world.yaml
    characters/
    places/
    factions/
    dialogue/
    story/
  tests/
    test_models.py
    test_engine.py
    test_dialogue.py     # dialogue matching + tree traversal
    test_director.py
    test_llm.py
    test_api.py
```