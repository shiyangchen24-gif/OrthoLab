import { useRef, useState } from 'react';
import { caseById } from '../data';
import { FHNE_REGIONS, FHNE_ROUTES, FHNE_ZONE, cutInZone, initialFhne, residualSize, scoreFhne, type FhneState } from '../engine/concept';
import { clamp, dot, sub } from '../engine/geometry';
import { ModuleShell, CheckResult } from '../components/ModuleShell';
import { useModuleState } from '../components/useModuleState';
import { useSvgDrag } from '../components/useSvgDrag';
import { RefChips } from '../components/ui';
import { sound } from '../audio';
import type { ModuleResult } from '../engine/session';

const STEPS = ['辨識股骨頭頸', '切除示意', '殘留撞擊檢查', '疼痛與復健路線'];
// schematic geometry (VD view; patient's right on the viewer's left)
const HEAD = { x: 40, y: 38 };
const BASE = { x: 55, y: 53 };
const AXIS = sub(BASE, HEAD);
const AXIS_LEN = Math.hypot(AXIS.x, AXIS.y);
const U = { x: AXIS.x / AXIS_LEN, y: AXIS.y / AXIS_LEN };
const N = { x: -U.y, y: U.x };
const at = (t: number) => ({ x: HEAD.x + AXIS.x * t, y: HEAD.y + AXIS.y * t });

