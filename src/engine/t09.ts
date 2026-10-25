// T09 fracture reduction & plate fixation: state, actions and evaluation.
// Everything is computed from the current model state in model coordinates,
// so zoom, view toggles or repeated clicks can never add score.

import {
  FRACTURE_MODELS,
  holeOffset,
  plateLength,
  type FractureModel,
  type PlateOption,
  type ViewKey,
} from '../config/fractureCases';
import {
  LEVEL_CREDIT,
  SCREW_PROTRUSION_ALLOWANCE_MM,
  SNAP,
  TOLERANCES,
  isPassing,
  rate,
  worst,
} from '../config/tolerances';
import type { ToleranceLevel } from '../types';
import {
  angleDiff,
  clamp,
  normalizeDeg,
  overlap1D,
  rotate,
  segmentDistance,
  sideOf,
  sub,
  add,
  type Segment,
  type Vec,
} from './geometry';

export type T09Step = 1 | 2 | 3 | 4 | 5;

export interface HoleState {
  status: 'drilled' | 'locked';
  gauge: number;
  length: number | null;
}

export interface T09State {
  caseId: string;
  step: T09Step;
  dx: number;
  views: Record<ViewKey, { dy: number; theta: number }>;
  activeView: ViewKey;
  clamp: { proximal: string | null; distal: string | null; locked: boolean };
  plate: { plateId: string | null; x: number; side: 'tension' | 'compression' | null };
  holes: Record<number, HoleState>;
  selectedHole: number | null;
  /** Unique violation keys (hole:reason); duplicates are never re-added. */
  violations: string[];
  snapUsed: boolean;
  snapCount: number;
  viewsSeen: Record<ViewKey, boolean>;
  confirmed: string[];
  /** First evaluation result for each step's completion check (true = passed first time). */
  firstCheck: Partial<Record<T09Step, boolean>>;
  hintsUsed: number;
  completed: boolean;
}

export const getModel = (caseId: string): FractureModel => {
  const m = FRACTURE_MODELS[caseId];
  if (!m) throw new Error(`no fracture model for ${caseId}`);
  return m;
};

export function initialT09(caseId: string): T09State {
  const m = getModel(caseId);
  return {
    caseId,
    step: 1,
    dx: m.initial.dx,
    views: {
      primary: { ...m.initial.views.primary },
      secondary: { ...m.initial.views.secondary },
    },
    activeView: 'primary',
    clamp: { proximal: null, distal: null, locked: false },
    plate: { plateId: null, x: -m.length * 0.15, side: null },
    holes: {},
    selectedHole: null,
    violations: [],
    snapUsed: false,
    snapCount: 0,
    viewsSeen: { primary: false, secondary: false },
    confirmed: [],
    firstCheck: {},
    hintsUsed: 0,
    completed: false,
  };
}

// ---------- bone geometry ----------
export function widthAt(m: FractureModel, x: number): number {
  const p = m.profile;
  if (x <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    if (x <= p[i][0]) {
      const [x0, w0] = p[i - 1];
      const [x1, w1] = p[i];
      return w0 + ((w1 - w0) * (x - x0)) / (x1 - x0);
    }
  }
  return p[p.length - 1][1];
}

/** Fracture line clipped to the bone edges (local/target frame). */
export function fractureSegment(m: FractureModel): Segment {
  const w = widthAt(m, m.fracture.x);
  const t = Math.tan((m.fracture.obliquityDeg * Math.PI) / 180) * (w / 2);
  return { a: { x: m.fracture.x - t, y: -w / 2 }, b: { x: m.fracture.x + t, y: w / 2 } };
}

export const pivot = (m: FractureModel): Vec => ({ x: m.fracture.x, y: 0 });

/** Transform a distal-fragment local point to model coords for a given view. */
export function distalToModel(m: FractureModel, s: Pick<T09State, 'dx' | 'views'>, view: ViewKey, p: Vec): Vec {
  const pv = pivot(m);
  const r = rotate(p, s.views[view].theta, pv);
  return add(r, { x: s.dx, y: s.views[view].dy });
}

