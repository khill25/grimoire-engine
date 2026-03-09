import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { spells } from "../api/client";
import FormField, { inputStyle, textareaStyle, btnPrimary, btnDanger } from "../components/FormField";
import RaritySelect, { rarityColor } from "../components/RaritySelect";
import TypeSelect from "../components/TypeSelect";

interface SpellData {
  id: string;
  icon: string;
  name: string;
  rarity: string;
  description: string;
  value: number;
  mana_cost: number;
  stamina_cost: number;
  recovery: number;
  can_charge: boolean;
  max_charge_pct: number;
  is_continuous: boolean;
  cooldown: number;
  base_damage: number;
  damage_type: string;
  effects: string[];
  effect_chance: number;
}

const emptySpell: SpellData = {
  id: "", icon: "", name: "", rarity: "common", description: "",
  value: 0, mana_cost: 0, stamina_cost: 0, recovery: 0,
  can_charge: false, max_charge_pct: 0, is_continuous: false,
  cooldown: 0, base_damage: 0, damage_type: "", effects: [],
  effect_chance: 0,
};

export default function SpellEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";
  const [spell, setSpell] = useState<SpellData>(emptySpell);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isNew && id) {
      spells.get(id).then(setSpell).catch(() => setError("Spell not found"));
    }
  }, [id, isNew]);

  const update = (patch: Partial<SpellData>) => setSpell({ ...spell, ...patch });

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const data = cleanForSave(spell);
      if (isNew) {
        await spells.create(data);
      } else {
        await spells.update(id!, data);
      }
      navigate("/spells");
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  const rColor = rarityColor(spell.rarity);

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ color: "#e0c097", margin: 0 }}>
          {isNew ? "New Spell" : <>Edit: <span style={{ color: rColor }}>{spell.name}</span></>}
        </h1>
        <button onClick={() => navigate("/spells")} style={btnDanger}>Cancel</button>
      </div>

      {error && <div style={{ color: "#f88", marginBottom: "1rem" }}>{error}</div>}

      {/* Core fields */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <FormField label="ID" hint="Unique identifier, used in JSON filenames">
          <input style={inputStyle} value={spell.id} onChange={(e) => update({ id: e.target.value })} disabled={!isNew} />
        </FormField>
        <FormField label="Name">
          <input style={inputStyle} value={spell.name} onChange={(e) => update({ name: e.target.value })} />
        </FormField>
        <FormField label="Rarity">
          <RaritySelect value={spell.rarity} onChange={(v) => update({ rarity: v })} />
        </FormField>
        <FormField label="Icon" hint="Icon asset reference">
          <input style={inputStyle} value={spell.icon} onChange={(e) => update({ icon: e.target.value })} />
        </FormField>
        <FormField label="Value" hint="Base currency value">
          <input style={inputStyle} type="number" value={spell.value} onChange={(e) => update({ value: parseInt(e.target.value) || 0 })} />
        </FormField>
        <FormField label="Damage Type">
          <TypeSelect category="damage_types" value={spell.damage_type} onChange={(v) => update({ damage_type: v })} emptyLabel="Select damage type..." />
        </FormField>
      </div>

      <FormField label="Description">
        <textarea style={textareaStyle} value={spell.description} onChange={(e) => update({ description: e.target.value })} />
      </FormField>

      {/* Combat stats */}
      <Section title="Combat">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <FormField label="Base Damage">
            <input style={inputStyle} type="number" step="0.1" value={spell.base_damage} onChange={(e) => update({ base_damage: parseFloat(e.target.value) || 0 })} />
          </FormField>
          <FormField label="Mana Cost">
            <input style={inputStyle} type="number" step="0.1" value={spell.mana_cost} onChange={(e) => update({ mana_cost: parseFloat(e.target.value) || 0 })} />
          </FormField>
          <FormField label="Stamina Cost">
            <input style={inputStyle} type="number" step="0.1" value={spell.stamina_cost} onChange={(e) => update({ stamina_cost: parseFloat(e.target.value) || 0 })} />
          </FormField>
          <FormField label="Recovery" hint="Seconds before next cast/attack. Reduced by Mind at runtime (recovery_reduction).">
            <input style={inputStyle} type="number" step="0.1" value={spell.recovery} onChange={(e) => update({ recovery: parseFloat(e.target.value) || 0 })} />
          </FormField>
        </div>
      </Section>

      {/* Charge & Continuous */}
      <Section title="Casting Behavior">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <FormField label="Can Charge">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={spell.can_charge}
                onChange={(e) => update({ can_charge: e.target.checked, ...(e.target.checked ? { is_continuous: false } : {}) })}
              />
              <span style={{ color: "#888", fontSize: "0.8rem" }}>Hold to charge, multiplies damage</span>
            </div>
          </FormField>
          <FormField label="Continuous">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={spell.is_continuous}
                onChange={(e) => update({ is_continuous: e.target.checked, ...(e.target.checked ? { can_charge: false } : {}) })}
              />
              <span style={{ color: "#888", fontSize: "0.8rem" }}>Drains mana each frame while held</span>
            </div>
          </FormField>
        </div>

        {spell.can_charge && (
          <FormField label="Max Charge %" hint="0.0–1.0; max mana multiplier when fully charged">
            <input
              style={{ ...inputStyle, maxWidth: 200 }}
              type="number"
              step="0.05"
              min="0"
              max="1"
              value={spell.max_charge_pct}
              onChange={(e) => update({ max_charge_pct: parseFloat(e.target.value) || 0 })}
            />
          </FormField>
        )}

        {!spell.is_continuous && (
          <FormField label="Cooldown" hint="Seconds between casts (ignored for continuous spells). Reduced by Mind at runtime (cooldown_reduction).">
            <input
              style={{ ...inputStyle, maxWidth: 200 }}
              type="number"
              step="0.1"
              value={spell.cooldown}
              onChange={(e) => update({ cooldown: parseFloat(e.target.value) || 0 })}
            />
          </FormField>
        )}
      </Section>

      {/* Effects */}
      <Section title="Effects">
        <FormField label="Effect Chance" hint="0.0–1.0; probability each effect applies on hit">
          <input
            style={{ ...inputStyle, maxWidth: 200 }}
            type="number"
            step="0.05"
            min="0"
            max="1"
            value={spell.effect_chance}
            onChange={(e) => update({ effect_chance: parseFloat(e.target.value) || 0 })}
          />
        </FormField>
        <FormField label="Effects" hint="Status effects applied on hit (StatusEffect type TBD)">
          {spell.effects.map((effect, i) => (
            <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: 4, alignItems: "center" }}>
              <input
                style={inputStyle}
                value={effect}
                onChange={(e) => {
                  const effects = [...spell.effects];
                  effects[i] = e.target.value;
                  update({ effects });
                }}
                placeholder="Effect name"
              />
              <button
                onClick={() => update({ effects: spell.effects.filter((_, j) => j !== i) })}
                style={{ background: "none", border: "none", color: "#a33", cursor: "pointer", fontSize: "1rem" }}
              >
                x
              </button>
            </div>
          ))}
          <button onClick={() => update({ effects: [...spell.effects, ""] })} style={addBtnStyle}>+ Add Effect</button>
        </FormField>
      </Section>

      <div style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
        <button onClick={save} disabled={saving} style={btnPrimary}>
          {saving ? "Saving..." : isNew ? "Create Spell" : "Save Changes"}
        </button>
        <button onClick={() => navigate("/spells")} style={btnDanger}>Cancel</button>
      </div>
    </div>
  );
}

function cleanForSave(spell: SpellData): Record<string, unknown> {
  const data: Record<string, unknown> = { ...spell };
  // Remove charge field when charging disabled
  if (!spell.can_charge) delete data.max_charge_pct;
  // Remove cooldown when continuous
  if (spell.is_continuous) delete data.cooldown;
  // Clean empty values
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (val === undefined || val === "") delete data[key];
  }
  return data;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: "1.5rem" }}>
      <h3 style={{ color: "#e0c097", borderBottom: "1px solid #333", paddingBottom: 4 }}>{title}</h3>
      {children}
    </div>
  );
}

const addBtnStyle: React.CSSProperties = {
  background: "transparent",
  color: "#e0c097",
  border: "1px dashed #555",
  padding: "0.3rem 0.8rem",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: "0.8rem",
  marginTop: 4,
};
