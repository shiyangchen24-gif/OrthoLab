import { useEffect, useState } from 'react';
import { caseById, cases, moduleById, optionsForCase, referenceById, techniqueById } from '../data';
import { CARE_DECKS, NONSURGICAL_DECKS } from '../data/careDecks';
import { EXPLAIN_ROUTES } from '../data/routes';
import { activeProcedure, decisionScore, finishCare, finishExplain, finishModule, quizScore, stageScores, totalScore, type ModuleResult } from '../engine/session';
import { improvements as rankImprovements } from '../engine/improve';
import { guideFor } from '../engine/guide';
import { GuideBar } from '../components/GuideBar';
import { CASE_META } from '../data/caseMeta';
import { ANSWER_LABEL, type LearningRecord } from '../types';
import { Clinic, FLOW, flowIndex } from './Clinic';
import { T09Fracture } from '../modules/T09Fracture';
import { C07Clinic } from '../scenes/C07Clinic';
import { FractureSurgery } from '../scenes/FractureSurgery';
import { T01Tplo } from '../modules/T01Tplo';
import { T02Fhne } from '../modules/T02Fhne';
import { T03Mpl } from '../modules/T03Mpl';
import { CardDeckGame } from '../components/CardDeckGame';
import { CasePortrait } from '../components/CasePortrait';
import { limbsFromSide } from '../components/PatientView';
import { resolvePatientArt } from '../components/patientAssets';
import { sceneImage } from '../scenes/sceneAssets';
import { RefChips, ScoreTile, Stepper } from '../components/ui';
import { useStore } from '../store';
import { navigate } from '../router';

export function Play() {
  const { data } = useStore();
  const s = data.session;
  if (!s) {
    return (
      <div className="card stack">
        <h2>目前沒有進行中的病例</h2>
        <p>請從病例選擇開始接診。</p>
        <button className="btn primary" onClick={() => navigate('cases')}>前往病例選擇</button>
      </div>
    );
  }
  if (!caseById(s.caseId)) {
    return (
      <div className="card stack">
        <h2>找不到這個病例</h2>
        <p>存檔中的病例 {s.caseId} 不存在於本版資料。</p>
        <button className="btn primary" onClick={() => navigate('cases')}>前往病例選擇</button>
      </div>
    );
  }
  // C07 is the scene-based demo level; other cases keep the classic screens
  const scene = s.caseId === 'C07';
  switch (s.stage) {
    case 'clinic':
      return scene ? <C07Clinic /> : <Clinic />;
    case 'procedure':
      return <ProcedureStage />;
    case 'explain':
      return <ExplainStage />;
    case 'care':
      return <CareStage />;
    case 'results':
      return <Results />;
  }
}

function StageFrame({ children }: { children: React.ReactNode }) {
  const { data } = useStore();
  const s = data.session!;
  const c = caseById(s.caseId)!;
  return (
    <div className="stack">
      <Stepper steps={FLOW} current={flowIndex(s)} done={(i) => i < flowIndex(s)} />
      <GuideBar step={guideFor(s)} />
      <div className="row small muted">
        <span>
          {CASE_META[c.id]?.name ?? ''}・病例 {c.id}・{c.species}・{c.breed}・{c.side}
        </span>
        <span className="tag fiction">虛構教學病例</span>
      </div>
      {children}
    </div>
  );
}

function ProcedureStage() {
  const { data, updateSession } = useStore();
  const s = data.session!;
  const proc = activeProcedure(s);
  const done = (r: ModuleResult) => updateSession((x) => finishModule(x, r));
  let body: React.ReactNode;
  if (proc === 'PROC-ORIF-PLATE' && s.caseId === 'C07') return <FractureSurgery caseId={s.caseId} onDone={done} />;
  switch (proc) {
    case 'PROC-ORIF-PLATE':
      body = <T09Fracture caseId={s.caseId} onDone={done} />;
      break;
    case 'PROC-TPLO':
      body = <T01Tplo caseId={s.caseId} onDone={done} />;
      break;
    case 'PROC-FHNE':
      body = <T02Fhne caseId={s.caseId} onDone={done} />;
      break;
    case 'PROC-MPL-COMBO':
      body = <T03Mpl caseId={s.caseId} onDone={done} />;
      break;
    case 'PROC-NONSURGICAL': {
      const deck = NONSURGICAL_DECKS[s.caseId];
      body = deck ? (
        <CardDeckGame deck={deck} stateKey="PROC-NONSURGICAL" title={`T04 非手術管理・${deck.title}`} subtitle="管理目標 → 個別化計畫 → 追蹤與警訊｜本模組沒有手術操作分，也不因此扣分" onDone={done} />
      ) : (
        <Fallback text="本病例沒有非手術管理卡片資料。" />
      );
      break;
    }
    default:
      body = <Fallback text="此處置沒有可操作的模組。" />;
  }
  return <StageFrame>{body}</StageFrame>;
}

