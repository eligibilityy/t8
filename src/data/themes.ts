import type { Format, Theme } from "../types";
import { bestOn, contrastRatio, isDark, mix } from "../lib/color";

// Bebas for display, Inter for small text, JetBrains Mono for handles, URLs and meta
const display = "'Bebas Neue', sans-serif";
const body = "InterVariable, system-ui, sans-serif";
const mono = "'JetBrains Mono Variable', ui-monospace, monospace";

export const THEMES: Theme[] = [
  {
    id: "heat",
    label: "Heat",
    note: "magenta / cyan",
    bg: "#0b0b0f",
    bg2: "#1a0b16",
    surface: "#15151b",
    surfaceEdge: "#2a2a33",
    accent: "#f50a64",
    accentInk: "#ffffff",
    accent2: "#3fd1e7",
    text: "#ffffff",
    textDim: "#9a9aa8",
    fontDisplay: display,
    fontBody: body,
    fontMono: mono,
  },
  {
    id: "crown",
    label: "Crown",
    note: "black / gold",
    bg: "#111111",
    bg2: "#231d12",
    surface: "#1b1b1b",
    surfaceEdge: "#3a3325",
    accent: "#c9a45c",
    accentInk: "#111111",
    accent2: "#ff4d1a",
    text: "#f5f2ea",
    textDim: "#9c9483",
    fontDisplay: display,
    fontBody: body,
    fontMono: mono,
  },
  {
    id: "volt",
    label: "Volt",
    note: "blue / neon",
    bg: "#050816",
    bg2: "#0b1a4a",
    surface: "#0d1430",
    surfaceEdge: "#1f2d66",
    accent: "#d7ff1f",
    accentInk: "#050816",
    accent2: "#3d6bff",
    text: "#ffffff",
    textDim: "#8f9bc7",
    fontDisplay: display,
    fontBody: body,
    fontMono: mono,
  },
  {
    id: "paper",
    label: "Paper",
    note: "light",
    bg: "#f1eee8",
    bg2: "#e2ddd3",
    surface: "#ffffff",
    surfaceEdge: "#d3cdc1",
    accent: "#e0262f",
    accentInk: "#ffffff",
    accent2: "#111111",
    text: "#111111",
    textDim: "#6b665c",
    fontDisplay: display,
    fontBody: body,
    fontMono: mono,
  },
];


export const FORMATS: Format[] = [
  { id: "16x9", label: "16:9 · 1920×1080", width: 1920, height: 1080 },
  { id: "4x5", label: "4:5 · 1080×1350", width: 1080, height: 1350 },
];

export function getTheme(id: string, custom: Theme[] = []): Theme {
  return THEMES.find((t) => t.id === id) ?? custom.find((t) => t.id === id) ?? THEMES[0];
}

export const isCustomTheme = (id: string) => id.startsWith("custom-");

export type ThemeColorKey = "bg" | "bg2" | "surface" | "surfaceEdge" | "accent" | "accentInk" | "accent2" | "text" | "textDim";

type ColorInfo = { key: ThemeColorKey; label: string; hint: string };

/** The three choices that set the look; everything else is matched to them */
export const KEY_COLORS: ColorInfo[] = [
  { key: "bg", label: "Background", hint: "Behind everything" },
  { key: "accent", label: "Accent", hint: "Title, top 3, bottom bar" },
  { key: "accent2", label: "Second accent", hint: "Highlights" },
];

/** Matched colours: derived from the key colours until set by hand */
export const MATCHED_COLORS: ColorInfo[] = [
  { key: "accentInk", label: "Text on accent", hint: "Readable on the accent" },
  { key: "text", label: "Text", hint: "Names and headings" },
  { key: "textDim", label: "Small text", hint: "Handles, dates" },
  { key: "surface", label: "Panels", hint: "Player rows" },
  { key: "surfaceEdge", label: "Panel edges", hint: "Lines between rows" },
  { key: "bg2", label: "Glow", hint: "Background tint" },
];

const COLOR_KEYS: ThemeColorKey[] = [...KEY_COLORS, ...MATCHED_COLORS].map((c) => c.key);

/** What each matched colour is worked out from */
const SOURCES: Partial<Record<ThemeColorKey, ThemeColorKey[]>> = {
  bg2: ["bg", "accent"],
  surface: ["bg"],
  surfaceEdge: ["bg"],
  text: ["bg"],
  textDim: ["text", "bg"],
  accentInk: ["accent"],
};

/** The matched value for `key`, from the theme's other colours */
export function deriveColor(key: ThemeColorKey, t: Theme): string {
  const dark = isDark(t.bg);
  switch (key) {
    case "bg2":
      return mix(t.bg, t.accent, dark ? 0.12 : 0.1);
    case "surface":
      return dark ? mix(t.bg, "#ffffff", 0.05) : mix(t.bg, "#ffffff", 0.75);
    case "surfaceEdge":
      return dark ? mix(t.bg, "#ffffff", 0.14) : mix(t.bg, "#000000", 0.14);
    case "text":
      return dark ? "#ffffff" : "#111111";
    case "textDim":
      return mix(t.text, t.bg, 0.42);
    case "accentInk":
      // White reads best on vivid colours even where the WCAG maths slightly prefers black;
      // the accent sits behind big display text, so 3:1 is enough
      return contrastRatio("#ffffff", t.accent) >= 3 ? "#ffffff" : bestOn(t.accent, ["#ffffff", "#111111"]);
    default:
      return t[key];
  }
}

export const isMatched = (key: ThemeColorKey) => key in SOURCES;
export const isAuto = (t: Theme, key: ThemeColorKey) => isMatched(key) && !t.manual?.includes(key);

