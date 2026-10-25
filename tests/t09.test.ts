import { describe, expect, it } from 'vitest';
import { FRACTURE_MODELS, plateLength } from '../src/config/fractureCases';
import {
  checkStep,
  drill,
  evaluateHole,
  fixationMetrics,
  fractureSegment,
  getModel,
  initialT09,
  lockScrew,
  moveFragment,
  movePlate,
  plateMetrics,
  reductionMetrics,
  rotateFragment,
  scoreT09,
  selectHole,
  trySnap,
  widthAt,
  FINAL_CHECKS,
  type T09State,
} from '../src/engine/t09';
import { apply, screenToModel, type Matrix } from '../src/engine/geometry';

const PRESET_PLATE_X: Record<string, number> = { C07: 9.5, C08: 7.5 };

function reduce(s: T09State): T09State {
  let st = s;
  for (const v of ['primary', 'secondary'] as const) {
    st = { ...st, activeView: v };
    st = rotateFragment(st, -st.views[v].theta);
    st = moveFragment(st, { x: -st.dx, y: -st.views[v].dy });
  }
  return { ...st, activeView: 'primary' };
}

function solve(caseId: string): T09State {
  const m = getModel(caseId);
  let s = reduce(initialT09(caseId));
  s = checkStep(m, s).state; // → 2
  s = { ...s, clamp: { ...s.clamp, proximal: 'px-bot', distal: 'ds-bot' } };
  s = checkStep(m, s).state; // → 3
  const preset = m.plates.find((p) => p.isPreset)!;
  s = { ...s, plate: { ...s.plate, plateId: preset.id } };
  s = movePlate(m, s, PRESET_PLATE_X[caseId], 'tension');
  s = checkStep(m, s).state; // → 4
  for (const i of preset.presetHoles) {
    s = selectHole(s, i);
    s = drill(m, s).state;
    const gauge = s.holes[i].gauge;
    const len = m.screwLengths.find((l) => l >= gauge && l <= gauge + 2)!;
    s = lockScrew(s, len);
  }
  s = checkStep(m, s).state; // → 5
  s = { ...s, viewsSeen: { primary: true, secondary: true }, confirmed: FINAL_CHECKS.map((c) => c.id) };
  return checkStep(m, s).state;
}

describe('C07 and C08 have different fracture configurations', () => {
  it('differs in bone, side, fracture type and plate', () => {
    const a = FRACTURE_MODELS.C07;
    const b = FRACTURE_MODELS.C08;
    expect(a.sideLabel).toBe('L');
    expect(b.sideLabel).toBe('R');
    expect(a.fracture.obliquityDeg).toBe(0);
    expect(b.fracture.obliquityDeg).toBeGreaterThan(0);
    expect(a.length).not.toBe(b.length);
    expect(a.initial.dx).toBe(-3); // 3 mm overlap (C07-E3)
    expect(b.initial.dx).toBe(-12); // 12 mm overlap (C08-E3)
    expect(b.initial.views.primary.theta).toBe(15); // 15° (C08-E3)
    expect(a.plates.find((p) => p.isPreset)!.id).not.toBe(b.plates.find((p) => p.isPreset)!.id);
  });

  it('the C08 short-oblique line is shorter than 2× bone diameter (A34 condition not met)', () => {
    const m = FRACTURE_MODELS.C08;
    const fs = fractureSegment(m);
    const lineLen = Math.hypot(fs.b.x - fs.a.x, fs.b.y - fs.a.y);
    expect(lineLen).toBeLessThan(2 * widthAt(m, m.fracture.x));
  });
});

describe('reduction', () => {
  it('initial pose fails; computes angle, axial and transverse separately', () => {
    const r = reductionMetrics(initialT09('C07'));
    expect(r.passed).toBe(false);
    expect(r.axial).toBe(3);
    expect(r.perView.primary.angle).toBe(14);
    expect(r.perView.secondary.angle).toBe(11);
    expect(r.perView.primary.transverse).toBeCloseTo(1.2);
  });

  it('angle error wraps across 0/360', () => {
    let s = reduce(initialT09('C07'));
    s = rotateFragment(s, 358); // = −2°
    expect(reductionMetrics(s).perView.primary.angle).toBeCloseTo(2);
    expect(reductionMetrics(s).perView.primary.angleLevel).toBe('perfect');
  });

  it('requires both orthogonal views to be reduced', () => {
    let s = initialT09('C08');
    s = rotateFragment(s, -s.views.primary.theta);
    s = moveFragment(s, { x: -s.dx, y: -s.views.primary.dy });
    expect(reductionMetrics(s).perView.primary.angleLevel).toBe('perfect');
    expect(reductionMetrics(s).passed).toBe(false); // secondary view still translated 1.5 mm
  });

  it('snap only triggers near target and records usage', () => {
    let s = initialT09('C07');
    expect(trySnap(s, true)).toBe(s);
    s = reduce(s);
    s = moveFragment(s, { x: 0.2, y: 0.2 });
    const snapped = trySnap(s, true);
    expect(snapped.dx).toBe(0);
    expect(snapped.snapUsed).toBe(true);
    expect(trySnap(s, false)).toBe(s);
  });

  it('a drag at any zoom gives the same model result', () => {
    const results = [0.5, 1, 3].map((zoom) => {
      const ctm: Matrix = { a: 5 * zoom, b: 0, c: 0, d: 5 * zoom, e: 40, f: 90 };
      const from = apply(ctm, { x: 50, y: 0 });
      const to = apply(ctm, { x: 53, y: -1.2 });
      const d0 = screenToModel(from, ctm);
      const d1 = screenToModel(to, ctm);
      const s = moveFragment(initialT09('C07'), { x: d1.x - d0.x, y: d1.y - d0.y });
      return reductionMetrics(s);
    });
    for (const r of results) {
      expect(r.axial).toBeCloseTo(results[0].axial, 9);
      expect(r.perView.primary.transverse).toBeCloseTo(results[0].perView.primary.transverse, 9);
      expect(r.axial).toBeCloseTo(0, 9);
    }
  });
});

