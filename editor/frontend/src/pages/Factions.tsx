import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { factions } from "../api/client";
import EntityList from "../components/EntityList";

export default function Factions() {
  const [items, setItems] = useState<any[]>([]);
  const navigate = useNavigate();

  const load = () => factions.list().then(setItems);
  useEffect(() => { load(); }, []);

  return (
    <EntityList
      title="Factions"
      items={items}
      columns={[
        { key: "id", label: "ID", width: "200px" },
        { key: "name", label: "Name", width: "250px" },
        { key: "member_ids", label: "Members" },
        { key: "reputation_with_player", label: "Reputation", width: "100px" },
      ]}
      basePath="/factions"
      onDelete={async (id) => { await factions.delete(id); load(); }}
      onCreate={() => navigate("/factions/new")}
    />
  );
}
