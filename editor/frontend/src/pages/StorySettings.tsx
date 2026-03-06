import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { storyMeta, story, characters, places, scenes, factions, dialogue, generate } from "../api/client";
import FormField, { inputStyle, textareaStyle, selectStyle, btnPrimary, btnDanger } from "../components/FormField";
import ExtrasEditor from "../components/ExtrasEditor";
import GenerateModal from "../components/GenerateModal";

interface Act {
  id: string;
  name: string;
  description: string;
  beats: Beat[];
}

interface Beat {
  id: string;
  name: string;
  description: string;
  status: string;
  trigger: { type?: string; condition?: string };
  deadline?: number;
  allow_off_rails?: boolean;
}

interface Counts {
  places: number;
  scenes: number;
  characters: number;
  factions: number;
  dialogue: number;
}

export default function StorySettings() {
  const navigate = useNavigate();
  const [meta, setMeta] = useState<Record<string, any>>({});
  const [grimoire, setGrimoire] = useState<Record<string, any>>({});
  const [acts, setActs] = useState<Act[]>([]);
  const [counts, setCounts] = useState<Counts>({ places: 0, scenes: 0, characters: 0, factions: 0, dialogue: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedAct, setExpandedAct] = useState<string | null>(null);
  const [editingBeat, setEditingBeat] = useState<Beat | null>(null);
  const [editingAct, setEditingAct] = useState<Act | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, b, p, s, c, f, d] = await Promise.all([
        storyMeta.get().catch(() => ({})),
        story.get().catch(() => ({ title: "", description: "", acts: [] })),
        places.list().catch(() => []),
        scenes.list().catch(() => []),
        characters.list().catch(() => []),
        factions.list().catch(() => []),
        dialogue.list().catch(() => []),
      ]);
      setMeta(m);
      setGrimoire(b);
      setActs(b.acts || []);
      setCounts({ places: p.length, scenes: s.length, characters: c.length, factions: f.length, dialogue: d.length });
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveMeta = async () => {
    setSaving(true);
    setError("");
    try {
      await storyMeta.update(meta);
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  const saveGrimoire = async () => {
    setSaving(true);
    setError("");
    try {
      await story.update({ ...grimoire, acts });
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  // Act operations
  const addAct = async () => {
    try {
      const newAct = await story.createAct({ id: "", name: "New Act", description: "" });
      setActs((prev) => [...prev, newAct]);
      setExpandedAct(newAct.id);
      setEditingAct(newAct);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const saveAct = async (act: Act) => {
    try {
      await story.updateAct(act.id, { id: act.id, name: act.name, description: act.description });
      setActs((prev) => prev.map((a) => a.id === act.id ? { ...a, name: act.name, description: act.description } : a));
      setEditingAct(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const deleteAct = async (actId: string) => {
    if (!confirm(`Delete act "${actId}" and all its beats?`)) return;
    try {
      await story.deleteAct(actId);
      setActs((prev) => prev.filter((a) => a.id !== actId));
      if (expandedAct === actId) setExpandedAct(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Beat operations
  const addBeat = async (actId: string) => {
    try {
      const newBeat = await story.createBeat(actId, { id: "", name: "New Beat", description: "" });
      setActs((prev) => prev.map((a) =>
        a.id === actId ? { ...a, beats: [...(a.beats || []), newBeat] } : a
      ));
      setEditingBeat(newBeat);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const saveBeat = async (beat: Beat) => {
    try {
      await story.updateBeat(beat.id, beat);
      setActs((prev) => prev.map((a) => ({
        ...a,
        beats: (a.beats || []).map((b) => b.id === beat.id ? beat : b),
      })));
      setEditingBeat(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const deleteBeat = async (beatId: string) => {
    if (!confirm(`Delete beat "${beatId}"?`)) return;
    try {
      await story.deleteBeat(beatId);
      setActs((prev) => prev.map((a) => ({
        ...a,
        beats: (a.beats || []).filter((b) => b.id !== beatId),
      })));
      if (editingBeat?.id === beatId) setEditingBeat(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const totalBeats = acts.reduce((n, a) => n + (a.beats?.length || 0), 0);

  return (
    <div style={{ display: "flex", gap: "1.5rem", height: "calc(100vh - 3rem)" }}>
      {/* Left column: story meta + grimoire + acts */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <h1 style={{ color: "#e0c097", margin: "0 0 1rem 0" }}>Story</h1>
        {error && <div style={{ color: "#f88", marginBottom: "1rem" }}>{error}</div>}

        {/* Overview cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.5rem", marginBottom: "1.5rem" }}>
          {([
            ["Places", counts.places, "/places"],
            ["Scenes", counts.scenes, "/scenes"],
            ["Characters", counts.characters, "/characters"],
            ["Factions", counts.factions, "/factions"],
            ["Dialogue", counts.dialogue, "/dialogue"],
          ] as [string, number, string][]).map(([label, count, path]) => (
            <div
              key={label}
              onClick={() => navigate(path)}
              style={{
                background: "#1a1a2e", border: "1px solid #333", borderRadius: 6,
                padding: "0.6rem 0.8rem", cursor: "pointer",
              }}
            >
              <div style={{ color: "#e0c097", fontSize: "1.2rem", fontWeight: 600 }}>{count}</div>
              <div style={{ color: "#888", fontSize: "0.75rem", textTransform: "uppercase" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Story metadata */}
        <Section title="Story Metadata">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <FormField label="Name">
              <input style={inputStyle} value={meta.name || ""} onChange={(e) => setMeta({ ...meta, name: e.target.value })} />
            </FormField>
            <FormField label="Tone">
              <input style={inputStyle} value={meta.tone || ""} onChange={(e) => setMeta({ ...meta, tone: e.target.value })} />
            </FormField>
          </div>
          <FormField label="Description">
            <textarea style={{ ...textareaStyle, minHeight: 60 }} value={meta.description || ""} onChange={(e) => setMeta({ ...meta, description: e.target.value })} />
          </FormField>
          <FormField label="Worlds" hint="Comma-separated world IDs">
            <input style={inputStyle} value={(meta.worlds || []).join(", ")} onChange={(e) => setMeta({ ...meta, worlds: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })} />
          </FormField>
          {meta.extras !== undefined && (
            <ExtrasEditor extras={meta.extras || {}} onChange={(extras) => setMeta({ ...meta, extras })} />
          )}
          <button onClick={saveMeta} disabled={saving} style={btnPrimary}>
            {saving ? "Saving..." : "Save Metadata"}
          </button>
        </Section>

        {/* Grimoire */}
        <Section title="Grimoire">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <FormField label="Title">
              <input style={inputStyle} value={grimoire.title || ""} onChange={(e) => setGrimoire({ ...grimoire, title: e.target.value })} />
            </FormField>
            <FormField label="Summary">
              <div style={{ color: "#888", fontSize: "0.8rem", marginTop: 8 }}>
                {acts.length} act{acts.length !== 1 ? "s" : ""}, {totalBeats} beat{totalBeats !== 1 ? "s" : ""}
              </div>
            </FormField>
          </div>
          <FormField label="Description">
            <textarea style={{ ...textareaStyle, minHeight: 60 }} value={grimoire.description || ""} onChange={(e) => setGrimoire({ ...grimoire, description: e.target.value })} />
          </FormField>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={saveGrimoire} disabled={saving} style={btnPrimary}>
              {saving ? "Saving..." : "Save Grimoire"}
            </button>
          </div>
        </Section>

        {/* Acts & Beats */}
        <div style={{ marginTop: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h2 style={{ color: "#e0c097", margin: 0, fontSize: "1.1rem" }}>Acts & Beats</h2>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={() => setShowGenerate(true)} style={generateBtn}>Generate with AI</button>
              <button onClick={addAct} style={{ ...btnPrimary, fontSize: "0.8rem", padding: "0.3rem 0.8rem" }}>+ Add Act</button>
            </div>
          </div>

          {acts.length === 0 && (
            <div style={{ color: "#666", padding: "2rem", textAlign: "center", border: "1px dashed #333", borderRadius: 6 }}>
              No acts defined. Add an act to start structuring your story.
            </div>
          )}

          {acts.map((act) => (
            <div key={act.id} style={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 6, marginBottom: "0.75rem" }}>
              {/* Act header */}
              <div
                onClick={() => setExpandedAct(expandedAct === act.id ? null : act.id)}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "0.6rem 0.8rem", cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ color: "#666", fontSize: "0.8rem" }}>{expandedAct === act.id ? "v" : ">"}</span>
                  <span style={{ color: "#e0c097", fontWeight: 600, fontSize: "0.9rem" }}>{act.name}</span>
                  <span style={{ color: "#666", fontSize: "0.75rem" }}>({act.id})</span>
                  <span style={{ color: "#888", fontSize: "0.75rem" }}>
                    {(act.beats?.length || 0)} beat{(act.beats?.length || 0) !== 1 ? "s" : ""}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "0.3rem" }} onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setEditingAct({ ...act })} style={smallBtn}>Edit</button>
                  <button onClick={() => deleteAct(act.id)} style={{ ...smallBtn, color: "#a33", borderColor: "#a33" }}>Delete</button>
                </div>
              </div>

              {act.description && expandedAct !== act.id && (
                <div style={{ padding: "0 0.8rem 0.5rem", color: "#888", fontSize: "0.8rem" }}>
                  {act.description.slice(0, 120)}{act.description.length > 120 ? "..." : ""}
                </div>
              )}

              {/* Expanded: show beats */}
              {expandedAct === act.id && (
                <div style={{ padding: "0 0.8rem 0.8rem", borderTop: "1px solid #333" }}>
                  {act.description && (
                    <div style={{ color: "#aaa", fontSize: "0.8rem", padding: "0.5rem 0", lineHeight: 1.4 }}>
                      {act.description}
                    </div>
                  )}

                  {(act.beats || []).length === 0 && (
                    <div style={{ color: "#666", fontSize: "0.8rem", padding: "0.5rem 0" }}>No beats in this act.</div>
                  )}

                  {(act.beats || []).map((beat) => (
                    <div
                      key={beat.id}
                      onClick={() => setEditingBeat({ ...beat })}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "0.4rem 0.5rem", marginTop: 4, borderRadius: 4, cursor: "pointer",
                        background: editingBeat?.id === beat.id ? "#16213e" : "#0f0f23",
                        border: editingBeat?.id === beat.id ? "1px solid #e0c097" : "1px solid #222",
                      }}
                    >
                      <div>
                        <span style={{ color: "#ccc", fontSize: "0.85rem" }}>{beat.name || beat.id}</span>
                        {beat.description && (
                          <span style={{ color: "#666", fontSize: "0.75rem", marginLeft: 8 }}>
                            {beat.description.slice(0, 60)}{beat.description.length > 60 ? "..." : ""}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ color: statusColor(beat.status), fontSize: "0.7rem", textTransform: "uppercase" }}>
                          {beat.status || "pending"}
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); deleteBeat(beat.id); }} style={{ ...smallBtn, color: "#a33", borderColor: "#a33", fontSize: "0.65rem", padding: "1px 5px" }}>X</button>
                      </div>
                    </div>
                  ))}

                  <button onClick={() => addBeat(act.id)} style={addBeatBtn}>+ Add Beat</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {showGenerate && (
          <GenerateModal
            title="Generate Story Beats"
            placeholder="e.g. Generate Act 2 beats where the player discovers the corporation is planning to automate the docks, leading to a choice between siding with the union or the corp."
            onGenerate={async (prompt, provider) => {
              const res = await generate.storyBeats(prompt, provider);
              const currentGrimoire = await story.get();
              const lastAct = currentGrimoire.acts?.[currentGrimoire.acts.length - 1];
              if (lastAct) {
                lastAct.beats = [...(lastAct.beats || []), ...res.generated];
                await story.update(currentGrimoire);
              }
              await load();
            }}
            onClose={() => setShowGenerate(false)}
          />
        )}
      </div>

      {/* Right panel: beat/act editor */}
      <div style={{ width: 340, flexShrink: 0, overflow: "auto" }}>
        {editingAct && (
          <div style={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 6, padding: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3 style={{ color: "#e0c097", margin: 0, fontSize: "0.95rem" }}>Edit Act</h3>
              <button onClick={() => setEditingAct(null)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer" }}>X</button>
            </div>
            <FormField label="ID">
              <input style={inputStyle} value={editingAct.id} disabled />
            </FormField>
            <FormField label="Name">
              <input style={inputStyle} value={editingAct.name} onChange={(e) => setEditingAct({ ...editingAct, name: e.target.value })} />
            </FormField>
            <FormField label="Description">
              <textarea style={{ ...textareaStyle, minHeight: 80 }} value={editingAct.description} onChange={(e) => setEditingAct({ ...editingAct, description: e.target.value })} />
            </FormField>
            <button onClick={() => saveAct(editingAct)} disabled={saving} style={{ ...btnPrimary, width: "100%" }}>
              {saving ? "Saving..." : "Save Act"}
            </button>
          </div>
        )}

        {editingBeat && (
          <div style={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 6, padding: "1rem", marginTop: editingAct ? "0.75rem" : 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3 style={{ color: "#e0c097", margin: 0, fontSize: "0.95rem" }}>Edit Beat</h3>
              <button onClick={() => setEditingBeat(null)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer" }}>X</button>
            </div>
            <FormField label="ID">
              <input style={inputStyle} value={editingBeat.id} disabled />
            </FormField>
            <FormField label="Name">
              <input style={inputStyle} value={editingBeat.name || ""} onChange={(e) => setEditingBeat({ ...editingBeat, name: e.target.value })} />
            </FormField>
            <FormField label="Description">
              <textarea style={{ ...textareaStyle, minHeight: 80 }} value={editingBeat.description || ""} onChange={(e) => setEditingBeat({ ...editingBeat, description: e.target.value })} />
            </FormField>
            <FormField label="Status">
              <select style={selectStyle} value={editingBeat.status || "pending"} onChange={(e) => setEditingBeat({ ...editingBeat, status: e.target.value })}>
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </FormField>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <FormField label="Trigger Type">
                <input style={inputStyle} value={editingBeat.trigger?.type || ""} onChange={(e) => setEditingBeat({ ...editingBeat, trigger: { ...editingBeat.trigger, type: e.target.value } })} />
              </FormField>
              <FormField label="Trigger Condition">
                <input style={inputStyle} value={editingBeat.trigger?.condition || ""} onChange={(e) => setEditingBeat({ ...editingBeat, trigger: { ...editingBeat.trigger, condition: e.target.value } })} />
              </FormField>
            </div>
            <FormField label="Deadline (ticks)">
              <input style={inputStyle} type="number" value={editingBeat.deadline ?? ""} onChange={(e) => setEditingBeat({ ...editingBeat, deadline: e.target.value ? parseInt(e.target.value) : undefined })} />
            </FormField>
            <label style={{ color: "#ccc", fontSize: "0.85rem", display: "block", marginBottom: "1rem" }}>
              <input type="checkbox" checked={editingBeat.allow_off_rails || false} onChange={(e) => setEditingBeat({ ...editingBeat, allow_off_rails: e.target.checked })} />{" "}
              Allow Off-Rails
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={() => saveBeat(editingBeat)} disabled={saving} style={{ ...btnPrimary, flex: 1 }}>
                {saving ? "Saving..." : "Save Beat"}
              </button>
              <button onClick={() => deleteBeat(editingBeat.id)} style={{ ...btnDanger, flex: 0 }}>Delete</button>
            </div>
          </div>
        )}

        {!editingAct && !editingBeat && (
          <div style={{ color: "#666", marginTop: "2rem", textAlign: "center", fontSize: "0.85rem" }}>
            Click an act or beat to edit it here.
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 6, padding: "1rem", marginBottom: "1rem" }}>
      <h2 style={{ color: "#e0c097", margin: "0 0 0.75rem 0", fontSize: "1rem" }}>{title}</h2>
      {children}
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

const smallBtn: React.CSSProperties = {
  background: "transparent",
  color: "#97b8e0",
  border: "1px solid #444",
  borderRadius: 3,
  cursor: "pointer",
  fontSize: "0.7rem",
  padding: "2px 6px",
};

const addBeatBtn: React.CSSProperties = {
  background: "transparent",
  color: "#e0c097",
  border: "1px dashed #555",
  padding: "0.3rem 0.8rem",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: "0.8rem",
  width: "100%",
  marginTop: 8,
};

const generateBtn: React.CSSProperties = {
  background: "#2a1a3e",
  color: "#c097e0",
  border: "1px solid #c097e0",
  padding: "0.3rem 0.8rem",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: "0.8rem",
};
