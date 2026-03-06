import { useCallback, useEffect, useMemo, useState } from "react";
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
import { places, scenes as scenesApi, characters } from "../api/client";
import GraphSidePanel from "../components/GraphSidePanel";
import FormField, { inputStyle, textareaStyle, btnPrimary } from "../components/FormField";
import { MultiEntitySelect } from "../components/EntitySelect";

// --- Custom node for Places ---
function PlaceNode({ data }: NodeProps) {
  return (
    <div
      style={{
        background: "#1a1a2e",
        border: `2px solid ${data.selected ? "#e0c097" : "#444"}`,
        borderRadius: 8,
        padding: "0.6rem 0.8rem",
        minWidth: 160,
        cursor: "pointer",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: "#666" }} />
      <div style={{ color: "#e0c097", fontWeight: 600, fontSize: "0.85rem" }}>{data.label as string}</div>
      <div style={{ color: "#888", fontSize: "0.7rem", marginTop: 2 }}>{data.type as string}</div>
      {(data.npcs as string[])?.length > 0 && (
        <div style={{ color: "#8b8", fontSize: "0.65rem", marginTop: 4 }}>
          {(data.npcs as string[]).join(", ")}
        </div>
      )}
      {(data.sceneNames as string[])?.length > 0 && (
        <div style={{ marginTop: 6, borderTop: "1px solid #333", paddingTop: 4 }}>
          {(data.sceneNames as string[]).map((s: string, i: number) => (
            <div key={i} style={{ color: "#97b8e0", fontSize: "0.65rem", padding: "1px 0" }}>
              ◆ {s}
            </div>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: "#666" }} />
    </div>
  );
}

const nodeTypes = { place: PlaceNode };

// --- Layout helpers ---
function autoLayout(placeList: any[], sceneList: any[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const scenesByPlace: Record<string, any[]> = {};
  for (const s of sceneList) {
    (scenesByPlace[s.place_id] ||= []).push(s);
  }

  // Simple grid layout
  const cols = Math.max(2, Math.ceil(Math.sqrt(placeList.length)));
  placeList.forEach((p, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const placeScenes = scenesByPlace[p.id] || [];
    nodes.push({
      id: p.id,
      type: "place",
      position: { x: col * 280, y: row * 220 },
      data: {
        label: p.name,
        type: p.type,
        region: p.region,
        npcs: p.default_npcs || [],
        sceneNames: placeScenes.map((s: any) => s.name),
        sceneIds: placeScenes.map((s: any) => s.id),
        selected: false,
      },
    });

    // Connection edges
    for (const connId of p.connections || []) {
      // Only add edge in one direction to avoid duplicates
      if (p.id < connId) {
        edges.push({
          id: `${p.id}-${connId}`,
          source: p.id,
          target: connId,
          style: { stroke: "#555", strokeWidth: 2 },
          animated: false,
        });
      }
    }
  });

  return { nodes, edges };
}

export default function WorldGraph() {
  const [placeList, setPlaceList] = useState<any[]>([]);
  const [sceneList, setSceneList] = useState<any[]>([]);
  const [charList, setCharList] = useState<any[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [selectedScenes, setSelectedScenes] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const [p, s, c] = await Promise.all([places.list(), scenesApi.list(), characters.list()]);
    setPlaceList(p);
    setSceneList(s);
    setCharList(c);
    const layout = autoLayout(p, s);
    setNodes(layout.nodes);
    setEdges(layout.edges);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onNodeClick = useCallback(async (_: any, node: Node) => {
    const placeData = await places.get(node.id);
    setSelected(placeData);
    const plScenes = await scenesApi.list(node.id);
    setSelectedScenes(plScenes);
    // Highlight selected
    setNodes((nds) => nds.map((n) => ({
      ...n,
      data: { ...n.data, selected: n.id === node.id },
    })));
  }, []);

  const onPaneClick = useCallback(() => {
    setSelected(null);
    setSelectedScenes([]);
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, selected: false } })));
  }, []);

  const updateSelected = (patch: Record<string, any>) => {
    setSelected((prev: any) => ({ ...prev, ...patch }));
  };

  const savePlace = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await places.update(selected.id, selected);
      await loadData();
      // Re-select to refresh
      const fresh = await places.get(selected.id);
      setSelected(fresh);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const fetchCharacters = useCallback(async () => {
    return charList.map((c: any) => ({ id: c.id, name: c.name }));
  }, [charList]);

  const fetchPlaces = useCallback(async () => {
    return placeList.filter((p: any) => p.id !== selected?.id).map((p: any) => ({ id: p.id, name: p.name }));
  }, [placeList, selected]);

  return (
    <div style={{ display: "flex", height: "calc(100vh - 3rem)" }}>
      <div style={{ flex: 1, position: "relative" }}>
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
          <Controls
            style={{ background: "#1a1a2e", borderColor: "#333" }}
            showInteractive={false}
          />
        </ReactFlow>
      </div>

      {selected && (
        <GraphSidePanel title={`Edit: ${selected.name}`} onClose={onPaneClick}>
          <FormField label="Name">
            <input style={inputStyle} value={selected.name} onChange={(e) => updateSelected({ name: e.target.value })} />
          </FormField>
          <FormField label="Type">
            <input style={inputStyle} value={selected.type || ""} onChange={(e) => updateSelected({ type: e.target.value })} />
          </FormField>
          <FormField label="Region">
            <input style={inputStyle} value={selected.region || ""} onChange={(e) => updateSelected({ region: e.target.value })} />
          </FormField>
          <FormField label="Description">
            <textarea style={{ ...textareaStyle, minHeight: 80 }} value={selected.description || ""} onChange={(e) => updateSelected({ description: e.target.value })} />
          </FormField>
          <FormField label="Atmosphere">
            <textarea style={{ ...textareaStyle, minHeight: 50 }} value={selected.atmosphere || ""} onChange={(e) => updateSelected({ atmosphere: e.target.value })} />
          </FormField>
          <FormField label="Connections">
            <MultiEntitySelect values={selected.connections || []} onChange={(v) => updateSelected({ connections: v })} fetchItems={fetchPlaces} />
          </FormField>
          <FormField label="Default NPCs">
            <MultiEntitySelect values={selected.default_npcs || []} onChange={(v) => updateSelected({ default_npcs: v })} fetchItems={fetchCharacters} />
          </FormField>
          <FormField label="Owner">
            <input style={inputStyle} value={selected.owner || ""} onChange={(e) => updateSelected({ owner: e.target.value })} />
          </FormField>
          <FormField label="Public">
            <label style={{ color: "#ccc" }}>
              <input type="checkbox" checked={selected.is_public ?? true} onChange={(e) => updateSelected({ is_public: e.target.checked })} /> Accessible
            </label>
          </FormField>

          {/* Scenes list */}
          <div style={{ marginTop: "1rem", borderTop: "1px solid #333", paddingTop: "0.75rem" }}>
            <h4 style={{ color: "#97b8e0", margin: "0 0 0.5rem 0", fontSize: "0.85rem" }}>Scenes</h4>
            {selectedScenes.length === 0 && (
              <div style={{ color: "#666", fontSize: "0.8rem" }}>No scenes</div>
            )}
            {selectedScenes.map((s) => (
              <div key={s.id} style={{
                background: "#1a1a2e", border: "1px solid #333", borderRadius: 4,
                padding: "0.4rem 0.6rem", marginBottom: 4, fontSize: "0.8rem",
              }}>
                <span style={{ color: "#97b8e0" }}>{s.name}</span>
                <span style={{ color: "#666", marginLeft: 6 }}>({s.type})</span>
                {s.default_npcs?.length > 0 && (
                  <div style={{ color: "#8b8", fontSize: "0.7rem" }}>{s.default_npcs.join(", ")}</div>
                )}
              </div>
            ))}
          </div>

          <button onClick={savePlace} disabled={saving} style={{ ...btnPrimary, marginTop: "1rem", width: "100%" }}>
            {saving ? "Saving..." : "Save Place"}
          </button>
        </GraphSidePanel>
      )}
    </div>
  );
}
