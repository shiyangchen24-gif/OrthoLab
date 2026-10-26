// Main navigation with single-weight line icons (drawn in code so they stay
// crisp at 20 px and share one stroke style). Used by the site header and the
// compact game bar.

import type { ReactNode } from 'react';
import { navigate, type Route } from '../router';

export const NAV: { route: Route; label: string }[] = [
  { route: 'home', label: '首頁' },
  { route: 'cases', label: '病例' },
  { route: 'play', label: '診間' },
  { route: 'kb', label: '知識庫' },
  { route: 'refs', label: '參考來源' },
  { route: 'settings', label: '設定' },
  { route: 'about', label: '說明' },
];

const PATHS: Record<Route, ReactNode> = {
  home: <path d="M4 11.5 12 5l8 6.5V20h-5v-5h-6v5H4z" />,
  cases: (
    <>
      <rect x="5.5" y="4.5" width="13" height="16" rx="2" />
      <path d="M9 4.5V3.5h6v1M8.5 10h7M8.5 13.5h7M8.5 17h4" />
    </>
  ),
  play: (
    <>
      <path d="M6 4v5a4 4 0 0 0 8 0V4M6 4h-1M14 4h1" />
      <path d="M10 13v2.5a4.5 4.5 0 0 0 9 0V13" />
      <circle cx="19" cy="11" r="2" />
    </>
  ),
  kb: (
    <>
      <path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5z" />
      <path d="M12 6.5v13" />
    </>
  ),
  refs: (
    <>
      <path d="M7 3.5h7l4 4V20.5H7z" />
      <path d="M14 3.5v4h4M9.5 12h6M9.5 15h6M9.5 18h4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6" />
      <circle cx="12" cy="12" r="6.3" />
    </>
  ),
  about: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.6M12 17v.2" />
    </>
  ),
};

export function NavIcon({ route, size = 22 }: { route: Route; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[route]}
    </svg>
  );
}

/** Icon-over-label navigation; `compact` hides labels on narrow screens (they stay as accessible names). */
export function MainNav({ route, compact = false }: { route: Route; compact?: boolean }) {
  return (
    <nav className={`topnav ${compact ? 'compact' : ''}`} aria-label="主選單">
      {NAV.map((n) => (
        <button key={n.route} aria-current={route === n.route ? 'page' : undefined} onClick={() => navigate(n.route)} aria-label={n.label} title={n.label}>
          <NavIcon route={n.route} />
          <span className="nav-label">{n.label}</span>
        </button>
      ))}
    </nav>
  );
}
