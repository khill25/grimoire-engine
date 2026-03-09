import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { weapons } from "../api/client";
import EntityList from "../components/EntityList";

interface WeaponSummary {
  id: string;
  name: string;
  rarity: string;
  weapon_kind: string;
  damage_type: string;
  base_damage: number;
  file: string;
}

export default function Weapons() {
  const [list, setList] = useState<WeaponSummary[]>([]);
  const navigate = useNavigate();

  const load = () => weapons.list().then(setList);
  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    await weapons.delete(id);
    load();
  };

  return (
    <EntityList
      title="Weapons"
      items={list}
      columns={[
        { key: "id", label: "ID", width: "150px" },
        { key: "name", label: "Name", width: "180px" },
        { key: "weapon_kind", label: "Kind", width: "100px" },
        { key: "damage_type", label: "Damage Type", width: "120px" },
        { key: "rarity", label: "Rarity", width: "100px" },
        { key: "base_damage", label: "Damage", width: "80px" },
      ]}
      basePath="/weapons"
      onDelete={handleDelete}
      onCreate={() => navigate("/weapons/new")}
    />
  );
}
