import { useState } from "react";
import { useGameTypes, type TypeEntry } from "../context/GameTypesContext";
import { gameTypes as api } from "../api/client";
import FormField, { inputStyle, btnPrimary } from "../components/FormField";

const CATEGORIES = [
  { key: "stats", label: "Stats / Attributes", fields: ["id", "name", "description"] },
  { key: "damage_types", label: "Damage Types", fields: ["id", "name"] },
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
  const [dirty, setDirty] = useState<Record<string, TypeEntry[]>>({});

  const category = CATEGORIES.find((c) => c.key === activeCategory)!;
  const entries: TypeEntry[] = dirty[activeCategory] || types[activeCategory] || [];

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
      // Merge dirty categories with existing types
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

  return (
    <div style={{ display: "flex", gap: "1.5rem", height: "calc(100vh - 3rem)" }}>
      {/* Category sidebar */}
      <div style={{ width: 200, flexShrink: 0 }}>
        <h1 style={{ color: "#e0c097", margin: "0 0 1rem 0", fontSize: "1.3rem" }}>Game Types</h1>
        <p style={{ color: "#888", fontSize: "0.8rem", marginBottom: "1rem", lineHeight: 1.4 }}>
          Define the valid values for stats, damage types, equipment slots, and more. These power dropdowns and validation across the editor.
        </p>
        {CATEGORIES.map((cat) => {
          const count = (dirty[cat.key] || types[cat.key] || []).length;
          const isDirty = cat.key in dirty;
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

      {/* Entries editor */}
      <div style={{ flex: 1, overflow: "auto" }}>
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
              <div style={{ display: "grid", gridTemplateColumns: category.fields.includes("description") ? "120px 1fr 2fr" : category.fields.includes("color") ? "120px 1fr 100px" : category.fields.includes("multiplier") ? "80px 1fr 100px" : "120px 1fr", gap: "0.5rem", flex: 1 }}>
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
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 20 }}>
                <button onClick={() => moveEntry(i, -1)} disabled={i === 0} style={moveBtnStyle}>^</button>
                <button onClick={() => moveEntry(i, 1)} disabled={i === entries.length - 1} style={moveBtnStyle}>v</button>
                <button onClick={() => removeEntry(i)} style={{ ...moveBtnStyle, color: "#a33" }}>x</button>
              </div>
            </div>
          </div>
        ))}
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
