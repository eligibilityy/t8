import type { EventInfo, PlacementScheme } from "../types";
import { SelectField, TextField } from "./ui";

type Props = {
  event: EventInfo;
  onChange: (patch: Partial<EventInfo>) => void;
};

const FIELDS: Array<[Exclude<keyof EventInfo, "scheme">, string, string]> = [
  ["name", "Event name", "Iron Monsoon 2026"],
  ["game", "Game", "Tekken 8"],
  ["subtitle", "Subtitle", "Top 8"],
  ["date", "Date", "Nov 1, 2026"],
  ["location", "Location", "Manila, PH"],
  ["entrants", "Entrants", "256"],
  ["url", "Bracket URL", "start.gg/…"],
  ["hashtag", "Hashtag", "#IronMonsoon"],
];

const SCHEMES: Array<{ value: PlacementScheme; label: string }> = [
  { value: "DE", label: "Double elim" },
  { value: "SE", label: "Single elim" },
  { value: "custom", label: "Custom" },
];

export function EventForm({ event, onChange }: Props) {
  return (
    <div className="grid2">
      {FIELDS.map(([key, label, ph]) => (
        <TextField
          key={key}
          className={key === "name" ? "span2" : ""}
          label={label}
          value={event[key]}
          placeholder={ph}
          onChange={(v) => onChange({ [key]: v })}
        />
      ))}
      <SelectField label="Placements" value={event.scheme} items={SCHEMES} onChange={(scheme) => onChange({ scheme })} />
    </div>
  );
}
