import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { weapons } from "../api/client";
import { useGameTypes } from "../context/GameTypesContext";
import FormField, { inputStyle, textareaStyle, selectStyle, btnPrimary, btnDanger } from "../components/FormField";
import TypeSelect from "../components/TypeSelect";

interface AttackData {
  attack_index: number;
  damage_multiplier: number;
  windup_time: number;
  active_time: number;
  recovery_delay: number;
  stamina_cost: number;
}

interface WeaponData {
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
  // Shared Weapon fields
  weapon_kind: "sword" | "ranged";
  augment_slots: number;
  base_damage: number;
  crit_damage: number;
  crit_chance: number;
  damage_type: string;
  stamina_per_attack: number;
  armor_penetration: number;
  equip_weight: number;
  // Sword-only fields
  is_beam_sword: boolean;
  plasma_color: string;
  moveset: AttackData[];
  // Ranged-only fields
  damage_falloff_start: number;
  max_range: number;
  spread: number;
  fire_rate: number;
  bullet_size: number;
}

const emptyAttack: AttackData = {
  attack_index: 0, damage_multiplier: 1.0, windup_time: 0, active_time: 0,
  recovery_delay: 0, stamina_cost: 0,
};

const emptyWeapon: WeaponData = {
  id: "", icon: "", name: "", value: 0, rarity: "common", description: "",
  is_quest_item: false, is_sellable: true, stackable: false, is_consumable: false,
  unique_id: "",
  weapon_kind: "sword", augment_slots: 0, base_damage: 0, crit_damage: 1.5,
  crit_chance: 0.05, damage_type: "", stamina_per_attack: 0, armor_penetration: 0,
  equip_weight: 0,
  is_beam_sword: false, plasma_color: "#00ccff", moveset: [],
  damage_falloff_start: 0, max_range: 0, spread: 0, fire_rate: 0, bullet_size: 0,
};

