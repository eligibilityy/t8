import {
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Popover } from "@base-ui/react/popover";
import type { ArtAsset, ArtLibrary, CharacterPick } from "../types";
import { TEKKEN8_ROSTER, normaliseName } from "../data/tekken8";
import { builtinArt } from "../lib/artProcess";
import { CharArt } from "../layouts/shared";

const MAX = 3;
const COLS = 5;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = () => window.matchMedia("(pointer: fine)").matches;

// Uses the small published thumbnail when there is one, otherwise crops the full art live.
export function CharacterFace({ name, art, size }: { name: string; art?: ArtAsset | null; size: number }) {
  if (art?.thumb && !art.manual && art.source !== "upload") {
    return <img className="char-face" src={art.thumb} alt="" width={size} height={size} loading="lazy" decoding="async" draggable={false} />;
  }
  return (
    <CharArt name={name} art={art ?? undefined} fill={0.55} anchorY={48} style={{ width: size, height: size }} />
  );
}

type SlotsProps = {
  characters: CharacterPick[];
  art: ArtLibrary;
  onChange: (characters: CharacterPick[]) => void;
};

export function CharacterSlots({ characters, art, onChange }: SlotsProps) {
  const names = characters.map((c) => c.name).filter(Boolean);
  const listRef = useRef<HTMLUListElement>(null);
  const before = useRef<Map<string, DOMRect> | null>(null);
  const drag = useRef<{ index: number; startX: number; pointerId: number; dragging: boolean; centers: number[]; width: number } | null>(
    null,
  );
  const suppressClick = useRef(false);
  const [open, setOpen] = useState<number | null>(null); // which slot's picker is open; names.length means the + tile

  const commit = (next: string[]) => onChange(next.map((name) => ({ name })));

  const snapshot = () => {
    const m = new Map<string, DOMRect>();
    listRef.current?.querySelectorAll<HTMLElement>("[data-name]").forEach((el) => m.set(el.dataset.name!, el.getBoundingClientRect()));
    before.current = m;
  };

  useLayoutEffect(() => {
    const prev = before.current;
    before.current = null;
    if (!prev || reducedMotion()) return;
    listRef.current?.querySelectorAll<HTMLElement>("[data-name]").forEach((el) => {
      const was = prev.get(el.dataset.name!);
      if (!was) return;
      const dx = was.left - el.getBoundingClientRect().left;
      if (Math.abs(dx) < 0.5) return;
      el.animate([{ transform: `translateX(${dx}px)` }, { transform: "none" }], {
        duration: 220,
        easing: "cubic-bezier(0.23, 1, 0.32, 1)",
      });
    });
  });

  const move = (from: number, to: number) => {
    if (to < 0 || to >= names.length || from === to) return;
    const next = [...names];
    const [n] = next.splice(from, 1);
    next.splice(to, 0, n);
    snapshot();
    commit(next);
  };

  const tiles = () => Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-name]") ?? []);

  const onPointerDown = (e: PointerEvent, index: number) => {
    if (e.button !== 0 || names.length < 2) return;
    const els = tiles();
    const rects = els.map((el) => el.getBoundingClientRect());
    drag.current = {
      index,
      startX: e.clientX,
      pointerId: e.pointerId,
      dragging: false,
      centers: rects.map((r) => r.left + r.width / 2),
      width: rects[1] ? rects[1].left - rects[0].left : rects[0].width,
    };
  };

  type Drag = NonNullable<typeof drag.current>;
  const targetIndex = (d: Drag, dx: number) => {
    const x = d.centers[d.index] + dx;
    let i = 0;
    while (i < d.centers.length - 1 && x > (d.centers[i] + d.centers[i + 1]) / 2) i++;
    return i;
  };

  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.startX;
    if (!d.dragging) {
      if (Math.abs(dx) < 6) return;
      d.dragging = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      listRef.current?.setAttribute("data-dragging", "");
    }
    // Stop at the ends of the row, with a little stretch past them.
    const min = d.centers[0] - d.centers[d.index];
    const max = d.centers[d.centers.length - 1] - d.centers[d.index];
    const give = (v: number) => Math.sign(v) * Math.min(Math.abs(v), 24) * 0.4;
    const x = dx < min ? min + give(dx - min) : dx > max ? max + give(dx - max) : dx;
    const to = targetIndex(d, x);
    tiles().forEach((el, i) => {
      if (i === d.index) {
        el.style.transform = `translateX(${x}px) scale(1.04)`;
        el.style.zIndex = "2";
        el.setAttribute("data-lifted", "");
        return;
      }
      const shift = d.index < to && i > d.index && i <= to ? -d.width : d.index > to && i < d.index && i >= to ? d.width : 0;
      el.style.transform = shift ? `translateX(${shift}px)` : "";
    });
  };

  const endDrag = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.dragging) return;
    suppressClick.current = true;
    const to = targetIndex(d, e.clientX - d.startX);
    // Note where everything is now, so the reorder can slide from there.
    snapshot();
    tiles().forEach((el) => {
      el.style.transform = "";
      el.style.zIndex = "";
      el.removeAttribute("data-lifted");
    });
    listRef.current?.removeAttribute("data-dragging");
    if (to !== d.index) {
      const next = [...names];
      const [n] = next.splice(d.index, 1);
      next.splice(to, 0, n);
      commit(next);
    } else {
      // Dropped back where it started, so just slide it home.
      const prev = before.current;
      before.current = null;
      tiles().forEach((el) => {
        const was = prev?.get(el.dataset.name!);
        const dx = was ? was.left - el.getBoundingClientRect().left : 0;
        if (Math.abs(dx) > 0.5 && !reducedMotion())
          el.animate([{ transform: `translateX(${dx}px)` }, { transform: "none" }], { duration: 220, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
      });
    }
  };

  const onTileKeyDown = (e: KeyboardEvent, index: number) => {
    if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    e.preventDefault();
    move(index, index + (e.key === "ArrowLeft" ? -1 : 1));
  };

  const pick = (slot: number, name: string) => {
    const next = [...names];
    if (slot < next.length) next[slot] = name;
    else next.push(name);
    commit(next);
    setOpen(null);
  };

  return (
    <ul className="char-slots" ref={listRef} aria-label="Characters">
      {names.map((name, i) => (
        <li
          key={name}
          data-name={name}
          className="char-slot"
          onPointerDown={(e) => onPointerDown(e, i)}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={(e) => {
            if (suppressClick.current) {
              suppressClick.current = false;
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          <PickerPopover
            open={open === i}
            onOpenChange={(o) => setOpen(o ? i : null)}
            trigger={
              <>
                <span className="char-tile">
                  <CharacterFace name={name} art={art[name] ?? builtinArt(name)} size={64} />
                  {i === 0 && names.length > 1 && <span className="char-main">Main</span>}
                </span>
                <span className="char-name">{name}</span>
              </>
            }
            triggerLabel={`${name}${i === 0 && names.length > 1 ? ", main" : ""}. Change, or reorder with Alt + arrow keys`}
            onKeyDown={(e) => onTileKeyDown(e, i)}
            current={name}
            taken={names.filter((n) => n !== name)}
            art={art}
            onPick={(n) => pick(i, n)}
            footer={
              <div className="btn-row">
                {i > 0 && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setOpen(null);
                      move(i, 0);
                    }}
                  >
                    Make main
                  </button>
                )}
                <button
                  type="button"
                  className="btn ghost danger"
                  onClick={() => {
                    setOpen(null);
                    snapshot();
                    commit(names.filter((_, j) => j !== i));
                  }}
                >
                  Remove
                </button>
              </div>
            }
          />
        </li>
      ))}
      {names.length < MAX && (
        <li className="char-slot">
          <PickerPopover
            open={open === names.length}
            onOpenChange={(o) => setOpen(o ? names.length : null)}
            trigger={
              <>
                <span className="char-tile char-add" aria-hidden="true">
                  <PlusIcon />
                </span>
                <span className="char-name">{names.length ? "Add" : "Character"}</span>
              </>
            }
            triggerLabel={names.length ? "Add another character" : "Add a character"}
            taken={names}
            art={art}
            onPick={(n) => pick(names.length, n)}
          />
        </li>
      )}
    </ul>
  );
}

