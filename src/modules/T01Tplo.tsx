import { useRef, useState } from 'react';
import { caseById, cluesForCase } from '../data';
import {
  TPLO_PLANS,
  TPLO_PLATE_TARGET,
  TPLO_QUESTIONS,
  TPLO_SAW_TARGET,
  TPLO_TEMPLATE_HOLES,
  initialTplo,
  plateSeated,
  rotationOk,
  sawOk,
  scoreTplo,
  templateDone,
  type TploState,
} from '../engine/concept';
import { clamp } from '../engine/geometry';
import { ModuleShell, CheckResult } from '../components/ModuleShell';
import { useModuleState } from '../components/useModuleState';
import { useSvgDrag } from '../components/useSvgDrag';
import { RefChips } from '../components/ui';
import { sound } from '../audio';
import type { ModuleResult } from '../engine/session';

const STEPS = ['術前規劃核對', '圓弧截骨與旋轉示意', '骨板範本固定', '影像檢核'];
/** internal drawing rotation for progress = 1 (schematic only, never shown as a clinical angle) */
const DRAW_ROT = 20;
const SAW_R = 16;
const PLATE_HOLES = [
  { x: -6, y: -6 },
  { x: 0, y: -8 },
  { x: 6, y: -6 },
  { x: 0, y: -15 }, // closest to the joint: not in the template
  { x: 1, y: 6 },
  { x: 1, y: 14 },
  { x: 1, y: 22 },
];

