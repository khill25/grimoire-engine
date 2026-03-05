import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { characters, generate } from "../api/client";
import EntityList from "../components/EntityList";
import GenerateModal from "../components/GenerateModal";
import type { CharacterSummary } from "../types/models";

export default function Characters() {
  const [items, setItems] = useState<CharacterSummary[]>([]);
  const [showGenerate, setShowGenerate] = useState(false);
  const navigate = useNavigate();

  const load = () => characters.list().then(setItems);
  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    await characters.delete(id);
    load();
  };

  const handleGenerate = async (prompt: string, provider: string) => {
    const res = await generate.character(prompt, provider);
    const char = res.generated;
    await characters.create(char);
    load();
    navigate(`/characters/${char.id}`);
  };

  return (
    <>
      <EntityList
        title="Characters"
        items={items}
        columns={[
          { key: "id", label: "ID", width: "150px" },
          { key: "name", label: "Name", width: "200px" },
          { key: "occupation", label: "Occupation" },
          { key: "location", label: "Location", width: "150px" },
          { key: "status", label: "Status", width: "100px" },
        ]}
        basePath="/characters"
        onDelete={handleDelete}
        onCreate={() => navigate("/characters/new")}
      />
      <button
        onClick={() => setShowGenerate(true)}
        style={{ marginTop: "1rem", background: "#2a1a3e", color: "#c097e0", border: "1px solid #c097e0", padding: "0.5rem 1.5rem", borderRadius: 4, cursor: "pointer" }}
      >
        Generate with AI
      </button>
      {showGenerate && (
        <GenerateModal
          title="Generate Character"
          placeholder="e.g. A grizzled mechanic who secretly runs a gambling ring in the cargo bay. Distrusts authority but is loyal to friends."
          onGenerate={handleGenerate}
          onClose={() => setShowGenerate(false)}
        />
      )}
    </>
  );
}
