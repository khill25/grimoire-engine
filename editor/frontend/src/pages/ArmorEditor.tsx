import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { armor } from "../api/client";
import { useGameTypes } from "../context/GameTypesContext";
import FormField, { inputStyle, textareaStyle, btnPrimary, btnDanger } from "../components/FormField";
import TypeSelect from "../components/TypeSelect";

interface ArmorData {
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
  // Armor-specific fields
  resistance_kinetic: number;
  resistance_atomic: number;
  resistance_plasma: number;
  resistance_void: number;
  dot_protection: number;
  equip_weight: number;
  mod_slots: number;
}

const emptyArmor: ArmorData = {
  id: "", icon: "", name: "", value: 0, rarity: "common", description: "",
  is_quest_item: false, is_sellable: true, stackable: false, is_consumable: false,
  unique_id: "",
  resistance_kinetic: 0, resistance_atomic: 0, resistance_plasma: 0, resistance_void: 0,
  dot_protection: 0, equip_weight: 0, mod_slots: 0,
};

export default function ArmorEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { lookup } = useGameTypes();
  const isNew = id === "new";
  const [item, setItem] = useState<ArmorData>(emptyArmor);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isNew && id) {
      armor.get(id).then(setItem).catch(() => setError("Armor not found"));
    }
  }, [id, isNew]);

  const update = (patch: Partial<ArmorData>) => setItem({ ...item, ...patch });

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const data = cleanForSave(item);
      if (isNew) {
        await armor.create(data);
      } else {
        await armor.update(id!, data);
      }
      navigate("/armor");
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  const rarityEntry = lookup("rarities", item.rarity);
  const rarityColor = rarityEntry?.color || "#aaa";

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ color: "#e0c097", margin: 0 }}>
          {isNew ? "New Armor" : <>Edit: <span style={{ color: rarityColor }}>{item.name}</span></>}
        </h1>
        <button onClick={() => navigate("/armor")} style={btnDanger}>Cancel</button>
      </div>

      {error && <div style={{ color: "#f88", marginBottom: "1rem" }}>{error}</div>}

      {/* Base Item fields */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <FormField label="ID" hint="Unique identifier, used in JSON filenames">
          <input style={inputStyle} value={item.id} onChange={(e) => update({ id: e.target.value })} disabled={!isNew} />
        </FormField>
        <FormField label="Name">
          <input style={inputStyle} value={item.name} onChange={(e) => update({ name: e.target.value })} />
        </FormField>
        <FormField label="Rarity">
          <TypeSelect category="rarities" value={item.rarity} onChange={(v) => update({ rarity: v })} allowEmpty={false} />
        </FormField>
        <FormField label="Icon" hint="Icon asset reference">
          <input style={inputStyle} value={item.icon} onChange={(e) => update({ icon: e.target.value })} />
        </FormField>
        <FormField label="Value" hint="Base currency value">
          <input style={inputStyle} type="number" value={item.value} onChange={(e) => update({ value: parseInt(e.target.value) || 0 })} />
        </FormField>
        <div />
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
          <FormField label="Quest Item">
            <input type="checkbox" checked={item.is_quest_item} onChange={(e) => update({ is_quest_item: e.target.checked })} />
          </FormField>
          <FormField label="Sellable">
            <input type="checkbox" checked={item.is_sellable} onChange={(e) => update({ is_sellable: e.target.checked })} />
          </FormField>
        </div>
        {item.rarity === "unique" && (
          <FormField label="Unique ID" hint="Blocks duplicate spawns">
            <input style={inputStyle} value={item.unique_id} onChange={(e) => update({ unique_id: e.target.value })} />
          </FormField>
        )}
      </div>

      <FormField label="Description">
        <textarea style={textareaStyle} value={item.description} onChange={(e) => update({ description: e.target.value })} />
      </FormField>

      {/* Armor-specific fields */}
      <Section title="Resistances">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <SliderField label="Kinetic" value={item.resistance_kinetic} min={0} max={0.75} step={0.01} onChange={(v) => update({ resistance_kinetic: v })} />
          <SliderField label="Atomic" value={item.resistance_atomic} min={0} max={0.75} step={0.01} onChange={(v) => update({ resistance_atomic: v })} />
          <SliderField label="Plasma" value={item.resistance_plasma} min={0} max={0.75} step={0.01} onChange={(v) => update({ resistance_plasma: v })} />
          <SliderField label="Void" value={item.resistance_void} min={0} max={0.75} step={0.01} onChange={(v) => update({ resistance_void: v })} />
        </div>
      </Section>

      <Section title="Defense">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <SliderField label="DoT Protection" value={item.dot_protection} min={0} max={1} step={0.01} onChange={(v) => update({ dot_protection: v })} />
          <FormField label="Equip Weight">
            <input style={inputStyle} type="number" step="0.1" value={item.equip_weight} onChange={(e) => update({ equip_weight: parseFloat(e.target.value) || 0 })} />
          </FormField>
          <FormField label="Mod Slots">
            <input style={inputStyle} type="number" min="0" value={item.mod_slots} onChange={(e) => update({ mod_slots: parseInt(e.target.value) || 0 })} />
          </FormField>
        </div>
      </Section>

      <div style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
        <button onClick={save} disabled={saving} style={btnPrimary}>
          {saving ? "Saving..." : isNew ? "Create Armor" : "Save Changes"}
        </button>
        <button onClick={() => navigate("/armor")} style={btnDanger}>Cancel</button>
      </div>
    </div>
  );
}

function cleanForSave(item: ArmorData): Record<string, unknown> {
  const data: Record<string, unknown> = { ...item };
  if (item.rarity !== "unique") delete data.unique_id;
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

function SliderField({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <FormField label={label}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{ flex: 1, accentColor: "#e0c097" }}
        />
        <span style={{ color: "#ddd", fontSize: "0.85rem", minWidth: 45, textAlign: "right" }}>
          {value.toFixed(2)}
        </span>
      </div>
    </FormField>
  );
}
