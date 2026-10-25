import { useMemo, useState, type ReactNode } from 'react';
import { caseById, cluesForCase, optionsForCase, moduleById } from '../data';
import { chooseOption, clueAvailable, missingRequiredClues, proceed, revealClue, type CaseSession, type DecisionFeedback } from '../engine/session';
import { ANSWER_LABEL, type Clue, type ClueCategory } from '../types';
import { Patient } from '../components/art/Patient';
import { XRayPanel } from '../components/art/XRay';
import { Flags, RefChips, Stepper } from '../components/ui';
import { useStore } from '../store';
import { sound } from '../audio';

const CAT_ICON: Record<ClueCategory, string> = { history: '🐾', ortho: '🤲', imaging: '🩻', supplement: '📋' };
const CAT_LABEL: Record<ClueCategory, string> = { history: '步態／病史', ortho: '骨科檢查', imaging: '影像', supplement: '補充資訊' };

export const FLOW = ['接診', '檢查線索', '臨床推理', '處置／操作', '照護', '學習回饋'];

export function flowIndex(s: CaseSession): number {
  if (s.stage === 'results') return 5;
  if (s.stage === 'care') return 4;
  if (s.stage === 'procedure' || s.stage === 'explain') return 3;
  if (missingRequiredClues(s).length === 0) return 2;
  return s.revealed.length ? 1 : 0;
}

function highlight(text: string): ReactNode {
  // emphasise measurements, grades and side words so new findings stand out
  const parts = text.split(/(\d+(?:\.\d+)?\s*(?:°|mm|cm|kg|週|個月)|grade\s*[IV]+|[左右][前後]?肢|[左右]膝|[左右]髖|TPA)/g);
  return parts.map((p, i) => (i % 2 === 1 ? <mark key={i} className="highlight">{p}</mark> : p));
}

