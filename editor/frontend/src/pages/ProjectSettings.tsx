import { useEffect, useState } from "react";
import { projectSettings } from "../api/client";
import { useGameTypes } from "../context/GameTypesContext";
import FormField, { inputStyle, btnPrimary } from "../components/FormField";
import FolderBrowser from "../components/FolderBrowser";

interface ProjectPaths {
  world_path: string;
  story_path: string;
  game_data_path: string;
  layout: string;
}

export default function ProjectSettings() {
  const [paths, setPaths] = useState<ProjectPaths | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [browsing, setBrowsing] = useState<"world" | "game_data" | null>(null);
  const [editWorld, setEditWorld] = useState("");
  const [editGameData, setEditGameData] = useState("");
  const { reload: reloadTypes } = useGameTypes();

  const load = async () => {
    try {
      const p = await projectSettings.get();
      setPaths(p);
      setEditWorld(p.world_path);
      setEditGameData(p.game_data_path);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await projectSettings.update({
        world_path: editWorld,
        game_data_path: editGameData,
      });
      setPaths(updated);
      setEditWorld(updated.world_path);
      setEditGameData(updated.game_data_path);
      await reloadTypes();
      setSuccess("Paths updated. Reload pages to see new data.");
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  const handleBrowseSelect = (path: string) => {
    if (browsing === "world") {
      setEditWorld(path);
    } else if (browsing === "game_data") {
      setEditGameData(path);
    }
    setBrowsing(null);
  };

  if (!paths) return <div style={{ color: "#888" }}>Loading...</div>;

  const worldChanged = editWorld !== paths.world_path;
  const gameDataChanged = editGameData !== paths.game_data_path;
  const hasChanges = worldChanged || gameDataChanged;

  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ color: "#e0c097", margin: "0 0 1rem 0" }}>Project Settings</h1>
      <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: "1.5rem", lineHeight: 1.5 }}>
        Configure where the editor reads and writes data. The world path contains story content
        (characters, places, dialogue, etc). The game data path contains mechanical data
        (items, types, etc). These can point to separate directories.
      </p>

      {error && <div style={{ color: "#f88", marginBottom: "1rem", padding: "0.5rem", background: "#1a1a2e", border: "1px solid #a33", borderRadius: 4 }}>{error}</div>}
      {success && <div style={{ color: "#4a9", marginBottom: "1rem", padding: "0.5rem", background: "#1a1a2e", border: "1px solid #4a9", borderRadius: 4 }}>{success}</div>}

      <div style={sectionStyle}>
        <FormField label="World / Story Path" hint="Characters, places, dialogue, factions, story beats">
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input style={{ ...inputStyle, flex: 1 }} value={editWorld} onChange={(e) => setEditWorld(e.target.value)} />
            <button onClick={() => setBrowsing("world")} style={browseBtn}>Browse</button>
          </div>
        </FormField>
        {worldChanged && <div style={{ color: "#da4", fontSize: "0.75rem", marginTop: -8, marginBottom: 8 }}>Changed — save to apply</div>}

        <FormField label="Game Data Path" hint="Items, equipment, game types (types.yaml)">
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input style={{ ...inputStyle, flex: 1 }} value={editGameData} onChange={(e) => setEditGameData(e.target.value)} />
            <button onClick={() => setBrowsing("game_data")} style={browseBtn}>Browse</button>
          </div>
        </FormField>
        {gameDataChanged && <div style={{ color: "#da4", fontSize: "0.75rem", marginTop: -8, marginBottom: 8 }}>Changed — save to apply</div>}

        <button onClick={save} disabled={saving || !hasChanges} style={{ ...btnPrimary, opacity: hasChanges ? 1 : 0.5 }}>
          {saving ? "Saving..." : "Apply Changes"}
        </button>
      </div>

      {/* Current state info */}
      <div style={{ ...sectionStyle, marginTop: "1rem" }}>
        <h3 style={{ color: "#e0c097", margin: "0 0 0.5rem 0", fontSize: "0.95rem" }}>Current State</h3>
        <InfoRow label="Layout" value={paths.layout} />
        <InfoRow label="World Path" value={paths.world_path} />
        <InfoRow label="Story Path" value={paths.story_path} />
        <InfoRow label="Game Data Path" value={paths.game_data_path} />
      </div>

      {browsing && (
        <FolderBrowser
          initialPath={browsing === "world" ? editWorld : editGameData}
          onSelect={handleBrowseSelect}
          onCancel={() => setBrowsing(null)}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: "0.5rem", marginBottom: 4, fontSize: "0.8rem" }}>
      <span style={{ color: "#888", width: 120, flexShrink: 0 }}>{label}:</span>
      <span style={{ color: "#ddd", fontFamily: "monospace", fontSize: "0.8rem" }}>{value}</span>
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  background: "#1a1a2e",
  border: "1px solid #333",
  borderRadius: 6,
  padding: "1rem",
};

const browseBtn: React.CSSProperties = {
  background: "#16213e",
  color: "#e0c097",
  border: "1px solid #e0c097",
  padding: "0.4rem 0.8rem",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: "0.8rem",
  whiteSpace: "nowrap",
};
