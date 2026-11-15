import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import type { ArtAsset, ArtLibrary, Entry } from "../types";
import { rosterEntry } from "../data/tekken8";
import { autoFrame, builtinArt, processImage } from "../lib/artProcess";
import { CharArt } from "../layouts/shared";
import { RangeField } from "./ui";

type Props = {
  art: ArtLibrary;
  entries: Entry[];
  // Passing null goes back to the built-in art.
  onSet: (name: string, asset: ArtAsset | null) => void;
};

export function usedCharacters(entries: Entry[]): string[] {
  return Array.from(new Set(entries.flatMap((e) => e.characters.map((c) => c.name)).filter(Boolean)));
}

export function ArtLibraryPanel({ art, entries, onSet }: Props) {
  const used = usedCharacters(entries);
  if (used.length === 0) return <p className="hint">Pick characters in Top 8 and their art shows up here.</p>;

  return (
    <div className="art-panel">
      <p className="hint">Click a character to adjust the crop or use your own picture.</p>
      <ul className="art-grid">
        {used.map((name) => (
          <li key={name}>
            <ArtTile name={name} art={art[name]} onSet={onSet} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ArtTile({ name, art: a, onSet }: { name: string; art?: ArtAsset; onSet: Props["onSet"] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const builtin = builtinArt(name);
  const isDefault = !!a && a.source === "builtin" && !a.manual;

  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      onSet(name, await processImage(file));
    } catch {
      setError("Couldn't open that file. Try a PNG, JPG or WebP image.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover.Root>
      <Popover.Trigger className="art-thumb" data-missing={!a || undefined} aria-label={`${name} art`}>
        <CharArt name={name} art={a} fill={0.55} anchorY={48} style={{ width: "100%", aspectRatio: "1", borderRadius: 6 }} />
        <span className="art-thumb-name">{name}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className="positioner" side="right" align="start" sideOffset={10} collisionPadding={12}>
          <Popover.Popup className="popup art-popup">
            <div className="art-popup-head">
              <Popover.Title className="art-popup-title">{name}</Popover.Title>
              <span className="hint">{statusLabel(name, a)}</span>
            </div>

            {a && (
              <div className="crop-previews" title="How it looks in the standings">
                <CharArt name={name} art={a} fill={0.5} anchorY={47} style={{ width: 250, height: 110, borderRadius: 4 }} />
              </div>
            )}

            {a && (
              <div className="crop-sliders">
                {(
                  [
                    ["focusX", "Left / right", 0, 100, 0.5],
                    ["focusY", "Up / down", 0, 100, 0.5],
                    ["zoom", "Zoom", 0.5, 2.5, 0.05],
                  ] as const
                ).map(([key, label, min, max, step]) => (
                  <RangeField
                    key={key}
                    label={label}
                    value={a[key]}
                    min={min}
                    max={max}
                    step={step}
                    onChange={(v) => onSet(name, { ...a, [key]: v, manual: true })}
                  />
                ))}
              </div>
            )}

            <div className="btn-row">
              <label className="btn">
                {busy ? "Loading…" : a?.source === "upload" ? "Replace picture…" : "Upload your own…"}
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
              {a && !isDefault && builtin && (
                <button type="button" className="btn ghost" onClick={() => onSet(name, null)}>
                  Back to default art
                </button>
              )}
              {a?.source === "upload" && !builtin && (
                <button type="button" className="btn danger" onClick={() => onSet(name, null)}>
                  Remove
                </button>
              )}
              {a?.source === "upload" && (
                <button type="button" className="btn ghost" onClick={() => autoFrame(name, a).then((f) => onSet(name, f))}>
                  Auto-crop
                </button>
              )}
            </div>
            {a?.source === "upload" && <p className="hint">Tip: a cut-out PNG (transparent background) looks best.</p>}
            {error && <p className="notice warn">{error}</p>}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function statusLabel(name: string, a?: ArtAsset): string {
  if (!a) return rosterEntry(name) ? "No art yet: upload a picture" : "Not a Tekken 8 character we know: upload a picture";
  if (a.source === "upload") return a.manual ? "Your picture · cropped" : "Your picture";
  return a.manual ? "Default art · cropped" : "Default art";
}
