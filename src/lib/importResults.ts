import countryData from "flag-icons/country.json";
import type { AppState, Entry, PlacementScheme } from "../types";
import type { ImportedPlayer, ImportedResults } from "../../api/import";
import { matchRosterName, rosterEntry } from "../data/tekken8";
import { applyScheme, schemePlacement } from "./placements";
import { emptyEntry, newId } from "../state";

export type { ImportedResults } from "../../api/import";

const COUNTRY_CODES = new Map(
  (countryData as Array<{ code: string; name: string; iso: boolean }>)
    .filter((c) => c.iso && /^[a-z]{2}$/.test(c.code))
    .map((c) => [c.name.toLowerCase(), c.code]),
);
// Ways bracket sites and players tend to write country names
const ALIASES: Record<string, string> = {
  "united states": "us",
  usa: "us",
  "u.s.a.": "us",
  america: "us",
  uk: "gb",
  "great britain": "gb",
  england: "gb",
  scotland: "gb",
  wales: "gb",
  "northern ireland": "gb",
  korea: "kr",
  "republic of korea": "kr",
  "korea, republic of": "kr",
  "korea (south)": "kr",
  "russian federation": "ru",
  "viet nam": "vn",
  uae: "ae",
  "taiwan, province of china": "tw",
  "chinese taipei": "tw",
  czechia: "cz",
  türkiye: "tr",
  turkey: "tr",
  "hong kong sar": "hk",
  "the netherlands": "nl",
};

export function countryCode(name: string): string {
  const n = name.trim().toLowerCase();
  if (!n) return "";
  if (/^[a-z]{2}$/.test(n)) return n === "uk" ? "gb" : n;
  return ALIASES[n] ?? COUNTRY_CODES.get(n) ?? "";
}

export function rosterName(name: string): string {
  return rosterEntry(name)?.name ?? matchRosterName(name) ?? name.trim();
}

export function detectScheme(placements: number[]): PlacementScheme {
  if (placements.every((p, i) => p === schemePlacement("DE", i))) return "DE";
  if (placements.every((p, i) => p === schemePlacement("SE", i))) return "SE";
  return "custom";
}

export function toEntry(p: ImportedPlayer): Entry {
  const characters = [...new Set(p.characters.map(rosterName))].slice(0, 3).map((name) => ({ name }));
  return {
    id: newId(),
    placement: p.placement,
    sponsor: p.prefix,
    tag: p.tag,
    country: countryCode(p.country),
    handle: p.handle,
    characters: characters.length ? characters : [{ name: "" }],
  };
}

export function applyImport(s: AppState, r: ImportedResults): AppState {
  let entries = r.players.map(toEntry);
  const scheme = detectScheme(entries.map((e) => e.placement));
  // Always leave eight rows to edit
  while (entries.length < 8) entries.push({ ...emptyEntry(), placement: entries.length + 1 });
  if (scheme !== "custom") entries = applyScheme(entries, scheme);
  return {
    ...s,
    event: { ...s.event, ...r.event, game: r.event.game || s.event.game, subtitle: s.event.subtitle || "Top 8", scheme },
    entries,
  };
}
