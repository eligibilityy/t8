// GET /api/import?url=<start.gg or Challonge link>
//
// Looks up a bracket's final top 8 with the site's own API keys (Vercel env vars STARTGG_TOKEN
// and CHALLONGE_API_KEY), so visitors only paste a link. Self-contained on purpose: Vercel runs
// this file as an ES module without bundling, so it imports nothing local. Names, countries and
// characters come back as the bracket site has them; the app maps them to its roster and flags.

// Read through globalThis so this compiles with or without Node's type definitions
const env = (): Record<string, string | undefined> =>
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

export type ImportedPlayer = {
  placement: number;
  prefix: string;
  tag: string;
  /** Country name or ISO code, as the site gives it */
  country: string;
  handle: string;
  /** Most played first */
  characters: string[];
};

export type ImportedResults = {
  source: "startgg" | "challonge";
  event: {
    name: string;
    game: string;
    date: string;
    location: string;
    entrants: string;
    url: string;
    hashtag: string;
  };
  players: ImportedPlayer[];
  warnings: string[];
};

export type BracketRef =
  | { source: "startgg"; tournament: string; event?: string }
  | { source: "challonge"; id: string };

/** Something the visitor can act on; shown as is */
export class ImportError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// ───────────────────────── Links ─────────────────────────

export function parseBracketUrl(input: string): BracketRef | null {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);

  if (host === "start.gg" || host === "smash.gg") {
    const t = parts.indexOf("tournament");
    if (t < 0 || !parts[t + 1]) return null;
    const e = parts.indexOf("event", t);
    return { source: "startgg", tournament: parts[t + 1], event: e > 0 ? parts[e + 1] : undefined };
  }

  if (host === "challonge.com" || host.endsWith(".challonge.com")) {
    // challonge.com/<id>, challonge.com/<lang>/<id>, <org>.challonge.com/<id> (API id "<org>-<id>")
    const rest = /^[a-z]{2}(-[a-z]{2})?$/i.test(parts[0] ?? "") && parts.length > 1 ? parts.slice(1) : parts;
    const id = rest[0];
    if (!id || ["tournaments", "users", "communities", "settings"].includes(id)) return null;
    const sub = host === "challonge.com" ? "" : host.slice(0, -".challonge.com".length);
    return { source: "challonge", id: sub ? `${sub}-${id}` : id };
  }
  return null;
}

// ───────────────────────── Shared helpers ─────────────────────────

/** Unix seconds → "Jun 28, 2026" in the event's own timezone */
export function formatDate(seconds: number | null | undefined, timeZone?: string | null): string {
  if (!seconds) return "";
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  try {
    return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: timeZone || "UTC" }).format(seconds * 1000);
  } catch {
    return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(seconds * 1000);
  }
}

const tidyGame = (name: string) => (/tekken\s*8/i.test(name) ? "Tekken 8" : name);
const isTekken8 = (name: string) => /tekken\s*8/i.test(name);

/** "TWIS | Arslan Ash" → ["TWIS", "Arslan Ash"] */
export function splitPrefix(name: string): [string, string] {
  const m = name.match(/^(.{1,16}?)\s*\|\s*(.+)$/);
  return m ? [m[1].trim(), m[2].trim()] : ["", name.trim()];
}

// ───────────────────────── start.gg ─────────────────────────

const STARTGG = "https://api.start.gg/gql/alpha";

const EVENTS_QUERY = `query Events($slug: String) {
  tournament(slug: $slug) { name events { slug name numEntrants videogame { displayName } } }
}`;

const EVENT_QUERY = `query Top8($slug: String) {
  event(slug: $slug) {
    id name slug numEntrants startAt isOnline
    videogame { displayName }
    tournament { name city addrState countryCode hashtag timezone }
    standings(query: { page: 1, perPage: 8 }) {
      nodes {
        placement
        entrant {
          id name
          participants {
            gamerTag prefix
            user { location { country } authorizations(types: [TWITTER]) { externalUsername } }
          }
        }
      }
    }
  }
}`;

// 20 sets × up to 5 games × 2 picks stays under start.gg's 1,000-objects-per-request limit
const SETS_QUERY = `query Picks($id: ID, $entrants: [ID]) {
  event(id: $id) {
    sets(page: 1, perPage: 20, sortType: RECENT, filters: { entrantIds: $entrants, hideEmpty: true }) {
      nodes { games { selections { entrant { id } character { name } } } }
    }
  }
}`;

type GqlEvent = {
  id: string;
  name: string;
  slug: string;
  numEntrants: number | null;
  startAt: number | null;
  isOnline: boolean | null;
  videogame: { displayName: string } | null;
  tournament: { name: string; city: string | null; addrState: string | null; countryCode: string | null; hashtag: string | null; timezone: string | null } | null;
  standings: { nodes: Array<{ placement: number; entrant: GqlEntrant | null }> | null } | null;
};
type GqlEntrant = {
  id: string;
  name: string;
  participants: Array<{
    gamerTag: string | null;
    prefix: string | null;
    user: { location: { country: string | null } | null; authorizations: Array<{ externalUsername: string | null }> | null } | null;
  }> | null;
};
type GqlSets = { sets: { nodes: Array<{ games: Array<{ selections: Array<{ entrant: { id: string } | null; character: { name: string } | null }> | null }> | null }> | null } | null };

