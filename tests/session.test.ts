import { describe, expect, it } from 'vitest';
import { cases, cluesForCase, optionsForCase } from '../src/data';
import { CASE_META } from '../src/data/caseMeta';
import {
  answerLocalization,
  answerQuiz,
  decisionScore,
  quizDone,
  quizQuestions,
  quizScore,
  chooseOption,
  clueAvailable,
  finishModule,
  proceed,
  revealClue,
  stageScores,
  examScore,
  startSession,
  totalScore,
  buildRecord,
  type CaseSession,
} from '../src/engine/session';
import { emptySave, load, migrate, save, settle, STORAGE_KEY } from '../src/engine/storage';

const localize = (s: CaseSession) => answerLocalization(s, CASE_META[s.caseId].limbs).session;
const answerAllQuiz = (s: CaseSession) => {
  let st = s;
  for (const q of quizQuestions(st)) st = answerQuiz(st, q.id, q.options.find((o) => o.correct)!.id).session;
  return st;
};
/** localise, reveal every clue and answer the reasoning questions correctly */
const revealAll = (s: CaseSession) => {
  let st = localize(s);
  for (let k = 0; k < 5; k++) for (const c of cluesForCase(s.caseId)) st = revealClue(st, c.id);
  return answerAllQuiz(st);
};

describe('clue prerequisites', () => {
  it('no clue is available before the affected limb is localised', () => {
    const s = startSession('C07', false);
    expect(clueAvailable(s, 'C07-E1')).toBe(false);
    const wrong = answerLocalization(s, ['RF']);
    expect(wrong.correct).toBe(false);
    expect(clueAvailable(wrong.session, 'C07-E1')).toBe(false);
    const right = answerLocalization(wrong.session, ['LF']);
    expect(right.correct).toBe(true);
    expect(right.session.localization!.firstCorrect).toBe(false);
    expect(clueAvailable(right.session, 'C07-E1')).toBe(true);
    expect(examScore(right.session)).toBe(90);
  });

  it('bilateral cases need both limbs', () => {
    const s = startSession('C06', false);
    expect(answerLocalization(s, ['LH']).correct).toBe(false);
    expect(answerLocalization(s, ['RH', 'LH']).correct).toBe(true);
  });

  it('locked clues cannot be revealed before prerequisites', () => {
    const s = localize(startSession('C01', false));
    expect(clueAvailable(s, 'C01-E2')).toBe(false);
    expect(revealClue(s, 'C01-E2')).toBe(s);
    const s2 = revealClue(s, 'C01-E1');
    expect(clueAvailable(s2, 'C01-E2')).toBe(true);
  });
});

describe('decision feedback', () => {
  it('choosing before required clues → 條件不足, not scored', () => {
    const s = localize(startSession('C01', false));
    const { session, feedback } = chooseOption(s, 'A01');
    expect(feedback.outcome).toBe('missing-clues');
    expect(feedback.missingClueNames.length).toBe(4);
    expect(session.scoredOptionId).toBeNull();
    expect(session.prematureDecisions).toBe(1);
  });

  it('an insufficient (null score) choice is not counted and does not become 0', () => {
    let s = revealAll(startSession('C01', false));
    const r = chooseOption(s, 'A03');
    expect(r.feedback.outcome).toBe('insufficient');
    expect(r.feedback.counted).toBe(false);
    s = r.session;
    expect(decisionScore(s)).toBeNull();
    expect(stageScores(s).reasoning).toBe(100); // only the questions so far; null is not averaged in as 0
    const r2 = chooseOption(s, 'A01');
    expect(r2.feedback.counted).toBe(true);
    expect(decisionScore(r2.session)).toBe(100);
  });

  it('four categories behave distinctly', () => {
    const s = revealAll(startSession('C01', false));
    expect(chooseOption(s, 'A01').feedback.outcome).toBe('preferred');
    expect(chooseOption(s, 'A02').feedback.outcome).toBe('alternative');
    expect(chooseOption(s, 'A03').feedback.outcome).toBe('insufficient');
    expect(chooseOption(s, 'A04').feedback.outcome).toBe('unsuitable');
    // unsuitable cannot proceed; preferred goes to module; alternative to explanation route
    expect(proceed(chooseOption(s, 'A04').session).stage).toBe('clinic');
    expect(proceed(chooseOption(s, 'A01').session).stage).toBe('procedure');
    expect(proceed(chooseOption(s, 'A02').session).stage).toBe('explain');
  });

  it('first scored decision is kept even after re-choosing', () => {
    let s = revealAll(startSession('C07', false));
    s = chooseOption(s, 'A30').session; // unsuitable, score 0
    s = chooseOption(s, 'A29').session;
    expect(decisionScore(s)).toBe(0);
    expect(stageScores(s).reasoning).toBe(50); // mean of decision 0 and questions 100
  });

  it('reasoning questions gate the decision and keep the first attempt', () => {
    let s = localize(startSession('C07', false));
    for (const c of cluesForCase('C07')) s = revealClue(s, c.id);
    expect(quizDone(s)).toBe(false);
    const early = chooseOption(s, 'A29');
    expect(early.feedback.outcome).toBe('missing-clues');
    expect(early.feedback.missingClueNames).toEqual(['推理判斷題']);
    s = answerQuiz(s, 'evidence', 'E2').session; // wrong first
    s = answerAllQuiz(s);
    expect(quizDone(s)).toBe(true);
    expect(s.quiz!.first.evidence).toBe(false);
    // answering again after a correct answer cannot change anything
    expect(answerQuiz(s, 'evidence', 'E1').session).toBe(s);
    expect(quizScore(s)).toBe(67);
  });

  it('every reasoning question has at least one correct option', () => {
    for (const id of Object.keys(CASE_META))
      for (const q of CASE_META[id].reasoning) expect(q.options.some((o) => o.correct)).toBe(true);
  });

  it('every case reaches its module through the preferred option', () => {
    for (const c of cases) {
      let s = revealAll(startSession(c.id, false));
      const pref = optionsForCase(c.id).find((o) => o.category === 'preferred')!;
      s = proceed(chooseOption(s, pref.id).session);
      expect(s.stage).toBe('procedure');
    }
  });

  it('non-surgical cases are not penalised for missing operation score', () => {
    let s = revealAll(startSession('C05', false));
    s = proceed(chooseOption(s, 'A17').session);
    s = finishModule(s, { score: 90, notes: [] });
    expect(s.stage).toBe('results');
    const sc = stageScores(s);
    expect(sc.operation).toBeNull();
    expect(sc.care).toBe(90);
    expect(totalScore(sc)).toBe(Math.round((100 + 100 + 90) / 3));
    expect(sc.reasoning).toBe(100);
  });
});

