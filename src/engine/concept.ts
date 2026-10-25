// State & scoring for the conceptual surgical modules (T01 TPLO, T02 FHNE,
// T03 MPL). No clinical numeric thresholds are invented here: targets are the
// preset teaching marks of each schematic, and steps the source marks as
// "禁止上線判分" are completion-only.

import { clamp } from './geometry';

export type Firsts = Record<string, unknown>;

// ---------------- T01 TPLO ----------------
export interface TploState {
  step: 1 | 2 | 3 | 4;
  planPick: string | null;
  sawPlaced: boolean;
  /** saw centre in schematic units */
  saw: { x: number; y: number };
  cut: boolean;
  /** 0 = start, 1 = preset target mark (dimensionless schematic progress) */
  rotation: number;
  plate: { x: number; y: number; seated: boolean };
  screws: number[];
  offTemplate: number[];
  answers: Record<string, string>;
  completed: boolean;
}

export const TPLO_SAW_TARGET = { x: 64, y: 40 };
/** Visual snapping window around the preset mark (schematic units, game-only). */
export const TPLO_SAW_WINDOW = 4;
export const TPLO_ROTATION_WINDOW = 0.04;
export const TPLO_PLATE_TARGET = { x: 46, y: 30 };
export const TPLO_TEMPLATE_HOLES = [0, 1, 2, 4, 5, 6];
export const TPLO_JOINT_RISK_HOLE = 3;

export const initialTplo = (): TploState => ({
  step: 1,
  planPick: null,
  sawPlaced: false,
  saw: { x: 30, y: 70 },
  cut: false,
  rotation: 0,
  plate: { x: 10, y: 80, seated: false },
  screws: [],
  offTemplate: [],
  answers: {},
  completed: false,
});

export const TPLO_PLANS = (side: string, tpa: number) => [
  { id: 'correct', text: `${side}・依 X 光 TPA ${tpa}°・預設教學規劃`, ok: true, why: '患側與影像量測一致，規劃依病例影像而非體重。' },
  { id: 'wrong-side', text: `${side.includes('左') ? '右後肢' : '左後肢'}・TPA ${tpa}°`, ok: false, why: '患側錯誤：請核對病歷的患側。' },
  { id: 'by-weight', text: `${side}・依體重自動套用規劃（未量測 TPA）`, ok: false, why: '規劃不能以體重自動決定（T01-S1）。' },
];

export const TPLO_QUESTIONS = [
  { id: 'side', q: '影像側標與患側一致嗎？', options: ['一致', '不一致'], answer: '一致' },
  { id: 'implant', q: '骨板與螺釘位置是否符合預設範本，且未進入關節示意區？', options: ['符合', '不符合'], answer: '符合' },
  { id: 'next', q: '手術完成後，下一步是？', options: ['宣告完全康復', '進入術後照護與追蹤'], answer: '進入術後照護與追蹤' },
] as const;

export const sawOk = (s: TploState) => Math.hypot(s.saw.x - TPLO_SAW_TARGET.x, s.saw.y - TPLO_SAW_TARGET.y) <= TPLO_SAW_WINDOW;
export const rotationOk = (s: TploState) => Math.abs(s.rotation - 1) <= TPLO_ROTATION_WINDOW;
export const plateSeated = (p: { x: number; y: number }) => Math.hypot(p.x - TPLO_PLATE_TARGET.x, p.y - TPLO_PLATE_TARGET.y) <= 5;
export const templateDone = (s: TploState) => TPLO_TEMPLATE_HOLES.every((h) => s.screws.includes(h)) && !s.screws.includes(TPLO_JOINT_RISK_HOLE);

export function scoreTplo(f: Firsts): { score: number; notes: string[] } {
  // S2 (osteotomy & rotation) is completion-only: the source forbids numeric scoring.
  const s1 = f.s1 === true ? 40 : 0;
  const s3 = f.s3 === true ? 30 : 15;
  const s4 = f.s4 === true ? 30 : 15;
  const notes = ['截骨與旋轉為概念操作，依原始資料「未設定可用數值容差，禁止上線判分」，只檢核完成，不計分。'];
  if (f.s1 !== true) notes.push('術前規劃首次未選對：請先核對患側與 TPA 影像量測。');
  if (f.s3 !== true) notes.push('固定步驟首次檢核未完成範本構型或選到關節風險孔位。');
  return { score: s1 + s3 + s4, notes };
}

