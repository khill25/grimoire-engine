import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { dialogue } from "../api/client";
import GraphSidePanel from "../components/GraphSidePanel";
import FormField, { inputStyle, textareaStyle, selectStyle, btnPrimary, btnDanger } from "../components/FormField";
import type { DialogueTree, DialogueNode as DNode, DialogueChoice } from "../types/models";

// --- Custom dialogue node ---
function DialogueNodeComponent({ data }: NodeProps) {
  const isRoot = data.isRoot as boolean;
  const isKeyMoment = data.isKeyMoment as boolean;
  const hasLlmEscape = data.llmEscape as boolean;
  const choiceCount = (data.choices as string[])?.length || 0;

  let borderColor = "#444";
  if (data.selected) borderColor = "#e0c097";
  else if (isRoot) borderColor = "#8b8";
  else if (isKeyMoment) borderColor = "#e08097";

  return (
    <div
      style={{
        background: "#1a1a2e",
        border: `2px solid ${borderColor}`,
        borderRadius: 8,
        padding: "0.5rem 0.7rem",
        minWidth: 180,
        maxWidth: 240,
        cursor: "pointer",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: "#666" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: isRoot ? "#8b8" : "#e0c097", fontWeight: 600, fontSize: "0.75rem" }}>
          {data.label as string}
          {isRoot && " (root)"}
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          {isKeyMoment && <span title="Key moment" style={{ fontSize: "0.6rem" }}>⭐</span>}
          {hasLlmEscape && <span title="LLM escape" style={{ fontSize: "0.6rem" }}>🤖</span>}
        </div>
      </div>
      <div style={{ color: "#aaa", fontSize: "0.7rem", marginTop: 3, lineHeight: 1.3, maxHeight: 40, overflow: "hidden" }}>
        {(data.text as string)?.slice(0, 80)}{(data.text as string)?.length > 80 ? "..." : ""}
      </div>
      {choiceCount > 0 && (
        <div style={{ color: "#97b8e0", fontSize: "0.6rem", marginTop: 4 }}>
          {choiceCount} choice{choiceCount !== 1 ? "s" : ""}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: "#666" }} />
    </div>
  );
}

const nodeTypes = { dialogue: DialogueNodeComponent };

// --- Layout: tree structure ---
function layoutTree(tree: DialogueTree): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const nodeMap = new Map(tree.nodes.map((n) => [n.id, n]));

  // BFS to determine levels
  const levels: Map<string, number> = new Map();
  const colAtLevel: Map<number, number> = new Map();
  const queue = [tree.root_node];
  levels.set(tree.root_node, 0);
  const visited = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = nodeMap.get(id);
    if (!node) continue;
    const level = levels.get(id) || 0;

    for (const choice of node.choices) {
      if (choice.next_node && !levels.has(choice.next_node)) {
        levels.set(choice.next_node, level + 1);
        queue.push(choice.next_node);
      }
    }
  }

  // Place unvisited nodes at the bottom
  for (const n of tree.nodes) {
    if (!levels.has(n.id)) {
      const maxLevel = Math.max(0, ...Array.from(levels.values()));
      levels.set(n.id, maxLevel + 1);
    }
  }

  // Count nodes per level for horizontal spacing
  const nodesPerLevel: Map<number, string[]> = new Map();
  for (const [id, level] of levels) {
    (nodesPerLevel.get(level) || (() => { nodesPerLevel.set(level, []); return nodesPerLevel.get(level)!; })()).push(id);
  }

  // Position nodes
  for (const [id, level] of levels) {
    const siblings = nodesPerLevel.get(level) || [id];
    const col = siblings.indexOf(id);
    const totalWidth = siblings.length * 260;
    const startX = -totalWidth / 2;
    const node = nodeMap.get(id);

    nodes.push({
      id,
      type: "dialogue",
      position: { x: startX + col * 260, y: level * 180 },
      data: {
        label: id,
        text: node?.text || "",
        isRoot: id === tree.root_node,
        isKeyMoment: node?.is_key_moment || false,
        llmEscape: node?.llm_escape || false,
        choices: node?.choices.map((c) => c.text) || [],
        selected: false,
      },
    });
  }

  // Edges from choices
  for (const node of tree.nodes) {
    for (const choice of node.choices) {
      if (choice.next_node) {
        edges.push({
          id: `${node.id}-${choice.id}`,
          source: node.id,
          target: choice.next_node,
          label: choice.text.length > 30 ? choice.text.slice(0, 30) + "..." : choice.text,
          style: { stroke: "#556" },
          labelStyle: { fill: "#888", fontSize: "0.6rem" },
          labelBgStyle: { fill: "#0a0a1a", fillOpacity: 0.8 },
          labelBgPadding: [4, 2] as [number, number],
        });
      }
    }
  }

  return { nodes, edges };
}

