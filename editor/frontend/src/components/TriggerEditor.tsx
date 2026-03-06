import { useEffect, useState } from "react";
import { selectStyle } from "./FormField";
import ConditionBuilder from "./ConditionBuilder";
import { characters, places } from "../api/client";

interface Trigger {
  type?: string;
  condition?: string;
}

interface Props {
  value: Trigger | undefined;
  onChange: (trigger: Trigger) => void;
}

export default function TriggerEditor({ value, onChange }: Props) {
  const type = value?.type || "automatic";
  const condition = value?.condition || "";

  const [characterIds, setCharacterIds] = useState<string[]>([]);
  const [placeIds, setPlaceIds] = useState<string[]>([]);

  useEffect(() => {
    characters.list().then((list) => setCharacterIds(list.map((c: any) => c.id)));
    places.list().then((list) => setPlaceIds(list.map((p: any) => p.id)));
  }, []);

  const setType = (newType: string) => {
    // Clear condition when switching types since the format changes
    onChange({ type: newType, condition: newType === "automatic" ? "" : condition });
  };

  const setCondition = (newCondition: string | null) => {
    onChange({ type, condition: newCondition || "" });
  };

  return (
    <div>
      <div style={{ marginBottom: "0.75rem" }}>
        <select
          style={selectStyle}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="automatic">Automatic — activates immediately</option>
          <option value="event">Event — triggers on game events</option>
          <option value="flag">Flag — triggers when flags match</option>
        </select>
      </div>

      {type === "automatic" && (
        <div style={{ color: "#666", fontSize: "0.8rem" }}>
          This beat activates as soon as the game starts. No conditions needed.
        </div>
      )}

      {type === "event" && (
        <div>
          <div style={{ color: "#888", fontSize: "0.8rem", marginBottom: "0.5rem" }}>
            Triggers when the player performs specific actions (talked to a character, visited a place).
            Multiple conditions are joined with AND.
          </div>
          <ConditionBuilder
            value={condition || null}
            onChange={setCondition}
            showEventConditions={true}
            characterIds={characterIds}
            placeIds={placeIds}
          />
        </div>
      )}

      {type === "flag" && (
        <div>
          <div style={{ color: "#888", fontSize: "0.8rem", marginBottom: "0.5rem" }}>
            Triggers when game state flags match. Flags are set by dialogue choices and game events.
          </div>
          <ConditionBuilder
            value={condition || null}
            onChange={setCondition}
            showEventConditions={false}
          />
        </div>
      )}
    </div>
  );
}
