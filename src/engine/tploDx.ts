// State helpers for the ① diagnosis card (CrCL cases): stored in moduleState.dx.
import { dxItems } from '../data/tploDx';
import type { CaseSession } from './session';

export interface DxState {
  answers: Record<string, string>;
  first: Record<string, boolean>;
}

export const dxState = (s: CaseSession): DxState => (s.moduleState.dx as DxState | undefined) ?? { answers: {}, first: {} };

/** Cases without a diagnosis card are always "done". */
export function dxDone(s: CaseSession): boolean {
  const items = dxItems(s.caseId);
  const st = dxState(s);
  return items.every((q) => q.options.some((o) => o.correct && o.id === st.answers[q.id]));
}

export function answerDx(s: CaseSession, itemId: string, optionId: string): CaseSession {
  const q = dxItems(s.caseId).find((x) => x.id === itemId);
  const o = q?.options.find((x) => x.id === optionId);
  if (!q || !o) return s;
  const st = dxState(s);
  if (q.options.some((x) => x.correct && x.id === st.answers[q.id])) return s; // closed once correct
  const first = q.id in st.first ? st.first : { ...st.first, [q.id]: o.correct };
  return { ...s, moduleState: { ...s.moduleState, dx: { answers: { ...st.answers, [q.id]: optionId }, first } } };
}

/** Feedback notes for first-attempt misses (not scored). */
export function dxNotes(s: CaseSession): string[] {
  const st = dxState(s);
  return dxItems(s.caseId)
    .filter((q) => st.first[q.id] === false)
    .map((q) => `診斷評估「${q.prompt}」首次判讀未正確（依據 ${q.basis}）。`);
}
