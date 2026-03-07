import { useState } from "react";
import { useGameTypes, type TypeEntry } from "../context/GameTypesContext";
import { gameTypes as api } from "../api/client";
import FormField, { inputStyle, btnPrimary } from "../components/FormField";

const CATEGORIES = [
  { key: "stats", label: "Stats (Pillars)", fields: ["id", "name", "description", "primary"] },
  { key: "resources", label: "Resources", fields: ["id", "name", "description"] },
  { key: "resource_scaling", label: "Resource Scaling", fields: [] },
  { key: "damage_types", label: "Damage Types", fields: ["id", "name", "pillar"] },
  { key: "equipment_slots", label: "Equipment Slots", fields: ["id", "name"] },
  { key: "item_types", label: "Item Types", fields: ["id", "name"] },
  { key: "rarities", label: "Rarities", fields: ["id", "name", "color"] },
  { key: "scaling_grades", label: "Scaling Grades", fields: ["id", "name", "multiplier"] },
  { key: "effect_types", label: "Effect Types", fields: ["id", "name"] },
];

export default function GameTypes() {
  const { types, reload } = useGameTypes();
  const [activeCategory, setActiveCategory] = useState("stats");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState<Record<string, any>>({});

  const category = CATEGORIES.find((c) => c.key === activeCategory)!;
  const isScalingMatrix = activeCategory === "resource_scaling";

  // For list-based categories
  const entries: TypeEntry[] = isScalingMatrix ? [] : (dirty[activeCategory] || types[activeCategory] || []) as TypeEntry[];

  const setEntries = (updated: TypeEntry[]) => {
    setDirty({ ...dirty, [activeCategory]: updated });
  };

  const addEntry = () => {
    setEntries([...entries, { id: "", name: "" }]);
  };

  const updateEntry = (i: number, patch: Partial<TypeEntry>) => {
    const updated = [...entries];
    updated[i] = { ...updated[i], ...patch };
    setEntries(updated);
  };

  const removeEntry = (i: number) => {
    setEntries(entries.filter((_, j) => j !== i));
  };

  const moveEntry = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= entries.length) return;
    const updated = [...entries];
    [updated[i], updated[j]] = [updated[j], updated[i]];
    setEntries(updated);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const merged = { ...types, ...dirty };
      await api.update(merged);
      await reload();
      setDirty({});
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  const hasDirty = Object.keys(dirty).length > 0;

  // Get stats and resources for the scaling matrix
  const stats = (dirty["stats"] || types.stats || []) as TypeEntry[];
  const resources = (dirty["resources"] || types.resources || []) as TypeEntry[];
  const scaling: Record<string, Record<string, number>> = dirty["resource_scaling"] || types.resource_scaling || {};

  const updateScaling = (statId: string, resourceId: string, value: number) => {
    const updated = { ...scaling };
    if (!updated[statId]) updated[statId] = {};
    updated[statId] = { ...updated[statId], [resourceId]: value };
    // Remove zero values to keep YAML clean
    if (value === 0) {
      delete updated[statId][resourceId];
      if (Object.keys(updated[statId]).length === 0) delete updated[statId];
    }
    setDirty({ ...dirty, resource_scaling: updated });
  };

  return (
    <div style={{ display: "flex", gap: "1.5rem", height: "calc(100vh - 3rem)" }}>
      {/* Category sidebar */}
      <div style={{ width: 200, flexShrink: 0 }}>
        <h1 style={{ color: "#e0c097", margin: "0 0 1rem 0", fontSize: "1.3rem" }}>Game Types</h1>
        <p style={{ color: "#888", fontSize: "0.8rem", marginBottom: "1rem", lineHeight: 1.4 }}>
          Define stats, resources, damage types, and more. These power dropdowns and validation across the editor.
        </p>
        {CATEGORIES.map((cat) => {
          const isDirty = cat.key in dirty;
          let count: number;
          if (cat.key === "resource_scaling") {
            count = Object.keys(scaling).length;
          } else {
            const arr = dirty[cat.key] || types[cat.key as keyof typeof types];
            count = Array.isArray(arr) ? arr.length : 0;
          }
          return (
            <div
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              style={{
                padding: "0.5rem 0.75rem",
                marginBottom: 2,
                borderRadius: 4,
                cursor: "pointer",
                background: activeCategory === cat.key ? "#16213e" : "transparent",
                borderLeft: activeCategory === cat.key ? "3px solid #e0c097" : "3px solid transparent",
                color: activeCategory === cat.key ? "#e0c097" : "#ccc",
                fontSize: "0.85rem",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>{cat.label}{isDirty ? " *" : ""}</span>
              <span style={{ color: "#666", fontSize: "0.75rem" }}>{count}</span>
            </div>
          );
        })}
        <button onClick={save} disabled={saving || !hasDirty} style={{ ...btnPrimary, width: "100%", marginTop: "1rem", opacity: hasDirty ? 1 : 0.5 }}>
          {saving ? "Saving..." : "Save All"}
        </button>
        {error && <div style={{ color: "#f88", fontSize: "0.8rem", marginTop: "0.5rem" }}>{error}</div>}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {isScalingMatrix ? (
          <ResourceScalingMatrix
            stats={stats}
            resources={resources}
            scaling={scaling}
            onUpdate={updateScaling}
          />
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ color: "#e0c097", margin: 0, fontSize: "1.1rem" }}>{category.label}</h2>
              <button onClick={addEntry} style={{ ...btnPrimary, fontSize: "0.8rem", padding: "0.3rem 0.8rem" }}>+ Add</button>
            </div>

            {entries.length === 0 && (
              <div style={{ color: "#666", padding: "2rem", textAlign: "center", border: "1px dashed #333", borderRadius: 6 }}>
                No {category.label.toLowerCase()} defined. Add one to get started.
              </div>
            )}

            {entries.map((entry, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "start" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1 }}>
                    <div style={{ display: "grid", gridTemplateColumns: getGridColumns(category), gap: "0.5rem" }}>
                      <FormField label="ID">
                        <input style={inputStyle} value={entry.id} onChange={(e) => updateEntry(i, { id: e.target.value })} placeholder="id" />
                      </FormField>
                      <FormField label="Name">
                        <input style={inputStyle} value={entry.name} onChange={(e) => updateEntry(i, { name: e.target.value })} placeholder="Display name" />
                      </FormField>
                      {category.fields.includes("description") && (
                        <FormField label="Description">
                          <input style={inputStyle} value={entry.description || ""} onChange={(e) => updateEntry(i, { description: e.target.value })} placeholder="Description" />
                        </FormField>
                      )}
                      {category.fields.includes("color") && (
                        <FormField label="Color">
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <input type="color" value={entry.color || "#aaaaaa"} onChange={(e) => updateEntry(i, { color: e.target.value })} style={{ width: 32, height: 32, border: "none", background: "none", cursor: "pointer" }} />
                            <input style={{ ...inputStyle, width: 80 }} value={entry.color || ""} onChange={(e) => updateEntry(i, { color: e.target.value })} />
                          </div>
                        </FormField>
                      )}
                      {category.fields.includes("multiplier") && (
                        <FormField label="Multiplier">
                          <input style={inputStyle} type="number" step="0.05" value={entry.multiplier ?? 0} onChange={(e) => updateEntry(i, { multiplier: parseFloat(e.target.value) || 0 })} />
                        </FormField>
                      )}
                      {category.fields.includes("pillar") && (
                        <FormField label="Pillar">
                          <select style={inputStyle} value={entry.pillar || ""} onChange={(e) => updateEntry(i, { pillar: e.target.value || undefined })}>
                            <option value="">None</option>
                            {stats.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </FormField>
                      )}
                    </div>
                    {category.fields.includes("primary") && (
                      <>
                        <label style={{ color: "#ccc", fontSize: "0.8rem" }}>
                          <input type="checkbox" checked={entry.primary !== false} onChange={(e) => updateEntry(i, {
                            primary: e.target.checked,
                            derived: !e.target.checked ? true : undefined,
                            formula: !e.target.checked ? (entry.formula || "average") : undefined,
                            sources: !e.target.checked ? (entry.sources || []) : undefined,
                          })} />
                          {" "}Primary stat (players allocate points)
                          {entry.derived && <span style={{ color: "#888", marginLeft: 8 }}>— Derived</span>}
                        </label>
                        {entry.derived && (
                          <DerivedStatConfig
                            entry={entry}
                            allStats={entries}
                            onUpdate={(patch) => updateEntry(i, patch)}
                          />
                        )}
                      </>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 20 }}>
                    <button onClick={() => moveEntry(i, -1)} disabled={i === 0} style={moveBtnStyle}>^</button>
                    <button onClick={() => moveEntry(i, 1)} disabled={i === entries.length - 1} style={moveBtnStyle}>v</button>
                    <button onClick={() => removeEntry(i)} style={{ ...moveBtnStyle, color: "#a33" }}>x</button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function getGridColumns(category: { fields: string[] }): string {
  if (category.fields.includes("description")) return "120px 1fr 2fr";
  if (category.fields.includes("color")) return "120px 1fr 100px";
  if (category.fields.includes("multiplier")) return "80px 1fr 100px";
  if (category.fields.includes("pillar")) return "120px 1fr 120px";
  return "120px 1fr";
}

const DERIVED_FORMULAS = [
  { id: "average", label: "Average", desc: "Mean of source stats" },
  { id: "min", label: "Minimum", desc: "Lowest source stat" },
  { id: "max", label: "Maximum", desc: "Highest source stat" },
  { id: "sum", label: "Sum", desc: "Total of all source stats" },
];

function calcDerivedPoints(
  stat: TypeEntry,
  sourceValues: Record<string, number>,
  allStats: TypeEntry[],
): number {
  const formula = stat.formula || "average";
  const primaryStats = allStats.filter((s) => !s.derived);
  const sourceIds = stat.sources && stat.sources.length > 0
    ? stat.sources
    : primaryStats.map((s) => s.id);
  const values = sourceIds.map((id) => sourceValues[id] ?? 0).filter((v) => v !== undefined);
  if (values.length === 0) return 0;
  switch (formula) {
    case "min": return Math.min(...values);
    case "max": return Math.max(...values);
    case "sum": return values.reduce((a, b) => a + b, 0);
    case "average":
    default:
      return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
  }
}

function DerivedStatConfig({ entry, allStats, onUpdate }: {
  entry: TypeEntry;
  allStats: TypeEntry[];
  onUpdate: (patch: Partial<TypeEntry>) => void;
}) {
  const primaryStats = allStats.filter((s) => !s.derived && s.id !== entry.id);
  const sources = entry.sources || [];
  const formula = entry.formula || "average";

  const toggleSource = (statId: string) => {
    const next = sources.includes(statId)
      ? sources.filter((s) => s !== statId)
      : [...sources, statId];
    onUpdate({ sources: next });
  };

  return (
    <div style={{ background: "#111827", border: "1px solid #333", borderRadius: 4, padding: "0.6rem", marginTop: 4 }}>
      <div style={{ display: "flex", gap: "1rem", alignItems: "start", flexWrap: "wrap" }}>
        <FormField label="Formula">
          <select
            style={{ ...inputStyle, width: 140 }}
            value={formula}
            onChange={(e) => onUpdate({ formula: e.target.value })}
          >
            {DERIVED_FORMULAS.map((f) => (
              <option key={f.id} value={f.id}>{f.label} — {f.desc}</option>
            ))}
          </select>
        </FormField>
        <div>
          <div style={{ color: "#888", fontSize: "0.75rem", marginBottom: 4 }}>
            Sources {sources.length === 0 && <span style={{ color: "#666" }}>(all primaries if none selected)</span>}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {primaryStats.map((s) => (
              <label key={s.id} style={{
                color: sources.includes(s.id) ? "#e0c097" : "#666",
                fontSize: "0.8rem",
                cursor: "pointer",
                background: sources.includes(s.id) ? "#1a2940" : "transparent",
                border: `1px solid ${sources.includes(s.id) ? "#e0c097" : "#333"}`,
                borderRadius: 3,
                padding: "2px 8px",
              }}>
                <input
                  type="checkbox"
                  checked={sources.includes(s.id)}
                  onChange={() => toggleSource(s.id)}
                  style={{ display: "none" }}
                />
                {s.name}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Grid-based editor: stats as rows, resources as columns, values are the scaling weights
function ResourceScalingMatrix({ stats, resources, scaling, onUpdate }: {
  stats: TypeEntry[];
  resources: TypeEntry[];
  scaling: Record<string, Record<string, number>>;
  onUpdate: (statId: string, resourceId: string, value: number) => void;
}) {
  if (stats.length === 0 || resources.length === 0) {
    return (
      <div>
        <h2 style={{ color: "#e0c097", margin: "0 0 1rem 0", fontSize: "1.1rem" }}>Resource Scaling</h2>
        <div style={{ color: "#666", padding: "2rem", textAlign: "center", border: "1px dashed #333", borderRadius: 6 }}>
          Define stats and resources first, then configure how each stat contributes to each resource.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ color: "#e0c097", margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>Resource Scaling</h2>
      <p style={{ color: "#888", fontSize: "0.8rem", marginBottom: "1rem" }}>
        How much each point in a stat contributes to each resource. Set to 0 for no contribution.
      </p>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={thStyle}>Stat</th>
              {resources.map((r) => (
                <th key={r.id} style={{ ...thStyle, textAlign: "center", minWidth: 90 }}>
                  {r.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.map((stat) => (
              <tr key={stat.id}>
                <td style={{ ...tdStyle, color: "#e0c097", fontWeight: 600 }}>
                  {stat.name}
                  {stat.derived && <span style={{ color: "#666", fontSize: "0.7rem", marginLeft: 4 }}>(derived)</span>}
                </td>
                {resources.map((resource) => {
                  const value = scaling[stat.id]?.[resource.id] || 0;
                  return (
                    <td key={resource.id} style={{ ...tdStyle, textAlign: "center", padding: "0.3rem" }}>
                      <input
                        type="number"
                        step="1"
                        value={value}
                        onChange={(e) => onUpdate(stat.id, resource.id, parseFloat(e.target.value) || 0)}
                        style={{
                          ...inputStyle,
                          width: 60,
                          textAlign: "center",
                          padding: "0.3rem",
                          fontSize: "0.85rem",
                          background: value > 0 ? "#162030" : "#1a1a2e",
                          borderColor: value >= 5 ? "#e0c097" : value > 0 ? "#444" : "#333",
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Preview: show what a 10-point investment gives */}
      <div style={{ marginTop: "1.5rem" }}>
        <h3 style={{ color: "#e0c097", fontSize: "0.95rem", borderBottom: "1px solid #333", paddingBottom: 4 }}>
          Preview: 10 points in each primary stat
        </h3>
        <p style={{ color: "#666", fontSize: "0.75rem", marginBottom: "0.5rem" }}>
          Resource pools with 10 points in each primary stat. Derived stats use their configured formula.
        </p>
        {(() => {
          const primaryStats = stats.filter((s) => !s.derived);
          const derivedStats = stats.filter((s) => s.derived);
          const primaryPoints = 10;
          // Build effective points per stat
          const statPoints: Record<string, number> = {};
          primaryStats.forEach((s) => { statPoints[s.id] = primaryPoints; });
          derivedStats.forEach((s) => {
            statPoints[s.id] = calcDerivedPoints(s, statPoints, stats);
          });

          return (
            <>
              {derivedStats.length > 0 && (
                <div style={{ color: "#888", fontSize: "0.75rem", marginBottom: "0.5rem" }}>
                  {derivedStats.map((s) => {
                    const formula = s.formula || "average";
                    const sourceIds = s.sources && s.sources.length > 0
                      ? s.sources
                      : primaryStats.map((p) => p.id);
                    const sourceNames = sourceIds.map((id) => stats.find((st) => st.id === id)?.name || id);
                    return `${s.name}: ${statPoints[s.id]} (${formula} of ${sourceNames.join(", ")})`;
                  }).join(" · ")}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${resources.length}, 1fr)`, gap: "0.5rem" }}>
                {resources.map((resource) => {
                  const total = stats.reduce((sum, stat) => {
                    return sum + (scaling[stat.id]?.[resource.id] || 0) * (statPoints[stat.id] || 0);
                  }, 0);
                  return (
                    <div key={resource.id} style={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 4, padding: "0.5rem", textAlign: "center" }}>
                      <div style={{ color: "#e0c097", fontSize: "1.1rem", fontWeight: 600 }}>{total}</div>
                      <div style={{ color: "#888", fontSize: "0.7rem", textTransform: "uppercase" }}>{resource.name}</div>
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#1a1a2e",
  border: "1px solid #333",
  borderRadius: 4,
  padding: "0.75rem",
  marginBottom: "0.5rem",
};

const moveBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #444",
  color: "#888",
  cursor: "pointer",
  fontSize: "0.7rem",
  padding: "2px 6px",
  borderRadius: 3,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.5rem",
  borderBottom: "1px solid #444",
  color: "#888",
  fontSize: "0.75rem",
  textTransform: "uppercase",
};

const tdStyle: React.CSSProperties = {
  padding: "0.5rem",
  borderBottom: "1px solid #222",
  color: "#ddd",
  fontSize: "0.85rem",
};
