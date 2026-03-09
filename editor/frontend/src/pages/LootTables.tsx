import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { lootTables } from "../api/client";
import EntityList from "../components/EntityList";

interface LootTableSummary {
  name: string;
  chance_any_drop: number;
  min_items: number;
  max_items: number;
  entry_count: number;
  file: string;
}

export default function LootTables() {
  const [list, setList] = useState<LootTableSummary[]>([]);
  const navigate = useNavigate();

  const load = () => lootTables.list().then(setList);
  useEffect(() => { load(); }, []);

  const handleDelete = async (name: string) => {
    await lootTables.delete(name);
    load();
  };

  return (
    <EntityList
      title="Loot Tables"
      items={list}
      idKey="name"
      columns={[
        { key: "name", label: "Name", width: "200px" },
        { key: "chance_any_drop", label: "Drop Chance", width: "100px" },
        { key: "min_items", label: "Min", width: "60px" },
        { key: "max_items", label: "Max", width: "60px" },
        { key: "entry_count", label: "Entries", width: "80px" },
      ]}
      basePath="/loot-tables"
      onDelete={handleDelete}
      onCreate={() => navigate("/loot-tables/new")}
    />
  );
}
