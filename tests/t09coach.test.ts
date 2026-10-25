import { describe, expect, it } from 'vitest';
import { coachT09, suggestPlateShift } from '../src/engine/t09Coach';
import { checkStep, getModel, initialT09, moveFragment, movePlate, plateMetrics, reductionMetrics, rotateFragment, type T09State } from '../src/engine/t09';
import { apply, screenToModel, type Matrix } from '../src/engine/geometry';

describe('T09 coaching', () => {
  it('tells the player which way to rotate, and that direction reduces the error', () => {
    const m = getModel('C07');
    const s = initialT09('C07'); // θ = +14° in the Lat view
    const c = coachT09(m, s);
    expect(c.ready).toBe(false);
    const angleFix = c.fixes.find((f) => f.includes('成角'))!;
    expect(angleFix).toContain('逆時針');
    // counter-clockwise = negative delta in model space
    expect(reductionMetrics(rotateFragment(s, -1)).perView.primary.angle).toBeLessThan(reductionMetrics(s).perView.primary.angle);
    const neg = { ...s, views: { ...s.views, primary: { dy: 0, theta: -8 } } };
    expect(coachT09(m, neg).fixes.find((f) => f.includes('成角'))).toContain('順時針');
  });

  it('describes shortening vs separation and vertical offset with a fix', () => {
    const m = getModel('C08');
    const s = initialT09('C08'); // dx −12, dy +3
    const fixes = coachT09(m, s).fixes.join('\n');
    expect(fixes).toContain('重疊短縮');
    expect(fixes).toContain('向右拖曳');
    expect(fixes).toContain('偏下');
    const sep = coachT09(m, { ...s, dx: 4 }).fixes.join('\n');
    expect(sep).toContain('分離');
  });

  it('points to the other view once the active view is reduced', () => {
    const m = getModel('C07');
    let s = initialT09('C07');
    s = rotateFragment(s, -14);
    s = moveFragment(s, { x: 3, y: -1.2 });
    const c = coachT09(m, s);
    expect(c.ready).toBe(false);
    expect(c.fixes[0]).toContain('切換視角');
  });

  it('suggests a plate shift that makes the plate step pass', () => {
    const m = getModel('C08');
    let s: T09State = { ...initialT09('C08'), dx: 0, views: { primary: { dy: 0, theta: 0 }, secondary: { dy: 0, theta: 0 } }, step: 3 };
    s = { ...s, plate: { plateId: 'c08-p12', x: 0, side: 'tension' } };
    expect(plateMetrics(m, s).passed).toBe(false);
    const d = suggestPlateShift(m, s)!;
    expect(d).not.toBeNull();
    expect(plateMetrics(m, movePlate(m, s, s.plate.x + d, 'tension')).passed).toBe(true);
    expect(coachT09(m, s).fixes.join('\n')).toMatch(/往(近端|遠端).*移動約/);
  });

  it('every message is a sentence with a fix, never just 錯誤／失敗', () => {
    const m = getModel('C07');
    for (const step of [1, 2, 3, 4, 5] as const) {
      const c = coachT09(m, { ...initialT09('C07'), step });
      expect(c.doNow.length).toBeGreaterThan(5);
      for (const f of c.fixes) expect(f).not.toMatch(/^(錯誤|失敗)$/);
    }
  });
});

describe('drag and button nudges are equivalent at any zoom', () => {
  it('a 0.5 mm drag equals one ▶ 0.5 button press', () => {
    const button = moveFragment(initialT09('C07'), { x: 0.5, y: 0 });
    for (const zoom of [1, 1.5, 2]) {
      const ctm: Matrix = { a: 7 * zoom, b: 0, c: 0, d: 7 * zoom, e: 31, f: 12 };
      const a = screenToModel(apply(ctm, { x: 60, y: 1 }), ctm);
      const b = screenToModel(apply(ctm, { x: 60.5, y: 1 }), ctm);
      const dragged = moveFragment(initialT09('C07'), { x: b.x - a.x, y: b.y - a.y });
      expect(dragged.dx).toBeCloseTo(button.dx, 9);
      expect(dragged.views.primary.dy).toBeCloseTo(button.views.primary.dy, 9);
    }
  });

  it('the coach turns ready exactly when the step check passes', () => {
    const m = getModel('C07');
    let s = initialT09('C07');
    for (const v of ['primary', 'secondary'] as const) {
      s = { ...s, activeView: v };
      s = rotateFragment(s, -s.views[v].theta);
      s = moveFragment(s, { x: -s.dx, y: -s.views[v].dy });
    }
    expect(coachT09(m, s).ready).toBe(true);
    expect(checkStep(m, s).passed).toBe(true);
  });
});
