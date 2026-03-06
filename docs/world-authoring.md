# World Authoring Guide

How to write content for the Grimoire Engine — YAML formats, condition syntax, trigger types, and dialogue tree structure.

## File Structure

Content lives in YAML files under `world/` (flat) or `story/world/` (nested). The editor reads and writes these files directly.

```
world/
  world.yaml              # World metadata (name, description)
  characters/
    mira.yaml             # One file per character
    bosk.yaml
  places/
    rusty_tap.yaml        # One file per place
    dock_7.yaml
  factions/
    dockworkers_union.yaml
  dialogue/
    mira_first_meeting.yaml   # One file per dialogue tree
    bosk_union_talk.yaml
  story/
    grimoire.yaml          # Acts and beats
```

## Characters

```yaml
id: mira
name: Mira Vasquez
age: 34
status: alive                   # alive | dead | missing | unknown
backstory: "Former dock mechanic..."
personality: "Warm but guarded..."
speech_style: "Casual, drops articles..."
motivations:
  - Protect the workers
  - Find out what happened to her brother
goals:
  - id: protect_workers
    description: Keep the union together
    motivation: Personal loyalty
    status: active              # active | completed | failed | abandoned
    progress: "Recruited 3 new members"
wants:
  - A safer workplace
  - To trust someone again
affinities:
  - target: bosk
    score: 0.8
    reason: "Old friends, mutual respect"
occupation: Bartender
location: rusty_tap              # place_id — current location
schedule:
  - time_start: 6
    time_end: 14
    location: rusty_tap
    scene: bar_floor
    activity: Tending bar
    interruptible: true
relationships:
  - target_id: bosk
    types: [friend, ally]
    trust: 0.8
    familiarity: 0.9
    disposition: 0.7
    history: "Known each other 10 years"
faction_ids: [dockworkers_union]
protection:
  level: hard                   # none | soft | hard | immortal
  reason: "Key story character"
  fallback: "Mira ducks behind the bar."
extras: {}                       # Freeform key/value for custom data
```

**Protection levels:**
- `none` — can be harmed/killed
- `soft` — survives but takes damage ("barely survives")
- `hard` — attack is deflected ("avoids the attack")
- `immortal` — cannot be harmed at all

## Places

```yaml
id: rusty_tap
name: The Rusty Tap
type: bar
description: "A grimy bar on the lower docks..."
current_state: "Busy evening crowd"
region: lower_docks
connections: [dock_7, miras_quarters]    # place_ids you can travel to
default_npcs: [mira]
current_npcs: [mira, bosk]
scenes: [bar_floor, back_room]           # scene_ids within this place
is_public: true
owner: mira
atmosphere: "Dim lighting, clanking glasses..."
extras: {}
```

## Factions

```yaml
id: dockworkers_union
name: Dockworkers Union
description: "Loose organization of dock laborers..."
values:
  - Worker solidarity
  - Fair wages
member_ids: [bosk, mira]
reputation_with_player: 0               # -1.0 to 1.0
extras: {}
```

## Dialogue Trees

A dialogue tree is a conversation graph. Each tree belongs to one character and has a trigger context (when it activates).

```yaml
id: mira_first_meeting
character_id: mira
context: first_meeting            # When this tree activates
root_node: greeting               # Starting node
nodes:
  - id: greeting
    speaker: mira
    text: "Haven't seen you around here before. New to the station?"
    state_changes:                 # Flags set when this node fires
      met_mira: true
    choices:
      - id: friendly
        text: "Just arrived. This place has character."
        next_node: warm_response
      - id: direct
        text: "I'm looking for work. Know anyone hiring?"
        next_node: work_talk
      - id: suspicious
        text: "Who's asking?"
        next_node: guarded_response
        condition: "paranoia == true"    # Only shown if flag is set

  - id: warm_response
    speaker: mira
    text: "Ha, that's one word for it."
    condition: null               # No condition = always reachable
    state_changes:
      mira_initial_impression: positive
    choices:
      - id: ask_about_union
        text: "What's the deal with the union I keep hearing about?"
        next_node: union_talk
    llm_escape: false             # If true, LLM can generate responses here
    is_key_moment: false          # If true, always use authored text verbatim
```

### Node Fields

| Field | Required | Description |
|---|---|---|
| `id` | yes | Unique within the tree |
| `speaker` | yes | character_id of who's talking |
| `text` | yes | What the NPC says |
| `condition` | no | Flag condition to reach this node (see Condition Syntax below) |
| `state_changes` | no | Dict of flags to set when this node fires |
| `choices` | no | Player response options (empty = end of conversation) |
| `llm_escape` | no | Allow LLM to generate responses at this node |
| `is_key_moment` | no | Force authored text, never LLM |

