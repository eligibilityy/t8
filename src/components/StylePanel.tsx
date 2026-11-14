import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import type { BackgroundImage, BackgroundStyle } from "../types";
import { THEMES } from "../data/themes";
import { STAGES, stageBackground, uploadBackground } from "../lib/background";
import { DEFAULT_BACKGROUND } from "../state";
import { RangeField } from "./ui";

type Props = {
  themeId: string;
  onTheme: (id: string) => void;
  bgImage: BackgroundImage | null;
  onBgImage: (bg: BackgroundImage | null) => void;
  bgStyle: BackgroundStyle;
  onBgStyle: (patch: Partial<BackgroundStyle>) => void;
};

export function StylePanel({ themeId, onTheme, bgImage, onBgImage, bgStyle, onBgStyle }: Props) {
  return (
    <div className="style-panel">
      <div className="field-group">
        <span className="field-label">Theme</span>
        <RadioGroup className="themes" aria-label="Theme" value={themeId} onValueChange={(v) => onTheme(String(v))}>
          {THEMES.map((t) => (
            <Radio.Root key={t.id} value={t.id} className="theme-swatch" title={t.label}>
              <span className="theme-colors">
                <span style={{ background: t.bg }} />
                <span style={{ background: t.accent }} />
                <span style={{ background: t.accent2 }} />
              </span>
              <span>{t.label.split(" (")[0]}</span>
            </Radio.Root>
          ))}
        </RadioGroup>
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
