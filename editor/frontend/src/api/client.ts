const BASE_URL = "/api/editor";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  return res.json();
}

// Characters
export const characters = {
  list: () => request<any[]>("/characters"),
  get: (id: string) => request<any>(`/characters/${id}`),
  create: (data: any) => request<any>("/characters", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/characters/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/characters/${id}`, { method: "DELETE" }),
};

// Places
export const places = {
  list: () => request<any[]>("/places"),
  get: (id: string) => request<any>(`/places/${id}`),
  create: (data: any) => request<any>("/places", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/places/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/places/${id}`, { method: "DELETE" }),
};

// Scenes
export const scenes = {
  list: (placeId?: string) => request<any[]>(placeId ? `/scenes?place_id=${placeId}` : "/scenes"),
  get: (id: string) => request<any>(`/scenes/${id}`),
  create: (data: any) => request<any>("/scenes", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/scenes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/scenes/${id}`, { method: "DELETE" }),
};

// Factions
export const factions = {
  list: () => request<any[]>("/factions"),
  get: (id: string) => request<any>(`/factions/${id}`),
  create: (data: any) => request<any>("/factions", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/factions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/factions/${id}`, { method: "DELETE" }),
};

// Dialogue
export const dialogue = {
  list: () => request<any[]>("/dialogue"),
  get: (id: string) => request<any>(`/dialogue/${id}`),
  create: (data: any) => request<any>("/dialogue", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/dialogue/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/dialogue/${id}`, { method: "DELETE" }),
};

// Story
export const story = {
  get: () => request<any>("/story"),
  update: (data: any) => request<any>("/story", { method: "PUT", body: JSON.stringify(data) }),
  listActs: () => request<any[]>("/story/acts"),
  createAct: (data: any) => request<any>("/story/acts", { method: "POST", body: JSON.stringify(data) }),
  updateAct: (id: string, data: any) => request<any>(`/story/acts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteAct: (id: string) => request<any>(`/story/acts/${id}`, { method: "DELETE" }),
  listBeats: () => request<any[]>("/story/beats"),
  createBeat: (actId: string, data: any) => request<any>(`/story/acts/${actId}/beats`, { method: "POST", body: JSON.stringify(data) }),
  updateBeat: (id: string, data: any) => request<any>(`/story/beats/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteBeat: (id: string) => request<any>(`/story/beats/${id}`, { method: "DELETE" }),
};

// Items (game data)
export const items = {
  list: () => request<any[]>("/items"),
  get: (id: string) => request<any>(`/items/${id}`),
  create: (data: any) => request<any>("/items", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/items/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/items/${id}`, { method: "DELETE" }),
};

// Armor (game data)
export const armor = {
  list: () => request<any[]>("/armor"),
  get: (id: string) => request<any>(`/armor/${id}`),
  create: (data: any) => request<any>("/armor", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/armor/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/armor/${id}`, { method: "DELETE" }),
};

// Weapons (game data)
export const weapons = {
  list: () => request<any[]>("/weapons"),
  get: (id: string) => request<any>(`/weapons/${id}`),
  create: (data: any) => request<any>("/weapons", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/weapons/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/weapons/${id}`, { method: "DELETE" }),
};

// Mods (game data)
export const mods = {
  list: () => request<any[]>("/mods"),
  get: (id: string) => request<any>(`/mods/${id}`),
  create: (data: any) => request<any>("/mods", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/mods/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/mods/${id}`, { method: "DELETE" }),
};

// Spells (game data)
export const spells = {
  list: () => request<any[]>("/spells"),
  get: (id: string) => request<any>(`/spells/${id}`),
  create: (data: any) => request<any>("/spells", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/spells/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/spells/${id}`, { method: "DELETE" }),
};

// Game types (schema/enums)
export const gameTypes = {
  get: () => request<any>("/game-types"),
  update: (data: any) => request<any>("/game-types", { method: "PUT", body: JSON.stringify(data) }),
};

// Project settings
export const projectSettings = {
  get: () => request<any>("/project"),
  update: (data: any) => request<any>("/project", { method: "PUT", body: JSON.stringify(data) }),
  browse: (path: string) => request<any>(`/project/browse?path=${encodeURIComponent(path)}`),
};

// Story metadata
export const storyMeta = {
  get: () => request<any>("/story-meta"),
  update: (data: any) => request<any>("/story-meta", { method: "PUT", body: JSON.stringify(data) }),
};

// World
export const world = {
  get: () => request<any>("/world"),
  update: (data: any) => request<any>("/world", { method: "PUT", body: JSON.stringify(data) }),
};

// Validation
export const validation = {
  validate: () => request<any>("/validate"),
};

// LLM Generation
export const generate = {
  character: (prompt: string, provider = "ollama") =>
    request<any>("/generate/character", { method: "POST", body: JSON.stringify({ prompt, provider }) }),
  dialogue: (prompt: string, provider = "ollama") =>
    request<any>("/generate/dialogue", { method: "POST", body: JSON.stringify({ prompt, provider }) }),
  storyBeats: (prompt: string, provider = "ollama") =>
    request<any>("/generate/story-beats", { method: "POST", body: JSON.stringify({ prompt, provider }) }),
  field: (field: string, context: Record<string, any> = {}, prompt = "", provider = "ollama") =>
    request<any>("/generate/field", { method: "POST", body: JSON.stringify({ field, context, prompt, provider }) }),
};
