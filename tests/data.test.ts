import { describe, expect, it } from 'vitest';
import {
  SOURCE_SHEETS,
  carePlans,
  cases,
  clues,
  cluesForCase,
  diseases,
  modules,
  options,
  optionsForCase,
  references,
  steps,
  techniques,
  assets,
} from '../src/data';
import raw from '../src/data/generated/source.json';
import { NONSURGICAL_DECKS } from '../src/data/careDecks';

describe('source workbook extraction', () => {
  it('reads all 10 worksheets', () => {
    expect(SOURCE_SHEETS).toEqual([
      '疾病庫',
      '病例庫',
      '檢查線索庫',
      '處置判定表',
      '術式與步驟表',
      '術後與資源表',
      '術式模組',
      '參考資料',
      '骨折微調與數值容差表',
      '美術風格與圖片規範表',
    ]);
  });

  it('has the expected record counts after trimming empty rows', () => {
    expect(diseases).toHaveLength(10);
    expect(cases).toHaveLength(8);
    expect(clues).toHaveLength(32);
    expect(options).toHaveLength(32);
    expect(steps).toHaveLength(20);
    expect(modules).toHaveLength(10);
    expect(references).toHaveLength(16);
    expect(carePlans.length + assets.length).toBe(16);
  });

  it('converts numeric case fields to numbers', () => {
    for (const c of cases) {
      expect(typeof c.ageMonths).toBe('number');
      expect(typeof c.weightKg).toBe('number');
      expect(typeof c.bcs9).toBe('number');
      expect(c.fictional).toBe(true);
    }
    expect(cases.find((c) => c.id === 'C07')!.weightKg).toBe(2.3);
  });
});

describe('cases C01–C08 and clues', () => {
  it('covers C01–C08 with resolved procedures', () => {
    expect(cases.map((c) => c.id)).toEqual(['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08']);
    const expected = {
      C01: 'PROC-TPLO',
      C02: 'PROC-TPLO',
      C03: 'PROC-FHNE',
      C04: 'PROC-MPL-COMBO',
      C05: 'PROC-NONSURGICAL',
      C06: 'PROC-NONSURGICAL',
      C07: 'PROC-ORIF-PLATE',
      C08: 'PROC-ORIF-PLATE',
    };
    for (const c of cases) expect(c.procedureId).toBe(expected[c.id as keyof typeof expected]);
  });

  it('every case has required clues with valid, acyclic prerequisites', () => {
    for (const c of cases) {
      const cs = cluesForCase(c.id);
      expect(cs.length).toBeGreaterThan(0);
      expect(cs.some((x) => x.required)).toBe(true);
      const ids = new Set(cs.map((x) => x.id));
      for (const clue of cs) for (const p of clue.prerequisiteIds) expect(ids.has(p)).toBe(true);
      // at least one entry point and every clue reachable
      const reached = new Set<string>();
      let changed = true;
      while (changed) {
        changed = false;
        for (const clue of cs)
          if (!reached.has(clue.id) && clue.prerequisiteIds.every((p) => reached.has(p))) {
            reached.add(clue.id);
            changed = true;
          }
      }
      expect(reached.size).toBe(cs.length);
    }
  });

  it('does not display the unverified 70–80% non-union figure', () => {
    const c = clues.find((x) => x.id === 'C07-E4')!;
    expect(c.result).not.toMatch(/70/);
    expect(c.reviewFlags.length).toBeGreaterThan(0);
  });
});

