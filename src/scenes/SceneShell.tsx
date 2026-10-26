import { useEffect, useState, type ReactNode } from 'react';
import { navigate } from '../router';
import { useStore } from '../store';
import { MainNav, NavIcon } from '../components/nav';

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
  const { data } = useStore();
  const caseId = data.session?.caseId;
  const recordButton = (
    <button className={`btn sm game-record ${dark ? 'in-bar' : ''}`} onClick={() => setOpen((v) => !v)} aria-expanded={open} data-testid="info-toggle">
      <NavIcon route="refs" size={18} /> 病歷
    </button>
  );
  return (
    <div className={`game ${dark ? 'game-dark' : ''}`} data-testid="scene">
      {/* one slim bar replaces the site header in a scene: brand · case · stage dots · navigation */}
      <header className="game-top">
        <button className="brand game-brand" onClick={() => navigate('home')} aria-label="OrthoLab 首頁">
          <img src="./favicon.svg" width="26" height="26" alt="" />
          <span>
            Ortho<b>Lab</b>
          </span>
        </button>
        {caseId && <span className="game-case" data-testid="game-case">{caseId}</span>}
        <ol className="game-dots" aria-label="階段進度">
          {SCENE_FLOW.map((s, i) => (
            <li key={s} className={i < stageIndex ? 'done' : i === stageIndex ? 'now' : ''} aria-current={i === stageIndex ? 'step' : undefined} title={s}>
              <span className="dot">{i < stageIndex ? '✓' : i + 1}</span>
              <span className="sr-only">{s}{i < stageIndex ? '（完成）' : ''}</span>
            </li>
          ))}
        </ol>
        <span className="game-stage-name" aria-hidden>{SCENE_FLOW[stageIndex]}</span>
        <div className="game-patient">{patient}</div>
        {actions && <div className="game-top-actions">{actions}</div>}
        {/* the surgery's stage corners hold zoom and confirm controls, so its record toggle lives in the bar */}
        {dark && recordButton}
        <MainNav route="play" compact />
      </header>
      <div className="game-main">
        <div className="game-stage">
          {children}
          <div className="game-hint">{hint}</div>
          {!dark && recordButton}
          {/* the tool dock floats over the bottom of the scene on wide screens and sits below it on phones */}
          <footer className="game-dock">
            {toolInfo}
            {tray}
          </footer>
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
    </div>
  );
}
