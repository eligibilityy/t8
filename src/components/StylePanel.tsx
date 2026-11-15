import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import { Popover } from "@base-ui/react/popover";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import type { BackgroundImage, BackgroundStyle, Theme } from "../types";
import {
  CONTRAST_CHECKS,
  KEY_COLORS,
  MATCHED_COLORS,
  THEMES,
  contrastRatio,
  isAuto,
  isCustomTheme,
  resetThemeColor,
  setThemeColor,
  type ThemeColorKey,
} from "../data/themes";
import { paletteFromPixels } from "../lib/color";
import { STAGES, stageBackground, uploadBackground } from "../lib/background";
import { DEFAULT_BACKGROUND } from "../state";
import { ColorRow, type SwatchGroup } from "./ColorPicker";
import { ChevronIcon, RangeField, TextField } from "./ui";

type Props = {
  themeId: string;
  customThemes: Theme[];
  onTheme: (id: string) => void;
  onCreateTheme: () => void;
  /** Editing a built-in saves the change on a copy */
  onUpdateTheme: (id: string, patch: Partial<Theme>) => void;
  onDeleteTheme: (id: string) => void;
  onRestoreTheme: (theme: Theme, index: number) => void;
  bgImage: BackgroundImage | null;
  onBgImage: (bg: BackgroundImage | null) => void;
  bgStyle: BackgroundStyle;
  onBgStyle: (patch: Partial<BackgroundStyle>) => void;
};

