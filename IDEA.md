# The Grimoire Engine
Dynamic RPG game world interaction simulator!

The Grimoire Engine is the underlying system that powers the game-world. It's an interactive fiction simulator.
It remembers everything the player does, everything the player says (the player can free type responses to npcs), and how the player reacts.

It handles NPC interactions and dialog powered by LLMs.

Characters are simulated, the world is simulated, the player exists in it, it's not always waiting for the player to do something.

NPCs will comment on recent events, gossip, help the player if you're worth trusting... Maybe even betray you.

# The Vision
The Grimoire Engine is a pie in the sky idea of a game's total world simulation. Dynamic Dialog, storytelling, emergent events, NPC simulated lifes, simmulated world politics... 

# The reality
Processing power is limited and there is a story that someone wants to tell. The Grimoire Engine augments a (solo) developer's ability to deliver a rich world to the player. Narrative choice, unexpected actions, bridged dialog... So the scope of the original selling paragraph is far fetched but we will build what we can.

# System Overview
This is a self contained backend that exposes an interface that allows a game engine (possibly godot) to power and enrich the game world. This system should be able to run without the player needing to manage any extra dependencies (like python, pip, pytorch, ollama, endpoints, etc). The game will launch it in the background and interact via the exposed interface. These systems are a mix of python architecture and LLMs.

There are 2 major components to this concept. The Grimoire and the Engine. The Director is a bridge between the two.

## Grimoire
Manages the writing.

### Storyteller
Manages the Writer. Creates story beats, transitions, events. Bigger picture story stuff.
The Storyteller gives the Writer necessary character details -You are Enforcement Interrogator Jan- and context -mood, scene- to acheive a goal -Get secrets out of Mira-.

### Writer
Dialog filling, dyanmic player interactions, quests. Takes information from the Storyteller and produces output needed to achieve it's given goal

## Director
Sites between the Grimoire and the Engine to help facilitate data transfer. The Engine is the source of truth, this just lives between it. 
Tracks beat progress, evaluates trigger conditions, fires events, manages deadlines. If no authored path to a beat triggers within a timeout, asks the Storyteller to generate one. Can manage tension, can reason about player trajectory.

## Engine
Manages world simulation. The Grimoire can request details in order to make more informed decisions. Source of truth.

### World Engine
flags dict, character dispositions, faction reputation scores, inventory, append-only event log, conversation summaries (LLM-compressed or node-list), quest states. ChromaDB holds embedded dialogue choices (for free-text matching), conversation summaries, and event entries (for contextual retrieval).

## Tech Stack
Python 3.11+, FastAPI, SQLite, ChromaDB (embedded), Ollama for local LLM (32b), small CPU embedding model (all-MiniLM-L6-v2). World content authored in YAML (subject to change) including a custom dialogue tree format with conditional text, state-setting, and LLM escape hatches.

## How Dialogue Works
Authored dialogue trees are the backbone. Every choice node has hand-written options plus a `[Free Response]` slot. Free-text input gets embedded and compared to authored choices — if close match (>0.75 similarity), take that branch seamlessly. If no match, LLM generates a one-off in-character response and returns the player to the same node. Key dialogue moments are always authored. The LLM writes bridge/transition lines to converge unauthored branches back to authored waypoints.

### The 6 LLM Jobs

1. **Free-text interpretation** — map player input to authored branch or generate contextual reply
2. **Dynamic event narration** — narrate unpredicted player actions
3. **Ambient NPC dialogue** — contextual one-liners for background characters
4. **Side quest generation** — fill structural templates with creative details
5. **Dialogue convergence** — bridge unauthored branches back to authored nodes
6. **Edge case handling** — catch-all for "player did something weird"

Each has an authored/template fallback. Edge case responses should not by default create major story changes. ** For most cases the system should do it's best to avoid major story altering consequences but the game-developer is allowed to flag particular beats that can go offrails.