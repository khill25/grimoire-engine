import { useEffect, useState } from "react";
import FormField, { inputStyle, btnPrimary } from "../components/FormField";
import { gameConstants } from "../api/client";

interface Constants {
  // §1.1 — HP: Will primary, Emotion secondary, Understanding minor
  base_hp: number;
  will_hp_per_point: number;
  emotion_hp_per_point: number;
  understanding_hp_per_point: number;
  // §1.1 — Stamina: Emotion primary, Will secondary, Understanding minor
  base_stamina: number;
  emotion_stamina_per_point: number;
  will_stamina_per_point: number;
  understanding_stamina_per_point: number;
  // §1.1 — Stamina Regen: Emotion only
  base_stamina_regen: number;
  emotion_stamina_regen_per_point: number;
  // §1.1 — Mana: Understanding only
  base_mana: number;
  understanding_mana_per_point: number;
  // §1.1 — Mana Regen: Mind primary, Understanding secondary
  base_mana_regen: number;
  mind_mana_regen_per_point: number;
  understanding_mana_regen_per_point: number;
  // §1.1 — Equip Load: all four stats
  base_equip_load: number;
  will_equip_per_point: number;
  emotion_equip_per_point: number;
  mind_equip_per_point: number;
  understanding_equip_per_point: number;
  // §1.1 — Mind/Timing
  mind_cooldown_reduction_per_point: number;
  max_cooldown_reduction: number;
  mind_recovery_reduction_per_point: number;
  max_recovery_reduction: number;
  // §4 — Armor
  resistance_cap: number;
}

