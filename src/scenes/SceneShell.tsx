import { useEffect, useState, type ReactNode } from 'react';
import { navigate } from '../router';

export const SCENE_FLOW = ['接診', '檢查', '影像', '推理與處置', '手術', '照護', '結算'];

/** Portrait phones get a re-composed (cropped) stage, not a shrunken desktop. */
export function usePortrait() {
  const q = '(max-aspect-ratio: 4/5), (max-width: 700px)';
  const [p, setP] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : false));
  useEffect(() => {
    const mq = window.matchMedia?.(q);
    if (!mq) return;
    const on = () => setP(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return p;
}

export function SceneShell({
  stageIndex,
  patient,
  hint,
  tray,
  toolInfo,
  drawer,
  actions,
  dark = false,
  children,
}: {
  stageIndex: number;
  patient: ReactNode;
  hint: ReactNode;
  tray: ReactNode;
  toolInfo?: ReactNode;
  drawer: ReactNode;
  actions?: ReactNode;
  dark?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`game ${dark ? 'game-dark' : ''}`} data-testid="scene">
      <header className="game-top">
        <ol className="game-steps" aria-label="階段進度">
          {SCENE_FLOW.map((s, i) => (
            <li key={s} className={i < stageIndex ? 'done' : i === stageIndex ? 'now' : ''} aria-current={i === stageIndex ? 'step' : undefined}>
              <span aria-hidden>{i < stageIndex ? '✓' : i + 1}</span>
              <span className="lbl">{s}</span>
            </li>
          ))}
        </ol>
        <div className="game-patient">{patient}</div>
        <div className="game-top-actions">
          {actions}
          <button className="btn sm" onClick={() => setOpen((v) => !v)} aria-expanded={open} data-testid="info-toggle">
            📋 病歷與資料
          </button>
          <button className="btn sm ghost" onClick={() => navigate('settings')} aria-label="設定">
            ⚙
          </button>
        </div>
      </header>
      <div className="game-main">
        <div className="game-stage">
          {children}
          <div className="game-hint">{hint}</div>
        </div>
        {open && (
          <aside className="game-drawer" aria-label="病歷與資料面板" data-testid="info-drawer">
            <button className="btn sm drawer-close" onClick={() => setOpen(false)}>
              關閉 ✕
            </button>
            {drawer}
          </aside>
        )}
      </div>
      <footer className="game-bottom">
        {toolInfo}
        {tray}
      </footer>
    </div>
  );
}
