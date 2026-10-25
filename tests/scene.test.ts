import { describe, expect, it } from 'vitest';
import { phaseOf, sceneStageIndex } from '../src/scenes/C07Clinic';
import { answerLocalization, answerQuiz, quizQuestions, revealClue, startSession } from '../src/engine/session';

describe('C07 scene phases follow the session engine', () => {
  it('intake → localise → exam → reason → decide, never skipping', () => {
    let s = startSession('C07', false);
    expect(phaseOf(s, false)).toBe('intake');
    expect(phaseOf(s, true)).toBe('localize');
    // a wrong limb does not advance
    s = answerLocalization(s, ['RF']).session;
    expect(phaseOf(s, true)).toBe('localize');
    s = answerLocalization(s, ['LF']).session;
    expect(phaseOf(s, true)).toBe('exam');
    expect(sceneStageIndex(s, true)).toBe(1);
    s = revealClue(s, 'C07-E1');
    s = revealClue(s, 'C07-E2');
    expect(sceneStageIndex(s, true)).toBe(2); // imaging next
    s = revealClue(s, 'C07-E3');
    s = revealClue(s, 'C07-E4');
    expect(phaseOf(s, true)).toBe('reason');
    for (const q of quizQuestions(s)) s = answerQuiz(s, q.id, q.options.find((o) => o.correct)!.id).session;
    expect(phaseOf(s, true)).toBe('decide');
    expect(sceneStageIndex(s, true)).toBe(3);
  });

  it('clue prerequisites still apply in the scene (E2 before E1 is impossible)', () => {
    let s = answerLocalization(startSession('C07', false), ['LF']).session;
    s = revealClue(s, 'C07-E2');
    expect(s.revealed).toEqual([]);
  });
});
