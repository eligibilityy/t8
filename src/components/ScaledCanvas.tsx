import { forwardRef, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Fixed-size canvas scaled to fit; the ref is the unscaled node. */
export const ScaledCanvas = forwardRef<HTMLDivElement, { width: number; height: number; children: ReactNode }>(
  function ScaledCanvas({ width, height, children }, ref) {
    const outer = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0.5);

    useLayoutEffect(() => {
      const el = outer.current;
      if (!el) return;
      const update = () => {
        const maxH = window.innerHeight - 190;
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
