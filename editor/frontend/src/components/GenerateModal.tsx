import { useState } from "react";
import { inputStyle, textareaStyle, btnPrimary, btnDanger } from "./FormField";

interface Props {
  title: string;
  placeholder?: string;
  onGenerate: (prompt: string, provider: string) => Promise<void>;
  onClose: () => void;
}

export default function GenerateModal({ title, placeholder, onGenerate, onClose }: Props) {
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState("ollama");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    try {
      await onGenerate(prompt, provider);
      onClose();
    } catch (e: any) {
      setError(e.message || "Generation failed");
    }
    setLoading(false);
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ color: "#e0c097", margin: "0 0 1rem 0" }}>{title}</h2>

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ color: "#888", fontSize: "0.8rem", display: "block", marginBottom: 4 }}>LLM Provider</label>
          <select style={{ ...inputStyle, width: 200 }} value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="ollama">Ollama (Local)</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">OpenAI (GPT)</option>
          </select>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ color: "#888", fontSize: "0.8rem", display: "block", marginBottom: 4 }}>Describe what you want</label>
          <textarea
            style={{ ...textareaStyle, minHeight: 120 }}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={placeholder}
            autoFocus
          />
        </div>

        {error && <div style={{ color: "#f88", marginBottom: "1rem", fontSize: "0.85rem" }}>{error}</div>}

        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnDanger} disabled={loading}>Cancel</button>
          <button onClick={handleGenerate} style={btnPrimary} disabled={loading || !prompt.trim()}>
            {loading ? "Generating..." : "Generate"}
          </button>
        </div>

        {loading && (
          <div style={{ marginTop: "1rem", color: "#888", fontSize: "0.85rem", textAlign: "center" }}>
            Waiting for LLM response... this may take a moment.
          </div>
        )}
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0, left: 0, right: 0, bottom: 0,
  background: "rgba(0,0,0,0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  background: "#1a1a2e",
  border: "1px solid #333",
  borderRadius: 8,
  padding: "1.5rem",
  width: "90%",
  maxWidth: 600,
  maxHeight: "80vh",
  overflow: "auto",
};
