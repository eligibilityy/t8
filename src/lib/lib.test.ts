import { describe, expect, it } from "vitest";
import { ordinal, ordinalParts, schemePlacement } from "./placements";
import { buildTextPost, flagEmoji } from "./textPost";
import { matchRosterName } from "../data/tekken8";
import { defaultState } from "../state";
import { THEMES, contrastRatio, getTheme, hydrateCustomThemes, isCustomTheme, newCustomTheme, normalizeHex } from "../data/themes";

describe("placements", () => {
  it("double elim ties", () => {
    const got = Array.from({ length: 32 }, (_, i) => schemePlacement("DE", i));
    expect(got.slice(0, 8)).toEqual([1, 2, 3, 4, 5, 5, 7, 7]);
    expect(got.slice(8, 16)).toEqual([9, 9, 9, 9, 13, 13, 13, 13]);
    expect(got.slice(16, 24)).toEqual(Array(8).fill(17));
    expect(got.slice(24, 32)).toEqual(Array(8).fill(25));
  });
  it("single elim is sequential", () => {
    expect(Array.from({ length: 8 }, (_, i) => schemePlacement("SE", i))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it("ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st",
    ]);
    expect(ordinalParts(5)).toEqual(["5", "TH"]);
  });
});

describe("roster matching", () => {
  it("matches filenames, preferring the longest name", () => {
    expect(matchRosterName("devil_jin.png")).toBe("Devil Jin");
    expect(matchRosterName("JIN-render.webp")).toBe("Jin");
    expect(matchRosterName("T8_Jack-8_full.png")).toBe("Jack-8");
    expect(matchRosterName("armorking.png")).toBe("Armor King");
    expect(matchRosterName("random.png")).toBeNull();
  });
});

describe("text post", () => {
  it("flag emoji", () => {
    expect(flagEmoji("kr")).toBe("🇰🇷");
    expect(flagEmoji("x")).toBe("");
  });
  it("formats medals, keycaps, ties and meta", () => {
    const s = defaultState();
    const text = buildTextPost(s.event, s.entries, { handles: false, characters: true, flags: true });
    const lines = text.split("\n");
    expect(lines[0]).toBe("🏆 Iron Monsoon 2026 · Tekken 8 Top 8");
    expect(lines[2]).toBe("🥇 🇯🇵 NVX | Kagerou – Jin / Devil Jin");
    expect(lines[3].startsWith("🥈 🇰🇷 Ironclad")).toBe(true);
    expect(lines.filter((l) => l.startsWith("5️⃣"))).toHaveLength(2);
    expect(lines.filter((l) => l.startsWith("7️⃣"))).toHaveLength(2);
    expect(text).toContain("256 entrants · Nov 1, 2026 · Manila, PH");
    expect(text.trim().endsWith("#IronMonsoon")).toBe(true);
  });
});

import { estimateFrame } from "./artProcess";
import { ROSTER, rosterEntry } from "../data/tekken8";

describe("estimateFrame", () => {
  const W = 40, H = 80;
  function canvas() {
    return new Uint8ClampedArray(W * H * 4);
  }
  function fill(d: Uint8ClampedArray, x0: number, x1: number, y0: number, y1: number, rgb: [number, number, number]) {
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = (y * W + x) * 4;
        [d[i], d[i + 1], d[i + 2], d[i + 3]] = [...rgb, 255];
      }
  }
  const DARK: [number, number, number] = [20, 20, 30];
  const SKIN: [number, number, number] = [210, 160, 130];

  it("finds a skin-tone face under hair, ignoring wide wings at the top", () => {
    const d = canvas();
    fill(d, 0, 40, 2, 10, DARK); // "wings" spanning the full width, above the head
    fill(d, 17, 25, 6, 9, DARK); // hair
    fill(d, 17, 25, 9, 17, SKIN); // face, rows 9–16
    fill(d, 19, 23, 17, 20, SKIN); // neck (narrow)
    fill(d, 10, 30, 20, 80, DARK); // body
    const f = estimateFrame(d, W, H);
    expect(f.focusX).toBeCloseTo(51.25, 0); // face spans x 17–24 → centre 20.5
    expect(f.focusY).toBeGreaterThan(10); // below the hair line
    expect(f.focusY).toBeLessThan(22);
    expect(f.face).toBeLessThan(0.2); // the neck isn't counted as face
  });
  it("falls back to the silhouette for masked characters", () => {
    const d = canvas();
    fill(d, 24, 30, 4, 12, DARK); // head, right of centre
    fill(d, 14, 34, 12, 80, DARK);
    const f = estimateFrame(d, W, H);
    expect(f.focusX).toBeGreaterThan(55);
    expect(f.focusY).toBeLessThan(20);
  });
  it("leaves opaque images on the default frame", () => {
    const d = new Uint8ClampedArray(10 * 10 * 4).fill(255);
    expect(estimateFrame(d, 10, 10)).toEqual({ focusX: 50, focusY: 20, face: 0.12, zoom: 1 });
  });
});

