// Bone outline traced from the painted PNG (scripts/trace_bone_outline.py).
// Top and bottom edges are separate, so the model follows the painting exactly
// instead of a symmetric width profile.

export type Edge = [x: number, top: number, bottom: number];

export interface PaintPlacement {
  /** y of the PNG's top edge (model mm); the PNG spans x 0..length */
  y: number;
  height: number;
}

export interface BoneOutline {
  edges: Edge[];
  paint: PaintPlacement;
  /** decorative companion bone (e.g. ulna): drawn, never scored */
  companion?: { edges: Edge[]; paint: PaintPlacement };
}

/** Linearly interpolated [top, bottom] at x (clamped to the ends). */
export function edgeAt(edges: Edge[], x: number): [number, number] {
  if (x <= edges[0][0]) return [edges[0][1], edges[0][2]];
  for (let i = 1; i < edges.length; i++) {
    if (x <= edges[i][0]) {
      const [x0, t0, b0] = edges[i - 1];
      const [x1, t1, b1] = edges[i];
      const u = (x - x0) / (x1 - x0);
      return [t0 + (t1 - t0) * u, b0 + (b1 - b0) * u];
    }
  }
  const l = edges[edges.length - 1];
  return [l[1], l[2]];
}
