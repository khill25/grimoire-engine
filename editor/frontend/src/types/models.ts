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
  is_public: boolean;
  owner: string;
  atmosphere: string;
}

export interface Faction {
  id: string;
  name: string;
  description: string;
  values: string[];
  member_ids: string[];
  reputation_with_player: number;
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
