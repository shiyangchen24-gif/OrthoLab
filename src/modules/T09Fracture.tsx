import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { holeOffset, plateLength, type ViewKey } from '../config/fractureCases';
import { TOLERANCES, isPassing } from '../config/tolerances';
import {
  FINAL_CHECKS,
  checkStep,
  clampMetrics,
  drill,
  evaluateHole,
  fixationMetrics,
  fractureSegment,
  getModel,
  initialT09,
  lockScrew,
  moveFragment,
  movePlate,
  pivot,
  plateById,
  plateMetrics,
  reductionMetrics,
  removeScrew,
  rotateFragment,
  scoreT09,
  selectHole,
  trySnap,
  topAt,
  bottomAt,
  boneExtent,
  type DrillBlock,
  type T09State,
} from '../engine/t09';
import { angleDiff, normalizeDeg, rad2deg, screenToModel, type Vec } from '../engine/geometry';
import { ModuleShell, CheckResult } from '../components/ModuleShell';
import { coachT09, type Coach } from '../engine/t09Coach';
import { useModuleState } from '../components/useModuleState';
import { FractureBones, FractureXRay, HoleSprite, Implants } from '../components/art/XRay';
import { illust } from '../components/illustrations';
import { Level, RefChips } from '../components/ui';
import { useStore } from '../store';
import { sound } from '../audio';
import type { ModuleResult } from '../engine/session';

/** painted hole markers: a ring around the hole / screw-head sprite instead of a filled dot */
const paintedHoles = !!illust('surgery/hole');

const STEPS = ['復位', '骨鉗暫夾', '骨板定位', '鑽孔鎖釘', '正交視角檢核'];

const HINTS: Record<number, string> = {
  1: '拖曳遠端骨段（虛線為目標位置）並拖曳藍色旋轉把手調整角度；也可用方向鍵移動、Q/E 旋轉（Shift 為微調）。兩個視角都要復位：用「切換視角」檢查另一平面。',
  2: '骨鉗要避開骨板將貼附的張力側骨面（上緣）。分別點選近端與遠端各一個夾持點。',
  3: '從器械盤選擇本病例預設骨板，拖到張力側骨面（上緣）。骨板需跨越骨折線、覆蓋率 ≥75%，且不可超出骨端。',
  4: '依預設構型（亮色孔位）逐孔「選孔 → 鑽孔 → 量深 → 選長度鎖入」。紅色帶為骨折線安全距，橘色帶為關節面避讓區。螺釘需略長於量規讀數但不可過長。',
  5: '切換兩個正交視角確認，再逐項勾選檢核。若任何一項未達標，需返回修正。',
};

