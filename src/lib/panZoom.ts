// Zoom and pan maths for the preview. Everything here is in frame pixels.

// z is the zoom compared to fitting the whole graphic, and x and y are where its top-left corner sits
export type View = { z: number; x: number; y: number };

export type Box = {
  width: number;
  height: number;
  frameW: number;
  frameH: number;
  fit: number;
  maxZ: number;
};

export const FIT: View = { z: 1, x: 0, y: 0 };

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

export function zoomAt(b: Box, v: View, z: number, px: number, py: number): View {
  const next = clampZ(b, z);
  const k = next / v.z;
  return clampView(b, { z: next, x: px - (px - v.x) * k, y: py - (py - v.y) * k });
}

// Past an edge the graphic follows less and less, like Apple's rubber banding
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

export function softPan(value: number, min: number, max: number, dimension: number): number {
  if (value > max) return max + rubberband(value - max, dimension);
  if (value < min) return min - rubberband(min - value, dimension);
  return value;
}

// Where a flick comes to rest, using the same slowdown as scrolling
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}
