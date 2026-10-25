import { cases, clues, diseases, options, references } from '../data';
import { EVIDENCE_LABEL } from '../types';
import { ReferenceDetail } from '../components/ui';

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
  return (
    <div className="stack">
      <h1>參考來源</h1>
      <div className="banner warn">
        <span aria-hidden>⚠</span>
        <span>
          保留附件中的原始來源。遊戲分數、互動規則與容差都不是文獻驗證結果；只指向出版社或學會首頁的來源標示為「章節／頁碼待確認」，尚未逐項驗證其支持的每一個數字。
        </span>
      </div>
      {groups.map((g) => (
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
