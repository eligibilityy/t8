import type { Entry, PlacementScheme } from "../types";

export function schemePlacement(scheme: Exclude<PlacementScheme, "custom">, index: number): number {
  if (scheme === "SE") return index + 1;
  // Double elim goes 1, 2, 3, 4, 5, 5, 7, 7, then 9th and 13th four times each, then eights, and so on
  if (index < 4) return index + 1;
  let place = 5;
  let size = 2;
  let pairStep = 0;
  for (;;) {
    if (index < place - 1 + size) return place;
    place += size;
    pairStep++;
    if (pairStep === 2) {
      pairStep = 0;
      size *= 2;
    }
  }
}

export function applyScheme(entries: Entry[], scheme: PlacementScheme): Entry[] {
  if (scheme === "custom") return entries;
  return entries.map((e, i) => ({ ...e, placement: schemePlacement(scheme, i) }));
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

export function ordinalParts(n: number): [string, string] {
  const o = ordinal(n);
  return [String(n), o.slice(String(n).length).toUpperCase()];
}
