import { cases, clues, diseases, options, references } from '../data';
import { EVIDENCE_LABEL } from '../types';
import { ReferenceDetail } from '../components/ui';
import { illust } from '../components/illustrations';
import { useState } from 'react';

export function References() {
  const usedBy = (id: string) => {
    const out = new Set<string>();
    for (const c of cases) if (c.referenceIds.includes(id)) out.add(c.id);
    for (const o of options) if (o.referenceIds.includes(id) || o.scoreSourceId === id) out.add(o.id);
    for (const d of diseases) if (d.referenceIds.includes(id)) out.add(d.id);
    for (const c of clues) if (c.referenceIds.includes(id)) out.add(c.id);
    return Array.from(out);
  };
  const groups = Array.from(new Set(references.map((r) => r.evidenceClass)));
  const [filter, setFilter] = useState<string>('all');
  const shown = filter === 'all' ? groups : groups.filter((g) => g === filter);
  const library = illust('scene/library-room');
  return (
    <div className="stack">
      <header className={library ? 'refs-hero' : undefined} style={library ? { backgroundImage: `url(${library})` } : undefined}>
        <div className="refs-hero-panel">
          <h1>📖 參考來源</h1>
          <span className="tag info">ⓘ 遊戲評分不代表臨床結果</span>
        </div>
      </header>
      <div className="banner warn">
        <span aria-hidden>⚠</span>
        <span>
          保留附件中的原始來源。遊戲分數、互動規則與容差都不是文獻驗證結果；只指向出版社或學會首頁的來源標示為「章節／頁碼待確認」，尚未逐項驗證其支持的每一個數字。
        </span>
      </div>
      <div className="refs-filter" role="group" aria-label="依證據類型篩選">
        <button aria-pressed={filter === 'all'} onClick={() => setFilter('all')} data-testid="refs-filter-all">
          全部
        </button>
        {groups.map((g) => (
          <button key={g} aria-pressed={filter === g} onClick={() => setFilter(g)}>
            {EVIDENCE_LABEL[g]}
          </button>
        ))}
      </div>
      {shown.map((g) => (
        <section key={g} className="stack">
          <h2>{EVIDENCE_LABEL[g]}</h2>
          {references
            .filter((r) => r.evidenceClass === g)
            .map((r) => (
              <article key={r.id} className="card" id={`ref-${r.id}`} data-testid={`ref-${r.id}`}>
                <ReferenceDetail id={r.id} />
                <p className="small muted" style={{ marginTop: 6 }}>被引用於：{usedBy(r.id).join('、') || '—'}</p>
              </article>
            ))}
        </section>
      ))}
    </div>
  );
}
