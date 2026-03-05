import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { dialogue, generate } from "../api/client";
import EntityList from "../components/EntityList";
import GenerateModal from "../components/GenerateModal";

export default function Dialogue() {
  const [items, setItems] = useState<any[]>([]);
  const [showGenerate, setShowGenerate] = useState(false);
  const navigate = useNavigate();

  const load = () => dialogue.list().then(setItems);
  useEffect(() => { load(); }, []);

  const handleGenerate = async (prompt: string, provider: string) => {
    const res = await generate.dialogue(prompt, provider);
    const tree = res.generated;
    await dialogue.create(tree);
    load();
    navigate(`/dialogue/${tree.id}`);
  };

  return (
    <>
      <EntityList
        title="Dialogue Trees"
        items={items}
        columns={[
          { key: "id", label: "ID", width: "200px" },
          { key: "character_id", label: "Character", width: "150px" },
          { key: "context", label: "Context" },
          { key: "node_count", label: "Nodes", width: "80px" },
        ]}
        basePath="/dialogue"
        onDelete={async (id) => { await dialogue.delete(id); load(); }}
        onCreate={() => navigate("/dialogue/new")}
      />
      <button
        onClick={() => setShowGenerate(true)}
        style={{ marginTop: "1rem", background: "#2a1a3e", color: "#c097e0", border: "1px solid #c097e0", padding: "0.5rem 1.5rem", borderRadius: 4, cursor: "pointer" }}
      >
        Generate with AI
      </button>
      {showGenerate && (
        <GenerateModal
          title="Generate Dialogue Tree"
          placeholder="e.g. A conversation with Mira where the player can ask about the union, her father, or order a drink. Should branch based on trust level."
          onGenerate={handleGenerate}
          onClose={() => setShowGenerate(false)}
        />
      )}
    </>
  );
}
