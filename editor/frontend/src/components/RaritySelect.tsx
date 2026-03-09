import { selectStyle } from "./FormField";

const RARITIES = [
  { id: "common", label: "Common", color: "#ffffff" },
  { id: "rare", label: "Rare", color: "#4488ff" },
  { id: "exotic", label: "Exotic", color: "#44cc66" },
  { id: "legendary", label: "Legendary", color: "#ff9922" },
  { id: "unique", label: "Unique", color: "#ffd700" },
] as const;

const COLOR_MAP: Record<string, string> = Object.fromEntries(
  RARITIES.map((r) => [r.id, r.color])
);

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function RaritySelect({ value, onChange }: Props) {
  const color = COLOR_MAP[value] || "#aaa";

  return (
    <select
      style={{ ...selectStyle, color, fontWeight: 600 }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {RARITIES.map((r) => (
        <option key={r.id} value={r.id} style={{ color: r.color, background: "#1a1a2e" }}>
          {r.label}
        </option>
      ))}
    </select>
  );
}

/** Get the UI color for a rarity ID */
export function rarityColor(id: string): string {
  return COLOR_MAP[id] || "#aaa";
}
