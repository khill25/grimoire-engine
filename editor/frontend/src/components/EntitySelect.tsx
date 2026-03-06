import { useEffect, useState } from "react";
import { inputStyle } from "./FormField";

interface Props {
  value: string;
  onChange: (value: string) => void;
  fetchItems: () => Promise<{ id: string; name: string }[]>;
  placeholder?: string;
  allowEmpty?: boolean;
}

export default function EntitySelect({ value, onChange, fetchItems, placeholder = "Select...", allowEmpty = true }: Props) {
  const [items, setItems] = useState<{ id: string; name: string }[]>([]);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchItems().then(setItems);
  }, []);

  const filtered = items.filter(
    (item) =>
      item.id.toLowerCase().includes(filter.toLowerCase()) ||
      item.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div style={{ position: "relative" }}>
      <input
        style={inputStyle}
        value={open ? filter : value}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          setFilter(value);
        }}
        onChange={(e) => {
          setFilter(e.target.value);
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            maxHeight: 200,
            overflow: "auto",
            background: "#1a1a2e",
            border: "1px solid #444",
            borderRadius: 4,
            zIndex: 10,
          }}
        >
          {allowEmpty && (
            <div
              style={optionStyle}
              onMouseDown={() => {
                onChange("");
                setFilter("");
                setOpen(false);
              }}
            >
              <span style={{ color: "#666" }}>(none)</span>
            </div>
          )}
          {filtered.map((item) => (
            <div
              key={item.id}
              style={{
                ...optionStyle,
                background: item.id === value ? "#16213e" : "transparent",
              }}
              onMouseDown={() => {
                onChange(item.id);
                setFilter(item.id);
                setOpen(false);
              }}
            >
              <span style={{ color: "#e0c097" }}>{item.id}</span>
              {item.name !== item.id && (
                <span style={{ color: "#888", marginLeft: 8, fontSize: "0.8rem" }}>{item.name}</span>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ ...optionStyle, color: "#666" }}>No matches</div>
          )}
        </div>
      )}
    </div>
  );
}

const optionStyle: React.CSSProperties = {
  padding: "0.4rem 0.5rem",
  cursor: "pointer",
  fontSize: "0.85rem",
  borderBottom: "1px solid #222",
};

interface MultiEntitySelectProps {
  values: string[];
  onChange: (values: string[]) => void;
  fetchItems: () => Promise<{ id: string; name: string }[]>;
  placeholder?: string;
}

export function MultiEntitySelect({ values, onChange, fetchItems, placeholder = "Add..." }: MultiEntitySelectProps) {
  const [items, setItems] = useState<{ id: string; name: string }[]>([]);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchItems().then(setItems);
  }, []);

  const filtered = items.filter(
    (item) =>
      !values.includes(item.id) &&
      (item.id.toLowerCase().includes(filter.toLowerCase()) ||
        item.name.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div>
      {values.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
          {values.map((v) => (
            <span
              key={v}
              style={{
                background: "#16213e",
                border: "1px solid #333",
                borderRadius: 3,
                padding: "2px 8px",
                fontSize: "0.8rem",
                color: "#e0c097",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {v}
              <button
                onClick={() => onChange(values.filter((x) => x !== v))}
                style={{ background: "none", border: "none", color: "#a33", cursor: "pointer", fontSize: "0.8rem", padding: 0 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div style={{ position: "relative" }}>
        <input
          style={inputStyle}
          value={filter}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setFilter(e.target.value);
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {open && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              maxHeight: 200,
              overflow: "auto",
              background: "#1a1a2e",
              border: "1px solid #444",
              borderRadius: 4,
              zIndex: 10,
            }}
          >
            {filtered.map((item) => (
              <div
                key={item.id}
                style={optionStyle}
                onMouseDown={() => {
                  onChange([...values, item.id]);
                  setFilter("");
                  setOpen(false);
                }}
              >
                <span style={{ color: "#e0c097" }}>{item.id}</span>
                {item.name !== item.id && (
                  <span style={{ color: "#888", marginLeft: 8, fontSize: "0.8rem" }}>{item.name}</span>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ ...optionStyle, color: "#666" }}>No more items</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
