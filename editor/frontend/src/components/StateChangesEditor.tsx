import { useState, useEffect } from "react";
import { inputStyle, selectStyle } from "./FormField";

interface Props {
  value: Record<string, unknown> | null;
  onChange: (value: Record<string, unknown> | null) => void;
}

interface Entry {
  key: string;
  value: string;
  type: "boolean" | "string" | "number";
}

function parseEntries(obj: Record<string, unknown> | null): Entry[] {
  if (!obj) return [];
  return Object.entries(obj).map(([key, val]) => {
    if (typeof val === "boolean") return { key, value: String(val), type: "boolean" as const };
    if (typeof val === "number") return { key, value: String(val), type: "number" as const };
    return { key, value: String(val ?? ""), type: "string" as const };
  });
}

function serializeEntries(entries: Entry[]): Record<string, unknown> | null {
  const valid = entries.filter((e) => e.key.trim());
  if (valid.length === 0) return null;
  const obj: Record<string, unknown> = {};
  for (const e of valid) {
    if (e.type === "boolean") obj[e.key] = e.value === "true";
    else if (e.type === "number") obj[e.key] = parseFloat(e.value) || 0;
    else obj[e.key] = e.value;
  }
  return obj;
}

const rowStyle: React.CSSProperties = {
  display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.4rem",
};

const smallInput: React.CSSProperties = {
  ...inputStyle, padding: "0.35rem 0.4rem", fontSize: "0.85rem",
};

const smallSelect: React.CSSProperties = {
  ...selectStyle, width: "auto", minWidth: 80, padding: "0.35rem 0.4rem", fontSize: "0.85rem",
};

const removeBtnStyle: React.CSSProperties = {
  background: "none", border: "none", color: "#a33", cursor: "pointer", fontSize: "0.9rem", padding: "0 4px",
};

const addBtnStyle: React.CSSProperties = {
  background: "transparent", color: "#e0c097", border: "1px dashed #555",
  padding: "0.3rem 0.8rem", borderRadius: 4, cursor: "pointer", fontSize: "0.8rem",
};

export default function StateChangesEditor({ value, onChange }: Props) {
  const [entries, setEntries] = useState<Entry[]>(() => parseEntries(value));

  // Sync when external value changes (e.g. switching nodes)
  useEffect(() => {
    setEntries(parseEntries(value));
  }, [value]);

  const update = (newEntries: Entry[]) => {
    setEntries(newEntries);
    onChange(serializeEntries(newEntries));
  };

  const updateEntry = (idx: number, patch: Partial<Entry>) => {
    const next = [...entries];
    const merged = { ...next[idx], ...patch };
    // When switching type, reset value to sensible default
    if (patch.type && patch.type !== next[idx].type) {
      if (patch.type === "boolean") merged.value = "true";
      else if (patch.type === "number") merged.value = "0";
      else merged.value = "";
    }
    next[idx] = merged;
    update(next);
  };

  const removeEntry = (idx: number) => update(entries.filter((_, i) => i !== idx));

  const addEntry = () => update([...entries, { key: "", value: "true", type: "boolean" }]);

  if (entries.length === 0) {
    return (
      <div>
        <div style={{ color: "#666", fontSize: "0.8rem", marginBottom: "0.4rem" }}>No state changes</div>
        <button onClick={addEntry} style={addBtnStyle}>+ Add Flag</button>
      </div>
    );
  }

  return (
    <div>
      {entries.map((entry, idx) => (
        <div key={idx} style={rowStyle}>
          <input
            style={{ ...smallInput, flex: 1 }}
            placeholder="flag_name"
            value={entry.key}
            onChange={(e) => updateEntry(idx, { key: e.target.value })}
          />
          <span style={{ color: "#666", fontSize: "0.85rem" }}>=</span>
          <select style={smallSelect} value={entry.type} onChange={(e) => updateEntry(idx, { type: e.target.value as Entry["type"] })}>
            <option value="boolean">bool</option>
            <option value="string">text</option>
            <option value="number">num</option>
          </select>
          {entry.type === "boolean" ? (
            <select style={{ ...smallSelect, minWidth: 70 }} value={entry.value} onChange={(e) => updateEntry(idx, { value: e.target.value })}>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : (
            <input
              style={{ ...smallInput, width: 100 }}
              type={entry.type === "number" ? "number" : "text"}
              placeholder="value"
              value={entry.value}
              onChange={(e) => updateEntry(idx, { value: e.target.value })}
            />
          )}
          <button onClick={() => removeEntry(idx)} style={removeBtnStyle} title="Remove">×</button>
        </div>
      ))}
      <button onClick={addEntry} style={addBtnStyle}>+ Add Flag</button>
    </div>
  );
}
