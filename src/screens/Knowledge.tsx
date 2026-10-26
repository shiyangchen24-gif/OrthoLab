import { useState } from 'react';
import { illust } from '../components/illustrations';
import { assets, carePlans, diseases, modules, options, rawTolerances, steps, techniques, artStyles } from '../data';
import { CONFLICT_LOG, TOLERANCES } from '../config/tolerances';
import { Flags, RefChips } from '../components/ui';
import type { ModuleStatus, ToleranceConfig } from '../types';

const STATUS_LABEL: Record<ModuleStatus, { text: string; cls: string }> = {
  playable: { text: '可操作', cls: 'ok' },
  'decision-only': { text: '僅決策解說', cls: 'review' },
  component: { text: 'T03 元件', cls: 'info' },
  'not-implemented': { text: '未實作（只顯示模擬監測）', cls: 'no' },
};

const fmtBand = (cfg: ToleranceConfig) =>
  cfg.bands
    .map((b) => {
      const lo = Number.isFinite(b.min) ? `${b.min}${b.minInclusive ? '≤' : '<'}` : '';
      const hi = Number.isFinite(b.max) ? `${b.maxInclusive ? '≤' : '<'}${b.max}` : '';
      const label = { perfect: '完美', pass: '及格', adjust: '需調整', fail: '未達標' }[b.level];
      return `${label}：${lo}x${hi}`;
    })
    .join('；');

type KbSection = 'disease' | 'procedure' | 'care' | 'data';
const SECTIONS: { id: KbSection; label: string; icon: string }[] = [
  { id: 'disease', label: '疾病', icon: '🐾' },
  { id: 'procedure', label: '術式', icon: '🩺' },
  { id: 'care', label: '照護', icon: '💙' },
  { id: 'data', label: '資料與容差', icon: '📊' },
];
type DetailTab = 'signs' | 'exam' | 'treat';

