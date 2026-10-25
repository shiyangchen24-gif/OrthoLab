import { useEffect, useState } from 'react';

// Hash routing keeps the static build working under any sub-path (GitHub Pages).
export type Route = 'home' | 'cases' | 'play' | 'kb' | 'refs' | 'settings' | 'about';
const ROUTES: Route[] = ['home', 'cases', 'play', 'kb', 'refs', 'settings', 'about'];

export function parseHash(hash: string): { route: Route; param: string | null } {
  const [r, p] = hash.replace(/^#\/?/, '').split('/');
  const route = (ROUTES as string[]).includes(r) ? (r as Route) : 'home';
  return { route, param: p ? decodeURIComponent(p) : null };
}

export function navigate(route: Route, param?: string) {
  const h = route === 'home' ? '#/' : `#/${route}${param ? `/${encodeURIComponent(param)}` : ''}`;
  if (window.location.hash !== h) window.location.hash = h;
  window.scrollTo({ top: 0 });
}

export function useRoute() {
  const [state, setState] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => setState(parseHash(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return state;
}
