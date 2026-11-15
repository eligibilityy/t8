import type { CSSProperties } from "react";
import type { ArtLibrary, BackgroundImage, BackgroundStyle, Entry, EventInfo, Format, Theme } from "../types";
import { ordinalParts } from "../lib/placements";
import { CharArt, Disclaimer, FitText, Flag } from "./shared";

export type LayoutProps = {
  event: EventInfo;
  entries: Entry[];
  art: ArtLibrary;
  theme: Theme;
  format: Format;
  background?: { image: BackgroundImage | null; style: BackgroundStyle };
};

/** Per-format sizes in canvas px */
function metrics(format: Format) {
  const portrait = format.height > format.width;
  return portrait
    ? { pad: 56, headerH: 214, footerH: 64, gap: 10, blade: 150, flag: 44, strip: 420, slice: 140, tag: 58, tag1: 78, slant: 22 }
    : { pad: 56, headerH: 130, footerH: 64, gap: 10, blade: 210, flag: 48, strip: 800, slice: 250, tag: 62, tag1: 84, slant: 26 };
}

export function themeVars(theme: Theme): CSSProperties {
  return {
    "--bg": theme.bg,
    "--bg2": theme.bg2,
    "--surface": theme.surface,
    "--edge": theme.surfaceEdge,
    "--accent": theme.accent,
    "--accent-ink": theme.accentInk,
    "--accent2": theme.accent2,
    "--text": theme.text,
    "--dim": theme.textDim,
    "--display": theme.fontDisplay,
    "--body": theme.fontBody,
    "--mono": theme.fontMono,
  } as CSSProperties;
}

export function BladeStandings(p: LayoutProps) {
  const m = metrics(p.format);
  const portrait = p.format.height > p.format.width;
  const rows = p.entries.slice(0, 8);
  const usesArt = rows.some((r) => r.characters.some((c) => p.art[c.name]));

  const meta = [p.event.date, p.event.location, p.event.entrants && `${p.event.entrants} entrants`].filter(Boolean);

  return (
    <div
      className="canvas blade"
      style={{ ...themeVars(p.theme), width: p.format.width, height: p.format.height }}
    >
      {p.background?.image && <BackgroundPhoto image={p.background.image} style={p.background.style} />}
      <div className="bg-texture" />
      <div className="corner tl" />
      <div className="corner br" />

      <header
        className={`blade-header ${portrait ? "portrait" : ""}`}
        style={{ left: m.pad, right: m.pad, top: 40, height: m.headerH - 40 }}
      >
        <div className="blade-title-tab">
          <FitText max={portrait ? 92 : 84} style={{ fontFamily: "var(--display)" }}>
            {p.event.name || "EVENT NAME"}
          </FitText>
        </div>
        <div className="blade-header-meta">
          <div className="blade-game">
            {p.event.game}
            {p.event.subtitle && <span className="accent"> · {p.event.subtitle}</span>}
          </div>
          {meta.length > 0 && <div className="mono dim">{meta.join("  ·  ")}</div>}
        </div>
      </header>

      <div
        className="blade-rows"
        style={{
          left: m.pad,
          right: m.pad,
          top: m.headerH + 24,
          bottom: m.footerH + 44,
          gap: m.gap,
        }}
      >
        {rows.map((e, i) => {
          const first = i === 0;
          const [num, suf] = ordinalParts(e.placement);
          const podium = e.placement <= 3;
          const chars = e.characters.filter((c) => c.name);
          return (
            <div
              key={e.id}
              className={`blade-row ${podium ? "podium" : ""} ${first ? "first" : ""}`}
              style={{ flex: first ? 1.35 : 1, ["--slant" as string]: `${m.slant}px` }}
            >
              <div className="blade-place" style={{ width: m.blade }}>
                <span className="blade-num" style={{ fontSize: first ? 96 : 72 }}>
                  {num}
                </span>
                <span className="blade-suf" style={{ fontSize: first ? 36 : 28 }}>
                  {suf}
                </span>
              </div>

              <div className="blade-flag" style={{ width: m.flag + 36 }}>
                <Flag code={e.country} size={first ? m.flag * 0.75 : m.flag * 0.62} />
              </div>

              <div className="blade-name">
                <div className="blade-name-line">
                  <FitText max={first ? m.tag1 : m.tag} style={{ fontFamily: "var(--display)" }}>
                    {e.sponsor && <span className="blade-sponsor">{e.sponsor}&nbsp;</span>}
                    <span>{e.tag || "—"}</span>
                  </FitText>
                </div>
                {e.handle && (
                  <div className="blade-handle mono">@{e.handle.replace(/^@/, "")}</div>
                )}
              </div>

              {chars.length > 0 && (
                <div className="blade-strip" style={{ maxWidth: m.strip, ["--slice" as string]: `${m.slice}px` }}>
                  {chars.map((c, ci) => (
                    <div key={ci} className="blade-slice">
                      <CharArt name={c.name} art={p.art[c.name]} fill={0.5} anchorY={47} style={{ position: "absolute", inset: 0 }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="blade-disclaimer" style={{ right: m.pad, bottom: m.footerH + 14 }}>
        <Disclaimer usesGameArt={usesArt} gameName={p.event.game} />
      </div>

      <Footer event={p.event} height={m.footerH} />
    </div>
  );
}

const SITE_URL = "t8.yiliya.studio";

/** Hashtag · URL · subtitle. Without a hashtag the URL moves to the left; a blank URL shows the site's address. */
function Footer({ event, height }: { event: EventInfo; height: number }) {
  const raw = event.hashtag.trim();
  const hashtag = raw && (raw.startsWith("#") ? raw : `#${raw}`);
  const url = event.url.trim() || SITE_URL;

  // Each item is its own grid cell so the URL isn't baseline-locked to the Bebas text
  return (
    <footer className="blade-footer" style={{ height }}>
      {hashtag && <span className="left">{hashtag}</span>}
      <span className={`mono ${hashtag ? "center" : "left"}`}>{url}</span>
      <span className="right">{event.subtitle.trim() || "RESULTS"}</span>
    </footer>
  );
}

function BackgroundPhoto({ image, style }: { image: BackgroundImage; style: BackgroundStyle }) {
  const blur = Math.max(0, style.blur);
  return (
    <div className="bg-photo">
      <img
        src={image.src}
        alt=""
        style={{
          objectPosition: `${style.posX}% ${style.posY}%`,
          // Scale up so blurred edges stay off-canvas
          filter: blur ? `blur(${blur}px)` : undefined,
          transform: blur ? `scale(${1 + (blur * 3) / 1000})` : undefined,
        }}
      />
      <div className="bg-shade" style={{ opacity: Math.min(1, Math.max(0, style.dim)) }} />
    </div>
  );
}