/**
 * Set one colour and update the matched colours that depend on it (unless the user set them
 * by hand). Setting a matched colour by hand marks it manual.
 */
export function setThemeColor(t: Theme, key: ThemeColorKey, hex: string): Partial<Theme> {
  const next: Theme = { ...t, [key]: hex };
  const manual = new Set(t.manual ?? []);
  if (isMatched(key)) manual.add(key);
  // Follow chains like bg → text → small text
  const changed = new Set<ThemeColorKey>([key]);
  for (let pass = 0; pass < 3; pass++) {
    for (const [k, from] of Object.entries(SOURCES) as Array<[ThemeColorKey, ThemeColorKey[]]>) {
      if (manual.has(k) || k === key || !from.some((f) => changed.has(f))) continue;
      const v = deriveColor(k, next);
      if (v !== next[k]) {
        next[k] = v;
        changed.add(k);
      }
    }
  }
  const patch: Partial<Theme> = { manual: [...manual] };
  for (const k of COLOR_KEYS) if (next[k] !== t[k]) patch[k] = next[k];
  return patch;
}

/** Back to the matched value (and let it follow the key colours again) */
export function resetThemeColor(t: Theme, key: ThemeColorKey): Partial<Theme> {
  const manual = (t.manual ?? []).filter((k) => k !== key);
  return { ...setThemeColor({ ...t, manual }, key, deriveColor(key, t)), manual };
}

/** Readability checks: the colour, what it sits on, and the lowest acceptable ratio */
export const CONTRAST_CHECKS: Partial<Record<ThemeColorKey, { on: ThemeColorKey; min: number; what: string }>> = {
  accentInk: { on: "accent", min: 3, what: "on the accent" },
  text: { on: "surface", min: 3, what: "on panels" },
  textDim: { on: "bg", min: 2.5, what: "on the background" },
};

/** "#abc" / "abc" / "#aabbcc" → "#aabbcc", or null */
export function normalizeHex(value: string): string | null {
  const m = value.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return `#${hex.toLowerCase()}`;
}

const newThemeId = () => `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function uniqueLabel(label: string, existing: Theme[]): string {
  const names = new Set(existing.map((t) => t.label));
  if (!names.has(label)) return label;
  let n = 2;
  while (names.has(`${label} ${n}`)) n++;
  return `${label} ${n}`;
}

/** New custom theme copied from `base` */
export function newCustomTheme(base: Theme, existing: Theme[]): Theme {
  const { note: _note, ...rest } = base;
  return {
    ...rest,
    id: newThemeId(),
    label: uniqueLabel(isCustomTheme(base.id) ? `${base.label} copy` : "My theme", existing),
    manual: [...(base.manual ?? [])],
  };
}

// ── Theme list operations on app state ──
type ThemeState = { themeId: string; customThemes: Theme[] };

/** Copy the selected theme and select the copy */
export function createTheme<S extends ThemeState>(s: S): S {
  const t = newCustomTheme(getTheme(s.themeId, s.customThemes), s.customThemes);
  return { ...s, customThemes: [...s.customThemes, t], themeId: t.id };
}

/** Edit a theme; editing a built-in saves the change on a copy ("Custom Heat") */
export function updateTheme<S extends ThemeState>(s: S, id: string, patch: Partial<Theme>): S {
  if (isCustomTheme(id)) return { ...s, customThemes: s.customThemes.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
  const base = getTheme(id);
  const { note: _note, ...rest } = base;
  const copy: Theme = { ...rest, ...patch, id: newThemeId(), label: uniqueLabel(`Custom ${base.label}`, s.customThemes) };
  return { ...s, customThemes: [...s.customThemes, copy], themeId: copy.id };
}

export function deleteTheme<S extends ThemeState>(s: S, id: string): S {
  return {
    ...s,
    customThemes: s.customThemes.filter((t) => t.id !== id),
    themeId: s.themeId === id ? THEMES[0].id : s.themeId,
  };
}

/** Undo a delete: put the theme back where it was and select it */
export function restoreTheme<S extends ThemeState>(s: S, theme: Theme, index: number): S {
  if (s.customThemes.some((t) => t.id === theme.id)) return s;
  const list = [...s.customThemes];
  list.splice(Math.min(index, list.length), 0, theme);
  return { ...s, customThemes: list, themeId: theme.id };
}

/** Rebuild saved custom themes, dropping anything malformed */
export function hydrateCustomThemes(saved: unknown): Theme[] {
  if (!Array.isArray(saved)) return [];
  const fallback = THEMES[0];
  const out: Theme[] = [];
  for (const raw of saved as Array<Partial<Theme>>) {
    if (!raw || typeof raw.id !== "string" || !isCustomTheme(raw.id) || out.some((t) => t.id === raw.id)) continue;
    const t: Theme = { ...fallback, id: raw.id, label: typeof raw.label === "string" ? raw.label : "My theme" };
    delete t.note;
    for (const k of COLOR_KEYS) t[k] = (typeof raw[k] === "string" && normalizeHex(raw[k])) || fallback[k];
    // Themes saved before matching existed keep every colour exactly as the user set it
    t.manual = Array.isArray(raw.manual)
      ? raw.manual.filter((k): k is ThemeColorKey => typeof k === "string" && isMatched(k as ThemeColorKey))
      : COLOR_KEYS.filter(isMatched);
    out.push(t);
  }
  return out;
}

export { contrastRatio };

export function getFormat(id: string): Format {
  return FORMATS.find((f) => f.id === id) ?? FORMATS[0];
}