export function T01Tplo({ caseId, onDone }: { caseId: string; onDone: (r: ModuleResult) => void }) {
  const c = caseById(caseId)!;
  const tpa = Number(/TPA\s*(\d+)/.exec(cluesForCase(caseId).find((x) => x.category === 'imaging')?.result ?? '')?.[1] ?? 0);
  const ms = useModuleState<TploState>('PROC-TPLO', initialTplo);
  const s = ms.state;
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useSvgDrag(svgRef);
  const [msg, setMsg] = useState<{ ok: boolean; items: string[]; text?: string } | null>(null);
  const plans = TPLO_PLANS(c.side, tpa);
  const set = ms.set;

  const advance = (ok: boolean, firstKey: string, items: string[], patch: Partial<TploState>) => {
    ms.recordFirst(firstKey, ok);
    if (ok) {
      sound.play('success');
      setMsg({ ok: true, items: [], text: '本步驟完成。' });
      set((p) => ({ ...p, ...patch }));
    } else {
      sound.play('warn');
      setMsg({ ok: false, items });
    }
  };

  const check = () => {
    if (s.step === 1) {
      const pick = plans.find((p) => p.id === s.planPick);
      advance(!!pick?.ok, 's1', [pick ? pick.why : '請選擇一張規劃圖'], { step: 2 });
    } else if (s.step === 2) {
      const items: string[] = [];
      if (!s.sawPlaced) items.push('請先把圓弧鋸中心放到預設規劃標記上');
      if (!s.cut) items.push('請執行截骨示意');
      if (!rotationOk(s)) items.push('骨段尚未旋轉到預設目標標記');
      advance(items.length === 0, 's2', items, { step: 3 });
    } else if (s.step === 3) {
      const items: string[] = [];
      if (!s.plate.seated) items.push('骨板尚未貼合範本位置');
      if (!templateDone(s)) items.push(`範本螺釘未完成（${TPLO_TEMPLATE_HOLES.filter((h) => s.screws.includes(h)).length}/${TPLO_TEMPLATE_HOLES.length}）`);
      advance(items.length === 0, 's3', items, { step: 4 });
    } else {
      const wrong = TPLO_QUESTIONS.filter((q) => s.answers[q.id] !== q.answer);
      const ok = wrong.length === 0;
      ms.recordFirst('s4', ok);
      if (!ok) {
        sound.play('warn');
        setMsg({ ok: false, items: wrong.map((q) => `再想想：${q.q}`) });
        return;
      }
      sound.play('success');
      set((p) => ({ ...p, completed: true }));
      const sc = scoreTplo({ ...ms.sticky, s4: ms.sticky.s4 ?? ok });
      onDone({ score: sc.score, notes: sc.notes });
    }
  };

  const rotDeg = s.rotation * DRAW_ROT;
  const target = TPLO_SAW_TARGET;

  return (
    <ModuleShell
      title={`T01 TPLO 概念操作・${c.side}`}
      subtitle="規劃 → 截骨旋轉示意 → 範本固定 → 影像檢核｜具體角度與容許範圍待專科審閱"
      steps={STEPS}
      current={s.completed ? 4 : s.step - 1}
      done={(i) => s.completed || i + 1 < s.step}
      hint={
        <p>
          {s.step === 1 && '核對病歷患側與 X 光判讀的 TPA。規劃依影像，不依體重。'}
          {s.step === 2 && '拖曳圓弧鋸，讓中心十字對準規劃標記，執行截骨後拖曳藍色把手（或用按鈕）把高原段旋轉到虛線目標標記。'}
          {s.step === 3 && '把骨板拖到虛線範本，再點選範本標示的孔位（亮色）。靠近關節的孔不在範本內。'}
          {s.step === 4 && '確認側標、植入物位置，並記得手術完成不等於康復。'}
        </p>
      }
      onUndo={ms.undo}
      onReset={() => {
        ms.reset();
        setMsg(null);
      }}
      canUndo={ms.canUndo}
      onHint={ms.countHint}
      note={
        <div className="banner">
          <span aria-hidden>ℹ️</span>
          <span>
            本模組為概念教學：依原始資料，截骨與旋轉「未設定可用數值容差」，只檢核是否完成並對齊預設標記，不判定臨床精度。TPLO 不是一般骨折拼接。
          </span>
        </div>
      }
    >
      <div className="op-layout">
        <div>
          {s.step === 1 ? (
            <div className="grid cols-3">
              {plans.map((p) => (
                <button
                  key={p.id}
                  className="care-card"
                  aria-pressed={s.planPick === p.id}
                  onClick={() => {
                    set((x) => ({ ...x, planPick: p.id }));
                  }}
                  data-testid={`plan-${p.id}`}
                  style={{ background: '#0F2233', color: '#DBEAFE', borderColor: s.planPick === p.id ? '#38BDF8' : '#1E3A52' }}
                >
                  <PlanThumb flip={p.id === 'wrong-side'} measured={p.id !== 'by-weight'} tpa={tpa} />
                  <b>{p.text}</b>
                </button>
              ))}
            </div>
          ) : s.step < 4 ? (
            <svg ref={svgRef} viewBox="0 0 140 110" className="stage-svg concept" {...drag.handlers} role="application" aria-label="TPLO 操作示意" data-testid="tplo-stage">
              <defs>
                <linearGradient id="tpBone" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#C7D7E8" />
                  <stop offset=".5" stopColor="#E2EDF8" />
                  <stop offset="1" stopColor="#B8CCE0" />
                </linearGradient>
                <linearGradient id="tpPlate" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#7DD3FC" />
                  <stop offset="1" stopColor="#0E7490" />
                </linearGradient>
                <clipPath id="inArc">
                  <circle cx={target.x} cy={target.y} r={SAW_R} />
                </clipPath>
                <clipPath id="outArc">
                  <path d={`M0 0H140V110H0Z M${target.x + SAW_R} ${target.y} A${SAW_R} ${SAW_R} 0 1 0 ${target.x - SAW_R} ${target.y} A${SAW_R} ${SAW_R} 0 1 0 ${target.x + SAW_R} ${target.y}Z`} clipRule="evenodd" />
                </clipPath>
              </defs>
              <text x="4" y="8" fontSize="4" fill="#8FB3CC">脛骨近端・內側觀（教學示意）・{c.side}</text>
              {/* femur ghost */}
              <path d="M40 2 L70 2 L76 20 Q66 26 56 24 Q46 26 40 20 Z" fill="#E2EDF8" opacity=".25" />
              {/* tibia distal part (outside arc) */}
              <g clipPath={s.cut ? 'url(#outArc)' : undefined}>
                <TibiaShape />
              </g>
              {/* proximal segment rotating inside the arc */}
              {s.cut && (
                <g transform={`rotate(${-rotDeg} ${target.x} ${target.y})`}>
                  <g clipPath="url(#inArc)">
                    <TibiaShape />
                  </g>
                </g>
              )}
              {s.cut && (
                <g transform={`rotate(${-rotDeg} ${target.x} ${target.y})`}>
                  <line x1="44" y1={29 + 0} x2="78" y2="21" stroke="#38BDF8" strokeWidth=".8" />
                </g>
              )}
              {!s.cut && <line x1="44" y1="29" x2="78" y2="21" stroke="#38BDF8" strokeWidth=".8" />}
              {/* preset target mark for the plateau line */}
              {s.step === 2 && (
                <g transform={`rotate(${-DRAW_ROT} ${target.x} ${target.y})`}>
                  <line x1="40" y1="29" x2="82" y2="20" stroke="#22C55E" strokeDasharray="2 1" strokeWidth=".6" />
                  <text x="83" y="20" fontSize="3" fill="#22C55E">預設目標標記</text>
                </g>
              )}
              {/* planning mark */}
              {s.step === 2 && !s.cut && (
                <g pointerEvents="none">
                  <circle cx={target.x} cy={target.y} r={SAW_R} fill="none" stroke="#22C55E" strokeDasharray="1.5 1" strokeWidth=".4" />
                  <path d={`M${target.x - 2} ${target.y}h4M${target.x} ${target.y - 2}v4`} stroke="#22C55E" strokeWidth=".5" />
                  <text x={target.x + 4} y={target.y + SAW_R + 5} fontSize="3" fill="#22C55E">規劃截骨標記</text>
                </g>
              )}
              {/* saw */}
              {s.step === 2 && !s.cut && (
                <g
                  transform={`translate(${s.saw.x} ${s.saw.y})`}
                  style={{ cursor: 'grab' }}
                  onPointerDown={(e) => {
                    set((p) => ({ ...p }));
                    drag.start(
                      'saw',
                      (pt) => set((p) => ({ ...p, saw: { x: clamp(pt.x, 10, 130), y: clamp(pt.y, 10, 100) }, sawPlaced: false }), { record: false }),
                      () =>
                        set((p) => {
                          const ok = sawOk(p);
                          if (ok) sound.play('snap');
                          return ok ? { ...p, saw: { ...TPLO_SAW_TARGET }, sawPlaced: true } : p;
                        }, { record: false }),
                    )(e);
                  }}
                  data-testid="tplo-saw"
                >
                  <circle r={SAW_R + 3} fill="transparent" />
                  <path d={`M${-SAW_R} 0 A${SAW_R} ${SAW_R} 0 0 1 ${SAW_R} 0`} fill="none" stroke="url(#tpPlate)" strokeWidth="1.6" />
                  <path d={`M${-SAW_R} 0 A${SAW_R} ${SAW_R} 0 0 1 ${SAW_R} 0`} fill="none" stroke="#CBD5E1" strokeWidth=".4" strokeDasharray=".8 .6" />
                  <rect x="-1.5" y="-1" width="3" height="16" rx="1" fill="#94A3B8" />
                  <path d="M-2 0h4M0 -2v4" stroke="#F97316" strokeWidth=".5" />
                </g>
              )}
              {/* rotation handle */}
              {s.step === 2 && s.cut && (
                <g
                  transform={`rotate(${-rotDeg} ${target.x} ${target.y}) translate(${target.x - SAW_R} ${target.y})`}
                  style={{ cursor: 'alias' }}
                  onPointerDown={(e) => {
                    set((p) => ({ ...p }));
                    drag.start('rot', (pt) => {
                      // handle starts at 180° (left of the arc); rotate(-θ) moves it to 180° − θ
                      const a = (Math.atan2(pt.y - target.y, pt.x - target.x) * 180) / Math.PI;
                      const theta = 180 - (a < 0 ? a + 360 : a);
                      const progress = clamp(theta / DRAW_ROT, 0, 1.3);
                      set((p) => ({ ...p, rotation: progress }), { record: false });
                    })(e);
                  }}
                  data-testid="tplo-rotate"
                >
                  <circle r="4" fill="transparent" />
                  <circle r="2" fill="#0284C7" stroke="#E0F2FE" strokeWidth=".4" />
                </g>
              )}
              {/* plate template & plate */}
              {s.step === 3 && (
                <>
                  <g transform={`translate(${TPLO_PLATE_TARGET.x} ${TPLO_PLATE_TARGET.y})`} opacity={s.plate.seated ? 0 : 0.6} pointerEvents="none">
                    <TploPlateShape outline />
                  </g>
                  <g
                    transform={`translate(${s.plate.x} ${s.plate.y})`}
                    style={{ cursor: s.plate.seated ? 'default' : 'grab' }}
                    onPointerDown={(e) => {
                      if (s.plate.seated) return;
                      set((p) => ({ ...p }));
                      drag.start(
                        'plate',
                        (pt) => set((p) => ({ ...p, plate: { x: clamp(pt.x, 5, 135), y: clamp(pt.y, 5, 105), seated: false } }), { record: false }),
                        () =>
                          set((p) => {
                            if (!plateSeated(p.plate)) return p;
                            sound.play('snap');
                            return { ...p, plate: { ...TPLO_PLATE_TARGET, seated: true } };
                          }, { record: false }),
                      )(e);
                    }}
                    data-testid="tplo-plate"
                  >
                    <TploPlateShape />
                    {s.plate.seated &&
                      PLATE_HOLES.map((h, i) => {
                        const inT = TPLO_TEMPLATE_HOLES.includes(i);
                        const done = s.screws.includes(i);
                        return (
                          <g
                            key={i}
                            transform={`translate(${h.x} ${h.y})`}
                            role="button"
                            aria-label={`TPLO 骨板孔 ${i + 1}${inT ? '（範本）' : '（非範本，靠近關節）'}`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                              if (s.screws.includes(i) || s.offTemplate.includes(i)) return;
                              if (!inT) {
                                sound.play('warn');
                                set((p) => ({ ...p, offTemplate: [...p.offTemplate, i] }));
                                setMsg({ ok: false, items: ['此孔方向接近關節示意區，不在預設範本內：未鎖入。請依範本孔位固定。'] });
                                return;
                              }
                              sound.play('lock');
                              set((p) => ({ ...p, screws: [...p.screws, i] }));
                            }}
                            data-testid={`tplo-hole-${i}`}
                          >
                            <circle r="3" fill="transparent" />
                            <circle r="1.6" fill={done ? '#E2E8F0' : 'none'} stroke={inT ? '#E0F2FE' : '#F97316'} strokeWidth={inT ? 0.5 : 0.35} strokeDasharray={inT ? undefined : '.6 .4'} />
                            {done && <circle r=".6" fill="#FACC15" />}
                          </g>
                        );
                      })}
                  </g>
                  <rect x="60" y="2" width="22" height="9" fill="#F97316" opacity=".12" />
                  <text x="61" y="8" fontSize="2.6" fill="#FDBA74">關節示意區</text>
                </>
              )}
            </svg>
          ) : (
            <div className="stack">
              <div className="xray" style={{ maxWidth: 520 }}>
                <PostOpXray side={c.side} />
              </div>
              {TPLO_QUESTIONS.map((q) => (
                <div key={q.id} className="row">
                  <span style={{ minWidth: 260 }}>{q.q}</span>
                  {q.options.map((o) => (
                    <button key={o} className="btn sm" aria-pressed={s.answers[q.id] === o} onClick={() => set((p) => ({ ...p, answers: { ...p.answers, [q.id]: o } }))} data-testid={`q-${q.id}-${o}`}>
                      {o}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
          {s.step === 2 && (
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn" disabled={s.sawPlaced} onClick={() => set((p) => ({ ...p, saw: { ...TPLO_SAW_TARGET }, sawPlaced: true }))} data-testid="tplo-place-saw">
                ⌖ 以按鈕對準規劃標記
              </button>
              <button className="btn primary" disabled={!s.sawPlaced || s.cut} onClick={() => set((p) => ({ ...p, cut: true }))} data-testid="tplo-cut">
                ✂ 執行截骨示意
              </button>
              <button className="btn sm" disabled={!s.cut} onClick={() => set((p) => ({ ...p, rotation: clamp(p.rotation - 0.05, 0, 1.3) }))}>
                ⟲ 回轉
              </button>
              <button className="btn sm" disabled={!s.cut} onClick={() => set((p) => ({ ...p, rotation: clamp(p.rotation + 0.05, 0, 1.3) }))} data-testid="tplo-rot-plus">
                ⟳ 旋轉
              </button>
              <span className="small muted">
                對齊狀態：{s.cut ? (rotationOk(s) ? '✓ 已對齊預設目標標記' : s.rotation > 1 ? '△ 超過標記，請回轉' : '△ 尚未到達標記') : '尚未截骨'}
              </span>
            </div>
          )}
          {s.step === 3 && (
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn" disabled={s.plate.seated} onClick={() => set((p) => ({ ...p, plate: { ...TPLO_PLATE_TARGET, seated: true } }))} data-testid="tplo-seat-plate">
                ⌖ 以按鈕貼合範本
              </button>
              <span className="small muted">範本螺釘 {TPLO_TEMPLATE_HOLES.filter((h) => s.screws.includes(h)).length}/{TPLO_TEMPLATE_HOLES.length}</span>
            </div>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn primary lg" onClick={check} disabled={s.completed || (s.step === 1 && !s.planPick)} data-testid="tplo-check">
              ✔ 完成檢核（步驟 {s.step}）
            </button>
          </div>
          <div style={{ marginTop: 8 }} aria-live="polite">
            {msg && <CheckResult ok={msg.ok} items={msg.items} okText={msg.text ?? ''} />}
          </div>
        </div>
        <aside className="card small stack">
          <b>病例規劃資料</b>
          <p>
            患側：{c.side}
            <br />X 光：TPA {tpa}°（來自 {caseId}-E3）
            <br />
            體重 {c.weightKg} kg：體重不能單獨決定術式。
          </p>
          <p className="muted">預設目標由規劃圖提供；本遊戲不自行設定通用臨床術後角度門檻。</p>
          <RefChips ids={['R01', 'R02', 'G01']} />
        </aside>
      </div>
    </ModuleShell>
  );
}

function TibiaShape() {
  return (
    <path
      d="M42 30 Q40 24 48 22 L78 18 Q86 20 84 30 Q80 40 74 46 L70 104 L54 104 L54 52 Q44 42 42 30 Z"
      fill="url(#tpBone)"
      stroke="#E2EDF8"
      strokeWidth=".5"
    />
  );
}

function TploPlateShape({ outline = false }: { outline?: boolean }) {
  const d = 'M-10 -9 Q-10 -18 0 -19 Q10 -18 10 -9 Q8 -2 4 0 L4 26 Q4 29 1 29 Q-2 29 -2 26 L-2 0 Q-8 -2 -10 -9 Z';
  return outline ? <path d={d} fill="none" stroke="#22C55E" strokeDasharray="1.2 .8" strokeWidth=".5" /> : <path d={d} fill="url(#tpPlate)" stroke="#BAE6FD" strokeWidth=".3" />;
}

function PlanThumb({ flip, measured, tpa }: { flip: boolean; measured: boolean; tpa: number }) {
  return (
    <svg viewBox="0 0 60 40" width="100%" height="80" aria-hidden>
      <rect width="60" height="40" fill="#000" rx="3" />
      <g transform={flip ? 'translate(60 0) scale(-1 1)' : undefined}>
        <path d="M18 14 Q17 10 22 9 L38 7 Q43 8 42 13 Q40 18 37 21 L35 38 L27 38 L27 23 Q19 19 18 14 Z" fill="#E2E8F0" />
        {measured && <line x1="18" y1="14" x2="42" y2={14 - Math.tan((tpa * Math.PI) / 180) * 12} stroke="#38BDF8" strokeWidth=".8" />}
      </g>
      <text x="4" y="36" fontSize="5" fill="#fff" fontWeight="700">
        {flip ? 'R' : 'L'}
      </text>
      {!measured && (
        <text x="30" y="20" fontSize="4" fill="#FDE68A" textAnchor="middle">
          未量測
        </text>
      )}
    </svg>
  );
}

function PostOpXray({ side }: { side: string }) {
  const marker = side.includes('左') ? 'L' : 'R';
  return (
    <svg viewBox="0 0 120 90" role="img" aria-label="TPLO 術後教學示意 X 光">
      <rect width="120" height="90" fill="#000" />
      <path d="M40 4 L64 4 L70 22 Q60 28 50 26 Q42 28 38 22 Z" fill="#CBD5E1" />
      <path d="M38 34 Q36 26 44 24 L70 22 Q78 24 76 32 Q72 40 66 46 L62 86 L48 86 L48 50 Q40 44 38 34 Z" fill="#E2E8F0" />
      <path d="M50 32 Q50 25 57 24 Q64 25 64 32 Q62 37 59 38 L59 60 L55 60 L55 38 Q51 37 50 32 Z" fill="#fff" opacity=".9" />
      {[
        [53, 30],
        [57, 28],
        [61, 30],
        [57, 44],
        [57, 50],
        [57, 56],
      ].map(([x, y]) => (
        <line key={`${x}-${y}`} x1={x} y1={y} x2={x + 8} y2={y + 1} stroke="#fff" strokeWidth="1" />
      ))}
      <text x="2" y="5" fontSize="3.2" fill="#E2E8F0">Lat 側位・脛骨近端</text>
      <text x="118" y="5" fontSize="3.2" fill="#E2E8F0" textAnchor="end">教學示意・非臨床影像（非 DICOM）</text>
      <rect x="4" y="76" width="7" height="7" fill="#F8FAFC" />
      <text x="7.5" y="81.4" fontSize="5.5" textAnchor="middle" fontWeight="700">{marker}</text>
    </svg>
  );
}
