import { useRef, useState, type FormEvent } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { builtinArt } from "../lib/artProcess";
import {
  countryCode,
  rosterName,
  type ImportedResults,
} from "../lib/importResults";
import { ordinal } from "../lib/placements";
import { CharacterFace } from "./CharacterSlots";
import { Spinner, SwapLabel } from "./ui";

const SOURCE_NAME = { startgg: "start.gg", challonge: "Challonge" } as const;

/** Paste a bracket link, preview the top 8, then replace the current results with it */
export function ImportDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (results: ImportedResults) => void;
}) {
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportedResults | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef(0);

  async function lookUp(value = link) {
    if (!value.trim()) return;
    const id = ++request.current;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(
        `/api/import?url=${encodeURIComponent(value.trim())}`,
      );
      const body = (await res.json().catch(() => ({}))) as ImportedResults & {
        error?: string;
      };
      if (id !== request.current) return;
      if (!res.ok || body.error)
        setError(body.error ?? `Import failed (HTTP ${res.status}).`);
      else setResult(body);
    } catch {
      if (id === request.current)
        setError("Couldn't reach the import service. Check your connection.");
    } finally {
      if (id === request.current) setBusy(false);
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void lookUp();
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          request.current++;
          setBusy(false);
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="backdrop" />
        <Dialog.Popup
          className="popup dialog import-dialog"
          initialFocus={input}
        >
          <Dialog.Title className="dialog-title">Import results</Dialog.Title>
          <Dialog.Description className="hint">
            Accepts start.gg and challonge.com.
          </Dialog.Description>

          <form className="import-form" onSubmit={onSubmit}>
            <input
              ref={input}
              className="input"
              type="url"
              inputMode="url"
              placeholder="start.gg/tournament/…/event/…  or  challonge.com/…"
              aria-label="Bracket link"
              autoComplete="off"
              spellCheck={false}
              value={link}
              onChange={(e) => {
                setLink(e.currentTarget.value);
                setError("");
              }}
              onPaste={(e) => {
                // Look up as soon as a link is pasted
                const text = e.clipboardData.getData("text").trim();
                if (text) {
                  e.preventDefault();
                  setLink(text);
                  void lookUp(text);
                }
              }}
            />
            <button
              type="submit"
              className="btn"
              disabled={busy || !link.trim()}
              data-busy={busy || undefined}
            >
              <SwapLabel
                state={busy ? "busy" : "idle"}
                labels={{
                  idle: "Look up",
                  busy: (
                    <>
                      <Spinner /> Looking up
                    </>
                  ),
                }}
              />
            </button>
          </form>

          {error && (
            <p className="notice warn" role="alert">
              {error}
            </p>
          )}

          {result && <ImportPreview result={result} />}

          <div className="btn-row end">
            <Dialog.Close className="btn">Cancel</Dialog.Close>
            <button
              type="button"
              className="btn primary"
              disabled={!result}
              onClick={() => {
                if (!result) return;
                onImport(result);
                onOpenChange(false);
                setResult(null);
                setLink("");
              }}
            >
              Use these results
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ImportPreview({ result: r }: { result: ImportedResults }) {
  const meta = [
    r.event.date,
    r.event.location,
    r.event.entrants && `${r.event.entrants} entrants`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="import-preview" aria-live="polite">
      <div className="import-event">
        <span className="import-source">{SOURCE_NAME[r.source]}</span>
        <strong>{r.event.name || "Untitled event"}</strong>
        {r.event.game && <span className="hint">{r.event.game}</span>}
        {meta && <span className="hint">{meta}</span>}
      </div>
      <ol className="import-players">
        {r.players.map((p, i) => {
          const code = countryCode(p.country);
          return (
            <li key={i} className="import-player">
              <span className="import-place">{ordinal(p.placement)}</span>
              {code ? (
                <span className={`fi fi-${code} flag-chip`} title={p.country} />
              ) : (
                <span className="flag-chip empty" />
              )}
              <span className="import-name">
                {p.prefix && <span className="import-prefix">{p.prefix}</span>}
                {p.tag}
              </span>
              <span className="import-chars">
                {p.characters.slice(0, 3).map((c) => {
                  const name = rosterName(c);
                  return (
                    <span key={c} className="char-tile" title={name}>
                      <CharacterFace
                        name={name}
                        art={builtinArt(name)}
                        size={26}
                      />
                    </span>
                  );
                })}
              </span>
            </li>
          );
        })}
      </ol>
      {r.warnings.map((w) => (
        <p key={w} className="notice warn">
          {w}
        </p>
      ))}
      <p className="hint">
        This will replace the event details and the current top 8.
      </p>
    </div>
  );
}
