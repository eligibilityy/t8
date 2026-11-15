import { describe, expect, it } from "vitest";
import {
  ImportError,
  charactersByEntrant,
  formatDate,
  mapChallonge,
  mapStartgg,
  parseBracketUrl,
  pickEvent,
  splitPrefix,
} from "../../api/import";
import { applyImport, countryCode, detectScheme, rosterName } from "./importResults";
import { defaultState } from "../state";

describe("bracket links", () => {
  it("reads start.gg event and tournament links", () => {
    expect(parseBracketUrl("https://www.start.gg/tournament/evo-2026/event/tekken-8/overview")).toEqual({
      source: "startgg",
      tournament: "evo-2026",
      event: "tekken-8",
    });
    expect(parseBracketUrl("start.gg/tournament/evo-2026/event/tekken-8")).toMatchObject({ event: "tekken-8" });
    expect(parseBracketUrl("https://start.gg/tournament/evo-2026/details")).toEqual({
      source: "startgg",
      tournament: "evo-2026",
      event: undefined,
    });
  });
  it("reads Challonge links, including org subdomains and language prefixes", () => {
    expect(parseBracketUrl("https://challonge.com/abc123")).toEqual({ source: "challonge", id: "abc123" });
    expect(parseBracketUrl("challonge.com/fr/abc123/standings")).toEqual({ source: "challonge", id: "abc123" });
    expect(parseBracketUrl("https://dlsl.challonge.com/weekly5")).toEqual({ source: "challonge", id: "dlsl-weekly5" });
  });
  it("rejects anything else", () => {
    expect(parseBracketUrl("https://liquipedia.net/fighters/Evo")).toBeNull();
    expect(parseBracketUrl("start.gg/user/abc")).toBeNull();
    expect(parseBracketUrl("challonge.com/users/me")).toBeNull();
    expect(parseBracketUrl("")).toBeNull();
  });
});

describe("start.gg import", () => {
  const entrant = (id: string, prefix: string | null, tag: string, country: string | null, twitter: string | null) => ({
    id,
    name: prefix ? `${prefix} | ${tag}` : tag,
    participants: [
      {
        gamerTag: tag,
        prefix,
        user: { location: { country }, authorizations: twitter ? [{ externalUsername: twitter }] : [] },
      },
    ],
  });
  const event = {
    id: "1",
    name: "Tekken 8",
    slug: "tournament/evo-2026/event/tekken-8",
    numEntrants: 1355,
    startAt: 1782604800, // 2026-06-28 00:00 UTC
    isOnline: false,
    videogame: { displayName: "TEKKEN 8" },
    tournament: {
      name: "Evo 2026",
      city: "Las Vegas",
      addrState: "NV",
      countryCode: "US",
      hashtag: "EVO2026",
      timezone: "America/Los_Angeles",
    },
    standings: {
      nodes: [
        { placement: 2, entrant: entrant("e2", "VL", "Rangchu", "South Korea", null) },
        { placement: 1, entrant: entrant("e1", "TWIS", "Arslan Ash", "Pakistan", "ArslanAsh") },
        { placement: 3, entrant: entrant("e3", null, "LowHigh", "Korea, Republic of", null) },
      ],
    },
  };
  const pick = (id: string, name: string | null) => ({ entrant: { id }, character: name ? { name } : null });
  const sets = {
    sets: {
      nodes: [
        {
          games: [
            { selections: [pick("e1", "Kunimitsu"), pick("e2", "Fahkumram")] },
            { selections: [pick("e1", "Nina"), pick("e2", "Fahkumram")] },
            { selections: [pick("e1", "Kunimitsu"), pick("e2", null)] },
          ],
        },
      ],
    },
  };

  it("maps the event and players", () => {
    const r = mapStartgg(event, charactersByEntrant(sets));
    expect(r.event).toEqual({
      name: "Evo 2026",
      game: "Tekken 8",
      date: "Jun 27, 2026", // midnight UTC is still the 27th in Las Vegas
      location: "Las Vegas, NV",
      entrants: "1355",
      url: "start.gg/tournament/evo-2026/event/tekken-8",
      hashtag: "#EVO2026",
    });
    expect(r.players.map((p) => p.placement)).toEqual([1, 2, 3]);
    expect(r.players[0]).toEqual({
      placement: 1,
      prefix: "TWIS",
      tag: "Arslan Ash",
      country: "Pakistan",
      handle: "ArslanAsh",
      characters: ["Kunimitsu", "Nina"],
    });
    expect(r.players[1].characters).toEqual(["Fahkumram"]);
    expect(r.warnings).toContain("Some players have no reported characters.");
    expect(r.warnings).toContain("Only 3 placements so far.");
  });
  it("explains when there are no standings yet", () => {
    expect(() => mapStartgg({ ...event, standings: { nodes: [] } }, new Map())).toThrow(ImportError);
  });
  it("picks the Tekken 8 event from a tournament link", () => {
    expect(
      pickEvent([
        { slug: "a/sf6", numEntrants: 3000, videogame: { displayName: "Street Fighter 6" } },
        { slug: "a/t8-side", numEntrants: 40, videogame: { displayName: "TEKKEN 8" } },
        { slug: "a/t8", numEntrants: 1355, videogame: { displayName: "TEKKEN 8" } },
      ]),
    ).toBe("a/t8");
    expect(
      pickEvent([
        { slug: "a/sf6", numEntrants: 1, videogame: { displayName: "SF6" } },
        { slug: "a/gg", numEntrants: 1, videogame: null },
      ]),
    ).toBeNull();
  });
});

