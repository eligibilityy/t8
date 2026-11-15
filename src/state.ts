import type { AppState, BackgroundStyle, Entry } from "./types";
import { applyScheme } from "./lib/placements";
import { hydrateCustomThemes } from "./data/themes";

let idCounter = 0;
export const newId = () =>
  `p${Date.now().toString(36)}${(idCounter++).toString(36)}`;

// Sample data from EVO 2026 (https://liquipedia.net/fighters/Evolution_Championship_Series/2026/T8)
const SAMPLE: Array<[string, string, string, string[]]> = [
  ["TWIS", "Arslan Ash", "pk", ["Kunimitsu", "Nina"]],
  ["VL", "Rangchu", "kr", ["Fahkumram"]],
  ["DRX", "LowHigh", "kr", ["Bryan"]],
  ["VIT", "JeonDDing", "kr", ["Eddy"]],
  ["NIP", "Meo-IL", "kr", ["Jack-8"]],
  ["VCS", "Qasim Meer", "pk", ["Azucena", "Zafina"]],
  ["YMS", "NOBI", "jp", ["Lars", "Steve"]],
  ["SYN", "Ninjakilla_212", "us", ["Law"]],
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

export const DEFAULT_BACKGROUND: BackgroundStyle = {
  dim: 0.55,
  blur: 0,
  posX: 50,
  posY: 50,
};

export function defaultState(): AppState {
  return {
    event: {
      name: "Evo 2026",
      game: "Tekken 8",
      subtitle: "Top 8",
      date: "June 28, 2026",
      location: "Las Vegas, NV",
      entrants: "1355",
      url: "start.gg/tournament/evo-2026/event/tekken-8",
      hashtag: "#Evo2026",
      scheme: "DE",
    },
    entries: applyScheme(sampleEntries(), "DE"),
    themeId: "heat",
    customThemes: [],
    standingsFormat: "4x5",
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
  const { grandFinal: _gf, ...event } = {
    ...d.event,
    ...(saved.event ?? {}),
  } as typeof d.event & { grandFinal?: string };
  return {
    event,
    entries:
      Array.isArray(saved.entries) && saved.entries.length
        ? saved.entries
        : d.entries,
    themeId: typeof saved.themeId === "string" ? saved.themeId : d.themeId,
    customThemes: hydrateCustomThemes(saved.customThemes),
    standingsFormat:
      typeof saved.standingsFormat === "string"
        ? saved.standingsFormat
        : d.standingsFormat,
    background: hydrateBackground(saved.background),
  };
}

function hydrateBackground(
  saved: Partial<BackgroundStyle> | undefined,
): BackgroundStyle {
  const out = { ...DEFAULT_BACKGROUND };
  for (const k of Object.keys(out) as (keyof BackgroundStyle)[]) {
    const v = saved?.[k];
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}