export function modelToDistal(m: FractureModel, s: Pick<T09State, 'dx' | 'views'>, view: ViewKey, p: Vec): Vec {
  const pv = pivot(m);
  const t = sub(p, { x: s.dx, y: s.views[view].dy });
  return rotate(t, -s.views[view].theta, pv);
}

// ---------- reduction ----------
export interface ReductionMetrics {
  axial: number;
  axialLevel: ToleranceLevel;
  perView: Record<ViewKey, { angle: number; angleLevel: ToleranceLevel; transverse: number; transverseLevel: ToleranceLevel }>;
  displacementLevel: ToleranceLevel;
  angleLevel: ToleranceLevel;
  passed: boolean;
}

export function reductionMetrics(s: Pick<T09State, 'dx' | 'views'>): ReductionMetrics {
  const axial = Math.abs(s.dx);
  const axialLevel = rate(TOLERANCES.displacement, axial);
  const perView = {} as ReductionMetrics['perView'];
  for (const k of ['primary', 'secondary'] as ViewKey[]) {
    const angle = Math.abs(angleDiff(s.views[k].theta, 0));
    const transverse = Math.abs(s.views[k].dy);
    perView[k] = {
      angle,
      angleLevel: rate(TOLERANCES.angle, angle),
      transverse,
      transverseLevel: rate(TOLERANCES.displacement, transverse),
    };
  }
  const displacementLevel = worst(axialLevel, perView.primary.transverseLevel, perView.secondary.transverseLevel);
  const angleLevel = worst(perView.primary.angleLevel, perView.secondary.angleLevel);
  return { axial, axialLevel, perView, displacementLevel, angleLevel, passed: isPassing(displacementLevel) && isPassing(angleLevel) };
}

/** Apply a model-space translation to the distal fragment in the active view. */
export function moveFragment(s: T09State, delta: Vec): T09State {
  if (s.clamp.locked || s.step !== 1) return s;
  const v = s.activeView;
  return {
    ...s,
    dx: clamp(s.dx + delta.x, -25, 15),
    views: { ...s.views, [v]: { ...s.views[v], dy: clamp(s.views[v].dy + delta.y, -15, 15) } },
  };
}

export function rotateFragment(s: T09State, deltaDeg: number): T09State {
  if (s.clamp.locked || s.step !== 1) return s;
  const v = s.activeView;
  return { ...s, views: { ...s.views, [v]: { ...s.views[v], theta: normalizeDeg(s.views[v].theta + deltaDeg) } } };
}

/** Optional magnetic assist (TOL-02 UI column). Records usage; never locks fine-tuning. */
export function trySnap(s: T09State, enabled: boolean): T09State {
  if (!enabled || s.clamp.locked) return s;
  const v = s.activeView;
  const pose = s.views[v];
  const near = Math.hypot(s.dx, pose.dy) < SNAP.displacementMm && Math.abs(angleDiff(pose.theta, 0)) <= SNAP.angleDeg;
  const already = s.dx === 0 && pose.dy === 0 && pose.theta === 0;
  if (!near || already) return s;
  return { ...s, dx: 0, views: { ...s.views, [v]: { dy: 0, theta: 0 } }, snapUsed: true, snapCount: s.snapCount + 1 };
}

// ---------- clamp ----------
export function clampMetrics(m: FractureModel, s: T09State) {
  const prox = m.clampPoints.find((c) => c.id === s.clamp.proximal) ?? null;
  const dist = m.clampPoints.find((c) => c.id === s.clamp.distal) ?? null;
  const onPath = [prox, dist].filter((c) => c?.onPlatePath).map((c) => c!.label);
  return { prox, dist, onPath, passed: !!prox && !!dist && onPath.length === 0 };
}