### Choice Fields

| Field | Required | Description |
|---|---|---|
| `id` | yes | Unique within the node |
| `text` | yes | What the player says |
| `next_node` | yes | Node ID to jump to |
| `condition` | no | Flag condition for this choice to appear |

Every choice node also implicitly has a `[Free Response]` slot at runtime. Free-text is embedded and cosine-compared to authored choices (>0.75 similarity = match). No match = LLM generates a one-off in-character reply, player stays on same node.

## Grimoire (Acts & Beats)

The grimoire defines the story structure: acts containing beats.

```yaml
title: "Lowport Station — Act 1"
description: "The player arrives on Lowport Station..."

acts:
  - id: act_1
    name: Arrival
    description: "Player arrives, meets key characters..."
    beats:
      - id: beat_arrive
        name: New in Town
        description: Player arrives and explores the lower docks.
        trigger:
          type: automatic
        status: active

      - id: beat_meet_mira
        name: Meet Mira
        description: Player has a conversation with Mira at the Rusty Tap.
        trigger:
          type: event
          condition: "talked_to:mira"
        status: pending

      - id: beat_dock_work
        name: First Shift
        description: Player works a shift at Dock 7.
        trigger:
          type: flag
          condition: "dock_work_offered == true"
        deadline: 48
        status: pending
        allow_off_rails: true
```

### Beat Fields

| Field | Required | Description |
|---|---|---|
| `id` | yes | Unique beat identifier |
| `name` | yes | Display name |
| `description` | yes | What happens in this beat |
| `trigger.type` | yes | `automatic`, `event`, or `flag` |
| `trigger.condition` | depends | Required for `event` and `flag` types |
| `status` | yes | `pending`, `active`, `completed`, `failed` |
| `deadline` | no | Ticks after activation before the beat expires |
| `allow_off_rails` | no | If true, LLM can take the story in unexpected directions here |

## Condition Syntax

Conditions are strings evaluated at runtime. There are two contexts with slightly different supported syntax:

### Beat Trigger Conditions (Director)

Used in `trigger.condition` for story beats.

**Event conditions:**
```
talked_to:mira                    # Player had dialogue with character
visited:dock_7                    # Player visited a place
talked_to:mira and visited:dock_7  # Both must be true (AND)
```

**Flag conditions:**
```
dock_work_offered == true          # Boolean flag
bosk_trust > 5                     # Numeric comparison
mira_initial_impression == positive  # String equality
flag_a == true and flag_b == true  # Compound (AND)
```

### Dialogue Conditions (TreeRunner)

Used in `DialogueNode.condition` and `DialogueChoice.condition`.

```
met_mira == true          # Boolean check
paranoia != false          # Inequality
knows_union_situation      # Bare flag (truthy check — flag exists and is truthy)
```

**Note:** Dialogue conditions do NOT support `>`, `and`, or event-type conditions (`talked_to`, `visited`). Those are Director-only.

## State Changes

`state_changes` on dialogue nodes set flags when the node fires. These flags are the glue between dialogue and the rest of the system:

```yaml
state_changes:
  met_mira: true                    # Boolean
  mira_initial_impression: positive  # String
  dock_work_offered: true
  knows_bosk_location: true
```

These flags can then be referenced in:
- Other dialogue node/choice conditions
- Beat trigger conditions
- Director flag checks

## Common Patterns

### Gating a choice behind a flag
Player only sees "Tell me about the resistance" if they've already learned about the union:
```yaml
choices:
  - id: ask_resistance
    text: "Tell me about the resistance."
    next_node: resistance_talk
    condition: "knows_union_situation == true"
```

### Progressive revelation via state_changes
Each conversation sets flags that unlock deeper dialogue:
```yaml
# Node 1 sets the flag
state_changes:
  bosk_willing_to_talk: true

# Later node's choice requires it
choices:
  - id: ask_deeper
    text: "What's really going on?"
    next_node: deeper_talk
    condition: "bosk_willing_to_talk == true"
```

### Beat triggered by dialogue progress
A story beat fires when the player has learned enough:
```yaml
- id: beat_union_meeting
  name: The Meeting
  trigger:
    type: flag
    condition: "bosk_trust_initial == true and knows_union_situation == true"
```

### Deadline beats
If the player doesn't engage within N ticks, the Storyteller generates a hook:
```yaml
- id: beat_dock_work
  trigger:
    type: flag
    condition: "dock_work_offered == true"
  deadline: 48
  status: pending
```
