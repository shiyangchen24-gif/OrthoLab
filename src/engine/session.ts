// Case session: clue unlocking, decisions, routing, stage scores and settlement.
// Pure functions over plain serialisable objects (saved to localStorage).

import { caseById, cluesForCase, optionsForCase } from '../data';
import type { AnswerCategory, LearningRecord, ProcedureId, StageScores, TreatmentOption } from '../types';

export type Stage = 'clinic' | 'procedure' | 'explain' | 'care' | 'results';

export interface DecisionEvent {
  optionId: string;
  at: string;
  /** counted = this is the scored (first valid) decision */
  counted: boolean;
  outcome: AnswerCategory | 'missing-clues';
}

export interface ModuleResult {
  score: number | null;
  notes: string[];
  detail?: unknown;
}

export interface CaseSession {
  eventId: string;
  caseId: string;
  kind: 'first' | 'practice';
  startedAt: string;
  stage: Stage;
  revealed: string[];
  lastRevealed: string | null;
  decisions: DecisionEvent[];
  scoredOptionId: string | null;
  activeOptionId: string | null;
  prematureDecisions: number;
  hintsUsed: number;
  snapUsed: boolean;
  /** module-specific serialisable state, keyed by procedure id */
  moduleState: Record<string, unknown>;
  moduleResult: ModuleResult | null;
  careState: unknown;
  careResult: ModuleResult | null;
  settled: boolean;
}

