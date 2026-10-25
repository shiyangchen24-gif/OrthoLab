import { useCallback, useRef } from 'react';
import { useStore } from '../store';

export type Sticky = Record<string, unknown>;

/**
 * Module state persisted in the current session (survives refresh) with an
 * in-memory undo stack. Every change goes through `set`, so undo/reset are uniform.
 *
 * `sticky` holds first-attempt results and attempted violations. It lives
 * outside the undo stack: undo / reset can never erase a first attempt.
 */
export function useModuleState<T>(key: string, init: () => T) {
  const { data, updateSession } = useStore();
  const stored = data.session?.moduleState[key] as T | undefined;
  const sticky = (data.session?.moduleState[`${key}#sticky`] as Sticky | undefined) ?? {};
  const initRef = useRef<T | null>(null);
  if (stored === undefined && initRef.current === null) initRef.current = init();
  const state = (stored ?? initRef.current) as T;
  const history = useRef<T[]>([]);
  // live state for functional updates fired several times between renders (drags)
  const live = useRef<T>(state);
  const lastStored = useRef<T | undefined>(stored);
  if (stored !== lastStored.current) {
    lastStored.current = stored;
    live.current = state;
  }

  const write = useCallback(
    (next: T) => {
      live.current = next;
      updateSession((s) => ({ ...s, moduleState: { ...s.moduleState, [key]: next } }));
    },
    [key, updateSession],
  );

  const set = useCallback(
    (next: T | ((prev: T) => T), opts: { record?: boolean } = {}) => {
      const cur = live.current;
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(cur) : next;
      if (resolved === cur) return;
      if (opts.record !== false) {
        history.current.push(cur);
        if (history.current.length > 60) history.current.shift();
      }
      write(resolved);
    },
    [write],
  );

  const undo = useCallback(() => {
    const prev = history.current.pop();
    if (prev !== undefined) write(prev);
  }, [write]);

  const reset = useCallback(() => {
    history.current = [];
    write(init());
  }, [init, write]);

  /** Record a first-attempt value once; later calls with the same name are ignored. */
  const recordFirst = useCallback(
    (name: string, value: unknown) =>
      updateSession((s) => {
        const k = `${key}#sticky`;
        const cur = (s.moduleState[k] as Sticky | undefined) ?? {};
        if (name in cur) return s;
        return { ...s, moduleState: { ...s.moduleState, [k]: { ...cur, [name]: value } } };
      }),
    [key, updateSession],
  );

  /** Add unique items to a sticky list (e.g. attempted safety violations). */
  const addSticky = useCallback(
    (name: string, items: string[]) =>
      updateSession((s) => {
        const k = `${key}#sticky`;
        const cur = (s.moduleState[k] as Sticky | undefined) ?? {};
        const list = (cur[name] as string[] | undefined) ?? [];
        const merged = Array.from(new Set([...list, ...items]));
        if (merged.length === list.length) return s;
        return { ...s, moduleState: { ...s.moduleState, [k]: { ...cur, [name]: merged } } };
      }),
    [key, updateSession],
  );

  const countHint = useCallback(() => updateSession((s) => ({ ...s, hintsUsed: s.hintsUsed + 1 })), [updateSession]);

  return { state, set, undo, reset, canUndo: history.current.length > 0, sticky, recordFirst, addSticky, countHint };
}
