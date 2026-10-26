import { useEffect, useRef, useState, type ReactNode } from 'react';
import { referenceById } from '../data';
import { EVIDENCE_LABEL, type ReviewFlag, type ToleranceLevel } from '../types';
import { LEVEL_LABEL } from '../config/tolerances';

export function Modal({ title, onClose, children, actions }: { title: string; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button, a')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <div className="stack">{children}</div>
        <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          {actions ?? (
            <button className="btn primary" onClick={onClose}>
              關閉
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ReferenceDetail({ id }: { id: string }) {
  const r = referenceById(id);
  if (!r) return <p className="muted">來源 {id} 不在參考資料表中。</p>;
  return (
    <div className="stack">
      <div className="row">
        <span className="tag info">{r.id}</span>
        <span className="tag">{EVIDENCE_LABEL[r.evidenceClass]}</span>
        <span className="tag">適用：{r.species}</span>
        {r.locatorStatus === 'landing-page' && <span className="tag review">章節／頁碼待確認</span>}
      </div>
      <p style={{ fontWeight: 600 }}>{r.title}</p>
      <p className="small">支持用途：{r.supports}</p>
      <p className="small muted">證據限制：{r.limitation}</p>
      {r.locatorNote && <p className="small muted">註：{r.locatorNote}</p>}
      {r.url ? (
        <p className="small">
          網址：
          <a href={r.url} target="_blank" rel="noreferrer noopener">
            {r.url}
          </a>
        </p>
      ) : (
        <p className="small muted">無公開網址。</p>
      )}
      {r.checkedDate && <p className="small muted">原始資料查核日期：{r.checkedDate}</p>}
    </div>
  );
}

/** Clickable source chips: open the reference detail directly from feedback. */
export function RefChips({ ids, label = '來源' }: { ids: string[]; label?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!ids.length) return null;
  return (
    <span className="row" style={{ gap: 4, display: 'inline-flex' }}>
      <span className="small muted">{label}：</span>
      {ids.map((id) => (
        <button key={id} className="tag info" style={{ cursor: 'pointer' }} onClick={() => setOpen(id)} aria-label={`查看來源 ${id}`}>
          📚 {id}
        </button>
      ))}
      {open && (
        <Modal title={`參考來源 ${open}`} onClose={() => setOpen(null)}>
          <ReferenceDetail id={open} />
        </Modal>
      )}
    </span>
  );
}

export function Flags({ flags }: { flags: ReviewFlag[] }) {
  if (!flags.length) return null;
  return (
    <ul className="small" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
      {flags.map((f) => (
        <li key={f.code + f.message}>
          <span className="tag review">待審閱</span> {f.message}
        </li>
      ))}
    </ul>
  );
}

const LEVEL_ICON: Record<ToleranceLevel, string> = { perfect: '★', pass: '✓', adjust: '△', fail: '✕' };

export function Level({ level }: { level: ToleranceLevel }) {
  return (
    <span className={`lvl ${level}`}>
      <span aria-hidden>{LEVEL_ICON[level]}</span>
      {LEVEL_LABEL[level]}
    </span>
  );
}

export function Stepper({ steps, current, done }: { steps: string[]; current: number; done: (i: number) => boolean }) {
  return (
    <ol className="stepper" aria-label="流程進度">
      {steps.map((s, i) => {
        const isDone = done(i);
        const cls = isDone ? 'done' : i === current ? 'current' : '';
        return (
          <li key={s} className={cls} aria-current={i === current ? 'step' : undefined}>
            <span aria-hidden>{isDone ? '✓' : i + 1}</span> {s}
            {isDone && <span className="sr-only">（已完成）</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** A stage score; with `icon`, also a status chip (teaching score ≥ 80 = completed, else worth practising). */
export function ScoreTile({ label, value, note, icon }: { label: string; value: number | null; note?: string; icon?: string }) {
  const status = value === null ? null : value >= 80 ? 'done' : 'again';
  return (
    <div className={`score-tile ${value === null ? 'na' : ''} ${icon ? 'with-icon' : ''}`}>
      {icon && <span className="score-icon" aria-hidden>{icon}</span>}
      <span className="small muted">{label}</span>
      <b>{value === null ? '不適用' : value}</b>
      {icon && status && <span className={`score-chip ${status}`}>{status === 'done' ? '✓ 已完成' : '↻ 可再練習'}</span>}
      {note && <span className="small muted">{note}</span>}
    </div>
  );
}

export function useElapsed(startIso: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const sec = Math.max(0, Math.round((now - Date.parse(startIso)) / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/** Simulated monitor: static, no random events (no anesthesia event data supplied). */
export function SimMonitor({ startedAt }: { startedAt: string }) {
  const t = useElapsed(startedAt);
  return (
    <div className="monitor" role="status">
      <span className="dot" aria-hidden />
      <span>模擬監測：穩定（教學示意，不產生隨機麻醉事件）</span>
      <span>・計時 {t}（僅供參考，不影響結果）</span>
    </div>
  );
}
