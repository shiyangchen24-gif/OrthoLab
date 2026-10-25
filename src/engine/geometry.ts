// Pure 2D geometry in model coordinates (millimetres of the teaching model).
// Nothing here knows about screen pixels; see screenToModel for the bridge.

export interface Vec {
  x: number;
  y: number;
}
export interface Segment {
  a: Vec;
  b: Vec;
}

export const v = (x: number, y: number): Vec => ({ x, y });
export const add = (p: Vec, q: Vec): Vec => ({ x: p.x + q.x, y: p.y + q.y });
export const sub = (p: Vec, q: Vec): Vec => ({ x: p.x - q.x, y: p.y - q.y });
export const dot = (p: Vec, q: Vec) => p.x * q.x + p.y * q.y;
export const cross = (p: Vec, q: Vec) => p.x * q.y - p.y * q.x;
export const len = (p: Vec) => Math.hypot(p.x, p.y);

export const deg2rad = (d: number) => (d * Math.PI) / 180;
export const rad2deg = (r: number) => (r * 180) / Math.PI;

/** Normalise any angle to the half-open interval (-180, 180]. */
export function normalizeDeg(a: number): number {
  let r = a % 360;
  if (r <= -180) r += 360;
  if (r > 180) r -= 360;
  // avoid -0
  return r === 0 ? 0 : r;
}

/** Smallest signed difference a - b, handling the 0/360 boundary. */
export const angleDiff = (a: number, b: number) => normalizeDeg(a - b);

export function rotate(p: Vec, deg: number, about: Vec = v(0, 0)): Vec {
  const r = deg2rad(deg);
  const c = Math.cos(r);
  const s = Math.sin(r);
  const d = sub(p, about);
  return { x: about.x + d.x * c - d.y * s, y: about.y + d.x * s + d.y * c };
}

export function pointSegmentDistance(p: Vec, s: Segment): number {
  const ab = sub(s.b, s.a);
  const l2 = dot(ab, ab);
  if (l2 === 0) return len(sub(p, s.a));
  const t = Math.max(0, Math.min(1, dot(sub(p, s.a), ab) / l2));
  return len(sub(p, add(s.a, { x: ab.x * t, y: ab.y * t })));
}

export function segmentsIntersect(s1: Segment, s2: Segment): boolean {
  const d1 = cross(sub(s2.b, s2.a), sub(s1.a, s2.a));
  const d2 = cross(sub(s2.b, s2.a), sub(s1.b, s2.a));
  const d3 = cross(sub(s1.b, s1.a), sub(s2.a, s1.a));
  const d4 = cross(sub(s1.b, s1.a), sub(s2.b, s1.a));
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  const eps = 1e-12;
  const onSeg = (p: Vec, s: Segment) =>
    pointSegmentDistance(p, s) < eps;
  return onSeg(s1.a, s2) || onSeg(s1.b, s2) || onSeg(s2.a, s1) || onSeg(s2.b, s1);
}

/** Minimum distance between two segments (0 when they intersect). */
export function segmentDistance(s1: Segment, s2: Segment): number {
  if (segmentsIntersect(s1, s2)) return 0;
  return Math.min(
    pointSegmentDistance(s1.a, s2),
    pointSegmentDistance(s1.b, s2),
    pointSegmentDistance(s2.a, s1),
    pointSegmentDistance(s2.b, s1),
  );
}

/** Which side of the directed line through seg a→b point p lies on (+1 / -1 / 0). */
export const sideOf = (p: Vec, s: Segment) => Math.sign(cross(sub(s.b, s.a), sub(p, s.a)));

/** 1D interval overlap length. */
export const overlap1D = (a0: number, a1: number, b0: number, b1: number) =>
  Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/**
 * Affine 2D matrix as used by SVG getScreenCTM(): screen = M · model.
 * [a c e]
 * [b d f]
 */
export interface Matrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export function invert(m: Matrix): Matrix {
  const det = m.a * m.d - m.b * m.c;
  if (det === 0) throw new Error('singular matrix');
  return {
    a: m.d / det,
    b: -m.b / det,
    c: -m.c / det,
    d: m.a / det,
    e: (m.c * m.f - m.d * m.e) / det,
    f: (m.b * m.e - m.a * m.f) / det,
  };
}

export const apply = (m: Matrix, p: Vec): Vec => ({ x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f });

/** Convert a screen (client) point into model coordinates given the element's screen CTM. */
export const screenToModel = (screen: Vec, ctm: Matrix): Vec => apply(invert(ctm), screen);

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const round = (x: number, step = 0.1) => Math.round(x / step) * step;