export default function DialogueGraph() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tree, setTree] = useState<DialogueTree | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (id) {
      dialogue.get(id).then((data) => {
        setTree(data);
        const layout = layoutTree(data);
        setNodes(layout.nodes);
        setEdges(layout.edges);
      }).catch(() => setError("Dialogue tree not found"));
    }
  }, [id]);

  const refreshGraph = useCallback((t: DialogueTree) => {
    const layout = layoutTree(t);
    // Preserve positions if nodes exist
    setNodes((prev) => {
      const posMap = new Map(prev.map((n) => [n.id, n.position]));
      return layout.nodes.map((n) => ({
        ...n,
        position: posMap.get(n.id) || n.position,
        data: { ...n.data, selected: n.id === selectedNodeId },
      }));
    });
    setEdges(layout.edges);
  }, [selectedNodeId]);

  const selectedNode = tree?.nodes.find((n) => n.id === selectedNodeId) || null;

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNodeId(node.id);
    setNodes((nds) => nds.map((n) => ({
      ...n,
      data: { ...n.data, selected: n.id === node.id },
    })));
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, selected: false } })));
  }, []);

  const updateTree = useCallback((updater: (prev: DialogueTree) => DialogueTree) => {
    setTree((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      refreshGraph(next);
      return next;
    });
  }, [refreshGraph]);

  const updateNode = useCallback((patch: Partial<DNode>) => {
    if (!selectedNodeId) return;
    updateTree((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => n.id === selectedNodeId ? { ...n, ...patch } : n),
    }));
  }, [selectedNodeId, updateTree]);

  const updateChoice = (choiceIdx: number, patch: Partial<DialogueChoice>) => {
    if (!selectedNode) return;
    const choices = [...selectedNode.choices];
    choices[choiceIdx] = { ...choices[choiceIdx], ...patch };
    updateNode({ choices });
  };

  const addChoice = () => {
    if (!selectedNode) return;
    updateNode({
      choices: [...selectedNode.choices, {
        id: `choice_${selectedNode.choices.length + 1}`,
        text: "", next_node: "", condition: null, embedding: null,
      }],
    });
  };

  const removeChoice = (idx: number) => {
    if (!selectedNode) return;
    updateNode({ choices: selectedNode.choices.filter((_, i) => i !== idx) });
  };

  const addNode = () => {
    if (!tree) return;
    const nodeId = `node_${tree.nodes.length + 1}`;
    updateTree((prev) => ({
      ...prev,
      nodes: [...prev.nodes, {
        id: nodeId, speaker: tree.character_id, text: "", condition: null,
        state_changes: null, choices: [], llm_escape: false, is_key_moment: false,
      }],
    }));
    setSelectedNodeId(nodeId);
  };

  const deleteNode = () => {
    if (!selectedNodeId || !tree || selectedNodeId === tree.root_node) return;
    updateTree((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => n.id !== selectedNodeId),
    }));
    setSelectedNodeId(null);
  };

  const save = async () => {
    if (!tree || !id) return;
    setSaving(true);
    setError("");
    try {
      await dialogue.update(id, tree);
    } catch (e: any) {
      setError(e.message);
    }
    setSaving(false);
  };

  if (!tree) {
    return <div style={{ color: "#888", padding: "2rem" }}>{error || "Loading..."}</div>;
  }

  return (
    <div style={{ display: "flex", height: "calc(100vh - 3rem)" }}>
      <div style={{ flex: 1, position: "relative" }}>
        {/* Toolbar */}
        <div style={{
          position: "absolute", top: 10, left: 10, zIndex: 5,
          display: "flex", gap: "0.5rem", alignItems: "center",
        }}>
          <span style={{ color: "#e0c097", fontSize: "0.9rem", fontWeight: 600 }}>
            {tree.id}
          </span>
          <span style={{ color: "#666", fontSize: "0.8rem" }}>
            ({tree.character_id} / {tree.context})
          </span>
          <button onClick={addNode} style={toolbarBtn}>+ Node</button>
          <button onClick={save} disabled={saving} style={{ ...toolbarBtn, borderColor: "#8b8", color: "#8b8" }}>
            {saving ? "Saving..." : "Save"}
          </button>
          <button onClick={() => navigate("/dialogue")} style={{ ...toolbarBtn, borderColor: "#a55", color: "#a55" }}>
            Back
          </button>
        </div>
        {error && (
          <div style={{ position: "absolute", top: 10, right: 10, zIndex: 5, color: "#f88", fontSize: "0.8rem" }}>
            {error}
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          style={{ background: "#0a0a1a" }}
        >
          <Background variant={BackgroundVariant.Dots} color="#222" gap={20} />
          <Controls style={{ background: "#1a1a2e", borderColor: "#333" }} showInteractive={false} />
        </ReactFlow>
      </div>

      {selectedNode && (
        <GraphSidePanel title={`Node: ${selectedNode.id}`} onClose={onPaneClick}>
          <FormField label="Node ID">
            <input style={inputStyle} value={selectedNode.id} onChange={(e) => {
              const oldId = selectedNode.id;
              const newId = e.target.value;
              updateTree((prev) => ({
                ...prev,
                root_node: prev.root_node === oldId ? newId : prev.root_node,
                nodes: prev.nodes.map((n) => n.id === oldId ? { ...n, id: newId } : n),
              }));
              setSelectedNodeId(newId);
            }} />
          </FormField>
          <FormField label="Speaker">
            <input style={inputStyle} value={selectedNode.speaker} onChange={(e) => updateNode({ speaker: e.target.value })} />
          </FormField>
          <FormField label="Text">
            <textarea style={{ ...textareaStyle, minHeight: 100 }} value={selectedNode.text} onChange={(e) => updateNode({ text: e.target.value })} />
          </FormField>
          <FormField label="Condition">
            <input style={inputStyle} value={selectedNode.condition || ""} onChange={(e) => updateNode({ condition: e.target.value || null })} placeholder="Optional..." />
          </FormField>
          <FormField label="State Changes" hint="JSON, e.g. {&quot;met_npc&quot;: true}">
            <input style={inputStyle}
              value={selectedNode.state_changes ? JSON.stringify(selectedNode.state_changes) : ""}
              onChange={(e) => {
                try { updateNode({ state_changes: e.target.value ? JSON.parse(e.target.value) : null }); }
                catch { /* typing */ }
              }}
            />
          </FormField>
          <div style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem" }}>
            <label style={{ color: "#ccc", fontSize: "0.8rem" }}>
              <input type="checkbox" checked={selectedNode.llm_escape} onChange={(e) => updateNode({ llm_escape: e.target.checked })} /> LLM Escape
            </label>
            <label style={{ color: "#ccc", fontSize: "0.8rem" }}>
              <input type="checkbox" checked={selectedNode.is_key_moment} onChange={(e) => updateNode({ is_key_moment: e.target.checked })} /> Key Moment
            </label>
          </div>

          {/* Choices */}
          <div style={{ borderTop: "1px solid #333", paddingTop: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <h4 style={{ color: "#97b8e0", margin: 0, fontSize: "0.85rem" }}>Choices</h4>
              <button onClick={addChoice} style={{ ...toolbarBtn, padding: "1px 8px", fontSize: "0.7rem" }}>+ Choice</button>
            </div>
            {selectedNode.choices.map((choice, i) => (
              <div key={i} style={{
                background: "#0f0f23", border: "1px solid #333", borderRadius: 4,
                padding: "0.4rem", marginBottom: 4, position: "relative",
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                  <input style={{ ...inputStyle, fontSize: "0.8rem", padding: "0.3rem" }} placeholder="Choice ID" value={choice.id} onChange={(e) => updateChoice(i, { id: e.target.value })} />
                  <select style={{ ...selectStyle, fontSize: "0.8rem", padding: "0.3rem" }} value={choice.next_node} onChange={(e) => updateChoice(i, { next_node: e.target.value })}>
                    <option value="">-- Next --</option>
                    {tree.nodes.filter((n) => n.id !== selectedNode.id).map((n) => (
                      <option key={n.id} value={n.id}>{n.id}</option>
                    ))}
                  </select>
                </div>
                <input style={{ ...inputStyle, fontSize: "0.8rem", padding: "0.3rem", marginTop: 3 }} placeholder="Choice text" value={choice.text} onChange={(e) => updateChoice(i, { text: e.target.value })} />
                <button onClick={() => removeChoice(i)} style={{
                  position: "absolute", top: 2, right: 4,
                  background: "none", border: "none", color: "#a33", cursor: "pointer", fontSize: "0.7rem",
                }}>×</button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
            {selectedNodeId !== tree.root_node && (
              <button onClick={deleteNode} style={{ ...btnDanger, flex: 1, fontSize: "0.8rem", padding: "0.4rem" }}>
                Delete Node
              </button>
            )}
            <button onClick={() => {
              if (selectedNodeId) {
                updateTree((prev) => ({ ...prev, root_node: selectedNodeId }));
              }
            }} disabled={selectedNodeId === tree.root_node} style={{
              ...btnPrimary, flex: 1, fontSize: "0.8rem", padding: "0.4rem",
              opacity: selectedNodeId === tree.root_node ? 0.4 : 1,
            }}>
              Set as Root
            </button>
          </div>
        </GraphSidePanel>
      )}
    </div>
  );
}

const toolbarBtn: React.CSSProperties = {
  background: "#0a0a1a",
  color: "#e0c097",
  border: "1px solid #444",
  padding: "3px 10px",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: "0.75rem",
};
