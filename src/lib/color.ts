// Colour maths for the theme editor. Hex strings are "#rrggbb".

export type RGB = { r: number; g: number; b: number };
/** h 0–360, s and v 0–1 */
export type HSV = { h: number; s: number; v: number };

export function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1, 7), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function rgbToHsv({ r, g, b }: RGB): HSV {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const d = max - Math.min(R, G, B);
  let h = 0;
  if (d) {
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

export function hsvToRgb({ h, s, v }: HSV): RGB {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255;
  };
  return { r: f(5), g: f(3), b: f(1) };
}

export const hexToHsv = (hex: string) => rgbToHsv(hexToRgb(hex));
export const hsvToHex = (hsv: HSV) => rgbToHex(hsvToRgb(hsv));

/** Blend a toward b by t (0–1) */
export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex({ r: A.r + (B.r - A.r) * t, g: A.g + (B.g - A.g) * t, b: A.b + (B.b - A.b) * t });
}

/** WCAG relative luminance */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** WCAG contrast ratio (1–21) */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const isDark = (hex: string) => luminance(hex) < 0.2;

/** Of the candidates, the one that reads best on `bg` */
export function bestOn(bg: string, candidates: string[]): string {
  return candidates.reduce((best, c) => (contrastRatio(c, bg) > contrastRatio(best, bg) ? c : best));
}

/**
 * A few representative colours of an image (k-means on a small downscale). Skips near-black
 * and near-white pixels so the palette favours the picture's actual colours.
 */
export function paletteFromPixels(data: Uint8ClampedArray, k = 6): string[] {
  const px: RGB[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const p = { r: data[i], g: data[i + 1], b: data[i + 2] };
    const max = Math.max(p.r, p.g, p.b);
    const min = Math.min(p.r, p.g, p.b);
    if (max < 24 || min > 236) continue;
    px.push(p);
  }
  if (!px.length) return [];
  // Seed from evenly spaced pixels sorted by brightness, for a stable result
  const sorted = [...px].sort((a, b) => a.r + a.g + a.b - (b.r + b.g + b.b));
  let centers = Array.from({ length: Math.min(k, sorted.length) }, (_, i) => sorted[Math.floor(((i + 0.5) * sorted.length) / k)]);
  let counts: number[] = [];
  for (let iter = 0; iter < 8; iter++) {
    const sums = centers.map(() => ({ r: 0, g: 0, b: 0 }));
    counts = centers.map(() => 0);
    for (const p of px) {
      let best = 0;
      let bestD = Infinity;
      centers.forEach((c, i) => {
        const d = (p.r - c.r) ** 2 + (p.g - c.g) ** 2 + (p.b - c.b) ** 2;
        if (d < bestD) ((bestD = d), (best = i));
      });
      sums[best].r += p.r;
      sums[best].g += p.g;
      sums[best].b += p.b;
      counts[best]++;
    }
    centers = centers.map((c, i) => (counts[i] ? { r: sums[i].r / counts[i], g: sums[i].g / counts[i], b: sums[i].b / counts[i] } : c));
  }
  // Most common first; drop near-duplicates
  const out: string[] = [];
  centers
    .map((c, i) => ({ hex: rgbToHex(c), n: counts[i] }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n)
    .forEach(({ hex }) => {
      if (!out.some((o) => contrastRatio(o, hex) < 1.15 && hueDistance(o, hex) < 20)) out.push(hex);
    });
  return out;
}

function hueDistance(a: string, b: string): number {
  const d = Math.abs(hexToHsv(a).h - hexToHsv(b).h);
  return Math.min(d, 360 - d);
}
