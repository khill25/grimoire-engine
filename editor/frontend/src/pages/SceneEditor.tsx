import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { scenes, places, characters } from "../api/client";
import FormField, { inputStyle, textareaStyle, btnPrimary, btnDanger } from "../components/FormField";
import FieldAssist from "../components/FieldAssist";
import EntitySelect, { MultiEntitySelect } from "../components/EntitySelect";
import ExtrasEditor from "../components/ExtrasEditor";
import type { Scene } from "../types/models";

const emptyScene: Scene = {
  id: "", name: "", place_id: "", type: "", description: "", current_state: "",
  default_npcs: [], current_npcs: [], connections: [], atmosphere: "",
  is_public: true, owner: "", extras: {},
};

export default function SceneEditor() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = id === "new";
  const [scene, setScene] = useState<Scene>({
    ...emptyScene,
    place_id: searchParams.get("place_id") || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isNew && id) {
      scenes.get(id).then(setScene).catch(() => setError("Scene not found"));
    }
  }, [id, isNew]);

  const update = (patch: Partial<Scene>) => setScene({ ...scene, ...patch });

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      if (isNew) await scenes.create(scene);
      else await scenes.update(id!, scene);
      navigate(scene.place_id ? `/places/${scene.place_id}` : "/scenes");
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  };

  const fetchPlaces = async () => {
    const list = await places.list();
    return list.map((p: any) => ({ id: p.id, name: p.name }));
  };

  const fetchCharacters = async () => {
    const list = await characters.list();
    return list.map((c: any) => ({ id: c.id, name: c.name }));
  };

  const fetchScenes = async () => {
    const list = await scenes.list(scene.place_id || undefined);
    return list.filter((s: any) => s.id !== scene.id).map((s: any) => ({ id: s.id, name: s.name }));
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ color: "#e0c097" }}>{isNew ? "New Scene" : `Edit: ${scene.name}`}</h1>
      {error && <div style={{ color: "#f88", marginBottom: "1rem" }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <FormField label="ID">
          <input style={inputStyle} value={scene.id} onChange={(e) => update({ id: e.target.value })} disabled={!isNew} />
        </FormField>
        <FormField label="Name">
          <input style={inputStyle} value={scene.name} onChange={(e) => update({ name: e.target.value })} />
        </FormField>
        <FormField label="Place">
          <EntitySelect value={scene.place_id} onChange={(v) => update({ place_id: v })} fetchItems={fetchPlaces} allowEmpty={false} />
        </FormField>
        <FormField label="Type" hint="work_area, bar_floor, living_space...">
          <input style={inputStyle} value={scene.type} onChange={(e) => update({ type: e.target.value })} />
        </FormField>
        <FormField label="Owner">
          <EntitySelect value={scene.owner} onChange={(v) => update({ owner: v })} fetchItems={fetchCharacters} />
        </FormField>
        <FormField label="Public">
          <label style={{ color: "#ccc" }}>
            <input type="checkbox" checked={scene.is_public} onChange={(e) => update({ is_public: e.target.checked })} /> Accessible
          </label>
        </FormField>
      </div>

      <FormField label={<>Description <FieldAssist field="description" context={{ name: scene.name, type: scene.type, place_id: scene.place_id }} onResult={(text) => update({ description: text })} /></>}>
        <textarea style={textareaStyle} value={scene.description} onChange={(e) => update({ description: e.target.value })} />
      </FormField>
      <FormField label={<>Atmosphere <FieldAssist field="atmosphere" context={{ name: scene.name, type: scene.type, description: scene.description.slice(0, 200) }} onResult={(text) => update({ atmosphere: text })} /></>}>
        <textarea style={{ ...textareaStyle, minHeight: 60 }} value={scene.atmosphere} onChange={(e) => update({ atmosphere: e.target.value })} />
      </FormField>
      <FormField label="Current State">
        <input style={inputStyle} value={scene.current_state} onChange={(e) => update({ current_state: e.target.value })} />
      </FormField>
      <FormField label="Default NPCs">
        <MultiEntitySelect values={scene.default_npcs} onChange={(v) => update({ default_npcs: v })} fetchItems={fetchCharacters} />
      </FormField>
      <FormField label="Scene Connections" hint="Sibling scenes within the same place">
        <MultiEntitySelect values={scene.connections} onChange={(v) => update({ connections: v })} fetchItems={fetchScenes} />
      </FormField>

      <FormField label="Custom Fields (Extras)">
        <ExtrasEditor extras={scene.extras} onChange={(extras) => update({ extras })} />
      </FormField>

      <div style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
        <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? "Saving..." : isNew ? "Create Scene" : "Save Changes"}</button>
        <button onClick={() => navigate(-1)} style={btnDanger}>Cancel</button>
      </div>
    </div>
  );
}