export function StylePanel({
  themeId,
  customThemes,
  onTheme,
  onCreateTheme,
  onUpdateTheme,
  onDeleteTheme,
  onRestoreTheme,
  bgImage,
  onBgImage,
  bgStyle,
  onBgStyle,
}: Props) {
  const all = [...THEMES, ...customThemes];
  const selected = all.find((t) => t.id === themeId) ?? THEMES[0];
  const bgPalette = useImagePalette(bgImage?.src);
  const [deleted, setDeleted] = useState<{ theme: Theme; index: number } | null>(null);

  // The undo offer goes away on its own
  useEffect(() => {
    if (!deleted) return;
    const t = setTimeout(() => setDeleted(null), 8000);
    return () => clearTimeout(t);
  }, [deleted]);

  return (
    <div className="style-panel">
      <div className="field-group">
        <span className="field-label">Theme</span>
        <div className="themes">
          <RadioGroup className="themes-radios" aria-label="Theme" value={selected.id} onValueChange={(v) => onTheme(String(v))}>
            {all.map((t) => (
              <Radio.Root key={t.id} value={t.id} className="theme-swatch" title={t.note ? `${t.label} (${t.note})` : t.label}>
                <ThemePreview theme={t} />
                <span className="theme-name">{t.label || "Untitled"}</span>
              </Radio.Root>
            ))}
          </RadioGroup>
          <button type="button" className="theme-swatch theme-new" onClick={onCreateTheme} title="New theme from the selected one">
            <span className="theme-preview theme-new-preview" aria-hidden="true">
              +
            </span>
            <span className="theme-name">New</span>
          </button>
        </div>

        {deleted && (
          <p className="notice undo" role="status">
            Deleted “{deleted.theme.label || "Untitled"}”.
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                onRestoreTheme(deleted.theme, deleted.index);
                setDeleted(null);
              }}
            >
              Undo
            </button>
          </p>
        )}

        <ThemeEditor
          theme={selected}
          bgPalette={bgPalette}
          onChange={(patch) => onUpdateTheme(selected.id, patch)}
          onDuplicate={onCreateTheme}
          onDelete={() => {
            setDeleted({ theme: selected, index: customThemes.findIndex((t) => t.id === selected.id) });
            onDeleteTheme(selected.id);
          }}
        />
      </div>

      <div className="field-group">
        <span className="field-label">Background</span>
        <BackgroundPicker bgImage={bgImage} onBgImage={onBgImage} />
        {bgImage && (
          <div className="crop-sliders">
            <RangeField label="Shade" value={bgStyle.dim} min={0} max={1} step={0.05} onChange={(dim) => onBgStyle({ dim })} />
            <RangeField label="Blur" value={bgStyle.blur} min={0} max={24} step={1} onChange={(blur) => onBgStyle({ blur })} />
            <RangeField label="Position X" value={bgStyle.posX} min={0} max={100} step={1} onChange={(posX) => onBgStyle({ posX })} />
            <RangeField label="Position Y" value={bgStyle.posY} min={0} max={100} step={1} onChange={(posY) => onBgStyle({ posY })} />
            <div className="btn-row">
              <button type="button" className="btn ghost" onClick={() => onBgStyle({ ...DEFAULT_BACKGROUND })}>
                Reset adjustments
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** A tiny standings graphic in the theme's colours */
function ThemePreview({ theme: t }: { theme: Theme }) {
  return (
    <span className="theme-preview" aria-hidden="true" style={{ background: `radial-gradient(120% 100% at 90% 0%, ${t.bg2}, ${t.bg} 70%)` }}>
      <span className="tp-title" style={{ background: t.accent }} />
      {[0, 1, 2].map((i) => (
        <span key={i} className="tp-row" style={{ background: t.surface, boxShadow: `inset 0 -1px 0 ${t.surfaceEdge}` }}>
          <span className="tp-place" style={{ background: i === 0 ? t.accent : t.surfaceEdge }} />
          <span className="tp-text" style={{ background: i === 0 ? t.text : t.textDim }} />
          {i === 0 && <span className="tp-dot" style={{ background: t.accent2 }} />}
        </span>
      ))}
    </span>
  );
}

/** Key colours up front; the matched ones follow them unless set by hand */
function ThemeEditor({
  theme,
  bgPalette,
  onChange,
  onDuplicate,
  onDelete,
}: {
  theme: Theme;
  bgPalette: string[];
  onChange: (patch: Partial<Theme>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const custom = isCustomTheme(theme.id);
  const lowKeys = MATCHED_COLORS.filter(({ key }) => isLow(theme, key)).map((c) => c.key);
  const manualCount = MATCHED_COLORS.filter(({ key }) => !isAuto(theme, key)).length;
  const [matchedOpen, setMatchedOpen] = useState(false);
  // Open the matched colours when one of them needs attention
  useEffect(() => {
    if (lowKeys.length) setMatchedOpen(true);
  }, [lowKeys.length]);

  const swatchesFor = (key: ThemeColorKey): SwatchGroup[] => [
    {
      title: "This theme",
      colors: unique([...KEY_COLORS, ...MATCHED_COLORS].filter((c) => c.key !== key).map((c) => theme[c.key])),
    },
    { title: "From the background", colors: bgPalette },
    { title: "Basics", colors: ["#ffffff", "#111111", "#0b0b0f", "#f1eee8"] },
  ];
  const row = (c: { key: ThemeColorKey; label: string; hint: string }, aside?: ReactNode) => {
    const check = CONTRAST_CHECKS[c.key];
    return (
      <ColorRow
        key={c.key}
        label={c.label}
        hint={c.hint}
        value={theme[c.key]}
        onChange={(hex) => onChange(setThemeColor(theme, c.key, hex))}
        swatches={swatchesFor(c.key)}
        contrast={check && { on: theme[check.on], min: check.min, what: check.what }}
        aside={aside}
      />
    );
  };

  return (
    <div className="theme-editor">
      {custom ? (
        <div className="theme-editor-head">
          <TextField label="Name" value={theme.label} onChange={(label) => onChange({ label })} placeholder="My theme" />
          <div className="btn-row">
            <button type="button" className="btn ghost" onClick={onDuplicate}>
              Duplicate
            </button>
            <button type="button" className="btn ghost danger" onClick={onDelete}>
              Delete
            </button>
          </div>
        </div>
      ) : (
        <p className="hint">
          <strong>{theme.label}</strong> is built in. Change any colour and it's saved as your own copy.
        </p>
      )}

      <div className="color-group">
        <span className="color-group-title">Key colours</span>
        {KEY_COLORS.map((c) => row(c))}
      </div>

      <Collapsible.Root className="color-group" open={matchedOpen} onOpenChange={setMatchedOpen}>
        <Collapsible.Trigger className="matched-trigger">
          <span className="color-group-title">Matched colours</span>
          <span className="matched-chips" aria-hidden="true">
            {MATCHED_COLORS.map((c) => (
              <span key={c.key} style={{ background: theme[c.key] }} />
            ))}
          </span>
          <span className="matched-summary" data-warn={lowKeys.length || undefined}>
            {lowKeys.length ? `${lowKeys.length} hard to read` : manualCount ? `${manualCount} set by hand` : "Automatic"}
          </span>
          <ChevronIcon />
        </Collapsible.Trigger>
        <Collapsible.Panel className="matched-panel">
          <p className="hint">These follow your key colours. Change one to set it yourself.</p>
          {MATCHED_COLORS.map((c) => {
            const auto = isAuto(theme, c.key);
            const low = isLow(theme, c.key);
            return row(
              c,
              <span className="color-aside">
                {low && (
                  <span className="contrast-warn" title={`Hard to read ${CONTRAST_CHECKS[c.key]!.what}`}>
                    <WarnIcon /> {contrastRatio(theme[c.key], theme[CONTRAST_CHECKS[c.key]!.on]).toFixed(1)}:1
                  </span>
                )}
                {auto ? (
                  <span className="auto-chip" title="Follows the key colours">
                    Auto
                  </span>
                ) : (
                  <button
                    type="button"
                    className="auto-chip manual"
                    title="Match the key colours again"
                    aria-label={`Match ${c.label} to the key colours again`}
                    onClick={() => onChange(resetThemeColor(theme, c.key))}
                  >
                    <LinkIcon /> Match
                  </button>
                )}
              </span>,
            );
          })}
        </Collapsible.Panel>
      </Collapsible.Root>

      <p className="hint">{custom ? "Changes save automatically in this browser." : "Your copy appears next to the built-in themes."}</p>
    </div>
  );
}

function isLow(theme: Theme, key: ThemeColorKey): boolean {
  const check = CONTRAST_CHECKS[key];
  return !!check && contrastRatio(theme[key], theme[check.on]) < check.min;
}

const unique = (colors: string[]) => [...new Set(colors)];

/** A few colours from the background picture, for swatches */
function useImagePalette(src: string | undefined): string[] {
  const [palette, setPalette] = useState<string[]>([]);
  useEffect(() => {
    setPalette([]);
    if (!src) return;
    let alive = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 36;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      try {
        const colors = paletteFromPixels(ctx.getImageData(0, 0, c.width, c.height).data, 6);
        if (alive) setPalette(colors);
      } catch {
        /* cross-origin picture: no swatches */
      }
    };
    img.src = src;
    return () => {
      alive = false;
    };
  }, [src]);
  return useMemo(() => palette, [palette]);
}

function WarnIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M6 1.5l5 9H1z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M6 5v2.4M6 8.9v.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M5 7l2-2M4.2 5.6L3 6.8a1.8 1.8 0 0 0 2.6 2.6l1.2-1.2M7.8 6.4L9 5.2a1.8 1.8 0 0 0-2.6-2.6L5.2 3.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BackgroundPicker({ bgImage, onBgImage }: { bgImage: BackgroundImage | null; onBgImage: (bg: BackgroundImage | null) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function choose(bg: BackgroundImage | null) {
    onBgImage(bg);
    setError("");
    setOpen(false);
  }

  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      choose(await uploadBackground(file));
    } catch {
      setError("Couldn't open that file. Try a PNG, JPG or WebP image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="bg-current" aria-label="Choose background">
        {bgImage ? <img src={bgImage.src} alt="" /> : <span className="bg-none-swatch" />}
        <span className="bg-current-text">
          <span>{bgImage ? bgImage.label : "Plain"}</span>
          <span className="hint">{bgImage ? (bgImage.id === "upload" ? "Your picture" : "Stage") : "Theme colours only"} · Change…</span>
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className="positioner" side="right" align="start" sideOffset={10} collisionPadding={12}>
          <Popover.Popup className="popup bg-popup">
            <div className="art-popup-head">
              <Popover.Title className="art-popup-title">Background</Popover.Title>
              <span className="hint">{STAGES.length ? "Pick a stage or use your own picture." : "Use your own picture: a venue photo, a stage screenshot, key art…"}</span>
            </div>

            <div className="bg-grid">
              <button type="button" className="bg-option" data-selected={!bgImage || undefined} onClick={() => choose(null)}>
                <span className="bg-none-swatch" />
                <span className="bg-option-name">Plain</span>
              </button>
              {bgImage?.id === "upload" && (
                <button type="button" className="bg-option" data-selected onClick={() => setOpen(false)}>
                  <img src={bgImage.src} alt="" />
                  <span className="bg-option-name">Your picture</span>
                </button>
              )}
              {STAGES.map((s) => (
                <button
                  key={s.slug}
                  type="button"
                  className="bg-option"
                  data-selected={bgImage?.id === `stage:${s.slug}` || undefined}
                  onClick={() => choose(stageBackground(s))}
                >
                  <img src={s.thumb} alt="" loading="lazy" decoding="async" />
                  <span className="bg-option-name">{s.name}</span>
                </button>
              ))}
            </div>

            <div className="btn-row">
              <label className="btn">
                {busy ? "Loading…" : "Upload a picture…"}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void upload(f);
                  }}
                />
              </label>
            </div>
            {error && <p className="notice warn">{error}</p>}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
