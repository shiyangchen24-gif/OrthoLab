// Step-by-step guidance for T09: what to do now, which objects are operable,
// current values vs targets, why a check fails and how to fix it.
// Pure function of model state so the UI, tests and hints agree.

import type { FractureModel, ViewKey } from '../config/fractureCases';
import { isPassing } from '../config/tolerances';
import type { ToleranceLevel } from '../types';
import {
  FINAL_CHECKS,
  clampMetrics,
  evaluateHole,
  fixationMetrics,
  movePlate,
  plateById,
  plateMetrics,
  reductionMetrics,
  type T09State,
} from './t09';

export interface CoachRow {
  label: string;
  value: string;
  target: string;
  level: ToleranceLevel | null;
}

export interface Coach {
  doNow: string;
  objects: string;
  rows: CoachRow[];
  /** Each entry: why it does not pass yet, and how to fix it. */
  fixes: string[];
  /** All criteria of the current step are met: the check will pass. */
  ready: boolean;
}

const other = (v: ViewKey): ViewKey => (v === 'primary' ? 'secondary' : 'primary');
const f1 = (n: number) => n.toFixed(1);
const f2 = (n: number) => n.toFixed(2);

function reductionFixes(m: FractureModel, s: T09State, v: ViewKey): string[] {
  const r = reductionMetrics(s);
  const pv = r.perView[v];
  const theta = s.views[v].theta;
  const dy = s.views[v].dy;
  const name = m.views[v].label;
  const out: string[] = [];
  if (!isPassing(pv.angleLevel)) {
    // SVG y points down: positive θ is clockwise on screen, so reduce it counter-clockwise
    const dir = theta > 0 ? '逆時針（⟲ 按鈕、Q 或 [ 鍵）' : '順時針（⟳ 按鈕、E 或 ] 鍵）';
    out.push(`${name}：遠端骨段仍成角 ${f1(pv.angle)}°（目標 ≤5°）。請${dir}旋轉約 ${f1(pv.angle)}°。`);
  }
  if (!isPassing(r.axialLevel)) {
    out.push(
      s.dx < 0
        ? `骨段重疊短縮 ${f2(r.axial)} mm（目標 ≤1.0 mm）。請把遠端骨段往遠端（畫面右側）牽引：向右拖曳、▶ 按鈕或 → 鍵。`
        : `骨段分離 ${f2(r.axial)} mm（目標 ≤1.0 mm）。請把遠端骨段往近端（畫面左側）推回：向左拖曳、◀ 按鈕或 ← 鍵。`,
    );
  }
  if (!isPassing(pv.transverseLevel)) {
    out.push(
      dy > 0
        ? `${name}：遠端骨段偏下 ${f2(pv.transverse)} mm（目標 ≤1.0 mm）。請向上移：向上拖曳、▲ 按鈕或 ↑ 鍵。`
        : `${name}：遠端骨段偏上 ${f2(pv.transverse)} mm（目標 ≤1.0 mm）。請向下移：向下拖曳、▼ 按鈕或 ↓ 鍵。`,
    );
  }
  return out;
}

/** Smallest plate shift (mm, model axis) that makes the plate step pass, or null. */
export function suggestPlateShift(m: FractureModel, s: T09State): number | null {
  const plate = plateById(m, s.plate.plateId);
  if (!plate || !plate.isPreset) return null;
  const base: T09State = { ...s, step: 3, plate: { ...s.plate, side: 'tension' } };
  for (let k = 0; k <= 80; k++) {
    for (const sign of k === 0 ? [1] : [-1, 1]) {
      const d = sign * k * 0.5;
      const moved = movePlate(m, base, base.plate.x + d, 'tension');
      if (plateMetrics(m, moved).passed) return d;
    }
  }
  return null;
}

