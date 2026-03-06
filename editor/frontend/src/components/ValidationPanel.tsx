import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { validation } from "../api/client";
import type { ValidationResult } from "../types/models";
import { btnPrimary } from "./FormField";

export default function ValidationPanel() {
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const run = async () => {
    setLoading(true);
    try {
      const data = await validation.validate();
      setResult(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const navigateToEntity = (file: string) => {
    // Try to determine entity type and ID from file path
    if (file.includes("/characters/")) {
      const id = file.split("/characters/")[1]?.replace(".yaml", "");
      if (id) navigate(`/characters/${id}`);
    } else if (file.includes("/places/")) {
      const match = file.match(/places\/([^/]+)/);
      if (match) navigate(`/places/${match[1]}`);
    } else if (file.includes("/factions/")) {
      const id = file.split("/factions/")[1]?.replace(".yaml", "");
      if (id) navigate(`/factions/${id}`);
    } else if (file.includes("/dialogue/")) {
      const id = file.split("/dialogue/")[1]?.replace(".yaml", "");
      if (id) navigate(`/dialogue/${id}`);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0, color: "#e0c097" }}>Validation</h1>
        <button onClick={run} disabled={loading} style={btnPrimary}>
          {loading ? "Validating..." : "Run Validation"}
        </button>
      </div>

      {result && (
        <div>
          {/* Entity counts */}
          <div style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ color: "#e0c097" }}>Entity Counts</h3>
            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
              {Object.entries(result.entity_counts).map(([type, count]) => (
                <div key={type} style={{ color: "#ccc" }}>
                  <span style={{ color: "#e0c097", textTransform: "capitalize" }}>{type}</span>: {count}
                </div>
              ))}
            </div>
          </div>

          {/* Broken refs */}
          <div style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ color: result.broken_refs.length > 0 ? "#f88" : "#8f8" }}>
              Broken References ({result.broken_refs.length})
            </h3>
            {result.broken_refs.map((ref, i) => (
              <div
                key={i}
                onClick={() => navigateToEntity(ref.source_file)}
                style={{
                  background: "#1a1a2e",
                  border: "1px solid #533",
                  borderRadius: 4,
                  padding: "0.5rem",
                  marginBottom: 4,
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                <span style={{ color: "#f88" }}>{ref.source_file}</span>
                <span style={{ color: "#888" }}> → </span>
                <span style={{ color: "#ccc" }}>
                  {ref.field}: <strong>{ref.referenced_id}</strong> (expected {ref.expected_type})
                </span>
              </div>
            ))}
            {result.broken_refs.length === 0 && (
              <div style={{ color: "#8f8", fontSize: "0.85rem" }}>No broken references found.</div>
            )}
          </div>

          {/* Duplicate IDs */}
          <div>
            <h3 style={{ color: result.duplicate_ids.length > 0 ? "#ff8" : "#8f8" }}>
              Duplicate IDs ({result.duplicate_ids.length})
            </h3>
            {result.duplicate_ids.map((dup, i) => (
              <div
                key={i}
                style={{
                  background: "#1a1a2e",
                  border: "1px solid #553",
                  borderRadius: 4,
                  padding: "0.5rem",
                  marginBottom: 4,
                  fontSize: "0.85rem",
                }}
              >
                <span style={{ color: "#ff8" }}>{dup.id}</span>
                <span style={{ color: "#888" }}> in: </span>
                <span style={{ color: "#ccc" }}>{dup.files.join(", ")}</span>
              </div>
            ))}
            {result.duplicate_ids.length === 0 && (
              <div style={{ color: "#8f8", fontSize: "0.85rem" }}>No duplicate IDs found.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
