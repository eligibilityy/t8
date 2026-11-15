import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { FIT, clampView, project, softPan, bounds, zoomAt, type Box, type View } from "../lib/panZoom";

// Has to match the one-column media query in App.css.
const STACKED_QUERY = "(max-width: 900px), (max-height: 480px)";
// Zoom stops at twice the graphic's actual size.
const MAX_REAL = 2;
const STEP = 1.5;
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const BORDER = 2;

type Point = { x: number; y: number };
type Gesture =
  | { kind: "pan"; start: Point; from: View; moved: boolean; samples: Array<Point & { t: number }> }
  | { kind: "pinch"; dist: number; mid: Point; from: View }
  | null;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMac = () => /Mac|iPhone|iPad/.test(navigator.userAgent);

function zoomHint() {
  if (window.matchMedia("(pointer: coarse)").matches) return "Pinch to zoom · double-tap for a close-up";
  return `${isMac() ? "Pinch or ⌘ + scroll" : "Ctrl + scroll"} to zoom · double-click for a close-up`;
}

// The ref points at the unscaled graphic, which is what gets exported.
export const ScaledCanvas = forwardRef<HTMLDivElement, { width: number; height: number; children: ReactNode }>(
  function ScaledCanvas({ width, height, children }, ref) {
    const outer = useRef<HTMLDivElement>(null);
    const frame = useRef<HTMLDivElement>(null);
    const controls = useRef<HTMLDivElement>(null);
    const content = useRef<HTMLDivElement>(null);
    const [fit, setFit] = useState(0.5);
    const [zoom, setZoom] = useState(1);
    const view = useRef<View>(FIT);
    const pointers = useRef(new Map<number, Point>());
    const gesture = useRef<Gesture>(null);
    const lastTap = useRef<(Point & { t: number }) | null>(null);
    const [hint] = useState(zoomHint);

    useLayoutEffect(() => {
      const el = outer.current;
      if (!el) return;
      const update = () => {
        // In one column the page scrolls, so most of the screen is fine. Side by side, fill the space
        // under the toolbar and leave room for the zoom row.
        let maxH = window.innerHeight * 0.9;
        if (!window.matchMedia(STACKED_QUERY).matches) {
          const stage = el.closest<HTMLElement>(".stage");
          const top = el.getBoundingClientRect().top + (stage?.scrollTop ?? 0);
          const padBottom = stage ? parseFloat(getComputedStyle(stage).paddingBottom) : 24;
          const row = controls.current;
          const rowH = row ? row.offsetHeight + parseFloat(getComputedStyle(row).marginTop) : 46;
          maxH = window.innerHeight - top - rowH - padBottom;
        }
        setFit(Math.max(0.05, Math.min((el.clientWidth - BORDER) / width, (maxH - BORDER) / height, 1)));
      };
      update();
      const ro = new ResizeObserver(update);
      ro.observe(el);
      window.addEventListener("resize", update);
      return () => {
        ro.disconnect();
        window.removeEventListener("resize", update);
      };
    }, [width, height]);

    const box = useCallback((): Box => {
      const f = frame.current;
      return {
        width,
        height,
        frameW: f?.clientWidth ?? width * fit,
        frameH: f?.clientHeight ?? height * fit,
        fit,
        maxZ: Math.max(1, MAX_REAL / fit),
      };
    }, [width, height, fit]);

    // Gestures pass no duration so the graphic sticks to your fingers. Buttons animate.
    const apply = useCallback(
      (v: View, ms = 0) => {
        view.current = v;
        const el = content.current;
        if (!el) return;
        const duration = reducedMotion() ? 0 : ms;
        el.style.transition = duration ? `transform ${duration}ms ${EASE_OUT}` : "none";
        el.style.transform = `translate(${v.x}px, ${v.y}px) scale(${fit * v.z})`;
        setZoom(v.z);
      },
      [fit],
    );

    useLayoutEffect(() => apply(FIT), [apply, width, height]);

    // Stop a glide where it is, so grabbing it mid-glide doesn't make it jump.
    const grabPresentation = () => {
      const el = content.current;
      if (!el || el.style.transition === "none") return;
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      apply({ z: m.a / fit, x: m.e, y: m.f });
    };

    const local = (e: { clientX: number; clientY: number }): Point => {
      const f = frame.current!;
      const r = f.getBoundingClientRect();
      return { x: e.clientX - r.left - f.clientLeft, y: e.clientY - r.top - f.clientTop };
    };
    const center = (): Point => {
      const b = box();
      return { x: b.frameW / 2, y: b.frameH / 2 };
    };

    const zoomBy = (factor: number, at: Point, ms = 0) => apply(zoomAt(box(), view.current, view.current.z * factor, at.x, at.y), ms);
    const toFit = (ms = 0) => apply(FIT, ms);
    // Double-tap goes to actual size (or 2x if that's barely bigger), and back out again.
    const toggleAt = (at: Point) => {
      if (view.current.z > 1.01) return toFit(320);
      const target = Math.max(2, 1 / fit);
      apply(zoomAt(box(), view.current, target, at.x, at.y), 320);
    };

    // Ctrl or ⌘ + scroll (and trackpad pinch) zooms at the cursor. Plain scrolling pans once zoomed in.
    useEffect(() => {
      const f = frame.current;
      if (!f) return;
      const onWheel = (e: WheelEvent) => {
        const scale = e.deltaMode === 1 ? 16 : 1;
        const v = view.current;
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          grabPresentation();
          const d = Math.max(-60, Math.min(60, e.deltaY * scale));
          zoomBy(Math.exp(-d * 0.01), local(e));
          return;
        }
        if (v.z <= 1) return;
        const next = clampView(box(), { ...v, x: v.x - e.deltaX * scale, y: v.y - e.deltaY * scale });
        // At an edge, let the page scroll instead
        if (next.x === v.x && next.y === v.y) return;
        e.preventDefault();
        apply(next);
      };
      f.addEventListener("wheel", onWheel, { passive: false });
      return () => f.removeEventListener("wheel", onWheel);
    });

    const startPinch = () => {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        kind: "pinch",
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        from: view.current,
      };
    };
    const startPan = (p: Point) => {
      gesture.current = { kind: "pan", start: p, from: view.current, moved: false, samples: [{ ...p, t: performance.now() }] };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest(".zoom-controls")) return;
      grabPresentation();
      const p = local(e);
      pointers.current.set(e.pointerId, p);
      if (pointers.current.size === 2) startPinch();
      else if (pointers.current.size === 1) {
        startPan(p);
        if (view.current.z > 1) frame.current?.setPointerCapture(e.pointerId);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      const p = local(e);
      pointers.current.set(e.pointerId, p);
      const g = gesture.current;
      if (!g) return;
      const b = box();

      if (g.kind === "pinch" && pointers.current.size >= 2) {
        const [p1, p2] = [...pointers.current.values()];
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        // Keep whatever was under your fingers under them as they move
        const z = g.from.z * (dist / g.dist);
        const anchored = zoomAt(b, g.from, z, g.mid.x, g.mid.y);
        apply(clampView(b, { ...anchored, x: anchored.x + mid.x - g.mid.x, y: anchored.y + mid.y - g.mid.y }));
        return;
      }

      if (g.kind === "pan") {
        const dx = p.x - g.start.x;
        const dy = p.y - g.start.y;
        if (!g.moved && Math.hypot(dx, dy) > 6) g.moved = true;
        if (!g.moved || g.from.z <= 1) return;
        frame.current?.setAttribute("data-dragging", "");
        const { minX, minY } = bounds(b, g.from.z);
        apply({
          z: g.from.z,
          x: softPan(g.from.x + dx, minX, 0, b.frameW),
          y: softPan(g.from.y + dy, minY, 0, b.frameH),
        });
        const now = performance.now();
        g.samples.push({ ...p, t: now });
        while (g.samples.length > 2 && now - g.samples[0].t > 100) g.samples.shift();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      const p = local(e);
      pointers.current.delete(e.pointerId);
      const g = gesture.current;
      frame.current?.removeAttribute("data-dragging");

      if (g?.kind === "pinch") {
        // One finger lifted, so keep panning with the other
        const rest = [...pointers.current.values()];
        if (rest.length === 1) startPan(rest[0]);
        else gesture.current = null;
        return;
      }
      gesture.current = null;
      if (g?.kind !== "pan" || e.type === "pointercancel") return;

      if (!g.moved) {
        // Two quick taps in the same spot toggle zoom
        const now = performance.now();
        const prev = lastTap.current;
        if (prev && now - prev.t < 320 && Math.hypot(p.x - prev.x, p.y - prev.y) < 24) {
          lastTap.current = null;
          toggleAt(p);
        } else lastTap.current = { ...p, t: now };
        return;
      }
      if (g.from.z <= 1) return;

      // Let a quick drag glide on, then settle inside the edges
      const first = g.samples[0];
      const last = g.samples[g.samples.length - 1];
      const dt = Math.max(1, last.t - first.t);
      const vx = ((last.x - first.x) / dt) * 1000;
      const vy = ((last.y - first.y) / dt) * 1000;
      const v = view.current;
      const target = clampView(box(), { z: v.z, x: v.x + project(vx), y: v.y + project(vy) });
      const speed = Math.hypot(vx, vy);
      apply(target, speed > 200 ? 520 : 280);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const v = view.current;
      const pan = (dx: number, dy: number) => apply(clampView(box(), { ...v, x: v.x + dx, y: v.y + dy }));
      const keys: Record<string, () => void> = {
        "+": () => zoomBy(STEP, center()),
        "=": () => zoomBy(STEP, center()),
        "-": () => zoomBy(1 / STEP, center()),
        "0": () => toFit(),
        ArrowLeft: () => pan(60, 0),
        ArrowRight: () => pan(-60, 0),
        ArrowUp: () => pan(0, 60),
        ArrowDown: () => pan(0, -60),
      };
      const run = keys[e.key];
      if (!run || (e.key.startsWith("Arrow") && v.z <= 1)) return;
      e.preventDefault();
      run();
    };

    const maxZ = Math.max(1, MAX_REAL / fit);
    const percent = Math.round(fit * zoom * 100);
    const zoomed = zoom > 1.001;

    return (
      <div ref={outer} className="scaled-outer">
        <div
          ref={frame}
          className="scaled-frame"
          style={{ width: width * fit + BORDER, height: height * fit + BORDER }}
          data-zoomed={zoomed || undefined}
          tabIndex={0}
          role="group"
          aria-label={`Preview at ${percent}%. Plus and minus zoom, 0 fits, arrow keys move.`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
        >
          <div ref={content} className="scaled-content" style={{ width, height }}>
            <div ref={ref}>{children}</div>
          </div>
        </div>

        <div ref={controls} className="zoom-controls" style={{ width: width * fit + BORDER }}>
          <span className="hint">{hint}</span>
          <div className="zoom-pill" role="group" aria-label="Zoom">
            <button type="button" aria-label="Zoom out" disabled={!zoomed} onClick={() => zoomBy(1 / STEP, center(), 260)}>
              −
            </button>
            <button
              type="button"
              className="zoom-level"
              aria-label={zoomed ? `${percent}%, fit to frame` : `${percent}%, whole graphic`}
              title={zoomed ? "Fit to frame" : undefined}
              onClick={() => toFit(320)}
            >
              {percent}%
            </button>
            <button type="button" aria-label="Zoom in" disabled={zoom >= maxZ - 0.001} onClick={() => zoomBy(STEP, center(), 260)}>
              +
            </button>
          </div>
        </div>
      </div>
    );
  },
);