export function coachT09(m: FractureModel, s: T09State): Coach {
  const r = reductionMetrics(s);
  switch (s.step) {
    case 1: {
      const v = s.activeView;
      const fixes = reductionFixes(m, s, v);
      const otherFixes = reductionFixes(m, s, other(v)).filter((x) => x.startsWith(m.views[other(v)].label));
      if (!fixes.length && otherFixes.length) fixes.push(`${m.views[v].label}已對齊。請按「${m.views[other(v)].label}」切換視角，繼續復位另一個平面。`);
      const rows: CoachRow[] = (['primary', 'secondary'] as ViewKey[]).flatMap((k) => [
        { label: `${m.views[k].label} 成角`, value: `${f1(r.perView[k].angle)}°`, target: '≤5°（≤2° 為 PERFECT）', level: r.perView[k].angleLevel },
        { label: `${m.views[k].label} 側向平移`, value: `${f2(r.perView[k].transverse)} mm`, target: '≤1.0 mm', level: r.perView[k].transverseLevel },
      ]);
      rows.push({ label: '軸向位移誤差（短縮／分離）', value: `${f2(r.axial)} mm`, target: '≤1.0 mm', level: r.axialLevel });
      return {
        doNow: r.passed ? '兩個視角都已復位。按「完成檢核」進入骨鉗暫夾。' : `在 ${m.views[v].label} 視角把遠端骨段對回虛線目標位置。`,
        objects: '遠端骨段（拖曳移動）、藍色旋轉把手（拖曳旋轉）、視角切換、微調按鈕／鍵盤。',
        rows,
        fixes,
        ready: r.passed,
      };
    }
    case 2: {
      const c = clampMetrics(m, s);
      const fixes: string[] = [];
      if (!c.prox) fixes.push('尚未選近端夾持點：點選骨折線左側（近端）的一個夾持點。');
      if (!c.dist) fixes.push('尚未選遠端夾持點：點選骨折線右側（遠端）的一個夾持點。');
      for (const p of [c.prox, c.dist])
        if (p?.onPlatePath) {
          const alt = m.clampPoints.find((x) => x.side === p.side && !x.onPlatePath);
          fixes.push(`「${p.label}」位在骨板預定貼附的${m.tensionSideLabel}，夾鉗會擋住骨板。請改選「${alt?.label ?? '另一側'}」。`);
        }
      return {
        doNow: c.passed ? '骨鉗位置避開骨板路徑。按「完成檢核」夾持並鎖定復位。' : '在骨折線兩側各選一個不會擋住骨板的夾持點。',
        objects: '四個圓形夾持點（近端兩個、遠端兩個）。',
        rows: [
          { label: '近端夾持點', value: c.prox?.label ?? '未選', target: `避開${m.tensionSideLabel}`, level: c.prox ? (c.prox.onPlatePath ? 'fail' : 'pass') : null },
          { label: '遠端夾持點', value: c.dist?.label ?? '未選', target: `避開${m.tensionSideLabel}`, level: c.dist ? (c.dist.onPlatePath ? 'fail' : 'pass') : null },
        ],
        fixes,
        ready: c.passed,
      };
    }
    case 3: {
      const p = plateMetrics(m, s);
      const preset = m.plates.find((x) => x.isPreset)!;
      const fixes: string[] = [];
      if (!p.plate) fixes.push(`從器械盤選擇「${preset.label}」。`);
      else if (!p.isPreset) fixes.push(`這支骨板不是本病例預設構型，請改選「${preset.label}」。`);
      else {
        if (s.plate.side !== 'tension') fixes.push(`骨板需貼附${m.tensionSideLabel}（上緣）：按「貼附${m.tensionSideLabel}」，或把骨板拖到骨頭上緣放開。`);
        if (!p.passed) {
          const d = suggestPlateShift(m, s);
          for (const i of p.issues.filter((x) => !x.startsWith('骨板尚未貼附') && !x.startsWith('骨板偏向'))) fixes.push(`未達標：${i}`);
          if (d !== null && d !== 0) fixes.push(`建議：把骨板往${d < 0 ? '近端（畫面左側，◀）' : '遠端（畫面右側，▶）'}移動約 ${Math.abs(d).toFixed(1)} mm。`);
        }
      }
      return {
        doNow: p.passed ? '骨板位置達標。按「完成檢核」進入鑽孔鎖釘。' : !p.plate ? '從器械盤選擇骨板。' : '把骨板貼附張力側並移到能使用全部預設螺孔的位置。',
        objects: '器械盤骨板、骨板本體（拖曳）、貼附側按鈕、◀ ▶ 移動按鈕。',
        rows: [
          { label: '骨板覆蓋率', value: p.plate ? `${f1(p.coverage)}%` : '—', target: '≥75%（≥85% PERFECT）', level: p.plate ? p.coverageLevel : null },
          { label: '超出骨端', value: p.plate ? `${f1(p.overhang)} mm` : '—', target: '0 mm', level: p.plate ? (p.overhang <= 0.05 ? 'pass' : 'fail') : null },
          { label: '貼附面', value: s.plate.side === null ? '未貼附' : s.plate.side === 'tension' ? '張力側' : '壓力側', target: '張力側', level: s.plate.side === null ? null : s.plate.side === 'tension' ? 'pass' : 'fail' },
        ],
        fixes,
        ready: p.passed,
      };
    }
    case 4: {
      const fm = fixationMetrics(m, s);
      const plate = plateById(m, s.plate.plateId);
      const fixes: string[] = [];
      const sel = s.selectedHole;
      let doNow: string;
      const nextPreset = plate?.presetHoles.find((i) => !fm.screws.some((x) => x.index === i && x.effective));
      if (sel !== null && s.holes[sel]?.status === 'drilled') {
        const g = s.holes[sel].gauge;
        doNow = `螺孔 ${sel + 1} 已鑽孔，量規讀數 ${g.toFixed(1)} mm。選擇 ≥${g.toFixed(1)} mm、且不超過 ${(g + 2).toFixed(1)} mm 的螺釘長度鎖入。`;
      } else if (sel !== null && !s.holes[sel]) {
        doNow = `已選螺孔 ${sel + 1}。按「鑽孔」。`;
      } else if (nextPreset !== undefined) {
        doNow = `點選預設螺孔 ${nextPreset + 1}（亮色實線圈），再鑽孔、量深、鎖釘。`;
      } else if (!fm.passed) {
        doNow = '依下方原因修正螺釘。';
      } else {
        doNow = '預設構型完成。按「完成檢核」進入術後檢核。';
      }
      for (const x of fm.screws.filter((y) => !y.effective)) {
        const how = x.cortices === 1 ? '移除後重新鑽孔，選較長的螺釘' : x.protrudes ? '移除後重新鑽孔，選較短的螺釘' : '移除這支螺釘，改用其他螺孔';
        fixes.push(`螺孔 ${x.index + 1}：${x.issues.join('；')}。修正：${how}。`);
      }
      const pending = Object.entries(s.holes).filter(([k, h]) => h.status === 'drilled' && Number(k) !== sel);
      for (const [k] of pending) fixes.push(`螺孔 ${Number(k) + 1} 已鑽孔但未鎖釘：點選它並選擇長度，或取消此孔。`);
      if (fm.extraEffective) fixes.push(`有 ${fm.extraEffective} 支預設構型以外的螺釘：不扣分也不加分。`);
      return {
        doNow,
        objects: '骨板上的螺孔（點選）、鑽孔按鈕、量深規讀數、螺釘長度按鈕、移除按鈕。',
        rows: [
          { label: '近端有效皮質', value: `${fm.corticesProximal}`, target: '≥6（本關門檻）', level: fm.corticesProximal >= 6 ? 'pass' : 'fail' },
          { label: '遠端有效皮質', value: `${fm.corticesDistal}`, target: '≥6（本關門檻）', level: fm.corticesDistal >= 6 ? 'pass' : 'fail' },
          { label: '預設構型', value: `${fm.presetDone}/${fm.presetTotal}`, target: `${fm.presetTotal}/${fm.presetTotal}`, level: fm.presetComplete ? 'perfect' : 'adjust' },
          { label: '最近螺釘距骨折線', value: fm.minMargin === null ? '—' : `${f1(fm.minMargin)} mm`, target: '≥5 mm', level: fm.minMargin === null ? null : fm.marginLevel },
        ],
        fixes,
        ready: fm.passed,
      };
    }
    case 5: {
      const fixes: string[] = [];
      for (const v of ['primary', 'secondary'] as ViewKey[]) if (!s.viewsSeen[v]) fixes.push(`尚未檢視 ${m.views[v].label}：按上方「${m.views[v].label}」切換。`);
      const left = FINAL_CHECKS.filter((c) => !s.confirmed.includes(c.id));
      if (!fixes.length && left.length) fixes.push(`逐項按「確認」：${left.map((c) => c.label.split('：')[0]).join('、')}。`);
      return {
        doNow: fixes.length ? '在兩個正交視角確認復位、力線、植入物與抓持。' : '四項檢核皆已確認。按「完成檢核」完成手術。',
        objects: '視角切換按鈕、四個「確認」按鈕。',
        rows: FINAL_CHECKS.map((c) => ({ label: c.label.split('：')[0], value: s.confirmed.includes(c.id) ? '已確認' : '未確認', target: '確認', level: s.confirmed.includes(c.id) ? 'pass' : null })),
        fixes,
        ready: fixes.length === 0,
      };
    }
  }
}

/** Distance from current hole to evaluate if it would be effective with an ideal length (used in tests/UI). */
export const holeUsable = (m: FractureModel, s: T09State, i: number) => {
  const e = evaluateHole(m, s, i, null);
  return e.overBone && isPassing(e.marginLevel) && isPassing(e.articularLevel);
};
