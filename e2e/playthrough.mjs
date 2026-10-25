// End-to-end playthrough of C01–C08 against the production build, served
// from a GitHub-Pages-style sub-path (/OrthoLab/). Run `npm run build` first.
//
//   node e2e/playthrough.mjs            (uses the pre-installed Playwright)
//
// Fails (exit 1) on any assertion error or unhandled console error.

import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const DIST = new URL('../dist/', import.meta.url).pathname;
const OUT = new URL('./output/', import.meta.url).pathname;
const BASE = '/OrthoLab/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}
await mkdir(OUT, { recursive: true });

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith(BASE)) {
    res.writeHead(404).end('not under sub-path');
    return;
  }
  let rel = normalize(url.pathname.slice(BASE.length)).replace(/^(\.\.[/\\])+/, '');
  if (rel === '' || rel === '.') rel = 'index.html';
  try {
    const body = await readFile(join(DIST, rel));
    res.writeHead(200, { 'content-type': TYPES[extname(rel)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('missing');
  }
});
await new Promise((r) => server.listen(0, r));
const ORIGIN = `http://localhost:${server.address().port}`;
const APP = `${ORIGIN}${BASE}`;

const errors = [];
const log = (...a) => console.log('  ', ...a);
let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.error('  ✗', msg);
  } else log('✓', msg);
}