// ---------- plate ----------
export const plateById = (m: FractureModel, id: string | null): PlateOption | null => m.plates.find((p) => p.id === id) ?? null;

export interface PlateMetrics {
  plate: PlateOption | null;
  start: number;
  end: number;
  coverage: number;
  coverageLevel: ToleranceLevel;
  overhang: number;
  spansFracture: boolean;
  sideOk: boolean;
  isPreset: boolean;
  passed: boolean;
  issues: string[];
}

export function plateMetrics(m: FractureModel, s: T09State): PlateMetrics {
  const plate = plateById(m, s.plate.plateId);
  const issues: string[] = [];
  if (!plate) {
    return { plate, start: 0, end: 0, coverage: 0, coverageLevel: 'fail', overhang: 0, spansFracture: false, sideOk: false, isPreset: false, passed: false, issues: ['尚未選擇骨板'] };
  }
  const start = s.plate.x;
  const end = start + plateLength(plate);
  const coverage = (overlap1D(start, end, 0, m.length) / m.length) * 100;
  const coverageLevel = rate(TOLERANCES.span, coverage);
  // the plate must not run past the top end of either articular surface
  const proxLimit = Math.min(m.articular[0].a.x, m.articular[0].b.x);
  const distLimit = m.articular[1].a.x;
  const overhang = Math.max(0, proxLimit - start) + Math.max(0, end - distLimit);
  const fs = fractureSegment(m);
  const fxTop = fs.a.x;
  const spansFracture = start < fxTop - 1 && end > fxTop + 1;
  const sideOk = s.plate.side === 'tension';
  if (s.plate.side === null) issues.push('骨板尚未貼附骨面');
  else if (!sideOk) issues.push(`骨板偏向${m.compressionSideLabel}，力學力矩不足：請改放${m.tensionSideLabel}`);
  if (!spansFracture) issues.push('骨板未跨越骨折線');
  if (!isPassing(coverageLevel)) issues.push(`骨板覆蓋率 ${coverage.toFixed(1)}% 未達本關門檻（≥75%）：骨板過短易應力集中`);
  if (overhang > 0.05) issues.push(`骨板超出骨端 ${overhang.toFixed(1)} mm，可能干擾關節：請往內移`);
  if (!plate.isPreset) issues.push('此骨板不是本病例預設構型');
  const passed = sideOk && spansFracture && isPassing(coverageLevel) && overhang <= 0.05 && plate.isPreset;
  return { plate, start, end, coverage, coverageLevel, overhang, spansFracture, sideOk, isPreset: plate.isPreset, passed, issues };
}

export function movePlate(m: FractureModel, s: T09State, x: number, side: T09State['plate']['side']): T09State {
  if (s.step !== 3) return s;
  const plate = plateById(m, s.plate.plateId);
  const len = plate ? plateLength(plate) : 0;
  return { ...s, plate: { ...s.plate, x: clamp(x, -len - 5, m.length + 5), side } };
}

// ---------- screws ----------
export interface ScrewEval {
  index: number;
  x: number;
  /** x in the fragment's own (target) frame */
  localX: number;
  fragment: 'proximal' | 'distal' | 'none';
  thickness: number;
  overBone: boolean;
  fractureMargin: number;
  marginLevel: ToleranceLevel;
  articular: number;
  articularLevel: ToleranceLevel;
  length: number | null;
  cortices: 0 | 1 | 2;
  protrudes: boolean;
  effective: boolean;
  preset: boolean;
  issues: string[];
}

/** Model-space x of a hole for the current plate placement. */
export function holeX(m: FractureModel, s: T09State, i: number): number | null {
  const plate = plateById(m, s.plate.plateId);
  if (!plate || i < 0 || i >= plate.holes) return null;
  return s.plate.x + holeOffset(plate, i);
}

