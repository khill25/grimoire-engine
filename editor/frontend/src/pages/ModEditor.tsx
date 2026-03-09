import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { mods } from "../api/client";
import FormField, { inputStyle, textareaStyle, selectStyle, btnPrimary, btnDanger } from "../components/FormField";
import RaritySelect, { rarityColor } from "../components/RaritySelect";

const MOD_KINDS = ["armor", "melee", "ranged", "universal"] as const;

const SLOT_TAXONOMY: Record<string, string[]> = {
  melee: ["pommel", "grip", "emitter", "battery"],
  ranged: ["muzzle", "optics", "rail", "battery"],
  armor: [],
  universal: [],
};

const MODIFIER_KEYS = [
  { key: "base_damage_modifier", label: "Base Damage Modifier" },
  { key: "crit_chance_modifier", label: "Crit Chance Modifier" },
  { key: "crit_damage_modifier", label: "Crit Damage Modifier" },
  { key: "weapon_spread_modifier", label: "Weapon Spread Modifier" },
  { key: "stamina_use_modifier", label: "Stamina Use Modifier" },
  { key: "attack_recovery_modifier", label: "Attack Recovery Modifier" },
  { key: "armor_penetration_modifier", label: "Armor Penetration Modifier" },
  { key: "dot_damage", label: "DoT Damage" },
  { key: "dot_duration", label: "DoT Duration" },
  { key: "resistance_kinetic", label: "Resistance: Kinetic" },
  { key: "resistance_elemental", label: "Resistance: Elemental" },
  // TODO: "Resonance" is a placeholder name pending final decision
  { key: "resistance_resonance", label: "Resistance: Resonance" },
  { key: "resistance_void", label: "Resistance: Void" },
];

interface ModData {
  // Base Item fields
  id: string;
  icon: string;
  name: string;
  value: number;
  rarity: string;
  description: string;
  is_quest_item: boolean;
  is_sellable: boolean;
  stackable: boolean;
  is_consumable: boolean;
  unique_id: string;
  // Mod-specific fields
  kind: string;
  slot_type: string;
  properties: Record<string, number>;
}

const emptyMod: ModData = {
  id: "", icon: "", name: "", value: 0, rarity: "common", description: "",
  is_quest_item: false, is_sellable: true, stackable: false, is_consumable: false,
  unique_id: "",
  kind: "universal", slot_type: "", properties: {},
};