describe('treatment options', () => {
  it('keeps blank scores null (never 0)', () => {
    const rawBlank = (raw as { treatments: Record<string, unknown>[] }).treatments
      .filter((r) => r['處置分_提案'] === null)
      .map((r) => r['判定ID']);
    expect(rawBlank).toEqual(['A03', 'A07', 'A10', 'A22']);
    for (const id of rawBlank) {
      const o = options.find((x) => x.id === id)!;
      expect(o.score).toBeNull();
      expect(o.sourceScore).toBeNull();
      expect(o.category).toBe('insufficient');
    }
  });

  it('every insufficient option has a null score and lists missing info', () => {
    for (const o of options.filter((x) => x.category === 'insufficient')) {
      expect(o.score).toBeNull();
      expect(o.missingInfo.length).toBeGreaterThan(0);
    }
  });

  it('every case has exactly one preferred option that leads to a playable module', () => {
    for (const c of cases) {
      const pref = optionsForCase(c.id).filter((o) => o.category === 'preferred');
      expect(pref).toHaveLength(1);
      expect(pref[0].route).toEqual({ kind: 'module', procedureId: c.procedureId });
    }
  });

  it('A34 is downgraded to 條件不足／待審閱 with null score but keeps source values', () => {
    const a34 = options.find((o) => o.id === 'A34')!;
    expect(a34.sourceCategory).toBe('alternative');
    expect(a34.sourceScore).toBe(8);
    expect(a34.category).toBe('insufficient');
    expect(a34.score).toBeNull();
    expect(a34.reviewFlags.some((f) => f.code === 'A34-REVIEW')).toBe(true);
  });
});

describe('T05 / T06 ID conflicts are resolved', () => {
  it('fracture splint options never route to the extracapsular module', () => {
    for (const id of ['A30', 'A35']) {
      const o = options.find((x) => x.id === id)!;
      expect(o.rawProcedureId).toBe('T05');
      expect(o.treatmentId).toBe('TX-EXTERNAL-COAPTATION');
      expect(o.route.kind).toBe('retry');
    }
    for (const id of ['A02', 'A06']) {
      const o = options.find((x) => x.id === id)!;
      expect(o.rawProcedureId).toBe('T05');
      expect(o.treatmentId).toBe('TX-ECS');
    }
  });

  it('T06 splits into TTA vs IM pin techniques', () => {
    const byId = (id: string) => options.find((x) => x.id === id)!;
    expect(byId('A03').treatmentId).toBe('TX-TTA');
    expect(byId('A07').treatmentId).toBe('TX-TTA');
    expect(byId('A31').treatmentId).toBe('TX-IM-PIN-ONLY');
    expect(byId('A34').treatmentId).toBe('TX-IM-PIN-CERCLAGE');
  });

  it('treatment technique ids and procedure ids are unique', () => {
    const t = techniques.map((x) => x.id);
    expect(new Set(t).size).toBe(t.length);
    const p = modules.map((m) => m.procedureId);
    expect(new Set(p).size).toBe(p.length);
    for (const o of options) expect(techniques.some((x) => x.id === o.treatmentId)).toBe(true);
  });
});

describe('modules and knowledge base honesty', () => {
  it('only T01, T02, T03, T04, T09 are playable', () => {
    const playable = modules.filter((m) => m.status === 'playable').map((m) => m.rawIds[0]);
    expect(playable.sort()).toEqual(['T01', 'T02', 'T03', 'T04', 'T09']);
  });

  it('T01-S2 is flagged as not numerically scorable', () => {
    expect(steps.find((s) => s.id === 'T01-S2')!.numericScoringAllowed).toBe(false);
  });

  it('first-version diseases without cases are not marked playable', () => {
    const d10 = diseases.find((d) => d.id === 'D10')!;
    expect(d10.versionScope).toBe('第一版');
    expect(d10.hasPlayableCase).toBe(false);
  });

  it('landing-page references are marked chapter/page pending', () => {
    for (const id of ['R13', 'R14']) expect(references.find((r) => r.id === id)!.locatorStatus).toBe('landing-page');
  });

  it('C05 and C06 non-surgical decks differ', () => {
    const texts = (k: string) => NONSURGICAL_DECKS[k].rounds.flatMap((r) => r.cards.filter((c) => c.correct).map((c) => c.text));
    const shared = texts('C05').filter((t) => texts('C06').includes(t));
    expect(shared).toEqual([]);
  });
});
