// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PatientView, limbsFromSide, raisedLimbs } from '../src/components/PatientView';
import { cases, caseById, cluesForCase } from '../src/data';
import { CASE_META } from '../src/data/caseMeta';
import { isPalpationReveal, nextPalpation, palpationTrigger } from '../src/engine/palpation';
import { answerLocalization, revealClue, startSession } from '../src/engine/session';
import { StoreProvider, useStore } from '../src/store';
import { Clinic } from '../src/screens/Clinic';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function host(): HTMLElement {
  const d = document.createElement('div');
  d.innerHTML = '';
  return d;
}

// these tests cover the vector art (layers, CSS animation); raster art is covered in patientArt.test.tsx
function renderCase(id: string, extra: Partial<Parameters<typeof PatientView>[0]> = {}): HTMLElement {
  const c = caseById(id)!;
  const d = host();
  d.innerHTML = renderToStaticMarkup(
    <PatientView species={c.species} breed={c.breed} pose={c.pose} affectedLimbs={limbsFromSide(c.side)} art={null} {...extra} />,
  );
  return d;
}

const raisedOf = (d: HTMLElement) => [...d.querySelectorAll('[data-limb][data-raised="true"]')].map((e) => e.getAttribute('data-limb')).sort();

describe('PatientView posture comes from the case data', () => {
  it('case side text parses to the same limbs as the localisation answer', () => {
    for (const c of cases) expect(limbsFromSide(c.side).sort()).toEqual([...(CASE_META[c.id]?.limbs ?? [])].sort());
  });

  it('C07 raises only the left forelimb', () => {
    const d = renderCase('C07');
    expect(raisedOf(d)).toEqual(['LF']);
    const lf = d.querySelector('[data-limb="LF"]')!;
    expect(lf.getAttribute('data-part')).toBe('injured-limb');
    expect(lf.getAttribute('data-weight-bearing')).toBe('false');
    expect(lf.querySelector('.limping-tremor')).not.toBeNull();
    // tremor only on the raised limb
    expect(d.querySelectorAll('.limping-tremor')).toHaveLength(1);
  });

  it('a right-hind case lifts RH and never the left forelimb', () => {
    for (const id of ['C03', 'C04', 'C08']) {
      const d = renderCase(id);
      expect(raisedOf(d)).toEqual(['RH']);
      expect(d.querySelector('[data-limb="LF"]')!.getAttribute('data-raised')).toBe('false');
    }
  });

  it('asymptomatic, bilateral and unknown-side patients keep all limbs weight-bearing', () => {
    expect(raisedOf(renderCase('C05'))).toEqual([]); // stand-alert: no lameness shown
    const c06 = renderCase('C06'); // bilateral hips: both marked, neither lifted
    expect(raisedOf(c06)).toEqual([]);
    expect([...c06.querySelectorAll('[data-part="injured-limb"]')].map((e) => e.getAttribute('data-limb')).sort()).toEqual(['LH', 'RH']);
    expect(limbsFromSide('未知')).toEqual([]);
    expect(raisedLimbs('hind-lift', limbsFromSide('未知'))).toEqual([]);
    const unknown = renderCase('C01', { affectedLimbs: [] });
    expect(raisedOf(unknown)).toEqual([]);
    expect(unknown.querySelector('[data-part="injured-limb"]')).toBeNull();
  });

  it('exposes stable layers: torso, head, tail, eyes and the four anatomical limbs', () => {
    for (const id of ['C07', 'C08']) {
      const d = renderCase(id);
      for (const part of ['torso', 'head', 'tail']) expect(d.querySelectorAll(`[data-part="${part}"]`)).toHaveLength(1);
      expect(d.querySelectorAll('[data-part="eye"].patient-blink')).toHaveLength(2);
      expect([...d.querySelectorAll('[data-limb]')].map((e) => e.getAttribute('data-limb')).sort()).toEqual(['LF', 'LH', 'RF', 'RH']);
      expect(d.querySelector('[data-part="torso"] .breathing')).not.toBeNull();
      expect(d.querySelector('desc')!.textContent).toContain('教學示意');
    }
  });

  it('two characters on one page never share an SVG id', () => {
    const d = host();
    d.innerHTML = renderToStaticMarkup(
      <>
        <PatientView species="犬" breed="瑪爾濟斯" pose="fore-lift" affectedLimbs={['LF']} />
        <PatientView species="貓" breed="短毛家貓" pose="sit-stiff" affectedLimbs={['LH', 'RH']} />
      </>,
    );
    const ids = [...d.querySelectorAll('[id]')].map((e) => e.id);
    expect(ids.length).toBeGreaterThan(20);
    expect(new Set(ids).size).toBe(ids.length);
    // every url(#…) reference resolves inside its own svg
    for (const svg of d.querySelectorAll('svg')) {
      const own = new Set([...svg.querySelectorAll('[id]')].map((e) => e.id));
      for (const m of svg.outerHTML.matchAll(/url\(#([^)]+)\)/g)) expect(own.has(m[1])).toBe(true);
    }
  });

  it('reduced motion marks the svg and swaps the withdrawal for a short text cue', async () => {
    const moving = renderCase('C07', { palpationTrigger: 1 });
    expect(moving.querySelector('svg')!.getAttribute('data-reduced-motion')).toBe('false');
    expect(moving.querySelector('[data-limb="LF"] .palpation-withdraw')).not.toBeNull();
    expect(moving.querySelector('[data-testid="palpation-cue"]')).toBeNull();
    const still = renderCase('C07', { palpationTrigger: 1, reducedMotion: true });
    expect(still.querySelector('svg')!.getAttribute('data-reduced-motion')).toBe('true');
    expect(still.querySelector('[data-testid="palpation-cue"]')!.textContent).toContain('教學示意');
    // the stylesheet stops every layer for this attribute and for prefers-reduced-motion
    const fsModule = 'node:fs'; // no Node typings in this project: load fs untyped
    const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as { readFileSync: (p: string, enc: string) => string };
    const css = readFileSync('src/components/PatientView.css', 'utf8');
    expect(css).toContain(".patient-view[data-reduced-motion='true'] *");
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[^}]*animation: none !important/);
  });

  it('withdrawal only plays on the injured limb and only after a trigger', () => {
    const idle = renderCase('C07');
    expect(idle.querySelector('.palpation-withdraw')).toBeNull();
    const fired = renderCase('C07', { palpationTrigger: 2 });
    const w = [...fired.querySelectorAll('.palpation-withdraw')].map((e) => e.closest('[data-limb]')!.getAttribute('data-limb'));
    expect(w).toEqual(['LF']);
  });
});

describe('palpation trigger rules (pure)', () => {
  const ortho = (id: string) => cluesForCase(id).find((c) => c.category === 'ortho')!;

  it('only an available, first-time orthopaedic exam advances the counter', () => {
    let s = startSession('C01', false);
    const clue = ortho('C01');
    const history = cluesForCase('C01').find((c) => c.category === 'history')!;
    expect(isPalpationReveal(s, clue)).toBe(false); // locked before localisation
    s = answerLocalization(s, ['LH']).session;
    if (clue.prerequisiteIds.length) expect(isPalpationReveal(s, clue)).toBe(false); // prerequisites first
    for (const p of clue.prerequisiteIds) s = revealClue(s, p);
    expect(isPalpationReveal(s, history)).toBe(false); // a non-orthopaedic exam never triggers
    let ev = nextPalpation(null, s, clue);
    expect(palpationTrigger(ev, s.eventId)).toBe(1);
    s = revealClue(s, clue.id);
    ev = nextPalpation(ev, s, clue); // completed: no replay
    expect(palpationTrigger(ev, s.eventId)).toBe(1);
    const other = startSession('C03', false); // case switch or restart reads as a clean slate
    expect(palpationTrigger(ev, other.eventId)).toBe(0);
  });
});

describe('Clinic wiring', () => {
  let root: Root;
  let el: HTMLElement;
  let start: (id: string) => void = () => {};

  function Harness({ caseId }: { caseId: string }) {
    const { data, startCase } = useStore();
    start = startCase;
    useEffect(() => {
      startCase(caseId);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return data.session ? <Clinic /> : null;
  }

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('ortholab:save', JSON.stringify({ version: 2, disclaimerAck: true, settings: { reducedMotion: 'off', sound: false }, first: {}, practice: [], settled: [], session: null }));
    el = document.createElement('div');
    document.body.appendChild(el);
    root = createRoot(el);
  });
  afterEach(() => {
    act(() => root.unmount());
    el.remove();
  });

  const q = (sel: string) => el.querySelector(sel) as HTMLElement | null;
  const click = (sel: string) => act(() => q(sel)!.click());
  const trig = () => Number(q('[data-testid="patient-view"]')!.getAttribute('data-palpation'));

  it('uses the new PatientView with the case side, and only a valid orthopaedic exam triggers withdrawal', () => {
    act(() => root.render(<StoreProvider><Harness caseId="C01" /></StoreProvider>));
    const svg = q('[data-testid="patient-view"]')!;
    expect(svg.getAttribute('data-raised')).toBe('LH');
    const clues = cluesForCase('C01');
    const o = clues.find((c) => c.category === 'ortho')!;
    // locked before localisation
    expect((q(`[data-testid="exam-${o.id}"]`) as HTMLButtonElement).disabled).toBe(true);
    click(`[data-testid="exam-${o.id}"]`);
    expect(trig()).toBe(0);
    click('[data-testid="limb-btn-LH"]');
    click('[data-testid="limb-confirm"]');
    // non-orthopaedic exams never trigger
    for (const c of clues.filter((x) => x.category === 'history')) click(`[data-testid="exam-${c.id}"]`);
    expect(trig()).toBe(0);
    expect(q('.palpation-withdraw')).toBeNull();
    for (const p of o.prerequisiteIds) click(`[data-testid="exam-${p}"]`);
    click(`[data-testid="exam-${o.id}"]`);
    expect(trig()).toBe(1);
    expect(q('[data-limb="LH"] .palpation-withdraw')).not.toBeNull();
    expect(q(`[data-testid="record-${o.id}"]`)!.textContent).toContain(o.result.slice(0, 8)); // result text untouched
    // repeat on a completed exam: no replay
    click(`[data-testid="exam-${o.id}"]`);
    expect(trig()).toBe(1);
    // switching case clears the feedback
    act(() => start('C03'));
    expect(trig()).toBe(0);
    expect(q('.palpation-withdraw')).toBeNull();
    expect(q('[data-testid="patient-view"]')!.getAttribute('data-raised')).toBe('RH');
  });
});