function watch(page, label) {
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${label}] ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`[${label}] ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`[${label}] request failed ${r.url()}`));
  page.on('response', (r) => r.status() >= 400 && errors.push(`[${label}] HTTP ${r.status()} ${r.url()}`));
}

const tid = (id) => `[data-testid="${id}"]`;

async function revealAll(page, caseId) {
  for (let i = 1; i <= 4; i++) await page.click(tid(`exam-${caseId}-E${i}`));
}

async function deck(page) {
  // play every round: select correct cards, submit, next
  for (let round = 0; round < 5; round++) {
    const cards = page.locator('[data-correct]');
    await cards.first().waitFor();
    const n = await cards.count();
    for (let i = 0; i < n; i++) {
      const c = cards.nth(i);
      const correct = (await c.getAttribute('data-correct')) === 'y';
      const pressed = (await c.getAttribute('aria-pressed')) === 'true';
      if (correct !== pressed) await c.click();
    }
    await page.click(tid('deck-submit'));
    await page.click(tid('deck-next'));
    if (await page.locator('[aria-label="學習回饋"]').count()) return;
    if (!(await page.locator('[data-correct]').count())) return;
    const stillDeck = await page.locator(tid('deck-submit')).count();
    if (!stillDeck) return;
  }
}

async function scores(page) {
  await page.locator('[aria-label="學習回饋"]').waitFor();
  const tiles = await page.locator('.score-tile b').allTextContents();
  return tiles;
}

async function modelToScreen(page, pts) {
  return page.evaluate((pts) => {
    const g = document.querySelector('#model-root');
    const m = g.getScreenCTM();
    return pts.map((p) => ({ x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f }));
  }, pts);
}

async function t09(page, caseId, { drag = false } = {}) {
  const cfg = {
    C07: { primary: { theta: 14, dy: 1.2 }, secondary: { theta: -11, dy: -0.8 }, dx: -3, plate: 'c07-p12', moves: [5, 0.5], holes: [1, 3, 5, 9, 10, 11] },
    C08: { primary: { theta: 15, dy: 3 }, secondary: { theta: 0, dy: 1.5 }, dx: -12, plate: 'c08-p12', moves: [5, -0.5, -0.5, -0.5], holes: [0, 2, 4, 7, 9, 11] },
  }[caseId];
  const stage = page.locator(tid('t09-stage'));
  await stage.waitFor();
  // first check before reducing must fail (completion gating)
  await page.click(tid('t09-check'));
  assert((await page.locator('.banner.err').count()) > 0, `${caseId} T09 step 1 refuses completion before reduction`);

  const keyFix = async (view) => {
    const p = cfg[view];
    await page.click(tid(`view-${view}`));
    await stage.focus();
    const rot = Math.abs(p.theta);
    for (let i = 0; i < rot; i++) await page.keyboard.press(p.theta > 0 ? 'q' : 'e');
    let dy = p.dy;
    const key = dy > 0 ? 'ArrowUp' : 'ArrowDown';
    dy = Math.abs(dy);
    while (dy >= 0.5 - 1e-9) {
      await page.keyboard.press(key);
      dy -= 0.5;
    }
    while (dy >= 0.1 - 1e-9) {
      await page.keyboard.press(`Shift+${key}`);
      dy -= 0.1;
    }
  };

  if (drag) {
    // pointer path: drag the distal fragment +dx along the axis at 200% zoom, then fix the rest by keys
    await page.click('button:has-text("200%")');
    await page.locator('[data-testid="t09-fragment-hit"] rect').evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' }));
    // a point inside the displaced distal fragment: local (fx + 25, 0) → rotate about pivot → translate
    const fx = 50;
    const th = (cfg.primary.theta * Math.PI) / 180;
    const grab = { x: fx + 25 * Math.cos(th) + cfg.dx, y: 25 * Math.sin(th) + cfg.primary.dy };
    const [a, b] = await modelToScreen(page, [grab, { x: grab.x - cfg.dx, y: grab.y }]);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    for (let k = 1; k <= 10; k++) await page.mouse.move(a.x + ((b.x - a.x) * k) / 10, a.y);
    await page.mouse.up();
    const axial = await page.locator('.hud tr', { hasText: '軸向位移誤差' }).locator('td').nth(1).textContent();
    assert(/^0\.\d\d mm/.test(axial.trim()) && parseFloat(axial) < 0.6, `${caseId} pointer drag at 200% zoom moved fragment to axial error ${axial.trim()}`);
    await page.click('button:has-text("100%")');
    // undo the remaining axial residue with keys if needed
  } else {
    await stage.focus();
    for (let i = 0; i < Math.abs(cfg.dx) / 0.5; i++) await page.keyboard.press('ArrowRight');
  }
  await keyFix('primary');
  await keyFix('secondary');
  // fine-correct any axial residue left by dragging
  for (let k = 0; k < 10; k++) {
    const txt = await page.locator('.hud tr', { hasText: '軸向位移誤差' }).locator('td').nth(1).textContent();
    if (/PASS|PERFECT/.test(txt)) break;
    await stage.focus();
    await page.keyboard.press('Shift+ArrowRight');
  }
  await page.click(tid('t09-check'));
  await page.locator(tid('clamp-px-top')).waitFor();
  // clamp on plate path must be rejected
  await page.click(tid('clamp-px-top'));
  await page.click(tid('clamp-ds-bot'));
  await page.click(tid('t09-check'));
  assert((await page.locator('.banner.err', { hasText: '骨板預定路徑' }).count()) > 0, `${caseId} clamp on plate path rejected`);
  await page.click(tid('clamp-px-bot'));
  await page.click(tid('t09-check'));
  await page.click(tid(`plate-${cfg.plate}`));
  await page.click(tid('plate-tension'));
  for (const mv of cfg.moves) await page.click(tid(`plate-move-${mv}`));
  await page.click(tid('t09-check'));
  await page.locator(tid('hole-0')).waitFor();
  for (const h of cfg.holes) {
    await page.click(tid(`hole-${h}`));
    await page.click(tid('drill'));
    const g = parseFloat(await page.locator(tid('gauge-reading')).textContent());
    const lens = await page.locator('[data-testid^="len-"]').evaluateAll((els) => els.map((e) => Number(e.dataset.testid.slice(4))));
    const len = lens.filter((l) => l >= g && l <= g + 2).sort((x, y) => x - y)[0];
    await page.click(tid(`len-${len}`));
  }
  // duplicate click on a locked hole cannot add purchase
  const before = await page.locator('.hud tr', { hasText: '近端有效皮質' }).textContent();
  await page.click(tid(`hole-${cfg.holes[0]}`));
  assert((await page.locator(tid('drill')).count()) === 0, `${caseId} locked hole offers no second drill/lock`);
  const after = await page.locator('.hud tr', { hasText: '近端有效皮質' }).textContent();
  assert(before === after, `${caseId} re-clicking a locked hole does not change purchase (${after.trim()})`);
  await page.click(tid(`hole-${cfg.holes[0]}`)); // deselect
  await page.click(tid('t09-check'));
  await page.locator(tid('final-view-secondary')).waitFor();
  assert((await page.locator(tid('confirm-reduction')).isDisabled()), `${caseId} final checks locked until both views seen`);
  await page.click(tid('final-view-secondary'));
  await page.click(tid('final-view-primary'));
  for (const c of ['reduction', 'alignment', 'implant', 'purchase']) await page.click(tid(`confirm-${c}`));
  await page.screenshot({ path: `${OUT}/${caseId}-t09-final.png`, fullPage: true });
  await page.click(tid('t09-check'));
}

async function startCase(page, caseId) {
  await page.goto(`${APP}#/cases`);
  await page.click(tid(`start-${caseId}`));
  if (await page.locator(tid('confirm-new')).count()) await page.click(tid('confirm-new'));
  await page.locator('[aria-label="檢查區"]').waitFor();
}

