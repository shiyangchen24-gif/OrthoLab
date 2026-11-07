import { describe, expect, it } from 'vitest';
import {
  BLADE_RADII,
  CALIBRATION_MM,
  TPLO_PLATES,
  TPLO_TARGET_TPA,
  caseTpa,
  checkHole,
  chordDistance,
  circumferentialTravel,
  dDeltas,
  fromImage,
  hasTploPlanning,
  initialTploState,
  landmarkTargets,
  measureTpa,
  osteotomy,
  plannedTpa,
  plateFit,
  plateHoles,
  playerScale,
  requiredRotation,
  scoreTplo,
  snapLandmark,
  suggestPlatePosition,
  toImage,
  tpaAfter,
  tploGeometry,
} from '../src/engine/tploPlan';
import { dxItems } from '../src/data/tploDx';
import { answerDx, dxDone, dxNotes } from '../src/engine/tploDx';
import { FLOW, FLOW_PLANNING, flowFor, flowIndex } from '../src/engine/guide';
import { answerLocalization, answerQuiz, chooseOption, proceed, quizQuestions, revealClue, startSession, type CaseSession } from '../src/engine/session';
import { cluesForCase, optionsForCase } from '../src/data';

const g1 = tploGeometry('C01');
const g2 = tploGeometry('C02');

describe('planning geometry follows the case data', () => {
  it('TPLO planning exists only for the CrCL cases with a TPLO route', () => {
    expect(hasTploPlanning('C01')).toBe(true);
    expect(hasTploPlanning('C02')).toBe(true);
    for (const id of ['C03', 'C04', 'C05', 'C06', 'C07', 'C08']) expect(hasTploPlanning(id)).toBe(false);
    for (const id of ['C01', 'C02']) expect(optionsForCase(id).some((o) => o.route.kind === 'module' && o.route.procedureId === 'PROC-TPLO')).toBe(true);
  });

  it('TPA comes from the X-ray reading and is reproduced by measuring the landmarks', () => {
    expect(caseTpa('C01')).toBe(27);
    expect(caseTpa('C02')).toBe(32);
    for (const g of [g1, g2]) {
      const t = landmarkTargets(g);
      expect(measureTpa(t.axisP, t.axisD, t.platCr, t.platCa)).toBeCloseTo(g.tpa, 6);
    }
  });

  it('image transform round-trips and the calibration sphere gives the true scale', () => {
    for (const g of [g1, g2]) {
      const p = { x: 12.3, y: -4.5 };
      const q = fromImage(g, toImage(g, p));
      expect(q.x).toBeCloseTo(p.x, 6);
      expect(q.y).toBeCloseTo(p.y, 6);
      const t = landmarkTargets(g);
      const plan = { ...initialTploState().plan, marks: { calA: t.calA, calB: t.calB }, calibrationMm: CALIBRATION_MM };
      expect(playerScale(plan)).toBeCloseTo(g.pxPerMm, 6);
    }
    // same-size film, different real size: the small dog needs twice the px per mm
    expect(g2.pxPerMm).toBe(2 * g1.pxPerMm);
  });

  it('landmarks snap only when dropped close to the true point', () => {
    const t = landmarkTargets(g1);
    expect(snapLandmark(g1, 'axisP', { x: t.axisP.x + 6, y: t.axisP.y - 5 }).snapped).toBe(true);
    expect(snapLandmark(g1, 'axisP', { x: t.axisP.x + 40, y: t.axisP.y }).snapped).toBe(false);
    const plan = { ...initialTploState().plan, marks: { axisP: t.axisP, axisD: t.axisD, platCr: t.platCr, platCa: t.platCa } };
    expect(plannedTpa(plan)).toBeCloseTo(27, 6);
  });
});

describe('osteotomy checks (teaching geometry, completion only)', () => {
  const validRadii = (g: typeof g1) => BLADE_RADII.filter((R) => osteotomy(g, g.E, R).valid);
  it('with the centre on the eminence, one blade size fits each case', () => {
    expect(validRadii(g1)).toEqual([24]);
    expect(validRadii(g2)).toEqual([12]);
  });

  it('too small enters the joint; too large crosses the tuberosity and leaves too little stock', () => {
    const small = osteotomy(g1, g1.E, 21);
    expect(small.checks.cranialExitOk && small.checks.caudalExitOk).toBe(false);
    const large = osteotomy(g1, g1.E, 30);
    expect(large.checks.cranialExitOk).toBe(false);
    expect(large.checks.stockOk).toBe(false);
    expect(large.issues.join()).toContain('脛骨粗隆');
  });

  it('an off-centre osteotomy is flagged', () => {
    expect(osteotomy(g1, { x: 8, y: 6 }, 24).checks.centered).toBe(false);
  });

  it('D1–D3 are defined for a valid plan and reproduced when the surgery matches it', () => {
    const o = osteotomy(g1, g1.E, 24);
    expect(o.d1).toBeGreaterThan(0);
    expect(o.d2).toBeGreaterThanOrEqual(g1.minStock);
    expect(o.d3).toBeGreaterThan(0);
    const plan = { ...initialTploState().plan, blade: 24, center: g1.E };
    expect(dDeltas(g1, plan, g1.E).delta.every((d) => d < 1e-9)).toBe(true);
    expect(dDeltas(g1, plan, { x: 3, y: 4 }).delta.some((d) => d > 1)).toBe(true);
  });
});

