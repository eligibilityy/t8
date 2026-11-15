import { forwardRef, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** One-column layout; keep in sync with the media query in App.css */
const STACKED_QUERY = "(max-width: 900px), (max-height: 480px)";

/** Fixed-size canvas scaled to fit; the ref is the unscaled node. */
export const ScaledCanvas = forwardRef<HTMLDivElement, { width: number; height: number; children: ReactNode }>(
  function ScaledCanvas({ width, height, children }, ref) {
    const outer = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0.5);

    useLayoutEffect(() => {
      const el = outer.current;
      if (!el) return;
      const update = () => {
        // Side by side the preview must fit under the toolbar; stacked, the page scrolls, so allow most of the screen
        const stacked = window.matchMedia(STACKED_QUERY).matches;
        const maxH = stacked ? window.innerHeight * 0.9 : window.innerHeight - 190;
        setScale(Math.min(el.clientWidth / width, maxH / height, 1));
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

    return (
      <div ref={outer} className="scaled-outer">
        <div className="scaled-frame" style={{ width: width * scale, height: height * scale }}>
          <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
            <div ref={ref}>{children}</div>
          </div>
        </div>
      </div>
    );
  },
);