function Fallback({ text }: { text: string }) {
  const { updateSession } = useStore();
  return (
    <div className="card stack">
      <p>{text}</p>
      <button className="btn" onClick={() => updateSession((x) => ({ ...x, stage: 'clinic' }))}>返回診間</button>
    </div>
  );
}

function ExplainStage() {
  const { data, updateSession } = useStore();
  const s = data.session!;
  const opt = optionsForCase(s.caseId).find((o) => o.id === s.activeOptionId)!;
  const route = EXPLAIN_ROUTES[opt.id];
  const tech = techniqueById(opt.treatmentId);
  const mod = opt.route.kind === 'explain' && opt.route.procedureId ? moduleById(opt.route.procedureId) : null;
  return (
    <StageFrame>
      <section className="card stack" aria-label="決策解說路線">
        <div className="row">
          <h2 style={{ margin: 0 }}>{route?.title ?? `${opt.name}：決策解說`}</h2>
          <span className="tag info">{ANSWER_LABEL[opt.category]}</span>
          <span className="tag">無操作模組（不提供假操作畫面）</span>
        </div>
        <p>{route?.summary ?? opt.feedback}</p>
        {tech && <p className="small muted">處置技術：{tech.name}（{tech.id}）— {tech.description}</p>}
        {mod && (
          <p className="small muted">
            模組 {mod.rawIds.join('/')}「{mod.name}」狀態：{mod.statusNote}；限制：{mod.limitations}
          </p>
        )}
        <h3>後續評估／轉介路線</h3>
        <ol>{(route?.nextSteps ?? [opt.requiredConditions]).map((x) => <li key={x}>{x}</li>)}</ol>
        <p className="small muted">依據：{route?.basis.join('、') ?? opt.id}</p>
        <RefChips ids={opt.referenceIds} />
        <div className="row">
          <button className="btn accent" onClick={() => updateSession(finishExplain)} data-testid="explain-finish">
            以此路線結算
          </button>
          <button className="btn" onClick={() => updateSession((x) => ({ ...x, stage: 'clinic' }))} data-testid="explain-back">
            返回決策區改選
          </button>
        </div>
        <p className="small muted">返回改選不會改變首次計分作答；若改選優先方案，可繼續進行操作與照護。</p>
      </section>
    </StageFrame>
  );
}

/** The patient during post-op care: the bandaged painted pose when it exists for the operated limb, else the case portrait. */
function CarePatient({ caseId }: { caseId: string }) {
  const c = caseById(caseId)!;
  const limbs = limbsFromSide(c.side);
  const art = resolvePatientArt(c.species, c.breed);
  const bandaged = limbs.length === 1 ? art?.urls[`bandaged-${limbs[0]}`] : undefined;
  return (
    <figure className="care-figure">
      <span className="tag">模擬情境</span>
      {bandaged ? (
        <img src={bandaged} alt={`${c.breed}術後，${c.side}包紮（教學插畫）`} data-testid="care-bandaged" />
      ) : (
        <CasePortrait caseId={c.id} species={c.species} breed={c.breed} size={180} fallback={null} />
      )}
      <figcaption className="small muted">{CASE_META[c.id]?.name ?? c.id}・{c.side}・教學示意，不代表實際病程</figcaption>
    </figure>
  );
}

function CareStage() {
  const { data, updateSession } = useStore();
  const s = data.session!;
  const proc = activeProcedure(s);
  const deck = proc ? CARE_DECKS[proc] : undefined;
  return (
    <StageFrame>
      {deck ? (
        <CardDeckGame
          deck={deck}
          stateKey={`care:${proc}`}
          title={`術後照護與衛教・${deck.title}`}
          subtitle={`依 ${deck.carePlanId}（原始狀態：待專科審閱）`}
          onDone={(r) => updateSession((x) => finishCare(x, r))}
          intro={<CarePatient caseId={s.caseId} />}
        />
      ) : (
        <Fallback text="此術式沒有照護資料。" />
      )}
    </StageFrame>
  );
}