async function gql<T>(token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(STARTGG, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await res.json().catch(() => null)) as { data?: T; errors?: Array<{ message: string }>; message?: string } | null;
  if (res.status === 429 || /rate limit/i.test(body?.message ?? "")) throw new ImportError("start.gg is busy right now. Try again in a minute.", 429);
  if (!res.ok || !body?.data) {
    const why = body?.errors?.[0]?.message ?? body?.message ?? `HTTP ${res.status}`;
    throw new ImportError(`start.gg didn't answer as expected (${why}).`, 502);
  }
  return body.data;
}

/** A tournament link without an event: pick its Tekken 8 event (the biggest one) */
export function pickEvent(events: Array<{ slug: string; numEntrants: number | null; videogame: { displayName: string } | null }>): string | null {
  const tekken = events.filter((e) => isTekken8(e.videogame?.displayName ?? ""));
  const pool = tekken.length ? tekken : events.length === 1 ? events : [];
  return pool.sort((a, b) => (b.numEntrants ?? 0) - (a.numEntrants ?? 0))[0]?.slug ?? null;
}

/** Who played what, from game-by-game picks: most played first, up to three */
export function charactersByEntrant(sets: GqlSets | null): Map<string, string[]> {
  const counts = new Map<string, Map<string, number>>();
  for (const set of sets?.sets?.nodes ?? [])
    for (const game of set.games ?? [])
      for (const pick of game.selections ?? []) {
        const id = pick.entrant?.id;
        const name = pick.character?.name;
        if (!id || !name) continue;
        const m = counts.get(String(id)) ?? new Map<string, number>();
        m.set(name, (m.get(name) ?? 0) + 1);
        counts.set(String(id), m);
      }
  const out = new Map<string, string[]>();
  for (const [id, m] of counts)
    out.set(
      id,
      [...m].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name),
    );
  return out;
}

export function mapStartgg(event: GqlEvent, picks: Map<string, string[]>): ImportedResults {
  const t = event.tournament;
  const game = event.videogame?.displayName ?? "";
  const warnings: string[] = [];
  const nodes = (event.standings?.nodes ?? []).filter((n) => n.entrant).sort((a, b) => a.placement - b.placement);
  if (!nodes.length) throw new ImportError("This event has no standings yet. Import it once the top 8 is decided.", 404);

  const players = nodes.slice(0, 8).map(({ placement, entrant }): ImportedPlayer => {
    const p = entrant!.participants?.[0];
    const [prefix, tag] = p?.gamerTag ? [p.prefix ?? "", p.gamerTag] : splitPrefix(entrant!.name);
    return {
      placement,
      prefix: prefix.trim(),
      tag: tag.trim(),
      country: p?.user?.location?.country ?? "",
      handle: (p?.user?.authorizations?.[0]?.externalUsername ?? "").replace(/^@/, ""),
      characters: picks.get(String(entrant!.id)) ?? [],
    };
  });

  if (game && !isTekken8(game)) warnings.push(`This event is ${game}. Character art only covers Tekken 8.`);
  if (!players.some((p) => p.characters.length))
    warnings.push("start.gg has no character picks for these sets, so add characters yourself.");
  else if (players.some((p) => !p.characters.length)) warnings.push("Some players have no reported characters.");
  if (players.length < 8) warnings.push(`Only ${players.length} placements so far.`);

  const location = event.isOnline
    ? "Online"
    : [t?.city, t?.countryCode === "US" ? t?.addrState : t?.countryCode].filter(Boolean).join(", ");
  return {
    source: "startgg",
    event: {
      name: t?.name ?? event.name,
      game: tidyGame(game),
      date: formatDate(event.startAt, t?.timezone),
      location,
      entrants: event.numEntrants ? String(event.numEntrants) : "",
      url: `start.gg/${event.slug}`,
      hashtag: t?.hashtag ? `#${t.hashtag.replace(/^#/, "")}` : "",
    },
    players,
    warnings,
  };
}

