import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { items } from "../api/client";
import EntityList from "../components/EntityList";

interface ItemSummary {
  id: string;
  name: string;
  type: string;
  rarity: string;
  value: number;
  file: string;
}

export default function Items() {
  const [list, setList] = useState<ItemSummary[]>([]);
  const navigate = useNavigate();

  const load = () => items.list().then(setList);
  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    await items.delete(id);
    load();
  };

  return (
    <EntityList
      title="Items"
      items={list}
      columns={[
        { key: "id", label: "ID", width: "150px" },
        { key: "name", label: "Name", width: "200px" },
        { key: "type", label: "Type", width: "120px" },
        { key: "rarity", label: "Rarity", width: "100px" },
        { key: "value", label: "Value", width: "80px" },
      ]}
      basePath="/items"
      onDelete={handleDelete}
      onCreate={() => navigate("/items/new")}
    />
  );
}
