# World Builder Editor — Progress Tracker

## Overview
Web-based game content authoring tool for Grimoire Engine. React + TypeScript frontend, FastAPI backend. Lives in `grimoire-engine/editor/`.

## Tech Stack
- **Backend:** FastAPI (Python), reads/writes YAML files directly, connects to engine for LLM
- **Frontend:** React + TypeScript + Vite, minimal dependencies
- **Port:** 5173 (Vite dev), 14200 (backend API)

## How to Run
```bash
# Terminal 1: Backend
cd grimoire-engine
uv run python -m editor.backend.app world --port 14200

# Terminal 2: Frontend (dev mode with hot reload)
cd grimoire-engine/editor/frontend
npm run dev
# Open http://localhost:5173
```

## Build Order & Status

### Phase 1: Backend CRUD API
- [x] Project scaffold (backend app, router structure)
- [x] Character CRUD (list, get, create, update, delete → YAML)
- [x] Place CRUD
- [x] Faction CRUD
- [x] Dialogue tree CRUD
- [x] Story beat CRUD
- [x] Validation (Pydantic models reused from engine)
- [x] World info endpoint (read/write world.yaml)

### Phase 2: React Frontend Scaffold
- [x] Vite + React + TypeScript project init
- [x] Layout shell (sidebar nav, main content area)
- [x] API client layer
- [x] Character list page
- [x] Character editor form (all fields, relationships, schedule, protection)
- [x] World info page

### Phase 3: Dialogue Tree Editor
- [x] Dialogue tree list page
- [x] Node list sidebar + node editor panel
- [x] Node editing (speaker, text, conditions, state_changes, llm_escape, key_moment)
- [x] Choice editing (text, next_node, conditions)
- [ ] Visual node graph (canvas-based, drag-and-drop) — future enhancement

### Phase 4: Places & Factions
- [x] Place list + editor (all fields, connections, NPCs)
- [x] Faction list + editor (values, members, reputation)
- [ ] Connection visualization (place graph) — future enhancement

### Phase 5: Story Beat Editor
- [x] Grimoire viewer (grouped by act)
- [x] Beat editor (name, description, trigger, status, deadline, off-rails)
- [ ] Beat graph visualization — future enhancement

### Phase 6: LLM Generation
- [x] Backend: generation routes (character, dialogue, story-beats, field)
- [x] Character generation from prompt (full character JSON from description)
- [x] Dialogue tree generation from description (branching tree with nodes/choices)
- [x] Story beat generation (3-5 beats as narrative arc)
- [x] Field-level LLM assist (backstory, personality, speech_style, description, atmosphere)
- [x] GenerateModal component (prompt + provider selector)
- [x] FieldAssist component (inline AI button on text fields)
- [x] Provider selection (Ollama, Anthropic, OpenAI)

## Architecture Notes

### Backend
- Reuses Pydantic models from `grimoire/models/`
- YAML read/write via `editor/backend/yaml_io.py`
- Separate FastAPI app on port 14200 (doesn't interfere with game API on 14123)
- All routes under `/api/editor/`
- Vite proxies `/api/editor` to backend in dev mode

### Frontend
- Dark theme, sidebar navigation
- Each entity type: list view (EntityList) + detail/edit view
- Dialogue tree: node list sidebar + node editor with inline choice editing
- TypeScript types in `types/models.ts` mirror Pydantic models exactly
- No external UI library — plain React + inline styles

### File Structure
```
editor/
  PROGRESS.md
  __init__.py
  backend/
    __init__.py
    app.py                 # FastAPI app + CLI entry point
    yaml_io.py             # YAML read/write helpers
    routes/
      __init__.py
      characters.py        # Character CRUD
      places.py            # Place CRUD
      factions.py          # Faction CRUD
      dialogue.py          # Dialogue tree CRUD
      story.py             # Grimoire + beats
  frontend/
    package.json
    vite.config.ts         # Proxy config for backend
    src/
      main.tsx
      App.tsx              # Router setup
      index.css            # Global dark theme styles
      api/client.ts        # API client (all endpoints)
      types/models.ts      # TypeScript model types
      components/
        Layout.tsx            # Sidebar navigation + main area
        EntityList.tsx        # Reusable sortable table list
        EntitySelect.tsx      # Searchable entity picker (single + multi)
        FormField.tsx         # Form field wrapper + shared input/button styles
        ConditionBuilder.tsx  # Structured condition editor (flag/event)
        StateChangesEditor.tsx # Key/value flag editor (bool/text/num)
        TriggerEditor.tsx     # Beat trigger editor (type + conditions)
        GenerateModal.tsx     # LLM generation prompt modal
        FieldAssist.tsx       # Inline AI button for text fields
        ExtrasEditor.tsx      # Generic key/value extras editor
        ValidationPanel.tsx   # Validation results display
        GraphSidePanel.tsx    # Side panel for graph views
      pages/
        StorySettings.tsx     # Main dashboard (metadata, grimoire, acts & beats)
        WorldInfo.tsx         # World metadata editor
        WorldGraph.tsx        # Visual place connection graph
        Characters.tsx        # Character list
        CharacterEditor.tsx   # Full character editor
        Places.tsx            # Place list
        PlaceEditor.tsx       # Place editor
        Scenes.tsx            # Scene list
        SceneEditor.tsx       # Scene editor
        Factions.tsx          # Faction list
        FactionEditor.tsx     # Faction editor
        Dialogue.tsx          # Dialogue tree list
        DialogueEditor.tsx    # Node-by-node dialogue editor
        DialogueGraph.tsx     # Dialogue node graph visualization
        StoryBeats.tsx        # Dedicated beat editor
        Validate.tsx          # Cross-reference validation
```

## LLM Generation Details
- Backend routes in `editor/backend/routes/generate.py`
- Uses engine's LLM providers directly (Ollama, Anthropic, OpenAI)
- System prompts instruct the LLM to return structured JSON matching Pydantic models
- `_extract_json()` handles markdown code blocks, raw JSON, and partial extraction
- Field assist uses contextual prompts (passes character/place context for relevant generation)
- Frontend: `GenerateModal` for full entity generation, `FieldAssist` for inline field buttons