describe("Challonge import", () => {
  const p = (name: string, final_rank: number | null) => ({ participant: { name, final_rank } });
  it("maps final ranks and splits sponsor prefixes", () => {
    const r = mapChallonge({
      name: "DLSL Weekly 5",
      game_name: "Tekken 8",
      started_at: "2026-11-01T18:00:00.000+08:00",
      participants_count: 24,
      full_challonge_url: "https://dlsl.challonge.com/weekly5",
      participants: [
        p("Nobi", 5),
        p("TWIS | Arslan Ash", 1),
        p("Rangchu", 2),
        p("Late", 9),
        p("A", 3),
        p("B", 4),
        p("C", 5),
        p("D", 7),
        p("E", 7),
      ],
    });
    expect(r.players.map((x) => x.placement)).toEqual([1, 2, 3, 4, 5, 5, 7, 7]);
    expect(r.players[0]).toMatchObject({ prefix: "TWIS", tag: "Arslan Ash" });
    expect(r.event).toMatchObject({
      name: "DLSL Weekly 5",
      game: "Tekken 8",
      entrants: "24",
      url: "dlsl.challonge.com/weekly5",
      date: "Nov 1, 2026",
    });
  });
  it("refuses unfinished brackets", () => {
    expect(() => mapChallonge({ name: "x", participants: [p("A", null), p("B", null)] })).toThrow(/isn't finished/);
  });
});

describe("import helpers", () => {
  it("splits prefixes only when there is one", () => {
    expect(splitPrefix("TWIS | Arslan Ash")).toEqual(["TWIS", "Arslan Ash"]);
    expect(splitPrefix("Knee")).toEqual(["", "Knee"]);
  });
  it("formats dates in the event's timezone", () => {
    expect(formatDate(1782604800, "Asia/Manila")).toBe("Jun 28, 2026");
    expect(formatDate(null)).toBe("");
  });
  it("maps country names and characters to the app's", () => {
    expect(["United States", "South Korea", "Korea, Republic of", "JP", "England", "Narnia"].map(countryCode)).toEqual([
      "us",
      "kr",
      "kr",
      "jp",
      "gb",
      "",
    ]);
    expect(["Jack 8", "devil jin", "Unknown Guy"].map(rosterName)).toEqual(["Jack-8", "Devil Jin", "Unknown Guy"]);
  });
  it("detects the placement scheme", () => {
    expect(detectScheme([1, 2, 3, 4, 5, 5, 7, 7])).toBe("DE");
    expect(detectScheme([1, 2, 3, 4, 5, 6, 7, 8])).toBe("SE");
    expect(detectScheme([1, 2, 3, 3, 5, 5, 7, 7])).toBe("custom");
  });
  it("applies an import: replaces event and players, keeps style", () => {
    const s = { ...defaultState(), themeId: "volt" };
    const next = applyImport(s, {
      source: "challonge",
      event: { name: "Weekly", game: "", date: "Nov 1, 2026", location: "", entrants: "12", url: "challonge.com/w", hashtag: "" },
      players: [1, 2, 3, 4, 5, 5].map((placement, i) => ({
        placement,
        prefix: "",
        tag: `P${i}`,
        country: "Japan",
        handle: "",
        characters: ["jack 8"],
      })),
      warnings: [],
    });
    expect(next.themeId).toBe("volt");
    expect(next.event).toMatchObject({ name: "Weekly", game: s.event.game, hashtag: "", scheme: "DE" });
    expect(next.entries).toHaveLength(8);
    expect(next.entries.map((e) => e.placement)).toEqual([1, 2, 3, 4, 5, 5, 7, 7]);
    expect(next.entries[0]).toMatchObject({ tag: "P0", country: "jp", characters: [{ name: "Jack-8" }] });
    expect(next.entries[7].tag).toBe("");
  });
});