export function newEventId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && 'randomUUID' in c) return c.randomUUID();
  return `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function startSession(caseId: string, hasFirstRecord: boolean): CaseSession {
  if (!caseById(caseId)) throw new Error(`unknown case ${caseId}`);
  return {
    eventId: newEventId(),
    caseId,
    kind: hasFirstRecord ? 'practice' : 'first',
    startedAt: new Date().toISOString(),
    stage: 'clinic',
    revealed: [],
    lastRevealed: null,
    decisions: [],
    scoredOptionId: null,
    activeOptionId: null,
    prematureDecisions: 0,
    hintsUsed: 0,
    snapUsed: false,
    moduleState: {},
    moduleResult: null,
    careState: null,
    careResult: null,
    settled: false,
  };
}

// ---------- clues ----------
export function clueAvailable(s: CaseSession, clueId: string): boolean {
  const clue = cluesForCase(s.caseId).find((c) => c.id === clueId);
  if (!clue) return false;
  return clue.prerequisiteIds.every((p) => s.revealed.includes(p));
}

export function revealClue(s: CaseSession, clueId: string): CaseSession {
  if (s.revealed.includes(clueId) || !clueAvailable(s, clueId)) return s;
  return { ...s, revealed: [...s.revealed, clueId], lastRevealed: clueId };
}

export function missingRequiredClues(s: CaseSession) {
  return cluesForCase(s.caseId).filter((c) => c.required && !s.revealed.includes(c.id));
}

// ---------- decisions ----------
export interface DecisionFeedback {
  option: TreatmentOption;
  outcome: AnswerCategory | 'missing-clues';
  counted: boolean;
  missingClueNames: string[];
}

export function chooseOption(s: CaseSession, optionId: string): { session: CaseSession; feedback: DecisionFeedback } {
  const option = optionsForCase(s.caseId).find((o) => o.id === optionId);
  if (!option) throw new Error(`unknown option ${optionId}`);
  const missing = missingRequiredClues(s);
  const at = new Date().toISOString();
  if (missing.length > 0) {
    // 共通門檻: before all required clues → 條件不足 and not scored
    const ev: DecisionEvent = { optionId, at, counted: false, outcome: 'missing-clues' };
    return {
      session: { ...s, decisions: [...s.decisions, ev], prematureDecisions: s.prematureDecisions + 1 },
      feedback: { option, outcome: 'missing-clues', counted: false, missingClueNames: missing.map((c) => `${c.examName}（${c.id}）`) },
    };
  }
  // an option whose score is null (條件不足) never becomes the scored decision
  const counted = s.scoredOptionId === null && option.score !== null;
  const ev: DecisionEvent = { optionId, at, counted, outcome: option.category };
  return {
    session: {
      ...s,
      decisions: [...s.decisions, ev],
      scoredOptionId: counted ? optionId : s.scoredOptionId,
      activeOptionId: optionId,
    },
    feedback: { option, outcome: option.category, counted, missingClueNames: [] },
  };
}

/** Move on from feedback along the chosen option's route. */
export function proceed(s: CaseSession): CaseSession {
  const option = optionsForCase(s.caseId).find((o) => o.id === s.activeOptionId);
  if (!option) return s;
  if (option.route.kind === 'module') return { ...s, stage: 'procedure' };
  if (option.route.kind === 'explain') return { ...s, stage: 'explain' };
  return s;
}

export const canProceed = (o: TreatmentOption) => o.route.kind !== 'retry';

export function activeProcedure(s: CaseSession): ProcedureId | null {
  const option = optionsForCase(s.caseId).find((o) => o.id === s.activeOptionId);
  if (!option || option.route.kind !== 'module') return null;
  return option.route.procedureId;
}

/** Non-surgical module covers management + follow-up itself, so no separate care stage. */
export const needsCareStage = (p: ProcedureId | null) => p !== null && p !== 'PROC-NONSURGICAL';

export function finishModule(s: CaseSession, result: ModuleResult): CaseSession {
  const p = activeProcedure(s);
  return { ...s, moduleResult: result, stage: needsCareStage(p) ? 'care' : 'results' };
}

export function finishCare(s: CaseSession, result: ModuleResult): CaseSession {
  return { ...s, careResult: result, stage: 'results' };
}

export function finishExplain(s: CaseSession): CaseSession {
  return { ...s, stage: 'results' };
}

// ---------- scores ----------
export function examScore(s: CaseSession): number {
  // G01 design assumption: each premature (pre-clue) decision −10, floor 50.
  return Math.max(50, 100 - 10 * s.prematureDecisions);
}

export function reasoningScore(s: CaseSession): number | null {
  if (!s.scoredOptionId) return null;
  const o = optionsForCase(s.caseId).find((x) => x.id === s.scoredOptionId);
  if (!o || o.score === null) return null;
  return o.score * 10; // source scale 0–10 → percent
}

export function stageScores(s: CaseSession): StageScores {
  const p = activeProcedure(s);
  const nonSurgical = p === 'PROC-NONSURGICAL';
  return {
    exam: examScore(s),
    reasoning: reasoningScore(s),
    // non-surgical routes have no operation score and are not penalised for it
    operation: p && !nonSurgical ? s.moduleResult?.score ?? null : null,
    care: nonSurgical ? s.moduleResult?.score ?? null : s.careResult?.score ?? null,
  };
}

export function totalScore(sc: StageScores): number | null {
  const vals = [sc.exam, sc.reasoning, sc.operation, sc.care].filter((x): x is number => x !== null);
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export function buildRecord(s: CaseSession, elapsedSec: number): LearningRecord {
  const scores = stageScores(s);
  const opt = optionsForCase(s.caseId).find((o) => o.id === s.activeOptionId) ?? null;
  const scored = optionsForCase(s.caseId).find((o) => o.id === s.scoredOptionId) ?? null;
  const insufficient = s.decisions
    .filter((d) => d.outcome === 'insufficient' || d.outcome === 'missing-clues')
    .map((d) => d.optionId);
  return {
    eventId: s.eventId,
    caseId: s.caseId,
    kind: s.kind,
    completedAt: new Date().toISOString(),
    optionId: opt?.id ?? null,
    decisionCategory: scored?.category ?? null,
    route: opt?.route.kind === 'module' ? 'module' : 'explain',
    procedureId: activeProcedure(s),
    scores,
    total: totalScore(scores),
    hintsUsed: s.hintsUsed,
    snapUsed: s.snapUsed,
    prematureDecisions: s.prematureDecisions,
    insufficientChoices: Array.from(new Set(insufficient)),
    notes: [...(s.moduleResult?.notes ?? []), ...(s.careResult?.notes ?? [])],
    elapsedSec,
  };
}
