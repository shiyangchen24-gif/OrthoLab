// TPLO digital pre-operative planning + surgery: pure geometry and state.
//
// A teaching model of the workflow of commercial TPLO planning software (no
// affiliation; generic naming in the UI). Per the project decision, numbers are
// computed and shown but NEVER scored: steps are only checked for completion
// (and plain geometric sanity such as "the cut does not enter the joint").
//
// Local frame, millimetres, lateral (ML) view of the tibia:
//   origin = centre of the intercondylar eminences (E), +y distal along the tibial
//   long axis, −x cranial, +x caudal. The radiograph is drawn rotated and scaled
//   (px per mm) so calibration matters; shape scale follows the case's tibia length.
//
// D1–D3 are GAME DEFINITIONS pending specialist review (docs/data-review.md §15):
//   D1 = cranial exit of the osteotomy → patellar-ligament insertion on the tibial tuberosity
//   D2 = osteotomy → cranial cortex of the tibial tuberosity at its mid-height (tuberosity bone stock)
//   D3 = cranial edge of the tibial plateau → osteotomy, measured along the long axis

import { cluesForCase } from '../data';
import { add, deg2rad, len, rad2deg, rotate, sub, v, type Vec } from './geometry';

/** Target postoperative TPA (teaching setting, adjustable here; pending review). */
export const TPLO_TARGET_TPA = 5;
/** Calibration sphere diameter (mm) placed at the level of the stifle. */
export const CALIBRATION_MM = 25;
/** Crescentic saw blade radii offered (mm). */
export const BLADE_RADII = [12, 15, 18, 21, 24, 27, 30];

export const PLANNING_CASES = ['C01', 'C02'] as const;
export const hasTploPlanning = (caseId: string) => (PLANNING_CASES as readonly string[]).includes(caseId);

/** Tibia length (mm) and radiograph scale per case (game model settings). */
const CASE_SETUP: Record<string, { tibiaMm: number; pxPerMm: number; imageRotDeg: number }> = {
  C01: { tibiaMm: 190, pxPerMm: 3, imageRotDeg: -6 },
  C02: { tibiaMm: 95, pxPerMm: 6, imageRotDeg: -6 },
};

export interface TploGeometry {
  caseId: string;
  /** shape scale relative to the 190 mm reference tibia */
  k: number;
  tpa: number;
  tibiaMm: number;
  pxPerMm: number;
  imageRotDeg: number;
  /** eminence centre (axis proximal point) and talus centre (axis distal point) */
  E: Vec;
  T: Vec;
  /** cranial / caudal edges of the medial tibial plateau */
  Pcr: Vec;
  Pca: Vec;
  /** patellar-ligament insertion on the tibial tuberosity */
  ins: Vec;
  /** tuberosity cranial cortex at mid-height (D2 reference) */
  tub: Vec;
  /** tibia outline (closed polygon) */
  outline: Vec[];
  /** decorative anatomy */
  femur: { c: Vec; r: number };
  patella: { c: Vec; r: number };
  talus: { c: Vec; r: number };
  fibula: Vec[];
  sphere: { c: Vec; r: number };
  /** minimum tuberosity bone stock (game geometry, not a clinical threshold) */
  minStock: number;
  /** shaft width (mm) where the plate's shaft part sits */
  shaftWidth: number;
}

/** TPA from the case's X-ray reading text (C01-E3: 27°, C02-E3: 32°). */
export function caseTpa(caseId: string): number {
  const txt = cluesForCase(caseId).find((c) => c.category === 'imaging')?.result ?? '';
  const m = /TPA\s*(\d+(?:\.\d+)?)/.exec(txt);
  return m ? Number(m[1]) : NaN;
}

