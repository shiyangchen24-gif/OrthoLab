import { useState } from 'react';
import { caseById } from '../data';
import {
  MPL_DEPTH_TARGET,
  MPL_PROCEDURES,
  MPL_QUESTIONS,
  MPL_STRUCTURES,
  MPL_TT_TARGET,
  comboVerdict,
  correctionDone,
  grooveOk,
  initialMpl,
  patellaOffset,
  scoreMpl,
  trackStable,
  ttOk,
  type MplState,
} from '../engine/concept';
import { ModuleShell, CheckResult } from '../components/ModuleShell';
import { useModuleState } from '../components/useModuleState';
import { RefChips } from '../components/ui';
import { sound } from '../audio';
import type { ModuleResult } from '../engine/session';

const STEPS = ['辨識排列異常', '選擇處置組合', '模擬矯正', '屈伸軌跡檢核'];
const ABNORMAL = MPL_STRUCTURES.filter((x) => x.abnormal).map((x) => x.id);

export function T03Mpl({ caseId, onDone }: { caseId: string; onDone: (r: ModuleResult) => void }) {
  const c = caseById(caseId)!;
  const ms = useModuleState<MplState>('PROC-MPL-COMBO', initialMpl);
  const s = ms.state;
  const set = ms.set;
  const [msg, setMsg] = useState<{ ok: boolean; items: string[]; text?: string } | null>(null);
  const ok = (text: string) => (sound.play('success'), setMsg({ ok: true, items: [], text }));
  const bad = (items: string[]) => (sound.play('warn'), setMsg({ ok: false, items }));

  const clickStructure = (id: string) => {
    if (s.step !== 1) return;
    const st = MPL_STRUCTURES.find((x) => x.id === id)!;
    if (st.abnormal) {
      if (s.found.includes(id)) return;
      sound.play('reveal');
      const found = [...s.found, id];
      set((p) => ({ ...p, found }));
      setMsg({ ok: true, items: [], text: `已標記：${st.label}（${found.length}/${ABNORMAL.length}）` });
    } else {
      if (!s.wrong.includes(id)) set((p) => ({ ...p, wrong: [...p.wrong, id] }));
      bad(['why' in st ? st.why : '此處無異常']);
    }
  };

  const check = () => {
    if (s.step === 1) {
      if (s.found.length < ABNORMAL.length) return bad([`尚有 ${ABNORMAL.length - s.found.length} 個排列異常未標記`]);
      ms.recordFirst('s1Wrong', s.wrong.length);
      set((p) => ({ ...p, step: 2 }));
      ok('排列判讀完成：分級不能取代排列評估。');
    } else if (s.step === 2) {
      const v = comboVerdict(s.combo);
      ms.recordFirst('s2', v.ok);
      if (!v.ok)
        return bad([
          ...v.missing.map((p) => `缺少：${p.label}（${p.why}）`),
          ...v.extra.map((p) => `本例不需要：${p.label}（${p.why}）`),
        ]);
      set((p) => ({ ...p, step: 3, comboChecked: true }));
      ok('組合符合本例所見。不是每例都需要全部術式。');
    } else if (s.step === 3) {
      const items: string[] = [];
      if (s.combo.includes('sulcoplasty') && !grooveOk(s)) items.push('滑車溝尚未達到預設示意深度');
      if (s.combo.includes('ttt') && !ttOk(s)) items.push('脛骨粗隆尚未對齊股四頭肌示意軸線');
      if (s.combo.includes('soft') && !s.softDone) items.push('軟組織平衡尚未完成');
      if (items.length) return bad(items);
      set((p) => ({ ...p, step: 4 }));
      ok('矯正示意完成。接著播放屈伸動畫確認軌跡。');
    } else {
      const items: string[] = [];
      if (s.flexMin > 0.05 || s.flexMax < 0.95) items.push('請把屈伸滑桿從完全伸展拉到完全屈曲，播放完整範圍');
      const wrong = MPL_QUESTIONS.filter((q) => s.answers[q.id] !== q.answer);
      if (!trackStable(s)) items.push('軌跡仍不穩定：請返回調整');
      items.push(...wrong.map((q) => `再確認：${q.q}`));
      ms.recordFirst('s4', items.length === 0);
      if (items.length) return bad(items);
      set((p) => ({ ...p, completed: true }));
      sound.play('success');
      const sc = scoreMpl({ ...ms.sticky, s4: ms.sticky.s4 ?? true });
      onDone({ score: sc.score, notes: sc.notes });
    }
  };

  // schematic positions (front view of the right stifle; medial is drawn on the viewer's right)
  const grooveX = 70;
  const depthPx = 1 + (s.depth / 100) * 4;
  const tubX = s.step >= 3 && s.combo.includes('ttt') ? 79 - 0.11 * s.tuberosity : 79;
  const flex = s.step === 4 ? s.flex : 0;
  const pOff = s.step < 3 ? 9 : patellaOffset(s, flex) * 1.4;
  const patellaY = 30 + flex * 14;
  const stable = s.step === 4 ? trackStable(s) : null;

  const clickable = (id: string) => ({
    onClick: () => clickStructure(id),
    style: { cursor: s.step === 1 ? 'pointer' : 'default' },
    role: s.step === 1 ? 'button' : undefined,
    'aria-label': MPL_STRUCTURES.find((x) => x.id === id)!.label,
    'data-testid': `mpl-${id}`,
  });
  const ring = (id: string) => (s.found.includes(id) ? '#22C55E' : s.wrong.includes(id) ? '#EF4444' : 'none');

  return (
    <ModuleShell
      title={`T03 髕骨脫位組合矯正・${c.side}`}
      subtitle="辨識排列 → 依所見選組合 → 操作示意 → 屈伸軌跡｜組內順序可互換；嚴重變形轉介矯正截骨評估"
      steps={STEPS}
      current={s.completed ? 4 : s.step - 1}
      done={(i) => s.completed || i + 1 < s.step}
      hint={
        <p>
          {s.step === 1 && '點選影像中三個排列異常：滑車溝深度、脛骨粗隆位置、髕骨位置。'}
          {s.step === 2 && '依 C04 的所見（滑車溝不足、粗隆偏內、無重大角度變形、CrCL 穩定）選擇處置；軟組織平衡可依軌跡需要選用。'}
          {s.step === 3 && '依你選的術式逐一操作，順序不限。'}
          {s.step === 4 && '拉動屈伸滑桿走完整範圍，觀察髕骨是否維持在溝內。'}
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
          <svg viewBox="0 0 140 110" className="stage-svg concept" role="img" aria-label="膝關節前面觀示意" data-testid="mpl-stage">
            <defs>
              <linearGradient id="mpBone" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#B8CCE0" />
                <stop offset=".5" stopColor="#E2EDF8" />
                <stop offset="1" stopColor="#B8CCE0" />
              </linearGradient>
            </defs>
            <text x="4" y="7" fontSize="3.6" fill="#8FB3CC">前面觀示意・{c.side}</text>
            <text x="126" y="60" fontSize="3.2" fill="#8FB3CC" textAnchor="middle">內側 M</text>
            <text x="14" y="60" fontSize="3.2" fill="#8FB3CC" textAnchor="middle">外側 L</text>
            {/* quadriceps axis */}
            <line x1={grooveX} y1="0" x2={grooveX} y2="104" stroke="#38BDF8" strokeDasharray="1.5 1" strokeWidth=".4" />
            <text x={grooveX + 2} y="5" fontSize="2.6" fill="#38BDF8">股四頭肌示意軸線</text>
            {/* femur */}
            <path d="M58 0 L82 0 L84 34 Q92 40 90 48 L50 48 Q48 40 56 34 Z" fill="url(#mpBone)" />
            <g {...clickable('condyle')}>
              <ellipse cx="84" cy="44" rx="6" ry="4" fill="url(#mpBone)" stroke={ring('condyle')} strokeWidth=".6" />
            </g>
            {/* trochlear groove */}
            <g {...clickable('groove')}>
              <rect x={grooveX - 8} y="22" width="16" height="24" fill="transparent" />
              <path d={`M${grooveX - 6} 24 Q${grooveX} ${24 + depthPx} ${grooveX + 6} 24 L${grooveX + 6} 46 Q${grooveX} ${46 + depthPx} ${grooveX - 6} 46 Z`} fill="#0B1924" opacity={0.15 + s.depth / 250} stroke={ring('groove')} strokeWidth=".6" />
              {s.step >= 3 && s.combo.includes('sulcoplasty') && <text x={grooveX - 18} y="36" fontSize="2.6" fill="#BAE6FD">溝深 {grooveOk(s) ? '✓' : '…'}</text>}
            </g>
            {/* joint line + CCL */}
            <g {...clickable('ccl')}>
              <rect x="62" y="49" width="16" height="5" fill="transparent" />
              <line x1="64" y1="50" x2="76" y2="54" stroke="#FDE68A" strokeWidth="1" opacity=".7" />
              <circle cx="70" cy="52" r="3.5" fill="none" stroke={ring('ccl')} strokeWidth=".6" />
            </g>
            {/* tibia */}
            <path d="M50 54 L90 54 L86 62 L78 64 L76 104 L64 104 L62 64 L54 62 Z" fill="url(#mpBone)" />
            <g {...clickable('tuberosity')}>
              <circle cx={tubX} cy="64" r="3.4" fill="#E2EDF8" stroke={ring('tuberosity') === 'none' ? '#94A3B8' : ring('tuberosity')} strokeWidth=".6" />
              {s.step === 3 && s.combo.includes('ttt') && <path d={`M${tubX} 64 L${grooveX} 64`} stroke="#F97316" strokeWidth=".4" strokeDasharray="1 .6" />}
            </g>
            {/* patellar ligament */}
            <line x1={grooveX + pOff} y1={patellaY + 6} x2={tubX} y2="62" stroke="#E2E8F0" strokeWidth="1.2" opacity=".7" />
            {/* patella */}
            <g {...clickable('patella')}>
              <ellipse cx={grooveX + pOff} cy={patellaY} rx="4.5" ry="6" fill="#F8FAFC" stroke={stable === false || pOff > 1.4 ? '#EF4444' : ring('patella') === 'none' ? '#38BDF8' : ring('patella')} strokeWidth=".6" />
            </g>
            {s.softDone && <path d={`M${grooveX - 9} 26 q-3 6 0 12`} stroke="#22C55E" strokeWidth=".8" fill="none" />}
            {s.step === 4 && (
              <text x="70" y="108" fontSize="3" textAnchor="middle" fill={stable ? '#86EFAC' : '#FECACA'}>
                {stable ? '✓ 髕骨軌跡維持於溝內' : '✕ 屈曲時髕骨脫出'}
              </text>
            )}
          </svg>

          {s.step === 2 && (
            <div className="deck" style={{ marginTop: 8 }}>
              {MPL_PROCEDURES.map((p) => {
                const on = s.combo.includes(p.id);
                return (
                  <button
                    key={p.id}
                    className="care-card"
                    aria-pressed={on}
                    onClick={() => set((x) => ({ ...x, combo: on ? x.combo.filter((y) => y !== p.id) : [...x.combo, p.id] }))}
                    data-testid={`mpl-proc-${p.id}`}
                    style={{ background: on ? '#0C4A6E' : '#0F2233', color: '#DBEAFE', borderColor: on ? '#38BDF8' : '#1E3A52' }}
                  >
                    <b>
                      {on ? '☑' : '☐'} {p.label}
                    </b>
                  </button>
                );
              })}
            </div>
          )}

          {s.step === 3 && (
            <div className="stack" style={{ marginTop: 8 }}>
              {s.combo.includes('sulcoplasty') && (
                <label className="row small">
                  滑車溝成形：加深 <input type="range" min={0} max={100} value={s.depth} onChange={(e) => set((p) => ({ ...p, depth: Number(e.target.value) }), { record: false })} aria-label="滑車溝深度" data-testid="mpl-depth" />
                  <span>{grooveOk(s) ? '✓ 已達預設示意深度' : `目標標記 ${MPL_DEPTH_TARGET}`}</span>
                </label>
              )}
              {s.combo.includes('ttt') && (
                <label className="row small">
                  脛骨粗隆轉位：向外側移 <input type="range" min={0} max={100} value={s.tuberosity} onChange={(e) => set((p) => ({ ...p, tuberosity: Number(e.target.value) }), { record: false })} aria-label="粗隆轉位量" data-testid="mpl-tt" />
                  <span>{ttOk(s) ? '✓ 已對齊示意軸線' : s.tuberosity > MPL_TT_TARGET.max ? '△ 過度外移' : '△ 尚未對齊'}</span>
                </label>
              )}
              {s.combo.includes('soft') && (
                <div className="row small">
                  軟組織平衡：
                  <button className="btn sm" aria-pressed={s.softDone} onClick={() => set((p) => ({ ...p, softDone: !p.softDone }))} data-testid="mpl-soft">
                    {s.softDone ? '✓ 已完成外側緊縮／內側鬆解示意' : '執行外側緊縮／內側鬆解示意'}
                  </button>
                </div>
              )}
              <p className="small muted">{correctionDone(s) ? '必要處置均完成，可進入軌跡檢核。' : '請完成所選處置。'}</p>
            </div>
          )}

          {s.step === 4 && (
            <div className="stack" style={{ marginTop: 8 }}>
              <label className="row small">
                屈伸示意（伸展 ↔ 屈曲）
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(s.flex * 100)}
                  onChange={(e) => {
                    const v = Number(e.target.value) / 100;
                    set((p) => ({ ...p, flex: v, flexMin: Math.min(p.flexMin, v), flexMax: Math.max(p.flexMax, v) }), { record: false });
                  }}
                  aria-label="屈伸角度示意"
                  data-testid="mpl-flex"
                />
                <span className="muted">已播放範圍 {Math.round(s.flexMin * 100)}–{Math.round(s.flexMax * 100)}%</span>
              </label>
              {MPL_QUESTIONS.map((q) => (
                <div key={q.id} className="row">
                  <span style={{ minWidth: 260 }}>{q.q}</span>
                  {q.options.map((o) => (
                    <button key={o} className="btn sm" aria-pressed={s.answers[q.id] === o} onClick={() => set((p) => ({ ...p, answers: { ...p.answers, [q.id]: o } }))} data-testid={`mplq-${q.id}-${o}`}>
                      {o}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn primary lg" onClick={check} disabled={s.completed} data-testid="mpl-check">
              ✔ 完成檢核（步驟 {s.step}）
            </button>
          </div>
          <div style={{ marginTop: 8 }} aria-live="polite">
            {msg && <CheckResult ok={msg.ok} items={msg.items} okText={msg.text ?? ''} />}
          </div>
        </div>
        <aside className="card small stack">
          <b>病例所見</b>
          <p>
            右 MPL grade II 且重現症狀；CrCL 穩定（C04-E2）
            <br />
            伸膝機制排列異常；無重大角度變形（C04-E3）
            <br />
            模擬術中所見：滑車溝不足、粗隆偏內（C04-E4）
          </p>
          <p className="muted">滑桿目標標記為示意圖預設值，不代表臨床量測數值。</p>
          <RefChips ids={['R03', 'G01']} />
        </aside>
      </div>
    </ModuleShell>
  );
}