/** Geometric evaluation of hole i (with optional screw length). */
export function evaluateHole(m: FractureModel, s: T09State, i: number, length: number | null): ScrewEval {
  const plate = plateById(m, s.plate.plateId);
  const x = holeX(m, s, i) ?? NaN;
  const fs = fractureSegment(m);
  const top: Vec = { x, y: -widthAt(m, x) / 2 };
  // decide which fragment the hole sits over, in the local (target) frame
  let fragment: ScrewEval['fragment'] = 'none';
  let local = top;
  if (x >= 0 && x <= m.length) {
    if (sideOf(top, fs) === sideOf({ x: 0, y: 0 }, fs) || sideOf(top, fs) === 0) {
      fragment = 'proximal';
    } else {
      fragment = 'distal';
      local = modelToDistal(m, s, 'primary', top);
    }
  }
  const lx = local.x;
  const overBone = fragment !== 'none' && lx >= 0 && lx <= m.length;
  const thickness = overBone ? widthAt(m, lx) : 0;
  const screw: Segment = { a: { x: lx, y: -thickness / 2 }, b: { x: lx, y: thickness / 2 } };
  const fractureMargin = overBone ? segmentDistance(screw, fs) : 0;
  const articular = overBone ? Math.min(...m.articular.map((a) => segmentDistance(screw, a))) : 0;
  const marginLevel = rate(TOLERANCES.fractureMargin, fractureMargin);
  const articularLevel = rate(TOLERANCES.articular, articular);
  let cortices: ScrewEval['cortices'] = 0;
  let protrudes = false;
  if (length !== null && overBone) {
    if (length >= thickness - 1e-9) {
      cortices = 2;
      protrudes = length > thickness + SCREW_PROTRUSION_ALLOWANCE_MM + 1e-9;
    } else {
      cortices = 1;
    }
  }
  const issues: string[] = [];
  if (!overBone) issues.push('此孔下方沒有骨質');
  else {
    if (!isPassing(marginLevel)) issues.push(`距骨折線 ${fractureMargin.toFixed(1)} mm（本關門檻 ≥5 mm）`);
    if (!isPassing(articularLevel)) issues.push(`距關節面 ${articular.toFixed(1)} mm（本關門檻 ≥3 mm）`);
    if (cortices === 1) issues.push('螺釘過短：只抓住近側皮質（單皮質），不計為有效雙皮質釘');
    if (protrudes) issues.push('螺釘過長：尖端突出對側皮質過多，請改短');
  }
  const preset = !!plate?.isPreset && plate.presetHoles.includes(i);
  const effective = overBone && isPassing(marginLevel) && isPassing(articularLevel) && cortices === 2 && !protrudes;
  return { index: i, x, localX: lx, fragment, thickness, overBone, fractureMargin, marginLevel, articular, articularLevel, length, cortices, protrudes, effective, preset, issues };
}

export type DrillBlock = { reason: 'no-bone' | 'fracture' | 'articular'; message: string } | null;

export function drillBlock(e: ScrewEval): DrillBlock {
  if (!e.overBone) return { reason: 'no-bone', message: '此孔下方沒有骨質，無法鑽孔。請調整骨板位置。' };
  if (e.articularLevel === 'fail')
    return { reason: 'articular', message: '風險提示：此孔方向會穿入關節面。真實情境可能增加關節軟骨受損風險；請改選其他螺孔或移動骨板。' };
  if (e.marginLevel === 'fail')
    return { reason: 'fracture', message: `禁止：螺孔距骨折線僅 ${e.fractureMargin.toFixed(1)} mm（<4 mm）。請改用離骨折線較遠的螺孔。` };
  return null;
}

export const gaugeReading = (thickness: number) => Math.ceil(thickness * 2) / 2;

export function selectHole(s: T09State, i: number): T09State {
  if (s.step !== 4) return s;
  return { ...s, selectedHole: s.selectedHole === i ? null : i };
}