// ---------------- T02 FHNE ----------------
export interface FhneState {
  step: 1 | 2 | 3 | 4;
  picks: string[];
  /** cut position along the neck: 0 = head side, 1 = trochanter side */
  cutT: number;
  cutDone: boolean;
  romMax: number;
  spurFound: boolean;
  spurClicks: number;
  smoothed: boolean;
  romAfter: number;
  route: string | null;
  completed: boolean;
}

/** Preset teaching resection zone (schematic, pending specialist review). */
export const FHNE_ZONE = { min: 0.55, max: 0.75 };

export const initialFhne = (): FhneState => ({
  step: 1,
  picks: [],
  cutT: 0.2,
  cutDone: false,
  romMax: 0,
  spurFound: false,
  spurClicks: 0,
  smoothed: false,
  romAfter: 0,
  route: null,
  completed: false,
});

export const FHNE_REGIONS = [
  { id: 'head-neck', label: '右股骨頭頸', ok: true },
  { id: 'trochanter', label: '大轉子', ok: false, why: '大轉子屬保留骨區。' },
  { id: 'acetabulum', label: '髖臼', ok: false, why: 'FHNE 切除的是股骨頭頸，不處理髖臼。' },
  { id: 'shaft', label: '股骨幹', ok: false, why: '股骨幹屬保留骨區。' },
  { id: 'left-head', label: '左股骨頭（對側）', ok: false, why: '患側為右後肢：請核對側標。' },
] as const;

export const FHNE_ROUTES = [
  { id: 'rehab', text: '疼痛控制＋漸進復健', ok: true, why: '完成個別化功能照護（T02-S4）。' },
  { id: 'plate', text: '進入骨板螺釘固定關卡', ok: false, why: 'FHNE 不使用通用骨板固定關卡（T02-S4）。' },
  { id: 'disuse', text: '長期不使用患肢直到完全不痛', ok: false, why: '止痛充分後應依個體安排患肢使用及復健（P02）。' },
] as const;

export const cutInZone = (t: number) => t >= FHNE_ZONE.min && t <= FHNE_ZONE.max;
/** Residual ridge size grows when the cut stays on the head side of the zone. */
export const residualSize = (t: number) => clamp((FHNE_ZONE.max - t) * 10 + 1, 1, 6);

export function scoreFhne(f: Firsts): { score: number; notes: string[] } {
  const notes: string[] = [];
  const s1 = f.s1 === true ? 30 : 10;
  const s2 = f.s2 === true ? 30 : 10;
  const s3 = f.s3 === true ? 20 : 10;
  const s4 = f.s4 === true ? 20 : 5;
  if (f.s1 !== true) notes.push('首次辨識目標未直接點選患側股骨頭頸。');
  if (f.s2 !== true) notes.push('首次切除示意線不在預設教學示意區（此區待專科審閱）。');
  if (f.s3 !== true) notes.push('殘留骨性撞擊首次未定位：切除後必須檢查截骨面與活動，不能只看移除動畫。');
  return { score: s1 + s2 + s3 + s4, notes };
}

// ---------------- T03 MPL ----------------
export interface MplState {
  step: 1 | 2 | 3 | 4;
  found: string[];
  wrong: string[];
  combo: string[];
  comboChecked: boolean;
  depth: number;
  tuberosity: number;
  softDone: boolean;
  flexMin: number;
  flexMax: number;
  flex: number;
  answers: Record<string, string>;
  completed: boolean;
}

export const initialMpl = (): MplState => ({
  step: 1,
  found: [],
  wrong: [],
  combo: [],
  comboChecked: false,
  depth: 0,
  tuberosity: 0,
  softDone: false,
  flexMin: 0,
  flexMax: 0,
  flex: 0,
  answers: {},
  completed: false,
});

