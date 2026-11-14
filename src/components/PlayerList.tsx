import { NumberField } from "@base-ui/react/number-field";
import countryData from "flag-icons/country.json";
import type { ArtLibrary, Entry, PlacementScheme } from "../types";
import { TEKKEN8_ROSTER } from "../data/tekken8";
import { SuggestInput } from "./ui";

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

export function PlayerList({ entries, scheme, art, onChange, onMove }: Props) {
  return (
    <ol className="players">
      {entries.map((e, i) => (
        <li key={e.id} className="player">
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
                // "japan" → "jp", else clear
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

          <div className="player-row chars">
            {[0, 1, 2].map((ci) => {
              const c = e.characters[ci];
              if (!c && ci > e.characters.length) return null;
              const name = c?.name ?? "";
              const hasArt = !!(name && art[name]);
              return (
                <SuggestInput<string>
                  key={ci}
                  className="char-input"
                  ariaLabel={ci === 0 ? "Main character" : `Character ${ci + 1}`}
                  placeholder={ci === 0 ? "Main" : "+ character"}
                  value={name}
                  items={TEKKEN8_ROSTER}
                  itemToString={(n) => n}
                  adornment={name ? <span className="art-dot" data-ok={hasArt || undefined} title={hasArt ? "Art ready" : "No art yet"} /> : null}
                  onChange={(v) => {
                    const chars = [...e.characters];
                    chars[ci] = { name: v };
                    onChange(i, { characters: chars.filter((x, xi) => x.name || xi === 0) });
                  }}
                />
              );
            })}
          </div>
        </li>
      ))}
    </ol>
  );
}