export function T09Fracture({ caseId, onDone }: { caseId: string; onDone: (r: ModuleResult) => void }) {
  const m = getModel(caseId);
  const init = useCallback(() => initialT09(caseId), [caseId]);
  const ms = useModuleState<T09State>('PROC-ORIF-PLATE', init);
  const { data } = useStore();
  const snapEnabled = data.settings.snapAssist;
  const s = ms.state.caseId === caseId ? ms.state : init();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'warn'; text: string; items?: string[] } | null>(null);
  const [block, setBlock] = useState<DrillBlock>(null);
  const [zoom, setZoom] = useState(1);
  const stickyViolations = (ms.sticky.violations as string[] | undefined) ?? [];

  const red = reductionMetrics(s);
  const coach = coachT09(m, s);
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1800);
    return () => clearTimeout(t);
  }, [flash]);

  const apply = (next: T09State | ((p: T09State) => T09State), opts?: { record?: boolean }) => ms.set(next, opts);

  const runCheck = () => {
    const { state, passed } = checkStep(m, s);
    ms.recordFirst(`step${s.step}`, passed);
    apply(state);
    if (passed) {
      sound.play('success');
      setMsg({ kind: 'ok', text: `「${STEPS[s.step - 1]}」完成！${state.completed ? '' : `下一步：${STEPS[s.step]}。`}` });
      setFlash(`${STEPS[s.step - 1]}完成`);
      if (state.completed) {
        const sc = scoreT09(m, { ...state, violations: Array.from(new Set([...state.violations, ...stickyViolations])) });
        const firsts = [1, 2, 3, 4, 5].map((i) => ms.sticky[`step${i}`] ?? (i === s.step ? passed : undefined));
        onDone({
          score: sc.score,
          notes: [
            ...sc.notes,
            `首次檢核通過的步驟：${firsts.map((f, i) => (f ? i + 1 : null)).filter(Boolean).join('、') || '無'}（僅供回顧，不影響分數）。`,
          ],
          detail: { parts: sc.parts, deduction: sc.deduction },
        });
      }
    } else {
      sound.play('warn');
      setMsg({ kind: 'err', text: '未達完成門檻', items: coach.fixes.length ? coach.fixes : issuesFor(s) });
    }
  };

  function issuesFor(st: T09State): string[] {
    const out: string[] = [];
    const r = reductionMetrics(st);
    if (st.step === 1 || st.step === 2 || st.step === 5) {
      for (const v of ['primary', 'secondary'] as ViewKey[]) {
        const pv = r.perView[v];
        if (!isPassing(pv.angleLevel)) out.push(`${m.views[v].label}：成角偏差 ${pv.angle.toFixed(1)}°（門檻 ≤5°），請微調旋轉角度`);
        if (!isPassing(pv.transverseLevel)) out.push(`${m.views[v].label}：側向平移誤差 ${pv.transverse.toFixed(2)} mm（門檻 ≤1.0 mm）`);
      }
      if (!isPassing(r.axialLevel)) out.push(`軸向位移誤差（短縮／分離）${r.axial.toFixed(2)} mm（門檻 ≤1.0 mm）`);
    }
    if (st.step === 2) {
      const c = clampMetrics(m, st);
      if (!c.prox || !c.dist) out.push('請在近端與遠端各選一個夾持點');
      for (const l of c.onPath) out.push(`夾鉗壓在骨板預定路徑上（${l}），無法貼合骨板`);
    }
    if (st.step === 3 || st.step === 5) out.push(...plateMetrics(m, st).issues);
    if (st.step === 4 || st.step === 5) out.push(...fixationMetrics(m, st).issues);
    if (st.step === 5) {
      if (!st.viewsSeen.primary || !st.viewsSeen.secondary) out.push('請檢視兩個正交視角');
      const left = FINAL_CHECKS.filter((c) => !st.confirmed.includes(c.id));
      if (left.length) out.push(`尚未確認：${left.map((c) => c.label.split('：')[0]).join('、')}`);
    }
    return out.length ? out : ['請完成本步驟操作'];
  }

  // ---------- pointer handling (screen → model) ----------
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<null | { kind: 'frag' | 'rot' | 'plate'; last: Vec; grab?: number }>(null);
  const [plateGhostY, setPlateGhostY] = useState<number | null>(null);

  const toModel = (e: PointerEvent): Vec | null => {
    const svg = svgRef.current;
    const g = svg?.querySelector<SVGGElement>('#model-root');
    const ctm = g?.getScreenCTM();
    if (!ctm) return null;
    return screenToModel({ x: e.clientX, y: e.clientY }, ctm);
  };

  const view: ViewKey = s.step === 1 ? s.activeView : 'primary';
  const pose = s.views[view];
  const pivotNow: Vec = { x: pivot(m).x + s.dx, y: pose.dy };

  const onDown = (kind: 'frag' | 'rot' | 'plate') => (e: PointerEvent) => {
    const p = toModel(e);
    if (!p) return;
    e.stopPropagation();
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
    apply({ ...s }); // checkpoint for undo
    drag.current = { kind, last: p, grab: kind === 'plate' ? p.x - s.plate.x : undefined };
  };

  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toModel(e);
    if (!p) return;
    if (d.kind === 'frag') {
      apply((prev) => moveFragment(prev, { x: p.x - d.last.x, y: p.y - d.last.y }), { record: false });
    } else if (d.kind === 'rot') {
      const a0 = rad2deg(Math.atan2(d.last.y - pivotNow.y, d.last.x - pivotNow.x));
      const a1 = rad2deg(Math.atan2(p.y - pivotNow.y, p.x - pivotNow.x));
      apply((prev) => rotateFragment(prev, angleDiff(a1, a0)), { record: false });
    } else if (d.kind === 'plate') {
      setPlateGhostY(p.y);
      apply((prev) => movePlate(m, prev, p.x - (d.grab ?? 0), prev.plate.side), { record: false });
    }
    drag.current = { ...d, last: p };
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === 'plate') {
      const y = plateGhostY;
      setPlateGhostY(null);
      if (y !== null) {
        const surfTop = topAt(m, m.fracture.x);
        const surfBottom = bottomAt(m, m.fracture.x);
        const side = Math.abs(y - surfTop) < 9 ? 'tension' : Math.abs(y - surfBottom) < 9 ? 'compression' : null;
        apply((prev) => movePlate(m, prev, prev.plate.x, side), { record: false });
        if (side) sound.play('snap');
      }
      return;
    }
    let snappedNow = false;
    apply((prev) => {
      const n = trySnap(prev, snapEnabled);
      snappedNow = n !== prev;
      return n;
    }, { record: false });
    if (snappedNow) sound.play('snap');
  };

  // keyboard alternative to dragging
  const onKey = (e: KeyboardEvent) => {
    const fine = e.shiftKey;
    const st = fine ? 0.1 : 0.5;
    const rs = fine ? 0.1 : 1;
    let next: T09State | null = null;
    if (s.step === 1) {
      if (e.key === 'ArrowLeft') next = moveFragment(s, { x: -st, y: 0 });
      if (e.key === 'ArrowRight') next = moveFragment(s, { x: st, y: 0 });
      if (e.key === 'ArrowUp') next = moveFragment(s, { x: 0, y: -st });
      if (e.key === 'ArrowDown') next = moveFragment(s, { x: 0, y: st });
      if (e.key === 'q' || e.key === 'Q' || e.key === '[') next = rotateFragment(s, -rs);
      if (e.key === 'e' || e.key === 'E' || e.key === ']') next = rotateFragment(s, rs);
    } else if (s.step === 3) {
      if (e.key === 'ArrowLeft') next = movePlate(m, s, s.plate.x - st, s.plate.side);
      if (e.key === 'ArrowRight') next = movePlate(m, s, s.plate.x + st, s.plate.side);
    }
    if (next) {
      e.preventDefault();
      apply(next);
    }
  };

  // ---------- render helpers ----------
  const L = m.length;
  const half = boneExtent(m);
  const vb = { x: -14, y: -(half + 18), w: L + 28, h: (half + 18) * 2 };
  const fs = fractureSegment(m);
  const preset = m.plates.find((p) => p.isPreset)!;
  const plate = plateById(m, s.plate.plateId);
  const thick = m.caseId === 'C08' ? 1.5 : 1.1;

  const sel = s.selectedHole;
  const selEval = sel !== null ? evaluateHole(m, s, sel, s.holes[sel]?.length ?? null) : null;

  useEffect(() => setBlock(null), [sel, s.step]);

  const stepDone = (i: number) => (s.completed ? true : i + 1 < s.step);

  const nudge = (fn: (st: T09State) => T09State) => () => apply(fn(s));

  const angleNow = normalizeDeg(pose.theta);

  const tension = s.plate.side === 'tension';
  const plateY = (x: number) => topAt(m, Math.min(Math.max(x, 0), L)) - thick;

  const stageTitle = s.step === 1 ? `${m.views[view].label}（${m.views[view].projection}）` : `${m.views.primary.label}（${m.views.primary.projection}）`;

  return (
    <ModuleShell
      title={`T09 骨折復位與骨板固定・${m.boneName}`}
      subtitle={`${m.fracture.label}｜${m.plateSystemLabel}｜2D 教學示意，未驗證完整三維固定`}
      steps={STEPS}
      current={s.completed ? 5 : s.step - 1}
      done={stepDone}
      hint={<HintBody coach={coach} base={HINTS[s.step]} />}
      onUndo={ms.undo}
      onReset={() => {
        ms.reset();
        setMsg(null);
      }}
      canUndo={ms.canUndo}
      onHint={ms.countHint}
      extraTools={
        <>
          <span className="small muted" style={{ marginLeft: 8 }}>
            縮放
          </span>
          {[1, 1.5, 2].map((z) => (
            <button key={z} className="btn sm" aria-pressed={zoom === z} onClick={() => setZoom(z)}>
              {z * 100}%
            </button>
          ))}
          <span className="tag">磁吸輔助：{snapEnabled ? '開' : '關'}（設定可切換）</span>
        </>
      }
    >
      <div className="op-layout">
        <div>
          {s.step < 5 ? (
            <>
              <div className="row small muted" style={{ marginBottom: 4 }}>
                <span>{stageTitle}</span>
                <span className="spacer" />
                <span>側標 {m.sideLabel}・上緣＝{m.tensionSideLabel}</span>
              </div>
              <CoachBar coach={coach} />
              <div className="stage-wrap">
                {flash && (
                  <div className="stage-flash" role="status" data-testid="stage-flash">
                    <span aria-hidden>✓</span> {flash}
                  </div>
                )}
                <svg
                  ref={svgRef}
                  className="stage-svg"
                  style={{ width: `${zoom * 100}%` }}
                  viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
                  tabIndex={0}
                  role="application"
                  aria-label="手術操作區。方向鍵移動，Q/E 旋轉，Shift 微調。"
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onUp}
                  onKeyDown={onKey}
                  data-testid="t09-stage"
                >
                  <defs>
                    <linearGradient id="opBone" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#C7D7E8" />
                      <stop offset=".5" stopColor="#E2EDF8" />
                      <stop offset="1" stopColor="#B8CCE0" />
                    </linearGradient>
                    <linearGradient id="opPlate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#7DD3FC" />
                      <stop offset=".5" stopColor="#38BDF8" />
                      <stop offset="1" stopColor="#0E7490" />
                    </linearGradient>
                    <linearGradient id="opScrew" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0" stopColor="#94A3B8" />
                      <stop offset=".5" stopColor="#F1F5F9" />
                      <stop offset="1" stopColor="#94A3B8" />
                    </linearGradient>
                    <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse">
                      <path d="M5 0H0V5" fill="none" stroke="#38BDF8" strokeOpacity=".08" strokeWidth=".15" />
                    </pattern>
                  </defs>
                  <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="url(#grid)" />
                  <g id="model-root">
                    {/* target ghost (step 1) */}
                    {s.step === 1 && (
                      <g opacity=".5" pointerEvents="none">
                        <FractureBones m={m} s={{ dx: 0, views: { primary: { dy: 0, theta: 0 }, secondary: { dy: 0, theta: 0 } } }} view={view} xray={false} />
                      </g>
                    )}
                    {s.step === 1 && (
                      <g pointerEvents="none">
                        <rect x={-1} y={-half - 3} width={L + 2} height={(half + 3) * 2} fill="none" stroke="#38BDF8" strokeDasharray="1.5 1" strokeWidth=".25" opacity=".6" />
                      </g>
                    )}
                    {/* bones */}
                    <g opacity={s.step === 1 ? 0.98 : 1}>
                      <g pointerEvents="none">
                        <FractureBones m={m} s={s} view={view} xray={false} />
                      </g>
                      {s.step === 1 && (
                        <g
                          transform={`translate(${s.dx} ${pose.dy}) rotate(${pose.theta} ${m.fracture.x} 0)`}
                          style={{ cursor: 'grab' }}
                          onPointerDown={onDown('frag')}
                          data-testid="t09-fragment-hit"
                        >
                          <rect x={m.fracture.x - 2} y={-half - 1} width={L - m.fracture.x + 4} height={half * 2 + 2} fill="transparent" />
                        </g>
                      )}
                    </g>
                    {/* rotation handle + angle gauge */}
                    {s.step === 1 && (
                      <g>
                        <circle cx={pivotNow.x} cy={pivotNow.y} r={12} fill="none" stroke="#38BDF8" strokeOpacity=".4" strokeWidth=".3" strokeDasharray="1 1" pointerEvents="none" />
                        <line x1={pivotNow.x} y1={pivotNow.y} x2={pivotNow.x + 12} y2={pivotNow.y} stroke="#22C55E" strokeWidth=".3" strokeDasharray="1 .6" pointerEvents="none" />
                        <line
                          x1={pivotNow.x}
                          y1={pivotNow.y}
                          x2={pivotNow.x + 12 * Math.cos((angleNow * Math.PI) / 180)}
                          y2={pivotNow.y + 12 * Math.sin((angleNow * Math.PI) / 180)}
                          stroke="#38BDF8"
                          strokeWidth=".4"
                          pointerEvents="none"
                        />
                        <text x={pivotNow.x + 13} y={pivotNow.y - 13} fontSize="3" fill={isPassing(red.perView[view].angleLevel) ? '#22C55E' : '#FDE68A'}>
                          {Math.abs(angleNow).toFixed(1)}°
                        </text>
                        {/* handle sits perpendicular to the axis, off the bone, so it never steals fragment drags */}
                        <line
                          x1={pivotNow.x}
                          y1={pivotNow.y}
                          x2={pivotNow.x + 14 * Math.cos(((angleNow - 90) * Math.PI) / 180)}
                          y2={pivotNow.y + 14 * Math.sin(((angleNow - 90) * Math.PI) / 180)}
                          stroke="#0284C7"
                          strokeWidth=".3"
                          pointerEvents="none"
                        />
                        <g
                          transform={`translate(${pivotNow.x + 14 * Math.cos(((angleNow - 90) * Math.PI) / 180)} ${pivotNow.y + 14 * Math.sin(((angleNow - 90) * Math.PI) / 180)})`}
                          onPointerDown={onDown('rot')}
                          style={{ cursor: 'alias' }}
                          data-testid="t09-rotate-handle"
                        >
                          <circle r={3.4} fill="transparent" />
                          <circle r={1.8} fill="#0284C7" stroke="#E0F2FE" strokeWidth=".4" />
                          <path d="M-1 -.4 L0 -1.2 L1 -.4 M-1 .4 L0 1.2 L1 .4" stroke="#fff" strokeWidth=".25" fill="none" />
                        </g>
                      </g>
                    )}
                    {/* safety bands (step 4) */}
                    {s.step === 4 && (
                      <g pointerEvents="none">
                        <line x1={fs.a.x} y1={fs.a.y} x2={fs.b.x} y2={fs.b.y} stroke="#EF4444" strokeOpacity=".18" strokeWidth={TOLERANCES.fractureMargin.bands[2].min * 2} strokeLinecap="round" />
                        <line x1={fs.a.x} y1={fs.a.y} x2={fs.b.x} y2={fs.b.y} stroke="#EF4444" strokeOpacity=".25" strokeWidth={TOLERANCES.fractureMargin.bands[1].min * 2} strokeLinecap="round" />
                        {m.articular.map((a, i) => (
                          <line key={i} x1={a.a.x} y1={a.a.y} x2={a.b.x} y2={a.b.y} stroke="#F97316" strokeOpacity=".25" strokeWidth={TOLERANCES.articular.bands[2].min * 2} strokeLinecap="round" />
                        ))}
                      </g>
                    )}
                    <line x1={fs.a.x} y1={fs.a.y} x2={fs.b.x} y2={fs.b.y} stroke="#FDE68A" strokeWidth=".25" strokeDasharray=".8 .6" pointerEvents="none" />
                    {/* clamp (step ≥2) */}
                    <ClampLayer m={m} s={s} onPick={(id, side) => apply({ ...s, clamp: { ...s.clamp, [side]: id } })} />
                    {/* implants */}
                    {s.step >= 3 && plate && s.plate.side !== null && plateGhostY === null && <Implants m={m} s={s} view="primary" xray={false} />}
                    {s.step === 3 && plate && (s.plate.side === null || plateGhostY !== null) && (
                      <g transform={`translate(${s.plate.x} ${plateGhostY ?? half + 9})`} pointerEvents="none">
                        <rect width={plateLength(plate)} height={thick * 1.6} rx=".6" fill="url(#opPlate)" opacity=".9" />
                      </g>
                    )}
                    {s.step === 3 && plate && (
                      <rect
                        x={s.plate.x}
                        y={s.plate.side === null ? half + 7 : s.plate.side === 'tension' ? -half - 6 : half - 1}
                        width={plateLength(plate)}
                        height={7}
                        fill="transparent"
                        style={{ cursor: 'grab' }}
                        onPointerDown={onDown('plate')}
                        data-testid="t09-plate-hit"
                      />
                    )}
                    {/* holes (step ≥3) */}
                    {s.step >= 3 && plate && tension && plateGhostY === null && (
                      <g>
                        {Array.from({ length: plate.holes }, (_, i) => {
                          const x = s.plate.x + holeOffset(plate, i);
                          const y = plateY(x) - 2.2;
                          const h = s.holes[i];
                          const isPreset = plate.presetHoles.includes(i);
                          const ev = evaluateHole(m, s, i, h?.length ?? null);
                          const color = h?.status === 'locked' ? (ev.effective ? '#22C55E' : '#F59E0B') : h?.status === 'drilled' ? '#38BDF8' : isPreset ? '#E0F2FE' : '#475569';
                          return (
                            <g
                              key={i}
                              transform={`translate(${x} ${y})`}
                              onClick={() => s.step === 4 && apply(selectHole(s, i))}
                              style={{ cursor: s.step === 4 ? 'pointer' : 'default' }}
                              role={s.step === 4 ? 'button' : undefined}
                              aria-label={`螺孔 ${i + 1}${isPreset ? '（預設構型）' : ''}${h ? `，${h.status === 'locked' ? '已鎖釘' : '已鑽孔'}` : ''}`}
                              data-testid={`hole-${i}`}
                            >
                              <circle r={2.4} fill="transparent" />
                              <HoleSprite x={0} y={0} r={1.2} locked={h?.status === 'locked'} />
                              <circle r={1.2} fill={paintedHoles ? 'none' : h ? color : 'none'} stroke={color} strokeWidth={paintedHoles ? (isPreset || h ? 0.5 : 0.3) : isPreset ? 0.45 : 0.25} strokeDasharray={isPreset || h ? undefined : '.5 .4'} />
                              {sel === i && <circle r={2} fill="none" stroke="#F97316" strokeWidth=".4" />}
                              <text y={-1.8} fontSize="1.9" textAnchor="middle" fill="#8FB3CC">
                                {i + 1}
                              </text>
                            </g>
                          );
                        })}
                        {/* drilled holes shown as dashed tracks */}
                        {Object.entries(s.holes)
                          .filter(([, h]) => h.status === 'drilled')
                          .map(([k]) => {
                            const x = s.plate.x + holeOffset(plate, Number(k));
                            return <line key={k} x1={x} y1={topAt(m, x)} x2={x} y2={bottomAt(m, x)} stroke="#38BDF8" strokeWidth=".5" strokeDasharray=".6 .4" pointerEvents="none" />;
                          })}
                      </g>
                    )}
                    {block && sel !== null && plate && (
                      <g transform={`translate(${s.plate.x + holeOffset(plate, sel)} ${plateY(s.plate.x + holeOffset(plate, sel)) - 5.5})`} pointerEvents="none">
                        <circle r="2" fill="#7F1D1D" stroke="#EF4444" strokeWidth=".4" />
                        <line x1="-1.3" y1="1.3" x2="1.3" y2="-1.3" stroke="#FECACA" strokeWidth=".45" />
                      </g>
                    )}
                  </g>
                </svg>
              </div>
              {s.step === 1 && (
                <div className="row" style={{ marginTop: 8 }}>
                  <span className="small muted">目前操作視角：</span>
                  {(['primary', 'secondary'] as ViewKey[]).map((v) => (
                    <button key={v} className="btn sm" aria-pressed={s.activeView === v} onClick={() => apply({ ...s, activeView: v }, { record: false })} data-testid={`view-${v}`}>
                      {m.views[v].label}
                    </button>
                  ))}
                  <span className="spacer" />
                  <div className="row" aria-label="微調按鈕">
                    <button className="btn sm" onClick={nudge((x) => moveFragment(x, { x: -0.5, y: 0 }))} aria-label="向近端移 0.5 mm">◀ 0.5</button>
                    <button className="btn sm" onClick={nudge((x) => moveFragment(x, { x: 0.5, y: 0 }))} aria-label="向遠端移 0.5 mm">0.5 ▶</button>
                    <button className="btn sm" onClick={nudge((x) => moveFragment(x, { x: 0, y: -0.1 }))} aria-label="上移 0.1 mm">▲ 0.1</button>
                    <button className="btn sm" onClick={nudge((x) => moveFragment(x, { x: 0, y: 0.1 }))} aria-label="下移 0.1 mm">▼ 0.1</button>
                    <button className="btn sm" onClick={nudge((x) => rotateFragment(x, -1))} aria-label="逆時針旋轉 1 度">⟲ 1°</button>
                    <button className="btn sm" onClick={nudge((x) => rotateFragment(x, 1))} aria-label="順時針旋轉 1 度">⟳ 1°</button>
                    <button className="btn sm" onClick={nudge((x) => rotateFragment(x, -0.1))} aria-label="逆時針旋轉 0.1 度">⟲ .1°</button>
                    <button className="btn sm" onClick={nudge((x) => rotateFragment(x, 0.1))} aria-label="順時針旋轉 0.1 度">⟳ .1°</button>
                  </div>
                </div>
              )}
              {s.step === 3 && (
                <div className="stack" style={{ marginTop: 8 }}>
                  <div className="row">
                    <span className="small muted">器械盤：</span>
                    {m.plates.map((p) => (
                      <button
                        key={p.id}
                        className="btn sm"
                        aria-pressed={s.plate.plateId === p.id}
                        onClick={() => apply({ ...s, plate: { plateId: p.id, x: s.plate.plateId ? s.plate.x : 4, side: s.plate.side } })}
                        data-testid={`plate-${p.id}`}
                      >
                        {p.label}・{plateLength(p).toFixed(1)} mm
                      </button>
                    ))}
                  </div>
                  <div className="row">
                    <button className="btn sm" disabled={!plate} onClick={() => apply(movePlate(m, s, s.plate.x, 'tension'))} data-testid="plate-tension">
                      貼附{m.tensionSideLabel}
                    </button>
                    <button className="btn sm" disabled={!plate} onClick={() => apply(movePlate(m, s, s.plate.x, 'compression'))}>
                      貼附{m.compressionSideLabel}
                    </button>
                    {[-5, -0.5, 0.5, 5].map((d) => (
                      <button key={d} className="btn sm" disabled={!plate} onClick={() => apply(movePlate(m, s, s.plate.x + d, s.plate.side))} data-testid={`plate-move-${d}`}>
                        {d < 0 ? '◀' : '▶'} {Math.abs(d)} mm
                      </button>
                    ))}
                  </div>
                  <p className="small muted">也可直接拖曳骨板到骨面上緣（張力側）放開即貼附；方向鍵 ◀▶ 微調。</p>
                </div>
              )}
              {s.step === 4 && (
                <ScrewPanel
                  m={m}
                  s={s}
                  selEval={selEval}
                  block={block}
                  onDrill={() => {
                    const r = drill(m, s);
                    setBlock(r.block);
                    if (r.block) {
                      sound.play('warn');
                      ms.addSticky('violations', r.state.violations);
                      apply(r.state, { record: false });
                    } else {
                      sound.play('click');
                      apply(r.state);
                    }
                  }}
                  onLock={(len) => {
                    sound.play('lock');
                    apply(lockScrew(s, len));
                  }}
                  onRemove={(i) => apply(removeScrew(s, i))}
                />
              )}
            </>
          ) : (
            <>
              <CoachBar coach={coach} />
              <FinalCheck m={m} s={s} apply={apply} />
            </>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <button className={`btn lg ${coach.ready ? 'accent' : 'primary'}`} onClick={runCheck} disabled={s.completed} data-testid="t09-check" data-ready={coach.ready ? 'y' : 'n'}>
              ✔ 完成檢核：{STEPS[s.step - 1]}
              {coach.ready && <span className="small">（已達標，可進入下一步）</span>}
            </button>
            {s.step === 2 && (
              <span className="small muted">夾持後遠端骨段會鎖定；之後若需調整復位，請使用撤銷。</span>
            )}
          </div>
          <div style={{ marginTop: 8 }} aria-live="polite">
            {msg && <CheckResult ok={msg.kind === 'ok'} items={msg.items ?? []} okText={msg.text} />}
          </div>
        </div>
        <aside className="stack">
          <CoachPanel coach={coach} />
          <details className="card small">
            <summary>
              <b>本關說明（遊戲幾何門檻，非臨床標準）</b>
            </summary>
            <p style={{ marginTop: 4 }}>
              以下皆為<b>遊戲幾何門檻</b>，不是臨床標準；數值達標或未達標都不能推論必然癒合或發生併發症。
            </p>
            <p>預設骨板：{preset.label}（{m.plateSystemLabel}）。</p>
            {m.notes.map((n) => (
              <p key={n} className="muted">
                {n}
              </p>
            ))}
            <RefChips ids={['R13', 'R14', 'G01']} />
          </details>
        </aside>
      </div>
    </ModuleShell>
  );
}