describe('clamp and plate', () => {
  it('clamp on the plate path is rejected', () => {
    const m = getModel('C07');
    let s = reduce(initialT09('C07'));
    s = checkStep(m, s).state;
    s = { ...s, clamp: { ...s.clamp, proximal: 'px-top', distal: 'ds-bot' } };
    expect(checkStep(m, s).passed).toBe(false);
  });

  it('short, misplaced or compression-side plates do not pass', () => {
    const m = getModel('C07');
    let s = solve('C07');
    s = { ...s, step: 3 };
    expect(plateMetrics(m, { ...s, plate: { ...s.plate, side: 'compression' } }).passed).toBe(false);
    expect(plateMetrics(m, { ...s, plate: { ...s.plate, plateId: 'c07-p6' } }).passed).toBe(false);
    expect(plateMetrics(m, { ...s, plate: { ...s.plate, x: 14 } }).passed).toBe(false); // overhangs joint
    const ok = plateMetrics(m, s);
    expect(ok.passed).toBe(true);
    expect(ok.coverage).toBeCloseTo((plateLength(m.plates[1]) / m.length) * 100);
  });
});

describe('screws', () => {
  it('blocks drilling next to the fracture line and logs the violation once', () => {
    const m = getModel('C07');
    let s = solve('C07');
    s = { ...s, step: 4, completed: false };
    s = selectHole(s, 8); // sits on the fracture line
    const r1 = drill(m, s);
    expect(r1.block?.reason).toBe('fracture');
    const r2 = drill(m, r1.state);
    expect(r2.state.violations).toEqual(r1.state.violations);
    expect(r2.state.violations).toHaveLength(1);
  });

  it('a short screw is unicortical and not counted', () => {
    const m = getModel('C08');
    let s = solve('C08');
    s = { ...s, step: 4 };
    const e = evaluateHole(m, s, 0, 8);
    expect(e.cortices).toBe(1);
    expect(e.effective).toBe(false);
    const tooLong = evaluateHole(m, s, 0, 16);
    expect(tooLong.protrudes).toBe(true);
    expect(tooLong.effective).toBe(false);
  });

  it('a locked hole cannot be locked again (no duplicate purchase)', () => {
    const m = getModel('C07');
    const s = solve('C07');
    const before = fixationMetrics(m, s);
    const again = lockScrew(selectHole({ ...s, step: 4 }, 1), 6);
    expect(fixationMetrics(m, again).corticesProximal).toBe(before.corticesProximal);
  });

  it('extra screws beyond the preset configuration do not raise the score', () => {
    const m = getModel('C08');
    const s = solve('C08');
    const base = scoreT09(m, s);
    let extra: T09State = { ...s, step: 4 };
    extra = selectHole(extra, 1);
    extra = drill(m, extra).state;
    extra = lockScrew(extra, 11);
    const more = scoreT09(m, extra);
    expect(fixationMetrics(m, extra).extraEffective).toBe(1);
    expect(more.score).toBe(base.score);
  });
});

describe('full T09 flows', () => {
  for (const id of ['C07', 'C08']) {
    it(`${id} can be completed and scores within 0–100`, () => {
      const m = getModel(id);
      const s = solve(id);
      expect(s.completed).toBe(true);
      const sc = scoreT09(m, s);
      expect(sc.score).toBeGreaterThanOrEqual(80);
      expect(sc.score).toBeLessThanOrEqual(100);
      // toggling views or re-running the score never changes it
      const toggled = { ...s, activeView: 'secondary' as const, viewsSeen: { primary: true, secondary: true } };
      expect(scoreT09(m, toggled).score).toBe(sc.score);
    });
  }

  it('step 5 requires seeing both views', () => {
    const m = getModel('C07');
    const s = solve('C07');
    const notSeen = { ...s, completed: false, viewsSeen: { primary: true, secondary: false } };
    expect(checkStep(m, notSeen).passed).toBe(false);
  });

  it('first-check result is recorded once and not overwritten by later passes', () => {
    const m = getModel('C07');
    const s0 = initialT09('C07');
    const fail = checkStep(m, s0).state;
    expect(fail.firstCheck[1]).toBe(false);
    const pass = checkStep(m, reduce(fail)).state;
    expect(pass.firstCheck[1]).toBe(false);
    expect(pass.step).toBe(2);
  });
});
