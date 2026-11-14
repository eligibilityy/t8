import type { BackgroundImage } from "../types";
import published from "../data/published-art.json";
import { FORMATS } from "../data/themes";

export type Stage = { slug: string; name: string; src: string; thumb: string };

export const STAGES: Stage[] = published.stages as Stage[];

export function stageBackground(stage: Stage): BackgroundImage {
  return { src: stage.src, id: `stage:${stage.slug}`, label: stage.name };
}

export async function uploadBackground(file: File): Promise<BackgroundImage> {
  return { src: await processBackground(file), id: "upload", label: file.name.replace(/\.[a-z0-9]+$/i, "") };
}

/** Downscale to just cover every export format, as JPEG. */
async function processBackground(blob: Blob): Promise<string> {
  const img = await decode(blob);
  try {
    const needW = Math.max(...FORMATS.map((f) => f.width));
    const needH = Math.max(...FORMATS.map((f) => f.height));
    const w = "naturalWidth" in img ? img.naturalWidth : img.width;
    const h = "naturalHeight" in img ? img.naturalHeight : img.height;
    const scale = Math.min(1, Math.max(needW / w, needH / h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.88);
  } finally {
    if ("close" in img) img.close();
  }
}

/** createImageBitmap rejects SVG; fall back to <img>. */
async function decode(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(blob);
  } catch {
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      if (!img.naturalWidth) throw new Error("That file isn't an image this browser can open.");
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
