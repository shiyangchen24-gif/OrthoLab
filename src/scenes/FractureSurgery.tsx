// Scene-based T09 surgery (used for C07). Same engine, save key and scoring as
// the classic T09 screen; only the interaction is tool-driven:
//   骨段 drag/rotate → 骨鉗 place → 骨板 choose/drag/align → 鑽孔器 hold on a
//   hole → 量深規 → 螺釘 choose length & lock → C 臂 orthogonal shots → checks.
// All judgements run on model coordinates via the svg CTM; zoom never matters.

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { holeOffset, plateLength, type ViewKey } from '../config/fractureCases';
import { isPassing, TOLERANCES } from '../config/tolerances';
import {
  FINAL_CHECKS,
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
  pivot,
  plateById,
  plateMetrics,
  reductionMetrics,
  removeScrew,
  rotateFragment,
  scoreT09,
  trySnap,
  topAt,
  bottomAt,
  boneExtent,
  type T09State,
} from '../engine/t09';
import { coachT09 } from '../engine/t09Coach';
import { angleDiff, normalizeDeg, rad2deg, screenToModel, type Vec } from '../engine/geometry';
import { useModuleState } from '../components/useModuleState';
import { FractureBones, FractureXRay, HoleSprite, Implants, PLATE_THICKNESS } from '../components/art/XRay';
import { Level, RefChips } from '../components/ui';
import { CASE_META } from '../data/caseMeta';
import { caseById } from '../data';
import { useStore } from '../store';
import { sound } from '../audio';
import type { ModuleResult } from '../engine/session';
import { DragGhost, TaskHint, ToolInfo, ToolTray, Zone, useFeedback, useHold, useTrayDrag, type ToolDef } from './ToolKit';
import { SceneShell, usePortrait } from './SceneShell';
import { SceneDog, ExamTable } from './art';
import { illust } from '../components/illustrations';

const STEP_NAMES = ['復位', '骨鉗暫夾', '骨板定位', '鑽孔與鎖釘', '正交影像檢核'];
const STEP_TOOL: Record<number, string[]> = { 1: ['grasp'], 2: ['clamp'], 3: ['plate'], 4: ['drill', 'gauge', 'screw'], 5: ['carm'] };
const HOLD_MS = 900;

interface Extra {
  intro: boolean;
  measured: number[];
}

