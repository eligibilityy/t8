// Looks up a bracket's top 8 with the site's own keys, so people only have to paste a link.
// Vercel runs this file as it is, without bundling, so it can't import anything else from the project.

// Going through globalThis keeps this compiling whether or not Node's types are installed.
const env = (): Record<string, string | undefined> =>
  (globalThis as { process?: { env: Record<string, string | undefined> } })
    .process?.env ?? {};

export type ImportedPlayer = {
  placement: number;
  prefix: string;
  tag: string;
  country: string;
  handle: string;
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
  | { source: "challonge"; id: string; community?: string };

export class ImportError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}


export function parseBracketUrl(input: string): BracketRef | null {
  let url: URL;
  try {
    url = new URL(
      /^https?:\/\//i.test(input.trim())
        ? input.trim()
        : `https://${input.trim()}`,
    );
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);

  if (host === "start.gg" || host === "smash.gg") {
    const t = parts.indexOf("tournament");
    if (t < 0 || !parts[t + 1]) return null;
    const e = parts.indexOf("event", t);
    return {
      source: "startgg",
      tournament: parts[t + 1],
      event: e > 0 ? parts[e + 1] : undefined,
    };
  }

  if (host === "challonge.com" || host.endsWith(".challonge.com")) {
    // Covers challonge.com/abc, challonge.com/en/abc and community links like dlsl.challonge.com/abc.
    const rest =
      /^[a-z]{2}(-[a-z]{2})?$/i.test(parts[0] ?? "") && parts.length > 1
        ? parts.slice(1)
        : parts;
    const id = rest[0];
    if (!id || ["tournaments", "users", "communities", "settings"].includes(id))
      return null;
    const sub =
      host === "challonge.com" ? "" : host.slice(0, -".challonge.com".length);
    return sub
      ? { source: "challonge", id, community: sub }
      : { source: "challonge", id };
  }
  return null;
}


export function formatDate(
  seconds: number | null | undefined,
  timeZone?: string | null,
): string {
  if (!seconds) return "";
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  try {
    return new Intl.DateTimeFormat("en-US", {
      ...opts,
      timeZone: timeZone || "UTC",
    }).format(seconds * 1000);
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      ...opts,
      timeZone: "UTC",
    }).format(seconds * 1000);
  }
}

const tidyGame = (name: string) =>
  /tekken\s*8/i.test(name) ? "Tekken 8" : name;
const isTekken8 = (name: string) => /tekken\s*8/i.test(name);

// Some people type a full-width ｜ or the Korean ㅣ instead of a pipe.
export function splitPrefix(name: string): [string, string] {
  const m = name.match(/^(.{1,16}?)\s*[|｜ㅣ]\s*(.+)$/);
  return m ? [m[1].trim(), m[2].trim()] : ["", name.trim()];
}


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

// Twenty sets keeps the request under start.gg's limit of 1,000 objects.
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
  tournament: {
    name: string;
    city: string | null;
    addrState: string | null;
    countryCode: string | null;
    hashtag: string | null;
    timezone: string | null;
  } | null;
  standings: {
    nodes: Array<{ placement: number; entrant: GqlEntrant | null }> | null;
  } | null;
};
type GqlEntrant = {
  id: string;
  name: string;
  participants: Array<{
    gamerTag: string | null;
    prefix: string | null;
    user: {
      location: { country: string | null } | null;
      authorizations: Array<{ externalUsername: string | null }> | null;
    } | null;
  }> | null;
};
type GqlSets = {
  sets: {
    nodes: Array<{
      games: Array<{
        selections: Array<{
          entrant: { id: string } | null;
          character: { name: string } | null;
        }> | null;
      }> | null;
    }> | null;
  } | null;
};

async function gql<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(STARTGG, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await res.json().catch(() => null)) as {
    data?: T;
    errors?: Array<{ message: string }>;
    message?: string;
  } | null;
  if (res.status === 429 || /rate limit/i.test(body?.message ?? ""))
    throw new ImportError(
      "start.gg is busy right now. Try again in a minute.",
      429,
    );
  if (!res.ok || !body?.data) {
    const why =
      body?.errors?.[0]?.message ?? body?.message ?? `HTTP ${res.status}`;
    throw new ImportError(`start.gg didn't answer as expected (${why}).`, 502);
  }
  return body.data;
}

// For a tournament link with no event in it, go with its biggest Tekken 8 event.
export function pickEvent(
  events: Array<{
    slug: string;
    numEntrants: number | null;
    videogame: { displayName: string } | null;
  }>,
): string | null {
  const tekken = events.filter((e) =>
    isTekken8(e.videogame?.displayName ?? ""),
  );
  const pool = tekken.length ? tekken : events.length === 1 ? events : [];
  return (
    pool.sort((a, b) => (b.numEntrants ?? 0) - (a.numEntrants ?? 0))[0]?.slug ??
    null
  );
}