async function proceedWith(page, optionId) {
  await page.click(tid(`option-${optionId}`));
  await page.click(tid('proceed'));
}

const browser = await chromium.launch();

// ---------------- desktop playthrough ----------------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  watch(page, 'desktop');
  await page.goto(APP);
  assert(await page.locator(tid('ack')).isVisible(), 'first visit shows the short teaching-simulation notice');
  await page.click(tid('ack'));
  await page.reload();
  assert((await page.locator(tid('ack')).count()) === 0, 'notice does not reappear after acknowledgement');

  // C01: premature decision, prerequisite lock, insufficient, preferred → TPLO
  console.log('C01');
  await startCase(page, 'C01');
  assert(await page.locator(tid('exam-C01-E2')).isDisabled(), 'C01-E2 locked until C01-E1');
  await page.click(tid('option-A01'));
  assert((await page.getAttribute(tid('verdict'), 'data-outcome')) === 'missing-clues', 'premature decision → 條件不足 (missing clues)');
  await revealAll(page, 'C01');
  await page.click(tid('option-A03'));
  assert((await page.getAttribute(tid('verdict'), 'data-outcome')) === 'insufficient', 'A03 TTA → 條件不足');
  assert((await page.locator(tid('proceed')).count()) === 0, 'insufficient option cannot proceed');
  await page.click(tid('option-A04'));
  assert((await page.getAttribute(tid('verdict'), 'data-outcome')) === 'unsuitable', 'A04 → 不適合');
  await page.click(tid('option-A02'));
  assert((await page.getAttribute(tid('verdict'), 'data-outcome')) === 'alternative', 'A02 → 可接受替代');
  await proceedWith(page, 'A01');
  await page.click(tid('plan-wrong-side'));
  await page.click(tid('tplo-check'));
  await page.click(tid('plan-correct'));
  await page.click(tid('tplo-check'));
  await page.click(tid('tplo-place-saw'));
  await page.click(tid('tplo-cut'));
  for (let i = 0; i < 20; i++) await page.click(tid('tplo-rot-plus'));
  await page.click(tid('tplo-check'));
  await page.click(tid('tplo-seat-plate'));
  await page.click(tid('tplo-hole-3'));
  for (const h of [0, 1, 2, 4, 5, 6]) await page.click(tid(`tplo-hole-${h}`));
  await page.click(tid('tplo-check'));
  await page.click(tid('q-side-一致'));
  await page.click(tid('q-implant-符合'));
  await page.click(tid('q-next-進入術後照護與追蹤'));
  await page.screenshot({ path: `${OUT}/C01-tplo.png`, fullPage: true });
  await page.click(tid('tplo-check'));
  await deck(page);
  let sc = await scores(page);
  log('C01 scores', sc.join(' / '));
  assert(sc[1] === '0', 'C01 reasoning keeps first scored choice (A04 = 0), not the later preferred one');
  await page.screenshot({ path: `${OUT}/C01-results.png`, fullPage: true });

  // C02: alternative route (explanation only, no fake operation)
  console.log('C02');
  await startCase(page, 'C02');
  await revealAll(page, 'C02');
  await proceedWith(page, 'A06');
  await page.locator(tid('explain-finish')).waitFor();
  assert((await page.locator('svg[aria-label*="TPLO"]').count()) === 0, 'ECS explanation route shows no operation screen');
  await page.click(tid('explain-finish'));
  sc = await scores(page);
  log('C02 scores', sc.join(' / '));
  assert(sc[1] === '80' && sc[2] === '不適用', 'C02 alternative: reasoning 80, operation 不適用');

  // C03 FHNE
  console.log('C03');
  await startCase(page, 'C03');
  await revealAll(page, 'C03');
  await proceedWith(page, 'A09');
  await page.click(tid('fhne-left-head'));
  await page.click(tid('fhne-head-neck'));
  await page.locator(tid('fhne-cut-range')).fill('65');
  await page.click(tid('fhne-execute'));
  await page.locator(tid('fhne-rom')).fill('80');
  await page.click(tid('fhne-spur'));
  await page.click(tid('fhne-smooth'));
  await page.locator(tid('fhne-rom')).fill('100');
  await page.click(tid('fhne-check3'));
  assert((await page.locator('svg [data-testid^="hole-"]').count()) === 0, 'FHNE has no plate/screw holes');
  await page.screenshot({ path: `${OUT}/C03-fhne.png`, fullPage: true });
  await page.click(tid('fhne-route-rehab'));
  await deck(page);
  sc = await scores(page);
  log('C03 scores', sc.join(' / '));

  // C04 MPL
  console.log('C04');
  await startCase(page, 'C04');
  await revealAll(page, 'C04');
  await proceedWith(page, 'A13');
  for (const x of ['groove', 'tuberosity', 'patella']) await page.click(tid(`mpl-${x}`));
  await page.click(tid('mpl-check'));
  await page.click(tid('mpl-proc-sulcoplasty'));
  await page.click(tid('mpl-check'));
  assert((await page.locator('.banner.err', { hasText: '脛骨粗隆轉位' }).count()) > 0, 'MPL combo without TTT rejected (C04 needs both)');
  await page.click(tid('mpl-proc-ttt'));
  await page.click(tid('mpl-check'));
  await page.locator(tid('mpl-depth')).fill('70');
  await page.locator(tid('mpl-tt')).fill('80');
  await page.click(tid('mpl-check'));
  await page.locator(tid('mpl-flex')).fill('100');
  await page.click(tid('mplq-track-是'));
  await page.click(tid('mplq-stable-已確認'));
  await page.screenshot({ path: `${OUT}/C04-mpl.png`, fullPage: true });
  await page.click(tid('mpl-check'));
  await deck(page);
  sc = await scores(page);
  log('C04 scores', sc.join(' / '));

  // C05 / C06 non-surgical, different decks
  const deckTexts = {};
  for (const [cid, opt] of [
    ['C05', 'A17'],
    ['C06', 'A21'],
  ]) {
    console.log(cid);
    await startCase(page, cid);
    await revealAll(page, cid);
    await proceedWith(page, opt);
    deckTexts[cid] = await page.locator('[data-correct="y"] b').allTextContents();
    await page.screenshot({ path: `${OUT}/${cid}-plan.png`, fullPage: true });
    await deck(page);
    sc = await scores(page);
    log(`${cid} scores`, sc.join(' / '));
    assert(sc[2] === '不適用' && sc[3] !== '不適用', `${cid}: operation 不適用 (no penalty), care scored`);
  }
  assert(!deckTexts.C05.some((t) => deckTexts.C06.includes(t)), 'C05 and C06 management cards differ');

  // C07 T09 (keyboard) with reload mid-way to verify resume
  console.log('C07');
  await startCase(page, 'C07');
  await revealAll(page, 'C07');
  await page.click(tid('option-A30'));
  assert((await page.getAttribute(tid('verdict'), 'data-outcome')) === 'unsuitable', 'A30 splint → 不適合 (and not routed to extracapsular screen)');
  assert((await page.locator(tid('proceed')).count()) === 0, 'splint option offers no module');
  await proceedWith(page, 'A29');
  await page.reload();
  assert(await page.locator(tid('t09-stage')).isVisible(), 'reload resumes inside T09');
  await t09(page, 'C07');
  await deck(page);
  sc = await scores(page);
  log('C07 scores', sc.join(' / '));
  await page.screenshot({ path: `${OUT}/C07-results.png`, fullPage: true });

  // C08 T09 with pointer drag + zoom; A34 must be 條件不足
  console.log('C08');
  await startCase(page, 'C08');
  await revealAll(page, 'C08');
  await page.click(tid('option-A34'));
  assert((await page.getAttribute(tid('verdict'), 'data-outcome')) === 'insufficient', 'A34 IM pin + cerclage → 條件不足／待審閱');
  await proceedWith(page, 'A33');
  await t09(page, 'C08', { drag: true });
  await deck(page);
  sc = await scores(page);
  log('C08 scores', sc.join(' / '));
  assert(sc[1] === '100', 'C08 reasoning: A34 (null) not counted, A33 counted 100');

  // results persist; practice does not overwrite first
  await page.goto(`${APP}#/cases`);
  const c01 = await page.locator(tid('case-C01')).textContent();
  assert(/首次紀錄/.test(c01), 'case list shows stored first record for C01');

  // pages render
  for (const r of ['kb', 'refs', 'settings', 'about']) {
    await page.goto(`${APP}#/${r}`);
    await page.locator('h1').first().waitFor();
    if (r === 'refs') assert((await page.locator(tid('ref-R13')).textContent()).includes('章節／頁碼待確認'), 'R13 marked chapter/page pending');
    await page.screenshot({ path: `${OUT}/page-${r}.png`, fullPage: false });
  }

  // corrupted save must not crash
  await page.evaluate(() => localStorage.setItem('ortholab:save', '{"version":2,"session":'));
  await page.reload();
  assert((await page.locator('.banner.warn', { hasText: '損壞' }).count()) === 1, 'corrupt save → recovery banner, app still renders');
  await ctx.close();
}

