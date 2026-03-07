import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { gameTypes as api } from "../api/client";

export interface TypeEntry {
  id: string;
  name: string;
  description?: string;
  color?: string;
  multiplier?: number;
  primary?: boolean;
  derived?: boolean;
  formula?: string;
  sources?: string[];
  pillar?: string;
}

export interface GameTypes {
  stats: TypeEntry[];
  resources: TypeEntry[];
  resource_scaling: Record<string, Record<string, number>>;
  damage_types: TypeEntry[];
  equipment_slots: TypeEntry[];
  item_types: TypeEntry[];
  rarities: TypeEntry[];
  scaling_grades: TypeEntry[];
  effect_types: TypeEntry[];
  [key: string]: TypeEntry[] | Record<string, Record<string, number>>;
}

const empty: GameTypes = {
  stats: [],
  resources: [],
  resource_scaling: {},
  damage_types: [],
  equipment_slots: [],
  item_types: [],
  rarities: [],
  scaling_grades: [],
  effect_types: [],
};

interface GameTypesContextValue {
  types: GameTypes;
  loading: boolean;
  reload: () => Promise<void>;
  lookup: (category: string, id: string) => TypeEntry | undefined;
  options: (category: string) => { value: string; label: string }[];
  validate: (category: string, id: string) => boolean;
}

const GameTypesContext = createContext<GameTypesContextValue>({
  types: empty,
  loading: true,
  reload: async () => {},
  lookup: () => undefined,
  options: () => [],
  validate: () => true,
});

export function GameTypesProvider({ children }: { children: React.ReactNode }) {
  const [types, setTypes] = useState<GameTypes>(empty);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const data = await api.get();
      setTypes({ ...empty, ...data });
    } catch {
      setTypes(empty);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const lookup = useCallback((category: string, id: string) => {
    const cat = types[category];
    if (!Array.isArray(cat)) return undefined;
    return cat.find((e) => e.id === id);
  }, [types]);

  const options = useCallback((category: string) => {
    const cat = types[category];
    if (!Array.isArray(cat)) return [];
    return cat.map((e) => ({ value: e.id, label: e.name }));
  }, [types]);

  const validate = useCallback((category: string, id: string) => {
    const entries = types[category];
    if (!Array.isArray(entries) || entries.length === 0) return true;
    return entries.some((e) => e.id === id);
  }, [types]);

  return (
    <GameTypesContext.Provider value={{ types, loading, reload, lookup, options, validate }}>
      {children}
    </GameTypesContext.Provider>
  );
}

export function useGameTypes() {
  return useContext(GameTypesContext);
}