function ClampLayer({ m, s, onPick }: { m: ReturnType<typeof getModel>; s: T09State; onPick: (id: string, side: 'proximal' | 'distal') => void }) {
  if (s.step < 2) return null;
  const chosen = [s.clamp.proximal, s.clamp.distal].map((id) => m.clampPoints.find((c) => c.id === id)).filter(Boolean) as typeof m.clampPoints;
  const showClamp = chosen.length === 2 && s.step <= 3;
  return (
    <g>
      {s.step === 2 &&
        m.clampPoints.map((c) => {
          const picked = s.clamp[c.side] === c.id;
          return (
            <g
              key={c.id}
              transform={`translate(${c.at.x} ${c.at.y})`}
              onClick={() => onPick(c.id, c.side)}
              style={{ cursor: 'pointer' }}
              role="button"
              aria-label={`夾持點：${c.label}${picked ? '（已選）' : ''}`}
              data-testid={`clamp-${c.id}`}
            >
              <circle r={3} fill="transparent" />
              <circle r={1.4} fill={picked ? '#F97316' : '#0B1924'} stroke={picked ? '#FDBA74' : '#38BDF8'} strokeWidth=".35" />
              <text y={c.at.y < 0 ? -2.4 : 4} fontSize="2" textAnchor="middle" fill="#BAE6FD">
                {c.label}
              </text>
            </g>
          );
        })}
      {showClamp && (
        <g pointerEvents="none" aria-hidden>
          {/* Kern bone-holding clamp: two jaws joined by a handle below the bone */}
          {chosen.map((c) => (
            <path key={c.id} d={`M${c.at.x - 1.2} ${c.at.y} q1.2 ${c.at.y < 0 ? -2.4 : 2.4} 2.4 0`} fill="none" stroke="url(#opScrew)" strokeWidth=".9" strokeLinecap="round" />
          ))}
          <path
            d={`M${chosen[0].at.x} ${chosen[0].at.y + (chosen[0].at.y < 0 ? -1.6 : 1.6)} L${(chosen[0].at.x + chosen[1].at.x) / 2} ${Math.abs(chosen[0].at.y) + 9} L${chosen[1].at.x} ${chosen[1].at.y + (chosen[1].at.y < 0 ? -1.6 : 1.6)}`}
            fill="none"
            stroke="#CBD5E1"
            strokeWidth=".8"
            strokeLinejoin="round"
          />
          <rect x={(chosen[0].at.x + chosen[1].at.x) / 2 - 1} y={Math.abs(chosen[0].at.y) + 9} width="2" height="8" rx=".8" fill="#94A3B8" />
        </g>
      )}
    </g>
  );
}

