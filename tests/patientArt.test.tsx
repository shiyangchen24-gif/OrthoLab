// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientView, WITHDRAW_MS, limbsFromSide, patientTargets, raisedLimbs } from '../src/components/PatientView';
import { CHARACTER_ART, missingArt, posePlan, resolvePatientArt } from '../src/components/patientAssets';
import { SCENE_SLOTS, missingSceneArt, sceneImage } from '../src/scenes/sceneAssets';
import { caseById } from '../src/data';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// fixture URLs stand in for delivered PNGs; they test the wiring, not the art
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const ALL = { 'maltese/sit.png': PNG + '#sit', 'maltese/lift-LF.png': PNG + '#lift', 'maltese/withdraw-LF.png': PNG + '#withdraw' };
const fixture = (files: Record<string, string>) => resolvePatientArt('犬', '瑪爾濟斯', files);

describe('raster art manifest', () => {
  it('bundled art: the Maltese poses and every clinic scene layer are delivered', () => {
    const art = resolvePatientArt('犬', '瑪爾濟斯')!;
    expect(Object.keys(art.urls).sort()).toEqual(['lift-LF', 'sit', 'withdraw-LF']);
    expect(missingArt()).toEqual([]);
    expect(sceneImage('background')).not.toBeNull();
    expect(sceneImage('vet')).not.toBeNull();
    expect(missingSceneArt()).toEqual([]);
    expect(sceneImage('owner')).not.toBeNull();
    expect(sceneImage('table')).not.toBeNull();
    // status follows the files: delivered only when every pose exists
    for (const a of CHARACTER_ART) expect(a.status).toBe(missingArt().some((m) => m.id === a.id) ? 'pending' : 'delivered');
    // other breeds have no raster art and keep the vector character
    expect(resolvePatientArt('犬', '約克夏')).toBeNull();
    expect(resolvePatientArt('貓', '米克斯（短毛貓）')).toBeNull();
  });

  it('C07 with the bundled art: raster, only the left forelimb raised, targets from the manifest', () => {
    const d = document.createElement('div');
    d.innerHTML = renderToStaticMarkup(<PatientView species="犬" breed="瑪爾濟斯" pose="fore-lift" affectedLimbs={['LF']} />);
    expect(d.querySelector('svg')!.getAttribute('data-art')).toBe('raster');
    expect(d.querySelector('[data-active-pose]')!.getAttribute('data-active-pose')).toBe('lift-LF');
    expect([...d.querySelectorAll('[data-raised="true"]')].map((e) => e.getAttribute('data-limb'))).toEqual(['LF']);
    expect(patientTargets('犬', '瑪爾濟斯', 'fore-lift', ['LF']).limbs.LF).toEqual(CHARACTER_ART[0].limbBoxes['lift-LF']!.LF);
  });

  it('pose plan: single raised limb lifts it; bilateral, asymptomatic and unknown sides stay seated', () => {
    const plan = (id: string) => {
      const c = caseById(id)!;
      const a = limbsFromSide(c.side);
      return posePlan(raisedLimbs(c.pose, a), a);
    };
    expect(plan('C07')).toEqual({ rest: 'lift-LF', withdraw: 'withdraw-LF' });
    expect(plan('C03')).toEqual({ rest: 'lift-RH', withdraw: 'withdraw-RH' });
    expect(plan('C06')).toEqual({ rest: 'sit', withdraw: null }); // bilateral: no forced one-sided lift
    expect(plan('C05').rest).toBe('sit'); // asymptomatic
    expect(posePlan([], [])).toEqual({ rest: 'sit', withdraw: null }); // unknown side
  });

  it('anatomical sides are fixed: patient-left limbs sit on the screen right in every pose', () => {
    for (const a of CHARACTER_ART) {
      expect(a.screenRight).toBe('patient-left');
      for (const boxes of Object.values(a.limbBoxes)) {
        expect(boxes!.LF.x).toBeGreaterThan(boxes!.RF.x);
        expect(boxes!.LH.x).toBeGreaterThan(boxes!.RH.x);
      }
      // every pose has hit boxes and all poses share one canvas
      for (const k of Object.keys(a.poses)) expect(a.limbBoxes[k as keyof typeof a.limbBoxes]).toBeTruthy();
      expect(a.canvas).toEqual({ width: 1020, height: 1140 });
    }
  });

  it('the PNG checker script expects exactly the files the manifests load', async () => {
    const fsModule = 'node:fs';
    const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as { readFileSync: (p: string, enc: string) => string };
    const py = readFileSync('scripts/check_patient_assets.py', 'utf8');
    for (const a of CHARACTER_ART) {
      const files = Object.values(a.poses).map((f) => `"${f}"`).join(', ');
      expect(py).toContain(`"${a.dir}": {"canvas": (${a.canvas.width}, ${a.canvas.height}), "baseline_y": ${a.baseline.y}, "poses": [${files}]}`);
    }
    for (const s of Object.values(SCENE_SLOTS)) expect(py).toContain(`"${s.file}": {"canvas": (${s.canvas.width}, ${s.canvas.height})`);
  });

  it('scene targets follow whichever art is drawn', () => {
    const v = patientTargets('犬', '瑪爾濟斯', 'fore-lift', ['LF'], null);
    expect(v.art).toBe('vector');
    const r = patientTargets('犬', '瑪爾濟斯', 'fore-lift', ['LF'], fixture(ALL));
    expect(r.art).toBe('raster');
    expect(r.limbs.LF).toEqual(CHARACTER_ART[0].limbBoxes['lift-LF']!.LF);
  });
});

