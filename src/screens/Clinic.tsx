import { useMemo, useState, type ReactNode } from 'react';
import { caseById, cluesForCase, optionsForCase, moduleById } from '../data';
import { CASE_META, LIMB_LABEL, type Limb } from '../data/caseMeta';
import {
  answerLocalization,
  answerQuiz,
  chooseOption,
  clueAvailable,
  isLocalized,
  missingRequiredClues,
  proceed,
  quizDone,
  quizQuestions,
  revealClue,
  type DecisionFeedback,
} from '../engine/session';
import { FLOW, flowIndex, guideFor } from '../engine/guide';
import { ANSWER_LABEL, type Clue, type ClueCategory } from '../types';
import { Patient } from '../components/art/Patient';
import { LimbMap } from '../components/art/LimbMap';
import { XRayPanel } from '../components/art/XRay';
import { Flags, RefChips, Stepper } from '../components/ui';
import { GuideBar } from '../components/GuideBar';
import { useStore } from '../store';
import { sound } from '../audio';

const CAT_ICON: Record<ClueCategory, string> = { history: '🐾', ortho: '🤲', imaging: '🩻', supplement: '📋' };
const CAT_LABEL: Record<ClueCategory, string> = { history: '步態／病史', ortho: '骨科檢查', imaging: '影像', supplement: '補充資訊' };

export { FLOW, flowIndex };

function highlight(text: string): ReactNode {
  // emphasise measurements, grades and side words so new findings stand out
  const parts = text.split(/(\d+(?:\.\d+)?\s*(?:°|mm|cm|kg|週|個月)|grade\s*[IV]+|[左右][前後]?肢|[左右]膝|[左右]髖|TPA)/g);
  return parts.map((p, i) => (i % 2 === 1 ? <mark key={i} className="highlight">{p}</mark> : p));
}