describe('storage', () => {
  const mem = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
      clear: () => m.clear(),
      key: () => null,
      get length() {
        return m.size;
      },
    } as Storage;
  };

  it('round-trips the current version', () => {
    const st = mem();
    const d = emptySave();
    d.disclaimerAck = true;
    save(d, st);
    const r = load(st);
    expect(r.status).toBe('ok');
    expect(r.data.disclaimerAck).toBe(true);
  });

  it('recovers from corrupt JSON without throwing', () => {
    const st = mem();
    st.setItem(STORAGE_KEY, '{not json');
    const r = load(st);
    expect(r.status).toBe('corrupt-reset');
    expect(r.data.first).toEqual({});
    expect(st.getItem(`${STORAGE_KEY}:corrupt-backup`)).toBe('{not json');
  });

  it('recovers from wrong shapes and unknown versions', () => {
    const st = mem();
    st.setItem(STORAGE_KEY, JSON.stringify({ version: 99 }));
    expect(load(st).status).toBe('corrupt-reset');
    st.setItem(STORAGE_KEY, JSON.stringify([1, 2]));
    expect(load(st).status).toBe('corrupt-reset');
    st.setItem(STORAGE_KEY, JSON.stringify({ version: 2, settings: { sound: 'x' }, session: { bad: 1 } }));
    const r = load(st);
    expect(r.status).toBe('ok');
    expect(r.data.settings.sound).toBe(true);
    expect(r.data.session).toBeNull();
  });

  it('migrates v1 saves', () => {
    const rec = (id: string, ev: string) => ({ eventId: ev, caseId: id, scores: {}, kind: 'first' });
    const d = migrate({ version: 1, records: [rec('C01', 'a'), rec('C01', 'b'), rec('C02', 'c')] });
    expect(Object.keys(d.first)).toEqual(['C01', 'C02']);
    expect(d.first.C01.eventId).toBe('a');
    expect(d.practice).toHaveLength(1);
    expect(d.settled).toEqual(['a', 'b', 'c']);
  });

  it('settles each event once and never overwrites the first attempt', () => {
    let s = revealAll(startSession('C05', false));
    s = proceed(chooseOption(s, 'A17').session);
    s = finishModule(s, { score: 70, notes: [] });
    const rec = buildRecord(s, 10);
    let d = emptySave();
    d = settle(d, rec).data;
    const again = settle(d, rec);
    expect(again.applied).toBe(false);
    expect(again.data.practice).toHaveLength(0);
    // a retry session is practice and does not replace first
    let s2 = revealAll(startSession('C05', true));
    s2 = proceed(chooseOption(s2, 'A17').session);
    s2 = finishModule(s2, { score: 100, notes: [] });
    const d2 = settle(again.data, buildRecord(s2, 5)).data;
    expect(d2.first.C05.scores.care).toBe(70);
    expect(d2.practice).toHaveLength(1);
    expect(d2.practice[0].scores.care).toBe(100);
  });
});
