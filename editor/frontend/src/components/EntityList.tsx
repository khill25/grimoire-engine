import { useNavigate } from "react-router-dom";

interface Column {
  key: string;
  label: string;
  width?: string;
}

interface Props {
  title: string;
  items: Record<string, any>[];
  columns: Column[];
  idKey?: string;
  basePath: string;
  onDelete?: (id: string) => void;
  onCreate?: () => void;
  onCellClick?: (item: Record<string, any>, columnKey: string) => void;
}

export default function EntityList({ title, items, columns, idKey = "id", basePath, onDelete, onCreate, onCellClick }: Props) {
  const navigate = useNavigate();

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0, color: "#e0c097" }}>{title}</h1>
        {onCreate && (
          <button onClick={onCreate} style={btnStyle}>+ New</button>
        )}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={{ ...thStyle, width: col.width }}>{col.label}</th>
            ))}
            {onDelete && <th style={{ ...thStyle, width: "80px" }}>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item[idKey]}
              onClick={() => navigate(`${basePath}/${item[idKey]}`)}
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a3e")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={tdStyle}
                  onClick={onCellClick ? (e) => {
                    if (onCellClick && item[col.key]) {
                      e.stopPropagation();
                      onCellClick(item, col.key);
                    }
                  } : undefined}
                >
                  {Array.isArray(item[col.key]) ? item[col.key].join(", ") : String(item[col.key] ?? "")}
                </td>
              ))}
              {onDelete && (
                <td style={tdStyle}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete ${item[idKey]}?`)) onDelete(item[idKey]);
                    }}
                    style={{ ...btnStyle, background: "#a33", fontSize: "0.75rem", padding: "2px 8px" }}
                  >
                    Delete
                  </button>
                </td>
              )}
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td colSpan={columns.length + 1} style={{ ...tdStyle, textAlign: "center", color: "#666" }}>No items</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.5rem",
  borderBottom: "1px solid #333",
  color: "#888",
  fontSize: "0.8rem",
  textTransform: "uppercase",
};

const tdStyle: React.CSSProperties = {
  padding: "0.5rem",
  borderBottom: "1px solid #222",
  color: "#ddd",
  fontSize: "0.9rem",
};

const btnStyle: React.CSSProperties = {
  background: "#16213e",
  color: "#e0c097",
  border: "1px solid #e0c097",
  padding: "0.4rem 1rem",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: "0.85rem",
};
