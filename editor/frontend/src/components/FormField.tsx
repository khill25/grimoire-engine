interface Props {
  label: React.ReactNode;
  children: React.ReactNode;
  hint?: string;
}

export default function FormField({ label, children, hint }: Props) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <label style={{ display: "block", color: "#e0c097", fontSize: "0.8rem", marginBottom: 4, textTransform: "uppercase" }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize: "0.75rem", color: "#666", marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem",
  background: "#1a1a2e",
  border: "1px solid #333",
  borderRadius: 4,
  color: "#ddd",
  fontSize: "0.9rem",
  boxSizing: "border-box",
};

export const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 100,
  resize: "vertical",
  fontFamily: "inherit",
};

export const selectStyle: React.CSSProperties = {
  ...inputStyle,
};

export const btnPrimary: React.CSSProperties = {
  background: "#16213e",
  color: "#e0c097",
  border: "1px solid #e0c097",
  padding: "0.5rem 1.5rem",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: "0.9rem",
};

export const btnDanger: React.CSSProperties = {
  ...btnPrimary,
  borderColor: "#a33",
  color: "#f88",
};
