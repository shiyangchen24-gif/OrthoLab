// Palpation feedback for the patient illustration.
//
// A counter keyed by the session's eventId: it only advances when an
// orthopaedic exam is available and newly revealed, so locked or already
// completed exams never replay the animation, and a different session (case
// switch / restart) reads as 0. Purely visual: it never touches scoring.

import { clueAvailable, type CaseSession } from './session';
import type { Clue } from '../types';

export interface PalpationEvent {
  eventId: string;
  count: number;
}

/** True when revealing this clue now is a real, first-time orthopaedic examination. */
export function isPalpationReveal(s: CaseSession, clue: Pick<Clue, 'id' | 'category'>): boolean {
  return clue.category === 'ortho' && clueAvailable(s, clue.id) && !s.revealed.includes(clue.id);
}

/** Next palpation event after the player uses `clue` (unchanged when it is not a valid palpation). */
export function nextPalpation(prev: PalpationEvent | null, s: CaseSession, clue: Pick<Clue, 'id' | 'category'>): PalpationEvent | null {
  if (!isPalpationReveal(s, clue)) return prev;
  return { eventId: s.eventId, count: prev?.eventId === s.eventId ? prev.count + 1 : 1 };
}

/** The trigger value to hand to PatientView for the current session. */
export function palpationTrigger(ev: PalpationEvent | null, eventId: string): number {
  return ev?.eventId === eventId ? ev.count : 0;
}
