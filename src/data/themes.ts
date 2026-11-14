import type { Format, Theme } from "../types";

// Bebas for display, Inter for small text
const display = "'Bebas Neue', sans-serif";
const body = "'Inter Variable', system-ui, sans-serif";
const mono = body;

export const THEMES: Theme[] = [
  {
    id: "heat",
    label: "Heat (magenta / cyan)",
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
    label: "Crown (black / gold)",
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
    label: "Volt (blue / neon)",
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
    label: "Paper (light)",
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

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function getFormat(id: string): Format {
  return FORMATS.find((f) => f.id === id) ?? FORMATS[0];
}