function Results() {
  const { data, settleSession, startCase, abandonSession } = useStore();
  const s = data.session!;
  const c = caseById(s.caseId)!;
  const [rec, setRec] = useState<LearningRecord | null>(null);
  useEffect(() => {
    setRec(settleSession());
  }, [settleSession, s.eventId]);
  const scores = rec?.scores ?? stageScores(s);
  const total = rec?.total ?? totalScore(scores);
  const proc = activeProcedure(s);
  const opts = optionsForCase(s.caseId);
  const scored = opts.find((o) => o.id === s.scoredOptionId);
  const finalOpt = opts.find((o) => o.id === s.activeOptionId);
  const deck = proc === 'PROC-NONSURGICAL' ? NONSURGICAL_DECKS[s.caseId] : proc ? CARE_DECKS[proc] : undefined;
  const first = data.first[s.caseId];
  const improvements = rankImprovements(s);
  const top = improvements.slice(0, 2);
  const rest = improvements.slice(2);
  const dec = decisionScore(s);
  const qz = quizScore(s);
  const refs = Array.from(new Set([...c.referenceIds, ...(finalOpt?.referenceIds ?? [])])).filter((id) => referenceById(id));
  const idx = cases.findIndex((x) => x.id === c.id);
  const nextCase = cases[(idx + 1) % cases.length];

  return (
    <StageFrame>
      <section className="card stack results" aria-label="學習回饋">
        <div className="results-hero">
          <div className="results-patient" aria-hidden>
            <CasePortrait caseId={c.id} species={c.species} breed={c.breed} size={200} fallback={null} />
          </div>
          <div className="results-head">
            <span className="results-sparkle" aria-hidden>✦ 🐾 ✦</span>
            <h2>病例完成</h2>
            <p>
              {c.id}｜學習回饋・{CASE_META[c.id]?.name ?? c.breed}
            </p>
            <span className={`tag ${s.kind === 'first' ? 'ok' : ''}`}>{s.kind === 'first' ? '首次作答紀錄' : '練習紀錄（不覆寫首次）'}</span>
          </div>
          {sceneImage('vet') && (
            <div className="results-vet" aria-hidden>
              <img src={sceneImage('vet')!} alt="" />
            </div>
          )}
        </div>
        <p className="small muted">以下為本關教學評分，分開呈現各階段，不代表治療成功率或臨床能力認證。</p>
        <div className="scores">
          <ScoreTile icon="🧤" label="檢查與定位" value={scores.exam} />
          <ScoreTile
            icon="💡"
            label="推理"
            value={scores.reasoning}
            note={`處置 ${dec ?? '—'}${scored ? `（${ANSWER_LABEL[scored.category]}）` : ''}・判斷題 ${qz ?? '—'}`}
          />
          <ScoreTile icon="🔧" label="操作" value={scores.operation} note={scores.operation === null ? (proc === 'PROC-NONSURGICAL' ? '非手術病例：不扣分' : '此路線無操作模組') : undefined} />
          <ScoreTile icon="💗" label="照護" value={scores.care} note={scores.care === null ? '此路線未進入照護關卡' : undefined} />
          <ScoreTile label="平均（只計有分數的階段）" value={total} />
        </div>
        {s.kind === 'practice' && first && (
          <p className="small">首次紀錄：平均 {first.total ?? '—'}（{new Date(first.completedAt).toLocaleString('zh-TW')}），練習不會覆寫。</p>
        )}
        {deck && (
          <div className="banner">
            <span aria-hidden>📅</span>
            <span>{deck.simulatedFollowUp}</span>
          </div>
        )}
        {!deck && <div className="banner"><span aria-hidden>📅</span><span>模擬情境：已安排後續評估與轉介。此為教學模擬，不代表實際病程。</span></div>}
        {top[0] && (
          <div className="results-next">
            <span aria-hidden className="results-next-icon">📋</span>
            <div>
              <span className="small muted">下次練習</span>
              <b>{top[0].text}</b>
            </div>
            <a className="btn" href="#results-refs" onClick={(e) => (e.preventDefault(), document.getElementById('results-refs')?.scrollIntoView({ behavior: 'smooth' }))}>
              📖 查看依據 ›
            </a>
          </div>
        )}
        <section data-guide="improve" aria-label="最值得改善">
          <h3>最值得改善</h3>
          {top.length ? (
            <ol data-testid="improve-top">
              {top.map((x) => (
                <li key={x.text}>
                  <span className="tag info">{x.area}</span> {x.text}
                </li>
              ))}
            </ol>
          ) : (
            <p>本次各階段首次作答都達到最佳評價。</p>
          )}
          {rest.length > 0 && (
            <details>
              <summary className="small">其他回饋（{rest.length}）</summary>
              <ul className="small">
                {rest.map((x) => (
                  <li key={x.text}>
                    {x.area}：{x.text}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
        <h3 id="results-refs">來源</h3>
        <RefChips ids={refs} />
        <div className="row results-actions" style={{ marginTop: 8 }}>
          <button className="btn lg" onClick={() => startCase(c.id)} data-testid="retry-case">
            ↻ 再練一次
          </button>
          <button className="btn primary lg" onClick={() => startCase(nextCase.id)} data-testid="next-case">
            → 下一位病患（{nextCase.id}）
          </button>
          <button className="btn ghost" onClick={() => (abandonSession(), navigate('cases'))}>
            病例選擇
          </button>
        </div>
        <p className="small muted results-note">ⓘ 教學評分不代表臨床結果</p>
      </section>
    </StageFrame>
  );
}