export function T02Fhne({ caseId, onDone }: { caseId: string; onDone: (r: ModuleResult) => void }) {
  const c = caseById(caseId)!;
  const ms = useModuleState<FhneState>('PROC-FHNE', initialFhne);
  const s = ms.state;
  const set = ms.set;
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useSvgDrag(svgRef);
  const [msg, setMsg] = useState<{ ok: boolean; items: string[]; text?: string } | null>(null);

  const ok = (text: string) => {
    sound.play('success');
    setMsg({ ok: true, items: [], text });
  };
  const bad = (items: string[]) => {
    sound.play('warn');
    setMsg({ ok: false, items });
  };

  const pick = (id: string) => {
    if (s.step !== 1) return;
    const r = FHNE_REGIONS.find((x) => x.id === id)!;
    ms.recordFirst('s1', r.ok);
    set((p) => ({ ...p, picks: [...p.picks, id] }));
    if (r.ok) {
      ok('正確：右股骨頭頸為切除目標；大轉子與股骨幹為保留骨區。');
      set((p) => ({ ...p, step: 2 }));
    } else bad(['why' in r ? r.why : '再確認一次']);
  };

  const executeCut = () => {
    const inZone = cutInZone(s.cutT);
    ms.recordFirst('s2', inZone);
    if (!inZone) {
      bad([s.cutT < FHNE_ZONE.min ? '切除示意線太靠近股骨頭：會殘留過多股骨頸，請往大轉子方向移動。' : '切除示意線越過預設保留骨區（大轉子側），請往股骨頭方向移動。']);
      return;
    }
    set((p) => ({ ...p, cutDone: true, step: 3 }));
    ok('切除示意完成。下一步：檢查是否仍有殘留骨性撞擊。');
  };

  const spurPos = (() => {
    const p = at(s.cutT);
    return { x: p.x + N.x * 5.5, y: p.y + N.y * 5.5 };
  })();

  const clickSpur = (hit: boolean) => {
    if (s.step !== 3 || s.spurFound) return;
    if (hit) {
      ms.recordFirst('s3', s.spurClicks === 0);
      set((p) => ({ ...p, spurFound: true }));
      ok('找到殘留骨嵴：活動時會與髖臼緣接觸。請磨平。');
    } else {
      set((p) => ({ ...p, spurClicks: p.spurClicks + 1 }), { record: false });
      bad(['這裡沒有骨性接觸。播放活動示意，觀察截骨面哪裡先碰到髖臼緣。']);
    }
  };

  const checkStep3 = () => {
    const items: string[] = [];
    if (!s.spurFound) {
      items.push('尚未定位殘留骨性撞擊');
      ms.recordFirst('s3', false);
    }
    if (!s.smoothed) items.push('尚未磨平截骨面');
    if (s.smoothed && s.romAfter < 0.95) items.push('磨平後請再播放完整活動示意（拉到最右）確認無骨性接觸');
    if (items.length) return bad(items);
    set((p) => ({ ...p, step: 4 }));
    ok('截骨面平順，活動示意中無骨性接觸。');
  };

  const chooseRoute = (id: string) => {
    const r = FHNE_ROUTES.find((x) => x.id === id)!;
    ms.recordFirst('s4', r.ok);
    set((p) => ({ ...p, route: id }));
    if (!r.ok) return bad([r.why]);
    sound.play('success');
    set((p) => ({ ...p, completed: true }));
    const sc = scoreFhne({ ...ms.sticky, s4: ms.sticky.s4 ?? true });
    onDone({ score: sc.score, notes: sc.notes });
  };

  const rom = s.step === 3 ? (s.smoothed ? s.romAfter : s.romMax) : 0;
  const romDeg = rom * 24;
  const contact = s.step === 3 && !s.smoothed && rom > 0.45;
  const cutP = at(s.cutT);
  const lineA = { x: cutP.x + N.x * 9, y: cutP.y + N.y * 9 };
  const lineB = { x: cutP.x - N.x * 9, y: cutP.y - N.y * 9 };
  const zA = at(FHNE_ZONE.min);
  const zB = at(FHNE_ZONE.max);
  const size = residualSize(s.cutT);

  return (
    <ModuleShell
      title={`T02 FHNE 股骨頭頸切除・${c.side}`}
      subtitle="辨識 → 切除示意 → 殘留撞擊檢查 → 疼痛與復健｜不含骨板螺釘關卡；切除區待專科審閱"
      steps={STEPS}
      current={s.completed ? 4 : s.step - 1}
      done={(i) => s.completed || i + 1 < s.step}
      hint={
        <p>
          {s.step === 1 && 'VD 影像中病患右側位於觀看者左側（看 R 側標）。點選患側的股骨頭與股骨頸。'}
          {s.step === 2 && '拖曳切除示意線（或用滑桿）到綠色教學示意區內，再執行切除。'}
          {s.step === 3 && '拉動「活動示意」滑桿，觀察截骨面哪一點先碰到髖臼緣，點選該處，再磨平並重新檢查完整活動。'}
          {s.step === 4 && 'FHNE 後的功能恢復依賴疼痛控制與漸進復健。'}
        </p>
      }
      onUndo={ms.undo}
      onReset={() => {
        ms.reset();
        setMsg(null);
      }}
      canUndo={ms.canUndo}
      onHint={ms.countHint}
    >
      <div className="op-layout">
        <div>
          <svg ref={svgRef} viewBox="0 0 140 100" className="stage-svg concept" {...drag.handlers} role="application" aria-label="FHNE 操作示意（VD 視角）" data-testid="fhne-stage">
            <defs>
              <linearGradient id="fhBone" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#E2EDF8" />
                <stop offset="1" stopColor="#B8CCE0" />
              </linearGradient>
            </defs>
            <text x="4" y="7" fontSize="3.6" fill="#8FB3CC">VD 腹背位示意・病患右側在左</text>
            <rect x="4" y="86" width="8" height="8" fill="#E2E8F0" />
            <text x="8" y="92" fontSize="6" textAnchor="middle" fontWeight="700" fill="#0B1924">R</text>
            {/* pelvis */}
            <path d="M48 12 Q70 4 92 12 L98 36 Q88 46 70 48 Q52 46 42 36 Z" fill="url(#fhBone)" opacity=".7" />
            {/* acetabula */}
            <path d="M30 32 Q40 22 50 32" fill="none" stroke="#E2EDF8" strokeWidth="1.6" />
            <path d="M90 32 Q100 22 110 32" fill="none" stroke="#E2EDF8" strokeWidth="1.6" />
            {/* contralateral (left) femur */}
            <g onClick={() => pick('left-head')} style={{ cursor: s.step === 1 ? 'pointer' : 'default' }} data-testid="fhne-left-head" role={s.step === 1 ? 'button' : undefined} aria-label="左股骨頭（對側）">
              <rect x="82" y="30" width="26" height="69" fill="transparent" />
              <circle cx="100" cy="38" r="7" fill="url(#fhBone)" />
              <path d="M100 42 L86 54 L84 98 L94 98 L94 56 Z" fill="url(#fhBone)" />
            </g>
            {/* right femur, rotating for ROM in step 3 */}
            <g transform={`rotate(${-romDeg} ${HEAD.x} ${HEAD.y})`}>
              <g onClick={() => pick('shaft')} style={{ cursor: s.step === 1 ? 'pointer' : 'default' }} data-testid="fhne-shaft" role={s.step === 1 ? 'button' : undefined} aria-label="股骨幹">
                <path d="M50 52 L60 52 L58 98 L48 98 Z" fill="url(#fhBone)" />
              </g>
              <g onClick={() => pick('trochanter')} style={{ cursor: s.step === 1 ? 'pointer' : 'default' }} data-testid="fhne-trochanter" role={s.step === 1 ? 'button' : undefined} aria-label="大轉子">
                <ellipse cx="60" cy="48" rx="5" ry="6" fill="url(#fhBone)" />
              </g>
              {/* head + neck (removed after cut) */}
              <g
                onClick={() => pick('head-neck')}
                style={{ cursor: s.step === 1 ? 'pointer' : 'default' }}
                opacity={s.cutDone ? 0.15 : 1}
                data-testid="fhne-head-neck"
                role={s.step === 1 ? 'button' : undefined}
                aria-label="右股骨頭頸"
              >
                <path d={`M${HEAD.x - 3} ${HEAD.y - 2} L${BASE.x - 4} ${BASE.y + 3} L${BASE.x + 3} ${BASE.y - 4} L${HEAD.x + 3} ${HEAD.y - 6} Z`} fill="url(#fhBone)" />
                {/* collapsed / deformed head (C03-E3) */}
                <path d={`M${HEAD.x - 7} ${HEAD.y + 1} Q${HEAD.x - 5} ${HEAD.y - 7} ${HEAD.x + 2} ${HEAD.y - 6} L${HEAD.x + 6} ${HEAD.y} Q${HEAD.x} ${HEAD.y + 5} ${HEAD.x - 7} ${HEAD.y + 1} Z`} fill="#CBD5E1" stroke="#94A3B8" strokeWidth=".5" />
              </g>
              {s.cutDone && (
                <>
                  {/* cut surface */}
                  <line x1={lineA.x} y1={lineA.y} x2={lineB.x} y2={lineB.y} stroke="#38BDF8" strokeWidth=".6" />
                  {!s.smoothed && (
                    <g onClick={(e) => (e.stopPropagation(), clickSpur(true))} style={{ cursor: 'pointer' }} role="button" aria-label="截骨面殘留骨嵴" data-testid="fhne-spur">
                      <circle cx={spurPos.x} cy={spurPos.y} r={4} fill="transparent" />
                      <path d={`M${spurPos.x - size / 2} ${spurPos.y} q${size / 2} ${-size} ${size} 0`} fill={contact ? '#F97316' : '#E2EDF8'} stroke={s.spurFound ? '#F97316' : 'none'} strokeWidth=".4" />
                    </g>
                  )}
                </>
              )}
            </g>
            {/* step 3: wrong-spot click target over the femur area */}
            {s.step === 3 && !s.spurFound && <rect x="44" y="60" width="18" height="30" fill="transparent" onClick={() => clickSpur(false)} data-testid="fhne-miss" />}
            {contact && <text x="22" y="22" fontSize="3.2" fill="#FDBA74">⚠ 骨性接觸示意</text>}
            {/* step 2: zone + cut line */}
            {s.step === 2 && (
              <g>
                <line x1={zA.x} y1={zA.y} x2={zB.x} y2={zB.y} stroke="#22C55E" strokeOpacity=".35" strokeWidth="7" />
                <text x={zB.x + 4} y={zB.y + 8} fontSize="2.8" fill="#86EFAC">教學示意區（待專科審閱）</text>
                <line x1={lineA.x} y1={lineA.y} x2={lineB.x} y2={lineB.y} stroke="#F97316" strokeWidth=".7" strokeDasharray="1.2 .6" />
                <g
                  transform={`translate(${lineA.x} ${lineA.y})`}
                  style={{ cursor: 'grab' }}
                  onPointerDown={(e) => {
                    set((p) => ({ ...p }));
                    drag.start('cut', (pt) => {
                      const t = dot(sub(pt, HEAD), U) / AXIS_LEN;
                      set((p) => ({ ...p, cutT: clamp(t, 0, 1) }), { record: false });
                    })(e);
                  }}
                  data-testid="fhne-cut-handle"
                >
                  <circle r="3.5" fill="transparent" />
                  <circle r="1.8" fill="#0284C7" stroke="#E0F2FE" strokeWidth=".4" />
                </g>
              </g>
            )}
          </svg>
          {s.step === 2 && (
            <div className="row" style={{ marginTop: 8 }}>
              <label className="small">
                切除位置（頭側 ↔ 轉子側）
                <input type="range" min={0} max={100} value={Math.round(s.cutT * 100)} onChange={(e) => set((p) => ({ ...p, cutT: Number(e.target.value) / 100 }))} aria-label="切除示意線位置" data-testid="fhne-cut-range" />
              </label>
              <button className="btn primary" onClick={executeCut} data-testid="fhne-execute">
                ✂ 執行切除示意
              </button>
              <span className="small muted">{cutInZone(s.cutT) ? '✓ 位於教學示意區' : '△ 不在教學示意區'}</span>
            </div>
          )}
          {s.step === 3 && (
            <div className="stack" style={{ marginTop: 8 }}>
              <label className="small row">
                活動示意（伸展／外展）
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(rom * 100)}
                  onChange={(e) => {
                    const v = Number(e.target.value) / 100;
                    set((p) => (p.smoothed ? { ...p, romAfter: Math.max(p.romAfter, v) } : { ...p, romMax: v }), { record: false });
                  }}
                  aria-label="髖關節活動示意"
                  data-testid="fhne-rom"
                />
              </label>
              <div className="row">
                <button className="btn" disabled={!s.spurFound || s.smoothed} onClick={() => set((p) => ({ ...p, smoothed: true, romAfter: 0 }))} data-testid="fhne-smooth">
                  🪚 磨平殘留骨嵴
                </button>
                <button className="btn primary" onClick={checkStep3} data-testid="fhne-check3">
                  ✔ 完成殘留檢查
                </button>
              </div>
            </div>
          )}
          {s.step === 4 && (
            <div className="deck" style={{ marginTop: 8 }}>
              {FHNE_ROUTES.map((r) => (
                <button key={r.id} className="care-card" aria-pressed={s.route === r.id} onClick={() => chooseRoute(r.id)} disabled={s.completed} data-testid={`fhne-route-${r.id}`} style={{ background: '#0F2233', color: '#DBEAFE' }}>
                  <b>{r.text}</b>
                </button>
              ))}
            </div>
          )}
          <div style={{ marginTop: 8 }} aria-live="polite">
            {msg && <CheckResult ok={msg.ok} items={msg.items} okText={msg.text ?? ''} />}
          </div>
        </div>
        <aside className="card small stack">
          <b>病例資料</b>
          <p>
            {c.breed}・{c.ageMonths} 月齡・{c.weightKg} kg
            <br />
            X 光：右股骨頭變形及塌陷（C03-E3）
          </p>
          <p className="muted">FHNE 不使用骨板螺釘固定，也不等同重建正常關節。</p>
          <RefChips ids={['R05', 'R12', 'G01']} />
        </aside>
      </div>
    </ModuleShell>
  );
}
