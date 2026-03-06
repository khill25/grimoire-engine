import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { places, scenes as scenesApi, characters } from "../api/client";
import FormField, { inputStyle, textareaStyle, btnPrimary, btnDanger } from "../components/FormField";
import FieldAssist from "../components/FieldAssist";
import EntitySelect, { MultiEntitySelect } from "../components/EntitySelect";
import ExtrasEditor from "../components/ExtrasEditor";
import type { Place } from "../types/models";

const emptyPlace: Place = {
  id: "", name: "", type: "", description: "", current_state: "", connections: [],
  region: "", default_npcs: [], current_npcs: [], scenes: [], is_public: true, owner: "",
  atmosphere: "", extras: {},
};

export default function PlaceEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";
  const [place, setPlace] = useState<Place>(emptyPlace);
  const [placeScenes, setPlaceScenes] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isNew && id) {
      places.get(id).then(setPlace).catch(() => setError("Place not found"));
      scenesApi.list(id).then(setPlaceScenes);
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

  const fetchPlaces = async () => {
    const list = await places.list();
    return list.filter((p: any) => p.id !== place.id).map((p: any) => ({ id: p.id, name: p.name }));
  };

  const fetchCharacters = async () => {
    const list = await characters.list();
    return list.map((c: any) => ({ id: c.id, name: c.name }));
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
          <EntitySelect value={place.owner} onChange={(v) => update({ owner: v })} fetchItems={fetchCharacters} />
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
      <FormField label="Connections" hint="Connected places">
        <MultiEntitySelect values={place.connections} onChange={(v) => update({ connections: v })} fetchItems={fetchPlaces} />
      </FormField>
      <FormField label="Default NPCs">
        <MultiEntitySelect values={place.default_npcs} onChange={(v) => update({ default_npcs: v })} fetchItems={fetchCharacters} />
      </FormField>

      <FormField label="Custom Fields (Extras)">
        <ExtrasEditor extras={place.extras} onChange={(extras) => update({ extras })} />
      </FormField>

      {/* Scenes section */}
      {!isNew && (
        <div style={{ marginTop: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ color: "#e0c097", borderBottom: "1px solid #333", paddingBottom: 4, flex: 1 }}>Scenes</h3>
            <button
              onClick={() => navigate(`/scenes/new?place_id=${place.id}`)}
              style={{
                background: "transparent", color: "#e0c097", border: "1px dashed #555",
                padding: "0.3rem 0.8rem", borderRadius: 4, cursor: "pointer", fontSize: "0.8rem",
              }}
            >
              + Add Scene
            </button>
          </div>
          {placeScenes.length === 0 && (
            <div style={{ color: "#666", fontSize: "0.85rem" }}>No scenes yet. Add one to define sub-locations.</div>
          )}
          {placeScenes.map((s) => (
            <div
              key={s.id}
              onClick={() => navigate(`/scenes/${s.id}`)}
              style={{
                background: "#1a1a2e", border: "1px solid #333", borderRadius: 4,
                padding: "0.5rem 0.75rem", marginBottom: 4, cursor: "pointer",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
            >
              <div>
                <span style={{ color: "#e0c097" }}>{s.name || s.id}</span>
                {s.type && <span style={{ color: "#888", marginLeft: 8, fontSize: "0.8rem" }}>({s.type})</span>}
              </div>
              <span style={{ color: "#666", fontSize: "0.8rem" }}>{(s.default_npcs || []).join(", ")}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
        <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? "Saving..." : isNew ? "Create Place" : "Save Changes"}</button>
        <button onClick={() => navigate("/places")} style={btnDanger}>Cancel</button>
      </div>
    </div>
  );
}