export function Clinic() {
  const { data, updateSession } = useStore();
  const s = data.session!;
  const c = caseById(s.caseId)!;
  const clues = cluesForCase(c.id);
  const options = useMemo(() => optionsForCase(c.id), [c.id]);
  const missing = missingRequiredClues(s);
  const required = clues.filter((x) => x.required);
  const [fb, setFb] = useState<DecisionFeedback | null>(null);

  const reveal = (clue: Clue) => {
    if (!clueAvailable(s, clue.id) || s.revealed.includes(clue.id)) return;
    sound.play('reveal');
    updateSession((x) => revealClue(x, clue.id));
  };

  const choose = (id: string) => {
    sound.play('click');
    const r = chooseOption(s, id);
    updateSession(() => r.session);
    setFb(r.feedback);
    setTimeout(() => document.getElementById('verdict')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 30);
  };

  const revealedClues = s.revealed.map((id) => clues.find((x) => x.id === id)!).filter(Boolean);
  const tried = new Set(s.decisions.map((d) => d.optionId));

  return (
    <div className="stack">
      <Stepper steps={FLOW} current={flowIndex(s)} done={(i) => i < flowIndex(s)} />
      <div className="clinic">
        <aside className="card patient-panel stack" aria-label="病患區">
          <div className="row">
            <h2 style={{ margin: 0 }}>病例 {c.id}</h2>
            <span className="tag fiction">虛構教學病例</span>
            {s.kind === 'practice' && <span className="tag">練習模式</span>}
          </div>
          <div className="art">
            <Patient species={c.species} breed={c.breed} pose={c.pose} side={c.side} />
          </div>
          <div className="vitals">
            <div className="vital"><span>物種／品種</span><b>{c.species}・{c.breed}</b></div>
            <div className="vital"><span>月齡</span><b>{c.ageMonths} 個月</b></div>
            <div className="vital"><span>體重</span><b>{c.weightKg} kg</b></div>
            <div className="vital"><span>BCS</span><b>{c.bcs9}/9</b></div>
            <div className="vital" style={{ gridColumn: 'span 2' }}><span>患側</span><b>{c.side}</b></div>
          </div>
          <p className="small"><b>全身及麻醉狀態：</b>{c.systemicStatus}</p>
          <p className="small muted">資料性質：{c.dataNature}。本病例為教學設定，不是真實臨床紀錄。</p>
          <RefChips ids={c.referenceIds} />
        </aside>

        <div className="stack">
          <section className="card" aria-label="病歷區">
            <h3>飼主主訴</h3>
            <p style={{ fontSize: '1.05rem' }}>「{c.complaint}」</p>
            <h3 style={{ marginTop: 12 }}>病歷紀錄</h3>
            {revealedClues.length === 0 ? (
              <p className="muted">尚未進行檢查。從下方檢查區開始。</p>
            ) : (
              <ul className="record" aria-live="polite">
                {revealedClues.map((clue) => (
                  <li key={clue.id} className={s.lastRevealed === clue.id ? 'new' : ''} data-testid={`record-${clue.id}`}>
                    <div className="h">
                      <span>{CAT_ICON[clue.category]} {clue.examName}</span>
                      <span className="tag">{clue.id}</span>
                      {s.lastRevealed === clue.id && <span className="tag info">新結果</span>}
                      <RefChips ids={clue.referenceIds} />
                    </div>
                    <div>{highlight(clue.result)}</div>
                    {clue.category === 'imaging' && (
                      <div style={{ marginTop: 6, maxWidth: 620 }}>
                        <XRayPanel imageId={clue.imageId} />
                      </div>
                    )}
                    <Flags flags={clue.reviewFlags} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card" aria-label="檢查區">
            <h3>檢查區</h3>
            <div className="exam-grid">
              {clues.map((clue) => {
                const done = s.revealed.includes(clue.id);
                const avail = clueAvailable(s, clue.id);
                const pre = clue.prerequisiteIds.map((p) => clues.find((x) => x.id === p)?.examName ?? p);
                return (
                  <button key={clue.id} className={`exam-btn ${done ? 'done' : ''}`} disabled={!avail || done} onClick={() => reveal(clue)} data-testid={`exam-${clue.id}`}>
                    <span className="t">{CAT_ICON[clue.category]} {clue.examName}</span>
                    <span className="s">
                      {CAT_LABEL[clue.category]}
                      {clue.required ? '・必做' : '・選做'}
                    </span>
                    <span className="s">{done ? '✓ 已完成（可在病歷重讀）' : avail ? '可進行' : `🔒 需先完成：${pre.join('、')}`}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="card" aria-label="進度區">
            <div className="row">
              <h3 style={{ margin: 0 }}>進度</h3>
              <span className="small muted">必做線索 {required.length - missing.length}/{required.length}</span>
            </div>
            <div className="progress" style={{ margin: '8px 0' }} aria-hidden>
              <i style={{ width: `${((required.length - missing.length) / required.length) * 100}%` }} />
            </div>
            {missing.length ? (
              <p className="small">尚缺：{missing.map((m) => `${m.examName}`).join('、')}</p>
            ) : (
              <p className="small" style={{ color: '#166534' }}>✓ 必做線索已齊全，可以進行臨床推理。</p>
            )}
          </section>

          <section className="card" aria-label="決策區">
            <h3>決策區：選擇處置</h3>
            <p className="small muted">選項不顯示答案類別；選擇後會給出回饋與來源。必做線索未完成前作答，會判為「條件不足」且不計分。</p>
            <div className="options">
              {options.map((o, i) => (
                <button key={o.id} className={`option-btn ${tried.has(o.id) ? 'tried' : ''}`} onClick={() => choose(o.id)} data-testid={`option-${o.id}`}>
                  <span className="letter">{String.fromCharCode(65 + i)}</span>
                  <span>{o.name}</span>
                  {tried.has(o.id) && <span className="tag" style={{ marginLeft: 'auto' }}>已選過</span>}
                </button>
              ))}
            </div>
            {fb && <Verdict fb={fb} onClose={() => setFb(null)} onProceed={() => updateSession(proceed)} />}
          </section>
        </div>
      </div>
    </div>
  );
}

const VERDICT_ICON = { preferred: '★', alternative: '✓', insufficient: '？', unsuitable: '✕', 'missing-clues': '？' } as const;

function Verdict({ fb, onClose, onProceed }: { fb: DecisionFeedback; onClose: () => void; onProceed: () => void }) {
  const o = fb.option;
  const route = o.route;
  const mod = route.kind !== 'retry' && route.procedureId ? moduleById(route.procedureId) : null;
  const label = fb.outcome === 'missing-clues' ? '條件不足（檢查未完成）' : ANSWER_LABEL[fb.outcome];
  return (
    <div id="verdict" className={`verdict ${fb.outcome}`} style={{ marginTop: 12 }} role="status" data-testid="verdict" data-outcome={fb.outcome}>
      <div className="title">
        <span aria-hidden>{VERDICT_ICON[fb.outcome]}</span>
        <span>{label}</span>
        <span className="small muted" style={{ fontWeight: 400 }}>— {o.name}</span>
      </div>
      {fb.outcome === 'missing-clues' ? (
        <div className="stack" style={{ marginTop: 8 }}>
          <p>依共通門檻：先完成本病例全部必做線索，否則為「條件不足」且不計分。這不算答錯。</p>
          <p><b>還需要：</b>{fb.missingClueNames.join('、')}</p>
          <div className="row">
            <button className="btn primary" onClick={() => (onClose(), document.querySelector('[aria-label="檢查區"]')?.scrollIntoView({ behavior: 'smooth' }))}>
              返回檢查區
            </button>
          </div>
        </div>
      ) : (
        <div className="stack" style={{ marginTop: 8 }}>
          <p><b>理由：</b>{o.feedback}</p>
          <p className="small"><b>必要條件：</b>{o.requiredConditions}</p>
          {fb.outcome === 'insufficient' && (
            <div className="banner warn">
              <span aria-hidden>？</span>
              <div>
                <b>「條件不足」不計為錯誤，也不計分。</b>還需要的資料：
                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                  {o.missingInfo.map((m) => <li key={m}>{m}</li>)}
                </ul>
              </div>
            </div>
          )}
          <p className="small">
            {fb.counted ? (
              <>本題教學評分（首次計分作答）：<b>{o.score}/10</b>・本關教學評分，不代表治療成功率。</>
            ) : o.score === null ? (
              '本選項不計分（分數為空白，不視為 0 分）。'
            ) : (
              '已記錄首次計分作答；本次為改選，不重複計分。'
            )}
          </p>
          {mod && mod.status !== 'playable' && <p className="small muted">模組狀態：{mod.statusNote}</p>}
          <Flags flags={o.reviewFlags} />
          <RefChips ids={[...o.referenceIds, o.scoreSourceId].filter(Boolean)} />
          <div className="row">
            {route.kind === 'module' && (
              <button className="btn accent" onClick={onProceed} data-testid="proceed">
                {route.procedureId === 'PROC-NONSURGICAL' ? '進入管理計畫 →' : '進入手術室 →'}
              </button>
            )}
            {route.kind === 'explain' && (
              <button className="btn accent" onClick={onProceed} data-testid="proceed">
                查看決策解說／轉介路線 →
              </button>
            )}
            <button className="btn" onClick={onClose} data-testid="reselect">
              {route.kind === 'retry' ? '改選其他處置' : '先不進行，改選'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
