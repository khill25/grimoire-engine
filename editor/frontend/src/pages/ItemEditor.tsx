import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { items } from "../api/client";
import FormField, { inputStyle, textareaStyle, btnPrimary, btnDanger } from "../components/FormField";
import RaritySelect, { rarityColor } from "../components/RaritySelect";
import ExtrasEditor from "../components/ExtrasEditor";

interface ItemData {
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
  extras: Record<string, unknown>;
}

const emptyItem: ItemData = {
  id: "", icon: "", name: "", value: 0, rarity: "common", description: "",
  is_quest_item: false, is_sellable: true, stackable: true, is_consumable: false,
  unique_id: "", extras: {},
};

export default function ItemEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
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

  const rColor = rarityColor(item.rarity);

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ color: "#e0c097", margin: 0 }}>
          {isNew ? "New Item" : <>Edit: <span style={{ color: rColor }}>{item.name}</span></>}
        </h1>
        <button onClick={() => navigate("/items")} style={btnDanger}>Cancel</button>
      </div>

      {error && <div style={{ color: "#f88", marginBottom: "1rem" }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <FormField label="ID" hint="Unique identifier, used in JSON filenames">
          <input style={inputStyle} value={item.id} onChange={(e) => update({ id: e.target.value })} disabled={!isNew} />
        </FormField>
        <FormField label="Name">
          <input style={inputStyle} value={item.name} onChange={(e) => update({ name: e.target.value })} />
        </FormField>
        <FormField label="Rarity">
          <RaritySelect value={item.rarity} onChange={(v) => update({ rarity: v })} />
        </FormField>
        <FormField label="Icon" hint="Icon asset reference">
          <input style={inputStyle} value={item.icon} onChange={(e) => update({ icon: e.target.value })} />
        </FormField>
        <FormField label="Value" hint="Sell/buy price in credits">
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
          <FormField label="Stackable">
            <input type="checkbox" checked={item.stackable} onChange={(e) => update({ stackable: e.target.checked })} />
          </FormField>
          <FormField label="Consumable">
            <input type="checkbox" checked={item.is_consumable} onChange={(e) => update({ is_consumable: e.target.checked })} />
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
  if (item.rarity !== "unique") delete data.unique_id;
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (val === undefined || val === "") delete data[key];
    if (typeof val === "object" && val !== null && !Array.isArray(val) && Object.keys(val).length === 0 && key !== "extras") {
      delete data[key];
    }
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
