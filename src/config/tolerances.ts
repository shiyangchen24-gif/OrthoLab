// The ONE place game-geometry thresholds live. These are teaching-game
// geometric thresholds, not clinical standards: meeting or missing them does
// not predict healing, non-union or any other clinical outcome.
//
// Source: 骨折微調與數值容差表 (TOL-01…TOL-06). Where that table conflicts with
// other sheets (e.g. 3° in 術式與步驟表 vs 5° here) the tolerance table wins.
// Ranges the source left undefined are filled with an explicit 'adjust'
// (需調整) band so every value maps to exactly one level. The full decision
// log is in docs/data-review.md and CONFLICT_LOG below.

import type { ToleranceBand, ToleranceConfig, ToleranceLevel } from '../types';

const band = (
  level: ToleranceLevel,
  min: number,
  max: number,
  minInclusive: boolean,
  maxInclusive: boolean,
): ToleranceBand => ({ level, min, max, minInclusive, maxInclusive });

const INF = Number.POSITIVE_INFINITY;

export const TOLERANCES = {
  /** |angular deviation| in degrees, per view. */
  angle: {
    id: 'angle',
    label: '成角偏差',
    unit: '°',
    sourceParamId: 'TOL-01',
    direction: 'lower-better',
    bands: [band('perfect', -INF, 2, false, true), band('pass', 2, 5, false, true), band('fail', 5, INF, false, false)],
    points: 25,
    note: '容差表 Pass ≤5°、Perfect ≤2°；覆蓋術式表 T09-S1 的 3°。',
  },
  /** |game displacement error| in mm (axial and transverse each). NOT a clinical fracture gap. */
  displacement: {
    id: 'displacement',
    label: '復位位移誤差（遊戲量測）',
    unit: 'mm',
    sourceParamId: 'TOL-02',
    direction: 'lower-better',
    bands: [
      band('perfect', -INF, 0.3, false, true),
      band('pass', 0.3, 1.0, false, true),
      band('adjust', 1.0, 1.5, false, true),
      band('fail', 1.5, INF, false, false),
    ],
    points: 25,
    note: '容差表 Pass ≤1.0、Perfect ≤0.3、Fail >1.5；1.0–1.5 未定義 → 需調整。軸向（短縮/分離）與側向平移分開計算、各自套用此設定。',
  },
  /** plate overlap with bone / bone length, %. */
  span: {
    id: 'span',
    label: '骨板覆蓋率',
    unit: '%',
    sourceParamId: 'TOL-03',
    direction: 'higher-better',
    bands: [
      band('fail', -INF, 70, false, false),
      band('adjust', 70, 75, true, false),
      band('pass', 75, 85, true, false),
      band('perfect', 85, INF, true, false),
    ],
    points: 15,
    note: '容差表 Pass ≥75%、Perfect ≥85%、Fail <70%；70–75% 未定義 → 需調整。為本關幾何門檻，非通用臨床跨距規則。',
  },
  /** cortices per side from effective (bicortical, valid, unique) screws. */
  cortex: {
    id: 'cortex',
    label: '每側有效皮質數',
    unit: '皮質',
    sourceParamId: 'TOL-04',
    direction: 'higher-better',
    bands: [band('fail', -INF, 6, false, false), band('pass', 6, INF, true, false)],
    points: 20,
    note: '本關門檻每側 ≥6（3 支有效雙皮質釘）。容差表的「≥8 為完美」不採用：完美改依「本病例預設構型完成度」判定，螺釘增加不自動加分。',
  },
  /** min distance (mm) from screw segment to fracture line segment. */
  fractureMargin: {
    id: 'fractureMargin',
    label: '螺釘距骨折線',
    unit: 'mm',
    sourceParamId: 'TOL-05',
    direction: 'higher-better',
    bands: [
      band('fail', -INF, 4, false, false),
      band('adjust', 4, 5, true, false),
      band('pass', 5, 7, true, false),
      band('perfect', 7, INF, true, false),
    ],
    points: 15,
    note: '容差表 Pass ≥5、Perfect ≥7、Fail <4；4–5 mm 未定義 → 需調整。以線段距離計算。',
  },
  /** min distance (mm) from screw segment to articular surface segment. */
  articular: {
    id: 'articular',
    label: '螺釘距關節面',
    unit: 'mm',
    sourceParamId: 'TOL-06',
    direction: 'higher-better',
    bands: [
      band('fail', -INF, 0, false, true),
      band('adjust', 0, 3, false, false),
      band('pass', 3, 4, true, false),
      band('perfect', 4, INF, true, false),
    ],
    points: 20,
    note: '容差表 Pass ≥3、Perfect ≥4、Fail＝穿透；0–3 mm 未定義 → 需調整。違規以「風險提示」呈現，不宣告病患已發生併發症；首次作答若曾嘗試違規，依原表扣 20 分（一次）。',
  },
} satisfies Record<string, ToleranceConfig>;

export type ToleranceKey = keyof typeof TOLERANCES;

/** Teaching-score credit per level (game design assumption G01). */
export const LEVEL_CREDIT: Record<ToleranceLevel, number> = { perfect: 1, pass: 0.8, adjust: 0, fail: 0 };

export const LEVEL_LABEL: Record<ToleranceLevel, string> = {
  perfect: 'PERFECT',
  pass: 'PASS',
  adjust: '需調整',
  fail: '未達標',
};

/** Bicortical acceptance: screw length must cover bone thickness, with at most this protrusion. */
export const SCREW_PROTRUSION_ALLOWANCE_MM = 2;

/** Auto-snap trigger (TOL-02 UI column): displacement < 0.5 mm and angle within pass. */
export const SNAP = { displacementMm: 0.5, angleDeg: 5 };

export const CONFLICT_LOG = [
  '成角容差：術式與步驟表／術式模組寫 ≤3°，容差表寫 Pass ≤5°。採容差表 5°（Perfect ≤2°）。',
  '間隙：容差表 1.0–1.5 mm 未定義 → 需調整；並改名為「復位位移誤差（遊戲量測）」，不稱臨床間隙。',
  '跨距：70–75% 未定義 → 需調整。',
  '安全距：4–5 mm 未定義 → 需調整。',
  '關節面：0–3 mm 未定義 → 需調整；穿透為未達標。',
  '皮質數：容差表 ≥8 為完美，與「螺釘增加不代表較好」衝突；改以本病例預設構型完成度判定完美。',
];

export function rate(config: ToleranceConfig, value: number): ToleranceLevel {
  for (const b of config.bands) {
    const aboveMin = b.minInclusive ? value >= b.min : value > b.min;
    const belowMax = b.maxInclusive ? value <= b.max : value < b.max;
    if (aboveMin && belowMax) return b.level;
  }
  // Bands are validated to cover the real line; NaN is the only way here.
  return 'fail';
}

export const isPassing = (level: ToleranceLevel) => level === 'pass' || level === 'perfect';

const ORDER: ToleranceLevel[] = ['fail', 'adjust', 'pass', 'perfect'];
export const worst = (...levels: ToleranceLevel[]): ToleranceLevel =>
  levels.reduce((a, b) => (ORDER.indexOf(a) <= ORDER.indexOf(b) ? a : b), 'perfect' as ToleranceLevel);