function PickerPopover({
  open,
  onOpenChange,
  trigger,
  triggerLabel,
  onKeyDown,
  ...picker
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  triggerLabel: string;
  onKeyDown?: (e: KeyboardEvent) => void;
} & PickerProps) {
  const search = useRef<HTMLInputElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger className="char-trigger" aria-label={triggerLabel} onKeyDown={onKeyDown}>
        {trigger}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className="positioner" side="bottom" align="start" sideOffset={8} collisionPadding={12}>
          {/* On touch screens, don't open the keyboard over the grid */}
          <Popover.Popup ref={popup} className="popup char-popup" initialFocus={finePointer() ? search : popup}>
            <CharacterPicker {...picker} searchRef={search} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

type PickerProps = {
  current?: string;
  // already on this player
  taken: string[];
  art: ArtLibrary;
  onPick: (name: string) => void;
  footer?: ReactNode;
};

function CharacterPicker({ current, taken, art, onPick, footer, searchRef }: PickerProps & { searchRef: RefObject<HTMLInputElement> }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const gridRef = useRef<HTMLDivElement>(null);

  const options = useMemo(() => {
    const q = normaliseName(query);
    const matches = q
      ? TEKKEN8_ROSTER.filter((n) => normaliseName(n).includes(q)).sort(
          // Names that start with what you typed come first
          (a, b) => Number(!normaliseName(a).startsWith(q)) - Number(!normaliseName(b).startsWith(q)),
        )
      : TEKKEN8_ROSTER;
    const list = matches.map((name) => ({ name, custom: false }));
    // Let people use a name that isn't in the roster yet, like a new DLC character
    const typed = query.trim();
    if (typed && !TEKKEN8_ROSTER.some((n) => normaliseName(n) === q)) list.push({ name: typed, custom: true });
    return list;
  }, [query]);

  const takenSet = new Set(taken);
  const firstFree = (from: number, step: number) => {
    for (let i = from; i >= 0 && i < options.length; i += step) if (!takenSet.has(options[i].name)) return i;
    return -1;
  };

  useLayoutEffect(() => {
    const cur = current ? options.findIndex((o) => o.name === current) : -1;
    setActive(cur >= 0 && !query ? cur : Math.max(0, firstFree(0, 1)));
  }, [options]);

  useLayoutEffect(() => {
    gridRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKeyDown = (e: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLS, ArrowUp: -COLS }[e.key];
    if (step) {
      e.preventDefault();
      const next = firstFree(Math.min(options.length - 1, Math.max(0, active + step)), step > 0 ? 1 : -1);
      if (next >= 0) setActive(next);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = options[active];
      if (o && !takenSet.has(o.name)) onPick(o.name);
    }
  };

  return (
    <div className="char-picker">
      <input
        ref={searchRef}
        className="input"
        type="search"
        placeholder="Search characters"
        aria-label="Search characters"
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={options[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        onKeyDown={onKeyDown}
      />
      <div className="char-grid" id={listId} role="listbox" aria-label="Characters" ref={gridRef}>
        {options.map((o, i) => {
          const isTaken = takenSet.has(o.name);
          return (
            <div
              key={o.custom ? `custom:${o.name}` : o.name}
              id={`${listId}-${i}`}
              data-index={i}
              role="option"
              aria-selected={o.name === current}
              aria-disabled={isTaken || undefined}
              data-active={i === active || undefined}
              className={`char-option${o.custom ? " custom" : ""}`}
              onPointerMove={() => !isTaken && i !== active && setActive(i)}
              onClick={() => !isTaken && onPick(o.name)}
            >
              <span className="char-tile">
                <CharacterFace name={o.name} art={o.custom ? null : (art[o.name] ?? builtinArt(o.name))} size={56} />
              </span>
              <span className="char-name">{o.custom ? `Use “${o.name}”` : o.name}</span>
            </div>
          );
        })}
      </div>
      {footer}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M9 3.5v11M3.5 9h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
