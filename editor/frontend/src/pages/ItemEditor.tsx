import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { items } from "../api/client";
import { useGameTypes } from "../context/GameTypesContext";
import FormField, { inputStyle, textareaStyle, btnPrimary, btnDanger } from "../components/FormField";
import TypeSelect, { TypeKeySelect } from "../components/TypeSelect";
import ExtrasEditor from "../components/ExtrasEditor";

interface ItemData {
  id: string;
  name: string;
  type: string;
  description: string;
  rarity: string;
  value: number;
  weight: number;
  stackable: boolean;
  max_stack: number;
  icon: string;
  // Weapon fields
  damage?: number;
  damage_type?: string;
  scaling?: Record<string, string>;
  // Armor fields
  defense?: number;
  resistances?: Record<string, number>;
  // Equipment shared
  slot?: string;
  requirements?: Record<string, number>;
  // Consumable fields
  effect?: string;
  effect_value?: number;
  duration?: number;
  cooldown?: number;
  // Extras
  extras: Record<string, unknown>;
}

const emptyItem: ItemData = {
  id: "", name: "", type: "consumable", description: "", rarity: "common",
  value: 0, weight: 0, stackable: true, max_stack: 99, icon: "", extras: {},
};

export default function ItemEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { lookup } = useGameTypes();
  const isNew = id === "new";
  const [item, setItem] = useState<ItemData>(emptyItem);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isNew && id) {
      items.get(id).then(setItem).catch(() => setError("Item not found"));
    }
  }, [id, isNew]);

  const update = (patch: Partial<ItemData>) => setItem({ ...item, ...patch });

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const data = cleanForSave(item);
      if (isNew) {
        await items.create(data);
      } else {
        await items.update(id!, data);
      }
      navigate("/items");
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  const isWeapon = item.type === "weapon";
  const isArmor = item.type === "armor";
  const isEquipment = isWeapon || isArmor || item.type === "accessory";
  const isConsumable = item.type === "consumable";

  // Rarity color from types
  const rarityEntry = lookup("rarities", item.rarity);
  const rarityColor = rarityEntry?.color || "#aaa";

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ color: "#e0c097", margin: 0 }}>
          {isNew ? "New Item" : <>Edit: <span style={{ color: rarityColor }}>{item.name}</span></>}
        </h1>
        <button onClick={() => navigate("/items")} style={btnDanger}>Cancel</button>
      </div>

      {error && <div style={{ color: "#f88", marginBottom: "1rem" }}>{error}</div>}

      {/* Core fields */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <FormField label="ID" hint="Unique identifier, used in YAML filenames">
          <input style={inputStyle} value={item.id} onChange={(e) => update({ id: e.target.value })} disabled={!isNew} />
        </FormField>
        <FormField label="Name">
          <input style={inputStyle} value={item.name} onChange={(e) => update({ name: e.target.value })} />
        </FormField>
        <FormField label="Type">
          <TypeSelect category="item_types" value={item.type} onChange={(v) => update({ type: v })} allowEmpty={false} />
        </FormField>
        <FormField label="Rarity">
          <TypeSelect category="rarities" value={item.rarity} onChange={(v) => update({ rarity: v })} allowEmpty={false} />
        </FormField>
        <FormField label="Value" hint="Base currency value">
          <input style={inputStyle} type="number" value={item.value} onChange={(e) => update({ value: parseInt(e.target.value) || 0 })} />
        </FormField>
        <FormField label="Weight">
          <input style={inputStyle} type="number" step="0.1" value={item.weight} onChange={(e) => update({ weight: parseFloat(e.target.value) || 0 })} />
        </FormField>
        <FormField label="Icon" hint="Icon asset reference">
          <input style={inputStyle} value={item.icon} onChange={(e) => update({ icon: e.target.value })} />
        </FormField>
        <div style={{ display: "flex", gap: "1rem", alignItems: "end" }}>
          <FormField label="Stackable">
            <input type="checkbox" checked={item.stackable} onChange={(e) => update({ stackable: e.target.checked })} />
          </FormField>
          {item.stackable && (
            <FormField label="Max Stack">
              <input style={{ ...inputStyle, width: 80 }} type="number" value={item.max_stack} onChange={(e) => update({ max_stack: parseInt(e.target.value) || 1 })} />
            </FormField>
          )}
        </div>
      </div>

      <FormField label="Description">
        <textarea style={textareaStyle} value={item.description} onChange={(e) => update({ description: e.target.value })} />
      </FormField>

      {/* Equipment fields */}
      {isEquipment && (
        <Section title="Equipment">
          <FormField label="Slot">
            <TypeSelect category="equipment_slots" value={item.slot || ""} onChange={(v) => update({ slot: v })} emptyLabel="Select slot..." />
          </FormField>
          <FormField label="Requirements" hint="Minimum stats to equip">
            <TypedKVEditor
              entries={item.requirements || {}}
              onChange={(requirements) => update({ requirements })}
              keyCategory="stats"
              valueType="number"
              valuePlaceholder="Min value"
            />
          </FormField>
        </Section>
      )}

      {/* Weapon fields */}
      {isWeapon && (
        <Section title="Weapon Stats">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <FormField label="Base Damage">
              <input style={inputStyle} type="number" value={item.damage || 0} onChange={(e) => update({ damage: parseInt(e.target.value) || 0 })} />
            </FormField>
            <FormField label="Damage Type">
              <TypeSelect category="damage_types" value={item.damage_type || ""} onChange={(v) => update({ damage_type: v })} emptyLabel="Select damage type..." />
            </FormField>
          </div>
          <FormField label="Stat Scaling" hint="Which stats affect damage">
            <TypedKVEditor
              entries={item.scaling || {}}
              onChange={(scaling) => update({ scaling })}
              keyCategory="stats"
              valueCategory="scaling_grades"
              valuePlaceholder="Grade"
            />
          </FormField>
        </Section>
      )}

      {/* Armor fields */}
      {isArmor && (
        <Section title="Armor Stats">
          <FormField label="Base Defense">
            <input style={inputStyle} type="number" value={item.defense || 0} onChange={(e) => update({ defense: parseInt(e.target.value) || 0 })} />
          </FormField>
          <FormField label="Resistances" hint="Damage type resistances (positive = resist, negative = weak)">
            <TypedKVEditor
              entries={item.resistances || {}}
              onChange={(resistances) => update({ resistances: Object.fromEntries(Object.entries(resistances).map(([k, v]) => [k, Number(v)])) })}
              keyCategory="damage_types"
              valueType="number"
              valuePlaceholder="Value"
            />
          </FormField>
        </Section>
      )}

      {/* Consumable fields */}
      {isConsumable && (
        <Section title="Consumable Effect">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <FormField label="Effect">
              <TypeSelect category="effect_types" value={item.effect || ""} onChange={(v) => update({ effect: v })} emptyLabel="Select effect..." />
            </FormField>
            <FormField label="Effect Value">
              <input style={inputStyle} type="number" value={item.effect_value || 0} onChange={(e) => update({ effect_value: parseInt(e.target.value) || 0 })} />
            </FormField>
            <FormField label="Duration (seconds)" hint="0 = instant">
              <input style={inputStyle} type="number" value={item.duration || 0} onChange={(e) => update({ duration: parseInt(e.target.value) || 0 })} />
            </FormField>
            <FormField label="Cooldown (seconds)">
              <input style={inputStyle} type="number" value={item.cooldown || 0} onChange={(e) => update({ cooldown: parseInt(e.target.value) || 0 })} />
            </FormField>
          </div>
        </Section>
      )}

      {/* Extras */}
      <Section title="Custom Fields (Extras)">
        <ExtrasEditor extras={item.extras} onChange={(extras) => update({ extras })} />
      </Section>

      <div style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
        <button onClick={save} disabled={saving} style={btnPrimary}>
          {saving ? "Saving..." : isNew ? "Create Item" : "Save Changes"}
        </button>
        <button onClick={() => navigate("/items")} style={btnDanger}>Cancel</button>
      </div>
    </div>
  );
}

