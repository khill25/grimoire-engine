import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { places } from "../api/client";
import FormField, { inputStyle, textareaStyle, btnPrimary, btnDanger } from "../components/FormField";
import FieldAssist from "../components/FieldAssist";
import type { Place } from "../types/models";

const emptyPlace: Place = {
  id: "", name: "", type: "", description: "", current_state: "", connections: [],
  region: "", default_npcs: [], current_npcs: [], is_public: true, owner: "", atmosphere: "",
};

export default function PlaceEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";
  const [place, setPlace] = useState<Place>(emptyPlace);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isNew && id) {
      places.get(id).then(setPlace).catch(() => setError("Place not found"));
    }
  }, [id, isNew]);

  const update = (patch: Partial<Place>) => setPlace({ ...place, ...patch });

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      if (isNew) await places.create(place);
      else await places.update(id!, place);
      navigate("/places");
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ color: "#e0c097" }}>{isNew ? "New Place" : `Edit: ${place.name}`}</h1>
      {error && <div style={{ color: "#f88", marginBottom: "1rem" }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <FormField label="ID">
          <input style={inputStyle} value={place.id} onChange={(e) => update({ id: e.target.value })} disabled={!isNew} />
        </FormField>
        <FormField label="Name">
          <input style={inputStyle} value={place.name} onChange={(e) => update({ name: e.target.value })} />
        </FormField>
        <FormField label="Type" hint="bar, docking_bay, residence, shop...">
          <input style={inputStyle} value={place.type} onChange={(e) => update({ type: e.target.value })} />
        </FormField>
        <FormField label="Region">
          <input style={inputStyle} value={place.region} onChange={(e) => update({ region: e.target.value })} />
        </FormField>
        <FormField label="Owner">
          <input style={inputStyle} value={place.owner} onChange={(e) => update({ owner: e.target.value })} />
        </FormField>
        <FormField label="Public">
          <label style={{ color: "#ccc" }}>
            <input type="checkbox" checked={place.is_public} onChange={(e) => update({ is_public: e.target.checked })} /> Accessible to player
          </label>
        </FormField>
      </div>

      <FormField label={<>Description <FieldAssist field="description" context={{ name: place.name, type: place.type, region: place.region }} onResult={(text) => update({ description: text })} /></>}>
        <textarea style={textareaStyle} value={place.description} onChange={(e) => update({ description: e.target.value })} />
      </FormField>
      <FormField label={<>Atmosphere <FieldAssist field="atmosphere" context={{ name: place.name, type: place.type, description: place.description.slice(0, 200) }} onResult={(text) => update({ atmosphere: text })} /></>}>
        <textarea style={{ ...textareaStyle, minHeight: 60 }} value={place.atmosphere} onChange={(e) => update({ atmosphere: e.target.value })} />
      </FormField>
      <FormField label="Current State">
        <input style={inputStyle} value={place.current_state} onChange={(e) => update({ current_state: e.target.value })} />
      </FormField>
      <FormField label="Connections" hint="Comma-separated place IDs">
        <input style={inputStyle} value={place.connections.join(", ")} onChange={(e) => update({ connections: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
      </FormField>
      <FormField label="Default NPCs" hint="Comma-separated character IDs">
        <input style={inputStyle} value={place.default_npcs.join(", ")} onChange={(e) => update({ default_npcs: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
      </FormField>

      <div style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
        <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? "Saving..." : isNew ? "Create Place" : "Save Changes"}</button>
        <button onClick={() => navigate("/places")} style={btnDanger}>Cancel</button>
      </div>
    </div>
  );
}
