import { describe, expect, it } from 'vitest';
import {
  angleDiff,
  apply,
  normalizeDeg,
  screenToModel,
  segmentDistance,
  segmentsIntersect,
  type Matrix,
} from '../src/engine/geometry';
import { TOLERANCES, rate, worst } from '../src/config/tolerances';
import type { ToleranceConfig } from '../src/types';

describe('angles', () => {
  it('normalises into (-180, 180]', () => {
    expect(normalizeDeg(0)).toBe(0);
    expect(normalizeDeg(360)).toBe(0);
    expect(normalizeDeg(180)).toBe(180);
    expect(normalizeDeg(-180)).toBe(180);
    expect(normalizeDeg(181)).toBe(-179);
    expect(normalizeDeg(-361)).toBe(-1);
    expect(normalizeDeg(720 + 45)).toBe(45);
  });

  it('handles the 0/360 boundary in differences', () => {
    expect(angleDiff(359, 1)).toBe(-2);
    expect(angleDiff(1, 359)).toBe(2);
    expect(Math.abs(angleDiff(358, 0))).toBe(2);
    expect(Math.abs(angleDiff(-2, 360))).toBe(2);
  });
});

describe('segments', () => {
  it('measures distance and detects intersection', () => {
    const a = { a: { x: 0, y: -1 }, b: { x: 0, y: 1 } };
    const b = { a: { x: 3, y: -1 }, b: { x: 3, y: 1 } };
    expect(segmentDistance(a, b)).toBeCloseTo(3);
    const c = { a: { x: -1, y: 0 }, b: { x: 1, y: 0 } };
    expect(segmentsIntersect(a, c)).toBe(true);
    expect(segmentDistance(a, c)).toBe(0);
  });

  it('uses the true segment distance for an oblique line, not one coordinate', () => {
    const screw = { a: { x: 10, y: -5 }, b: { x: 10, y: 5 } };
    const oblique = { a: { x: 12, y: -5 }, b: { x: 18, y: 5 } };
    // nearest points: (10,-5) and (12,-5) → 2, though the line centre is 5 away
    expect(segmentDistance(screw, oblique)).toBeCloseTo(2);
  });
});

describe('screen → model conversion', () => {
  it('is independent of zoom and pan', () => {
    const model = { x: 37.5, y: -4.25 };
    for (const zoom of [0.5, 1, 2.75]) {
      const ctm: Matrix = { a: 6 * zoom, b: 0, c: 0, d: 6 * zoom, e: 120 + zoom * 13, f: 80 - zoom * 7 };
      const screen = apply(ctm, model);
      const back = screenToModel(screen, ctm);
      expect(back.x).toBeCloseTo(model.x, 9);
      expect(back.y).toBeCloseTo(model.y, 9);
    }
  });
});

describe('tolerance bands', () => {
  const all = Object.values(TOLERANCES) as ToleranceConfig[];

  it('every config covers the whole real line without gaps or overlaps', () => {
    for (const cfg of all) {
      const b = cfg.bands;
      expect(b[0].min).toBe(Number.NEGATIVE_INFINITY);
      expect(b[b.length - 1].max).toBe(Number.POSITIVE_INFINITY);
      for (let i = 1; i < b.length; i++) {
        expect(b[i].min).toBe(b[i - 1].max);
        // exactly one of the two touching ends is inclusive
        expect(b[i].minInclusive !== b[i - 1].maxInclusive).toBe(true);
      }
      // sample densely: each value matches exactly one band
      for (let x = -20; x <= 120; x += 0.05) {
        const matches = b.filter(
          (bb) => (bb.minInclusive ? x >= bb.min : x > bb.min) && (bb.maxInclusive ? x <= bb.max : x < bb.max),
        );
        expect(matches.length).toBe(1);
      }
    }
  });

  it('angle boundaries follow the tolerance table (5° pass, 2° perfect)', () => {
    expect(rate(TOLERANCES.angle, 2)).toBe('perfect');
    expect(rate(TOLERANCES.angle, 2.0001)).toBe('pass');
    expect(rate(TOLERANCES.angle, 3)).toBe('pass'); // the 3° in 術式表 is overridden
    expect(rate(TOLERANCES.angle, 5)).toBe('pass');
    expect(rate(TOLERANCES.angle, 5.0001)).toBe('fail');
  });

  it('fills the undefined middle bands with 需調整', () => {
    expect(rate(TOLERANCES.displacement, 1.0)).toBe('pass');
    expect(rate(TOLERANCES.displacement, 1.2)).toBe('adjust');
    expect(rate(TOLERANCES.displacement, 1.5)).toBe('adjust');
    expect(rate(TOLERANCES.displacement, 1.51)).toBe('fail');
    expect(rate(TOLERANCES.span, 69.99)).toBe('fail');
    expect(rate(TOLERANCES.span, 70)).toBe('adjust');
    expect(rate(TOLERANCES.span, 75)).toBe('pass');
    expect(rate(TOLERANCES.span, 85)).toBe('perfect');
    expect(rate(TOLERANCES.fractureMargin, 3.99)).toBe('fail');
    expect(rate(TOLERANCES.fractureMargin, 4)).toBe('adjust');
    expect(rate(TOLERANCES.fractureMargin, 5)).toBe('pass');
    expect(rate(TOLERANCES.fractureMargin, 7)).toBe('perfect');
    expect(rate(TOLERANCES.articular, 0)).toBe('fail');
    expect(rate(TOLERANCES.articular, 0.1)).toBe('adjust');
    expect(rate(TOLERANCES.articular, 3)).toBe('pass');
    expect(rate(TOLERANCES.articular, 4)).toBe('perfect');
    expect(rate(TOLERANCES.cortex, 5)).toBe('fail');
    expect(rate(TOLERANCES.cortex, 6)).toBe('pass');
  });

  it('worst() picks the lowest level', () => {
    expect(worst('perfect', 'adjust', 'pass')).toBe('adjust');
    expect(worst('perfect', 'perfect')).toBe('perfect');
    expect(worst('pass', 'fail')).toBe('fail');
  });

  it('matches the numbers parsed from the workbook tolerance sheet', async () => {
    const { rawTolerances } = await import('../src/data');
    const byId = Object.fromEntries(rawTolerances.map((r) => [r.id, r.parsed]));
    expect(byId['TOL-01'].pass[0]).toBe(5);
    expect(byId['TOL-01'].perfect[0]).toBe(2);
    expect(byId['TOL-02'].pass[0]).toBe(1);
    expect(byId['TOL-02'].fail[0]).toBe(1.5);
    expect(byId['TOL-03'].pass[0]).toBe(75);
    expect(byId['TOL-05'].pass[0]).toBe(5);
    expect(byId['TOL-06'].pass[0]).toBe(3);
  });
});