export function drill(m: FractureModel, s: T09State): { state: T09State; block: DrillBlock } {
  const i = s.selectedHole;
  if (s.step !== 4 || i === null || s.holes[i]) return { state: s, block: null };
  const e = evaluateHole(m, s, i, null);
  const block = drillBlock(e);
  if (block) {
    const key = `${i}:${block.reason}`;
    const violations = s.violations.includes(key) ? s.violations : [...s.violations, key];
    return { state: { ...s, violations }, block };
  }
  return { state: { ...s, holes: { ...s.holes, [i]: { status: 'drilled', gauge: gaugeReading(e.thickness), length: null } } }, block: null };
}

export function lockScrew(s: T09State, length: number): T09State {
  const i = s.selectedHole;
  if (s.step !== 4 || i === null) return s;
  const h = s.holes[i];
  // a locked hole cannot be locked again: no duplicate screws
  if (!h || h.status !== 'drilled') return s;
  return { ...s, holes: { ...s.holes, [i]: { ...h, status: 'locked', length } }, selectedHole: null };
}

export function removeScrew(s: T09State, i: number): T09State {
  if (s.step !== 4 || !s.holes[i]) return s;
  const holes = { ...s.holes };
  delete holes[i];
  return { ...s, holes, selectedHole: null };
}

export interface FixationMetrics {
  screws: ScrewEval[];
  corticesProximal: number;
  corticesDistal: number;
  cortexLevel: ToleranceLevel;
  presetDone: number;
  presetTotal: number;
  presetComplete: boolean;
  extraEffective: number;
  minMargin: number | null;
  marginLevel: ToleranceLevel;
  passed: boolean;
  issues: string[];
}

export function fixationMetrics(m: FractureModel, s: T09State): FixationMetrics {
  const plate = plateById(m, s.plate.plateId);
  const screws = Object.entries(s.holes)
    .filter(([, h]) => h.status === 'locked')
    .map(([k, h]) => evaluateHole(m, s, Number(k), h.length));
  const eff = screws.filter((x) => x.effective);
  const corticesProximal = eff.filter((x) => x.fragment === 'proximal').length * 2;
  const corticesDistal = eff.filter((x) => x.fragment === 'distal').length * 2;
  const cortexLevel = worst(rate(TOLERANCES.cortex, corticesProximal), rate(TOLERANCES.cortex, corticesDistal));
  const presetTotal = plate?.presetHoles.length ?? 0;
  const presetDone = eff.filter((x) => x.preset).length;
  const presetComplete = presetTotal > 0 && presetDone === presetTotal;
  const extraEffective = eff.filter((x) => !x.preset).length;
  const minMargin = eff.length ? Math.min(...eff.map((x) => x.fractureMargin)) : null;
  const marginLevel = minMargin === null ? 'fail' : rate(TOLERANCES.fractureMargin, minMargin);
  const invalid = screws.filter((x) => !x.effective);
  const issues: string[] = [];
  if (corticesProximal < 6) issues.push(`近端有效皮質 ${corticesProximal}/6`);
  if (corticesDistal < 6) issues.push(`遠端有效皮質 ${corticesDistal}/6`);
  if (!presetComplete) issues.push(`本病例預設構型完成 ${presetDone}/${presetTotal}`);
  for (const x of invalid) issues.push(`螺孔 ${x.index + 1}：${x.issues.join('；')}`);
  const pendingDrilled = Object.values(s.holes).filter((h) => h.status === 'drilled').length;
  if (pendingDrilled) issues.push(`有 ${pendingDrilled} 個已鑽孔尚未鎖釘`);
  const passed = isPassing(cortexLevel) && presetComplete && invalid.length === 0 && pendingDrilled === 0;
  return { screws, corticesProximal, corticesDistal, cortexLevel, presetDone, presetTotal, presetComplete, extraEffective, minMargin, marginLevel, passed, issues };
}