export function tploGeometry(caseId: string): TploGeometry {
  const setup = CASE_SETUP[caseId];
  if (!setup) throw new Error(`no TPLO planning model for ${caseId}`);
  const k = setup.tibiaMm / 190;
  const tpa = caseTpa(caseId);
  const a = deg2rad(tpa);
  const half = 22; // half plateau length at reference scale
  const S = (x: number, y: number) => v(x * k, y * k);
  const Pcr = v(-half * Math.cos(a) * k, -half * Math.sin(a) * k);
  const Pca = v(half * Math.cos(a) * k, half * Math.sin(a) * k);
  const ins = S(-24, 11.2);
  const tub = S(-25.5, 24);
  const outline = [
    Pcr,
    S(-23.5, -2),
    ins,
    tub,
    S(-17, 45),
    S(-9.5, 75),
    S(-8.5, 150),
    S(-12, 178),
    S(-10, 188),
    S(10, 188),
    S(13, 178),
    S(9, 150),
    S(9, 100),
    S(11, 60),
    S(17, 35),
    S(21, 16),
    Pca,
    S(9, 3),
    S(2, -3), // eminence tubercles
    S(-3, -4),
    S(-10, -1),
  ];
  return {
    caseId,
    k,
    tpa,
    tibiaMm: setup.tibiaMm,
    pxPerMm: setup.pxPerMm,
    imageRotDeg: setup.imageRotDeg,
    E: v(0, 0),
    T: S(0, 197),
    Pcr,
    Pca,
    ins,
    tub,
    outline,
    femur: { c: S(1, -16), r: 17 * k },
    patella: { c: S(-31, -44), r: 7 * k },
    talus: { c: S(0, 197), r: 10 * k },
    fibula: [S(15, 22), S(11, 90), S(9, 168)],
    sphere: { c: S(-60, 70), r: CALIBRATION_MM / 2 },
    minStock: 8.5 * k,
    shaftWidth: 19.5 * k,
  };
}

// ---------- radiograph transform (mm ↔ image px) ----------
export const IMAGE_SIZE = { w: 700, h: 760 };
const IMAGE_ORIGIN = v(400, 120);

export function toImage(g: TploGeometry, p: Vec): Vec {
  const r = rotate(v(p.x * g.pxPerMm, p.y * g.pxPerMm), g.imageRotDeg);
  return add(r, IMAGE_ORIGIN);
}

export function fromImage(g: TploGeometry, p: Vec): Vec {
  const r = rotate(sub(p, IMAGE_ORIGIN), -g.imageRotDeg);
  return v(r.x / g.pxPerMm, r.y / g.pxPerMm);
}

// ---------- basic geometry ----------
export function insidePolygon(poly: Vec[], p: Vec): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Signed angle (deg) of the plateau line vs. the perpendicular to the long axis = TPA. */
export function measureTpa(axisProx: Vec, axisDist: Vec, plateauCr: Vec, plateauCa: Vec): number {
  const axis = sub(axisDist, axisProx);
  const perp = v(axis.y, -axis.x); // pointing caudal (+x) when the axis points distal (+y)
  const pl = sub(plateauCa, plateauCr);
  const ang = Math.atan2(perp.x * pl.y - perp.y * pl.x, perp.x * pl.x + perp.y * pl.y);
  return Math.abs(rad2deg(ang));
}

// ---------- osteotomy ----------
/** Point on the osteotomy circle; psi = 0 straight distal, + toward caudal. */
const onArc = (O: Vec, R: number, psiDeg: number) => v(O.x + R * Math.sin(deg2rad(psiDeg)), O.y + R * Math.cos(deg2rad(psiDeg)));

export interface Osteotomy {
  O: Vec;
  R: number;
  cranialExit: Vec | null;
  caudalExit: Vec | null;
  /** arc samples between the exits (for drawing) */
  arc: Vec[];
  d1: number | null;
  d2: number | null;
  d3: number | null;
  checks: { centered: boolean; cranialExitOk: boolean; caudalExitOk: boolean; stockOk: boolean };
  issues: string[];
  valid: boolean;
}

/** Distance (mm) between the arc and a point measured radially. */
const radial = (O: Vec, R: number, p: Vec) => Math.abs(len(sub(p, O)) - R);

