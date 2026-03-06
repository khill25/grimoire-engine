import { btnDanger } from "./FormField";

interface Props {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export default function GraphSidePanel({ title, onClose, children }: Props) {
  return (
    <div
      style={{
        width: 380,
        flexShrink: 0,
        background: "#12122a",
        borderLeft: "1px solid #333",
        overflow: "auto",
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3 style={{ margin: 0, color: "#e0c097" }}>{title}</h3>
        <button onClick={onClose} style={{ ...btnDanger, padding: "2px 10px", fontSize: "0.8rem" }}>×</button>
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        {children}
      </div>
    </div>
  );
}
