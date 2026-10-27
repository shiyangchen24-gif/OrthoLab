import type { FractureModel } from '../../config/fractureCases';
import { bottomAt, fractureSegment, topAt } from '../../engine/t09';

const f = (n: number) => n.toFixed(2);

/** y of the top (sign -1) or bottom (sign 1) edge, pulled toward the centre line by `scale` (canal hint). */
function edgeY(m: FractureModel, x: number, sign: 1 | -1, scale: number): number {
  const t = topAt(m, x);
  const b = bottomAt(m, x);
  const c = (t + b) / 2;
  return c + ((sign < 0 ? t : b) - c) * scale;
}

function edge(m: FractureModel, x0: number, x1: number, sign: 1 | -1, scale: number, step = 1): string[] {
  const pts: string[] = [];
  const dir = x1 >= x0 ? 1 : -1;
  for (let x = x0; dir > 0 ? x < x1 : x > x1; x += step * dir) pts.push(`${f(x)} ${f(edgeY(m, x, sign, scale))}`);
  pts.push(`${f(x1)} ${f(edgeY(m, x1, sign, scale))}`);
  return pts;
}

/** Proximal piece outline in local (target) coordinates. */
export function proximalPath(m: FractureModel, scale = 1): string {
  const fs = fractureSegment(m);
  const k = scale;
  const top = edge(m, 0, fs.a.x, -1, k);
  const bot = edge(m, fs.b.x, 0, 1, k);
  // rounded proximal end: control point just outside x = 0 at the end's mid-height
  const t0 = edgeY(m, 0, -1, k);
  const b0 = edgeY(m, 0, 1, k);
  return `M${top.join(' L')} L${f(fs.b.x)} ${f(fs.b.y * k)} L${bot.join(' L')} Q${f(-(b0 - t0) * 0.45)} ${f((t0 + b0) / 2)} 0 ${f(t0)} Z`;
}

/** Distal piece outline in local (target) coordinates. */
export function distalPath(m: FractureModel, scale = 1): string {
  const fs = fractureSegment(m);
  const k = scale;
  const L = m.length;
  const top = edge(m, fs.a.x, L, -1, k);
  const bot = edge(m, L, fs.b.x, 1, k);
  const tL = edgeY(m, L, -1, k);
  const bL = edgeY(m, L, 1, k);
  return `M${top.join(' L')} Q${f(L + (bL - tL) * 0.4)} ${f((tL + bL) / 2)} ${bot[0]} L${bot.slice(1).join(' L')} L${f(fs.a.x)} ${f(fs.a.y * k)} Z`;
}

/** Medullary canal hint (inner path) clipped to one piece. */
export function canalPath(m: FractureModel, piece: 'proximal' | 'distal'): string {
  const fs = fractureSegment(m);
  const k = 0.42;
  const [a, b] = piece === 'proximal' ? [8, Math.min(fs.a.x, fs.b.x) - 0.8] : [Math.max(fs.a.x, fs.b.x) + 0.8, m.length - 8];
  if (b <= a) return '';
  const top = edge(m, a, b, -1, k);
  const bot = edge(m, b, a, 1, k);
  return `M${top.join(' L')} L${bot.join(' L')} Z`;
}

/** Plate in profile, following the top (tension-side) surface. */
export function plateProfilePath(m: FractureModel, x0: number, len: number, thickness: number, side: 'top' | 'bottom' = 'top'): string {
  const sign = side === 'top' ? -1 : 1;
  const outer: string[] = [];
  const inner: string[] = [];
  const n = Math.max(2, Math.ceil(len));
  for (let i = 0; i <= n; i++) {
    const x = x0 + (len * i) / n;
    const xc = Math.min(Math.max(x, 0), m.length);
    const y = sign < 0 ? topAt(m, xc) : bottomAt(m, xc);
    inner.push(`${f(x)} ${f(y + sign * 0.05)}`);
    outer.push(`${f(x)} ${f(y + sign * (thickness + 0.05))}`);
  }
  return `M${inner.join(' L')} L${outer.reverse().join(' L')} Z`;
}
