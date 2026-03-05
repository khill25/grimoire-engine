import { useState } from "react";
import { generate } from "../api/client";

interface Props {
  field: string;
  context: Record<string, any>;
  onResult: (text: string) => void;
}

export default function FieldAssist({ field, context, onResult }: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await generate.field(field, context);
      onResult(res.generated);
    } catch (e) {
      console.error("Field assist failed:", e);
    }
    setLoading(false);
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title={`Generate ${field} with LLM`}
      style={{
        background: "transparent",
        border: "1px solid #555",
        color: loading ? "#666" : "#e0c097",
        padding: "2px 8px",
        borderRadius: 4,
        cursor: loading ? "wait" : "pointer",
        fontSize: "0.7rem",
        marginLeft: 8,
      }}
    >
      {loading ? "..." : "AI"}
    </button>
  );
}
