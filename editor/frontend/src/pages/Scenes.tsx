import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { scenes } from "../api/client";
import EntityList from "../components/EntityList";

export default function Scenes() {
  const [items, setItems] = useState<any[]>([]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const placeId = searchParams.get("place_id") || undefined;

  const load = () => scenes.list(placeId).then(setItems);
  useEffect(() => { load(); }, [placeId]);

  return (
    <EntityList
      title={placeId ? `Scenes in ${placeId}` : "All Scenes"}
      items={items}
      columns={[
        { key: "id", label: "ID", width: "180px" },
        { key: "name", label: "Name", width: "180px" },
        { key: "place_id", label: "Place", width: "150px" },
        { key: "type", label: "Type", width: "120px" },
        { key: "default_npcs", label: "NPCs" },
      ]}
      basePath="/scenes"
      onDelete={async (id) => { await scenes.delete(id); load(); }}
      onCreate={() => navigate(placeId ? `/scenes/new?place_id=${placeId}` : "/scenes/new")}
    />
  );
}
