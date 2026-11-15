import { useLayoutEffect, useRef, type RefObject } from "react";
import { NumberField } from "@base-ui/react/number-field";
import countryData from "flag-icons/country.json";
import type { ArtLibrary, Entry, PlacementScheme } from "../types";
import { SuggestInput } from "./ui";
import { CharacterSlots } from "./CharacterSlots";

type Props = {
  entries: Entry[];
  scheme: PlacementScheme;
  art: ArtLibrary;
  onChange: (index: number, patch: Partial<Entry>) => void;
  onMove: (index: number, dir: -1 | 1) => void;
};

type Country = { code: string; name: string };
const COUNTRIES: Country[] = (countryData as Array<{ code: string; name: string; iso: boolean }>)
  .filter((c) => c.iso && /^[a-z]{2}$/.test(c.code))
  .map(({ code, name }) => ({ code, name }));
const matchCountry = (c: Country, q: string) => {
  const s = q.trim().toLowerCase();
  return !s || c.code.startsWith(s) || c.name.toLowerCase().includes(s);
};

const FlagChip = ({ code }: { code: string }) =>
  /^[a-z]{2}$/.test(code) ? <span className={`fi fi-${code} flag-chip`} aria-hidden="true" /> : <span className="flag-chip empty" />;

// Slides rows to their new spots after a reorder. Each slide starts from wherever the row is
// on screen, so pressing the arrows quickly doesn't make anything jump.
function useReorderAnimation(list: RefObject<HTMLOListElement>) {
  const lastTops = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tops = new Map<string, number>();
    for (const row of Array.from(el.children) as HTMLElement[]) {
      const id = row.dataset.id ?? "";
      const top = row.offsetTop;
      tops.set(id, top);
      const prev = lastTops.current.get(id);
      if (prev === undefined || prev === top || reduce) continue;
      const offset = new DOMMatrixReadOnly(getComputedStyle(row).transform).m42;
      row.getAnimations().forEach((a) => a.cancel());
      row.animate([{ transform: `translateY(${prev + offset - top}px)` }, { transform: "none" }], {
        duration: 240,
        easing: "cubic-bezier(0.77, 0, 0.175, 1)",
      });
    }
    lastTops.current = tops;
  });
}

export function PlayerList({ entries, scheme, art, onChange, onMove }: Props) {
  const listRef = useRef<HTMLOListElement>(null);
  useReorderAnimation(listRef);

  return (
    <ol className="players" ref={listRef}>
      {entries.map((e, i) => (
        <li key={e.id} className="player" data-id={e.id}>
          <div className="player-row">
            {scheme === "custom" ? (
              <NumberField.Root
                className="place-field"
                value={e.placement}
                min={1}
                max={99}
                onValueChange={(v) => onChange(i, { placement: v ?? 1 })}
              >
                <NumberField.Input className="input place-input" aria-label={`Placement for row ${i + 1}`} />
              </NumberField.Root>
            ) : (
              <span className="place-badge" data-podium={e.placement <= 3 || undefined}>
                {e.placement}
              </span>
            )}
            <input
              className="input team-input"
              placeholder="Team"
              aria-label="Team"
              value={e.sponsor}
              onChange={(ev) => onChange(i, { sponsor: ev.target.value })}
            />
            <input
              className="input tag-input"
              placeholder="Tag"
              aria-label="Tag"
              value={e.tag}
              onChange={(ev) => onChange(i, { tag: ev.target.value })}
            />
            <div className="move">
              <button type="button" className="icon-btn" disabled={i === 0} onClick={() => onMove(i, -1)} aria-label="Move up">
                ↑
              </button>
              <button
                type="button"
                className="icon-btn"
                disabled={i === entries.length - 1}
                onClick={() => onMove(i, 1)}
                aria-label="Move down"
              >
                ↓
              </button>
            </div>
          </div>

          <div className="player-row">
            <SuggestInput<Country>
              className="country-input"
              ariaLabel="Country"
              placeholder="Country"
              value={e.country}
              items={COUNTRIES}
              itemToString={(c) => c.code}
              filter={matchCountry}
              adornment={<FlagChip code={e.country} />}
              renderItem={(c) => (
                <>
                  <span className={`fi fi-${c.code} flag-chip`} aria-hidden="true" />
                  <span className="grow">{c.name}</span>
                  <span className="list-meta">{c.code.toUpperCase()}</span>
                </>
              )}
              onChange={(v) => onChange(i, { country: v.toLowerCase().replace(/[^a-z ]/g, "") })}
              onBlur={() => {
                // Turn something like "japan" into "jp", or clear it if nothing matches
                if (!e.country || /^[a-z]{2}$/.test(e.country)) return;
                onChange(i, { country: COUNTRIES.find((c) => matchCountry(c, e.country))?.code ?? "" });
              }}
            />
            <input
              className="input handle-input"
              placeholder="@handle"
              aria-label="Handle"
              value={e.handle}
              onChange={(ev) => onChange(i, { handle: ev.target.value })}
            />
          </div>

          <CharacterSlots characters={e.characters} art={art} onChange={(characters) => onChange(i, { characters })} />
        </li>
      ))}
    </ol>
  );
}
