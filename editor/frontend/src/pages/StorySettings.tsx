import { useEffect, useState } from "react";
import { storyMeta } from "../api/client";
import FormField, { inputStyle, textareaStyle, btnPrimary } from "../components/FormField";

export default function StorySettings() {
  const [data, setData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    storyMeta.get().then(setData).catch((e) => setError(e.message));
  }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await storyMeta.update(data);
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ color: "#e0c097" }}>Story Settings</h1>
      {error && <div style={{ color: "#f88", marginBottom: "1rem" }}>{error}</div>}
      <FormField label="Name">
        <input style={inputStyle} value={data.name || ""} onChange={(e) => setData({ ...data, name: e.target.value })} />
      </FormField>
      <FormField label="Tone">
        <input style={inputStyle} value={data.tone || ""} onChange={(e) => setData({ ...data, tone: e.target.value })} />
      </FormField>
      <FormField label="Description">
        <textarea style={textareaStyle} value={data.description || ""} onChange={(e) => setData({ ...data, description: e.target.value })} />
      </FormField>
      <FormField label="Worlds" hint="Comma-separated world IDs">
        <input
          style={inputStyle}
          value={(data.worlds || []).join(", ")}
          onChange={(e) => setData({ ...data, worlds: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })}
        />
      </FormField>
      <button onClick={save} disabled={saving} style={btnPrimary}>
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