export function osteotomy(g: TploGeometry, O: Vec, R: number): Osteotomy {
  const inBone = (p: Vec) => insidePolygon(g.outline, p);
  // walk from straight distal toward each side until the arc leaves the bone
  const walk = (dir: 1 | -1): { exit: Vec | null; pts: Vec[] } => {
    const pts: Vec[] = [];
    if (!inBone(onArc(O, R, 0))) return { exit: null, pts };
    for (let psi = 0; Math.abs(psi) <= 175; psi += 0.5 * dir) {
      const p = onArc(O, R, psi);
      if (!inBone(p)) return { exit: p, pts };
      pts.push(p);
    }
    return { exit: null, pts };
  };
  const cr = walk(-1);
  const ca = walk(1);
  const arc = [...cr.pts.reverse(), ...ca.pts];
  const centered = len(sub(O, g.E)) <= 4 * g.k;
  // the cut must leave the cranial cortex between the plateau edge and the ligament insertion
  // (tuberosity stays on the distal segment, joint untouched)
  const cranialExitOk = !!cr.exit && cr.exit.y > g.Pcr.y + 0.5 * g.k && cr.exit.y < g.ins.y && cr.exit.x < g.Pcr.x + 2 * g.k;
  const caudalExitOk = !!ca.exit && ca.exit.y > g.Pca.y + 1 * g.k && ca.exit.x > 0;
  const d1 = cr.exit ? len(sub(g.ins, cr.exit)) : null;
  const d2 = len(sub(g.tub, O)) > R ? radial(O, R, g.tub) : null;
  // D3: from the cranial plateau edge straight down the long axis to the arc
  const dy = R * R - (g.Pcr.x - O.x) ** 2;
  const d3 = dy > 0 ? O.y + Math.sqrt(dy) - g.Pcr.y : null;
  const stockOk = d2 !== null && d2 >= g.minStock;
  const issues: string[] = [];
  if (!centered) issues.push('截骨中心未放在髁間隆起中心（教學設定 ±4 mm）');
  if (!cranialExitOk) {
    if (cr.exit && cr.exit.y >= g.ins.y) issues.push('頭側出口在髕韌帶附著點遠端：鋸線會切過脛骨粗隆');
    else issues.push('頭側出口太靠近或進入關節面：請改用較大的鋸片或下移中心');
  }
  if (!caudalExitOk) issues.push('尾側出口不在脛骨尾側皮質上（太靠近關節）');
  if (!stockOk) issues.push(`脛骨粗隆骨量不足：D2 ${d2 === null ? '—' : d2.toFixed(1)} mm（教學幾何下限 ${g.minStock.toFixed(1)} mm）`);
  return {
    O,
    R,
    cranialExit: cr.exit,
    caudalExit: ca.exit,
    arc,
    d1,
    d2,
    d3,
    checks: { centered, cranialExitOk, caudalExitOk, stockOk },
    issues,
    valid: centered && cranialExitOk && caudalExitOk && stockOk,
  };
}

// ---------- rotation ----------
export const requiredRotation = (g: TploGeometry, target = TPLO_TARGET_TPA) => g.tpa - target;
/** Rotating the plateau segment by theta (deg) reduces the TPA by theta (rigid rotation about O). */
export const tpaAfter = (g: TploGeometry, theta: number) => g.tpa - theta;
export const circumferentialTravel = (R: number, theta: number) => R * deg2rad(theta);
export const chordDistance = (R: number, theta: number) => 2 * R * Math.sin(deg2rad(theta) / 2);

/** Rotate a point of the proximal (plateau) segment: positive theta lowers the TPA. */
export const rotatePlateau = (p: Vec, O: Vec, theta: number) => rotate(p, -theta, O);

// ---------- plates and screws ----------
export interface TploPlate {
  id: string;
  label: string;
  /** plate width (mm) and head screw spread (mm) */
  width: number;
  headSpan: number;
}

