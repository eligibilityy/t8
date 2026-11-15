import { toPng } from "html-to-image";

export async function downloadPng(node: HTMLElement, width: number, height: number, filename: string) {
  await document.fonts.ready;
  const opts = { width, height, pixelRatio: 1, style: { transform: "none" } };
  // The first pass only warms up html-to-image's cache, so fonts and pictures make it into the second
  await toPng(node, opts);
  const dataUrl = await toPng(node, opts);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "results";
}
