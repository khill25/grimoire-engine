import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { places } from "../api/client";
import EntityList from "../components/EntityList";

export default function Places() {
  const [items, setItems] = useState<any[]>([]);
  const navigate = useNavigate();

  const load = () => places.list().then(setItems);
  useEffect(() => { load(); }, []);

  return (
    <EntityList
      title="Places"
      items={items}
      columns={[
        { key: "id", label: "ID", width: "150px" },
        { key: "name", label: "Name", width: "200px" },
        { key: "type", label: "Type", width: "120px" },
        { key: "region", label: "Region", width: "150px" },
        { key: "connections", label: "Connections" },
      ]}
      basePath="/places"
      onDelete={async (id) => { await places.delete(id); load(); }}
      onCreate={() => navigate("/places/new")}
    />
  );
}