describe("built-in art", () => {
  it("has framed art for every roster character", async () => {
    const { builtinArt } = await import("./artProcess");
    const missing = ROSTER.filter((c) => {
      const a = builtinArt(c.name);
      return !a || !a.src.startsWith("/art/") || !(a.face > 0);
    }).map((c) => c.name);
    expect(missing).toEqual([]);
  });
  it("uses saved art over built-in art, and leaves unknown characters out", async () => {
    const { resolveArt } = await import("./artProcess");
    const upload = { src: "data:x", source: "upload" as const, focusX: 1, focusY: 1, face: 0.2, zoom: 1 };
    const art = resolveArt(["Nina", "Jin", "Somebody New"], { Jin: upload });
    expect(art.Nina?.source).toBe("builtin");
    expect(art.Jin).toBe(upload);
    expect(art["Somebody New"]).toBeUndefined();
  });
  it("keeps uploads and hand crops, drops art older versions fetched by themselves", async () => {
    const { isKeptOverride } = await import("./artProcess");
    const base = { src: "x", focusX: 1, focusY: 1, face: 0.2, zoom: 1 };
    expect(isKeptOverride({ ...base, source: "upload" })).toBe(true);
    expect(isKeptOverride({ ...base, source: "builtin", manual: true })).toBe(true);
    const legacy = (source: string) => ({ ...base, source, manual: true }) as unknown as Parameters<typeof isKeptOverride>[0];
    expect(isKeptOverride(legacy("wavu"))).toBe(false);
    expect(isKeptOverride(legacy("local"))).toBe(false);
    expect(isKeptOverride({ ...base, source: "builtin" })).toBe(false);
  });
});

describe("synced roster", () => {
  it("has the current cast and resolves names loosely", () => {
    expect(ROSTER.length).toBeGreaterThanOrEqual(40);
    expect(rosterEntry("devil jin")?.name).toBe("Devil Jin");
    expect(rosterEntry("Miary Zo")).toBeDefined();
  });
});

describe("custom themes", () => {
  it("normalizes hex codes", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex("f50a64")).toBe("#f50a64");
    expect(normalizeHex("#12345")).toBeNull();
    expect(normalizeHex("red")).toBeNull();
  });
  it("copies the base theme under a new name", () => {
    const t = newCustomTheme(THEMES[1], []);
    expect(isCustomTheme(t.id)).toBe(true);
    expect(t.label).toBe("My theme 1");
    expect(t.accent).toBe(THEMES[1].accent);
    expect(t.note).toBeUndefined();
    expect(newCustomTheme(t, [t]).label).toBe("My theme 1 copy");
  });
  it("drops malformed saved themes and bad colours", () => {
    const got = hydrateCustomThemes([
      { id: "custom-a", label: "Mine", accent: "#00FF00", text: "url(x)" },
      { id: "heat", label: "Fake built-in" },
      { id: "custom-a", label: "Duplicate" },
      null,
    ]);
    expect(got).toHaveLength(1);
    expect(got[0].accent).toBe("#00ff00");
    expect(got[0].text).toBe(THEMES[0].text);
    expect(hydrateCustomThemes("nope")).toEqual([]);
  });
  it("finds custom themes and falls back for deleted ones", () => {
    const t = newCustomTheme(THEMES[2], []);
    expect(getTheme(t.id, [t])).toBe(t);
    expect(getTheme(t.id, []).id).toBe(THEMES[0].id);
  });
  it("contrast ratio", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#777777", "#777777")).toBe(1);
  });
});