export const MPL_STRUCTURES = [
  { id: 'groove', label: '滑車溝過淺', abnormal: true },
  { id: 'tuberosity', label: '脛骨粗隆偏內', abnormal: true },
  { id: 'patella', label: '髕骨向內側脫位', abnormal: true },
  { id: 'condyle', label: '股骨內髁', abnormal: false, why: '本例影像未見此處異常。' },
  { id: 'ccl', label: '前十字韌帶', abnormal: false, why: '骨科觸診 CrCL 穩定（C04-E2）。' },
] as const;

export const MPL_PROCEDURES = [
  { id: 'sulcoplasty', label: '滑車溝成形（加深）', need: 'required', why: '對應「滑車溝不足」（C04-E4）。' },
  { id: 'ttt', label: '脛骨粗隆轉位', need: 'required', why: '對應「粗隆偏內」（C04-E4）。' },
  { id: 'soft', label: '軟組織平衡（外側緊縮／內側鬆解）', need: 'optional', why: '依術中軌跡需要選用；不強制。' },
  { id: 'osteotomy', label: '股骨／脛骨矯正截骨', need: 'no', why: '本例「無重大角度變形」（C04-E3）；嚴重變形才轉介評估。' },
  { id: 'tplo', label: 'TPLO', need: 'no', why: 'CrCL 穩定，本例不支持把 TPLO 當成 MPL 通用處理（A16）。' },
] as const;

/** preset teaching marks on the schematic sliders (0–100) */
export const MPL_DEPTH_TARGET = 60;
export const MPL_TT_TARGET = { min: 70, max: 90 };

export function comboVerdict(combo: string[]) {
  const missing = MPL_PROCEDURES.filter((p) => p.need === 'required' && !combo.includes(p.id));
  const extra = MPL_PROCEDURES.filter((p) => p.need === 'no' && combo.includes(p.id));
  return { ok: missing.length === 0 && extra.length === 0, missing, extra };
}

export const grooveOk = (s: MplState) => s.depth >= MPL_DEPTH_TARGET;
export const ttOk = (s: MplState) => s.tuberosity >= MPL_TT_TARGET.min && s.tuberosity <= MPL_TT_TARGET.max;
export const correctionDone = (s: MplState) =>
  (!s.combo.includes('sulcoplasty') || grooveOk(s)) && (!s.combo.includes('ttt') || ttOk(s)) && (!s.combo.includes('soft') || s.softDone);

/** Lateral patella offset (schematic units) at a flexion fraction; >0 means luxated medially. */
export function patellaOffset(s: MplState, flex: number): number {
  const groove = s.combo.includes('sulcoplasty') && grooveOk(s) ? 1 : 0;
  const tt = s.combo.includes('ttt') && ttOk(s) ? 1 : 0;
  const instability = (1 - groove) * 6 + (1 - tt) * 5;
  return Math.max(0, instability * Math.sin(flex * Math.PI * 0.9) - (s.softDone ? 0.5 : 0));
}

export const trackStable = (s: MplState) => {
  for (let f = 0; f <= 1.0001; f += 0.05) if (patellaOffset(s, f) > 1) return false;
  return true;
};

export const MPL_QUESTIONS = [
  { id: 'track', q: '屈伸全程髕骨是否維持在滑車溝內？', options: ['是', '否'], answer: '是' },
  { id: 'stable', q: '關節穩定度是否已確認（本例 CrCL 穩定）？', options: ['已確認', '未確認'], answer: '已確認' },
] as const;

export function scoreMpl(f: Firsts): { score: number; notes: string[] } {
  const notes: string[] = [];
  const wrong = typeof f.s1Wrong === 'number' ? f.s1Wrong : 0;
  const s1 = Math.max(10, 30 - wrong * 10);
  const s2 = f.s2 === true ? 40 : 15;
  const s34 = f.s4 === true ? 30 : 20;
  if (wrong) notes.push(`辨識排列時點選了 ${wrong} 個非異常結構。`);
  if (f.s2 !== true) notes.push('首次選擇的處置組合不完全符合本例所見；不是每例都需要全部術式。');
  return { score: s1 + s2 + s34, notes };
}
