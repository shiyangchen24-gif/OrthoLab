import { describe, expect, it } from 'vitest';
import {
  comboVerdict,
  initialMpl,
  patellaOffset,
  scoreFhne,
  scoreMpl,
  scoreTplo,
  trackStable,
  cutInZone,
  type MplState,
} from '../src/engine/concept';
import { CARE_DECKS, NONSURGICAL_DECKS, scoreRound } from '../src/data/careDecks';

describe('concept modules', () => {
  it('TPLO step 2 never contributes score (source forbids numeric scoring)', () => {
    const a = scoreTplo({ s1: true, s2: true, s3: true, s4: true });
    const b = scoreTplo({ s1: true, s2: false, s3: true, s4: true });
    expect(a.score).toBe(100);
    expect(b.score).toBe(a.score);
  });

  it('FHNE cut zone boundaries', () => {
    expect(cutInZone(0.55)).toBe(true);
    expect(cutInZone(0.75)).toBe(true);
    expect(cutInZone(0.54)).toBe(false);
    expect(cutInZone(0.76)).toBe(false);
    expect(scoreFhne({ s1: true, s2: true, s3: true, s4: true }).score).toBe(100);
  });

  it('MPL requires groove + tuberosity, rejects osteotomy/TPLO, soft tissue optional', () => {
    expect(comboVerdict(['sulcoplasty']).ok).toBe(false);
    expect(comboVerdict(['sulcoplasty', 'ttt']).ok).toBe(true);
    expect(comboVerdict(['sulcoplasty', 'ttt', 'soft']).ok).toBe(true);
    expect(comboVerdict(['sulcoplasty', 'ttt', 'tplo']).ok).toBe(false);
    expect(comboVerdict(['sulcoplasty', 'ttt', 'osteotomy']).ok).toBe(false);
  });

  it('patella tracking is stable only after the needed corrections', () => {
    const base: MplState = { ...initialMpl(), combo: ['sulcoplasty', 'ttt'] };
    expect(trackStable(base)).toBe(false);
    const fixed = { ...base, depth: 70, tuberosity: 80 };
    expect(trackStable(fixed)).toBe(true);
    expect(patellaOffset(fixed, 0.9)).toBe(0);
    expect(scoreMpl({ s1Wrong: 0, s2: true, s4: true }).score).toBe(100);
  });
});

describe('card decks', () => {
  it('scoring: all correct = 100, wrong picks reduce, floor 0', () => {
    const r = CARE_DECKS['PROC-ORIF-PLATE'].rounds[0];
    const right = r.cards.filter((c) => c.correct).map((c) => c.id);
    const wrong = r.cards.filter((c) => !c.correct).map((c) => c.id);
    expect(scoreRound(r, right)).toMatchObject({ score: 100, passed: true });
    expect(scoreRound(r, [...right, wrong[0]]).passed).toBe(false);
    expect(scoreRound(r, wrong).score).toBe(0);
  });

  it('every deck has correct and distractor cards and no drug doses', () => {
    for (const d of [...Object.values(CARE_DECKS), ...Object.values(NONSURGICAL_DECKS)])
      for (const r of d.rounds) {
        expect(r.cards.some((c) => c.correct)).toBe(true);
        expect(r.cards.some((c) => !c.correct)).toBe(true);
        for (const c of r.cards) expect(c.text).not.toMatch(/mg\/kg|毫克/);
      }
  });
});
