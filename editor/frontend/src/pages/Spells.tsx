import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { spells } from "../api/client";
import EntityList from "../components/EntityList";

interface SpellSummary {
  id: string;
  name: string;
  rarity: string;
  damage_type: string;
  mana_cost: number;
  base_damage: number;
  file: string;
}

export default function Spells() {
  const [list, setList] = useState<SpellSummary[]>([]);
  const navigate = useNavigate();

  const load = () => spells.list().then(setList);
  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    await spells.delete(id);
    load();
  };

  return (
    <EntityList
      title="Spells"
      items={list}
      columns={[
        { key: "id", label: "ID", width: "150px" },
        { key: "name", label: "Name", width: "200px" },
        { key: "damage_type", label: "Damage Type", width: "120px" },
        { key: "rarity", label: "Rarity", width: "100px" },
        { key: "mana_cost", label: "Mana", width: "80px" },
        { key: "base_damage", label: "Damage", width: "80px" },
      ]}
      basePath="/spells"
      onDelete={handleDelete}
      onCreate={() => navigate("/spells/new")}
    />
  );
}
