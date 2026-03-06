// TypeScript types matching Pydantic models from grimoire/models/

export interface Goal {
  id: string;
  description: string;
  motivation: string;
  status: "active" | "completed" | "failed" | "abandoned";
  progress: string;
}

export interface Affinity {
  target: string;
  score: number;
  reason: string;
}

export interface Relationship {
  target_id: string;
  types: string[];
  trust: number;
  familiarity: number;
  disposition: number;
  history: string;
}

export interface ScheduleEntry {
  time_start: number;
  time_end: number;
  location: string;
  scene: string;
  activity: string;
  interruptible: boolean;
}

export interface ProtectionLevel {
  level: "none" | "soft" | "hard" | "immortal";
  reason: string;
  fallback: string;
}

export interface Character {
  id: string;
  name: string;
  age: number;
  status: "alive" | "dead" | "missing" | "unknown";
  backstory: string;
  personality: string;
  speech_style: string;
  motivations: string[];
  goals: Goal[];
  wants: string[];
  affinities: Affinity[];
  occupation: string;
  location: string;
  schedule: ScheduleEntry[];
  relationships: Relationship[];
  faction_ids: string[];
  protection: ProtectionLevel;
  extras: Record<string, unknown>;
}

export interface Place {
  id: string;
  name: string;
  type: string;
  description: string;
  current_state: string;
  connections: string[];
  region: string;
  default_npcs: string[];
  current_npcs: string[];
  scenes: string[];
  is_public: boolean;
  owner: string;
  atmosphere: string;
  extras: Record<string, unknown>;
}

export interface Scene {
  id: string;
  name: string;
  place_id: string;
  type: string;
  description: string;
  current_state: string;
  default_npcs: string[];
  current_npcs: string[];
  connections: string[];
  atmosphere: string;
  is_public: boolean;
  owner: string;
  extras: Record<string, unknown>;
}

export interface Faction {
  id: string;
  name: string;
  description: string;
  values: string[];
  member_ids: string[];
  reputation_with_player: number;
  extras: Record<string, unknown>;
}

export interface DialogueChoice {
  id: string;
  text: string;
  next_node: string;
  condition: string | null;
  embedding: number[] | null;
}

export interface DialogueNode {
  id: string;
  speaker: string;
  text: string;
  condition: string | null;
  state_changes: Record<string, unknown> | null;
  choices: DialogueChoice[];
  llm_escape: boolean;
  is_key_moment: boolean;
}

export interface DialogueTree {
  id: string;
  character_id: string;
  context: string;
  root_node: string;
  nodes: DialogueNode[];
  extras: Record<string, unknown>;
}

export interface StoryBeat {
  id: string;
  name: string;
  description?: string;
  trigger?: Record<string, unknown>;
  status?: string;
  deadline?: number;
  allow_off_rails?: boolean;
  act_id?: string;
  act_name?: string;
}

export interface CharacterSummary {
  id: string;
  name: string;
  occupation: string;
  location: string;
  status: string;
  file: string;
}

export interface PlaceSummary {
  id: string;
  name: string;
  type: string;
  region: string;
  connections: string[];
  scenes: string[];
  file: string;
}

export interface SceneSummary {
  id: string;
  name: string;
  place_id: string;
  type: string;
  default_npcs: string[];
  file: string;
}

export interface FactionSummary {
  id: string;
  name: string;
  member_ids: string[];
  reputation_with_player: number;
  file: string;
}

export interface DialogueTreeSummary {
  id: string;
  character_id: string;
  context: string;
  node_count: number;
  file: string;
}

export interface ValidationResult {
  broken_refs: {
    source_file: string;
    field: string;
    referenced_id: string;
    expected_type: string;
  }[];
  duplicate_ids: {
    id: string;
    files: string[];
  }[];
  entity_counts: Record<string, number>;
}

export interface StoryMeta {
  name: string;
  description: string;
  tone: string;
  worlds: string[];
}
