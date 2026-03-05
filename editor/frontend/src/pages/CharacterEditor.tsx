import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { characters } from "../api/client";
import FormField, { inputStyle, textareaStyle, selectStyle, btnPrimary, btnDanger } from "../components/FormField";
import FieldAssist from "../components/FieldAssist";
import type { Character, Goal, Relationship, ScheduleEntry, Affinity } from "../types/models";

const emptyCharacter: Character = {
  id: "", name: "", age: 25, status: "alive", backstory: "", personality: "",
  speech_style: "", motivations: [], goals: [], wants: [], affinities: [],
  occupation: "", location: "", schedule: [], relationships: [], faction_ids: [],
  protection: { level: "none", reason: "", fallback: "" },
};

export default function CharacterEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";
  const [char, setChar] = useState<Character>(emptyCharacter);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isNew && id) {
      characters.get(id).then(setChar).catch(() => setError("Character not found"));
    }
  }, [id, isNew]);

  const update = (patch: Partial<Character>) => setChar({ ...char, ...patch });

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      if (isNew) {
        await characters.create(char);
      } else {
        await characters.update(id!, char);
      }
      navigate("/characters");
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ color: "#e0c097", margin: 0 }}>{isNew ? "New Character" : `Edit: ${char.name}`}</h1>
        <button onClick={() => navigate("/characters")} style={btnDanger}>Cancel</button>
      </div>

      {error && <div style={{ color: "#f88", marginBottom: "1rem" }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <FormField label="ID" hint="Unique identifier, used in YAML filenames">
          <input style={inputStyle} value={char.id} onChange={(e) => update({ id: e.target.value })} disabled={!isNew} />
        </FormField>
        <FormField label="Name">
          <input style={inputStyle} value={char.name} onChange={(e) => update({ name: e.target.value })} />
        </FormField>
        <FormField label="Age">
          <input style={inputStyle} type="number" value={char.age} onChange={(e) => update({ age: parseInt(e.target.value) || 0 })} />
        </FormField>
        <FormField label="Status">
          <select style={selectStyle} value={char.status} onChange={(e) => update({ status: e.target.value as Character["status"] })}>
            <option value="alive">Alive</option>
            <option value="dead">Dead</option>
            <option value="missing">Missing</option>
            <option value="unknown">Unknown</option>
          </select>
        </FormField>
        <FormField label="Occupation">
          <input style={inputStyle} value={char.occupation} onChange={(e) => update({ occupation: e.target.value })} />
        </FormField>
        <FormField label="Location">
          <input style={inputStyle} value={char.location} onChange={(e) => update({ location: e.target.value })} />
        </FormField>
      </div>

      <FormField label={<>Backstory <FieldAssist field="backstory" context={{ name: char.name, occupation: char.occupation, age: char.age, motivations: char.motivations.join(", ") }} onResult={(text) => update({ backstory: text })} /></>}>
        <textarea style={textareaStyle} value={char.backstory} onChange={(e) => update({ backstory: e.target.value })} />
      </FormField>
      <FormField label={<>Personality <FieldAssist field="personality" context={{ name: char.name, occupation: char.occupation, backstory: char.backstory.slice(0, 200) }} onResult={(text) => update({ personality: text })} /></>}>
        <textarea style={textareaStyle} value={char.personality} onChange={(e) => update({ personality: e.target.value })} />
      </FormField>
      <FormField label={<>Speech Style <FieldAssist field="speech_style" context={{ name: char.name, personality: char.personality.slice(0, 200), occupation: char.occupation }} onResult={(text) => update({ speech_style: text })} /></>}>
        <input style={inputStyle} value={char.speech_style} onChange={(e) => update({ speech_style: e.target.value })} />
      </FormField>

      <FormField label="Motivations" hint="One per line">
        <textarea
          style={{ ...textareaStyle, minHeight: 60 }}
          value={char.motivations.join("\n")}
          onChange={(e) => update({ motivations: e.target.value.split("\n").filter(Boolean) })}
        />
      </FormField>
      <FormField label="Wants" hint="One per line">
        <textarea
          style={{ ...textareaStyle, minHeight: 60 }}
          value={char.wants.join("\n")}
          onChange={(e) => update({ wants: e.target.value.split("\n").filter(Boolean) })}
        />
      </FormField>
      <FormField label="Faction IDs" hint="Comma-separated">
        <input
          style={inputStyle}
          value={char.faction_ids.join(", ")}
          onChange={(e) => update({ faction_ids: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
        />
      </FormField>

      {/* Goals */}
      <Section title="Goals">
        {char.goals.map((goal, i) => (
          <div key={i} style={cardStyle}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <input style={inputStyle} placeholder="ID" value={goal.id} onChange={(e) => updateGoal(i, { id: e.target.value })} />
              <select style={selectStyle} value={goal.status} onChange={(e) => updateGoal(i, { status: e.target.value as Goal["status"] })}>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="abandoned">Abandoned</option>
              </select>
            </div>
            <input style={{ ...inputStyle, marginTop: 4 }} placeholder="Description" value={goal.description} onChange={(e) => updateGoal(i, { description: e.target.value })} />
            <input style={{ ...inputStyle, marginTop: 4 }} placeholder="Motivation" value={goal.motivation} onChange={(e) => updateGoal(i, { motivation: e.target.value })} />
            <button style={removeBtnStyle} onClick={() => update({ goals: char.goals.filter((_, j) => j !== i) })}>Remove</button>
          </div>
        ))}
        <button style={addBtnStyle} onClick={() => update({ goals: [...char.goals, { id: "", description: "", motivation: "", status: "active", progress: "" }] })}>+ Add Goal</button>
      </Section>

      {/* Relationships */}
      <Section title="Relationships">
        {char.relationships.map((rel, i) => (
          <div key={i} style={cardStyle}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <input style={inputStyle} placeholder="Target ID" value={rel.target_id} onChange={(e) => updateRel(i, { target_id: e.target.value })} />
              <input style={inputStyle} placeholder="Types (comma-sep)" value={rel.types.join(", ")} onChange={(e) => updateRel(i, { types: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginTop: 4 }}>
              <FormField label="Trust"><input style={inputStyle} type="number" step="0.1" min="-1" max="1" value={rel.trust} onChange={(e) => updateRel(i, { trust: parseFloat(e.target.value) })} /></FormField>
              <FormField label="Familiarity"><input style={inputStyle} type="number" step="0.1" min="0" max="1" value={rel.familiarity} onChange={(e) => updateRel(i, { familiarity: parseFloat(e.target.value) })} /></FormField>
              <FormField label="Disposition"><input style={inputStyle} type="number" step="0.1" min="-1" max="1" value={rel.disposition} onChange={(e) => updateRel(i, { disposition: parseFloat(e.target.value) })} /></FormField>
            </div>
            <textarea style={{ ...textareaStyle, minHeight: 40, marginTop: 4 }} placeholder="History" value={rel.history} onChange={(e) => updateRel(i, { history: e.target.value })} />
            <button style={removeBtnStyle} onClick={() => update({ relationships: char.relationships.filter((_, j) => j !== i) })}>Remove</button>
          </div>
        ))}
        <button style={addBtnStyle} onClick={() => update({ relationships: [...char.relationships, { target_id: "", types: [], trust: 0, familiarity: 0, disposition: 0, history: "" }] })}>+ Add Relationship</button>
      </Section>

      {/* Schedule */}
      <Section title="Schedule">
        {char.schedule.map((entry, i) => (
          <div key={i} style={cardStyle}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.5rem" }}>
              <FormField label="Start"><input style={inputStyle} type="number" value={entry.time_start} onChange={(e) => updateSchedule(i, { time_start: parseInt(e.target.value) })} /></FormField>
              <FormField label="End"><input style={inputStyle} type="number" value={entry.time_end} onChange={(e) => updateSchedule(i, { time_end: parseInt(e.target.value) })} /></FormField>
              <FormField label="Location"><input style={inputStyle} value={entry.location} onChange={(e) => updateSchedule(i, { location: e.target.value })} /></FormField>
              <FormField label="Interruptible">
                <input type="checkbox" checked={entry.interruptible} onChange={(e) => updateSchedule(i, { interruptible: e.target.checked })} />
              </FormField>
            </div>
            <input style={{ ...inputStyle, marginTop: 4 }} placeholder="Activity" value={entry.activity} onChange={(e) => updateSchedule(i, { activity: e.target.value })} />
            <button style={removeBtnStyle} onClick={() => update({ schedule: char.schedule.filter((_, j) => j !== i) })}>Remove</button>
          </div>
        ))}
        <button style={addBtnStyle} onClick={() => update({ schedule: [...char.schedule, { time_start: 0, time_end: 8, location: "", activity: "", interruptible: true }] })}>+ Add Schedule Entry</button>
      </Section>

      {/* Affinities */}
      <Section title="Affinities">
        {char.affinities.map((aff, i) => (
          <div key={i} style={{ ...cardStyle, display: "grid", gridTemplateColumns: "1fr 80px 2fr auto", gap: "0.5rem", alignItems: "center" }}>
            <input style={inputStyle} placeholder="Target" value={aff.target} onChange={(e) => updateAffinity(i, { target: e.target.value })} />
            <input style={inputStyle} type="number" step="0.1" min="-1" max="1" placeholder="Score" value={aff.score} onChange={(e) => updateAffinity(i, { score: parseFloat(e.target.value) })} />
            <input style={inputStyle} placeholder="Reason" value={aff.reason} onChange={(e) => updateAffinity(i, { reason: e.target.value })} />
            <button style={removeBtnStyle} onClick={() => update({ affinities: char.affinities.filter((_, j) => j !== i) })}>X</button>
          </div>
        ))}
        <button style={addBtnStyle} onClick={() => update({ affinities: [...char.affinities, { target: "", score: 0, reason: "" }] })}>+ Add Affinity</button>
      </Section>

      {/* Protection */}
      <Section title="Protection">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0.5rem" }}>
          <FormField label="Level">
            <select style={selectStyle} value={char.protection.level} onChange={(e) => update({ protection: { ...char.protection, level: e.target.value as any } })}>
              <option value="none">None</option>
              <option value="soft">Soft</option>
              <option value="hard">Hard</option>
              <option value="immortal">Immortal</option>
            </select>
          </FormField>
          <FormField label="Reason">
            <input style={inputStyle} value={char.protection.reason} onChange={(e) => update({ protection: { ...char.protection, reason: e.target.value } })} />
          </FormField>
        </div>
        <FormField label="Fallback Text">
          <textarea style={{ ...textareaStyle, minHeight: 60 }} value={char.protection.fallback} onChange={(e) => update({ protection: { ...char.protection, fallback: e.target.value } })} />
        </FormField>
      </Section>

      <div style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
        <button onClick={save} disabled={saving} style={btnPrimary}>
          {saving ? "Saving..." : isNew ? "Create Character" : "Save Changes"}
        </button>
        <button onClick={() => navigate("/characters")} style={btnDanger}>Cancel</button>
      </div>
    </div>
  );

  function updateGoal(i: number, patch: Partial<Goal>) {
    const goals = [...char.goals];
    goals[i] = { ...goals[i], ...patch };
    update({ goals });
  }

  function updateRel(i: number, patch: Partial<Relationship>) {
    const relationships = [...char.relationships];
    relationships[i] = { ...relationships[i], ...patch };
    update({ relationships });
  }

  function updateSchedule(i: number, patch: Partial<ScheduleEntry>) {
    const schedule = [...char.schedule];
    schedule[i] = { ...schedule[i], ...patch };
    update({ schedule });
  }

  function updateAffinity(i: number, patch: Partial<Affinity>) {
    const affinities = [...char.affinities];
    affinities[i] = { ...affinities[i], ...patch };
    update({ affinities });
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: "1.5rem" }}>
      <h3 style={{ color: "#e0c097", borderBottom: "1px solid #333", paddingBottom: 4 }}>{title}</h3>
      {children}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#1a1a2e",
  border: "1px solid #333",
  borderRadius: 4,
  padding: "0.75rem",
  marginBottom: "0.5rem",
  position: "relative",
};

const addBtnStyle: React.CSSProperties = {
  background: "transparent",
  color: "#e0c097",
  border: "1px dashed #555",
  padding: "0.4rem 1rem",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: "0.85rem",
  width: "100%",
  marginTop: 4,
};

const removeBtnStyle: React.CSSProperties = {
  position: "absolute",
  top: 4,
  right: 4,
  background: "transparent",
  color: "#a33",
  border: "none",
  cursor: "pointer",
  fontSize: "0.75rem",
};
