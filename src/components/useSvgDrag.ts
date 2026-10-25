import { useRef, type PointerEvent, type RefObject } from 'react';
import { screenToModel, type Vec } from '../engine/geometry';

/**
 * Pointer (mouse / touch / pen) dragging in SVG model coordinates.
 * Screen points are converted with the element's live CTM, so zoom and
 * container size never change model results.
 */
export function useSvgDrag(svgRef: RefObject<SVGSVGElement | null>) {
  const active = useRef<null | { id: string; onMove: (p: Vec) => void; onEnd?: () => void }>(null);

  const toModel = (e: { clientX: number; clientY: number }): Vec | null => {
    const ctm = svgRef.current?.getScreenCTM();
    return ctm ? screenToModel({ x: e.clientX, y: e.clientY }, ctm) : null;
  };

  const start = (id: string, onMove: (p: Vec) => void, onEnd?: () => void) => (e: PointerEvent) => {
    e.preventDefault();
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
    active.current = { id, onMove, onEnd };
    const p = toModel(e);
    if (p) onMove(p);
  };

  const handlers = {
    onPointerMove: (e: PointerEvent) => {
      if (!active.current) return;
      const p = toModel(e);
      if (p) active.current.onMove(p);
    },
    onPointerUp: () => {
      active.current?.onEnd?.();
      active.current = null;
    },
    onPointerCancel: () => {
      active.current?.onEnd?.();
      active.current = null;
    },
  };

  return { start, handlers, dragging: () => active.current?.id ?? null };
}