function ScrewPanel({
  m,
  s,
  selEval,
  block,
  onDrill,
  onLock,
  onRemove,
}: {
  m: ReturnType<typeof getModel>;
  s: T09State;
  selEval: ReturnType<typeof evaluateHole> | null;
  block: DrillBlock;
  onDrill: () => void;
  onLock: (len: number) => void;
  onRemove: (i: number) => void;
}) {
  const i = s.selectedHole;
  const h = i !== null ? s.holes[i] : undefined;
  return (
    <div className="card" style={{ marginTop: 8 }}>
      {i === null || !selEval ? (
        <p className="small muted" style={{ margin: 0 }}>
          請點選骨板上的螺孔（亮色實線圈＝本病例預設構型）。
        </p>
      ) : (
        <div className="stack">
          <div className="row">
            <b>螺孔 {i + 1}</b>
            {selEval.preset ? <span className="tag ok">預設構型</span> : <span className="tag">非預設孔位（不加分）</span>}
            <span className="tag">{selEval.fragment === 'proximal' ? '近端骨段' : selEval.fragment === 'distal' ? '遠端骨段' : '無骨質'}</span>
            <span className="small">
              距骨折線 {selEval.fractureMargin.toFixed(1)} mm <Level level={selEval.marginLevel} />
            </span>
            <span className="small">
              距關節面 {selEval.articular.toFixed(1)} mm <Level level={selEval.articularLevel} />
            </span>
          </div>
          {block && (
            <div className="banner err" role="alert">
              <span aria-hidden>⛔</span>
              <span>{block.message}</span>
            </div>
          )}
          {!h && (
            <div className="row">
              <button className="btn primary" onClick={onDrill} data-testid="drill">
                🛠 鑽孔
              </button>
              <span className="small muted">鑽孔後以量深規測量骨厚度。</span>
            </div>
          )}
          {h?.status === 'drilled' && (
            <div className="stack">
              <div className="row">
                <Gauge reading={h.gauge} />
                <span className="small">量深規讀數：<b data-testid="gauge-reading">{h.gauge.toFixed(1)} mm</b>。選擇螺釘長度鎖入：</span>
              </div>
              <div className="row">
                {m.screwLengths.map((len) => (
                  <button key={len} className="btn sm" onClick={() => onLock(len)} data-testid={`len-${len}`}>
                    {len} mm
                  </button>
                ))}
                <button className="btn sm danger" onClick={() => onRemove(i)}>
                  取消此孔
                </button>
              </div>
            </div>
          )}
          {h?.status === 'locked' && (
            <div className="row">
              <span className="small">
                已鎖入 {h.length} mm 螺釘：{selEval.effective ? <Level level="pass" /> : <Level level="adjust" />} {selEval.cortices === 2 ? '雙皮質' : selEval.cortices === 1 ? '單皮質' : ''}
              </span>
              {selEval.issues.length > 0 && <span className="small" style={{ color: '#FDE68A' }}>{selEval.issues.join('；')}</span>}
              <button className="btn sm danger" onClick={() => onRemove(i)}>
                移除螺釘
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Gauge({ reading }: { reading: number }) {
  // a small depth gauge illustration; the reading comes from the model thickness
  const w = Math.min(30, reading * 2.2);
  return (
    <svg viewBox="0 0 40 14" width="120" height="42" aria-label={`量深規 ${reading} mm`}>
      <rect x="2" y="5" width="36" height="4" rx="1" fill="url(#gaugeG)" />
      <defs>
        <linearGradient id="gaugeG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F1F5F9" />
          <stop offset="1" stopColor="#94A3B8" />
        </linearGradient>
      </defs>
      {Array.from({ length: 16 }, (_, k) => (
        <line key={k} x1={4 + k * 2} y1="5" x2={4 + k * 2} y2={k % 5 === 0 ? 3 : 4} stroke="#CBD5E1" strokeWidth=".3" />
      ))}
      <rect x={4} y="6" width={w} height="2" fill="#38BDF8" />
      <path d={`M${4 + w} 9 v3`} stroke="#F97316" strokeWidth=".6" />
    </svg>
  );
}

function FinalCheck({ m, s, apply }: { m: ReturnType<typeof getModel>; s: T09State; apply: (n: T09State | ((p: T09State) => T09State), o?: { record?: boolean }) => void }) {
  const [view, setView] = useState<ViewKey>('primary');
  useEffect(() => {
    if (!s.viewsSeen[view]) apply({ ...s, viewsSeen: { ...s.viewsSeen, [view]: true } }, { record: false });
  }, [view, s, apply]);
  const red = reductionMetrics(s);
  const pm = plateMetrics(m, s);
  const fm = fixationMetrics(m, s);
  const status: Record<string, boolean> = {
    reduction: isPassing(red.displacementLevel),
    alignment: isPassing(red.angleLevel),
    implant: pm.passed,
    purchase: fm.passed,
  };
  const both = s.viewsSeen.primary && s.viewsSeen.secondary;
  return (
    <div className="stack">
      <div className="row">
        <span className="small muted">術後正交 X 光（教學示意）：</span>
        {(['primary', 'secondary'] as ViewKey[]).map((v) => (
          <button key={v} className="btn sm" aria-pressed={view === v} onClick={() => setView(v)} data-testid={`final-view-${v}`}>
            {m.views[v].label} {s.viewsSeen[v] ? '✓' : ''}
          </button>
        ))}
      </div>
      <div style={{ maxWidth: 760 }}>
        <SingleView caseId={m.caseId} s={s} view={view} />
      </div>
      <div className="card">
        <b>四項檢核（T09-S5）</b>
        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
          {FINAL_CHECKS.map((c) => {
            const ok = status[c.id];
            const confirmed = s.confirmed.includes(c.id);
            return (
              <li key={c.id} className="row" style={{ marginBottom: 6 }}>
                <span aria-hidden>{ok ? '✓' : '✕'}</span>
                <span style={{ flex: 1 }}>
                  {c.label} {ok ? <Level level="pass" /> : <Level level="fail" />}
                </span>
                <button
                  className="btn sm"
                  disabled={!ok || !both || confirmed}
                  onClick={() => apply({ ...s, confirmed: [...s.confirmed, c.id] })}
                  data-testid={`confirm-${c.id}`}
                >
                  {confirmed ? '已確認' : '確認'}
                </button>
              </li>
            );
          })}
        </ul>
        {!both && <p className="small muted">請先檢視兩個視角，才能確認檢核項目。</p>}
      </div>
    </div>
  );
}

function SingleView({ caseId, s, view }: { caseId: string; s: T09State; view: ViewKey }) {
  return (
    <div data-testid={`final-xray-${view}`}>
      <FractureXRay caseId={caseId} state={s} showImplants only={view} />
    </div>
  );
}

function HintBody({ coach, base }: { coach: Coach; base: string }) {
  return (
    <div className="stack">
      <p>
        <b>現在：</b>
        {coach.doNow}
      </p>
      {coach.fixes.length > 0 && (
        <ul>
          {coach.fixes.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
      <p className="small muted">{base}</p>
    </div>
  );
}

/** One-line "what to do now" above the stage. */
function CoachBar({ coach }: { coach: Coach }) {
  return (
    <div className={`coach-bar ${coach.ready ? 'ready' : ''}`} role="status" aria-live="polite" data-testid="coach-bar">
      <span aria-hidden>{coach.ready ? '✓' : '➜'}</span>
      <div>
        <b>{coach.doNow}</b>
        {!coach.ready && coach.fixes[0] && <div className="small">{coach.fixes[0]}</div>}
      </div>
    </div>
  );
}

function CoachPanel({ coach }: { coach: Coach }) {
  return (
    <div className="hud" aria-label="操作指引" data-testid="coach-panel">
      <b style={{ color: '#E0F2FE' }}>操作指引</b>
      <p className="small" style={{ margin: '4px 0' }}>
        <span className="muted">可操作：</span>
        {coach.objects}
      </p>
      <table aria-label="即時量測">
        <thead>
          <tr className="small muted">
            <td>項目</td>
            <td style={{ textAlign: 'right' }}>目前 ／ 目標</td>
          </tr>
        </thead>
        <tbody>
          {coach.rows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td>
                {r.value} <span className="muted small">／ {r.target}</span> {r.level && <Level level={r.level} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small muted" style={{ margin: '6px 0 0' }}>
        數值為遊戲幾何量測；「位移誤差」是骨段參考點與目標的距離，不是臨床骨折間隙。
      </p>
      {coach.fixes.length > 0 && (
        <details open style={{ marginTop: 6 }}>
          <summary className="small">未達標原因與修正方式（{coach.fixes.length}）</summary>
          <ul className="small" style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {coach.fixes.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
