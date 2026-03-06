import { inputStyle } from "./FormField";

interface Props {
  extras: Record<string, unknown>;
  onChange: (extras: Record<string, unknown>) => void;
}

export default function ExtrasEditor({ extras, onChange }: Props) {
  const entries = Object.entries(extras);

  const updateKey = (oldKey: string, newKey: string) => {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(extras)) {
      result[k === oldKey ? newKey : k] = v;
    }
    onChange(result);
  };

  const updateValue = (key: string, value: string) => {
    onChange({ ...extras, [key]: value });
  };

  const removeKey = (key: string) => {
    const { [key]: _, ...rest } = extras;
    onChange(rest);
  };

  const addField = () => {
    let key = "new_field";
    let i = 1;
    while (key in extras) {
      key = `new_field_${i++}`;
    }
    onChange({ ...extras, [key]: "" });
  };

  return (
    <div>
      {entries.map(([key, value]) => (
        <div key={key} style={{ display: "flex", gap: "0.5rem", marginBottom: 4, alignItems: "center" }}>
          <input
            style={{ ...inputStyle, width: "35%" }}
            value={key}
            onChange={(e) => updateKey(key, e.target.value)}
            placeholder="Key"
          />
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={String(value ?? "")}
            onChange={(e) => updateValue(key, e.target.value)}
            placeholder="Value"
          />
          <button
            onClick={() => removeKey(key)}
            style={{ background: "none", border: "none", color: "#a33", cursor: "pointer", fontSize: "1rem" }}
          >
            ×
          </button>
        </div>
      ))}
      <button
        onClick={addField}
        style={{
          background: "transparent",
          color: "#e0c097",
          border: "1px dashed #555",
          padding: "0.3rem 0.8rem",
          borderRadius: 4,
          cursor: "pointer",
          fontSize: "0.8rem",
          marginTop: 4,
        }}
      >
        + Add Field
      </button>
    </div>
  );
}
