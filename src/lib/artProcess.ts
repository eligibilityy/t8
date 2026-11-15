import type { ArtAsset, ArtFrame, ArtLibrary } from "../types";
import { rosterEntry } from "../data/tekken8";
import published from "../data/published-art.json";

const MAX_SIDE = 1600;
const ANALYSIS_H = 256;
export const DEFAULT_FRAME: ArtFrame = {
  focusX: 50,
  focusY: 20,
  face: 0.12,
  zoom: 1,
};

const isSkin = (r: number, g: number, b: number) =>
  // RGB skin rule, widened for game lighting
  r > 90 &&
  g > 40 &&
  b > 20 &&
  r > g &&
  r > b &&
  r - Math.min(g, b) > 15 &&
  Math.abs(r - g) > 12 &&
  r - b < 170;

/** Estimate the face in a transparent render: torso -> head top -> first skin cluster, else silhouette. */
export function estimateFrame(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): ArtFrame {
  const at = (x: number, y: number) => (y * w + x) * 4;
  const opaque = (x: number, y: number) => data[at(x, y) + 3] >= 64;

  let top = h,
    bottom = -1,
    left = w,
    right = -1,
    transparent = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!opaque(x, y)) {
        transparent++;
        continue;
      }
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  if (bottom < 0 || transparent < w * h * 0.08) return DEFAULT_FRAME;
  const bh = bottom - top + 1;
  const bw = right - left + 1;

  // Torso centre
  let sx = 0,
    n = 0;
  for (let y = Math.round(top + bh * 0.3); y < top + bh * 0.55; y++)
    for (let x = left; x <= right; x++) if (opaque(x, y)) ((sx += x), n++);
  const cxBody = n ? sx / n : (left + right) / 2;

  // Head top above the torso
  const half = Math.max(4, Math.min(bw * 0.22, h * 0.18));
  const x0 = Math.max(0, Math.round(cxBody - half));
  const x1 = Math.min(w - 1, Math.round(cxBody + half));
  const minRun = Math.max(2, Math.round((x1 - x0) * 0.04));
  let headTop = top;
  for (let y = top; y < bottom; y++) {
    let c = 0;
    for (let x = x0; x <= x1; x++) if (opaque(x, y)) c++;
    if (c >= minRun) {
      headTop = y;
      break;
    }
  }

  // Skin cluster below the head top
  const searchBottom = Math.min(bottom, Math.round(headTop + bh * 0.4));
  let firstSkinRow = -1;
  for (let y = headTop; y <= searchBottom && firstSkinRow < 0; y++) {
    let c = 0;
    for (let x = x0; x <= x1; x++) {
      const i = at(x, y);
      if (data[i + 3] >= 200 && isSkin(data[i], data[i + 1], data[i + 2])) c++;
    }
    if (c >= Math.max(2, (x1 - x0) * 0.05)) firstSkinRow = y;
  }

  if (firstSkinRow >= 0) {
    const clusterBottom = Math.min(
      searchBottom,
      firstSkinRow + Math.round(h * 0.12),
    );
    let cx = 0,
      cy = 0,
      c = 0,
      maxY = firstSkinRow,
      widest = 0,
      narrowRun = 0;
    for (let y = firstSkinRow; y <= clusterBottom; y++) {
      let rowC = 0,
        rowX = 0;
      for (let x = x0; x <= x1; x++) {
        const i = at(x, y);
        if (data[i + 3] >= 200 && isSkin(data[i], data[i + 1], data[i + 2]))
          (rowC++, (rowX += x));
      }
      // Chin: where skin narrows into the neck (checked below eye level)
      narrowRun = rowC < widest * 0.5 ? narrowRun + 1 : 0;
      if (y - firstSkinRow > h * 0.055 && narrowRun >= 3) break;
      widest = Math.max(widest, rowC);
      cx += rowX;
      cy += y * rowC;
      c += rowC;
      if (rowC) maxY = y;
    }
    if (c >= 12) {
      // Hairline to chin
      const faceTop = (headTop + firstSkinRow * 2) / 3;
      const faceH = clamp(maxY - faceTop, h * 0.05, h * 0.22);
      return frame(cx / c, faceTop + faceH * 0.5, faceH, w, h);
    }
  }

  // Silhouette fallback
  const faceH = clamp(Math.min(bh * 0.13, (x1 - x0) * 0.5), h * 0.05, h * 0.2);
  let hx = 0,
    hc = 0;
  for (let y = headTop; y < headTop + faceH; y++)
    for (let x = x0; x <= x1; x++) if (opaque(x, y)) ((hx += x), hc++);
  return frame(hc ? hx / hc : cxBody, headTop + faceH * 0.6, faceH, w, h);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function frame(
  cx: number,
  cy: number,
  faceH: number,
  w: number,
  h: number,
): ArtFrame {
  return {
    focusX: Math.round((cx / w) * 1000) / 10,
    focusY: Math.round((cy / h) * 1000) / 10,
    face: Math.round((faceH / h) * 1000) / 1000,
    zoom: 1,
  };
}

