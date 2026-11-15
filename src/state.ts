import type { AppState, BackgroundStyle, Entry } from "./types";
import { applyScheme } from "./lib/placements";
import { hydrateCustomThemes } from "./data/themes";

let idCounter = 0;
export const newId = () => `p${Date.now().toString(36)}${(idCounter++).toString(36)}`;

// Fictional sample players
const SAMPLE: Array<[string, string, string, string[]]> = [
  ["NVX", "Kagerou", "jp", ["Jin", "Devil Jin"]],
  ["", "Ironclad", "kr", ["Dragunov"]],
  ["RVN", "Mistral", "pk", ["Reina", "Kazuya"]],
  ["", "Bulwark", "us", ["King"]],
  ["ODA", "Hexfire", "fr", ["Lili"]],
  ["", "Sunder", "sa", ["Bryan", "Feng", "Law"]],
  ["KTR", "Lowkick Larry", "gb", ["Steve"]],
  ["", "Pazuzu", "ph", ["Yoshimitsu"]],
];

function sampleEntries(): Entry[] {
  return SAMPLE.map(([sponsor, tag, country, chars]) => ({
    id: newId(),
    placement: 0,
    sponsor,
    tag,
    country,
    handle: tag.toLowerCase().replace(/\s+/g, "_"),
    characters: chars.map((name) => ({ name })),
  }));
}

export const DEFAULT_BACKGROUND: BackgroundStyle = { dim: 0.55, blur: 0, posX: 50, posY: 50 };

export function defaultState(): AppState {
  return {
    event: {
      name: "Iron Monsoon 2026",
      game: "Tekken 8",
      subtitle: "Top 8",
      date: "Nov 1, 2026",
      location: "Manila, PH",
      entrants: "256",
      url: "start.gg/iron-monsoon",
      hashtag: "#IronMonsoon",
      scheme: "DE",
    },
    entries: applyScheme(sampleEntries(), "DE"),
    themeId: "heat",
    customThemes: [],
    standingsFormat: "16x9",
    background: { ...DEFAULT_BACKGROUND },
  };
}

export const emptyEntry = (): Entry => ({
  id: newId(),
  placement: 0,
  sponsor: "",
  tag: "",
  country: "",
  handle: "",
  characters: [{ name: "" }],
});

/** Merge saved state with defaults. */
export function hydrate(saved: Partial<AppState> | null): AppState {
  const d = defaultState();
  if (!saved) return d;
  const { grandFinal: _gf, ...event } = { ...d.event, ...(saved.event ?? {}) } as typeof d.event & { grandFinal?: string };
  return {
    event,
    entries: Array.isArray(saved.entries) && saved.entries.length ? saved.entries : d.entries,
    themeId: typeof saved.themeId === "string" ? saved.themeId : d.themeId,
    customThemes: hydrateCustomThemes(saved.customThemes),
    standingsFormat: typeof saved.standingsFormat === "string" ? saved.standingsFormat : d.standingsFormat,
    background: hydrateBackground(saved.background),
  };
}

function hydrateBackground(saved: Partial<BackgroundStyle> | undefined): BackgroundStyle {
  const out = { ...DEFAULT_BACKGROUND };
  for (const k of Object.keys(out) as (keyof BackgroundStyle)[]) {
    const v = saved?.[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}