describe('rotation outputs', () => {
  it('rotating by TPA − target reaches the target TPA', () => {
    expect(requiredRotation(g1)).toBe(27 - TPLO_TARGET_TPA);
    expect(tpaAfter(g1, requiredRotation(g1))).toBe(TPLO_TARGET_TPA);
  });
  it('circumferential travel = R·θ and chord = 2R·sin(θ/2)', () => {
    expect(circumferentialTravel(24, 22)).toBeCloseTo((24 * 22 * Math.PI) / 180, 9);
    expect(chordDistance(24, 22)).toBeCloseTo(2 * 24 * Math.sin((11 * Math.PI) / 180), 9);
    expect(chordDistance(24, 22)).toBeLessThan(circumferentialTravel(24, 22));
  });
});

describe('plate templates and screw planning', () => {
  it('plates are chosen from the image template fit, never from body weight', () => {
    expect(TPLO_PLATES.filter((p) => plateFit(g1, p, 24).ok).map((p) => p.id)).toEqual(['tplo-2.7', 'tplo-3.5']);
    expect(TPLO_PLATES.filter((p) => plateFit(g2, p, 12).ok).map((p) => p.id)).toEqual(['tplo-2.0']);
  });
  it('a valid plate position exists after rotation; head holes must stay in the plateau segment', () => {
    for (const [g, R, id] of [
      [g1, 24, 'tplo-2.7'],
      [g2, 12, 'tplo-2.0'],
    ] as const) {
      const plate = TPLO_PLATES.find((p) => p.id === id)!;
      const theta = requiredRotation(g);
      const H = suggestPlatePosition(g, plate, g.E, R, theta)!;
      expect(H).not.toBeNull();
      expect(plateHoles(plate, H).every((h) => checkHole(g, g.E, R, theta, h).ok)).toBe(true);
      // the same plate pushed far distally puts head screws across the osteotomy
      const far = plateHoles(plate, { x: H.x, y: H.y + R });
      expect(far.some((h) => !checkHole(g, g.E, R, theta, h).ok)).toBe(true);
    }
  });
});

describe('scoring never uses the numbers', () => {
  it('only discrete first-attempt decisions count', () => {
    expect(scoreTplo({ study: true, tray: true, approach: true, stability: true, postop: true }).score).toBe(100);
    const r = scoreTplo({ study: false, tray: true, approach: true, stability: true, postop: true });
    expect(r.score).toBe(80);
    expect(r.notes.join()).toContain('匯入的 X 光');
    // numeric results are not inputs to the score at all
    expect(scoreTplo.length).toBe(1);
  });
});

function toDecision(caseId: string): CaseSession {
  let s = answerLocalization(startSession(caseId, false), ['LH']).session;
  for (const c of cluesForCase(caseId)) s = revealClue(s, c.id);
  for (const q of quizQuestions(s)) s = answerQuiz(s, q.id, q.options.find((o) => o.correct)!.id).session;
  return s;
}

describe('① diagnosis card and the planning stage in the flow', () => {
  it("every diagnosis answer cites this case's own clues and must be completed", () => {
    for (const id of ['C01', 'C02']) {
      const items = dxItems(id);
      expect(items.map((q) => q.id)).toEqual(['effusion', 'oa', 'tibia', 'comorbid', 'diagnosis', 'indication']);
      for (const q of items) {
        expect(q.options.filter((o) => o.correct)).toHaveLength(1);
        expect(q.basis).toMatch(new RegExp(`${id}|全身狀態`));
      }
      let s = toDecision(id);
      expect(dxDone(s)).toBe(false);
      s = answerDx(s, 'oa', 'b'); // a wrong first answer is kept as a note, not a score
      for (const q of items) s = answerDx(s, q.id, 'a');
      expect(dxDone(s)).toBe(true);
      expect(dxNotes(s).join()).toContain('OA');
    }
    // other cases have no card and are never blocked by it
    expect(dxDone(toDecision('C05'))).toBe(true);
  });

  it('C01/C02 show 術前規劃 between 處置推理 and surgery; other cases keep the old flow', () => {
    expect(flowFor(startSession('C01', false))).toEqual(FLOW_PLANNING);
    expect(flowFor(startSession('C05', false))).toEqual(FLOW);
    let s = toDecision('C01');
    s = chooseOption(s, 'A01').session;
    s = proceed(s);
    expect(flowFor(s)[flowIndex(s)]).toBe('術前規劃');
    const tplo = { ...initialTploState(), phase: 'surgery' as const };
    s = { ...s, moduleState: { ...s.moduleState, 'PROC-TPLO': tplo } };
    expect(flowFor(s)[flowIndex(s)]).toBe('手術／管理');
  });
});
