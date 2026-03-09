import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { lootTables, items, armor, weapons, mods } from "../api/client";
import FormField, { inputStyle, btnPrimary, btnDanger } from "../components/FormField";
import EntitySelect from "../components/EntitySelect";

interface StatRoll {
  stat_key: string;
  min_value: number;
  max_value: number;
}

interface LootEntry {
  item_id: string;
  weight: number;
  quantity_min: number;
  quantity_max: number;
  is_guaranteed: boolean;
  randomizable_stats: StatRoll[];
}

interface LootTableData {
  name: string;
  chance_any_drop: number;
  min_items: number;
  max_items: number;
  entries: LootEntry[];
}

const emptyEntry: LootEntry = {
  item_id: "", weight: 1, quantity_min: 1, quantity_max: 1,
  is_guaranteed: false, randomizable_stats: [],
};

const emptyTable: LootTableData = {
  name: "", chance_any_drop: 1.0, min_items: 1, max_items: 1, entries: [],
};

const emptyRoll: StatRoll = { stat_key: "", min_value: 0, max_value: 0 };

export default function LootTableEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";
  const [table, setTable] = useState<LootTableData>(emptyTable);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!isNew && id) {
      lootTables.get(id).then((data) => {
        setTable({
          ...emptyTable,
          ...data,
          entries: (data.entries || []).map((e: any) => ({
            ...emptyEntry,
            ...e,
            randomizable_stats: e.randomizable_stats || [],
          })),
        });
      }).catch(() => setError("Loot table not found"));
    }
  }, [id, isNew]);

  const update = (patch: Partial<LootTableData>) => setTable({ ...table, ...patch });

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      if (isNew) {
        await lootTables.create(table);
      } else {
        await lootTables.update(id!, table);
      }
      navigate("/loot-tables");
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  // Entry CRUD
  const updateEntry = (i: number, patch: Partial<LootEntry>) => {
    const entries = [...table.entries];
    entries[i] = { ...entries[i], ...patch };
    update({ entries });
  };

  const addEntry = () => {
    update({ entries: [...table.entries, { ...emptyEntry }] });
  };

  const removeEntry = (i: number) => {
    setExpandedEntries((prev) => {
      const next = new Set<number>();
      prev.forEach((idx) => {
        if (idx < i) next.add(idx);
        else if (idx > i) next.add(idx - 1);
      });
      return next;
    });
    update({ entries: table.entries.filter((_, j) => j !== i) });
  };

  const toggleExpanded = (i: number) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  // StatRoll CRUD
  const updateRoll = (entryIdx: number, rollIdx: number, patch: Partial<StatRoll>) => {
    const entries = [...table.entries];
    const rolls = [...entries[entryIdx].randomizable_stats];
    rolls[rollIdx] = { ...rolls[rollIdx], ...patch };
    entries[entryIdx] = { ...entries[entryIdx], randomizable_stats: rolls };
    update({ entries });
  };

  const addRoll = (entryIdx: number) => {
    const entries = [...table.entries];
    entries[entryIdx] = {
      ...entries[entryIdx],
      randomizable_stats: [...entries[entryIdx].randomizable_stats, { ...emptyRoll }],
    };
    update({ entries });
  };

  const removeRoll = (entryIdx: number, rollIdx: number) => {
    const entries = [...table.entries];
    entries[entryIdx] = {
      ...entries[entryIdx],
      randomizable_stats: entries[entryIdx].randomizable_stats.filter((_, j) => j !== rollIdx),
    };
    update({ entries });
  };

  // Fetch all item types for the picker
  const fetchAllItems = async (): Promise<{ id: string; name: string }[]> => {
    const [itemList, armorList, weaponList, modList] = await Promise.all([
      items.list(), armor.list(), weapons.list(), mods.list(),
    ]);
    return [
      ...itemList.map((i: any) => ({ id: i.id, name: `${i.name} (item)` })),
      ...armorList.map((i: any) => ({ id: i.id, name: `${i.name} (armor)` })),
      ...weaponList.map((i: any) => ({ id: i.id, name: `${i.name} (weapon)` })),
      ...modList.map((i: any) => ({ id: i.id, name: `${i.name} (mod)` })),
    ];
  };

  // Summary stats
  const guaranteedCount = table.entries.filter((e) => e.is_guaranteed).length;
  const totalWeight = table.entries
    .filter((e) => !e.is_guaranteed)
    .reduce((sum, e) => sum + e.weight, 0);

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ color: "#e0c097", margin: 0 }}>
          {isNew ? "New Loot Table" : `Edit: ${table.name}`}
        </h1>
        <button onClick={() => navigate("/loot-tables")} style={btnDanger}>Cancel</button>
      </div>

      {error && <div style={{ color: "#f88", marginBottom: "1rem" }}>{error}</div>}

      {/* Table-level fields */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "1rem" }}>
        <div style={{ gridColumn: "1 / 3" }}>
          <FormField label="Name" hint="Tag applied to enemies, chests, etc.">
            <input style={inputStyle} value={table.name} onChange={(e) => update({ name: e.target.value })} disabled={!isNew} />
          </FormField>
        </div>
        <FormField label="Drop Chance" hint="0.0–1.0">
          <input style={inputStyle} type="number" step="0.05" min="0" max="1" value={table.chance_any_drop} onChange={(e) => update({ chance_any_drop: parseFloat(e.target.value) || 0 })} />
        </FormField>
        <div />
        <FormField label="Min Items">
          <input style={inputStyle} type="number" min="0" value={table.min_items} onChange={(e) => update({ min_items: parseInt(e.target.value) || 0 })} />
        </FormField>
        <FormField label="Max Items">
          <input style={inputStyle} type="number" min="0" value={table.max_items} onChange={(e) => update({ max_items: parseInt(e.target.value) || 0 })} />
        </FormField>
      </div>

      {/* Summary */}
      <div style={{ display: "flex", gap: "1.5rem", margin: "0.5rem 0 0.25rem", fontSize: "0.8rem", color: "#888" }}>
        <span>{table.entries.length} entries</span>
        <span>{guaranteedCount} guaranteed</span>
        {totalWeight > 0 && <span>Total weight: {totalWeight.toFixed(1)}</span>}
      </div>

      {/* Entries */}
      <Section title="Entries">
        {table.entries.map((entry, i) => {
          const isExpanded = expandedEntries.has(i);
          const pct = !entry.is_guaranteed && totalWeight > 0
            ? ((entry.weight / totalWeight) * 100).toFixed(1)
            : null;

          return (
            <div key={i} style={cardStyle}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px 80px 90px auto auto", gap: "0.5rem", alignItems: "end" }}>
                <FormField label="Item">
                  <EntitySelect
                    value={entry.item_id}
                    onChange={(v) => updateEntry(i, { item_id: v })}
                    fetchItems={fetchAllItems}
                    placeholder="Search items..."
                    allowEmpty={false}
                  />
                </FormField>
                <FormField label={pct ? `Weight (${pct}%)` : "Weight"}>
                  <input style={inputStyle} type="number" step="0.1" min="0" value={entry.weight} onChange={(e) => updateEntry(i, { weight: parseFloat(e.target.value) || 0 })} />
                </FormField>
                <FormField label="Qty Min">
                  <input style={inputStyle} type="number" min="1" value={entry.quantity_min} onChange={(e) => updateEntry(i, { quantity_min: parseInt(e.target.value) || 1 })} />
                </FormField>
                <FormField label="Qty Max">
                  <input style={inputStyle} type="number" min="1" value={entry.quantity_max} onChange={(e) => updateEntry(i, { quantity_max: parseInt(e.target.value) || 1 })} />
                </FormField>
                <FormField label="Guaranteed">
                  <input type="checkbox" checked={entry.is_guaranteed} onChange={(e) => updateEntry(i, { is_guaranteed: e.target.checked })} />
                </FormField>
                <div style={{ display: "flex", gap: "0.25rem", paddingBottom: "1rem" }}>
                  <button
                    onClick={() => toggleExpanded(i)}
                    style={smallBtnStyle}
                    title="Randomizable Stats"
                  >
                    {isExpanded ? "▾" : "▸"} Stats{entry.randomizable_stats.length > 0 ? ` (${entry.randomizable_stats.length})` : ""}
                  </button>
                  <button
                    onClick={() => removeEntry(i)}
                    style={{ ...smallBtnStyle, color: "#a33", borderColor: "#a33" }}
                  >
                    x
                  </button>
                </div>
              </div>

              {/* Expandable StatRoll sub-panel */}
              {isExpanded && (
                <div style={subPanelStyle}>
                  <div style={{ fontSize: "0.75rem", color: "#e0c097", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                    Randomizable Stats
                  </div>
                  {entry.randomizable_stats.map((roll, ri) => (
                    <div key={ri} style={{ display: "flex", gap: "0.5rem", marginBottom: 4, alignItems: "center" }}>
                      <input
                        style={{ ...inputStyle, flex: 2 }}
                        value={roll.stat_key}
                        onChange={(e) => updateRoll(i, ri, { stat_key: e.target.value })}
                        placeholder="stat key (e.g. base_damage)"
                      />
                      <input
                        style={{ ...inputStyle, flex: 1 }}
                        type="number"
                        step="0.1"
                        value={roll.min_value}
                        onChange={(e) => updateRoll(i, ri, { min_value: parseFloat(e.target.value) || 0 })}
                        placeholder="min"
                      />
                      <span style={{ color: "#666" }}>–</span>
                      <input
                        style={{ ...inputStyle, flex: 1 }}
                        type="number"
                        step="0.1"
                        value={roll.max_value}
                        onChange={(e) => updateRoll(i, ri, { max_value: parseFloat(e.target.value) || 0 })}
                        placeholder="max"
                      />
                      <button
                        onClick={() => removeRoll(i, ri)}
                        style={{ background: "none", border: "none", color: "#a33", cursor: "pointer", fontSize: "1rem" }}
                      >
                        x
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addRoll(i)} style={addBtnStyle}>+ Add Stat Roll</button>
                </div>
              )}
            </div>
          );
        })}
        <button onClick={addEntry} style={addBtnStyle}>+ Add Entry</button>
      </Section>

      <div style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
        <button onClick={save} disabled={saving} style={btnPrimary}>
          {saving ? "Saving..." : isNew ? "Create Loot Table" : "Save Changes"}
        </button>
        <button onClick={() => navigate("/loot-tables")} style={btnDanger}>Cancel</button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: "1.5rem" }}>
      <h3 style={{ color: "#e0c097", borderBottom: "1px solid #333", paddingBottom: 4 }}>{title}</h3>
      {children}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#1a1a2e",
  border: "1px solid #333",
  borderRadius: 6,
  padding: "0.75rem",
  marginBottom: "0.5rem",
};

const subPanelStyle: React.CSSProperties = {
  background: "#141428",
  border: "1px solid #2a2a4a",
  borderRadius: 4,
  padding: "0.75rem",
  marginTop: "0.5rem",
};

const addBtnStyle: React.CSSProperties = {
  background: "transparent",
  color: "#e0c097",
  border: "1px dashed #555",
  padding: "0.3rem 0.8rem",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: "0.8rem",
  marginTop: 4,
};

const smallBtnStyle: React.CSSProperties = {
  background: "transparent",
  color: "#e0c097",
  border: "1px solid #444",
  padding: "0.2rem 0.5rem",
  borderRadius: 3,
  cursor: "pointer",
  fontSize: "0.75rem",
};
