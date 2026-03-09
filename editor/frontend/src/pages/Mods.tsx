import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { mods } from "../api/client";
import EntityList from "../components/EntityList";

interface ModSummary {
  id: string;
  name: string;
  rarity: string;
  kind: string;
  slot_type: string;
  file: string;
}

export default function Mods() {
  const [list, setList] = useState<ModSummary[]>([]);
  const navigate = useNavigate();

  const load = () => mods.list().then(setList);
  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    await mods.delete(id);
    load();
  };

  return (
    <EntityList
      title="Mods"
      items={list}
      columns={[
        { key: "id", label: "ID", width: "150px" },
        { key: "name", label: "Name", width: "200px" },
        { key: "kind", label: "Kind", width: "100px" },
        { key: "slot_type", label: "Slot", width: "120px" },
        { key: "rarity", label: "Rarity", width: "100px" },
      ]}
      basePath="/mods"
      onDelete={handleDelete}
      onCreate={() => navigate("/mods/new")}
    />
  );
}