async function decode(src: string | Blob): Promise<HTMLImageElement> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  const img = new Image();
  try {
    img.src = url;
    await img.decode();
  } finally {
    if (typeof src !== "string") URL.revokeObjectURL(url);
  }
  if (!img.width || !img.height) throw new Error("Image has no size");
  return img;
}

function analyse(img: HTMLImageElement): ArtFrame {
  const aw = Math.max(1, Math.round(img.width * (ANALYSIS_H / img.height)));
  const c = document.createElement("canvas");
  c.width = aw;
  c.height = ANALYSIS_H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, aw, ANALYSIS_H);
  return estimateFrame(
    ctx.getImageData(0, 0, aw, ANALYSIS_H).data,
    aw,
    ANALYSIS_H,
  );
}

/** Downscale, encode as WebP and auto-frame an uploaded image. */
export async function processImage(blob: Blob): Promise<ArtAsset> {
  const img = await decode(blob);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);

  let src = canvas.toDataURL("image/webp", 0.9);
  if (!src.startsWith("data:image/webp")) src = canvas.toDataURL("image/png"); // Safari fallback
  return { src, ...analyse(img), source: "upload" };
}

/** Reset a frame: built-in frame for built-in art, otherwise detection. */
export async function autoFrame(name: string, a: ArtAsset): Promise<ArtAsset> {
  const { manual: _, ...rest } = a;
  const builtin = a.source === "builtin" ? builtinArt(name) : null;
  if (builtin) return { ...rest, ...frameOf(builtin) };
  try {
    return { ...rest, ...analyse(await decode(a.src)) };
  } catch {
    return { ...rest, ...DEFAULT_FRAME };
  }
}

// Built-in art (see `npm run publish:art`)

type PublishedCharacter = {
  src: string;
  thumb?: string;
  focusX?: number;
  focusY?: number;
  face?: number;
};
const BUILTIN = published.characters as Record<string, PublishedCharacter>;

/** "Roger Jr." → "roger-jr" */
export function artSlug(name: string): string {
  return (
    rosterEntry(name)?.slug ??
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  );
}

export function builtinArt(name: string): ArtAsset | null {
  const p = name ? BUILTIN[artSlug(name)] : undefined;
  if (!p) return null;
  const frame =
    typeof p.face === "number"
      ? {
          focusX: p.focusX ?? 50,
          focusY: p.focusY ?? 20,
          face: p.face,
          zoom: 1,
        }
      : DEFAULT_FRAME;
  return { src: p.src, thumb: p.thumb, ...frame, source: "builtin" };
}

const frameOf = (a: ArtAsset): ArtFrame => ({
  focusX: a.focusX,
  focusY: a.focusY,
  face: a.face,
  zoom: a.zoom,
});

/** Saved art over built-in art. Characters with neither are left out. */
export function resolveArt(names: string[], saved: ArtLibrary): ArtLibrary {
  const out: ArtLibrary = {};
  for (const n of names) {
    const a = saved[n] ?? builtinArt(n);
    if (a) out[n] = a;
  }
  return out;
}

/** Keep uploads and hand crops; drop anything else (including art saved by older versions). */
export function isKeptOverride(a: ArtAsset): boolean {
  if (typeof a.face !== "number") return false;
  return a.source === "upload" || (a.source === "builtin" && !!a.manual);
}
