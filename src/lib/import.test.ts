import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GET,
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
    expect(parseBracketUrl("https://dlsl.challonge.com/weekly5")).toEqual({ source: "challonge", id: "weekly5", community: "dlsl" });
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
  const p = (name: string, final_rank: number | null) => ({ name, final_rank });
  it("maps final ranks and splits sponsor prefixes", () => {
    const r = mapChallonge(
      { name: "DLSL Weekly 5", url: "weekly5", game_name: "Tekken 8", starts_at: "2026-11-01T18:00:00.000+08:00", state: "complete" },
      [p("Nobi", 5), p("TWIS | Arslan Ash", 1), p("Rangchu", 2), p("Late", 9), p("A", 3), p("B", 4), p("C", 5), p("D", 7), p("E", 7)],
      { id: "weekly5", community: "dlsl" },
    );
    expect(r.players.map((x) => x.placement)).toEqual([1, 2, 3, 4, 5, 5, 7, 7]);
    expect(r.players[0]).toMatchObject({ prefix: "TWIS", tag: "Arslan Ash" });
    expect(r.event).toMatchObject({
      name: "DLSL Weekly 5",
      game: "Tekken 8",
      entrants: "9",
      url: "dlsl.challonge.com/weekly5",
      date: "Nov 1, 2026",
    });
    expect(mapChallonge({ name: "x", url: "abc" }, [p("A", 1)], { id: "abc" }).event.url).toBe("challonge.com/abc");
  });
  it("refuses unfinished brackets", () => {
    expect(() => mapChallonge({ name: "x", state: "underway" }, [p("A", null), p("B", null)], { id: "x" })).toThrow(/isn't finished/);
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

describe("Challonge requests (v2.1, client credentials)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("gets a token, sends v2 headers with community_id, reads every participant page", async () => {
    vi.stubEnv("CHALLONGE_CLIENT_ID", "cid");
    vi.stubEnv("CHALLONGE_CLIENT_SECRET", "secret");
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const people = Array.from({ length: 130 }, (_, i) => ({ id: String(i), attributes: { name: `P${i}`, final_rank: i < 8 ? [1, 2, 3, 4, 5, 5, 7, 7][i] : 9 } }));
    let tokenCalls = 0;
    vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
      if (url.endsWith("/oauth/token")) {
        tokenCalls++;
        return ok({ access_token: `tok${tokenCalls}`, expires_in: 604800 });
      }
      const auth = new Headers(init?.headers).get("Authorization");
      // First data request with the first token is rejected once, to exercise the refresh
      if (auth === "Bearer tok1") return new Response("{}", { status: 401 });
      if (url.includes("/participants.json")) {
        const page = Number(new URL(url).searchParams.get("page"));
        return ok({ data: people.slice((page - 1) * 100, page * 100) });
      }
      return ok({ data: { id: "777", type: "tournament", attributes: { name: "Weekly", url: "weekly5", game_name: "Tekken 8", state: "complete" } } });
    });

    const res = await GET(new Request("http://x/api/import?url=" + encodeURIComponent("https://dlsl.challonge.com/weekly5")));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.players).toHaveLength(8);
    expect(body.event).toMatchObject({ name: "Weekly", entrants: "130", url: "dlsl.challonge.com/weekly5" });

    const token = calls.find((c) => c.url.endsWith("/oauth/token"))!;
    expect(token.init?.method).toBe("POST");
    const form = new URLSearchParams(String(token.init?.body));
    expect(Object.fromEntries(form)).toMatchObject({ grant_type: "client_credentials", client_id: "cid", client_secret: "secret" });

    const data = calls.filter((c) => c.url.startsWith("https://api.challonge.com/v2.1/"));
    const headers = new Headers(data[data.length - 1].init?.headers);
    expect(headers.get("Authorization-Type")).toBe("v2");
    expect(headers.get("Authorization")).toBe("Bearer tok2");
    expect(headers.get("Content-Type")).toBe("application/vnd.api+json");
    expect(data.every((c) => new URL(c.url).searchParams.get("community_id") === "dlsl")).toBe(true);
    expect(data.some((c) => c.url.includes("/tournaments/weekly5.json"))).toBe(true);
    // 130 people at 100 per page: pages 1 and 2, by numeric tournament id
    expect(data.filter((c) => c.url.includes("/tournaments/777/participants.json")).map((c) => new URL(c.url).searchParams.get("page"))).toEqual(["1", "2"]);
  });

  it("falls back to a legacy API key with v1-style auth on v2.1", async () => {
    vi.stubEnv("CHALLONGE_API_KEY", "legacy");
    const seen: Headers[] = [];
    vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) => {
      seen.push(new Headers(init?.headers));
      const url = String(input);
      if (url.includes("/participants.json")) return new Response(JSON.stringify({ data: [{ id: "1", attributes: { name: "Solo", final_rank: 1 } }] }));
      return new Response(JSON.stringify({ data: { id: "5", attributes: { name: "T", url: "abc" } } }));
    });
    const res = await GET(new Request("http://x/api/import?url=challonge.com%2Fabc"));
    expect(res.status).toBe(200);
    expect(seen.every((h) => h.get("Authorization-Type") === "v1" && h.get("Authorization") === "legacy")).toBe(true);
  });

  it("explains private or missing brackets", async () => {
    vi.stubEnv("CHALLONGE_API_KEY", "legacy");
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 404 }));
    const res = await GET(new Request("http://x/api/import?url=challonge.com%2Fnope"));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/Couldn't find that bracket/);
  });
});
