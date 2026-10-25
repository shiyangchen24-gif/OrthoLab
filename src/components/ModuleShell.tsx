import { useState, type ReactNode } from 'react';
import { Modal, SimMonitor, Stepper } from './ui';
import { useStore } from '../store';

export interface ShellProps {
  title: string;
  subtitle?: string;
  steps: string[];
  current: number;
  done: (i: number) => boolean;
  hint: ReactNode;
  onUndo: () => void;
  onReset: () => void;
  canUndo: boolean;
  onHint: () => void;
  theme?: 'surgery' | 'clinic';
  children: ReactNode;
  extraTools?: ReactNode;
  note?: ReactNode;
}

export function ModuleShell(p: ShellProps) {
  const { data } = useStore();
  const [hintOpen, setHintOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const surgery = (p.theme ?? 'surgery') === 'surgery';
  return (
    <section className={surgery ? 'surgery' : 'card'} aria-label={p.title}>
      <div className="row" style={{ marginBottom: 8 }}>
        <div>
          <h2 style={{ marginBottom: 2 }}>{p.title}</h2>
          {p.subtitle && <div className="small muted">{p.subtitle}</div>}
        </div>
        <span className="spacer" />
        {surgery && data.session && <SimMonitor startedAt={data.session.startedAt} />}
      </div>
      <Stepper steps={p.steps} current={p.current} done={p.done} />
      <div className="toolbar" role="toolbar" aria-label="操作工具">
        <button className="btn sm" onClick={p.onUndo} disabled={!p.canUndo}>
          ↶ 撤銷
        </button>
        <button className="btn sm" onClick={() => setConfirmReset(true)}>
          ⟲ 重設本模組
        </button>
        <button
          className="btn sm"
          onClick={() => {
            p.onHint();
            setHintOpen(true);
          }}
        >
          💡 提示
        </button>
        {p.extraTools}
      </div>
      {p.note && <div style={{ marginBottom: 8 }}>{p.note}</div>}
      {p.children}
      {hintOpen && (
        <Modal title="提示" onClose={() => setHintOpen(false)}>
          <div>{p.hint}</div>
          <p className="small muted">提示使用次數會記錄在結算中，不會扣分。</p>
        </Modal>
      )}
      {confirmReset && (
        <Modal
          title="重設本模組？"
          onClose={() => setConfirmReset(false)}
          actions={
            <>
              <button className="btn" onClick={() => setConfirmReset(false)}>
                取消
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  p.onReset();
                  setConfirmReset(false);
                }}
              >
                確定重設
              </button>
            </>
          }
        >
          <p>操作會回到本模組起點。首次作答紀錄會保留，不會因重設而改變。</p>
        </Modal>
      )}
    </section>
  );
}

export function CheckResult({ ok, items, okText }: { ok: boolean | null; items: string[]; okText: string }) {
  if (ok === null) return null;
  return ok ? (
    <div className="banner ok" role="status">
      <span aria-hidden>✓</span> <span>{okText}</span>
    </div>
  ) : (
    <div className="banner err" role="alert">
      <span aria-hidden>✕</span>
      <div>
        <b>尚未達到完成門檻：</b>
        <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
          {items.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
