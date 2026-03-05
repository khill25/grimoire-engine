import { useEffect, useState } from "react";
import { story, generate } from "../api/client";
import FormField, { inputStyle, textareaStyle, selectStyle, btnPrimary } from "../components/FormField";
import GenerateModal from "../components/GenerateModal";

interface Beat {
  id: string;
  name: string;
  description?: string;
  trigger?: { type?: string; condition?: string };
  status?: string;
  deadline?: number;
  allow_off_rails?: boolean;
  act_id?: string;
  act_name?: string;
}

export default function StoryBeats() {
  const [beats, setBeats] = useState<Beat[]>([]);
  const [selected, setSelected] = useState<Beat | null>(null);
  const [saving, setSaving] = useState(false);
  const [bible, setBible] = useState<any>(null);
  const [showGenerate, setShowGenerate] = useState(false);

  useEffect(() => {
    story.listBeats().then(setBeats);
    story.get().then(setBible);
  }, []);

  const saveBeat = async () => {
    if (!selected) return;
    setSaving(true);
    await story.updateBeat(selected.id, selected);
    const updated = await story.listBeats();
    setBeats(updated);
    setSaving(false);
  };

  const grouped = beats.reduce<Record<string, Beat[]>>((acc, beat) => {
    const act = beat.act_name || beat.act_id || "Unknown Act";
    (acc[act] = acc[act] || []).push(beat);
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", gap: "1rem", height: "calc(100vh - 3rem)" }}>
      {/* Beat list */}
      <div style={{ width: 280, flexShrink: 0, overflow: "auto" }}>
        <h2 style={{ color: "#e0c097" }}>Story Beats</h2>
        {bible && (
          <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: "1rem" }}>
            {bible.title || "Untitled Story"}
          </div>
        )}
        {Object.entries(grouped).map(([actName, actBeats]) => (
          <div key={actName} style={{ marginBottom: "1rem" }}>
            <div style={{ color: "#e0c097", fontSize: "0.8rem", textTransform: "uppercase", padding: "0.25rem 0", borderBottom: "1px solid #333" }}>
              {actName}
            </div>
            {actBeats.map((beat) => (
              <div
                key={beat.id}
                onClick={() => setSelected({ ...beat })}
                style={{
                  padding: "0.4rem 0.6rem",
                  background: selected?.id === beat.id ? "#16213e" : "transparent",
                  borderLeft: selected?.id === beat.id ? "3px solid #e0c097" : "3px solid transparent",
                  color: "#ccc",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{beat.name || beat.id}</span>
                <span style={{ color: statusColor(beat.status), fontSize: "0.75rem" }}>{beat.status}</span>
              </div>
            ))}
          </div>
        ))}
        {beats.length === 0 && <div style={{ color: "#666" }}>No story beats defined</div>}
        <button
          onClick={() => setShowGenerate(true)}
          style={{ marginTop: "1rem", width: "100%", background: "#2a1a3e", color: "#c097e0", border: "1px solid #c097e0", padding: "0.4rem", borderRadius: 4, cursor: "pointer", fontSize: "0.8rem" }}
        >
          Generate Beats with AI
        </button>
        {showGenerate && (
          <GenerateModal
            title="Generate Story Beats"
            placeholder="e.g. Generate Act 2 beats where the player discovers the corporation is planning to automate the docks, leading to a choice between siding with the union or the corp."
            onGenerate={async (prompt, provider) => {
              const res = await generate.storyBeats(prompt, provider);
              // Add generated beats to the story bible
              const currentBible = await story.get();
              const lastAct = currentBible.acts?.[currentBible.acts.length - 1];
              if (lastAct) {
                lastAct.beats = [...(lastAct.beats || []), ...res.generated];
                await story.update(currentBible);
              }
              const updated = await story.listBeats();
              setBeats(updated);
            }}
            onClose={() => setShowGenerate(false)}
          />
        )}
      </div>

      {/* Beat editor */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {selected ? (
          <div style={{ maxWidth: 600 }}>
            <h2 style={{ color: "#e0c097" }}>Beat: {selected.name || selected.id}</h2>
            <FormField label="ID">
              <input style={inputStyle} value={selected.id} disabled />
            </FormField>
            <FormField label="Name">
              <input style={inputStyle} value={selected.name || ""} onChange={(e) => setSelected({ ...selected, name: e.target.value })} />
            </FormField>
            <FormField label="Description">
              <textarea style={textareaStyle} value={selected.description || ""} onChange={(e) => setSelected({ ...selected, description: e.target.value })} />
            </FormField>
            <FormField label="Status">
              <select style={selectStyle} value={selected.status || "pending"} onChange={(e) => setSelected({ ...selected, status: e.target.value })}>
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </FormField>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <FormField label="Trigger Type">
                <input style={inputStyle} value={selected.trigger?.type || ""} onChange={(e) => setSelected({ ...selected, trigger: { ...selected.trigger, type: e.target.value } })} />
              </FormField>
              <FormField label="Trigger Condition">
                <input style={inputStyle} value={selected.trigger?.condition || ""} onChange={(e) => setSelected({ ...selected, trigger: { ...selected.trigger, condition: e.target.value } })} />
              </FormField>
            </div>
            <FormField label="Deadline (ticks)">
              <input style={inputStyle} type="number" value={selected.deadline || ""} onChange={(e) => setSelected({ ...selected, deadline: parseInt(e.target.value) || undefined })} />
            </FormField>
            <label style={{ color: "#ccc", fontSize: "0.85rem" }}>
              <input type="checkbox" checked={selected.allow_off_rails || false} onChange={(e) => setSelected({ ...selected, allow_off_rails: e.target.checked })} /> Allow Off-Rails (LLM can alter story here)
            </label>
            <div style={{ marginTop: "1.5rem" }}>
              <button onClick={saveBeat} disabled={saving} style={btnPrimary}>{saving ? "Saving..." : "Save Beat"}</button>
            </div>
          </div>
        ) : (
          <div style={{ color: "#666", marginTop: "2rem" }}>Select a beat to edit</div>
        )}
      </div>
    </div>
  );
}

function statusColor(status?: string): string {
  switch (status) {
    case "active": return "#4a9";
    case "completed": return "#49a";
    case "failed": return "#a44";
    default: return "#666";
  }
}
