import { useEffect, useState } from "react";
import FormField, { inputStyle, btnPrimary } from "../components/FormField";
import { gameConstants } from "../api/client";

interface Constants {
  // §1 — Resource pool base values and per-point multipliers
  base_hp: number;
  hp_per_point: number;
  base_stamina: number;
  stamina_per_point: number;
  base_stamina_regen: number;
  stamina_regen_per_point: number;
  base_mana: number;
  mana_per_point: number;
  base_mana_regen: number;
  mana_regen_per_point: number;
  base_equip_load: number;
  equip_load_per_point: number;
  // §4 — Armor system
  resistance_cap: number;
}

const DEFAULTS: Constants = {
  base_hp: 100, hp_per_point: 10,
  base_stamina: 100, stamina_per_point: 5,
  base_stamina_regen: 1, stamina_regen_per_point: 0.2,
  base_mana: 50, mana_per_point: 8,
  base_mana_regen: 1, mana_regen_per_point: 0.15,
  base_equip_load: 20, equip_load_per_point: 2,
  resistance_cap: 0.75,
};

interface FieldDef {
  key: keyof Constants;
  label: string;
  hint: string;
  step: number;
  min?: number;
  max?: number;
}

const RESOURCE_FIELDS: { section: string; fields: FieldDef[] }[] = [
  {
    section: "HP (Emotion)",
    fields: [
      { key: "base_hp", label: "Base HP", hint: "Starting HP before stat scaling", step: 1 },
      { key: "hp_per_point", label: "HP per Emotion Point", hint: "Additional HP per point of Emotion", step: 0.5 },
    ],
  },
  {
    section: "Stamina (Will)",
    fields: [
      { key: "base_stamina", label: "Base Stamina", hint: "Starting stamina pool", step: 1 },
      { key: "stamina_per_point", label: "Stamina per Will Point", hint: "Additional stamina per point of Will", step: 0.5 },
      { key: "base_stamina_regen", label: "Base Stamina Regen", hint: "Stamina regenerated per second at 0 Will", step: 0.1 },
      { key: "stamina_regen_per_point", label: "Stamina Regen per Will Point", hint: "Additional regen per second per point of Will", step: 0.05 },
    ],
  },
  {
    section: "Mana (Mind)",
    fields: [
      { key: "base_mana", label: "Base Mana", hint: "Starting mana pool", step: 1 },
      { key: "mana_per_point", label: "Mana per Mind Point", hint: "Additional mana per point of Mind", step: 0.5 },
      { key: "base_mana_regen", label: "Base Mana Regen", hint: "Mana regenerated per second at 0 Mind", step: 0.1 },
      { key: "mana_regen_per_point", label: "Mana Regen per Mind Point", hint: "Additional regen per second per point of Mind", step: 0.05 },
    ],
  },
  {
    section: "Equip Load (Understanding)",
    fields: [
      { key: "base_equip_load", label: "Base Equip Load", hint: "Starting equip load budget", step: 1 },
      { key: "equip_load_per_point", label: "Load per Understanding Point", hint: "Additional equip load per point of Understanding (Will+Emotion+Mind)", step: 0.5 },
    ],
  },
];

const ARMOR_FIELDS: FieldDef[] = [
  { key: "resistance_cap", label: "Resistance Cap", hint: "Maximum effective resistance (0.75 = 75%)", step: 0.01, min: 0, max: 1 },
];

export default function GameConstants() {
  const [constants, setConstants] = useState<Constants>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    gameConstants.get().then((data) => {
      if (data && Object.keys(data).length > 0) {
        setConstants({ ...DEFAULTS, ...data });
      }
    }).catch(() => {});
  }, []);

  const update = (key: keyof Constants, value: number) => {
    setConstants({ ...constants, [key]: value });
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await gameConstants.update(constants);
      setSaved(true);
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  // Preview: show computed resources for a sample stat value
  const previewStat = 10;
  const preview = {
    hp: constants.base_hp + previewStat * constants.hp_per_point,
    stamina: constants.base_stamina + previewStat * constants.stamina_per_point,
    stamina_regen: constants.base_stamina_regen + previewStat * constants.stamina_regen_per_point,
    mana: constants.base_mana + previewStat * constants.mana_per_point,
    mana_regen: constants.base_mana_regen + previewStat * constants.mana_regen_per_point,
    equip_load: constants.base_equip_load + (previewStat * 3) * constants.equip_load_per_point,
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ color: "#e0c097", margin: 0 }}>Game Constants</h1>
        <button onClick={save} disabled={saving} style={btnPrimary}>
          {saving ? "Saving..." : saved ? "Saved" : "Save"}
        </button>
      </div>

      {error && <div style={{ color: "#f88", marginBottom: "1rem" }}>{error}</div>}

      {/* Resource Scaling Sections */}
      {RESOURCE_FIELDS.map(({ section, fields }) => (
        <Section key={section} title={section}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            {fields.map((f) => (
              <FormField key={f.key} label={f.label} hint={f.hint}>
                <input
                  style={inputStyle}
                  type="number"
                  step={f.step}
                  min={f.min}
                  max={f.max}
                  value={constants[f.key]}
                  onChange={(e) => update(f.key, parseFloat(e.target.value) || 0)}
                />
              </FormField>
            ))}
          </div>
        </Section>
      ))}

      {/* Armor Constants */}
      <Section title="Armor System">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          {ARMOR_FIELDS.map((f) => (
            <FormField key={f.key} label={f.label} hint={f.hint}>
              <input
                style={inputStyle}
                type="number"
                step={f.step}
                min={f.min}
                max={f.max}
                value={constants[f.key]}
                onChange={(e) => update(f.key, parseFloat(e.target.value) || 0)}
              />
            </FormField>
          ))}
        </div>
      </Section>

      {/* Preview */}
      <Section title={`Preview (${previewStat} points in each stat)`}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
          <PreviewCard label="Max HP" value={preview.hp} stat={`${previewStat} Emotion`} />
          <PreviewCard label="Max Stamina" value={preview.stamina} stat={`${previewStat} Will`} />
          <PreviewCard label="Stamina Regen/s" value={preview.stamina_regen} stat={`${previewStat} Will`} />
          <PreviewCard label="Max Mana" value={preview.mana} stat={`${previewStat} Mind`} />
          <PreviewCard label="Mana Regen/s" value={preview.mana_regen} stat={`${previewStat} Mind`} />
          <PreviewCard label="Equip Load" value={preview.equip_load} stat={`${previewStat * 3} Understanding`} />
        </div>
      </Section>

      <div style={{ marginTop: "2rem" }}>
        <button onClick={save} disabled={saving} style={btnPrimary}>
          {saving ? "Saving..." : saved ? "Saved" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: "1.5rem" }}>
      <h3 style={{ color: "#e0c097", borderBottom: "1px solid #333", paddingBottom: 4 }}>{title}</h3>
      {children}
    </div>
  );
}

function PreviewCard({ label, value, stat }: { label: string; value: number; stat: string }) {
  return (
    <div style={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 6, padding: "0.75rem" }}>
      <div style={{ color: "#e0c097", fontSize: "0.75rem", textTransform: "uppercase" }}>{label}</div>
      <div style={{ color: "#ddd", fontSize: "1.3rem", margin: "0.25rem 0" }}>{Number.isInteger(value) ? value : value.toFixed(2)}</div>
      <div style={{ color: "#666", fontSize: "0.7rem" }}>{stat}</div>
    </div>
  );
}
