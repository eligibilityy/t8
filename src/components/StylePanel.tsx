import { useState } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Popover } from "@base-ui/react/popover";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import type { BackgroundImage, BackgroundStyle, Theme } from "../types";
import { THEME_COLOR_GROUPS, THEMES, contrastRatio } from "../data/themes";
import { STAGES, stageBackground, uploadBackground } from "../lib/background";
import { DEFAULT_BACKGROUND } from "../state";
import { ColorField, RangeField, TextField } from "./ui";

type Props = {
  themeId: string;
  customThemes: Theme[];
  onTheme: (id: string) => void;
  onCreateTheme: () => void;
  onUpdateTheme: (id: string, patch: Partial<Theme>) => void;
  onDeleteTheme: (id: string) => void;
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
  bgImage,
  onBgImage,
  bgStyle,
  onBgStyle,
}: Props) {
  const editing = customThemes.find((t) => t.id === themeId);

  return (
    <div className="style-panel">
      <div className="field-group">
        <span className="field-label">Theme</span>
        <RadioGroup className="themes" aria-label="Theme" value={themeId} onValueChange={(v) => onTheme(String(v))}>
          {[...THEMES, ...customThemes].map((t) => (
            <Radio.Root key={t.id} value={t.id} className="theme-swatch" title={t.note ? `${t.label} (${t.note})` : t.label}>
              <span className="theme-colors">
                <span style={{ background: t.bg }} />
                <span style={{ background: t.accent }} />
                <span style={{ background: t.accent2 }} />
              </span>
              <span className="theme-name">{t.label}</span>
            </Radio.Root>
          ))}
        </RadioGroup>
        <div className="btn-row">
          <button type="button" className="btn" onClick={onCreateTheme}>
            + Make your own
          </button>
          <span className="hint">{editing ? "Copies this theme" : "Starts from the selected theme"}</span>
        </div>
        {editing && (
          <ThemeEditor
            key={editing.id}
            theme={editing}
            onChange={(patch) => onUpdateTheme(editing.id, patch)}
            onDelete={() => onDeleteTheme(editing.id)}
          />
        )}
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

function ThemeEditor({ theme, onChange, onDelete }: { theme: Theme; onChange: (patch: Partial<Theme>) => void; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const lowContrast = [
    contrastRatio(theme.text, theme.surface) < 3 && "main text on panels",
    contrastRatio(theme.accentInk, theme.accent) < 3 && "text on the accent",
    contrastRatio(theme.textDim, theme.bg) < 2 && "small text on the background",
  ].filter(Boolean);

  return (
    <div className="theme-editor">
      <TextField label="Theme name" value={theme.label} onChange={(label) => onChange({ label })} placeholder="My theme" />
      {THEME_COLOR_GROUPS.map((g) => (
        <div key={g.title} className="color-group">
          <span className="color-group-title">{g.title}</span>
          {g.colors.map((c) => (
            <ColorField key={c.key} label={c.label} value={theme[c.key]} onChange={(hex) => onChange({ [c.key]: hex })} />
          ))}
        </div>
      ))}
      {lowContrast.length > 0 && <p className="notice warn">Hard to read: {lowContrast.join(", ")}.</p>}
      <div className="btn-row">
        <button type="button" className="btn ghost danger" onClick={() => setConfirmDelete(true)}>
          Delete theme…
        </button>
        <span className="hint">Changes save automatically in this browser.</span>
      </div>

      <AlertDialog.Root open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="backdrop" />
          <AlertDialog.Popup className="popup dialog">
            <AlertDialog.Title className="dialog-title">Delete “{theme.label || "this theme"}”?</AlertDialog.Title>
            <AlertDialog.Description className="hint">The graphic switches back to a built-in theme. This can't be undone.</AlertDialog.Description>
            <div className="btn-row end">
              <AlertDialog.Close className="btn">Cancel</AlertDialog.Close>
              <button type="button" className="btn danger" onClick={onDelete}>
                Delete
              </button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
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
