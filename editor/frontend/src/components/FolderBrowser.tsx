import { useEffect, useState } from "react";
import { projectSettings } from "../api/client";
import { inputStyle, btnPrimary } from "./FormField";

interface DirEntry {
  name: string;
  path: string;
}

interface Props {
  initialPath: string;
  onSelect: (path: string) => void;
  onCancel: () => void;
}

export default function FolderBrowser({ initialPath, onSelect, onCancel }: Props) {
  const [currentPath, setCurrentPath] = useState(initialPath || "~");
  const [dirs, setDirs] = useState<DirEntry[]>([]);
  const [parent, setParent] = useState<string | null>(null);
  const [exists, setExists] = useState(true);
  const [manualPath, setManualPath] = useState(initialPath || "~");

  const browse = async (path: string) => {
    try {
      const result = await projectSettings.browse(path);
      setCurrentPath(result.path);
      setManualPath(result.path);
      setDirs(result.dirs);
      setParent(result.parent);
      setExists(result.exists);
    } catch {
      setExists(false);
    }
  };

  useEffect(() => { browse(initialPath || "~"); }, [initialPath]);

  const handleManualNav = () => {
    browse(manualPath);
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h3 style={{ color: "#e0c097", margin: "0 0 1rem 0" }}>Select Folder</h3>

        {/* Path input */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={manualPath}
            onChange={(e) => setManualPath(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualNav()}
            placeholder="Type a path..."
          />
          <button onClick={handleManualNav} style={{ ...btnPrimary, padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}>Go</button>
        </div>

        {/* Current location */}
        <div style={{ color: "#888", fontSize: "0.75rem", marginBottom: "0.5rem" }}>
          {currentPath}
          {!exists && <span style={{ color: "#a33", marginLeft: 8 }}>(will be created)</span>}
        </div>

        {/* Directory listing */}
        <div style={{ maxHeight: 300, overflow: "auto", border: "1px solid #333", borderRadius: 4, marginBottom: "1rem" }}>
          {parent && (
            <div onClick={() => browse(parent)} style={dirEntryStyle}>
              <span style={{ color: "#888" }}>..</span>
            </div>
          )}
          {dirs.map((dir) => (
            <div key={dir.path} onClick={() => browse(dir.path)} style={dirEntryStyle}>
              <span style={{ color: "#e0c097", marginRight: 6 }}>📁</span>
              {dir.name}
            </div>
          ))}
          {dirs.length === 0 && exists && (
            <div style={{ ...dirEntryStyle, color: "#666", cursor: "default" }}>Empty directory</div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ ...btnPrimary, borderColor: "#666", color: "#ccc" }}>Cancel</button>
          <button onClick={() => onSelect(currentPath)} style={btnPrimary}>Select This Folder</button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0,0,0,0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  background: "#0f0f23",
  border: "1px solid #333",
  borderRadius: 8,
  padding: "1.5rem",
  width: 500,
  maxWidth: "90vw",
};

const dirEntryStyle: React.CSSProperties = {
  padding: "0.4rem 0.75rem",
  cursor: "pointer",
  fontSize: "0.85rem",
  color: "#ddd",
  borderBottom: "1px solid #222",
};
