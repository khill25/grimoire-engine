import { useGameTypes } from "../context/GameTypesContext";
import { selectStyle } from "./FormField";

interface Props {
  category: string;
  value: string;
  onChange: (value: string) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
  style?: React.CSSProperties;
}

export default function TypeSelect({ category, value, onChange, allowEmpty = true, emptyLabel = "Select...", style }: Props) {
  const { options, validate } = useGameTypes();
  const opts = options(category);
  const isInvalid = value && opts.length > 0 && !validate(category, value);

  return (
    <div>
      <select
        style={{
          ...selectStyle,
          ...style,
          ...(isInvalid ? { borderColor: "#a33" } : {}),
        }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {allowEmpty && <option value="">{emptyLabel}</option>}
        {opts.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
        {isInvalid && <option value={value}>{value} (unknown)</option>}
      </select>
      {isInvalid && (
        <div style={{ color: "#a33", fontSize: "0.7rem", marginTop: 2 }}>
          "{value}" is not defined in game types
        </div>
      )}
    </div>
  );
}

// For key-value editors where keys should be type-validated
export function TypeKeySelect({ category, value, onChange }: { category: string; value: string; onChange: (v: string) => void }) {
  const { options } = useGameTypes();
  const opts = options(category);

  if (opts.length === 0) {
    // No types defined — fall back to text input
    return (
      <input
        style={{ ...selectStyle, width: "100%" }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="(define in Game Types)"
      />
    );
  }

  return (
    <select style={selectStyle} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select...</option>
      {opts.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