export function charactersByEntrant(
  sets: GqlSets | null,
): Map<string, string[]> {
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
      [...m]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name),
    );
  return out;
}

export function mapStartgg(
  event: GqlEvent,
  picks: Map<string, string[]>,
): ImportedResults {
  const t = event.tournament;
  const game = event.videogame?.displayName ?? "";
  const warnings: string[] = [];
  const nodes = (event.standings?.nodes ?? [])
    .filter((n) => n.entrant)
    .sort((a, b) => a.placement - b.placement);
  if (!nodes.length)
    throw new ImportError(
      "This event has no standings yet. Import it once the top 8 is decided.",
      404,
    );

  const players = nodes
    .slice(0, 8)
    .map(({ placement, entrant }): ImportedPlayer => {
      const p = entrant!.participants?.[0];
      const [prefix, tag] = p?.gamerTag
        ? [p.prefix ?? "", p.gamerTag]
        : splitPrefix(entrant!.name);
      return {
        placement,
        prefix: prefix.trim(),
        tag: tag.trim(),
        country: p?.user?.location?.country ?? "",
        handle: (p?.user?.authorizations?.[0]?.externalUsername ?? "").replace(
          /^@/,
          "",
        ),
        characters: picks.get(String(entrant!.id)) ?? [],
      };
    });

  if (game && !isTekken8(game))
    warnings.push(`This event is ${game}. Character art only covers Tekken 8.`);
  if (!players.some((p) => p.characters.length))
    warnings.push(
      "start.gg has no character picks for these sets, so add characters yourself.",
    );
  else if (players.some((p) => !p.characters.length))
    warnings.push("Some players have no reported characters.");
  if (players.length < 8)
    warnings.push(`Only ${players.length} placements so far.`);

  const location = event.isOnline
    ? "Online"
    : [t?.city, t?.countryCode === "US" ? t?.addrState : t?.countryCode]
        .filter(Boolean)
        .join(", ");
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

async function importStartgg(
  ref: Extract<BracketRef, { source: "startgg" }>,
  token: string,
): Promise<ImportedResults> {
  let slug = ref.event
    ? `tournament/${ref.tournament}/event/${ref.event}`
    : null;
  if (!slug) {
    const data = await gql<{
      tournament: { events: Parameters<typeof pickEvent>[0] } | null;
    }>(token, EVENTS_QUERY, {
      slug: ref.tournament,
    });
    if (!data.tournament)
      throw new ImportError("Couldn't find that tournament on start.gg.", 404);
    slug = pickEvent(data.tournament.events ?? []);
    if (!slug)
      throw new ImportError(
        "That tournament has several events. Open the Tekken 8 event and paste its link.",
        400,
      );
  }
  const { event } = await gql<{ event: GqlEvent | null }>(token, EVENT_QUERY, {
    slug,
  });
  if (!event)
    throw new ImportError(
      "Couldn't find that event on start.gg. Check the link.",
      404,
    );
  const ids = (event.standings?.nodes ?? [])
    .map((n) => n.entrant?.id)
    .filter(Boolean);
  // Characters are a nice extra, so if this request fails we still import everything else.
  let picks = new Map<string, string[]>();
  if (ids.length)
    try {
      picks = charactersByEntrant(
        (
          await gql<{ event: GqlSets | null }>(token, SETS_QUERY, {
            id: event.id,
            entrants: ids,
          })
        ).event,
      );
    } catch {}
  return mapStartgg(event, picks);
}

// Challonge's newer v2.1 API only shows brackets that belong to our own account, so other organisers'
// public brackets come from the old v1 API with the account key. v2.1, with the app's client ID and
// secret, is just a fallback for brackets on our own account.

const CHALLONGE_V1 = "https://api.challonge.com/v1";
const CHALLONGE_V21 = "https://api.challonge.com/v2.1";
const CHALLONGE_TOKEN = "https://api.challonge.com/oauth/token";
const PER_PAGE = 100;
const MAX_PAGES = 20;
const NOT_FOUND =
  "Couldn't find that bracket on Challonge. Check the link, and that the bracket is public.";

type ChallongeTournament = {
  name?: string | null;
  url?: string | null;
  game_name?: string | null;
  starts_at?: string | null;
  state?: string | null;
};
type ChallongeParticipant = {
  name?: string | null;
  username?: string | null;
  final_rank?: number | null;
};
type JsonApi<T> = {
  data?:
    | { id: string; attributes?: T }
    | Array<{ id: string; attributes?: T }>
    | null;
};
type ChallongeRef = Extract<BracketRef, { source: "challonge" }>;

export type ChallongeAuth = {
  key?: string;
  app?: { clientId: string; clientSecret: string };
};

export function mapChallonge(
  t: ChallongeTournament,
  participants: ChallongeParticipant[],
  link: { id: string; community?: string },
): ImportedResults {
  const ranked = participants
    .filter(
      (p): p is ChallongeParticipant & { final_rank: number } =>
        typeof p.final_rank === "number" && p.final_rank > 0,
    )
    .sort((a, b) => a.final_rank - b.final_rank);
  if (!ranked.length)
    throw new ImportError(
      "This Challonge bracket isn't finished yet, so it has no final placements. Import it once it's complete.",
      409,
    );

  const players = ranked
    .filter((p) => p.final_rank <= 8)
    .slice(0, 8)
    .map((p): ImportedPlayer => {
      const [prefix, tag] = splitPrefix(p.name || p.username || "");
      return {
        placement: p.final_rank,
        prefix,
        tag,
        country: "",
        handle: "",
        characters: [],
      };
    });
  const warnings = [
    "Challonge doesn't record characters or countries, you'll have to add those manually.",
  ];
  if (t.game_name && !isTekken8(t.game_name))
    warnings.unshift(
      `This bracket is ${t.game_name}. Character art only covers Tekken 8.`,
    );
  const slug = t.url || link.id;
  return {
    source: "challonge",
    event: {
      name: t.name ?? "",
      game: tidyGame(t.game_name ?? ""),
      date: localDate(t.starts_at),
      location: "",
      entrants: participants.length ? String(participants.length) : "",
      url: link.community
        ? `${link.community}.challonge.com/${slug}`
        : `challonge.com/${slug}`,
      hashtag: "",
    },
    players,
    warnings,
  };
}

// Challonge timestamps carry the event's own time offset, so take the date as written.
export function localDate(iso: string | null | undefined): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? formatDate(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 1000, "UTC") : "";
}