export default function WeaponEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { lookup } = useGameTypes();
  const isNew = id === "new";
  const [weapon, setWeapon] = useState<WeaponData>(emptyWeapon);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isNew && id) {
      weapons.get(id).then((data) => {
        setWeapon({ ...emptyWeapon, ...data, moveset: data.moveset || [] });
      }).catch(() => setError("Weapon not found"));
    }
  }, [id, isNew]);

  const update = (patch: Partial<WeaponData>) => setWeapon({ ...weapon, ...patch });

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const data = cleanForSave(weapon);
      if (isNew) {
        await weapons.create(data);
      } else {
        await weapons.update(id!, data);
      }
      navigate("/weapons");
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  const isSword = weapon.weapon_kind === "sword";
  const isRanged = weapon.weapon_kind === "ranged";

  const rarityEntry = lookup("rarities", weapon.rarity);
  const rarityColor = rarityEntry?.color || "#aaa";

  const updateAttack = (i: number, patch: Partial<AttackData>) => {
    const moveset = [...weapon.moveset];
    moveset[i] = { ...moveset[i], ...patch };
    update({ moveset });
  };

  const addAttack = () => {
    const nextIndex = weapon.moveset.length;
    update({ moveset: [...weapon.moveset, { ...emptyAttack, attack_index: nextIndex }] });
  };

  const removeAttack = (i: number) => {
    update({ moveset: weapon.moveset.filter((_, j) => j !== i) });
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ color: "#e0c097", margin: 0 }}>
          {isNew ? "New Weapon" : <>Edit: <span style={{ color: rarityColor }}>{weapon.name}</span></>}
        </h1>
        <button onClick={() => navigate("/weapons")} style={btnDanger}>Cancel</button>
      </div>

      {error && <div style={{ color: "#f88", marginBottom: "1rem" }}>{error}</div>}

      {/* Base Item fields */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <FormField label="ID" hint="Unique identifier, used in JSON filenames">
          <input style={inputStyle} value={weapon.id} onChange={(e) => update({ id: e.target.value })} disabled={!isNew} />
        </FormField>
        <FormField label="Name">
          <input style={inputStyle} value={weapon.name} onChange={(e) => update({ name: e.target.value })} />
        </FormField>
        <FormField label="Rarity">
          <TypeSelect category="rarities" value={weapon.rarity} onChange={(v) => update({ rarity: v })} allowEmpty={false} />
        </FormField>
        <FormField label="Icon" hint="Icon asset reference">
          <input style={inputStyle} value={weapon.icon} onChange={(e) => update({ icon: e.target.value })} />
        </FormField>
        <FormField label="Value" hint="Base currency value">
          <input style={inputStyle} type="number" value={weapon.value} onChange={(e) => update({ value: parseInt(e.target.value) || 0 })} />
        </FormField>
        <FormField label="Weapon Kind">
          <select style={selectStyle} value={weapon.weapon_kind} onChange={(e) => update({ weapon_kind: e.target.value as "sword" | "ranged" })}>
            <option value="sword">Sword</option>
            <option value="ranged">Ranged</option>
          </select>
        </FormField>
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
          <FormField label="Quest Item">
            <input type="checkbox" checked={weapon.is_quest_item} onChange={(e) => update({ is_quest_item: e.target.checked })} />
          </FormField>
          <FormField label="Sellable">
            <input type="checkbox" checked={weapon.is_sellable} onChange={(e) => update({ is_sellable: e.target.checked })} />
          </FormField>
        </div>
        {weapon.rarity === "unique" && (
          <FormField label="Unique ID" hint="Blocks duplicate spawns">
            <input style={inputStyle} value={weapon.unique_id} onChange={(e) => update({ unique_id: e.target.value })} />
          </FormField>
        )}
      </div>

      <FormField label="Description">
        <textarea style={textareaStyle} value={weapon.description} onChange={(e) => update({ description: e.target.value })} />
      </FormField>

      {/* Shared Weapon Stats */}
      <Section title="Weapon Stats">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <FormField label="Base Damage">
            <input style={inputStyle} type="number" step="0.1" value={weapon.base_damage} onChange={(e) => update({ base_damage: parseFloat(e.target.value) || 0 })} />
          </FormField>
          <FormField label="Damage Type">
            <TypeSelect category="damage_types" value={weapon.damage_type} onChange={(v) => update({ damage_type: v })} emptyLabel="Select damage type..." />
          </FormField>
          <FormField label="Crit Chance" hint="e.g. 0.05 = 5%">
            <input style={inputStyle} type="number" step="0.01" min="0" max="1" value={weapon.crit_chance} onChange={(e) => update({ crit_chance: parseFloat(e.target.value) || 0 })} />
          </FormField>
          <FormField label="Crit Damage" hint="Multiplier, e.g. 1.5 = 150%">
            <input style={inputStyle} type="number" step="0.1" value={weapon.crit_damage} onChange={(e) => update({ crit_damage: parseFloat(e.target.value) || 0 })} />
          </FormField>
          <FormField label="Stamina per Attack">
            <input style={inputStyle} type="number" step="0.1" value={weapon.stamina_per_attack} onChange={(e) => update({ stamina_per_attack: parseFloat(e.target.value) || 0 })} />
          </FormField>
          <FormField label="Armor Penetration" hint="0.0–1.0 fraction bypassing armor">
            <input style={inputStyle} type="number" step="0.01" min="0" max="1" value={weapon.armor_penetration} onChange={(e) => update({ armor_penetration: parseFloat(e.target.value) || 0 })} />
          </FormField>
          <FormField label="Equip Weight">
            <input style={inputStyle} type="number" step="0.1" value={weapon.equip_weight} onChange={(e) => update({ equip_weight: parseFloat(e.target.value) || 0 })} />
          </FormField>
          <FormField label="Augment Slots">
            <input style={inputStyle} type="number" min="0" value={weapon.augment_slots} onChange={(e) => update({ augment_slots: parseInt(e.target.value) || 0 })} />
          </FormField>
        </div>
      </Section>

      {/* Sword-only fields */}
      {isSword && (
        <Section title="Sword">
          <div style={{ display: "flex", gap: "1.5rem", alignItems: "end", marginBottom: "1rem" }}>
            <FormField label="Beam Sword">
              <input type="checkbox" checked={weapon.is_beam_sword} onChange={(e) => update({ is_beam_sword: e.target.checked })} />
            </FormField>
            {weapon.is_beam_sword && (
              <FormField label="Plasma Color">
                <input
                  type="color"
                  value={weapon.plasma_color}
                  onChange={(e) => update({ plasma_color: e.target.value })}
                  style={{ width: 60, height: 32, border: "1px solid #333", borderRadius: 4, background: "#1a1a2e", cursor: "pointer" }}
                />
              </FormField>
            )}
          </div>

          <h4 style={{ color: "#e0c097", margin: "1rem 0 0.5rem" }}>Moveset</h4>
          {weapon.moveset.map((atk, i) => (
            <div key={i} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span style={{ color: "#e0c097", fontSize: "0.85rem" }}>Attack {i + 1}</span>
                <button onClick={() => removeAttack(i)} style={{ background: "none", border: "none", color: "#a33", cursor: "pointer" }}>x</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                <FormField label="Index">
                  <input style={inputStyle} type="number" value={atk.attack_index} onChange={(e) => updateAttack(i, { attack_index: parseInt(e.target.value) || 0 })} />
                </FormField>
                <FormField label="Damage Mult">
                  <input style={inputStyle} type="number" step="0.1" value={atk.damage_multiplier} onChange={(e) => updateAttack(i, { damage_multiplier: parseFloat(e.target.value) || 0 })} />
                </FormField>
                <FormField label="Stamina Cost">
                  <input style={inputStyle} type="number" step="0.1" value={atk.stamina_cost} onChange={(e) => updateAttack(i, { stamina_cost: parseFloat(e.target.value) || 0 })} />
                </FormField>
                <FormField label="Windup (s)">
                  <input style={inputStyle} type="number" step="0.01" value={atk.windup_time} onChange={(e) => updateAttack(i, { windup_time: parseFloat(e.target.value) || 0 })} />
                </FormField>
                <FormField label="Active (s)">
                  <input style={inputStyle} type="number" step="0.01" value={atk.active_time} onChange={(e) => updateAttack(i, { active_time: parseFloat(e.target.value) || 0 })} />
                </FormField>
                <FormField label="Recovery (s)" hint="Reduced by Mind at runtime">
                  <input style={inputStyle} type="number" step="0.01" value={atk.recovery_delay} onChange={(e) => updateAttack(i, { recovery_delay: parseFloat(e.target.value) || 0 })} />
                </FormField>
              </div>
            </div>
          ))}
          <button onClick={addAttack} style={addBtnStyle}>+ Add Attack</button>
        </Section>
      )}

      {/* Ranged-only fields */}
      {isRanged && (
        <Section title="Ranged">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <FormField label="Plasma Color">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="color"
                  value={weapon.plasma_color}
                  onChange={(e) => update({ plasma_color: e.target.value })}
                  style={{ width: 60, height: 32, border: "1px solid #333", borderRadius: 4, background: "#1a1a2e", cursor: "pointer" }}
                />
                <span style={{ color: "#888", fontSize: "0.8rem" }}>{weapon.plasma_color}</span>
              </div>
            </FormField>
            <FormField label="Damage Falloff Start" hint="Distance (m) where damage begins to fall">
              <input style={inputStyle} type="number" step="0.1" value={weapon.damage_falloff_start} onChange={(e) => update({ damage_falloff_start: parseFloat(e.target.value) || 0 })} />
            </FormField>
            <FormField label="Max Range" hint="Distance (m) where damage reaches minimum">
              <input style={inputStyle} type="number" step="0.1" value={weapon.max_range} onChange={(e) => update({ max_range: parseFloat(e.target.value) || 0 })} />
            </FormField>
            <FormField label="Spread" hint="Cone half-angle in degrees">
              <input style={inputStyle} type="number" step="0.1" value={weapon.spread} onChange={(e) => update({ spread: parseFloat(e.target.value) || 0 })} />
            </FormField>
            <FormField label="Fire Rate" hint="Shots per second">
              <input style={inputStyle} type="number" step="0.1" value={weapon.fire_rate} onChange={(e) => update({ fire_rate: parseFloat(e.target.value) || 0 })} />
            </FormField>
            <FormField label="Bullet Size" hint="Projectile collider radius">
              <input style={inputStyle} type="number" step="0.01" value={weapon.bullet_size} onChange={(e) => update({ bullet_size: parseFloat(e.target.value) || 0 })} />
            </FormField>
          </div>
        </Section>
      )}

      <div style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
        <button onClick={save} disabled={saving} style={btnPrimary}>
          {saving ? "Saving..." : isNew ? "Create Weapon" : "Save Changes"}
        </button>
        <button onClick={() => navigate("/weapons")} style={btnDanger}>Cancel</button>
      </div>
    </div>
  );
}

function cleanForSave(weapon: WeaponData): Record<string, unknown> {
  const data: Record<string, unknown> = { ...weapon };
  const isSword = weapon.weapon_kind === "sword";
  const isRanged = weapon.weapon_kind === "ranged";

  // Remove subtype fields that don't apply
  if (!isSword) {
    delete data.is_beam_sword;
    delete data.moveset;
  }
  if (!isRanged) {
    delete data.damage_falloff_start;
    delete data.max_range;
    delete data.spread;
    delete data.fire_rate;
    delete data.bullet_size;
  }
  // Plasma color: only on beam swords or ranged weapons
  if (!(isSword && weapon.is_beam_sword) && !isRanged) {
    delete data.plasma_color;
  }
  if (weapon.rarity !== "unique") delete data.unique_id;
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

const cardStyle: React.CSSProperties = {
  background: "#1a1a2e",
  border: "1px solid #333",
  borderRadius: 6,
  padding: "0.75rem",
  marginBottom: "0.5rem",
};

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
