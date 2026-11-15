// The roster comes from `npm run sync:roster`.
import rosterData from "./tekken8-roster.json";

export type RosterCharacter = {
  name: string;
  slug: string;
};

export const ROSTER: RosterCharacter[] = rosterData.characters;
export const TEKKEN8_ROSTER = ROSTER.map((c) => c.name);

export function rosterEntry(name: string): RosterCharacter | undefined {
  const n = normaliseName(name);
  return ROSTER.find((c) => normaliseName(c.name) === n);
}

export function normaliseName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[^a-z0-9]/g, "");
}

// Longest match wins, so "devil_jin.png" is Devil Jin and not Jin.
export function matchRosterName(
  filename: string,
  roster = TEKKEN8_ROSTER,
): string | null {
  const n = normaliseName(filename);
  const exact = roster.find((r) => normaliseName(r) === n);
  if (exact) return exact;
  const candidates = roster
    .filter((r) => n.includes(normaliseName(r)))
    .sort((a, b) => normaliseName(b).length - normaliseName(a).length);
  return candidates[0] ?? null;
}