type V1Tournament = {
  name?: string;
  url?: string;
  game_name?: string | null;
  started_at?: string | null;
  start_at?: string | null;
  state?: string;
  participants?: Array<{
    participant: {
      name?: string | null;
      display_name?: string | null;
      challonge_username?: string | null;
      final_rank?: number | null;
    };
  }>;
};

export function fromV1(
  t: V1Tournament,
): [ChallongeTournament, ChallongeParticipant[]] {
  return [
    {
      name: t.name,
      url: t.url,
      game_name: t.game_name,
      starts_at: t.started_at ?? t.start_at,
      state: t.state,
    },
    (t.participants ?? []).map(({ participant: p }) => ({
      name: p.display_name || p.name,
      username: p.challonge_username,
      final_rank: p.final_rank,
    })),
  ];
}

async function challongeV1(
  ref: ChallongeRef,
  key: string,
): Promise<ImportedResults | "not-found" | "refused" | null> {
  // v1 wants community brackets written as community-url.
  const id = ref.community ? `${ref.community}-${ref.id}` : ref.id;
  const res = await fetch(
    `${CHALLONGE_V1}/tournaments/${encodeURIComponent(id)}.json?include_participants=1&api_key=${encodeURIComponent(key)}`,
    {
      headers: { Accept: "application/json" },
    },
  );
  if (res.status === 404) return "not-found";
  if (res.status === 401 || res.status === 403) return "refused";
  if (res.status === 429)
    throw new ImportError(
      "Challonge is limiting imports right now. Try again later.",
      429,
    );
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as {
    tournament?: V1Tournament;
  } | null;
  if (!body?.tournament) return null;
  return mapChallonge(...fromV1(body.tournament), ref);
}


// Tokens last a week, so hang on to one while this function instance stays warm.
let cachedToken: { value: string; until: number } | null = null;

async function challongeToken(
  app: NonNullable<ChallongeAuth["app"]>,
  fresh = false,
): Promise<string> {
  if (!fresh && cachedToken && cachedToken.until > Date.now())
    return cachedToken.value;
  const res = await fetch(CHALLONGE_TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: app.clientId,
      client_secret: app.clientSecret,
      scope: "me tournaments:read participants:read",
    }),
  });
  const body = (await res.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
  } | null;
  if (!res.ok || !body?.access_token)
    throw new ImportError(
      "Challonge didn't accept the site's app credentials.",
      502,
    );
  cachedToken = {
    value: body.access_token,
    until: Date.now() + Math.max(60, (body.expires_in ?? 3600) - 300) * 1000,
  };
  return body.access_token;
}