function cleanForSave(item: ItemData): Record<string, unknown> {
  const data: Record<string, unknown> = { ...item };
  const isWeapon = item.type === "weapon";
  const isArmor = item.type === "armor";
  const isEquipment = isWeapon || isArmor || item.type === "accessory";
  const isConsumable = item.type === "consumable";

  if (!isWeapon) { delete data.damage; delete data.damage_type; delete data.scaling; }
  if (!isArmor) { delete data.defense; delete data.resistances; }
  if (!isEquipment) { delete data.slot; delete data.requirements; }
  if (!isConsumable) { delete data.effect; delete data.effect_value; delete data.duration; delete data.cooldown; }

  for (const key of Object.keys(data)) {
    const val = data[key];
    if (val === undefined || val === "") delete data[key];
    if (typeof val === "object" && val !== null && !Array.isArray(val) && Object.keys(val).length === 0 && key !== "extras") {
      delete data[key];
    }
  }
  return data;
}

// Key-value editor where keys and optionally values are validated against game types
function TypedKVEditor({ entries, onChange, keyCategory, valueCategory, valueType = "text", valuePlaceholder }: {
  entries: Record<string, any>;
  onChange: (entries: Record<string, any>) => void;
  keyCategory: string;
  valueCategory?: string;
  valueType?: "text" | "number";
  valuePlaceholder: string;
}) {
  const pairs = Object.entries(entries);

  const updateKey = (oldKey: string, newKey: string) => {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(entries)) {
      result[k === oldKey ? newKey : k] = v;
    }
    onChange(result);
  };

  const updateValue = (key: string, value: string) => {
    onChange({ ...entries, [key]: valueType === "number" ? (parseFloat(value) || 0) : value });
  };

  const remove = (key: string) => {
    const { [key]: _, ...rest } = entries;
    onChange(rest);
  };

  const add = () => {
    let key = "new";
    let i = 1;
    while (key in entries) key = `new_${i++}`;
    onChange({ ...entries, [key]: valueType === "number" ? 0 : "" });
  };

  return (
    <div>
      {pairs.map(([key, value]) => (
        <div key={key} style={{ display: "flex", gap: "0.5rem", marginBottom: 4, alignItems: "center" }}>
          <div style={{ width: "40%" }}>
            <TypeKeySelect category={keyCategory} value={key} onChange={(v) => updateKey(key, v)} />
          </div>
          <div style={{ flex: 1 }}>
            {valueCategory ? (
              <TypeSelect category={valueCategory} value={String(value)} onChange={(v) => updateValue(key, v)} allowEmpty={false} />
            ) : (
              <input
                style={inputStyle}
                type={valueType}
                value={String(value ?? "")}
                onChange={(e) => updateValue(key, e.target.value)}
                placeholder={valuePlaceholder}
              />
            )}
          </div>
          <button onClick={() => remove(key)} style={{ background: "none", border: "none", color: "#a33", cursor: "pointer", fontSize: "1rem" }}>
            x
          </button>
        </div>
      ))}
      <button onClick={add} style={addBtnStyle}>+ Add</button>
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