export const TPLO_PLATES: TploPlate[] = [
  { id: 'tplo-2.0', label: '2.0 mm TPLO 骨板（示意）', width: 6, headSpan: 12 },
  { id: 'tplo-2.4', label: '2.4 mm TPLO 骨板（示意）', width: 7.5, headSpan: 15 },
  { id: 'tplo-2.7', label: '2.7 mm TPLO 骨板（示意）', width: 9, headSpan: 18 },
  { id: 'tplo-3.5', label: '3.5 mm TPLO 骨板（示意）', width: 11, headSpan: 24 },
];

export interface PlateFit {
  widthRatio: number;
  headFits: boolean;
  widthOk: boolean;
  ok: boolean;
  issues: string[];
}

/** Template fit on the radiograph (game geometry; chosen from the image, never from body weight). */
export function plateFit(g: TploGeometry, plate: TploPlate, R: number): PlateFit {
  const widthRatio = plate.width / g.shaftWidth;
  const widthOk = widthRatio >= 0.4 && widthRatio <= 0.7;
  const headFits = plate.headSpan <= R;
  const issues: string[] = [];
  if (widthRatio < 0.4) issues.push(`骨板寬度僅骨幹寬度 ${Math.round(widthRatio * 100)}%：範本過小`);
  if (widthRatio > 0.7) issues.push(`骨板寬度達骨幹寬度 ${Math.round(widthRatio * 100)}%：範本過大`);
  if (!headFits) issues.push('骨板頭部螺孔間距大於截骨半徑：頭部無法完整落在近端骨段');
  return { widthRatio, headFits, widthOk, ok: widthOk && headFits, issues };
}

export type HoleKind = 'head' | 'shaft';
export interface PlateHole {
  i: number;
  kind: HoleKind;
  p: Vec;
}

/** Hole positions for a plate whose head centre is at H (post-rotation image, local mm). */
export function plateHoles(plate: TploPlate, H: Vec): PlateHole[] {
  const f = plate.headSpan / 24;
  const rel: [number, number, HoleKind][] = [
    [-7, -2, 'head'],
    [0, -7, 'head'],
    [7, -2, 'head'],
    [2.5, 16, 'shaft'],
    [2.5, 26, 'shaft'],
    [2.5, 36, 'shaft'],
  ];
  return rel.map(([x, y, kind], i) => ({ i, kind, p: v(H.x + x * f, H.y + y * f) }));
}

/** Plate outline (post-rotation image, local mm). */
export function plateOutline(plate: TploPlate, H: Vec): Vec[] {
  const f = plate.headSpan / 24;
  const w = plate.width / 2;
  const pts: [number, number][] = [
    [-11, -3],
    [-6, -10],
    [6, -10],
    [11, -3],
    [6, 4],
    [2.5 + w / f, 8],
    [2.5 + w / f, 40],
    [2.5 - w / f, 40],
    [2.5 - w / f, 8],
    [-6, 4],
  ];
  return pts.map(([x, y]) => v(H.x + x * f, H.y + y * f));
}

/** Distance from p to the joint surface line (plateau) — positive below (distal to) it. */
function belowJoint(g: TploGeometry, p: Vec): number {
  const d = sub(g.Pca, g.Pcr);
  const n = v(-d.y, d.x);
  const nl = len(n);
  return ((p.x - g.Pcr.x) * n.x + (p.y - g.Pcr.y) * n.y) / nl;
}

export interface HoleCheck {
  ok: boolean;
  issue: string | null;
}

/**
 * Validity of a planned screw hole on the post-rotation image. Head holes ride on the
 * rotated plateau segment, so they are rotated back before testing against the anatomy.
 */
