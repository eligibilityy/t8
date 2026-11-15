import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { ArtAsset } from "../types";

export function FitText({
  children,
  max,
  min = Math.round(max * 0.4),
  style,
  className,
}: {
  children: ReactNode;
  max: number;
  min?: number;
  style?: CSSProperties;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState(max);
  const [fontsTick, setFontsTick] = useState(0);

  useLayoutEffect(() => {
    let alive = true;
    document.fonts.ready.then(() => alive && setFontsTick((t) => t + 1));
    return () => {
      alive = false;
    };
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    let lo = min;
    let hi = max;
    el.style.fontSize = `${hi}px`;
    if (el.scrollWidth <= parent.clientWidth) {
      setSize(hi);
      return;
    }
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      el.style.fontSize = `${mid}px`;
      if (el.scrollWidth <= parent.clientWidth) lo = mid;
      else hi = mid;
    }
    el.style.fontSize = `${lo}px`;
    setSize(lo);
  }, [children, max, min, fontsTick, style?.fontFamily]);

  return (
    <span
      ref={ref}
      className={className}
      style={{ display: "inline-block", whiteSpace: "nowrap", lineHeight: 1, ...style, fontSize: size }}
    >
      {children}
    </span>
  );
}

export function Flag({ code, size = 32 }: { code: string; size?: number }) {
  const c = code.trim().toLowerCase();
  if (!c) return null;
  if (/^[a-z]{2}$/.test(c)) {
    return (
      <span
        className={`fi fi-${c}`}
        style={{ width: size * 1.333, height: size, lineHeight: `${size}px`, backgroundSize: "cover", borderRadius: 3 }}
      />
    );
  }
  return <span className="country-code">{c.toUpperCase()}</span>;
}

export function CharArt({
  name,
  art,
  style,
  fill = 0.45,
  anchorY = 45,
}: {
  name: string;
  art?: ArtAsset;
  style?: CSSProperties;
  // face height as a share of the slot
  fill?: number;
  // where the face centre sits, as a % of the slot height
  anchorY?: number;
}) {
  if (!art) {
    const initials = name
      .split(/[\s-]+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 3)
      .toUpperCase();
    return (
      <div className="art-placeholder" style={style}>
        <span>{initials || "?"}</span>
      </div>
    );
  }
  const face = art.face > 0 ? art.face : 0.12;
  const heightPct = Math.max(100, ((fill * (art.zoom || 1)) / face) * 100);
  return (
    <div style={{ overflow: "hidden", position: "relative", ...style }}>
      <img
        src={art.src}
        alt=""
        style={{
          position: "absolute",
          left: "50%",
          top: `${anchorY}%`,
          height: `${heightPct}%`,
          width: "auto",
          maxWidth: "none",
          transform: `translate(-${art.focusX}%, -${art.focusY}%)`,
        }}
      />
    </div>
  );
}

export function Disclaimer({ usesGameArt, gameName }: { usesGameArt: boolean; gameName: string }) {
  const isTekken = /tekken/i.test(gameName);
  return (
    <span className="disclaimer">
      Fan-made graphic · not affiliated with or endorsed by the game publisher
      {usesGameArt && isTekken ? " · TEKKEN™8 & ©Bandai Namco Entertainment Inc." : ""}
    </span>
  );
}
