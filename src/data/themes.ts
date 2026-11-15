import type { Format, Theme } from "../types";

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

/** Editable colours, grouped as the editor shows them */
export const THEME_COLOR_GROUPS: Array<{ title: string; colors: Array<{ key: ThemeColorKey; label: string }> }> = [
  {
    title: "Background",
    colors: [
      { key: "bg", label: "Base" },
      { key: "bg2", label: "Glow" },
    ],
  },
  {
    title: "Panels",
    colors: [
      { key: "surface", label: "Fill" },
      { key: "surfaceEdge", label: "Edge" },
    ],
  },
  {
    title: "Accents",
    colors: [
      { key: "accent", label: "Main accent" },
      { key: "accentInk", label: "Text on accent" },
      { key: "accent2", label: "Second accent" },
    ],
  },
  {
    title: "Text",
    colors: [
      { key: "text", label: "Main text" },
      { key: "textDim", label: "Small text" },
    ],
  },
];

const COLOR_KEYS = THEME_COLOR_GROUPS.flatMap((g) => g.colors.map((c) => c.key));

/** "#abc" / "abc" / "#aabbcc" → "#aabbcc", or null */
export function normalizeHex(value: string): string | null {
  const m = value.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return `#${hex.toLowerCase()}`;
}

/** New custom theme copied from `base` */
export function newCustomTheme(base: Theme, existing: Theme[]): Theme {
  const names = new Set(existing.map((t) => t.label));
  let n = existing.length + 1;
  while (names.has(`My theme ${n}`)) n++;
  const { note: _note, ...rest } = base;
  return {
    ...rest,
    id: `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    label: isCustomTheme(base.id) ? `${base.label} copy` : `My theme ${n}`,
  };
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
    out.push(t);
  }
  return out;
}

/** WCAG contrast ratio of two hex colours (1–21) */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, bl] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function getFormat(id: string): Format {
  return FORMATS.find((f) => f.id === id) ?? FORMATS[0];
}