export default function ModEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";
  const [mod, setMod] = useState<ModData>(emptyMod);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isNew && id) {
      mods.get(id).then((data) => {
        setMod({ ...emptyMod, ...data, properties: data.properties || {} });
      }).catch(() => setError("Mod not found"));
    }
  }, [id, isNew]);

  const update = (patch: Partial<ModData>) => setMod({ ...mod, ...patch });

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const data = cleanForSave(mod);
      if (isNew) {
        await mods.create(data);
      } else {
        await mods.update(id!, data);
      }
      navigate("/mods");
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  const rColor = rarityColor(mod.rarity);

  // Available slots based on kind
  const availableSlots = SLOT_TAXONOMY[mod.kind] || [];

  // Properties editor
  const propEntries = Object.entries(mod.properties);
  const usedKeys = new Set(propEntries.map(([k]) => k));

  const updatePropValue = (key: string, value: number) => {
    update({ properties: { ...mod.properties, [key]: value } });
  };

  const updatePropKey = (oldKey: string, newKey: string) => {
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(mod.properties)) {
      result[k === oldKey ? newKey : k] = v;
    }
    update({ properties: result });
  };

  const removeProp = (key: string) => {
    const { [key]: _, ...rest } = mod.properties;
    update({ properties: rest });
  };

  const addProp = () => {
    const available = MODIFIER_KEYS.find((m) => !usedKeys.has(m.key));
    if (available) {
      update({ properties: { ...mod.properties, [available.key]: 0 } });
    }
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ color: "#e0c097", margin: 0 }}>
          {isNew ? "New Mod" : <>Edit: <span style={{ color: rColor }}>{mod.name}</span></>}
        </h1>
        <button onClick={() => navigate("/mods")} style={btnDanger}>Cancel</button>
      </div>

      {error && <div style={{ color: "#f88", marginBottom: "1rem" }}>{error}</div>}

      {/* Base Item fields */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <FormField label="ID" hint="Unique identifier, used in JSON filenames">
          <input style={inputStyle} value={mod.id} onChange={(e) => update({ id: e.target.value })} disabled={!isNew} />
        </FormField>
        <FormField label="Name">
          <input style={inputStyle} value={mod.name} onChange={(e) => update({ name: e.target.value })} />
        </FormField>
        <FormField label="Rarity">
          <RaritySelect value={mod.rarity} onChange={(v) => update({ rarity: v })} />
        </FormField>
        <FormField label="Icon" hint="Icon asset reference">
          <input style={inputStyle} value={mod.icon} onChange={(e) => update({ icon: e.target.value })} />
        </FormField>
        <FormField label="Value" hint="Base currency value">
          <input style={inputStyle} type="number" value={mod.value} onChange={(e) => update({ value: parseInt(e.target.value) || 0 })} />
        </FormField>
        <div />
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
          <FormField label="Quest Item">
            <input type="checkbox" checked={mod.is_quest_item} onChange={(e) => update({ is_quest_item: e.target.checked })} />
          </FormField>
          <FormField label="Sellable">
            <input type="checkbox" checked={mod.is_sellable} onChange={(e) => update({ is_sellable: e.target.checked })} />
          </FormField>
        </div>
        {mod.rarity === "unique" && (
          <FormField label="Unique ID" hint="Blocks duplicate spawns">
            <input style={inputStyle} value={mod.unique_id} onChange={(e) => update({ unique_id: e.target.value })} />
          </FormField>
        )}
      </div>

      <FormField label="Description">
        <textarea style={textareaStyle} value={mod.description} onChange={(e) => update({ description: e.target.value })} />
      </FormField>

      {/* Mod-specific fields */}
      <Section title="Mod Configuration">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <FormField label="Kind">
            <select style={selectStyle} value={mod.kind} onChange={(e) => update({ kind: e.target.value, slot_type: "" })}>
              {MOD_KINDS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Slot Type" hint="Slot this mod fits into">
            {availableSlots.length > 0 ? (
              <select style={selectStyle} value={mod.slot_type} onChange={(e) => update({ slot_type: e.target.value })}>
                <option value="">Select slot...</option>
                {availableSlots.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            ) : (
              <input style={inputStyle} value={mod.slot_type} onChange={(e) => update({ slot_type: e.target.value })} placeholder="Enter slot type" />
            )}
          </FormField>
        </div>
      </Section>

      <Section title="Properties">
        {propEntries.map(([key, value]) => (
          <div key={key} style={{ display: "flex", gap: "0.5rem", marginBottom: 4, alignItems: "center" }}>
            <div style={{ width: "55%" }}>
              <select
                style={selectStyle}
                value={key}
                onChange={(e) => updatePropKey(key, e.target.value)}
              >
                {MODIFIER_KEYS.map((m) => (
                  <option key={m.key} value={m.key} disabled={usedKeys.has(m.key) && m.key !== key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <input
                style={inputStyle}
                type="number"
                step="0.01"
                value={value}
                onChange={(e) => updatePropValue(key, parseFloat(e.target.value) || 0)}
              />
            </div>
            <button onClick={() => removeProp(key)} style={{ background: "none", border: "none", color: "#a33", cursor: "pointer", fontSize: "1rem" }}>
              x
            </button>
          </div>
        ))}
        <button onClick={addProp} style={addBtnStyle} disabled={usedKeys.size >= MODIFIER_KEYS.length}>+ Add Property</button>
      </Section>

      <div style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
        <button onClick={save} disabled={saving} style={btnPrimary}>
          {saving ? "Saving..." : isNew ? "Create Mod" : "Save Changes"}
        </button>
        <button onClick={() => navigate("/mods")} style={btnDanger}>Cancel</button>
      </div>
    </div>
  );
}

function cleanForSave(mod: ModData): Record<string, unknown> {
  const data: Record<string, unknown> = { ...mod };
  if (mod.rarity !== "unique") delete data.unique_id;
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