async function importStartgg(ref: Extract<BracketRef, { source: "startgg" }>, token: string): Promise<ImportedResults> {
  let slug = ref.event ? `tournament/${ref.tournament}/event/${ref.event}` : null;
  if (!slug) {
    const data = await gql<{ tournament: { events: Parameters<typeof pickEvent>[0] } | null }>(token, EVENTS_QUERY, {
      slug: ref.tournament,
    });
    if (!data.tournament) throw new ImportError("Couldn't find that tournament on start.gg.", 404);
    slug = pickEvent(data.tournament.events ?? []);
    if (!slug) throw new ImportError("That tournament has several events. Open the Tekken 8 event and paste its link.", 400);
  }
  const { event } = await gql<{ event: GqlEvent | null }>(token, EVENT_QUERY, { slug });
  if (!event) throw new ImportError("Couldn't find that event on start.gg. Check the link.", 404);
  const ids = (event.standings?.nodes ?? []).map((n) => n.entrant?.id).filter(Boolean);
  // Characters are a bonus: if this part fails, import without them
  let picks = new Map<string, string[]>();
  if (ids.length)
    try {
      picks = charactersByEntrant((await gql<{ event: GqlSets | null }>(token, SETS_QUERY, { id: event.id, entrants: ids })).event);
    } catch {
      /* keep going */
    }
  return mapStartgg(event, picks);
}

// ───────────────────────── Challonge ─────────────────────────

type ChallongeParticipant = { name?: string | null; display_name?: string | null; final_rank?: number | null; challonge_username?: string | null };
type ChallongeTournament = {
  name?: string;
  game_name?: string | null;
  started_at?: string | null;
  start_at?: string | null;
  participants_count?: number | null;
  full_challonge_url?: string | null;
  state?: string;
  participants?: Array<{ participant: ChallongeParticipant }>;
};

export function mapChallonge(t: ChallongeTournament): ImportedResults {
  const ranked = (t.participants ?? [])
    .map((p) => p.participant)
    .filter((p): p is ChallongeParticipant & { final_rank: number } => typeof p.final_rank === "number" && p.final_rank > 0)
    .sort((a, b) => a.final_rank - b.final_rank);
  if (!ranked.length)
    throw new ImportError("This Challonge bracket isn't finished yet, so it has no final placements. Import it once it's complete.", 409);

  const players = ranked
    .filter((p) => p.final_rank <= 8)
    .slice(0, 8)
    .map((p): ImportedPlayer => {
      const [prefix, tag] = splitPrefix(p.display_name || p.name || "");
      return { placement: p.final_rank, prefix, tag, country: "", handle: "", characters: [] };
    });
  const warnings = ["Challonge doesn't record characters or countries, so add those yourself."];
  if (t.game_name && !isTekken8(t.game_name)) warnings.unshift(`This bracket is ${t.game_name}. Character art only covers Tekken 8.`);
  const when = t.started_at ?? t.start_at;
  return {
    source: "challonge",
    event: {
      name: t.name ?? "",
      game: tidyGame(t.game_name ?? ""),
      date: when ? formatDate(Date.parse(when) / 1000) : "",
      location: "",
      entrants: t.participants_count ? String(t.participants_count) : "",
      url: (t.full_challonge_url ?? "").replace(/^https?:\/\//, ""),
      hashtag: "",
    },
    players,
    warnings,
  };
}

async function importChallonge(ref: Extract<BracketRef, { source: "challonge" }>, key: string): Promise<ImportedResults> {
  const url = `https://api.challonge.com/v1/tournaments/${encodeURIComponent(ref.id)}.json?include_participants=1&api_key=${encodeURIComponent(key)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (res.status === 404) throw new ImportError("Couldn't find that bracket on Challonge. Check the link.", 404);
  if (res.status === 401) throw new ImportError("Challonge didn't accept the site's API key.", 502);
  if (res.status === 429) throw new ImportError("Challonge is limiting imports right now. Try again later.", 429);
  if (!res.ok) throw new ImportError(`Challonge didn't answer as expected (HTTP ${res.status}).`, 502);
  const body = (await res.json()) as { tournament?: ChallongeTournament };
  if (!body.tournament) throw new ImportError("Challonge sent back something unexpected.", 502);
  return mapChallonge(body.tournament);
}

// ───────────────────────── Handler ─────────────────────────

const json = (data: unknown, status = 200, cache = false) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Same link within a minute: answer from Vercel's cache instead of the bracket site
      "Cache-Control": cache ? "public, s-maxage=60, stale-while-revalidate=300" : "no-store",
    },
  });

export async function GET(request: Request): Promise<Response> {
  const link = new URL(request.url).searchParams.get("url") ?? "";
  const ref = parseBracketUrl(link);
  if (!ref) return json({ error: "Paste a start.gg or Challonge link to a bracket." }, 400);
  try {
    if (ref.source === "startgg") {
      const token = env().STARTGG_TOKEN;
      if (!token) return json({ error: "start.gg imports aren't set up on this site yet." }, 503);
      return json(await importStartgg(ref, token), 200, true);
    }
    const key = env().CHALLONGE_API_KEY;
    if (!key) return json({ error: "Challonge imports aren't set up on this site yet." }, 503);
    return json(await importChallonge(ref, key), 200, true);
  } catch (e) {
    if (e instanceof ImportError) return json({ error: e.message }, e.status);
    return json({ error: "Couldn't reach the bracket site. Try again in a moment." }, 502);
  }
}