// ---------- step flow ----------
export function stepPassed(m: FractureModel, s: T09State, step: T09Step): boolean {
  switch (step) {
    case 1:
      return reductionMetrics(s).passed;
    case 2:
      return reductionMetrics(s).passed && clampMetrics(m, s).passed;
    case 3:
      return plateMetrics(m, s).passed;
    case 4:
      return fixationMetrics(m, s).passed;
    case 5:
      return (
        s.viewsSeen.primary &&
        s.viewsSeen.secondary &&
        FINAL_CHECKS.every((c) => s.confirmed.includes(c.id)) &&
        reductionMetrics(s).passed &&
        plateMetrics(m, s).passed &&
        fixationMetrics(m, s).passed
      );
  }
}

export const FINAL_CHECKS = [
  { id: 'reduction', label: '復位：兩視角位移誤差達標' },
  { id: 'alignment', label: '力線：兩視角成角偏差達標' },
  { id: 'implant', label: '植入物長度：骨板覆蓋率與骨端避讓達標' },
  { id: 'purchase', label: '抓持力：預設構型完成、每側有效皮質達標' },
] as const;

/** Run the completion check for the current step; advance if it passes. Records first result once. */
export function checkStep(m: FractureModel, s: T09State): { state: T09State; passed: boolean } {
  const passed = stepPassed(m, s, s.step);
  const firstCheck = s.step in s.firstCheck ? s.firstCheck : { ...s.firstCheck, [s.step]: passed };
  let next: T09State = { ...s, firstCheck };
  if (passed) {
    if (s.step === 2) next = { ...next, clamp: { ...next.clamp, locked: true } };
    if (s.step === 5) next = { ...next, completed: true };
    else next = { ...next, step: (s.step + 1) as T09Step, activeView: 'primary', selectedHole: null };
  }
  return { state: next, passed };
}

// ---------- scoring ----------
export interface T09Score {
  score: number;
  parts: { key: string; label: string; level: ToleranceLevel; points: number; max: number }[];
  deduction: number;
  notes: string[];
}

export function scoreT09(m: FractureModel, s: T09State): T09Score {
  const r = reductionMetrics(s);
  const p = plateMetrics(m, s);
  const f = fixationMetrics(m, s);
  const cortexLevel: ToleranceLevel = isPassing(f.cortexLevel) ? (f.presetComplete ? 'perfect' : 'pass') : f.cortexLevel;
  const parts = [
    { key: 'angle', label: TOLERANCES.angle.label, level: r.angleLevel, max: TOLERANCES.angle.points },
    { key: 'displacement', label: TOLERANCES.displacement.label, level: r.displacementLevel, max: TOLERANCES.displacement.points },
    { key: 'span', label: TOLERANCES.span.label, level: p.coverageLevel, max: TOLERANCES.span.points },
    { key: 'cortex', label: '抓持（預設構型完成度）', level: cortexLevel, max: TOLERANCES.cortex.points },
    { key: 'margin', label: TOLERANCES.fractureMargin.label, level: f.marginLevel, max: TOLERANCES.fractureMargin.points },
  ].map((x) => ({ ...x, points: Math.round(x.max * LEVEL_CREDIT[x.level] * 10) / 10 }));
  const articularAttempt = s.violations.some((v) => v.endsWith(':articular'));
  const deduction = articularAttempt ? TOLERANCES.articular.points : 0;
  const total = parts.reduce((a, b) => a + b.points, 0);
  const notes: string[] = [];
  if (articularAttempt) notes.push('曾嘗試在穿入關節面風險的螺孔鑽孔（扣 20 分一次；病患未因此發生併發症，這是風險提示）。');
  if (s.violations.some((v) => v.endsWith(':fracture'))) notes.push('曾嘗試在骨折線安全距內鑽孔：請先確認紅色警戒帶。');
  if (f.extraEffective > 0) notes.push(`有 ${f.extraEffective} 支預設構型以外的螺釘：螺釘增加不代表構型更好，不加分。`);
  if (s.snapUsed) notes.push(`使用磁吸輔助 ${s.snapCount} 次（已記錄，不扣分）。`);
  return { score: clamp(Math.round(total - deduction), 0, 100), parts, deduction, notes };
}