describe('PatientView raster mode', () => {
  let root: Root;
  let el: HTMLElement;
  beforeEach(() => {
    vi.useFakeTimers();
    el = document.createElement('div');
    document.body.appendChild(el);
    root = createRoot(el);
  });
  afterEach(() => {
    act(() => root.unmount());
    el.remove();
    vi.useRealTimers();
  });
  const render = (trigger: number, extra: Partial<Parameters<typeof PatientView>[0]> = {}) =>
    act(() => root.render(<PatientView species="犬" breed="瑪爾濟斯" pose="fore-lift" affectedLimbs={['LF']} palpationTrigger={trigger} art={fixture(ALL)} {...extra} />));
  const svg = () => el.querySelector('[data-testid="patient-view"]')!;
  const active = () => el.querySelector('[data-active-pose]')!.getAttribute('data-active-pose');

  it('C07 rests on the lifted-LF pose, with both poses preloaded on one canvas', () => {
    render(0);
    expect(svg().getAttribute('data-art')).toBe('raster');
    expect(active()).toBe('lift-LF');
    const imgs = [...el.querySelectorAll('image[data-pose]')];
    expect(imgs.map((i) => i.getAttribute('data-pose'))).toEqual(['lift-LF', 'withdraw-LF']);
    for (const i of imgs) expect([i.getAttribute('x'), i.getAttribute('y'), i.getAttribute('width'), i.getAttribute('height')]).toEqual(['0', '0', '340', '380']);
    expect(el.querySelector('[data-limb="LF"]')!.getAttribute('data-raised')).toBe('true');
    expect(el.querySelector('[data-layer="contact-shadow"]')).not.toBeNull();
  });

  it('a palpation swaps to the withdrawal pose once, then returns; rapid triggers never queue', () => {
    render(0);
    render(1);
    expect(active()).toBe('withdraw-LF');
    act(() => vi.advanceTimersByTime(WITHDRAW_MS - 100));
    render(2); // a second trigger restarts the same timer
    act(() => vi.advanceTimersByTime(WITHDRAW_MS - 1));
    expect(active()).toBe('withdraw-LF');
    act(() => vi.advanceTimersByTime(1));
    expect(active()).toBe('lift-LF');
    act(() => vi.advanceTimersByTime(5000));
    expect(active()).toBe('lift-LF'); // nothing left queued
  });

  it('mounting with an old trigger (case switch / remount) does not replay', () => {
    render(3);
    expect(active()).toBe('lift-LF');
  });

  it('unmounting mid-withdrawal clears the timer', () => {
    render(0);
    render(1);
    act(() => root.unmount());
    expect(vi.getTimerCount()).toBe(0);
    root = createRoot(el);
  });

  it('reduced motion: no pose swap, a static outline cue instead', () => {
    render(0, { reducedMotion: true });
    render(1, { reducedMotion: true });
    expect(active()).toBe('lift-LF');
    expect(el.querySelector('[data-limb="LF"] [data-testid="palpation-static-cue"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="palpation-cue"]')!.textContent).toContain('教學示意');
  });

  it('missing resting pose → vector fallback (no mixing, no broken image)', () => {
    render(0, { art: fixture({ 'maltese/sit.png': PNG }) }); // C07 needs lift-LF
    expect(svg().getAttribute('data-art')).toBe('vector');
    expect(el.querySelector('image')).toBeNull();
  });

  it('missing withdrawal pose keeps the rest pose and never shows an empty frame', () => {
    render(0, { art: fixture({ 'maltese/lift-LF.png': PNG }) });
    render(1, { art: fixture({ 'maltese/lift-LF.png': PNG }) });
    expect(active()).toBe('lift-LF');
    expect(el.querySelectorAll('image[data-pose]')).toHaveLength(1);
  });

  it('bilateral case on raster art stays seated', () => {
    render(0, { pose: 'sit-stiff', affectedLimbs: ['LH', 'RH'] });
    expect(active()).toBe('sit');
  });
});

describe('case portraits', () => {
  it('every case has a painted portrait; a missing one falls back to the vector patient', async () => {
    const { portraitFor, CasePortrait } = await import('../src/components/CasePortrait');
    const { cases } = await import('../src/data');
    for (const c of cases) expect(portraitFor(c.id)).not.toBeNull();
    expect(portraitFor('C99')).toBeNull();
    const html = renderToStaticMarkup(<CasePortrait caseId="C99" species="犬" breed="測試" size={100} fallback={<span data-testid="vector" />} />);
    expect(html).toContain('data-testid="vector"');
    const img = renderToStaticMarkup(<CasePortrait caseId="C07" species="犬" breed="瑪爾濟斯" size={100} fallback={null} />);
    expect(img).toContain('alt="瑪爾濟斯（犬）病例頭像，教學插畫"');
  });
});
