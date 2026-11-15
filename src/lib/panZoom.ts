// Pure maths for zooming and panning the preview. Coordinates are frame pixels.

/** z: zoom relative to "fit" (1 = whole graphic visible); x/y: offset of the graphic's top-left corner */
export type View = { z: number; x: number; y: number };

export type Box = {
  /** Graphic size in canvas px */
  width: number;
  height: number;
  /** Visible frame size in screen px */
  frameW: number;
  frameH: number;
  /** Scale that fits the graphic in the frame */
  fit: number;
  /** Highest zoom, relative to fit */
  maxZ: number;
};

export const FIT: View = { z: 1, x: 0, y: 0 };

/** Allowed x/y range at zoom z: the graphic always covers the frame */
export function bounds(b: Box, z: number) {
  const s = b.fit * z;
  return { minX: Math.min(0, b.frameW - b.width * s), minY: Math.min(0, b.frameH - b.height * s) };
}

export const clampZ = (b: Box, z: number) => Math.min(Math.max(z, 1), b.maxZ);

export function clampView(b: Box, v: View): View {
  const z = clampZ(b, v.z);
  const { minX, minY } = bounds(b, z);
  return { z, x: Math.min(0, Math.max(minX, v.x)), y: Math.min(0, Math.max(minY, v.y)) };
}

/** Zoom to `z` keeping the point (px, py) of the frame over the same spot of the graphic */
export function zoomAt(b: Box, v: View, z: number, px: number, py: number): View {
  const next = clampZ(b, z);
  const k = next / v.z;
  return clampView(b, { z: next, x: px - (px - v.x) * k, y: py - (py - v.y) * k });
}

/** Past an edge, the graphic follows less and less (Apple's rubber band) */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Soft-clamp a pan position: inside the range it's 1:1, outside it resists */
export function softPan(value: number, min: number, max: number, dimension: number): number {
  if (value > max) return max + rubberband(value - max, dimension);
  if (value < min) return min - rubberband(min - value, dimension);
  return value;
}

/** Where a flick comes to rest, from its release velocity in px/s (scroll-style deceleration) */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}