export function checkHole(g: TploGeometry, O: Vec, R: number, theta: number, h: PlateHole): HoleCheck {
  const margin = 2 * g.k;
  if (h.kind === 'head') {
    const q = rotate(h.p, theta, O); // undo the plateau rotation
    if (!insidePolygon(g.outline, q)) return { ok: false, issue: `螺孔 ${h.i + 1} 不在骨內` };
    if (belowJoint(g, q) < margin) return { ok: false, issue: `螺孔 ${h.i + 1} 太靠近或進入關節` };
    if (len(sub(q, O)) > R - margin) return { ok: false, issue: `螺孔 ${h.i + 1} 太靠近截骨線（應在近端骨段內）` };
    return { ok: true, issue: null };
  }
  if (!insidePolygon(g.outline, h.p)) return { ok: false, issue: `螺孔 ${h.i + 1} 不在骨內` };
  if (len(sub(h.p, O)) < R + margin) return { ok: false, issue: `螺孔 ${h.i + 1} 太靠近截骨線（應在遠端骨幹）` };
  return { ok: true, issue: null };
}

// ---------- planning state ----------
export const PLAN_STEPS = ['匯入 X 光', '影像校正', '脛骨長軸', '脛骨高原線', 'TPA 與目標', '鋸片與截骨中心', '出口與粗隆骨量', 'D1／D2／D3', '模擬高原旋轉', '骨板與螺釘規劃', '輸出規劃表'];
export const SURGERY_STEPS = ['術前確認', '手術入路', '依 D1–D3 定位', '圓弧截骨', '旋轉脛骨高原', '暫時固定', '骨板固定', '穩定度與排列', '縫合', '術後 X 光'];

export type LandmarkId = 'calA' | 'calB' | 'axisP' | 'axisD' | 'platCr' | 'platCa';

export interface TploPlan {
  study: string | null;
  /** placed landmark positions (image px) */
  marks: Partial<Record<LandmarkId, Vec>>;
  calibrationMm: number | null;
  targetConfirmed: boolean;
  blade: number | null;
  /** osteotomy centre (local mm) */
  center: Vec | null;
  exitConfirmed: boolean;
  measured: { d1: boolean; d2: boolean; d3: boolean };
  rotation: number;
  plate: string | null;
  /** plate head centre on the rotated image (local mm) */
  platePos: Vec | null;
  screws: number[];
  exported: boolean;
}

export interface TploSurgery {
  tray: { blade: number | null; plate: string | null };
  trayChecked: boolean;
  approach: string | null;
  center: Vec | null;
  cut: boolean;
  rotation: number;
  tempFixed: boolean;
  plateSeated: boolean;
  screws: number[];
  stability: string | null;
  alignmentChecked: boolean;
  closed: boolean;
  answers: Record<string, string>;
}

export interface TploState {
  phase: 'plan' | 'surgery' | 'done';
  step: number;
  plan: TploPlan;
  surgery: TploSurgery;
}

export const initialTploState = (): TploState => ({
  phase: 'plan',
  step: 1,
  plan: {
    study: null,
    marks: {},
    calibrationMm: null,
    targetConfirmed: false,
    blade: null,
    center: null,
    exitConfirmed: false,
    measured: { d1: false, d2: false, d3: false },
    rotation: 0,
    plate: null,
    platePos: null,
    screws: [],
    exported: false,
  },
  surgery: {
    tray: { blade: null, plate: null },
    trayChecked: false,
    approach: null,
    center: null,
    cut: false,
    rotation: 0,
    tempFixed: false,
    plateSeated: false,
    screws: [],
    stability: null,
    alignmentChecked: false,
    closed: false,
    answers: {},
  },
});

/** True once the planning sheet has been exported (planning stage complete). */
export const planDone = (s: Pick<TploState, 'phase'> | undefined | null) => !!s && s.phase !== 'plan';

// ---------- landmarks ----------
/** Where each landmark truly is (image px) and the snap radius (px). */
export function landmarkTargets(g: TploGeometry): Record<LandmarkId, Vec> {
  const c = toImage(g, g.sphere.c);
  const rpx = g.sphere.r * g.pxPerMm;
  return {
    // calibration: left and right edge of the sphere in image space
    calA: v(c.x - rpx, c.y),
    calB: v(c.x + rpx, c.y),
    axisP: toImage(g, g.E),
    axisD: toImage(g, g.T),
    platCr: toImage(g, g.Pcr),
    platCa: toImage(g, g.Pca),
  };
}
export const SNAP_PX = 14;

