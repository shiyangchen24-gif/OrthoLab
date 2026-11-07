// ② Digital pre-operative planning → ③ TPLO surgery (C01, C02).
//
// A teaching simulation of the workflow of TPLO planning software (generic naming,
// no affiliation). Numbers are computed from the planning geometry and shown, but only
// step completion is checked; the module score comes from discrete first-attempt
// decisions (see scoreTplo). Planning results carry into the surgery.

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { caseById } from '../data';
import { CASE_META } from '../data/caseMeta';
import { add, len, screenToModel, sub, v, type Vec } from '../engine/geometry';
import {
  BLADE_RADII,
  CALIBRATION_MM,
  D_TOLERANCE,
  PLAN_STEPS,
  SURGERY_STEPS,
  TPLO_PLATES,
  TPLO_TARGET_TPA,
  checkHole,
  chordDistance,
  circumferentialTravel,
  dDeltas,
  fromImage,
  initialTploState,
  isSnapped,
  landmarkTargets,
  osteotomy,
  plannedTpa,
  plateFit,
  plateHoles,
  plateOutline,
  playerScale,
  requiredRotation,
  rotatePlateau,
  scoreTplo,
  snapLandmark,
  suggestPlatePosition,
  toImage,
  tpaAfter,
  tploGeometry,
  type LandmarkId,
  type TploGeometry,
  type TploPlan,
  type TploState,
} from '../engine/tploPlan';
import { dxNotes } from '../engine/tploDx';
import { useModuleState } from '../components/useModuleState';
import { useSvgDrag } from '../components/useSvgDrag';
import { Modal } from '../components/ui';
import { TploRadiograph, pathOf } from '../components/art/TploRadiograph';
import { useStore } from '../store';
import { sound } from '../audio';
import type { ModuleResult } from '../engine/session';

const fmt = (n: number | null | undefined, d = 1) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : n.toFixed(d));

const LANDMARK_LABEL: Record<LandmarkId, string> = {
  calA: '校正球邊緣 A',
  calB: '校正球邊緣 B',
  axisP: '長軸近端點：髁間隆起中心',
  axisD: '長軸遠端點：距骨中心',
  platCr: '脛骨高原頭側緣',
  platCa: '脛骨高原尾側緣',
};
const STEP_MARKS: Record<number, [LandmarkId, LandmarkId]> = { 2: ['calA', 'calB'], 3: ['axisP', 'axisD'], 4: ['platCr', 'platCa'] };

const STUDIES = [
  { id: 'ml-left', label: '左膝・ML 內外側', ok: true, why: '' },
  { id: 'ml-right', label: '右膝・ML 內外側', ok: false, why: '患側不符：病歷記錄為左後肢。' },
  { id: 'crcd-left', label: '左膝・CrCd 頭尾側', ok: false, why: 'TPA 與 TPLO 規劃需在 ML（內外側）影像上量測。' },
];

