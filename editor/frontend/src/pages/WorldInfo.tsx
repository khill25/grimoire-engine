import { useEffect, useState } from "react";
import { world } from "../api/client";
import FormField, { inputStyle, textareaStyle, btnPrimary } from "../components/FormField";

export default function WorldInfo() {
  const [data, setData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    world.get().then(setData);
  }, []);

  const save = async () => {
    setSaving(true);
    await world.update(data);
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ color: "#e0c097" }}>World Settings</h1>
      <FormField label="Name">
        <input style={inputStyle} value={data.name || ""} onChange={(e) => setData({ ...data, name: e.target.value })} />
      </FormField>
      <FormField label="Tone">
        <input style={inputStyle} value={data.tone || ""} onChange={(e) => setData({ ...data, tone: e.target.value })} />
      </FormField>
      <FormField label="Description">
        <textarea style={textareaStyle} value={data.description || ""} onChange={(e) => setData({ ...data, description: e.target.value })} />
      </FormField>
      <button onClick={save} disabled={saving} style={btnPrimary}>
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
