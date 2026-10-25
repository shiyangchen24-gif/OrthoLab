import type { FractureModel } from '../../config/fractureCases';
import { fractureSegment, widthAt } from '../../engine/t09';

const f = (n: number) => n.toFixed(2);

function edge(m: FractureModel, x0: number, x1: number, sign: 1 | -1, scale: number, step = 1): string[] {
  const pts: string[] = [];
  const dir = x1 >= x0 ? 1 : -1;
  for (let x = x0; dir > 0 ? x < x1 : x > x1; x += step * dir) pts.push(`${f(x)} ${f((sign * widthAt(m, x) * scale) / 2)}`);
  pts.push(`${f(x1)} ${f((sign * widthAt(m, x1) * scale) / 2)}`);
  return pts;
}

/** Proximal piece outline in local (target) coordinates. */
export function proximalPath(m: FractureModel, scale = 1): string {
  const fs = fractureSegment(m);
  const k = scale;
  const top = edge(m, 0, fs.a.x, -1, k);
  const bot = edge(m, fs.b.x, 0, 1, k);
  const w0 = widthAt(m, 0) * k;
  return `M${top.join(' L')} L${f(fs.b.x)} ${f((fs.b.y * k))} L${bot.join(' L')} Q${f(-w0 * 0.45)} 0 0 ${f(-w0 / 2)} Z`;
}

/** Distal piece outline in local (target) coordinates. */
export function distalPath(m: FractureModel, scale = 1): string {
  const fs = fractureSegment(m);
  const k = scale;
  const L = m.length;
  const top = edge(m, fs.a.x, L, -1, k);
  const bot = edge(m, L, fs.b.x, 1, k);
  const wL = widthAt(m, L) * k;
  return `M${top.join(' L')} Q${f(L + wL * 0.4)} 0 ${bot[0]} L${bot.slice(1).join(' L')} L${f(fs.a.x)} ${f(fs.a.y * k)} Z`;
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
    const y = (sign * widthAt(m, Math.min(Math.max(x, 0), m.length))) / 2;
    inner.push(`${f(x)} ${f(y + sign * 0.05)}`);
    outer.push(`${f(x)} ${f(y + sign * (thickness + 0.05))}`);
  }
  return `M${inner.join(' L')} L${outer.reverse().join(' L')} Z`;
}
