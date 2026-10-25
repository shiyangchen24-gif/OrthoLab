import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { buildRecord, startSession, type CaseSession } from './engine/session';
import { clearAll as clearStorage, emptySave, load, save, settle, type SaveData, type Settings } from './engine/storage';
import type { LearningRecord } from './types';
import { sound } from './audio';

interface Store {
  data: SaveData;
  loadMessage: string | null;
  dismissLoadMessage: () => void;
  ackDisclaimer: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  startCase: (caseId: string) => void;
  updateSession: (fn: (s: CaseSession) => CaseSession) => void;
  abandonSession: () => void;
  settleSession: () => LearningRecord | null;
  clearAll: () => void;
  reducedMotion: boolean;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => load(), []);
  const [data, setData] = useState<SaveData>(initial.data);
  const [loadMessage, setLoadMessage] = useState<string | null>(initial.message ?? null);
  const startTimes = useRef<Record<string, number>>({});

  useEffect(() => {
    save(data);
  }, [data]);

  const systemReduced = useMemo(() => {
    try {
      return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    } catch {
      return false;
    }
  }, []);
  const reducedMotion = data.settings.reducedMotion === 'on' || (data.settings.reducedMotion === 'system' && systemReduced);

  useEffect(() => {
    document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'full';
  }, [reducedMotion]);

  useEffect(() => {
    sound.configure(data.settings.sound, data.settings.volume);
  }, [data.settings.sound, data.settings.volume]);

  const ackDisclaimer = useCallback(() => setData((d) => ({ ...d, disclaimerAck: true })), []);
  const updateSettings = useCallback((patch: Partial<Settings>) => setData((d) => ({ ...d, settings: { ...d.settings, ...patch } })), []);

  const startCase = useCallback((caseId: string) => {
    setData((d) => {
      // a new patient always starts from a clean session (previous operation state discarded)
      const s = startSession(caseId, !!d.first[caseId]);
      startTimes.current[s.eventId] = Date.now();
      return { ...d, session: s };
    });
  }, []);

  const updateSession = useCallback((fn: (s: CaseSession) => CaseSession) => {
    setData((d) => (d.session ? { ...d, session: fn(d.session) } : d));
  }, []);

  const abandonSession = useCallback(() => setData((d) => ({ ...d, session: null })), []);

  const dataRef = useRef(data);
  dataRef.current = data;

  const settleSession = useCallback((): LearningRecord | null => {
    const d = dataRef.current;
    const s = d.session;
    if (!s) return null;
    const started = startTimes.current[s.eventId] ?? Date.parse(s.startedAt);
    const record = buildRecord(s, Math.round((Date.now() - started) / 1000));
    const res = settle(d, record);
    if (res.applied) {
      const next = { ...res.data, session: { ...s, settled: true } };
      dataRef.current = next;
      setData(next);
      return record;
    }
    // already settled: return the stored record, never a second settlement
    return d.first[s.caseId]?.eventId === s.eventId ? d.first[s.caseId] : d.practice.find((r) => r.eventId === s.eventId) ?? null;
  }, []);

  const clearAll = useCallback(() => {
    clearStorage();
    const fresh = emptySave();
    fresh.disclaimerAck = true;
    setData(fresh);
  }, []);

  const value: Store = {
    data,
    loadMessage,
    dismissLoadMessage: () => setLoadMessage(null),
    ackDisclaimer,
    updateSettings,
    startCase,
    updateSession,
    abandonSession,
    settleSession,
    clearAll,
    reducedMotion,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}
