import { describe, expect, it } from "vitest";
import { applyScheme, ordinal, ordinalParts, schemePlacement } from "./placements";
import { buildTextPost, flagEmoji } from "./textPost";
import { TEKKEN8_ROSTER, matchRosterName } from "../data/tekken8";
import { builtinArt } from "./artProcess";
import { defaultState } from "../state";
import { FIT, clampView, project, rubberband, softPan, zoomAt, type Box } from "./panZoom";
import { MATCHED_COLORS, createTheme, deleteTheme, deriveColor, isAuto, resetThemeColor, restoreTheme, setThemeColor, updateTheme } from "../data/themes";
import { bestOn, hexToHsv, hsvToHex, mix, paletteFromPixels } from "./color";
import type { Theme } from "../types";
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
    // Its own fixture, so changing the app's sample data can't break this test
    const players: Array<[string, string, string, string[]]> = [
      ["NVX", "Kagerou", "jp", ["Jin", "Devil Jin"]],
      ["", "Ironclad", "kr", ["Dragunov"]],
      ["RVN", "Mistral", "pk", ["Reina", "Kazuya"]],
      ["", "Bulwark", "us", ["King"]],
      ["ODA", "Hexfire", "fr", ["Lili"]],
      ["", "Sunder", "sa", ["Bryan", "Feng", "Law"]],
      ["KTR", "Lowkick Larry", "gb", ["Steve"]],
      ["", "Pazuzu", "ph", ["Yoshimitsu"]],
    ];
    const entries = applyScheme(
      players.map(([sponsor, tag, country, chars], i) => ({
        id: String(i),
        placement: 0,
        sponsor,
        tag,
        country,
        handle: "",
        characters: chars.map((name) => ({ name })),
      })),
      "DE",
    );
    const event = {
      ...defaultState().event,
      name: "Iron Monsoon 2026",
      game: "Tekken 8",
      subtitle: "Top 8",
      date: "Nov 1, 2026",
      location: "Manila, PH",
      entrants: "256",
      hashtag: "#IronMonsoon",
    };
    const text = buildTextPost(event, entries, { handles: false, characters: true, flags: true });
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
    fill(d, 0, 40, 2, 10, DARK); // wings across the full width, above the head
    fill(d, 17, 25, 6, 9, DARK); // hair
    fill(d, 17, 25, 9, 17, SKIN); // face
    fill(d, 19, 23, 17, 20, SKIN); // a narrow neck
    fill(d, 10, 30, 20, 80, DARK); // body
    const f = estimateFrame(d, W, H);
    expect(f.focusX).toBeCloseTo(51.25, 0); // the face runs from x 17 to 24, so its centre is 20.5
    expect(f.focusY).toBeGreaterThan(10); // below the hairline
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
    expect(t.label).toBe("My theme");
    expect(t.accent).toBe(THEMES[1].accent);
    expect(t.note).toBeUndefined();
    expect(newCustomTheme(t, [t]).label).toBe("My theme copy");
    expect(newCustomTheme(THEMES[1], [t]).label).toBe("My theme 2");
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

describe("preview zoom", () => {
  // A 1920x1080 graphic shown at half size in a 960x540 frame, zooming up to 4x
  const b: Box = { width: 1920, height: 1080, frameW: 960, frameH: 540, fit: 0.5, maxZ: 4 };

  it("zooms around the given point", () => {
    const v = zoomAt(b, FIT, 2, 300, 200);
    const before = { x: (300 - FIT.x) / (0.5 * FIT.z), y: (200 - FIT.y) / (0.5 * FIT.z) };
    const after = { x: (300 - v.x) / (0.5 * v.z), y: (200 - v.y) / (0.5 * v.z) };
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });
  it("never zooms out past fit or in past the limit", () => {
    expect(zoomAt(b, FIT, 0.2, 0, 0)).toEqual(FIT);
    expect(zoomAt(b, FIT, 99, 0, 0).z).toBe(4);
  });
  it("keeps the graphic covering the frame", () => {
    const v = clampView(b, { z: 2, x: 500, y: -5000 });
    expect(v.x).toBe(0);
    expect(v.y).toBe(540 - 1080); // the bottom edge lines up with the frame
  });
  it("resists past the edges", () => {
    expect(softPan(50, -500, 0, 960)).toBeGreaterThan(0);
    expect(softPan(50, -500, 0, 960)).toBeLessThan(50);
    expect(softPan(-200, -500, 0, 960)).toBe(-200);
    expect(rubberband(1e6, 960)).toBeLessThan(960);
  });
  it("projects a flick forward", () => {
    expect(project(1000)).toBeCloseTo(499, 0);
    expect(project(-1000)).toBeCloseTo(-499, 0);
    expect(project(0)).toBe(0);
  });
});