export function Knowledge() {
  const [section, setSection] = useState<KbSection>('disease');
  const [picked, setPicked] = useState(diseases.find((d) => d.id === 'D09')?.id ?? diseases[0].id);
  const [tab, setTab] = useState<DetailTab>('signs');
  const d = diseases.find((x) => x.id === picked)!;
  const pick = (id: string) => {
    setPicked(id);
    setTab('signs');
    // on narrow screens the detail sits below the grid
    window.requestAnimationFrame(() => document.getElementById('kb-detail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  };
  return (
    <div className="kb-page">
      <header className="kb-head">
        <h1>知識庫</h1>
        <p className="muted">整理自附件資料（10 張工作表）。標示「待審閱」的內容尚未找到直接支持，僅供教學討論。</p>
      </header>
      <nav className="kb-nav" role="tablist" aria-label="知識庫分類">
        {SECTIONS.map((x) => (
          <button key={x.id} role="tab" aria-selected={section === x.id} className={section === x.id ? 'on' : ''} onClick={() => setSection(x.id)} data-testid={`kb-tab-${x.id}`}>
            <span aria-hidden>{x.icon}</span> {x.label}
          </button>
        ))}
      </nav>
      <div className="kb-body" role="tabpanel">
        {section === 'disease' && (
          <div className="kb-diseases">
            <div className="kb-grid">
              {diseases.map((x) => (
                <button key={x.id} className={`kb-card ${picked === x.id ? 'on' : ''}`} aria-pressed={picked === x.id} onClick={() => pick(x.id)} data-testid={`kb-card-${x.id}`}>
                  {illust(`kb/${x.id}`) ? <img src={illust(`kb/${x.id}`)!} alt="" aria-hidden loading="lazy" /> : <span className="kb-card-blank" aria-hidden>🦴</span>}
                  <span className="kb-card-name">
                    <b>{x.name}</b>
                    <span className="small muted">{x.id}・{x.hasPlayableCase ? '有可玩病例' : '本版無可玩病例'}</span>
                  </span>
                </button>
              ))}
            </div>
            <article id="kb-detail" className="kb-detail" aria-live="polite" data-testid="kb-detail">
              <div className="kb-detail-head">
                <span className="kb-detail-icon" aria-hidden>🦴</span>
                <div>
                  <h2>{d.name}</h2>
                  <p className="small muted">{d.id}・{d.species}／{d.region}・來源標示：{d.versionScope}</p>
                </div>
              </div>
              <div className="kb-tabs" role="tablist" aria-label="疾病內容">
                {([
                  ['signs', '症狀'],
                  ['exam', '檢查'],
                  ['treat', '處置'],
                ] as const).map(([id, label]) => (
                  <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)} data-testid={`kb-detail-${id}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="kb-detail-body">
                {illust(`kb/${d.id}`) && (
                  <figure>
                    <img src={illust(`kb/${d.id}`)!} alt={`${d.name}教學插圖`} />
                    <figcaption className="small muted">教學示意插圖（ChatGPT 生成），解剖細節待獸醫審閱。</figcaption>
                  </figure>
                )}
                <dl className="small">
                  {tab === 'signs' && (
                    <>
                      <dt>常見表現</dt><dd>{d.presentation}</dd>
                    </>
                  )}
                  {tab === 'exam' && (
                    <>
                      <dt>診斷流程</dt><dd>{d.diagnosticFlow}</dd>
                      <dt>鑑別診斷</dt><dd>{d.differentials}</dd>
                    </>
                  )}
                  {tab === 'treat' && (
                    <>
                      <dt>處置方向</dt><dd>{d.treatmentDirection}</dd>
                      <dt>選術條件</dt><dd>{d.selectionCriteria}</dd>
                      <dt>限制與修正</dt><dd>{d.limitations}</dd>
                    </>
                  )}
                </dl>
              </div>
              <Flags flags={d.reviewFlags} />
              {!d.hasPlayableCase && <p className="small muted">本版沒有此疾病的病例、檢查線索與操作資料；僅提供決策知識，後續需補充病例與專科審閱。</p>}
              <div className="row">
                <span className="small">延伸閱讀</span>
                <RefChips ids={d.referenceIds} />
              </div>
            </article>
          </div>
        )}
        {section === 'procedure' && (
          <div className="stack">
      <h2>處置技術、模組與 ID 對照</h2>
      <p className="small muted">原始資料的 T05、T06 同時代表不同處置。本版以唯一的處置技術 ID 與模組 ID 區分，原始 ID 保留於對照欄。</p>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>處置技術 ID</th><th>名稱</th><th>模組</th><th>原始處置ID（選項）</th></tr>
          </thead>
          <tbody>
            {techniques.map((t) => {
              const raws = Array.from(new Set(options.filter((o) => o.treatmentId === t.id).map((o) => `${o.rawProcedureId}（${o.id}）`)));
              return (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td>{t.name}<div className="small muted">{t.description}</div></td>
                  <td>{t.procedureId ?? '—（無模組）'}</td>
                  <td className="small">{raws.join('、') || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>術式模組</h2>
      {modules.map((m) => (
        <details key={m.procedureId} className="kb">
          <summary>
            {m.rawIds[0]} {m.name} <span className={`tag ${STATUS_LABEL[m.status].cls}`}>{STATUS_LABEL[m.status].text}</span> <span className="tag">{m.procedureId}</span>
          </summary>
          <p className="small">{m.statusNote}</p>
          <p className="small">流程：{m.flow}｜完成條件（原始）：{m.completion}｜限制：{m.limitations}</p>
          {steps.filter((s) => s.procedureId === m.procedureId).length > 0 && (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>步驟</th><th>操作</th><th>成功條件</th><th>待補限制</th></tr></thead>
                <tbody>
                  {steps
                    .filter((s) => s.procedureId === m.procedureId)
                    .map((s) => (
                      <tr key={s.id}>
                        <td>{s.id}</td>
                        <td>{s.action}<div className="small muted">{s.interaction}</div></td>
                        <td>{s.successCriteria}{!s.numericScoringAllowed && <div><span className="tag review">原始資料禁止數值判分</span></div>}</td>
                        <td className="small">{s.pendingLimits}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
          <RefChips ids={m.referenceIds} />
        </details>
      ))}

          </div>
        )}
        {section === 'care' && (
          <div className="stack">
      <h2>術後與照護資源</h2>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>ID</th><th>對應</th><th>階段</th><th>活動</th><th>追蹤</th><th>警訊</th><th>狀態</th></tr></thead>
          <tbody>
            {carePlans.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td><td>{p.targetRawId}</td><td>{p.stage}</td><td>{p.activity}</td><td>{p.followUp}</td><td>{p.warnings}</td>
                <td><span className="tag review">{p.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

          </div>
        )}
        {section === 'data' && (
          <div className="stack">
      <h2>T09 容差設定（遊戲幾何門檻，非臨床標準）</h2>
      <p className="small">唯一設定檔：<code>src/config/tolerances.ts</code>。角度、位移、螺釘數與距離都不能直接推論必然骨不癒合或其他併發症。</p>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>項目</th><th>來源參數</th><th>完整區間（遊戲）</th><th>原始表格文字</th><th>說明</th></tr></thead>
          <tbody>
            {Object.values(TOLERANCES).map((t) => {
              const raw = rawTolerances.find((r) => r.id === t.sourceParamId);
              return (
                <tr key={t.id}>
                  <td>{t.label}（{t.unit}）</td>
                  <td>{t.sourceParamId}</td>
                  <td className="small">{fmtBand(t)}</td>
                  <td className="small muted">{raw ? `Pass ${raw.rawPass}／Perfect ${raw.rawPerfect}／Fail ${raw.rawFail || '—'}` : '—'}</td>
                  <td className="small">{t.note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <details className="kb">
        <summary>衝突與補齊紀錄</summary>
        <ul className="small">{CONFLICT_LOG.map((x) => <li key={x}>{x}</li>)}</ul>
      </details>

      <h2>素材狀態</h2>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>ID</th><th>用途</th><th>原始狀態</th><th>本版呈現</th></tr></thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id}>
                <td>{a.id}</td><td>{a.usage}・{a.content}</td><td>{a.status}（{a.license}）</td>
                <td className="small">{a.renderedInApp ? '本專案原創向量教學示意（非真實影像、非 DICOM）' : '文字先行'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>美術風格規範（摘要）</h2>
      <ul className="small">
        {artStyles.map((a) => (
          <li key={a.id}>{a.id} {a.scene}：{a.style}｜背景 {a.background}｜重點 {a.accent}</li>
        ))}
      </ul>
          </div>
        )}
      </div>
    </div>
  );
}
