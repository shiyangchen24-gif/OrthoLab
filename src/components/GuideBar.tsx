import { useEffect } from 'react';
import type { GuideStep } from '../engine/guide';
import { useStore } from '../store';

export function useGuideVisible() {
  const { data } = useStore();
  const g = data.settings.guide;
  return g === 'on' || (g === 'auto' && Object.keys(data.first).length === 0);
}

/** Single-action onboarding bar. Highlights exactly one target element. */
export function GuideBar({ step }: { step: GuideStep }) {
  const { updateSettings } = useStore();
  const visible = useGuideVisible();

  useEffect(() => {
    if (!visible || !step.target) return;
    // re-run after each render: the target may mount later
    const el = document.querySelector(step.target);
    el?.classList.add('guide-target');
    return () => el?.classList.remove('guide-target');
  });

  if (!visible) {
    return (
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn ghost sm" onClick={() => updateSettings({ guide: 'on' })} data-testid="guide-show">
          🧭 顯示引導
        </button>
      </div>
    );
  }
  return (
    <aside className="guide" aria-label="新手引導" data-testid="guide">
      <span aria-hidden style={{ fontSize: '1.4rem' }}>🧭</span>
      <div style={{ flex: 1 }}>
        <span className="step">目前階段：{step.stage}</span>
        <b data-testid="guide-do">{step.doNow}</b>
        <span className="small">
          完成條件：{step.done}　下一步：{step.next}
        </span>
      </div>
      <button className="btn sm" onClick={() => updateSettings({ guide: 'off' })} data-testid="guide-skip">
        略過引導
      </button>
    </aside>
  );
}
