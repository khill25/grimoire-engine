import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { factions } from "../api/client";
import FormField, { inputStyle, textareaStyle, btnPrimary, btnDanger } from "../components/FormField";
import type { Faction } from "../types/models";

const emptyFaction: Faction = {
  id: "", name: "", description: "", values: [], member_ids: [], reputation_with_player: 0,
};

export default function FactionEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";
  const [faction, setFaction] = useState<Faction>(emptyFaction);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isNew && id) {
      factions.get(id).then(setFaction).catch(() => setError("Faction not found"));
    }
  }, [id, isNew]);

  const update = (patch: Partial<Faction>) => setFaction({ ...faction, ...patch });

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      if (isNew) await factions.create(faction);
      else await factions.update(id!, faction);
      navigate("/factions");
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ color: "#e0c097" }}>{isNew ? "New Faction" : `Edit: ${faction.name}`}</h1>
      {error && <div style={{ color: "#f88", marginBottom: "1rem" }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <FormField label="ID">
          <input style={inputStyle} value={faction.id} onChange={(e) => update({ id: e.target.value })} disabled={!isNew} />
        </FormField>
        <FormField label="Name">
          <input style={inputStyle} value={faction.name} onChange={(e) => update({ name: e.target.value })} />
        </FormField>
      </div>

      <FormField label="Description">
        <textarea style={textareaStyle} value={faction.description} onChange={(e) => update({ description: e.target.value })} />
      </FormField>
      <FormField label="Values" hint="One per line">
        <textarea style={{ ...textareaStyle, minHeight: 60 }} value={faction.values.join("\n")} onChange={(e) => update({ values: e.target.value.split("\n").filter(Boolean) })} />
      </FormField>
      <FormField label="Member IDs" hint="Comma-separated character IDs">
        <input style={inputStyle} value={faction.member_ids.join(", ")} onChange={(e) => update({ member_ids: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
      </FormField>
      <FormField label="Reputation with Player" hint="-1.0 to 1.0">
        <input style={inputStyle} type="number" step="0.1" min="-1" max="1" value={faction.reputation_with_player} onChange={(e) => update({ reputation_with_player: parseFloat(e.target.value) })} />
      </FormField>

      <div style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
        <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? "Saving..." : isNew ? "Create Faction" : "Save Changes"}</button>
        <button onClick={() => navigate("/factions")} style={btnDanger}>Cancel</button>
      </div>
    </div>
  );
}