export function FractureSurgery({ caseId, onDone }: { caseId: string; onDone: (r: ModuleResult) => void }) {
  const m = getModel(caseId);
  const c = caseById(caseId)!;
  const drape = illust('surgery/drape');
  // painted hole markers replace the filled status dots with a ring around the sprite
  const painted = !!illust('surgery/hole');
  const init = useCallback(() => initialT09(caseId), [caseId]);
  const ms = useModuleState<T09State>('PROC-ORIF-PLATE', init);
  const ex = useModuleState<Extra>('scene:T09', () => ({ intro: false, measured: [] }));
  const { data } = useStore();
  const snapEnabled = data.settings.snapAssist;
  const s = ms.state.caseId === caseId ? ms.state : init();
  const coach = coachT09(m, s);
  const { fb, say } = useFeedback();
  const [selected, setSelected] = useState<string | null>(null);
  const [screwLen, setScrewLen] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const portrait = usePortrait();
  const [pop, setPop] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const stickyViolations = (ms.sticky.violations as string[] | undefined) ?? [];
  const measured = ex.state.measured.filter((i) => s.holes[i]);
  const apply = (next: T09State | ((p: T09State) => T09State), opts?: { record?: boolean }) => ms.set(next, opts);
  const flash = (z: string) => {
    setPop(z);
    window.setTimeout(() => setPop((p) => (p === z ? null : p)), 700);
  };

  // ---------- step completion ----------
  // guards against double completion of the SAME step (auto-advance + click); a new step is never blocked
  const advancing = useRef(0);
  const complete = useCallback(() => {
    if (advancing.current === s.step) return;
    const { state, passed } = checkStep(m, s);
    ms.recordFirst(`step${s.step}`, passed);
    if (!passed) {
      sound.play('warn');
      say('warn', coach.fixes[0] ?? '尚未達標。');
      return;
    }
    advancing.current = s.step;
    apply(state);
    sound.play('success');
    setCelebrate(`${STEP_NAMES[s.step - 1]}完成`);
    setSelected(null);
    window.setTimeout(() => setCelebrate(null), 1400);
    if (state.completed) {
      const sc = scoreT09(m, { ...state, violations: Array.from(new Set([...state.violations, ...stickyViolations])) });
      window.setTimeout(() => onDone({ score: sc.score, notes: sc.notes, detail: { parts: sc.parts, deduction: sc.deduction } }), 900);
    } else say('ok', `${STEP_NAMES[s.step - 1]}完成！下一步：${STEP_NAMES[s.step]}。`);
  }, [m, s, coach.fixes, stickyViolations]); // eslint-disable-line react-hooks/exhaustive-deps

  // discrete steps (clamp, screws, checks) finish by themselves once every criterion is met
  useEffect(() => {
    if ((s.step === 2 || s.step === 4 || s.step === 5) && coach.ready && !s.completed && advancing.current !== s.step) {
      const t = window.setTimeout(complete, 650);
      return () => window.clearTimeout(t);
    }
  }, [s.step, coach.ready, s.completed, complete]);

  // ---------- tools ----------
  const tools: ToolDef[] = [
    { id: 'grasp', icon: 'grasp', name: '骨段復位', purpose: '拖曳遠端骨段；用藍色把手或按鈕旋轉微調', where: '遠端骨段（虛線為目標位置）' },
    { id: 'clamp', icon: 'clamp', name: '骨鉗', purpose: '暫時夾住復位後的骨段', where: '骨折線兩側的夾持點（避開骨板將貼附的上緣）' },
    { id: 'plate', icon: 'plate', name: '骨板', purpose: '選規格 → 拖到骨面 → 沿骨軸對齊', where: `${m.tensionSideLabel}（上緣）` },
    { id: 'drill', icon: 'drill', name: '鑽孔器', purpose: '對準有效螺孔，按住約 1 秒（遊戲互動，不代表真實手術時間）', where: '骨板上亮起的預設螺孔' },
    { id: 'gauge', icon: 'gauge', name: '量深規', purpose: '測量已鑽孔的骨厚度', where: '已鑽孔的螺孔' },
    { id: 'screw', icon: 'screw', name: '螺釘', purpose: '選長度後鎖入；點已鎖入但無效的螺釘可退出', where: '已量深的螺孔' },
    { id: 'carm', icon: 'carm', name: 'C 臂 X 光', purpose: '拍攝兩個正交視角', where: '右側兩個片匣（Lat、AP）' },
  ].map((t) => {
    const stepOf = Number(Object.entries(STEP_TOOL).find(([, ids]) => ids.includes(t.id))![0]);
    return {
      ...(t as ToolDef),
      locked: s.completed ? '手術已完成' : stepOf > s.step ? `先完成「${STEP_NAMES[s.step - 1]}」` : stepOf < s.step ? '此步驟已完成' : null,
      done: stepOf < s.step || s.completed,
    };
  });
  const sel = tools.find((t) => t.id === selected) ?? null;

  // ---------- hole actions ----------
  const doDrill = useCallback(
    (zone: string) => {
      const i = Number(zone.replace('hole-', ''));
      if (s.holes[i]) return say('info', `螺孔 ${i + 1} 已鑽孔。`);
      const r = drill(m, { ...s, selectedHole: i });
      if (r.block) {
        ms.addSticky('violations', r.state.violations);
        apply({ ...r.state, selectedHole: null }, { record: false });
        sound.play('warn');
        flash(zone);
        return say('warn', r.block.message);
      }
      apply({ ...r.state, selectedHole: null });
      sound.play('lock');
      flash(zone);
      say('ok', `螺孔 ${i + 1} 鑽孔完成。接著用「量深規」測量。`);
    },
    [m, s], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const { hold, begin: beginHold, cancel: cancelHold } = useHold(HOLD_MS, doDrill);

  const use = useCallback(
    (tool: string | null, zone: string) => {
      if (!tool) return say('info', '先從下方工具盤選一個器械（點選或拖曳）。');
      const t = tools.find((x) => x.id === tool)!;
      if (t.locked) return say('warn', `${t.name}：${t.locked}。`);
      if (tool === 'grasp') return say('info', '直接拖曳遠端骨段；旋轉請拖藍色把手或用 ⟲ ⟳ 按鈕。');
      if (tool === 'clamp') {
        const cp = m.clampPoints.find((p) => `clamp-${p.id}` === zone);
        if (!cp) return say('warn', '骨鉗要放在骨折線兩側的夾持點上。');
        if (cp.onPlatePath) {
          sound.play('warn');
          flash(zone);
          const alt = m.clampPoints.find((p) => p.side === cp.side && !p.onPlatePath);
          return say('warn', `「${cp.label}」會擋住骨板貼附的${m.tensionSideLabel}，請改放「${alt?.label}」。`);
        }
        apply({ ...s, clamp: { ...s.clamp, [cp.side]: cp.id } });
        sound.play('snap');
        flash(zone);
        return say('ok', `骨鉗夾住${cp.label}。`);
      }
      if (tool === 'plate') {
        if (zone !== 'bone-top' && zone !== 'bone-bottom') return say('warn', '骨板要放到骨面上。');
        if (!s.plate.plateId) return say('warn', '先在下方選擇骨板規格。');
        const side = zone === 'bone-top' ? 'tension' : 'compression';
        apply(movePlate(m, s, s.plate.side ? s.plate.x : 4, side));
        sound.play('snap');
        return say(side === 'tension' ? 'ok' : 'warn', side === 'tension' ? '骨板貼上張力側。接著沿骨軸拖曳對齊。' : `骨板放在${m.compressionSideLabel}：力學力矩不足，請改放上緣。`);
      }
      if (!zone.startsWith('hole-')) return say('warn', `${t.name}要用在骨板的螺孔上。`);
      const i = Number(zone.replace('hole-', ''));
      const h = s.holes[i];
      if (tool === 'drill') return say('info', `按住螺孔 ${i + 1} 約 1 秒鑽孔（鍵盤：按住 Enter）。`);
      if (tool === 'gauge') {
        if (!h) return say('warn', '量深規要用在已鑽孔的螺孔。');
        if (!measured.includes(i)) ex.set((p) => ({ ...p, measured: [...p.measured, i] }));
        sound.play('click');
        flash(zone);
        return say('ok', `螺孔 ${i + 1} 量深 ${h.gauge.toFixed(1)} mm：選擇 ≥${h.gauge.toFixed(1)} 且不超過 ${(h.gauge + 2).toFixed(1)} mm 的螺釘。`);
      }
      if (tool === 'screw') {
        if (h?.status === 'locked') {
          const e = evaluateHole(m, s, i, h.length);
          if (e.effective) return say('info', `螺孔 ${i + 1} 的螺釘有效，不需要重鎖。`);
          apply(removeScrew({ ...s, selectedHole: i }, i));
          return say('info', `已退出螺孔 ${i + 1} 的螺釘，請重新鑽孔、量深再選長度。`);
        }
        if (!h) return say('warn', `螺孔 ${i + 1} 還沒鑽孔。`);
        if (!measured.includes(i)) return say('warn', `先用「量深規」測量螺孔 ${i + 1}。`);
        if (screwLen === null) return say('warn', '先在下方選擇螺釘長度。');
        const next = lockScrew({ ...s, selectedHole: i }, screwLen);
        apply(next);
        const e = evaluateHole(m, next, i, screwLen);
        flash(zone);
        if (e.effective) {
          sound.play('lock');
          return say('ok', `螺孔 ${i + 1} 鎖入 ${screwLen} mm 雙皮質螺釘。`);
        }
        sound.play('warn');
        return say('warn', `螺孔 ${i + 1}：${e.issues.join('；')}。再用螺釘點一下可退出。`);
      }
      return undefined;
    },
    [tools, s, m, measured, screwLen], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const onDrop = useCallback((tool: string, zone: string) => use(tool, zone), [use]);
  const onTap = useCallback((tool: string) => {
    sound.play('click');
    setSelected((cur) => (cur === tool ? null : tool));
  }, []);
  const { drag: trayDrag, begin } = useTrayDrag(onDrop, onTap);
  const hover = trayDrag?.zone ?? null;
  const zp = { selected, hover, onUse: (z: string) => use(selected, z) };

  // ---------- direct manipulation: fragment, rotation handle, plate ----------
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<null | { kind: 'frag' | 'rot' | 'plate'; last: Vec; grab?: number }>(null);
  const [plateGhostY, setPlateGhostY] = useState<number | null>(null);
  const view: ViewKey = s.step === 1 ? s.activeView : 'primary';
  const pose = s.views[view];
  const pivotNow: Vec = { x: pivot(m).x + s.dx, y: pose.dy };
  const toModel = (e: PointerEvent): Vec | null => {
    const ctm = svgRef.current?.querySelector<SVGGElement>('#model-root')?.getScreenCTM();
    return ctm ? screenToModel({ x: e.clientX, y: e.clientY }, ctm) : null;
  };
  const onDown = (kind: 'frag' | 'rot' | 'plate') => (e: PointerEvent) => {
    const need = kind === 'plate' ? 'plate' : 'grasp';
    if (selected !== need) {
      say('info', `先拿起「${tools.find((t) => t.id === need)!.name}」工具。`);
      return;
    }
    const p = toModel(e);
    if (!p) return;
    e.stopPropagation();
    e.preventDefault();
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* best-effort */
    }
    apply({ ...s }); // undo checkpoint
    dragRef.current = { kind, last: p, grab: kind === 'plate' ? p.x - s.plate.x : undefined };
  };
  const onMove = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const p = toModel(e);
    if (!p) return;
    if (d.kind === 'frag') apply((prev) => moveFragment(prev, { x: p.x - d.last.x, y: p.y - d.last.y }), { record: false });
    else if (d.kind === 'rot') {
      const a0 = rad2deg(Math.atan2(d.last.y - pivotNow.y, d.last.x - pivotNow.x));
      const a1 = rad2deg(Math.atan2(p.y - pivotNow.y, p.x - pivotNow.x));
      apply((prev) => rotateFragment(prev, angleDiff(a1, a0)), { record: false });
    } else {
      setPlateGhostY(p.y);
      apply((prev) => movePlate(m, prev, p.x - (d.grab ?? 0), prev.plate.side), { record: false });
    }
    dragRef.current = { ...d, last: p };
  };
  const onUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
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
    let snapped = false;
    apply(
      (prev) => {
        const n = trySnap(prev, snapEnabled);
        snapped = n !== prev;
        return n;
      },
      { record: false },
    );
    if (snapped) sound.play('snap');
  };
  const onKey = (e: KeyboardEvent) => {
    const st = e.shiftKey ? 0.1 : 0.5;
    const rs = e.shiftKey ? 0.1 : 1;
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

  // ---------- geometry for rendering ----------
  const L = m.length;
  const half = boneExtent(m);
  const vb = { x: -12, y: -(half + 22), w: L + 24, h: (half + 22) * 2 + 10 };
  const fs = fractureSegment(m);
  const th = PLATE_THICKNESS[m.caseId] ?? 1.2;
  const plate = plateById(m, s.plate.plateId);
  const red = reductionMetrics(s);
  const angleNow = normalizeDeg(pose.theta);
  const handle = {
    x: pivotNow.x + 15 * Math.cos(((angleNow - 90) * Math.PI) / 180),
    y: pivotNow.y + 15 * Math.sin(((angleNow - 90) * Math.PI) / 180),
  };
  const plateY = (x: number) => topAt(m, Math.min(Math.max(x, 0), L)) - th;
  const usableHoles = new Set(plate?.isPreset ? plate.presetHoles : []);

  const task = s.completed ? '手術完成，前往術後照護。' : coach.doNow;

  return (
    <SceneShell
      dark
      stageIndex={4}
      patient={
        <span className="patient-chip">
          <b>{CASE_META[caseId]?.name}</b>・{c.side}・{m.boneName}・步驟 {s.step}/5 {STEP_NAMES[s.step - 1]}
        </span>
      }
      actions={
        <>
          <button className="btn sm" onClick={ms.undo} disabled={!ms.canUndo} data-testid="undo">
            ↶ 撤銷
          </button>
          <button
            className="btn sm"
            onClick={() => {
              if (window.confirm('重設本手術？首次作答紀錄會保留。')) {
                ms.reset();
                ex.set({ intro: true, measured: [] });
              }
            }}
          >
            ⟲ 重設
          </button>
          <button
            className="btn sm"
            onClick={() => {
              ms.countHint();
              say('info', coach.fixes[0] ?? coach.doNow);
            }}
            data-testid="hint"
          >
            💡 提示
          </button>
        </>
      }
      hint={<TaskHint text={task} fb={fb} />}
      toolInfo={
        <div className="tool-info-row">
          <ToolInfo tool={sel} />
          {selected === 'plate' && (
            <div className="chips" role="group" aria-label="骨板規格">
              {m.plates.map((p) => (
                <button
                  key={p.id}
                  className="btn sm"
                  aria-pressed={s.plate.plateId === p.id}
                  onClick={() => {
                    apply({ ...s, plate: { plateId: p.id, x: s.plate.plateId ? s.plate.x : 4, side: s.plate.side } });
                    say(p.isPreset ? 'ok' : 'warn', p.isPreset ? `選用${p.label}。拖到骨頭上緣貼附。` : `${p.label}不是本病例預設構型（覆蓋率或骨端避讓會不合）。`);
                  }}
                  data-testid={`plate-${p.id}`}
                >
                  {p.label}・{plateLength(p).toFixed(0)} mm
                </button>
              ))}
            </div>
          )}
          {selected === 'screw' && (
            <div className="chips" role="group" aria-label="螺釘長度">
              {m.screwLengths.map((len) => (
                <button key={len} className="btn sm" aria-pressed={screwLen === len} onClick={() => setScrewLen(len)} data-testid={`len-${len}`}>
                  {len} mm
                </button>
              ))}
            </div>
          )}
        </div>
      }
      tray={<ToolTray tools={tools} selected={selected} onSelect={onTap} begin={begin} />}
      drawer={<SurgeryDrawer caseId={caseId} />}
    >
      {!ex.state.intro && <ZoomIntro side={c.side} label={`${m.boneName}・側標 ${m.sideLabel}`} onDone={() => ex.set({ ...ex.state, intro: true }, { record: false })} />}
      <div className="surgery-badges">
        <span className="tag">
          {c.side}・{m.boneName}・{m.views[view].label}・側標 {m.sideLabel}
        </span>
        <span className="tag">上緣＝{m.tensionSideLabel}</span>
        {s.step === 1 &&
          (['primary', 'secondary'] as ViewKey[]).map((v) => (
            <button key={v} className="btn sm" aria-pressed={s.activeView === v} onClick={() => apply({ ...s, activeView: v }, { record: false })} data-testid={`view-${v}`}>
              {m.views[v].label}
            </button>
          ))}
        <span className="spacer" />
        {[1, 1.5, 2].map((z) => (
          <button key={z} className="btn sm zoom-btn" aria-pressed={zoom === z} onClick={() => setZoom(z)}>
            {z * 100}%
          </button>
        ))}
      </div>
      {s.step <= 4 && !s.completed && (
        <table className="surgery-hud" aria-label="即時量測">
          <tbody>
            {(portrait
              ? // phones: only the (at most two) measurements that still need work
                coach.rows.filter((r) => r.level !== 'pass' && r.level !== 'perfect').slice(0, 2)
              : coach.rows.slice(0, s.step === 1 ? 5 : 4)
            ).map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td>
                  {r.value} <span className="muted">／{r.target.replace(/（.*）/, '')}</span> {r.level && <Level level={r.level} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {celebrate && (
        <div className="stage-flash" role="status" data-testid="stage-flash">
          <span aria-hidden>✓</span> {celebrate}
        </div>
      )}
      {s.step < 5 ? (
        <div className="surgery-wrap">
          <svg
            ref={svgRef}
            className="surgery-svg"
            style={{ width: `${zoom * 100}%` }}
            viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
            tabIndex={0}
            role="application"
            aria-label="手術操作區：方向鍵移動，Q/E 旋轉，Shift 微調"
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onKeyDown={onKey}
            data-testid="t09-stage"
          >
            <defs>
              {/* ivory bone and brushed-steel plate to sit with the painted drape and tools; geometry is unchanged */}
              <linearGradient id="opBone" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#E9DCC6" />
                <stop offset=".5" stopColor="#FBF5EA" />
                <stop offset="1" stopColor="#DCCBAE" />
              </linearGradient>
              <linearGradient id="opPlate" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#EEF1F4" />
                <stop offset=".5" stopColor="#B9C2CB" />
                <stop offset="1" stopColor="#7C8792" />
              </linearGradient>
              <linearGradient id="opScrew" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#94A3B8" />
                <stop offset=".5" stopColor="#F1F5F9" />
                <stop offset="1" stopColor="#94A3B8" />
              </linearGradient>
              <pattern id="sgrid" width="5" height="5" patternUnits="userSpaceOnUse">
                <path d="M5 0H0V5" fill="none" stroke="#38BDF8" strokeOpacity=".07" strokeWidth=".15" />
              </pattern>
            </defs>
            {drape ? (
              // painted sterile drape (decoration only, never takes input)
              <image href={drape} x={vb.x} y={vb.y} width={vb.w} height={vb.h} preserveAspectRatio="xMidYMid slice" pointerEvents="none" data-testid="surgery-drape" />
            ) : (
              <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="url(#sgrid)" />
            )}
            {/* sterile drape window (no blood, no soft tissue detail) */}
            <rect x={-6} y={-half - 10} width={L + 12} height={(half + 10) * 2} rx="6" fill={drape ? 'rgb(18 52 66 / 55%)' : '#0F2A3F'} stroke={drape ? '#E7F3F1' : '#1E4A6B'} strokeOpacity={drape ? 0.5 : 1} strokeWidth=".4" />
            <text x={-4} y={-half - 13} fontSize="2.6" fill={drape ? '#FFFFFF' : '#8FB3CC'} className={drape ? 'stage-label' : undefined}>
              近端（肘側）
            </text>
            <text x={L + 4} y={-half - 13} fontSize="2.6" fill={drape ? '#FFFFFF' : '#8FB3CC'} textAnchor="end" className={drape ? 'stage-label' : undefined}>
              遠端（腕側）
            </text>
            <g id="model-root">
              {s.step === 1 && (
                <g opacity=".45" pointerEvents="none">
                  <FractureBones m={m} s={{ dx: 0, views: { primary: { dy: 0, theta: 0 }, secondary: { dy: 0, theta: 0 } } }} view={view} xray={false} />
                </g>
              )}
              <g pointerEvents="none">
                <FractureBones m={m} s={s} view={view} xray={false} />
              </g>
              {/* fragment drag target */}
              {s.step === 1 && (
                <g
                  transform={`translate(${s.dx} ${pose.dy}) rotate(${pose.theta} ${m.fracture.x} 0)`}
                  className={`frag-hit ${selected === 'grasp' ? 'armed' : ''}`}
                  onPointerDown={onDown('frag')}
                  data-testid="t09-fragment-hit"
                >
                  <rect x={m.fracture.x - 2} y={-half - 1} width={L - m.fracture.x + 4} height={half * 2 + 2} rx="3" />
                </g>
              )}
              {/* rotation handle */}
              {s.step === 1 && (
                <g>
                  <line x1={pivotNow.x} y1={pivotNow.y} x2={handle.x} y2={handle.y} stroke="#38BDF8" strokeWidth=".3" pointerEvents="none" />
                  <text x={pivotNow.x + 3} y={pivotNow.y - 16} fontSize="3" fill={isPassing(red.perView[view].angleLevel) ? '#22C55E' : '#FDE68A'} pointerEvents="none">
                    {Math.abs(angleNow).toFixed(1)}°
                  </text>
                  <g transform={`translate(${handle.x} ${handle.y})`} onPointerDown={onDown('rot')} style={{ cursor: 'alias' }} data-testid="t09-rotate-handle">
                    <circle r="4" fill="transparent" />
                    <circle r="2.2" fill="#0284C7" stroke="#E0F2FE" strokeWidth=".4" className={selected === 'grasp' ? 'glow' : ''} />
                    <path d="M-1.2 -.4 L0 -1.4 L1.2 -.4 M-1.2 .4 L0 1.4 L1.2 .4" stroke="#fff" strokeWidth=".3" fill="none" />
                  </g>
                </g>
              )}
              <line x1={fs.a.x} y1={fs.a.y} x2={fs.b.x} y2={fs.b.y} stroke="#FDE68A" strokeWidth=".25" strokeDasharray=".8 .6" pointerEvents="none" />
              {/* clamp points & clamp */}
              {s.step === 2 &&
                m.clampPoints.map((cp) => {
                  const placed = s.clamp[cp.side] === cp.id;
                  return (
                    <Zone key={cp.id} id={`clamp-${cp.id}`} label={`夾持點：${cp.label}`} accepts={['clamp']} {...zp} done={placed} pop={pop === `clamp-${cp.id}`}>
                      <circle cx={cp.at.x} cy={cp.at.y} r="3.4" fill="transparent" />
                      <circle className="zone-mark" cx={cp.at.x} cy={cp.at.y} r="1.5" fill={placed ? '#F97316' : '#0B1924'} stroke={placed ? '#FDBA74' : '#38BDF8'} strokeWidth=".35" />
                      <text x={cp.at.x} y={cp.at.y < 0 ? cp.at.y - 2.6 : cp.at.y + 4.4} fontSize="2" textAnchor="middle" fill="#BAE6FD" pointerEvents="none">
                        {cp.label}
                      </text>
                    </Zone>
                  );
                })}
              <ClampGlyph m={m} s={s} />
              {/* plate drop surfaces */}
              {s.step === 3 && s.plate.side === null && (
                <>
                  <Zone id="bone-top" label={`骨面上緣（${m.tensionSideLabel}）`} accepts={['plate']} {...zp}>
                    <rect x={0} y={-half - 5} width={L} height={5} fill="transparent" className="surface" />
                  </Zone>
                  <Zone id="bone-bottom" label={`骨面下緣（${m.compressionSideLabel}）`} accepts={['plate']} {...zp}>
                    <rect x={0} y={half - 1} width={L} height={5} fill="transparent" className="surface" />
                  </Zone>
                </>
              )}
              {/* implants */}
              {s.step >= 3 && plate && s.plate.side !== null && plateGhostY === null && (
                <g pointerEvents="none">
                  <Implants m={m} s={s} view="primary" xray={false} />
                </g>
              )}
              {s.step === 3 && plate && (s.plate.side === null || plateGhostY !== null) && (
                <rect x={s.plate.x} y={plateGhostY ?? half + 8} width={plateLength(plate)} height={th * 1.6} rx=".6" fill="url(#opPlate)" opacity=".9" pointerEvents="none" />
              )}
              {s.step === 3 && plate && (
                <rect
                  x={s.plate.x}
                  y={s.plate.side === null ? half + 6 : s.plate.side === 'tension' ? -half - 6 : half - 1}
                  width={plateLength(plate)}
                  height={7}
                  fill="transparent"
                  className={`plate-hit ${selected === 'plate' ? 'armed' : ''}`}
                  onPointerDown={onDown('plate')}
                  data-testid="t09-plate-hit"
                />
              )}
              {/* safety bands */}
              {s.step === 4 && (
                <g pointerEvents="none">
                  <line x1={fs.a.x} y1={fs.a.y} x2={fs.b.x} y2={fs.b.y} stroke="#EF4444" strokeOpacity=".2" strokeWidth={TOLERANCES.fractureMargin.bands[2].min * 2} strokeLinecap="round" />
                  {m.articular.map((a, i) => (
                    <line key={i} x1={a.a.x} y1={a.a.y} x2={a.b.x} y2={a.b.y} stroke="#F97316" strokeOpacity=".25" strokeWidth={TOLERANCES.articular.bands[2].min * 2} strokeLinecap="round" />
                  ))}
                </g>
              )}
              {/* drill tracks (outside the hole zones so they never enlarge the targets) */}
              {s.step === 4 &&
                plate &&
                Object.entries(s.holes)
                  .filter(([, h]) => h.status === 'drilled')
                  .map(([k]) => {
                    const x = s.plate.x + holeOffset(plate, Number(k));
                    return <line key={`t${k}`} x1={x} y1={topAt(m, x)} x2={x} y2={bottomAt(m, x)} stroke="#38BDF8" strokeWidth=".45" strokeDasharray=".6 .4" pointerEvents="none" />;
                  })}
              {/* holes */}
              {s.step === 4 &&
                plate &&
                Array.from({ length: plate.holes }, (_, i) => {
                  const x = s.plate.x + holeOffset(plate, i);
                  const y = plateY(x) - 2.6;
                  const h = s.holes[i];
                  const isPreset = usableHoles.has(i);
                  const e = h?.status === 'locked' ? evaluateHole(m, s, i, h.length) : null;
                  const color = e ? (e.effective ? '#22C55E' : '#F59E0B') : h ? '#38BDF8' : isPreset ? '#E0F2FE' : '#475569';
                  const holding = hold?.target === `hole-${i}` ? hold.progress : 0;
                  // only tools that can actually do something here light the hole up
                  const accepts = !h ? ['drill'] : h.status === 'drilled' ? (measured.includes(i) ? ['screw'] : ['gauge']) : e && !e.effective ? ['screw'] : [];
                  return (
                    <Zone
                      key={i}
                      id={`hole-${i}`}
                      label={`螺孔 ${i + 1}${isPreset ? '（預設構型）' : ''}${h ? (h.status === 'locked' ? '，已鎖釘' : '，已鑽孔') : ''}`}
                      accepts={accepts}
                      {...zp}
                      done={!!e?.effective}
                      pop={pop === `hole-${i}`}
                      onHoldStart={selected === 'drill' ? beginHold : undefined}
                      onHoldEnd={selected === 'drill' ? cancelHold : undefined}
                    >
                      <circle cx={x} cy={y} r="2.6" fill="transparent" />
                      <HoleSprite x={x} y={y} r={1.3} locked={h?.status === 'locked'} />
                      <circle cx={x} cy={y} r="1.3" fill={painted ? 'none' : h ? color : 'none'} stroke={color} strokeWidth={painted ? (isPreset || h ? 0.5 : 0.3) : isPreset ? 0.45 : 0.25} strokeDasharray={isPreset || h ? undefined : '.5 .4'} className="zone-mark" />
                      {holding > 0 && (
                        <circle cx={x} cy={y} r="2.2" fill="none" stroke="#F97316" strokeWidth=".5" strokeDasharray={`${holding * 13.8} 13.8`} transform={`rotate(-90 ${x} ${y})`} pointerEvents="none" />
                      )}
                      <text x={x} y={y - 2} fontSize="1.9" textAnchor="middle" fill="#8FB3CC" pointerEvents="none">
                        {i + 1}
                      </text>
                      {h && measured.includes(i) && h.status === 'drilled' && (
                        <text x={x} y={y - 4.2} fontSize="1.7" textAnchor="middle" fill="#FDBA74" pointerEvents="none">
                          {h.gauge.toFixed(1)}
                        </text>
                      )}
                    </Zone>
                  );
                })}
            </g>
          </svg>
          {(s.step === 1 || s.step === 3) && (
            <div className="nudge-pad" aria-label="微調">
              {s.step === 1 ? (
                <>
                  <button className="btn sm" onClick={() => apply(moveFragment(s, { x: -0.5, y: 0 }))} aria-label="向近端移 0.5 mm">◀</button>
                  <button className="btn sm" onClick={() => apply(moveFragment(s, { x: 0.5, y: 0 }))} aria-label="向遠端移 0.5 mm">▶</button>
                  <button className="btn sm" onClick={() => apply(moveFragment(s, { x: 0, y: -0.1 }))} aria-label="上移 0.1 mm">▲</button>
                  <button className="btn sm" onClick={() => apply(moveFragment(s, { x: 0, y: 0.1 }))} aria-label="下移 0.1 mm">▼</button>
                  <button className="btn sm" onClick={() => apply(rotateFragment(s, -1))} aria-label="逆時針旋轉 1 度">⟲</button>
                  <button className="btn sm" onClick={() => apply(rotateFragment(s, 1))} aria-label="順時針旋轉 1 度">⟳</button>
                </>
              ) : (
                <>
                  {[-5, -0.5, 0.5, 5].map((d) => (
                    <button key={d} className="btn sm" disabled={!plate || !s.plate.side} onClick={() => apply(movePlate(m, s, s.plate.x + d, s.plate.side))} data-testid={`plate-move-${d}`}>
                      {d < 0 ? '◀' : '▶'}
                      {Math.abs(d)}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
          {(s.step === 1 || s.step === 3) && coach.ready && (
            <button className="btn accent lg confirm-float" onClick={complete} data-testid="t09-confirm">
              ✔ {s.step === 1 ? '確認復位' : '確認骨板位置'}
            </button>
          )}
        </div>
      ) : (
        <CArmCheck m={m} s={s} apply={apply} zp={zp} pop={pop} flash={flash} say={say} />
      )}
      <DragGhost drag={trayDrag} tools={tools} />
    </SceneShell>
  );
}

function ClampGlyph({ m, s }: { m: ReturnType<typeof getModel>; s: T09State }) {
  if (s.step < 2 || s.step > 3) return null;
  const chosen = [s.clamp.proximal, s.clamp.distal].map((id) => m.clampPoints.find((c) => c.id === id)).filter(Boolean) as typeof m.clampPoints;
  if (!chosen.length) return null;
  return (
    <g pointerEvents="none" className="clamp-glyph">
      {chosen.map((c) => (
        <path key={c.id} d={`M${c.at.x - 1.3} ${c.at.y} q1.3 ${c.at.y < 0 ? -2.6 : 2.6} 2.6 0`} fill="none" stroke="url(#opScrew)" strokeWidth=".9" strokeLinecap="round" />
      ))}
      {chosen.length === 2 && (
        <>
          <path
            d={`M${chosen[0].at.x} ${chosen[0].at.y + 1.6} L${(chosen[0].at.x + chosen[1].at.x) / 2} ${Math.abs(chosen[0].at.y) + 9} L${chosen[1].at.x} ${chosen[1].at.y + 1.6}`}
            fill="none"
            stroke="#CBD5E1"
            strokeWidth=".8"
          />
          <rect x={(chosen[0].at.x + chosen[1].at.x) / 2 - 1} y={Math.abs(chosen[0].at.y) + 9} width="2" height="7" rx=".8" fill="#94A3B8" />
        </>
      )}
    </g>
  );
}

function CArmCheck({
  m,
  s,
  apply,
  zp,
  pop,
  flash,
  say,
}: {
  m: ReturnType<typeof getModel>;
  s: T09State;
  apply: (n: T09State | ((p: T09State) => T09State), o?: { record?: boolean }) => void;
  zp: { selected: string | null; hover: string | null; onUse: (z: string) => void };
  pop: string | null;
  flash: (z: string) => void;
  say: (k: 'ok' | 'warn' | 'info', t: string) => void;
}) {
  const red = reductionMetrics(s);
  const pm = plateMetrics(m, s);
  const fm = fixationMetrics(m, s);
  const status: Record<string, boolean> = {
    reduction: isPassing(red.displacementLevel),
    alignment: isPassing(red.angleLevel),
    implant: pm.passed,
    purchase: fm.passed,
  };
  const shoot = (v: ViewKey) => {
    if (zp.selected !== 'carm') return say('info', '先拿起「C 臂 X 光」。');
    if (s.viewsSeen[v]) return say('info', `${m.views[v].label}已拍攝。`);
    apply({ ...s, viewsSeen: { ...s.viewsSeen, [v]: true } });
    sound.play('reveal');
    flash(`shot-${v}`);
    say('ok', `已拍攝${m.views[v].label}（教學示意）。`);
  };
  const both = s.viewsSeen.primary && s.viewsSeen.secondary;
  return (
    <div className="carm-board">
      <div className="films">
        {(['primary', 'secondary'] as ViewKey[]).map((v) => {
          const valid = zp.selected === 'carm' && !s.viewsSeen[v];
          return (
            <div
              key={v}
              className={`film ${valid ? 'zone-valid' : ''} ${zp.hover === `shot-${v}` ? 'zone-hover' : ''} ${pop === `shot-${v}` ? 'zone-pop' : ''}`}
              data-zone={`shot-${v}`}
              role="button"
              tabIndex={0}
              onClick={() => shoot(v)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), shoot(v))}
              data-testid={`zone-shot-${v}`}
              aria-label={`片匣：${m.views[v].label}${s.viewsSeen[v] ? '（已拍攝）' : ''}`}
            >
              {s.viewsSeen[v] ? (
                <FractureXRay caseId={m.caseId} state={s} showImplants only={v} />
              ) : (
                <div className="film-empty">
                  <b>{m.views[v].label}</b>
                  <span>用 C 臂對準此片匣拍攝</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="checks">
        <b>術後檢核（遊戲幾何門檻）</b>
        {FINAL_CHECKS.map((c) => {
          const ok = status[c.id];
          const confirmed = s.confirmed.includes(c.id);
          return (
            <button
              key={c.id}
              className={`check-item ${confirmed ? 'on' : ''}`}
              disabled={!both || !ok || confirmed}
              onClick={() => {
                apply({ ...s, confirmed: [...s.confirmed, c.id] });
                sound.play('click');
              }}
              data-testid={`confirm-${c.id}`}
            >
              <span aria-hidden>{confirmed ? '☑' : '☐'}</span> {c.label} {ok ? <Level level="pass" /> : <Level level="fail" />}
            </button>
          );
        })}
        {!both && <p className="small muted">兩個視角都拍攝後才能確認。</p>}
      </div>
    </div>
  );
}

function ZoomIntro({ side, label, onDone }: { side: string; label: string; onDone: () => void }) {
  const { reducedMotion } = useStore();
  useEffect(() => {
    const t = window.setTimeout(onDone, reducedMotion ? 0 : 1700);
    return () => window.clearTimeout(t);
  }, [onDone, reducedMotion]);
  return (
    <div className="zoom-intro" data-testid="zoom-intro" onClick={onDone}>
      <svg viewBox="0 0 800 450" className="zoom-scene">
        <rect width="800" height="450" fill="#E0F2FE" />
        <ExamTable x={180} y={300} w={440} />
        <SceneDog x={220} y={300 - 229} lifted="LF" />
      </svg>
      <div className="zoom-label">
        放大至局部：{side}・{label}
      </div>
    </div>
  );
}

function SurgeryDrawer({ caseId }: { caseId: string }) {
  const m = getModel(caseId);
  return (
    <div className="stack small">
      <h3>本關說明</h3>
      <p>
        所有數值都是<b>遊戲幾何門檻</b>，不是臨床標準；達標或未達標都不能推論必然癒合或發生併發症。按住鑽孔的時間只是遊戲互動。
      </p>
      <p>預設骨板：{m.plates.find((p) => p.isPreset)?.label}（{m.plateSystemLabel}）。</p>
      {m.notes.map((n) => (
        <p key={n} className="muted">
          {n}
        </p>
      ))}
      <p className="muted">2D 教學示意：兩個視角共用同一份模型狀態，未驗證完整三維固定。模擬監測維持穩定，不產生隨機麻醉事件；操作慢不會讓病患死亡。</p>
      <RefChips ids={['R13', 'R14', 'G01']} />
    </div>
  );
}
