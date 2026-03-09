import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { armor } from "../api/client";
import EntityList from "../components/EntityList";

interface ArmorSummary {
  id: string;
  name: string;
  rarity: string;
  equip_weight: number;
  mod_slots: number;
  file: string;
}

export default function Armor() {
  const [list, setList] = useState<ArmorSummary[]>([]);
  const navigate = useNavigate();

  const load = () => armor.list().then(setList);
  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    await armor.delete(id);
    load();
  };

  return (
    <EntityList
      title="Armor"
      items={list}
      columns={[
        { key: "id", label: "ID", width: "150px" },
        { key: "name", label: "Name", width: "200px" },
        { key: "rarity", label: "Rarity", width: "100px" },
        { key: "equip_weight", label: "Weight", width: "80px" },
        { key: "mod_slots", label: "Mod Slots", width: "80px" },
      ]}
      basePath="/armor"
      onDelete={handleDelete}
      onCreate={() => navigate("/armor/new")}
    />
  );
}
