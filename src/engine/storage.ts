// Versioned localStorage persistence with migration and corruption recovery.

import type { LearningRecord } from '../types';
import type { CaseSession } from './session';

export const STORAGE_KEY = 'ortholab:save';
export const SAVE_VERSION = 2;

export interface Settings {
  sound: boolean;
  volume: number;
  reducedMotion: 'system' | 'on' | 'off';
  snapAssist: boolean;
}

export const DEFAULT_SETTINGS: Settings = { sound: true, volume: 0.25, reducedMotion: 'system', snapAssist: true };

export interface SaveData {
  version: typeof SAVE_VERSION;
  disclaimerAck: boolean;
  settings: Settings;
  /** First-attempt record per case: written once, never overwritten by retries. */
  first: Record<string, LearningRecord>;
  practice: LearningRecord[];
  /** Event ids already settled — prevents double settlement. */
  settled: string[];
  session: CaseSession | null;
}

export const emptySave = (): SaveData => ({
  version: SAVE_VERSION,
  disclaimerAck: false,
  settings: { ...DEFAULT_SETTINGS },
  first: {},
  practice: [],
  settled: [],
  session: null,
});

export interface LoadResult {
  data: SaveData;
  status: 'empty' | 'ok' | 'migrated' | 'corrupt-reset';
  message?: string;
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

function sanitizeSettings(x: unknown): Settings {
  const s = isObj(x) ? x : {};
  return {
    sound: typeof s.sound === 'boolean' ? s.sound : DEFAULT_SETTINGS.sound,
    volume: typeof s.volume === 'number' && s.volume >= 0 && s.volume <= 1 ? s.volume : DEFAULT_SETTINGS.volume,
    reducedMotion: s.reducedMotion === 'on' || s.reducedMotion === 'off' || s.reducedMotion === 'system' ? s.reducedMotion : 'system',
    snapAssist: typeof s.snapAssist === 'boolean' ? s.snapAssist : DEFAULT_SETTINGS.snapAssist,
  };
}

const isRecord = (r: unknown): r is LearningRecord =>
  isObj(r) && typeof r.eventId === 'string' && typeof r.caseId === 'string' && isObj(r.scores);

function sanitizeSession(x: unknown): CaseSession | null {
  if (!isObj(x)) return null;
  const ok =
    typeof x.eventId === 'string' &&
    typeof x.caseId === 'string' &&
    typeof x.stage === 'string' &&
    Array.isArray(x.revealed) &&
    Array.isArray(x.decisions) &&
    isObj(x.moduleState);
  return ok ? (x as unknown as CaseSession) : null;
}

/**
 * v1 (hypothetical earlier format) stored { version: 1, records: LearningRecord[], settings }.
 * The first record per case becomes the first attempt; the rest become practice.
 */
export function migrate(raw: unknown): SaveData {
  if (!isObj(raw)) throw new Error('not an object');
  const version = raw.version;
  if (version === SAVE_VERSION) {
    const first: Record<string, LearningRecord> = {};
    if (isObj(raw.first)) for (const [k, r] of Object.entries(raw.first)) if (isRecord(r)) first[k] = r;
    return {
      version: SAVE_VERSION,
      disclaimerAck: raw.disclaimerAck === true,
      settings: sanitizeSettings(raw.settings),
      first,
      practice: Array.isArray(raw.practice) ? raw.practice.filter(isRecord) : [],
      settled: Array.isArray(raw.settled) ? raw.settled.filter((x): x is string => typeof x === 'string') : [],
      session: sanitizeSession(raw.session),
    };
  }
  if (version === 1) {
    const out = emptySave();
    out.settings = sanitizeSettings(raw.settings);
    out.disclaimerAck = raw.disclaimerAck === true;
    const recs = Array.isArray(raw.records) ? raw.records.filter(isRecord) : [];
    for (const r of recs) {
      if (!out.first[r.caseId]) out.first[r.caseId] = { ...r, kind: 'first' };
      else out.practice.push({ ...r, kind: 'practice' });
      out.settled.push(r.eventId);
    }
    return out;
  }
  throw new Error(`unsupported save version ${String(version)}`);
}

export function load(storage: Storage | undefined = safeStorage()): LoadResult {
  if (!storage) return { data: emptySave(), status: 'empty' };
  let text: string | null = null;
  try {
    text = storage.getItem(STORAGE_KEY);
  } catch {
    return { data: emptySave(), status: 'empty' };
  }
  if (text === null) return { data: emptySave(), status: 'empty' };
  try {
    const parsed = JSON.parse(text) as unknown;
    const wasCurrent = isObj(parsed) && parsed.version === SAVE_VERSION;
    const data = migrate(parsed);
    return { data, status: wasCurrent ? 'ok' : 'migrated', message: wasCurrent ? undefined : '已將舊版存檔轉換為新版格式。' };
  } catch {
    try {
      storage.setItem(`${STORAGE_KEY}:corrupt-backup`, text);
    } catch {
      /* ignore quota errors */
    }
    return { data: emptySave(), status: 'corrupt-reset', message: '偵測到損壞的存檔，已備份並以新存檔開始。' };
  }
}

export function save(data: SaveData, storage: Storage | undefined = safeStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearAll(storage: Storage | undefined = safeStorage()) {
  try {
    storage?.removeItem(STORAGE_KEY);
    storage?.removeItem(`${STORAGE_KEY}:corrupt-backup`);
  } catch {
    /* ignore */
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

/** Settle a finished session exactly once. First attempts are never overwritten. */
export function settle(data: SaveData, record: LearningRecord): { data: SaveData; applied: boolean } {
  if (data.settled.includes(record.eventId)) return { data, applied: false };
  const next: SaveData = { ...data, settled: [...data.settled, record.eventId] };
  if (record.kind === 'first' && !data.first[record.caseId]) {
    next.first = { ...data.first, [record.caseId]: record };
  } else {
    next.practice = [...data.practice, { ...record, kind: 'practice' }];
  }
  return { data: next, applied: true };
}