/** Snap a dropped landmark to its target when close enough. */
export function snapLandmark(g: TploGeometry, id: LandmarkId, p: Vec): { p: Vec; snapped: boolean } {
  const t = landmarkTargets(g)[id];
  return len(sub(p, t)) <= SNAP_PX ? { p: t, snapped: true } : { p, snapped: false };
}

export const isSnapped = (g: TploGeometry, id: LandmarkId, p: Vec | undefined) => !!p && len(sub(p, landmarkTargets(g)[id])) < 0.5;

/** Image scale the player derives from the calibration points and the known diameter. */
export function playerScale(plan: TploPlan): number | null {
  const a = plan.marks.calA;
  const b = plan.marks.calB;
  if (!a || !b || !plan.calibrationMm) return null;
  return len(sub(b, a)) / plan.calibrationMm;
}

/** TPA from the player's placed points (image px; angles are scale-free). */
export function plannedTpa(plan: TploPlan): number | null {
  const { axisP, axisD, platCr, platCa } = plan.marks;
  if (!axisP || !axisD || !platCr || !platCa) return null;
  return measureTpa(axisP, axisD, platCr, platCa);
}

// ---------- surgery helpers ----------
/** D-values reproduced by the surgical blade position vs. the plan (mm). */
export function dDeltas(g: TploGeometry, plan: TploPlan, center: Vec): { d: [number | null, number | null, number | null]; delta: [number, number, number] } {
  const R = plan.blade ?? 0;
  const p = osteotomy(g, plan.center ?? g.E, R);
  const s = osteotomy(g, center, R);
  const d: [number | null, number | null, number | null] = [s.d1, s.d2, s.d3];
  const diff = (a: number | null, b: number | null) => (a === null || b === null ? Infinity : Math.abs(a - b));
  return { d, delta: [diff(s.d1, p.d1), diff(s.d2, p.d2), diff(s.d3, p.d3)] };
}
/** Positioning tolerance for "osteotomy placed per D1–D3" (game geometry, completion only). */
export const D_TOLERANCE = 1;

/**
 * Module result: only discrete, first-attempt decisions are scored (study choice, tray
 * check, approach, stability reading, post-op reading). Numbers are never scored.
 */
export function scoreTplo(first: Record<string, unknown>): { score: number; notes: string[] } {
  const keys: [string, string][] = [
    ['study', '匯入的 X 光：病歷患側與 ML 投照'],
    ['tray', '術前確認：鋸片與骨板依規劃表'],
    ['approach', '手術入路'],
    ['stability', '穩定度判讀：TPLO 後應轉陰性的試驗'],
    ['postop', '術後 X 光判讀'],
  ];
  const got = keys.filter(([k]) => first[k] === true);
  const notes = keys.filter(([k]) => first[k] === false).map(([, label]) => `「${label}」首次作答未正確，請回顧規劃表與步驟說明。`);
  return { score: Math.round((got.length / keys.length) * 100), notes };
}

/** A valid plate head position near the cranioproximal plateau (tests / layout aid; never shown as an answer). */
export function suggestPlatePosition(g: TploGeometry, plate: TploPlate, O: Vec, R: number, theta: number): Vec | null {
  let best: Vec | null = null;
  let bestD = Infinity;
  const nominal = v(-12 * g.k, 12 * g.k);
  for (let x = -25; x <= 25; x += 0.5)
    for (let y = -15; y <= 30; y += 0.5) {
      const H = v(x * g.k, y * g.k);
      if (!plateHoles(plate, H).every((h) => checkHole(g, O, R, theta, h).ok)) continue;
      const d = len(sub(H, nominal));
      if (d < bestD) {
        bestD = d;
        best = H;
      }
    }
  return best;
}