async function v21Get<T>(
  path: string,
  app: NonNullable<ChallongeAuth["app"]>,
  community?: string,
): Promise<JsonApi<T>> {
  const url = new URL(`${CHALLONGE_V21}${path}`);
  if (community) url.searchParams.set("community_id", community);
  const send = async (fresh: boolean) =>
    fetch(url, {
      headers: {
        "Content-Type": "application/vnd.api+json",
        Accept: "application/json",
        "Authorization-Type": "v2",
        Authorization: `Bearer ${await challongeToken(app, fresh)}`,
      },
    });
  let res = await send(false);
  // A cached token might have been revoked early, so try once more with a fresh one.
  if (res.status === 401) res = await send(true);
  // v2.1 says 404 for other people's brackets and 403 for other people's communities.
  if (res.status === 404 || res.status === 403)
    throw new ImportError(NOT_FOUND, 404);
  if (res.status === 401)
    throw new ImportError(
      "Challonge didn't accept the site's app credentials.",
      502,
    );
  if (res.status === 429)
    throw new ImportError(
      "Challonge is limiting imports right now. Try again later.",
      429,
    );
  if (!res.ok)
    throw new ImportError(
      `Challonge didn't answer as expected (HTTP ${res.status}).`,
      502,
    );
  return (await res.json()) as JsonApi<T>;
}

async function challongeV21(
  ref: ChallongeRef,
  app: NonNullable<ChallongeAuth["app"]>,
): Promise<ImportedResults> {
  const tournament = await v21Get<ChallongeTournament>(
    `/tournaments/${encodeURIComponent(ref.id)}.json`,
    app,
    ref.community,
  );
  const t = Array.isArray(tournament.data)
    ? tournament.data[0]
    : tournament.data;
  if (!t)
    throw new ImportError("Challonge sent back something unexpected.", 502);
  // Final ranks aren't in seed order, so read every page.
  const participants: ChallongeParticipant[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await v21Get<ChallongeParticipant>(
      `/tournaments/${encodeURIComponent(t.id)}/participants.json?page=${page}&per_page=${PER_PAGE}`,
      app,
      ref.community,
    );
    const rows = Array.isArray(res.data) ? res.data : [];
    participants.push(...rows.map((r) => r.attributes ?? {}));
    if (rows.length < PER_PAGE) break;
  }
  return mapChallonge(t.attributes ?? {}, participants, ref);
}

async function importChallonge(
  ref: ChallongeRef,
  auth: ChallongeAuth,
): Promise<ImportedResults> {
  const v1 = auth.key ? await challongeV1(ref, auth.key) : null;
  if (v1 && typeof v1 === "object") return v1;
  if (auth.app) return challongeV21(ref, auth.app);
  if (v1 === "refused")
    throw new ImportError("Challonge didn't accept the site's API key.", 502);
  if (v1 === "not-found") throw new ImportError(NOT_FOUND, 404);
  throw new ImportError(
    "Challonge didn't answer as expected. Try again in a moment.",
    502,
  );
}

function challongeAuth(): ChallongeAuth | null {
  const e = env();
  const auth: ChallongeAuth = {
    key: e.CHALLONGE_API_KEY || undefined,
    app:
      e.CHALLONGE_CLIENT_ID && e.CHALLONGE_CLIENT_SECRET
        ? {
            clientId: e.CHALLONGE_CLIENT_ID,
            clientSecret: e.CHALLONGE_CLIENT_SECRET,
          }
        : undefined,
  };
  return auth.key || auth.app ? auth : null;
}


const json = (data: unknown, status = 200, cache = false) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // If the same link comes in again within a minute, Vercel answers from its cache.
      "Cache-Control": cache
        ? "public, s-maxage=60, stale-while-revalidate=300"
        : "no-store",
    },
  });

export async function GET(request: Request): Promise<Response> {
  const link = new URL(request.url).searchParams.get("url") ?? "";
  const ref = parseBracketUrl(link);
  if (!ref)
    return json(
      { error: "Paste a start.gg or Challonge link to a bracket." },
      400,
    );
  try {
    if (ref.source === "startgg") {
      const token = env().STARTGG_TOKEN;
      if (!token)
        return json(
          { error: "start.gg imports aren't set up on this site yet." },
          503,
        );
      return json(await importStartgg(ref, token), 200, true);
    }
    const auth = challongeAuth();
    if (!auth)
      return json(
        { error: "Challonge imports aren't set up on this site yet." },
        503,
      );
    return json(await importChallonge(ref, auth), 200, true);
  } catch (e) {
    if (e instanceof ImportError) return json({ error: e.message }, e.status);
    return json(
      { error: "Couldn't reach the bracket site. Try again in a moment." },
      502,
    );
  }
}