export function TploWorkflow({ caseId, onDone }: { caseId: string; onDone: (r: ModuleResult) => void }) {
  const g = useMemo(() => tploGeometry(caseId), [caseId]);
  const ms = useModuleState<TploState>('PROC-TPLO', initialTploState);
  const { data } = useStore();
  const s = ms.state;
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const say = (ok: boolean, text: string) => {
    sound.play(ok ? 'success' : 'warn');
    setMsg({ ok, text });
  };
  const setPlan = (patch: Partial<TploPlan> | ((p: TploPlan) => Partial<TploPlan>), record = true) =>
    ms.set((st) => ({ ...st, plan: { ...st.plan, ...(typeof patch === 'function' ? patch(st.plan) : patch) } }), { record });
  const setSurg = (patch: Partial<TploState['surgery']>, record = true) => ms.set((st) => ({ ...st, surgery: { ...st.surgery, ...patch } }), { record });
  const next = (text = '本步驟完成。') => {
    say(true, text);
    ms.set((st) => ({ ...st, step: st.step + 1 }));
  };

  /** postopFirst: the post-op reading's first attempt, recorded in the same click (sticky is not updated yet) */
  const finish = (postopFirst: boolean) => {
    const sc = scoreTplo({ ...ms.sticky, postop: ms.sticky.postop ?? postopFirst });
    const plan = s.plan;
    const R = plan.blade ?? 0;
    const numbers = `數值紀錄（不計分）：術前 TPA ${g.tpa}° → 目標 ${TPLO_TARGET_TPA}°；規劃旋轉 ${fmt(plan.rotation)}°（弦長 ${fmt(chordDistance(R, plan.rotation))} mm）；術中旋轉 ${fmt(s.surgery.rotation)}°，術後 TPA ${fmt(tpaAfter(g, s.surgery.rotation))}°。`;
    ms.set((st) => ({ ...st, phase: 'done' }));
    onDone({ score: sc.score, notes: [...sc.notes, ...(data.session ? dxNotes(data.session) : []), numbers] });
  };

  const c = caseById(caseId)!;
  const name = CASE_META[caseId]?.name ?? caseId;
  const planning = s.phase === 'plan';
  return (
    <section className={`vplan ${planning ? '' : 'op'}`} aria-label={planning ? '數位術前規劃' : 'TPLO 手術'} data-testid={planning ? 'tplo-planning' : 'tplo-surgery'}>
      <header className="vplan-head">
        <div className="vplan-app">
          <span className="vplan-logo" aria-hidden>
            ◎
          </span>
          <div>
            <b>{planning ? '② 數位術前規劃（教學模擬）' : '③ TPLO 手術'}</b>
            <div className="small">
              {name}・{c.breed}・{c.weightKg} kg・{c.side}・{planning ? '研究：左膝 ML' : '依術前規劃表執行'}
            </div>
          </div>
        </div>
        <span className="spacer" />
        <button className="btn sm" onClick={ms.undo} disabled={!ms.canUndo}>
          ↶ 撤銷
        </button>
        {!planning && (
          <button className="btn sm" onClick={() => setSheetOpen(true)} data-testid="open-sheet">
            📄 規劃表
          </button>
        )}
      </header>
      <div className="vplan-body">
        <ol className="vplan-steps" data-testid={planning ? 'plan-steps' : 'surgery-steps'} aria-label="步驟">
          {(planning ? PLAN_STEPS : SURGERY_STEPS).map((t, i) => (
            <li key={t} className={i + 1 < s.step || s.phase === 'done' ? 'done' : i + 1 === s.step ? 'now' : ''} aria-current={i + 1 === s.step ? 'step' : undefined}>
              <span className="n">{i + 1 < s.step || s.phase === 'done' ? '✓' : i + 1}</span>
              {t}
            </li>
          ))}
        </ol>
        {planning ? (
          <Planning g={g} s={s} setPlan={setPlan} next={next} back={() => ms.set((st) => ({ ...st, step: Math.max(1, st.step - 1) }))} say={say} recordFirst={ms.recordFirst} onExport={() => setSheetOpen(true)} />
        ) : (
          <Surgery g={g} s={s} setSurg={setSurg} next={next} say={say} recordFirst={ms.recordFirst} finish={finish} />
        )}
      </div>
      {msg && (
        <div className={`banner ${msg.ok ? 'ok' : 'warn'} vplan-msg`} role="status" data-testid="tplo-msg">
          <span aria-hidden>{msg.ok ? '✓' : '△'}</span>
          <span>{msg.text}</span>
        </div>
      )}
      <p className="small vplan-foot">
        教學模擬：流程參考商業 TPLO 數位規劃軟體，與其無合作關係。數值由示意幾何計算，只檢核步驟完成、不計分；目標 TPA {TPLO_TARGET_TPA}°、D1–D3 定義為遊戲設定，待專科審閱。
      </p>
      {sheetOpen && (
        <Modal
          title="TPLO 術前規劃表"
          onClose={() => setSheetOpen(false)}
          actions={
            <>
              <button className="btn" onClick={() => window.print()}>
                🖨 列印／另存 PDF
              </button>
              {planning && (
                <button
                  className="btn primary"
                  onClick={() => {
                    setSheetOpen(false);
                    setPlan({ exported: true });
                    ms.set((st) => ({ ...st, phase: 'surgery', step: 1 }));
                    say(true, '規劃表已輸出。進入手術：先依規劃表核對器械。');
                  }}
                  data-testid="sheet-to-surgery"
                >
                  完成規劃，進入手術 →
                </button>
              )}
            </>
          }
        >
          <PlanningSheet g={g} plan={s.plan} caseName={`${name}（${c.id}）・${c.breed}・${c.weightKg} kg`} />
        </Modal>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- planning
interface StepProps {
  g: TploGeometry;
  s: TploState;
  next: (text?: string) => void;
  say: (ok: boolean, text: string) => void;
  recordFirst: (name: string, value: unknown) => void;
}

function Planning({ g, s, setPlan, next, back, say, recordFirst, onExport }: StepProps & { back: () => void; setPlan: (patch: Partial<TploPlan> | ((p: TploPlan) => Partial<TploPlan>), record?: boolean) => void; onExport: () => void }) {
  const plan = s.plan;
  const step = s.step;
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useSvgDrag(svgRef);
  const [calInput, setCalInput] = useState(plan.calibrationMm ? String(plan.calibrationMm) : '');
  const targets = landmarkTargets(g);
  const R = plan.blade ?? 0;
  const ost = plan.center && plan.blade ? osteotomy(g, plan.center, R) : null;
  const tpa = plannedTpa(plan);
  const scale = playerScale(plan);
  const plateObj = TPLO_PLATES.find((p) => p.id === plan.plate) ?? null;
  const fit = plateObj && plan.blade ? plateFit(g, plateObj, R) : null;
  const holes = plateObj && plan.platePos ? plateHoles(plateObj, plan.platePos) : [];
  const holeChecks = holes.map((h) => (plan.center ? checkHole(g, plan.center, R, plan.rotation, h) : { ok: false, issue: '' }));
  const rotDone = Math.abs(tpaAfter(g, plan.rotation) - TPLO_TARGET_TPA) <= 0.25;
  const marks = STEP_MARKS[step];

  const toSvg = (e: { clientX: number; clientY: number }): Vec | null => {
    const ctm = svgRef.current?.getScreenCTM();
    return ctm ? screenToModel({ x: e.clientX, y: e.clientY }, ctm) : null;
  };
  const placeMark = (id: LandmarkId, p: Vec, record = true) => setPlan((pl) => ({ marks: { ...pl.marks, [id]: snapLandmark(g, id, p).p } }), record);
  const onImageClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const p = toSvg(e);
    if (!p) return;
    if (marks) {
      const id = marks.find((m) => !plan.marks[m]) ?? null;
      if (id) placeMark(id, p);
    } else if (step === 6) setPlan({ center: fromImage(g, p) });
    else if (step === 10 && plateObj) setPlan({ platePos: plateFromImage(p) });
  };
  // the plate is placed on the rotated image; its head is dragged in image space
  const plateFromImage = (p: Vec) => fromImage(g, p);

  // step completion
  const ready: Record<number, () => string | null> = {
    1: () => (plan.study === 'ml-left' ? null : '請匯入病歷患側（左膝）的 ML 影像。'),
    2: () =>
      !isSnapped(g, 'calA', plan.marks.calA) || !isSnapped(g, 'calB', plan.marks.calB)
        ? '把兩個校正點放在校正球左右兩側邊緣（靠近時會吸附）。'
        : plan.calibrationMm !== CALIBRATION_MM
          ? `輸入校正球的已知直徑並套用（本次擺位使用 ${CALIBRATION_MM} mm 校正球）。`
          : null,
    3: () => (isSnapped(g, 'axisP', plan.marks.axisP) && isSnapped(g, 'axisD', plan.marks.axisD) ? null : '長軸需由髁間隆起中心連到距骨中心。'),
    4: () => (isSnapped(g, 'platCr', plan.marks.platCr) && isSnapped(g, 'platCa', plan.marks.platCa) ? null : '高原線需連接脛骨內側高原的頭側緣與尾側緣。'),
    5: () => (plan.targetConfirmed ? null : '確認目標術後 TPA。'),
    6: () => (!plan.blade ? '選擇鋸片半徑。' : !plan.center ? '在影像上放置截骨中心。' : ost?.valid ? null : ost?.issues.join('；') ?? ''),
    7: () => (plan.exitConfirmed ? null : '確認皮質出口與脛骨粗隆骨量。'),
    8: () => (plan.measured.d1 && plan.measured.d2 && plan.measured.d3 ? null : '完成 D1、D2、D3 三項測量。'),
    9: () => (rotDone ? null : `旋轉脛骨高原，直到 TPA 為目標 ${TPLO_TARGET_TPA}°。`),
    10: () =>
      !plateObj
        ? '選擇 TPLO 骨板範本。'
        : !fit?.ok
          ? fit?.issues.join('；') ?? ''
          : !plan.platePos
            ? '把骨板範本放到旋轉後的近端脛骨上。'
            : holeChecks.some((h) => !h.ok)
              ? holeChecks.filter((h) => !h.ok).map((h) => h.issue).join('；')
              : plan.screws.length < 6
                ? `點選六個螺孔規劃螺釘（${plan.screws.length}/6）。`
                : null,
    11: () => (plan.exported ? null : '輸出術前規劃表。'),
  };
  const tryNext = () => {
    if (step === 11) return onExport();
    const why = ready[step]?.() ?? null;
    if (why) return say(false, why);
    next();
  };

  // overlays (image px)
  const img = (p: Vec) => toImage(g, p);
  const cut = step >= 9 && plan.center && plan.blade ? { O: plan.center, R } : null;
  const overlay: ReactNode[] = [];
  const markEl = (id: LandmarkId) => {
    const p = plan.marks[id];
    if (!p) return null;
    const snapped = isSnapped(g, id, p);
    const active = !!marks?.includes(id);
    return (
      <g
        key={id}
        className={`vmark ${snapped ? 'ok' : ''}`}
        data-testid={`mark-${id}`}
        onPointerDown={active ? drag.start(`m-${id}`, (q) => placeMark(id, q, false)) : undefined}
        style={{ cursor: active ? 'grab' : 'default' }}
      >
        <circle cx={p.x} cy={p.y} r="18" fill="transparent" />
        <circle cx={p.x} cy={p.y} r="7" fill="none" strokeWidth="2.5" />
        <path d={`M${p.x - 12} ${p.y} H${p.x + 12} M${p.x} ${p.y - 12} V${p.y + 12}`} strokeWidth="1.5" />
      </g>
    );
  };
  // calibration diameter line
  if (plan.marks.calA && plan.marks.calB) overlay.push(<line key="cal" x1={plan.marks.calA.x} y1={plan.marks.calA.y} x2={plan.marks.calB.x} y2={plan.marks.calB.y} className="vline cal" />);
  // long axis (extended)
  const { axisP, axisD, platCr, platCa } = plan.marks;
  if (axisP && axisD) {
    const u = sub(axisD, axisP);
    const ul = len(u) || 1;
    const a = add(axisP, v((-u.x / ul) * 90, (-u.y / ul) * 90));
    const b = add(axisD, v((u.x / ul) * 30, (u.y / ul) * 30));
    overlay.push(<line key="axis" x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="vline axis" data-testid="axis-line" />);
  }
  if (platCr && platCa) {
    const u = sub(platCa, platCr);
    overlay.push(<line key="plat" x1={platCr.x - u.x * 0.35} y1={platCr.y - u.y * 0.35} x2={platCa.x + u.x * 0.35} y2={platCa.y + u.y * 0.35} className="vline plat" />);
  }
  if (axisP && axisD && step >= 5 && tpa !== null) {
    const u = sub(axisD, axisP);
    const ul = len(u);
    const perp = v((u.y / ul) * 110, (-u.x / ul) * 110);
    overlay.push(<line key="perp" x1={axisP.x - perp.x * 0.6} y1={axisP.y - perp.y * 0.6} x2={axisP.x + perp.x} y2={axisP.y + perp.y} className="vline perp" />);
    overlay.push(
      <text key="tpa" x={axisP.x + 70} y={axisP.y - 30} className="vlabel big">
        TPA {fmt(step >= 9 ? tpaAfter(g, plan.rotation) : tpa)}°
      </text>,
    );
  }
  // osteotomy
  if (plan.center && plan.blade && step >= 6) {
    const O = img(plan.center);
    const draggable = step === 6;
    overlay.push(<circle key="circ" cx={O.x} cy={O.y} r={R * g.pxPerMm} className="vline arcfull" />);
    if (ost && ost.arc.length > 1 && step < 9) overlay.push(<path key="arc" d={pathOf(ost.arc.map(img), false)} className={`vline arc ${ost.valid ? 'ok' : 'bad'}`} />);
    overlay.push(
      <g key="center" className="vmark center" onPointerDown={draggable ? drag.start('center', (q) => setPlan({ center: fromImage(g, q) }, false)) : undefined} style={{ cursor: draggable ? 'grab' : 'default' }} data-testid="ost-center">
        <circle cx={O.x} cy={O.y} r="16" fill="transparent" />
        <path d={`M${O.x - 10} ${O.y} H${O.x + 10} M${O.x} ${O.y - 10} V${O.y + 10}`} strokeWidth="2" />
      </g>,
    );
  }
  // D1–D3
  if (ost && step >= 8 && step < 9) {
    const lines: [keyof TploPlan['measured'], Vec, Vec | null, number | null][] = [
      ['d1', g.ins, ost.cranialExit, ost.d1],
      ['d2', g.tub, ost.d2 === null ? null : add(ost.O, v(((g.tub.x - ost.O.x) / len(sub(g.tub, ost.O))) * R, ((g.tub.y - ost.O.y) / len(sub(g.tub, ost.O))) * R)), ost.d2],
      ['d3', g.Pcr, ost.d3 === null ? null : v(g.Pcr.x, g.Pcr.y + ost.d3), ost.d3],
    ];
    for (const [k, a, b, val] of lines) {
      if (!plan.measured[k] || !b) continue;
      const A = img(a);
      const B = img(b);
      overlay.push(
        <g key={k} className="dline">
          <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} />
          <text x={(A.x + B.x) / 2 + (k === 'd3' ? 10 : -100)} y={(A.y + B.y) / 2 + (k === 'd3' ? -4 : 6)} className="vlabel">
            {k.toUpperCase()} {fmt(val)} mm
          </text>
        </g>,
      );
    }
  }
  // plate template on the rotated image
  const plateEl =
    plateObj && plan.platePos && step >= 10 ? (
      <g data-testid="plate-template">
        <path d={pathOf(plateOutline(plateObj, plan.platePos).map(img))} className="vplate" onPointerDown={step === 10 ? drag.start('plate', (q) => setPlan({ platePos: plateFromImage(q) }, false)) : undefined} style={{ cursor: step === 10 ? 'grab' : 'default' }} />
        {holes.map((h, i) => {
          const P = img(h.p);
          const on = plan.screws.includes(h.i);
          return (
            <g
              key={h.i}
              className={`vhole ${holeChecks[i].ok ? 'ok' : 'bad'} ${on ? 'on' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (step !== 10) return;
                setPlan((pl) => ({ screws: pl.screws.includes(h.i) ? pl.screws.filter((x) => x !== h.i) : [...pl.screws, h.i] }));
              }}
              data-testid={`plan-hole-${h.i}`}
            >
              <circle cx={P.x} cy={P.y} r="12" fill="transparent" />
              <circle cx={P.x} cy={P.y} r={Math.max(4, (plateObj.width / 3) * g.pxPerMm)} />
            </g>
          );
        })}
      </g>
    ) : null;

  const testTargets = useMemo(() => {
    const hint = (() => {
      if (!plan.center || !plan.blade) return null;
      const p = TPLO_PLATES.find((x) => plateFit(g, x, plan.blade!).ok);
      const H = p ? suggestPlatePosition(g, p, plan.center, plan.blade, requiredRotation(g)) : null;
      return H ? img(H) : null;
    })();
    return JSON.stringify({ ...targets, center: img(g.E), plateHint: hint });
  }, [g, plan.center, plan.blade]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="vplan-view">
        <div className="vplan-tools" role="toolbar" aria-label="規劃工具">
          {['校正', '長軸', '高原線', 'TPA', '鋸片', '出口', 'D1–D3', '旋轉', '骨板', '輸出'].map((t, i) => {
            const toolStep = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11][i];
            return (
              <span key={t} className={`vtool ${toolStep === step ? 'on' : toolStep < step ? 'done' : ''}`}>
                {t}
              </span>
            );
          })}
        </div>
        {step === 1 ? (
          <div className="vplan-studies" role="group" aria-label="選擇要匯入的影像">
            {STUDIES.map((st) => (
              <button
                key={st.id}
                className={`vstudy ${plan.study === st.id ? 'on' : ''}`}
                onClick={() => {
                  recordFirst('study', st.ok);
                  setPlan({ study: st.ok ? st.id : null });
                  say(st.ok, st.ok ? '已匯入左膝 ML 影像。' : st.why);
                }}
                data-testid={`study-${st.id}`}
              >
                <StudyThumb kind={st.id} />
                <span>{st.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <TploRadiograph
            g={g}
            svgRef={svgRef}
            handlers={drag.handlers}
            onImageClick={onImageClick}
            cut={cut}
            rotation={step >= 9 ? plan.rotation : 0}
            plate={plateEl}
            label={`左膝 ML 教學示意影像（${g.caseId}）`}
            focus={step >= 6 ? 'proximal' : 'full'}
            testId="plan-image"
          >
            {overlay}
            {(['calA', 'calB', 'axisP', 'axisD', 'platCr', 'platCa'] as LandmarkId[]).map(markEl)}
            <g data-targets={testTargets} data-testid="plan-targets" />
          </TploRadiograph>
        )}
      </div>
      <aside className="vplan-panel" aria-label="量測與步驟">
        <h3>
          步驟 {step}／{PLAN_STEPS.length}：{PLAN_STEPS[step - 1]}
        </h3>
        <PlanStepHelp step={step} marks={marks} plan={plan} />
        {step === 2 && (
          <div className="row">
            <label className="small">
              已知直徑（mm）
              <input className="vinput" inputMode="decimal" value={calInput} onChange={(e) => setCalInput(e.target.value)} data-testid="cal-input" />
            </label>
            <button
              className="btn sm"
              onClick={() => {
                const n = Number(calInput);
                if (n !== CALIBRATION_MM) return say(false, `校正球的已知直徑是 ${CALIBRATION_MM} mm。`);
                setPlan({ calibrationMm: n });
                say(true, '校正完成：量測改以 mm 顯示。');
              }}
              data-testid="cal-apply"
            >
              套用校正
            </button>
          </div>
        )}
        {step === 5 && (
          <button className="btn sm" onClick={() => setPlan({ targetConfirmed: true })} aria-pressed={plan.targetConfirmed} data-testid="confirm-target">
            設定目標術後 TPA {TPLO_TARGET_TPA}°
          </button>
        )}
        {step === 6 && (
          <div className="vchips" role="group" aria-label="鋸片半徑">
            {BLADE_RADII.map((r) => (
              <button key={r} className="btn sm" aria-pressed={plan.blade === r} onClick={() => setPlan({ blade: r })} data-testid={`blade-${r}`}>
                {r} mm
              </button>
            ))}
          </div>
        )}
        {(step === 6 || step === 7) && ost && (
          <ul className="vchecks" data-testid="ost-checks">
            <li className={ost.checks.centered ? 'ok' : 'bad'}>截骨中心位於髁間隆起</li>
            <li className={ost.checks.cranialExitOk ? 'ok' : 'bad'}>頭側出口：高原頭側緣與髕韌帶附著點之間</li>
            <li className={ost.checks.caudalExitOk ? 'ok' : 'bad'}>尾側出口在尾側皮質</li>
            <li className={ost.checks.stockOk ? 'ok' : 'bad'}>
              粗隆骨量 D2 {fmt(ost.d2)} mm（下限 {fmt(g.minStock)} mm）
            </li>
          </ul>
        )}
        {step === 7 && (
          <div className="row">
            <button className="btn sm" disabled={!ost?.valid} onClick={() => setPlan({ exitConfirmed: true })} aria-pressed={plan.exitConfirmed} data-testid="confirm-exits">
              確認出口與骨量
            </button>
            <button
              className="btn sm ghost"
              onClick={() => {
                setPlan({ exitConfirmed: false });
                back();
                say(true, '已返回「鋸片與截骨中心」調整。');
              }}
            >
              返回調整
            </button>
          </div>
        )}
        {step === 8 && (
          <div className="vchips">
            {(['d1', 'd2', 'd3'] as const).map((k) => (
              <button key={k} className="btn sm" aria-pressed={plan.measured[k]} onClick={() => setPlan((pl) => ({ measured: { ...pl.measured, [k]: true } }))} data-testid={`measure-${k}`}>
                測量 {k.toUpperCase()}
              </button>
            ))}
          </div>
        )}
        {step === 9 && <RotationControl value={plan.rotation} onChange={(r) => setPlan({ rotation: r }, false)} testPrefix="plan-rot" />}
        {step === 10 && (
          <>
            <div className="vchips" role="group" aria-label="TPLO 骨板範本">
              {TPLO_PLATES.map((p) => (
                <button key={p.id} className="btn sm" aria-pressed={plan.plate === p.id} onClick={() => setPlan({ plate: p.id, screws: [] })} data-testid={`plate-${p.id}`}>
                  {p.label}
                </button>
              ))}
            </div>
            {fit && !fit.ok && <p className="small warn-text">{fit.issues.join('；')}</p>}
            <p className="small muted">骨板依影像範本合適度選擇，不依體重。螺釘長度需於 CrCd 影像或術中量深決定，本規劃只規劃位置。</p>
          </>
        )}
        <Readouts g={g} plan={plan} scale={scale} tpa={tpa} ost={ost} step={step} />
        <button className="btn primary" onClick={tryNext} data-testid="plan-next">
          {step === 11 ? '📄 輸出規劃表' : '完成本步驟 →'}
        </button>
      </aside>
    </>
  );
}

function PlanStepHelp({ step, marks, plan }: { step: number; marks?: [LandmarkId, LandmarkId]; plan: TploPlan }) {
  const text: Record<number, string> = {
    1: '從影像清單選擇要匯入的研究：核對患側與投照方向。',
    2: '點兩下放置校正點（校正球左右邊緣），輸入已知直徑後套用。之後所有距離以 mm 顯示。',
    3: '建立脛骨長軸：先點髁間隆起中心，再點距骨中心。',
    4: '建立脛骨高原線：先點內側高原頭側緣，再點尾側緣。',
    5: 'TPA＝高原線與「長軸垂直線」的夾角。確認目標術後 TPA。',
    6: '選擇圓弧鋸片半徑，點影像放置截骨中心（可拖曳）。中心以髁間隆起為準。',
    7: '確認截骨的頭側／尾側皮質出口，以及脛骨粗隆保留的骨量。',
    8: '測量 D1（出口→髕韌帶附著點）、D2（截骨→粗隆頭側皮質）、D3（高原頭側緣沿長軸→截骨）。',
    9: '模擬旋轉高原骨段，直到 TPA 達目標；記下旋轉角度、圓周位移與弦長。',
    10: '選擇骨板範本，拖到旋轉後的近端脛骨上，再點選六個螺孔。綠色＝位置合格。',
    11: '檢查規劃表內容並輸出，手術時依此核對。',
  };
  return (
    <>
      <p className="small">{text[step]}</p>
      {marks && (
        <ul className="vmarks">
          {marks.map((m) => (
            <li key={m} className={plan.marks[m] ? 'ok' : ''}>
              {plan.marks[m] ? '✓' : '○'} {LANDMARK_LABEL[m]}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Readouts({ g, plan, scale, tpa, ost, step }: { g: TploGeometry; plan: TploPlan; scale: number | null; tpa: number | null; ost: ReturnType<typeof osteotomy> | null; step: number }) {
  const R = plan.blade ?? 0;
  const theta = plan.rotation;
  const rows: [string, string][] = [
    ['影像比例', scale ? `${fmt(scale, 2)} px/mm` : '未校正'],
    ['術前 TPA', tpa === null ? '—' : `${fmt(tpa)}°`],
    ['目標 TPA', plan.targetConfirmed ? `${TPLO_TARGET_TPA}°` : '—'],
    ['鋸片半徑', plan.blade ? `${plan.blade} mm` : '—'],
    ['D1／D2／D3', ost && plan.measured.d1 ? `${fmt(ost.d1)}／${fmt(ost.d2)}／${fmt(ost.d3)} mm` : '—'],
    ['旋轉角度', step >= 9 ? `${fmt(theta)}°` : '—'],
    ['圓周位移', step >= 9 && R ? `${fmt(circumferentialTravel(R, theta))} mm` : '—'],
    ['弦長', step >= 9 && R ? `${fmt(chordDistance(R, theta))} mm` : '—'],
    ['旋轉後 TPA', step >= 9 ? `${fmt(tpaAfter(g, theta))}°` : '—'],
  ];
  return (
    <table className="vread" data-testid="plan-readouts">
      <tbody>
        {rows.map(([k, val]) => (
          <tr key={k}>
            <th>{k}</th>
            <td>{val}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RotationControl({ value, onChange, testPrefix }: { value: number; onChange: (v: number) => void; testPrefix: string }) {
  const set = (x: number) => onChange(Math.max(0, Math.min(40, Math.round(x * 2) / 2)));
  return (
    <div className="vrot">
      <input type="range" min={0} max={40} step={0.5} value={value} onChange={(e) => set(Number(e.target.value))} aria-label="高原旋轉角度" data-testid={`${testPrefix}-range`} />
      <div className="row">
        {[-1, -0.5, 0.5, 1].map((d) => (
          <button key={d} className="btn sm" onClick={() => set(value + d)} data-testid={`${testPrefix}-${d > 0 ? 'plus' : 'minus'}${Math.abs(d) === 1 ? '1' : ''}`}>
            {d > 0 ? '+' : '−'}
            {Math.abs(d)}°
          </button>
        ))}
        <b>{fmt(value)}°</b>
      </div>
    </div>
  );
}

function StudyThumb({ kind }: { kind: string }) {
  const mirror = kind === 'ml-right';
  const crcd = kind === 'crcd-left';
  return (
    <svg viewBox="0 0 80 100" width="80" height="100" aria-hidden>
      <rect width="80" height="100" fill="#05080B" />
      {crcd ? (
        <path d="M30 8 L50 8 L52 34 L28 34 Z M26 40 L54 40 L50 50 L46 52 L45 94 L35 94 L34 52 L30 50 Z" fill="#CBD5E1" />
      ) : (
        <g transform={mirror ? 'translate(80 0) scale(-1 1)' : undefined}>
          <circle cx="42" cy="22" r="13" fill="#CBD5E1" opacity=".8" />
          <path d="M30 34 L54 40 L52 52 L46 56 L44 94 L38 94 L36 58 L28 50 Z" fill="#E2E8F0" />
        </g>
      )}
      <rect x="4" y="80" width="14" height="14" fill="#F8FAFC" />
      <text x="11" y="91" fontSize="11" fontWeight="700" textAnchor="middle" fill="#000">
        {mirror ? 'R' : 'L'}
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------- planning sheet
export function PlanningSheet({ g, plan, caseName }: { g: TploGeometry; plan: TploPlan; caseName: string }) {
  const R = plan.blade ?? 0;
  const ost = plan.center && plan.blade ? osteotomy(g, plan.center, R) : null;
  const plate = TPLO_PLATES.find((p) => p.id === plan.plate);
  const rows: [string, string][] = [
    ['病患', caseName],
    ['影像', '左膝 ML（內外側）・校正球 25 mm'],
    ['術前 TPA', `${fmt(plannedTpa(plan))}°`],
    ['目標術後 TPA', `${TPLO_TARGET_TPA}°`],
    ['圓弧鋸片', plan.blade ? `半徑 ${plan.blade} mm` : '—'],
    ['截骨中心', '髁間隆起中心'],
    ['D1（出口→髕韌帶附著點）', `${fmt(ost?.d1)} mm`],
    ['D2（截骨→粗隆頭側皮質）', `${fmt(ost?.d2)} mm`],
    ['D3（高原頭側緣→截骨，沿長軸）', `${fmt(ost?.d3)} mm`],
    ['旋轉角度', `${fmt(plan.rotation)}°`],
    ['圓周位移', `${fmt(circumferentialTravel(R, plan.rotation))} mm`],
    ['弦長', `${fmt(chordDistance(R, plan.rotation))} mm`],
    ['TPLO 骨板', plate?.label ?? '—'],
    ['螺釘', `${plan.screws.length} 枚（近端 3、遠端 3；長度術中量深）`],
  ];
  return (
    <div className="planning-sheet" data-testid="planning-sheet">
      <table className="data">
        <tbody>
          {rows.map(([k, val]) => (
            <tr key={k}>
              <th style={{ textAlign: 'left', width: '45%' }}>{k}</th>
              <td>{val}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small muted">教學模擬規劃表：數值由示意幾何計算，D1–D3 為遊戲定義、目標 TPA 為教學設定，皆待專科審閱；不作為實際手術依據。</p>
    </div>
  );
}

// ---------------------------------------------------------------- surgery
const APPROACHES = [
  { id: 'medial', label: '脛骨近端內側入路', ok: true, why: 'TPLO 骨板置於脛骨近端內側，採內側入路。' },
  { id: 'lateral', label: '膝外側入路', ok: false, why: 'TPLO 骨板置於脛骨近端內側；外側入路無法依規劃放置骨板。' },
];
const STABILITY = [
  { id: 'thrust', label: '脛骨推進試驗（tibial thrust）', ok: true },
  { id: 'drawer', label: '頭側抽屜試驗（cranial drawer）', ok: false },
];

function Surgery({ g, s, setSurg, next, say, recordFirst, finish }: StepProps & { setSurg: (patch: Partial<TploState['surgery']>, record?: boolean) => void; finish: (postopFirst: boolean) => void }) {
  const plan = s.plan;
  const sg = s.surgery;
  const step = s.step;
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useSvgDrag(svgRef);
  const R = plan.blade ?? 0;
  const planTheta = plan.rotation;
  const plateObj = TPLO_PLATES.find((p) => p.id === plan.plate)!;
  const center = sg.center ?? (plan.center ? add(plan.center, v(7 * g.k, 9 * g.k)) : g.E);
  const dd = dDeltas(g, plan, center);
  const positioned = dd.delta.every((d) => d <= D_TOLERANCE);
  const postTpa = tpaAfter(g, sg.rotation);
  const img = (p: Vec) => toImage(g, p);
  const holes = plan.platePos ? plateHoles(plateObj, plan.platePos) : [];
  // the surgery reproduces the plan: once the plateau is rotated to plan the template holes apply
  const cutRef = sg.cut ? { O: center, R } : null;
  const [answers, setAnswers] = useState<Record<string, string>>(sg.answers);
  const postQs = [
    {
      id: 'tpa',
      q: '術後 TPA',
      options: [
        { id: 'a', text: `約 ${fmt(postTpa)}°，接近目標 ${TPLO_TARGET_TPA}°`, ok: true },
        { id: 'b', text: `約 ${g.tpa}°，與術前相同`, ok: false },
        { id: 'c', text: '約 0°，需再旋轉', ok: false },
      ],
    },
    {
      id: 'implant',
      q: '植入物位置',
      options: [
        { id: 'a', text: '螺釘均未進入關節或截骨線', ok: true },
        { id: 'b', text: '近端螺釘進入關節', ok: false },
      ],
    },
    {
      id: 'osteotomy',
      q: '截骨位置',
      options: [
        { id: 'a', text: '與規劃 D1–D3 一致，粗隆完整', ok: true },
        { id: 'b', text: '截骨切過脛骨粗隆', ok: false },
      ],
    },
  ];

  const ready: Record<number, () => string | null> = {
    1: () => (sg.trayChecked ? null : '依規劃表選出鋸片與骨板後按「核對」。'),
    2: () => (sg.approach === 'medial' ? null : '選擇手術入路。'),
    3: () => (positioned ? null : `拖曳鋸片中心，讓 D1–D3 與規劃表相差都在 ${D_TOLERANCE} mm 內。`),
    4: () => (sg.cut ? null : '執行圓弧截骨。'),
    5: () => (Math.abs(sg.rotation - planTheta) <= 0.5 ? null : `把高原骨段旋轉到規劃的 ${fmt(planTheta)}°（弦長 ${fmt(chordDistance(R, planTheta))} mm）。`),
    6: () => (sg.tempFixed ? null : '放置暫時固定針。'),
    7: () => (!sg.plateSeated ? '依規劃放置 TPLO 骨板。' : sg.screws.length < 6 ? `鎖入規劃的六枚螺釘（${sg.screws.length}/6）。` : null),
    8: () => (sg.stability !== 'thrust' ? '回答穩定度判讀。' : !sg.alignmentChecked ? '確認肢體排列。' : null),
    9: () => (sg.closed ? null : '完成縫合。'),
    10: () => null,
  };
  const tryNext = () => {
    const why = ready[step]?.() ?? null;
    if (why) return say(false, why);
    if (step === 10) {
      const wrong = postQs.filter((q) => !q.options.find((o) => o.id === answers[q.id])?.ok);
      recordFirst('postop', wrong.length === 0);
      setSurg({ answers });
      if (wrong.length) return say(false, `再看一次術後影像：${wrong.map((q) => q.q).join('、')}`);
      return finish(true);
    }
    next();
  };

  const theme = step === 10 ? 'xray' : 'op';
  const overlay: ReactNode[] = [];
  if (step === 3 || (step >= 3 && !sg.cut)) {
    const o = osteotomy(g, center, R);
    const O = img(center);
    overlay.push(<circle key="circ" cx={O.x} cy={O.y} r={R * g.pxPerMm} className="vline arcfull" />);
    if (o.arc.length > 1) overlay.push(<path key="arc" d={pathOf(o.arc.map(img), false)} className={`vline arc ${positioned ? 'ok' : 'bad'}`} />);
    overlay.push(
      <g key="center" className="vmark center" onPointerDown={step === 3 ? drag.start('scenter', (q) => setSurg({ center: fromImage(g, q) }, false)) : undefined} style={{ cursor: step === 3 ? 'grab' : 'default' }} data-testid="surg-center">
        <circle cx={O.x} cy={O.y} r="16" fill="transparent" />
        <path d={`M${O.x - 10} ${O.y} H${O.x + 10} M${O.x} ${O.y - 10} V${O.y + 10}`} strokeWidth="2" />
      </g>,
    );
  }
  // rotation marks on the cranial cortex: fixed mark, moving mark and the planned position
  if (sg.cut && step >= 5 && step < 10) {
    const exit = osteotomy(g, center, R).cranialExit;
    if (exit) {
      const fixed = img(exit);
      const moving = img(rotatePlateau(exit, center, sg.rotation));
      const target = img(rotatePlateau(exit, center, planTheta));
      overlay.push(
        <g key="marks" className="rmarks">
          <circle cx={fixed.x} cy={fixed.y} r="6" className="fixed" />
          <circle cx={target.x} cy={target.y} r="9" className="target" />
          <circle cx={moving.x} cy={moving.y} r="6" className="moving" />
        </g>,
      );
    }
  }
  if (sg.tempFixed && step >= 6) {
    const a = img(add(center, v(-14 * g.k, -2 * g.k)));
    const b = img(add(center, v(6 * g.k, 18 * g.k)));
    overlay.push(<line key="pin" x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="vpin" />);
  }
  const plateEl =
    sg.plateSeated && plan.platePos ? (
      <g data-testid="surg-plate">
        <path d={pathOf(plateOutline(plateObj, plan.platePos).map(img))} className="vplate seated" />
        {holes.map((h) => {
          const P = img(h.p);
          const on = sg.screws.includes(h.i);
          const planned = plan.screws.includes(h.i);
          return (
            <g
              key={h.i}
              className={`vhole ${on ? 'on ok' : planned ? 'planned' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (step !== 7 || !planned || on) return;
                setSurg({ screws: [...sg.screws, h.i] });
              }}
              data-testid={`surg-hole-${h.i}`}
            >
              <circle cx={P.x} cy={P.y} r="12" fill="transparent" />
              <circle cx={P.x} cy={P.y} r={Math.max(4, (plateObj.width / 3) * g.pxPerMm)} />
            </g>
          );
        })}
      </g>
    ) : null;

  return (
    <>
      <div className="vplan-view">
        {step <= 2 ? (
          <div className="vplan-card">
            <PlanningSheet g={g} plan={plan} caseName={`${caseById(g.caseId)?.breed ?? ''}・${g.caseId}`} />
          </div>
        ) : (
          <TploRadiograph
            g={g}
            theme={theme}
            svgRef={svgRef}
            handlers={drag.handlers}
            onImageClick={(e) => {
              if (step !== 3) return;
              const ctm = svgRef.current?.getScreenCTM();
              if (ctm) setSurg({ center: fromImage(g, screenToModel({ x: e.clientX, y: e.clientY }, ctm)) });
            }}
            cut={cutRef}
            rotation={sg.rotation}
            plate={plateEl}
            label={step === 10 ? '術後 ML 教學示意影像' : '術中示意圖（脛骨近端內側觀）'}
            focus={step === 10 ? 'full' : 'proximal'}
            testId="surg-image"
          >
            {overlay}
            <g data-targets={JSON.stringify({ planCenter: plan.center ? img(plan.center) : null })} data-testid="surg-targets" />
            {step === 10 && (
              <text x="380" y="60" className="vlabel big">
                術後 TPA {fmt(postTpa)}°
              </text>
            )}
          </TploRadiograph>
        )}
      </div>
      <aside className="vplan-panel" aria-label="手術步驟">
        <h3>
          步驟 {step}／{SURGERY_STEPS.length}：{SURGERY_STEPS[step - 1]}
        </h3>
        {step === 1 && (
          <>
            <p className="small">依規劃表從器械盤選出鋸片與骨板，再按「核對」。</p>
            <div className="vchips" role="group" aria-label="鋸片">
              {BLADE_RADII.map((r) => (
                <button key={r} className="btn sm" aria-pressed={sg.tray.blade === r} onClick={() => setSurg({ tray: { ...sg.tray, blade: r } })} data-testid={`tray-blade-${r}`}>
                  {r} mm
                </button>
              ))}
            </div>
            <div className="vchips" role="group" aria-label="骨板">
              {TPLO_PLATES.map((p) => (
                <button key={p.id} className="btn sm" aria-pressed={sg.tray.plate === p.id} onClick={() => setSurg({ tray: { ...sg.tray, plate: p.id } })} data-testid={`tray-plate-${p.id}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <button
              className="btn sm"
              onClick={() => {
                const ok = sg.tray.blade === plan.blade && sg.tray.plate === plan.plate;
                recordFirst('tray', ok);
                if (ok) {
                  setSurg({ trayChecked: true });
                  say(true, `核對完成：鋸片 ${plan.blade} mm、${plateObj.label}、螺釘 6 枚；D1–D3 已列於規劃表。`);
                } else say(false, '與規劃表不一致：再對照規劃表的鋸片半徑與骨板。');
              }}
              data-testid="tray-check"
            >
              核對
            </button>
          </>
        )}
        {step === 2 && (
          <div className="vchips" role="group" aria-label="手術入路">
            {APPROACHES.map((a) => (
              <button
                key={a.id}
                className="btn sm"
                aria-pressed={sg.approach === a.id}
                onClick={() => {
                  recordFirst('approach', a.ok);
                  if (a.ok) setSurg({ approach: a.id });
                  say(a.ok, a.why);
                }}
                data-testid={`approach-${a.id}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
        {step === 3 && (
          <>
            <p className="small">拖曳鋸片中心，依規劃表的 D1–D3 定位截骨。</p>
            <table className="vread" data-testid="d-compare">
              <thead>
                <tr>
                  <th />
                  <th>規劃</th>
                  <th>目前</th>
                </tr>
              </thead>
              <tbody>
                {(['D1', 'D2', 'D3'] as const).map((k, i) => {
                  const p = osteotomy(g, plan.center ?? g.E, R);
                  const pv = [p.d1, p.d2, p.d3][i];
                  return (
                    <tr key={k} className={dd.delta[i] <= D_TOLERANCE ? 'ok' : 'bad'}>
                      <th>{k}</th>
                      <td>{fmt(pv)} mm</td>
                      <td>{fmt(dd.d[i])} mm</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
        {step === 4 && (
          <button className="btn sm" disabled={sg.cut} onClick={() => setSurg({ cut: true, center })} data-testid="do-cut">
            🪚 執行圓弧截骨
          </button>
        )}
        {step === 5 && (
          <>
            <p className="small">
              旋轉高原骨段：讓移動標記（橘）到達規劃位置（綠圈）。規劃 {fmt(planTheta)}°、弦長 {fmt(chordDistance(R, planTheta))} mm；目前弦長 {fmt(chordDistance(R, sg.rotation))} mm。
            </p>
            <RotationControl value={sg.rotation} onChange={(r) => setSurg({ rotation: r }, false)} testPrefix="surg-rot" />
          </>
        )}
        {step === 6 && (
          <button className="btn sm" disabled={sg.tempFixed} onClick={() => setSurg({ tempFixed: true })} data-testid="temp-pin">
            📍 放置暫時固定針
          </button>
        )}
        {step === 7 && (
          <>
            <button className="btn sm" disabled={sg.plateSeated} onClick={() => setSurg({ plateSeated: true })} data-testid="seat-plate">
              依規劃放置 TPLO 骨板
            </button>
            <p className="small muted">骨板就位後，點選規劃的螺孔鎖入螺釘（長度以量深決定）。</p>
          </>
        )}
        {step === 8 && (
          <>
            <p className="small">固定完成後，哪一項試驗應轉為陰性？</p>
            <div className="vchips" role="group" aria-label="穩定度判讀">
              {STABILITY.map((t) => (
                <button
                  key={t.id}
                  className="btn sm"
                  aria-pressed={sg.stability === t.id}
                  onClick={() => {
                    recordFirst('stability', t.ok);
                    if (t.ok) setSurg({ stability: t.id });
                    say(t.ok, t.ok ? '脛骨推進試驗轉為陰性：TPLO 以降低 TPA 中和脛骨頭側推進力。' : 'TPLO 不修復韌帶，被動抽屜可能仍存在；應確認的是脛骨推進試驗。');
                  }}
                  data-testid={`stability-${t.id}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button className="btn sm" disabled={sg.alignmentChecked} onClick={() => setSurg({ alignmentChecked: true })} data-testid="alignment">
              確認肢體排列（無內外翻、旋轉）
            </button>
          </>
        )}
        {step === 9 && (
          <button className="btn sm" disabled={sg.closed} onClick={() => setSurg({ closed: true })} data-testid="closure">
            🧵 分層縫合
          </button>
        )}
        {step === 10 &&
          postQs.map((q) => (
            <div key={q.id} className="quiz-q">
              <b>{q.q}</b>
              <div className="vchips">
                {q.options.map((o) => (
                  <button key={o.id} className="btn sm" aria-pressed={answers[q.id] === o.id} onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))} data-testid={`post-${q.id}-${o.id}`}>
                    {o.text}
                  </button>
                ))}
              </div>
            </div>
          ))}
        <button className="btn primary" onClick={tryNext} data-testid="surg-next">
          {step === 10 ? '完成手術' : '完成本步驟 →'}
        </button>
      </aside>
    </>
  );
}

