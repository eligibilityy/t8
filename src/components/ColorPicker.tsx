import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Popover } from "@base-ui/react/popover";
import { Slider } from "@base-ui/react/slider";
import { normalizeHex } from "../data/themes";
import { contrastRatio, hexToHsv, hsvToHex, type HSV } from "../lib/color";

export type SwatchGroup = { title: string; colors: string[] };
export type ContrastCheck = { on: string; min: number; what: string };

// Chromium's EyeDropper; not in TypeScript's DOM types yet
type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };
const EyeDropper = (globalThis as { EyeDropper?: EyeDropperCtor }).EyeDropper;

/**
 * A colour setting: the row shows swatch, name and hex; clicking it opens the picker beside the
 * sidebar so the graphic stays in view while you choose.
 */
export function ColorRow({
  label,
  hint,
  value,
  onChange,
  swatches,
  contrast,
  aside,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (hex: string) => void;
  swatches: SwatchGroup[];
  contrast?: ContrastCheck;
  /** Controls after the row (Auto toggle, warnings) */
  aside?: ReactNode;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [offset, setOffset] = useState(14);
  /** Open just past the sidebar's edge, so the picker covers the graphic, not the settings */
  const measure = () => {
    const t = trigger.current?.getBoundingClientRect();
    const bar = trigger.current?.closest(".sidebar")?.getBoundingClientRect();
    if (!t || !bar || bar.right + 280 > window.innerWidth) return setOffset(14);
    setOffset(Math.max(14, bar.right - t.right + 12));
  };

  return (
    <div className="color-row">
      <Popover.Root onOpenChange={(open) => open && measure()}>
        <Popover.Trigger ref={trigger} className="color-trigger" aria-label={`${label}: ${value}. Change colour`}>
          <span className="color-chip" style={{ background: value }} />
          <span className="color-text">
            <span className="color-label">{label}</span>
            {hint && <span className="color-hint">{hint}</span>}
          </span>
          <span className="color-hex">{value.slice(1)}</span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner className="positioner" side="right" align="center" sideOffset={offset} collisionPadding={12}>
            <Popover.Popup className="popup color-popup">
              <Popover.Title className="color-popup-title">{label}</Popover.Title>
              <ColorPicker value={value} onChange={onChange} swatches={swatches} contrast={contrast} />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      {aside}
    </div>
  );
}

/** Saturation/brightness area + hue slider + hex, with swatches and an eyedropper */
export function ColorPicker({
  value,
  onChange,
  swatches,
  contrast,
}: {
  value: string;
  onChange: (hex: string) => void;
  swatches: SwatchGroup[];
  contrast?: ContrastCheck;
}) {
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(value));
  const emitted = useRef(value);
  const frame = useRef(0);
  const pending = useRef<string | null>(null);
  // Latest handler: the first edit of a built-in theme swaps in a copy mid-drag
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Outside changes (a swatch, undo, auto colours) move the picker; our own echoes don't,
  // so the hue survives greys and blacks
  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    const next = hexToHsv(value);
    setHsv((h) => (next.s === 0 || next.v === 0 ? { ...next, h: h.h } : next));
  }, [value]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  /** Update the picker now; tell the app at most once a frame */
  const emit = (next: HSV) => {
    setHsv(next);
    const hex = hsvToHex(next);
    emitted.current = hex;
    pending.current = hex;
    if (!frame.current)
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        if (pending.current) onChangeRef.current(pending.current);
        pending.current = null;
      });
  };
  const setHex = (hex: string) => {
    emitted.current = hex;
    const next = hexToHsv(hex);
    setHsv((h) => (next.s === 0 || next.v === 0 ? { ...next, h: h.h } : next));
    onChange(hex);
  };

  const hex = hsvToHex(hsv);
  const ratio = contrast ? contrastRatio(hex, contrast.on) : 0;

  return (
    <div className="color-picker">
      <SatValArea hsv={hsv} onChange={emit} />
      <Slider.Root
        className="hue-slider"
        value={hsv.h}
        min={0}
        max={359}
        step={1}
        onValueChange={(h) => emit({ ...hsv, h: h as number })}
        aria-label="Hue"
      >
        <Slider.Control className="hue-control">
          <Slider.Track className="hue-track">
            <Slider.Thumb className="hue-thumb" aria-label="Hue" style={{ background: hsvToHex({ h: hsv.h, s: 1, v: 1 }) }} />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>

      <div className="color-inputs">
        <HexInput value={hex} onCommit={setHex} />
        {EyeDropper && (
          <button
            type="button"
            className="icon-btn eyedropper"
            aria-label="Pick a colour from the screen"
            title="Pick from the screen"
            onClick={async () => {
              try {
                const { sRGBHex } = await new EyeDropper().open();
                const h = normalizeHex(sRGBHex);
                if (h) setHex(h);
              } catch {
                /* cancelled */
              }
            }}
          >
            <EyedropperIcon />
          </button>
        )}
      </div>

      {contrast && (
        <p className="color-contrast" data-low={ratio < contrast.min || undefined}>
          <span className="contrast-sample" style={{ background: contrast.on, color: hex }}>
            Aa
          </span>
          {ratio.toFixed(1)}:1 {contrast.what}
          <span className="contrast-verdict">{ratio < contrast.min ? "Hard to read" : "Readable"}</span>
        </p>
      )}

      {swatches
        .filter((g) => g.colors.length)
        .map((g) => (
          <div key={g.title} className="swatch-group">
            <span className="swatch-title">{g.title}</span>
            <div className="swatches">
              {g.colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="swatch"
                  style={{ background: c }}
                  aria-label={`Use ${c}`}
                  title={c}
                  data-current={c === hex || undefined}
                  onClick={() => setHex(c)}
                />
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

/** 2D area: x = saturation, y = brightness. Tracks the pointer 1:1; arrow keys nudge (Shift: ×10). */
function SatValArea({ hsv, onChange }: { hsv: HSV; onChange: (hsv: HSV) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const set = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const s = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const v = 1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    onChange({ ...hsv, s, v });
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const d = (e.shiftKey ? 0.1 : 0.01) * ({ ArrowRight: 1, ArrowLeft: -1, ArrowUp: 1, ArrowDown: -1 }[e.key] ?? 0);
    if (!d) return;
    e.preventDefault();
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") onChange({ ...hsv, s: clamp(hsv.s + d) });
    else onChange({ ...hsv, v: clamp(hsv.v + d) });
  };
  return (
    <div
      ref={ref}
      className="sv-area"
      style={{ backgroundColor: hsvToHex({ h: hsv.h, s: 1, v: 1 }) }}
      tabIndex={0}
      role="slider"
      aria-label="Saturation and brightness"
      aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
      aria-valuenow={Math.round(hsv.s * 100)}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.setAttribute("data-dragging", "");
        set(e);
      }}
      onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && set(e)}
      onPointerUp={(e) => e.currentTarget.removeAttribute("data-dragging")}
      onPointerCancel={(e) => e.currentTarget.removeAttribute("data-dragging")}
      onKeyDown={onKeyDown}
    >
      <span
        className="sv-thumb"
        style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hsvToHex(hsv) }}
      />
    </div>
  );
}

function HexInput({ value, onCommit }: { value: string; onCommit: (hex: string) => void }) {
  const [draft, setDraft] = useState(value.slice(1));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(value.slice(1));
  }, [value, focused]);
  const commit = () => {
    const h = normalizeHex(draft);
    if (h) onCommit(h);
    else setDraft(value.slice(1));
  };
  return (
    <label className="input hex-input">
      <span aria-hidden="true">#</span>
      <input
        value={draft}
        maxLength={7}
        spellCheck={false}
        autoComplete="off"
        aria-label="Hex code"
        onFocus={(e) => {
          setFocused(true);
          e.currentTarget.select();
        }}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onChange={(e) => {
          const text = e.currentTarget.value.replace(/^#/, "");
          setDraft(text);
          const h = normalizeHex(text);
          if (h && text.length === 6) onCommit(h);
        }}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
    </label>
  );
}

function EyedropperIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M10.5 2.5a1.6 1.6 0 0 1 2.3 0l.7.7a1.6 1.6 0 0 1 0 2.3l-1.6 1.6.6.6-1 1-.6-.6-4.6 4.6H3.4v-2.9L8 5.2l-.6-.6 1-1 .6.6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