const DEFAULTS: Constants = {
  base_hp: 100, will_hp_per_point: 5, emotion_hp_per_point: 1, understanding_hp_per_point: 2,
  base_stamina: 100, emotion_stamina_per_point: 5, will_stamina_per_point: 2, understanding_stamina_per_point: 1,
  base_stamina_regen: 1, emotion_stamina_regen_per_point: 0.5,
  base_mana: 50, understanding_mana_per_point: 5,
  base_mana_regen: 1, mind_mana_regen_per_point: 0.5, understanding_mana_regen_per_point: 0.2,
  base_equip_load: 20, will_equip_per_point: 2, emotion_equip_per_point: 2, mind_equip_per_point: 1, understanding_equip_per_point: 1,
  mind_cooldown_reduction_per_point: 0.003, max_cooldown_reduction: 0.60,
  mind_recovery_reduction_per_point: 0.002, max_recovery_reduction: 0.50,
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

const SECTIONS: { section: string; fields: FieldDef[] }[] = [
  {
    section: "HP — Will primary, Emotion secondary, Understanding minor",
    fields: [
      { key: "base_hp", label: "Base HP", hint: "Starting HP before stat scaling", step: 1 },
      { key: "will_hp_per_point", label: "Will → HP", hint: "HP per point of Will (primary)", step: 0.5 },
      { key: "emotion_hp_per_point", label: "Emotion → HP", hint: "HP per point of Emotion (secondary)", step: 0.5 },
      { key: "understanding_hp_per_point", label: "Understanding → HP", hint: "HP per point of Understanding (minor)", step: 0.5 },
    ],
  },
  {
    section: "Stamina — Emotion primary, Will secondary, Understanding minor",
    fields: [
      { key: "base_stamina", label: "Base Stamina", hint: "Starting stamina pool", step: 1 },
      { key: "emotion_stamina_per_point", label: "Emotion → Stamina", hint: "Stamina per point of Emotion (primary)", step: 0.5 },
      { key: "will_stamina_per_point", label: "Will → Stamina", hint: "Stamina per point of Will (secondary)", step: 0.5 },
      { key: "understanding_stamina_per_point", label: "Understanding → Stamina", hint: "Stamina per point of Understanding (minor)", step: 0.5 },
    ],
  },
  {
    section: "Stamina Regen — Emotion only",
    fields: [
      { key: "base_stamina_regen", label: "Base Stamina Regen", hint: "Stamina regenerated per second at 0 Emotion", step: 0.1 },
      { key: "emotion_stamina_regen_per_point", label: "Emotion → Stamina Regen", hint: "Additional regen/s per point of Emotion", step: 0.05 },
    ],
  },
  {
    section: "Mana — Understanding only",
    fields: [
      { key: "base_mana", label: "Base Mana", hint: "Starting mana pool", step: 1 },
      { key: "understanding_mana_per_point", label: "Understanding → Mana", hint: "Mana per point of Understanding", step: 0.5 },
    ],
  },
  {
    section: "Mana Regen — Mind primary, Understanding secondary",
    fields: [
      { key: "base_mana_regen", label: "Base Mana Regen", hint: "Mana regenerated per second at base", step: 0.1 },
      { key: "mind_mana_regen_per_point", label: "Mind → Mana Regen", hint: "Additional regen/s per point of Mind (primary)", step: 0.05 },
      { key: "understanding_mana_regen_per_point", label: "Understanding → Mana Regen", hint: "Additional regen/s per point of Understanding (secondary)", step: 0.05 },
    ],
  },
  {
    section: "Equip Load — all four stats contribute",
    fields: [
      { key: "base_equip_load", label: "Base Equip Load", hint: "Starting equip load budget", step: 1 },
      { key: "will_equip_per_point", label: "Will → Equip Load", hint: "Equip load per point of Will", step: 0.5 },
      { key: "emotion_equip_per_point", label: "Emotion → Equip Load", hint: "Equip load per point of Emotion", step: 0.5 },
      { key: "mind_equip_per_point", label: "Mind → Equip Load", hint: "Equip load per point of Mind", step: 0.5 },
      { key: "understanding_equip_per_point", label: "Understanding → Equip Load", hint: "Equip load per point of Understanding (minor)", step: 0.5 },
    ],
  },
  {
    section: "Mind / Timing — cooldown and recovery reduction",
    fields: [
      { key: "mind_cooldown_reduction_per_point", label: "Mind → Cooldown Reduction", hint: "Cooldown reduction per point of Mind (0.003 = 0.3%/pt)", step: 0.001 },
      { key: "max_cooldown_reduction", label: "Max Cooldown Reduction", hint: "Hard cap (0.60 = 60% max reduction)", step: 0.01, min: 0, max: 1 },
      { key: "mind_recovery_reduction_per_point", label: "Mind → Recovery Reduction", hint: "Recovery reduction per point of Mind (0.002 = 0.2%/pt)", step: 0.001 },
      { key: "max_recovery_reduction", label: "Max Recovery Reduction", hint: "Hard cap (0.50 = 50% max reduction)", step: 0.01, min: 0, max: 1 },
    ],
  },
  {
    section: "Armor System",
    fields: [
      { key: "resistance_cap", label: "Resistance Cap", hint: "Maximum effective armor resistance (0.75 = 75%)", step: 0.01, min: 0, max: 1 },
    ],
  },
];

export default function GameConstants() {
  const [constants, setConstants] = useState<Constants>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    gameConstants.get().then((data) => {
      if (data && Object.keys(data).length > 0) {
        setConstants({ ...DEFAULTS, ...data });
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const update = (key: keyof Constants, value: number) => {
    setConstants({ ...constants, [key]: value });
    setSaved(false);
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await gameConstants.update(constants);
      setSaved(true);
      setDirty(false);
    } catch (e: any) {
      setError(`Failed to save: ${e.message}`);
    }
    setSaving(false);
  };

  // Preview with 10 points in Will, Emotion, Mind; Understanding = 30
  const w = 10, em = 10, mi = 10;
  const u = w + em + mi; // Understanding = 30
  const c = constants;
  const preview = {
    hp: c.base_hp + w * c.will_hp_per_point + em * c.emotion_hp_per_point + u * c.understanding_hp_per_point,
    stamina: c.base_stamina + em * c.emotion_stamina_per_point + w * c.will_stamina_per_point + u * c.understanding_stamina_per_point,
    stamina_regen: c.base_stamina_regen + em * c.emotion_stamina_regen_per_point,
    mana: c.base_mana + u * c.understanding_mana_per_point,
    mana_regen: c.base_mana_regen + mi * c.mind_mana_regen_per_point + u * c.understanding_mana_regen_per_point,
    equip_load: c.base_equip_load + w * c.will_equip_per_point + em * c.emotion_equip_per_point + mi * c.mind_equip_per_point + u * c.understanding_equip_per_point,
    cooldown_reduction: Math.min(mi * c.mind_cooldown_reduction_per_point, c.max_cooldown_reduction),
    recovery_reduction: Math.min(mi * c.mind_recovery_reduction_per_point, c.max_recovery_reduction),
  };

  const dirtyBtnStyle: React.CSSProperties = {
    ...btnPrimary,
    border: "2px solid #e0c097",
    background: "#2a2a1a",
    fontWeight: 600,
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ color: "#e0c097", margin: 0 }}>Game Constants</h1>
        <button onClick={save} disabled={saving} style={dirty ? dirtyBtnStyle : btnPrimary}>
          {saving ? "Saving..." : saved ? "Saved" : dirty ? "Save *" : "Save"}
        </button>
      </div>

      {error && (
        <div style={{
          color: "#f88", marginBottom: "1rem", background: "#2a1a1a",
          border: "1px solid #a33", borderRadius: 6, padding: "0.6rem 0.8rem",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span>{error}</span>
          <button onClick={() => setError("")} style={{ background: "none", border: "none", color: "#f88", cursor: "pointer", fontSize: "1rem" }}>x</button>
        </div>
      )}

      {SECTIONS.map(({ section, fields }) => (
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

      {/* Preview */}
      <Section title={`Preview (Will=${w}, Emotion=${em}, Mind=${mi}, Understanding=${u})`}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.75rem" }}>
          <PreviewCard label="Max HP" value={preview.hp} />
          <PreviewCard label="Max Stamina" value={preview.stamina} />
          <PreviewCard label="Stamina Regen/s" value={preview.stamina_regen} />
          <PreviewCard label="Max Mana" value={preview.mana} />
          <PreviewCard label="Mana Regen/s" value={preview.mana_regen} />
          <PreviewCard label="Equip Load" value={preview.equip_load} />
          <PreviewCard label="Cooldown Reduction" value={preview.cooldown_reduction} pct />
          <PreviewCard label="Recovery Reduction" value={preview.recovery_reduction} pct />
        </div>
      </Section>

      <div style={{ marginTop: "2rem" }}>
        <button onClick={save} disabled={saving} style={dirty ? dirtyBtnStyle : btnPrimary}>
          {saving ? "Saving..." : saved ? "Saved" : dirty ? "Save Changes *" : "Save Changes"}
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

function PreviewCard({ label, value, pct }: { label: string; value: number; pct?: boolean }) {
  const display = pct
    ? `${(value * 100).toFixed(1)}%`
    : Number.isInteger(value) ? String(value) : value.toFixed(2);
  return (
    <div style={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 6, padding: "0.75rem" }}>
      <div style={{ color: "#e0c097", fontSize: "0.7rem", textTransform: "uppercase" }}>{label}</div>
      <div style={{ color: "#ddd", fontSize: "1.2rem", margin: "0.25rem 0" }}>{display}</div>
    </div>
  );
}