export function Clinic() {
  const { data, updateSession } = useStore();
  const s = data.session!;
  const c = caseById(s.caseId)!;
  const meta = CASE_META[c.id];
  const clues = cluesForCase(c.id);
  const options = useMemo(() => optionsForCase(c.id), [c.id]);
  const missing = missingRequiredClues(s);
  const required = clues.filter((x) => x.required);
  const [fb, setFb] = useState<DecisionFeedback | null>(null);
  const localized = isLocalized(s);
  const quizComplete = quizDone(s);
  const decisionsOpen = localized && missing.length === 0 && quizComplete;

  const reveal = (clue: Clue) => {
    if (!clueAvailable(s, clue.id) || s.revealed.includes(clue.id)) return;
    sound.play('reveal');
    updateSession((x) => revealClue(x, clue.id));
  };

  const choose = (id: string) => {
    if (!decisionsOpen) return;
    sound.play('click');
    const r = chooseOption(s, id);
    updateSession(() => r.session);
    setFb(r.feedback);
    setTimeout(() => document.getElementById('verdict')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 30);
  };

  const revealedClues = s.revealed.map((id) => clues.find((x) => x.id === id)!).filter(Boolean);
  const tried = new Set(s.decisions.map((d) => d.optionId));
  const fi = flowIndex(s);

  return (
    <div className="stack">
      <Stepper steps={FLOW} current={fi} done={(i) => i < fi} />
      <GuideBar step={guideFor(s, !!fb && fb.outcome !== 'missing-clues' && fb.option.route.kind !== 'retry')} />
      <div className="clinic">
        <aside className="card patient-panel stack" aria-label="病患區">
          <div className="row">
            <h2 style={{ margin: 0 }} data-testid="patient-name">
              {meta?.name ?? c.id}
            </h2>
            <span className="small muted">病例 {c.id}</span>
            <span className="tag fiction">虛構教學病例</span>
            {s.kind === 'practice' && <span className="tag">練習模式</span>}
          </div>
          <div className="art">
            <Patient species={c.species} breed={c.breed} pose={c.pose} side={c.side} />
          </div>
          <p style={{ margin: 0 }}>
            <span className="small muted">飼主主訴：</span>「{c.complaint}」
          </p>
          <div className="vitals">
            <div className="vital"><span>物種／品種</span><b>{c.species}・{c.breed}</b></div>
            <div className="vital"><span>年齡</span><b>{c.ageMonths} 個月</b></div>
            <div className="vital"><span>體重</span><b>{c.weightKg} kg</b></div>
            <div className="vital"><span>BCS</span><b>{c.bcs9}/9</b></div>
            <div className="vital" style={{ gridColumn: 'span 2' }}>
              <span>患側</span>
              <b data-testid="vital-side">{localized ? c.side : '待定位'}</b>
            </div>
          </div>
          <details className="small">
            <summary>全身狀態與資料性質</summary>
            <p><b>全身及麻醉狀態：</b>{c.systemicStatus}</p>
            <p className="muted">資料性質：{c.dataNature}。病患名字為遊戲設定；本病例是教學設定，不是真實臨床紀錄。</p>
            <RefChips ids={c.referenceIds} />
          </details>
        </aside>

        <div className="stack">
          <LimbStep />

          <section className="card" aria-label="檢查區">
            <h3>檢查與影像</h3>
            {!localized && (
              <div className="locked-note" data-testid="exam-locked">
                <span aria-hidden>🔒</span> 先完成患肢定位，才能開始檢查。
              </div>
            )}
            <div className="exam-grid" style={{ marginTop: localized ? 0 : 8 }}>
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
                    <span className="s">
                      {done ? '✓ 已完成（可在病歷重讀）' : avail ? '可進行' : !localized ? '🔒 需先定位患肢' : `🔒 需先完成：${pre.join('、')}`}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="row small" style={{ marginTop: 8 }}>
              <span>必做檢查 {required.length - missing.length}/{required.length}</span>
              <div className="progress" style={{ flex: 1, minWidth: 120 }} aria-hidden>
                <i style={{ width: `${((required.length - missing.length) / required.length) * 100}%` }} />
              </div>
            </div>
            {revealedClues.length > 0 && (
              <>
                <h3 style={{ marginTop: 12 }}>病歷紀錄</h3>
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
                        <div style={{ marginTop: 6, maxWidth: 720 }}>
                          <XRayPanel imageId={clue.imageId} />
                        </div>
                      )}
                      <Flags flags={clue.reviewFlags} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {localized && missing.length === 0 && <ReasoningQuiz />}

          <section className="card" aria-label="決策區" data-guide="options">
            <h3>處置選擇</h3>
            {!decisionsOpen ? (
              <div className="locked-note" data-testid="options-locked">
                <span aria-hidden>🔒</span>
                <span>
                  {!localized ? '先定位患肢。' : missing.length ? `先完成必做檢查（尚缺：${missing.map((m) => m.examName).join('、')}）。` : '先完成上方的推理判斷題。'}
                  完成後才能選擇處置。
                </span>
              </div>
            ) : (
              <p className="small muted">選項不顯示答案類別；選擇後會給出回饋、理由與來源。</p>
            )}
            <div className="options">
              {options.map((o, i) => (
                <button key={o.id} className={`option-btn ${tried.has(o.id) ? 'tried' : ''}`} onClick={() => choose(o.id)} disabled={!decisionsOpen} data-testid={`option-${o.id}`}>
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

function LimbStep() {
  const { data, updateSession } = useStore();
  const s = data.session!;
  const c = caseById(s.caseId)!;
  const meta = CASE_META[c.id];
  const [picks, setPicks] = useState<Limb[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const done = isLocalized(s);
  if (!meta) return null;
  const toggle = (l: Limb) => {
    if (done) return;
    setMsg(null);
    setPicks((p) => (p.includes(l) ? p.filter((x) => x !== l) : [...p, l]));
  };
  const confirm = () => {
    const r = answerLocalization(s, picks);
    updateSession(() => r.session);
    sound.play(r.correct ? 'success' : 'warn');
    setMsg(
      r.correct
        ? { ok: true, text: `正確：${meta.limbs.map((l) => LIMB_LABEL[l]).join('、')}（依病例資料患側「${c.side}」）。檢查區已解鎖。` }
        : {
            ok: false,
            text:
              picks.length === 0
                ? '請先點選至少一個肢體。'
                : `「${picks.map((l) => LIMB_LABEL[l]).join('、')}」不是本病例的患肢。重讀主訴並觀察病患的姿勢，再試一次。注意：俯視圖的左右就是病患的左右。`,
          },
    );
  };
  if (done) {
    return (
      <section className="card" aria-label="患肢定位">
        <div className="row">
          <span className="tag ok">✓ 患肢定位完成</span>
          <b>{meta.limbs.map((l) => LIMB_LABEL[l]).join('、')}</b>
          {s.localization?.firstCorrect === false && <span className="small muted">（首次作答未答對，已記錄）</span>}
        </div>
      </section>
    );
  }
  return (
    <section className="card" aria-label="患肢定位">
      <h3>患肢定位</h3>
      <p className="small muted">
        俯視圖中頭朝上，<b>病患左側＝畫面左側</b>（左方的病患側視圖則依患側翻面，不能直接用畫面左右判斷）。雙側問題可複選。
      </p>
      <div className="grid cols-2" style={{ alignItems: 'center' }}>
        <LimbMap species={c.species} selected={picks} confirmed={[]} onToggle={toggle} />
        <div className="stack">
          <div className="row" role="group" aria-label="文字選項">
            {(['LF', 'RF', 'LH', 'RH'] as Limb[]).map((l) => (
              <button key={l} className="btn sm" aria-pressed={picks.includes(l)} onClick={() => toggle(l)} data-testid={`limb-btn-${l}`}>
                {LIMB_LABEL[l]}
              </button>
            ))}
          </div>
          <button className="btn primary" onClick={confirm} disabled={picks.length === 0} data-guide="limb-confirm" data-testid="limb-confirm">
            確認患肢
          </button>
          {msg && (
            <div className={`banner ${msg.ok ? 'ok' : 'warn'}`} role="status" data-testid="limb-feedback">
              <span aria-hidden>{msg.ok ? '✓' : '△'}</span>
              <span>{msg.text}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ReasoningQuiz() {
  const { data, updateSession } = useStore();
  const s = data.session!;
  const qs = quizQuestions(s);
  if (!qs.length) return null;
  const done = quizDone(s);
  return (
    <section className="card" aria-label="推理判斷" data-testid="quiz">
      <div className="row">
        <h3 style={{ margin: 0 }}>推理判斷</h3>
        <span className="small muted">只根據本病例已提供的資料作答；首次作答計入推理表現。</span>
        {done && <span className="tag ok">✓ 完成</span>}
      </div>
      {qs.map((q) => {
        const ans = s.quiz?.answers[q.id];
        const chosen = q.options.find((o) => o.id === ans);
        const solved = !!chosen?.correct;
        return (
          <div key={q.id} className="quiz-q" data-guide={`quiz-${q.id}`}>
            <b>{q.prompt}</b>
            <div className="quiz-opts" role="group" aria-label={q.prompt}>
              {q.options.map((o) => {
                const on = ans === o.id;
                return (
                  <button
                    key={o.id}
                    className={`quiz-opt ${on ? (o.correct ? 'right' : 'wrong') : ''}`}
                    aria-pressed={on}
                    disabled={solved && !on}
                    onClick={() => {
                      if (solved) return;
                      const r = answerQuiz(s, q.id, o.id);
                      updateSession(() => r.session);
                      sound.play(r.correct ? 'success' : 'warn');
                    }}
                    data-testid={`quiz-${q.id}-${o.id}`}
                    data-correct={o.correct ? 'y' : 'n'}
                  >
                    {on && (o.correct ? '✓ ' : '✕ ')}
                    {o.text}
                  </button>
                );
              })}
            </div>
            {chosen && (
              <p className="small" style={{ marginTop: 6 }} role="status">
                {chosen.correct ? '✓ ' : '△ 再想想：'}
                {chosen.why}
                <span className="muted">（依據：{q.basis.join('、')}）</span>
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}

const VERDICT_ICON = { preferred: '★', alternative: '✓', insufficient: '？', unsuitable: '✕', 'missing-clues': '？' } as const;

function Verdict({ fb, onClose, onProceed }: { fb: DecisionFeedback; onClose: () => void; onProceed: () => void }) {
  const o = fb.option;
  const route = o.route;
  const mod = route.kind !== 'retry' && route.procedureId ? moduleById(route.procedureId) : null;
  const label = fb.outcome === 'missing-clues' ? '條件不足（前置步驟未完成）' : ANSWER_LABEL[fb.outcome];
  return (
    <div id="verdict" className={`verdict ${fb.outcome}`} style={{ marginTop: 12 }} role="status" data-testid="verdict" data-outcome={fb.outcome}>
      <div className="title">
        <span aria-hidden>{VERDICT_ICON[fb.outcome]}</span>
        <span>{label}</span>
        <span className="small muted" style={{ fontWeight: 400 }}>— {o.name}</span>
      </div>
      {fb.outcome === 'missing-clues' ? (
        <div className="stack" style={{ marginTop: 8 }}>
          <p>依共通門檻：先完成本病例全部必做線索與判斷，否則為「條件不足」且不計分。這不算答錯。</p>
          <p><b>還需要：</b>{fb.missingClueNames.join('、')}</p>
        </div>
      ) : (
        <div className="stack" style={{ marginTop: 8 }}>
          {fb.outcome === 'alternative' && <p className="small"><b>這是合理的替代方案，不是醫療錯誤。</b>本病例另有更優先的選擇。</p>}
          <p><b>理由：</b>{o.feedback}</p>
          <p className="small"><b>必要條件：</b>{o.requiredConditions}</p>
          {fb.outcome === 'insufficient' && (
            <div className="banner warn">
              <span aria-hidden>？</span>
              <div>
                <b>「條件不足」不計為錯誤，也不計分（不是 0 分）。</b>還需要的資料：
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