// ---------------- touch / mobile ----------------
{
  console.log('touch');
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  watch(page, 'touch');
  await page.goto(APP);
  await page.tap(tid('ack'));
  await page.goto(`${APP}#/cases`);
  await page.tap(tid('start-C07'));
  for (let i = 1; i <= 4; i++) await page.tap(tid(`exam-C07-E${i}`));
  await page.tap(tid('option-A29'));
  await page.tap(tid('proceed'));
  await page.locator(tid('t09-stage')).waitFor();
  // touch drag via pointer events on the fragment
  await page.locator('[data-testid="t09-fragment-hit"] rect').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  // C07 initial pose: θ 14°, dy 1.2, dx −3 → a point 15 mm into the distal fragment
  const th = (14 * Math.PI) / 180;
  const grab = { x: 56 + 15 * Math.cos(th) - 3, y: 15 * Math.sin(th) + 1.2 };
  const [a, b] = await modelToScreen(page, [grab, { x: grab.x + 3, y: grab.y }]);
  // real touch drag through the Chrome DevTools protocol (touch → pointer events)
  const hit = await page.evaluate((p) => {
    const el = document.elementFromPoint(p.x, p.y);
    return el ? `${el.tagName} ${el.closest('[data-testid]')?.getAttribute('data-testid')}` : 'none';
  }, a);
  assert(hit.includes('t09-fragment-hit'), `touch point lands on the fragment (${hit})`);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
  await touch('touchStart', a);
  for (let k = 1; k <= 8; k++) await touch('touchMove', { x: a.x + ((b.x - a.x) * k) / 8, y: a.y });
  await touch('touchEnd');
  const axial = await page.locator('.hud tr', { hasText: '軸向位移誤差' }).locator('td').nth(1).textContent();
  assert(parseFloat(axial) < 0.5, `touch drag moved fragment (axial ${axial.trim()})`);
  await page.tap('button[aria-label="順時針旋轉 1 度"]');
  await page.screenshot({ path: `${OUT}/touch-t09.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(overflow <= 1, `no horizontal page scroll on phone width (overflow ${overflow}px)`);
  await ctx.close();
}

await browser.close();
server.close();

if (errors.length) {
  console.error('Console / page errors:');
  for (const e of errors) console.error('  ', e);
}
console.log(failures || errors.length ? `FAILED: ${failures} assertion(s), ${errors.length} console error(s)` : 'ALL E2E CHECKS PASSED');
process.exit(failures || errors.length ? 1 : 0);
