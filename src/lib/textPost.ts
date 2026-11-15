import type { Entry, EventInfo } from "../types";

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const KEYCAPS = ["0️⃣", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];

export function flagEmoji(iso2: string): string {
  const c = iso2.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "";
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

function placementMark(n: number): string {
  if (MEDALS[n]) return MEDALS[n];
  if (n < 10) return KEYCAPS[n];
  return `${n}.`;
}

export type TextPostOptions = { handles: boolean; characters: boolean; flags: boolean };

export function buildTextPost(event: EventInfo, entries: Entry[], opts: TextPostOptions): string {
  const lines: string[] = [];
  const title = [event.name, event.game].filter(Boolean).join(" · ");
  lines.push(`🏆 ${title}${event.subtitle ? ` ${event.subtitle}` : ""}`.trim());
  lines.push("");

  for (const e of entries) {
    if (!e.tag.trim()) continue;
    const parts: string[] = [placementMark(e.placement)];
    if (opts.flags && e.country) {
      const f = flagEmoji(e.country);
      if (f) parts.push(f);
    }
    let name = e.sponsor.trim() ? `${e.sponsor.trim()} | ${e.tag.trim()}` : e.tag.trim();
    if (opts.handles && e.handle.trim()) name += ` (@${e.handle.trim().replace(/^@/, "")})`;
    parts.push(name);
    const chars = e.characters.map((c) => c.name).filter(Boolean);
    if (opts.characters && chars.length) parts.push(`– ${chars.join(" / ")}`);
    lines.push(parts.join(" "));
  }

  const meta = [
    event.entrants && `${event.entrants} entrants`,
    event.date,
    event.location,
  ].filter(Boolean);
  if (meta.length) {
    lines.push("");
    lines.push(meta.join(" · "));
  }
  if (event.url) lines.push(event.url);
  if (event.hashtag) lines.push(event.hashtag.startsWith("#") ? event.hashtag : `#${event.hashtag}`);
  return lines.join("\n");
}
