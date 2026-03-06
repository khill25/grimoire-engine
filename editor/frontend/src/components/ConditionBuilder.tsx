import { useState } from "react";
import { inputStyle, selectStyle } from "./FormField";

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
  /** Show event-type conditions (talked_to, visited) in addition to flag conditions */
  showEventConditions?: boolean;
  /** Available character IDs for talked_to picker */
  characterIds?: string[];
  /** Available place IDs for visited picker */
  placeIds?: string[];
}

interface ConditionPart {
  kind: "event" | "flag";
  // event fields
  action?: string;
  target?: string;
  // flag fields
  flagName?: string;
  operator?: string;
  flagValue?: string;
}

function parseCondition(raw: string | null, allowEvents: boolean): ConditionPart[] {
  if (!raw || !raw.trim()) return [];

  const parts = raw.split(" and ").map((p) => p.trim());
  return parts.map((part) => {
    // Event conditions: talked_to:X, visited:X
    if (allowEvents && part.includes(":")) {
      const [action, target] = part.split(":", 2);
      if (action === "talked_to" || action === "visited") {
        return { kind: "event" as const, action, target };
      }
    }

    // Flag conditions: key == value, key != value, key > value, bare flag
    for (const op of ["!=", "==", ">"]) {
      if (part.includes(op)) {
        const [key, val] = part.split(op, 2).map((s) => s.trim());
        return { kind: "flag" as const, flagName: key, operator: op, flagValue: val };
      }
    }

    // Bare flag (truthy check)
    return { kind: "flag" as const, flagName: part, operator: "", flagValue: "" };
  });
}

function serializeCondition(parts: ConditionPart[]): string | null {
  if (parts.length === 0) return null;

  const strs = parts.map((p) => {
    if (p.kind === "event") {
      return `${p.action || "talked_to"}:${p.target || ""}`;
    }
    if (p.operator && p.flagValue !== undefined && p.flagValue !== "") {
      return `${p.flagName || ""} ${p.operator} ${p.flagValue}`;
    }
    return p.flagName || "";
  }).filter(Boolean);

  return strs.length > 0 ? strs.join(" and ") : null;
}

const rowStyle: React.CSSProperties = {
  display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem",
};

const smallSelect: React.CSSProperties = {
  ...selectStyle, width: "auto", minWidth: 100, padding: "0.35rem 0.4rem", fontSize: "0.85rem",
};

const smallInput: React.CSSProperties = {
  ...inputStyle, padding: "0.35rem 0.4rem", fontSize: "0.85rem",
};

const removeBtnStyle: React.CSSProperties = {
  background: "none", border: "none", color: "#a33", cursor: "pointer", fontSize: "0.9rem", padding: "0 4px",
};

const addBtnStyle: React.CSSProperties = {
  background: "transparent", color: "#e0c097", border: "1px dashed #555",
  padding: "0.3rem 0.8rem", borderRadius: 4, cursor: "pointer", fontSize: "0.8rem",
};

export default function ConditionBuilder({ value, onChange, showEventConditions = false, characterIds = [], placeIds = [] }: Props) {
  const [parts, setParts] = useState<ConditionPart[]>(() => parseCondition(value, showEventConditions));

  const update = (newParts: ConditionPart[]) => {
    setParts(newParts);
    onChange(serializeCondition(newParts));
  };

  const updatePart = (idx: number, patch: Partial<ConditionPart>) => {
    const next = [...parts];
    next[idx] = { ...next[idx], ...patch };
    update(next);
  };

  const removePart = (idx: number) => {
    update(parts.filter((_, i) => i !== idx));
  };

  const addFlag = () => {
    update([...parts, { kind: "flag", flagName: "", operator: "==", flagValue: "true" }]);
  };

  const addEvent = () => {
    update([...parts, { kind: "event", action: "talked_to", target: "" }]);
  };

  if (parts.length === 0) {
    return (
      <div>
        <div style={{ color: "#666", fontSize: "0.8rem", marginBottom: "0.4rem" }}>No conditions — always active</div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={addFlag} style={addBtnStyle}>+ Flag Condition</button>
          {showEventConditions && <button onClick={addEvent} style={addBtnStyle}>+ Event Condition</button>}
        </div>
      </div>
    );
  }

  return (
    <div>
      {parts.map((part, idx) => (
        <div key={idx}>
          {idx > 0 && <div style={{ color: "#666", fontSize: "0.75rem", margin: "0.2rem 0 0.2rem 0.5rem" }}>AND</div>}
          <div style={rowStyle}>
            {part.kind === "event" ? (
              <>
                <select style={smallSelect} value={part.action || "talked_to"} onChange={(e) => updatePart(idx, { action: e.target.value, target: "" })}>
                  <option value="talked_to">Talked to</option>
                  <option value="visited">Visited</option>
                </select>
                <select
                  style={{ ...smallSelect, flex: 1 }}
                  value={part.target || ""}
                  onChange={(e) => updatePart(idx, { target: e.target.value })}
                >
                  <option value="">-- select --</option>
                  {(part.action === "talked_to" ? characterIds : placeIds).map((id) => (
                    <option key={id} value={id}>{id}</option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <input
                  style={{ ...smallInput, flex: 1 }}
                  placeholder="flag_name"
                  value={part.flagName || ""}
                  onChange={(e) => updatePart(idx, { flagName: e.target.value })}
                />
                <select style={{ ...smallSelect, minWidth: 60 }} value={part.operator || ""} onChange={(e) => updatePart(idx, { operator: e.target.value })}>
                  <option value="">is set</option>
                  <option value="==">==</option>
                  <option value="!=">!=</option>
                  <option value=">">&gt;</option>
                </select>
                {part.operator && (
                  <input
                    style={{ ...smallInput, width: 100 }}
                    placeholder="value"
                    value={part.flagValue || ""}
                    onChange={(e) => updatePart(idx, { flagValue: e.target.value })}
                  />
                )}
              </>
            )}
            <button onClick={() => removePart(idx)} style={removeBtnStyle} title="Remove condition">×</button>
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
        <button onClick={addFlag} style={addBtnStyle}>+ Flag</button>
        {showEventConditions && <button onClick={addEvent} style={addBtnStyle}>+ Event</button>}
      </div>
    </div>
  );
}
