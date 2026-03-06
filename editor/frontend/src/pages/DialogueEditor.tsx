import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { dialogue } from "../api/client";
import FormField, { inputStyle, textareaStyle, selectStyle, btnPrimary, btnDanger } from "../components/FormField";
import ConditionBuilder from "../components/ConditionBuilder";
import StateChangesEditor from "../components/StateChangesEditor";
import type { DialogueTree, DialogueNode, DialogueChoice } from "../types/models";

const emptyTree: DialogueTree = {
  id: "", character_id: "", context: "", root_node: "greeting",
  nodes: [{ id: "greeting", speaker: "", text: "", condition: null, state_changes: null, choices: [], llm_escape: false, is_key_moment: false }],
  extras: {},
};

export default function DialogueEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";
  const [tree, setTree] = useState<DialogueTree>(emptyTree);
  const [selectedNode, setSelectedNode] = useState<string>("greeting");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isNew && id) {
      dialogue.get(id).then((data) => {
        setTree(data);
        setSelectedNode(data.root_node || data.nodes[0]?.id || "");
      }).catch(() => setError("Dialogue tree not found"));
    }
  }, [id, isNew]);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      if (isNew) await dialogue.create(tree);
      else await dialogue.update(id!, tree);
      navigate("/dialogue");
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  const currentNode = tree.nodes.find((n) => n.id === selectedNode);

  const updateNode = useCallback((patch: Partial<DialogueNode>) => {
    setTree((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => n.id === selectedNode ? { ...n, ...patch } : n),
    }));
  }, [selectedNode]);

  const addNode = () => {
    const nodeId = `node_${tree.nodes.length + 1}`;
    setTree((prev) => ({
      ...prev,
      nodes: [...prev.nodes, {
        id: nodeId, speaker: tree.character_id, text: "", condition: null,
        state_changes: null, choices: [], llm_escape: false, is_key_moment: false,
      }],
    }));
    setSelectedNode(nodeId);
  };

  const deleteNode = (nodeId: string) => {
    if (nodeId === tree.root_node) return;
    setTree((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => n.id !== nodeId),
    }));
    if (selectedNode === nodeId) {
      setSelectedNode(tree.root_node);
    }
  };

  const updateChoice = (nodeId: string, choiceIdx: number, patch: Partial<DialogueChoice>) => {
    setTree((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const choices = [...n.choices];
        choices[choiceIdx] = { ...choices[choiceIdx], ...patch };
        return { ...n, choices };
      }),
    }));
  };

  const addChoice = () => {
    if (!currentNode) return;
    updateNode({
      choices: [...currentNode.choices, { id: `choice_${currentNode.choices.length + 1}`, text: "", next_node: "", condition: null, embedding: null }],
    });
  };

  const removeChoice = (idx: number) => {
    if (!currentNode) return;
    updateNode({ choices: currentNode.choices.filter((_, i) => i !== idx) });
  };

  return (
    <div style={{ display: "flex", gap: "1rem", height: "calc(100vh - 3rem)" }}>
      {/* Node list sidebar */}
      <div style={{ width: 220, flexShrink: 0, overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <h3 style={{ color: "#e0c097", margin: 0 }}>Nodes</h3>
          <button onClick={addNode} style={{ ...addBtnStyle, width: "auto", padding: "2px 8px" }}>+</button>
        </div>
        {tree.nodes.map((node) => (
          <div
            key={node.id}
            onClick={() => setSelectedNode(node.id)}
            style={{
              padding: "0.4rem 0.6rem",
              background: node.id === selectedNode ? "#16213e" : "transparent",
              borderLeft: node.id === selectedNode ? "3px solid #e0c097" : "3px solid transparent",
              color: node.id === tree.root_node ? "#e0c097" : "#ccc",
              cursor: "pointer",
              fontSize: "0.85rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{node.id}{node.id === tree.root_node ? " (root)" : ""}</span>
            {node.id !== tree.root_node && (
              <button
                onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}
                style={{ background: "none", border: "none", color: "#a33", cursor: "pointer", fontSize: "0.7rem" }}
              >X</button>
            )}
          </div>
        ))}
      </div>

      {/* Main editor */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h1 style={{ color: "#e0c097", margin: 0 }}>{isNew ? "New Dialogue Tree" : `Edit: ${tree.id}`}</h1>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {!isNew && <button onClick={() => navigate(`/dialogue/${id}/graph`)} style={{ ...btnPrimary, borderColor: "#97b8e0", color: "#97b8e0" }}>Graph View</button>}
            <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? "Saving..." : "Save"}</button>
            <button onClick={() => navigate("/dialogue")} style={btnDanger}>Cancel</button>
          </div>
        </div>

        {error && <div style={{ color: "#f88", marginBottom: "1rem" }}>{error}</div>}

        {/* Tree metadata */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "0.5rem", marginBottom: "1.5rem" }}>
          <FormField label="Tree ID">
            <input style={inputStyle} value={tree.id} onChange={(e) => setTree({ ...tree, id: e.target.value })} disabled={!isNew} />
          </FormField>
          <FormField label="Character ID">
            <input style={inputStyle} value={tree.character_id} onChange={(e) => setTree({ ...tree, character_id: e.target.value })} />
          </FormField>
          <FormField label="Context" hint="When this tree activates, e.g. first_meeting, quest_active">
            <input style={inputStyle} value={tree.context} onChange={(e) => setTree({ ...tree, context: e.target.value })} placeholder="first_meeting, quest_active..." />
          </FormField>
          <FormField label="Root Node">
            <select style={selectStyle} value={tree.root_node} onChange={(e) => setTree({ ...tree, root_node: e.target.value })}>
              {tree.nodes.map((n) => <option key={n.id} value={n.id}>{n.id}</option>)}
            </select>
          </FormField>
        </div>

        {/* Selected node editor */}
        {currentNode && (
          <div style={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 4, padding: "1rem" }}>
            <h3 style={{ color: "#e0c097", margin: "0 0 1rem 0" }}>Node: {currentNode.id}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              <FormField label="Node ID">
                <input style={inputStyle} value={currentNode.id} onChange={(e) => {
                  const oldId = currentNode.id;
                  const newId = e.target.value;
                  setTree((prev) => ({
                    ...prev,
                    root_node: prev.root_node === oldId ? newId : prev.root_node,
                    nodes: prev.nodes.map((n) => n.id === oldId ? { ...n, id: newId } : n),
                  }));
                  setSelectedNode(newId);
                }} />
              </FormField>
              <FormField label="Speaker">
                <input style={inputStyle} value={currentNode.speaker} onChange={(e) => updateNode({ speaker: e.target.value })} />
              </FormField>
            </div>
            <FormField label="Text">
              <textarea style={{ ...textareaStyle, minHeight: 120 }} value={currentNode.text} onChange={(e) => updateNode({ text: e.target.value })} />
            </FormField>
            <FormField label="Condition" hint="When set, this node is only reachable if the condition is met.">
              <ConditionBuilder
                key={currentNode.id + "-cond"}
                value={currentNode.condition}
                onChange={(c) => updateNode({ condition: c })}
              />
            </FormField>
            <FormField label="State Changes" hint="Flags set when this node fires. These become available as conditions in other nodes and beat triggers.">
              <StateChangesEditor
                key={currentNode.id + "-sc"}
                value={currentNode.state_changes}
                onChange={(sc) => updateNode({ state_changes: sc })}
              />
            </FormField>
            <div style={{ display: "flex", gap: "1.5rem", marginBottom: "0.5rem" }}>
              <label style={{ color: "#ccc", fontSize: "0.85rem" }} title="When enabled, the LLM can generate responses at this node instead of using only the authored text.">
                <input type="checkbox" checked={currentNode.llm_escape} onChange={(e) => updateNode({ llm_escape: e.target.checked })} /> LLM Escape
              </label>
              <label style={{ color: "#ccc", fontSize: "0.85rem" }} title="When enabled, the authored text is always used verbatim. The LLM will never replace or alter it.">
                <input type="checkbox" checked={currentNode.is_key_moment} onChange={(e) => updateNode({ is_key_moment: e.target.checked })} /> Key Moment
              </label>
            </div>
            <div style={{ fontSize: "0.75rem", color: "#555", marginBottom: "1rem" }}>
              LLM Escape = LLM can improvise here. Key Moment = always use authored text exactly.
            </div>

            {/* Choices */}
            <h4 style={{ color: "#e0c097", marginTop: "1rem" }}>Choices</h4>
            {currentNode.choices.map((choice, i) => (
              <div key={i} style={{ background: "#0f0f23", border: "1px solid #333", borderRadius: 4, padding: "0.5rem", marginBottom: "0.5rem", position: "relative" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <FormField label="Choice ID">
                    <input style={inputStyle} value={choice.id} onChange={(e) => updateChoice(currentNode.id, i, { id: e.target.value })} />
                  </FormField>
                  <FormField label="Next Node">
                    <select style={selectStyle} value={choice.next_node} onChange={(e) => updateChoice(currentNode.id, i, { next_node: e.target.value })}>
                      <option value="">-- select --</option>
                      {tree.nodes.filter((n) => n.id !== currentNode.id).map((n) => (
                        <option key={n.id} value={n.id}>{n.id}</option>
                      ))}
                    </select>
                  </FormField>
                </div>
                <FormField label="Choice Text">
                  <input style={inputStyle} placeholder="What the player says" value={choice.text} onChange={(e) => updateChoice(currentNode.id, i, { text: e.target.value })} />
                </FormField>
                <FormField label="Condition" hint="Only show this choice when condition is met.">
                  <ConditionBuilder
                    key={`${currentNode.id}-choice-${i}-cond`}
                    value={choice.condition}
                    onChange={(c) => updateChoice(currentNode.id, i, { condition: c })}
                  />
                </FormField>
                <button style={{ position: "absolute", top: 4, right: 4, background: "none", border: "none", color: "#a33", cursor: "pointer" }} onClick={() => removeChoice(i)}>×</button>
              </div>
            ))}
            <button onClick={addChoice} style={addBtnStyle}>+ Add Choice</button>
          </div>
        )}
      </div>
    </div>
  );
}

const addBtnStyle: React.CSSProperties = {
  background: "transparent", color: "#e0c097", border: "1px dashed #555",
  padding: "0.4rem 1rem", borderRadius: 4, cursor: "pointer", fontSize: "0.85rem",
  width: "100%", marginTop: 4,
};