describe("built-in art", () => {
  it("every roster character has a face thumbnail", () => {
    const missing = TEKKEN8_ROSTER.filter((n) => !builtinArt(n)?.thumb?.includes(".face."));
    expect(missing).toEqual([]);
  });
});

describe("colour maths", () => {
  it("round-trips hex through HSV", () => {
    for (const hex of ["#f50a64", "#3fd1e7", "#000000", "#ffffff", "#7f7f7f", "#c9a45c"]) expect(hsvToHex(hexToHsv(hex))).toBe(hex);
  });
  it("mixes and measures", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(bestOn("#d7ff1f", ["#ffffff", "#111111"])).toBe("#111111");
    expect(bestOn("#0b0b0f", ["#ffffff", "#111111"])).toBe("#ffffff");
  });
  it("finds a background's main colours", () => {
    // Mostly red, some blue, and black that should be ignored
    const px = (r: number, g: number, b: number, n: number) => Array.from({ length: n }, () => [r, g, b, 255]).flat();
    const data = new Uint8ClampedArray([...px(220, 30, 40, 300), ...px(30, 60, 220, 100), ...px(0, 0, 0, 200)]);
    const pal = paletteFromPixels(data, 4);
    expect(pal[0]).toBe("#dc1e28");
    expect(pal).toContain("#1e3cdc");
    expect(pal).not.toContain("#000000");
  });
});

describe("matched theme colours", () => {
  const heat = THEMES[0];
  it("follow the key colour they depend on", () => {
    const patch = setThemeColor({ ...heat, manual: [] }, "accent", "#d7ff1f");
    expect(patch.accent).toBe("#d7ff1f");
    expect(patch.accentInk).toBe("#111111"); // dark text on a light accent
    expect(patch.bg2).toBe(deriveColor("bg2", { ...heat, accent: "#d7ff1f" }));
    expect(patch.surface).toBeUndefined(); // panels don't depend on the accent
  });
  it("keep white on vivid accents like the built-in themes", () => {
    for (const t of THEMES.filter((t) => t.accentInk === "#ffffff")) expect(deriveColor("accentInk", t)).toBe("#ffffff");
  });
  it("leave hand-set colours alone", () => {
    const patch = setThemeColor({ ...heat, manual: ["accentInk"] }, "accent", "#d7ff1f");
    expect(patch.accentInk).toBeUndefined();
  });
  it("follow chains: background → text → small text", () => {
    const patch = setThemeColor({ ...heat, manual: [] }, "bg", "#f1eee8");
    expect(patch.text).toBe("#111111");
    expect(patch.textDim).toBe(mix("#111111", "#f1eee8", 0.42));
  });
  it("setting one by hand marks it, matching again clears it", () => {
    const t = { ...heat, manual: [] as string[] };
    const set = { ...t, ...setThemeColor(t, "textDim", "#ff0000") };
    expect(isAuto(set, "textDim")).toBe(false);
    const back = { ...set, ...resetThemeColor(set, "textDim") };
    expect(isAuto(back, "textDim")).toBe(true);
    expect(back.textDim).toBe(deriveColor("textDim", back));
  });
});

describe("theme list", () => {
  const base = { themeId: "heat", customThemes: [] as Theme[] };
  it("editing a built-in saves a copy and selects it", () => {
    const s = updateTheme(base, "heat", { accent: "#00ff00" });
    expect(s.customThemes).toHaveLength(1);
    expect(s.customThemes[0].label).toBe("Custom Heat");
    expect(s.customThemes[0].accent).toBe("#00ff00");
    expect(s.themeId).toBe(s.customThemes[0].id);
    expect(THEMES[0].accent).not.toBe("#00ff00");
    const s2 = updateTheme(s, s.themeId, { accent: "#0000ff" });
    expect(s2.customThemes).toHaveLength(1);
    expect(s2.customThemes[0].accent).toBe("#0000ff");
  });
  it("undo puts a deleted theme back in place", () => {
    let s = createTheme(createTheme(base));
    const [a, b] = s.customThemes;
    s = deleteTheme(s, a.id);
    expect(s.customThemes.map((t) => t.id)).toEqual([b.id]);
    s = restoreTheme(s, a, 0);
    expect(s.customThemes.map((t) => t.id)).toEqual([a.id, b.id]);
    expect(s.themeId).toBe(a.id);
  });
  it("themes saved before matching keep their colours as set", () => {
    const [t] = hydrateCustomThemes([{ id: "custom-x", label: "Old", accent: "#00ff00" }]);
    expect(MATCHED_COLORS.every(({ key }) => !isAuto(t, key))).toBe(true);
  });
});
