// End-to-end browser tests. Run: node tests/e2e.mjs
// env PW_BROWSER=chrome|msedge|chromium|firefox|webkit (default chrome)
// env E2E_BASE_URL=https://.../  tests a published copy instead of starting the local server
import { chromium, firefox, webkit, devices } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { startServer } from '../tools/serve.mjs';

const which = process.env.PW_BROWSER || 'chrome';
const LAUNCH = {
  chrome: () => chromium.launch({ channel: 'chrome' }),
  msedge: () => chromium.launch({ channel: 'msedge' }),
  chromium: () => chromium.launch(),
  firefox: () => firefox.launch(),
  webkit: () => webkit.launch(),
};
if (!LAUNCH[which]) { console.error(`Unknown PW_BROWSER=${which}`); process.exit(2); }
const isChromium = ['chrome', 'msedge', 'chromium'].includes(which);
const supportsMobile = which !== 'firefox';
const OUT = `test-output/${which}`;
mkdirSync(OUT, { recursive: true });

const LIVE = process.env.E2E_BASE_URL || '';
const server = LIVE ? null : await startServer(0);
const BASE = LIVE ? LIVE.replace(/\/?$/, '/') : `http://127.0.0.1:${server.port}/play/`;
const browser = await LAUNCH[which]();
console.log(`browser ${which} ${browser.version()} at ${BASE}`);

let passed = 0, failed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log(`PASS ${name}`); }
  catch (e) { failed++; console.log(`FAIL ${name} :: ${String(e && e.message || e).split('\n')[0]}`); }
}
function ok(cond, msg) { if (!cond) throw new Error(msg); }

async function open({ query = '', locale = 'en-US', ctxOpts = {}, ctx = null } = {}) {
  const context = ctx || await browser.newContext({ viewport: { width: 1280, height: 720 }, locale, ...ctxOpts });
  const page = await context.newPage();
  const errors = [], external = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', (r) => { if (!r.url().startsWith(BASE)) external.push(r.url()); });
  await page.goto(BASE + query);
  await page.waitForFunction(() => window.__puffling && document.documentElement.classList.contains('booted'));
  return { context, page, errors, external };
}
const G = (page, prop) => page.evaluate((p) => window.__puffling[p], prop);
const waitState = (page, s, timeout = 5000) => page.waitForFunction((x) => window.__puffling.state === x, s, { timeout });
const visible = (page, sel) => page.isVisible(sel);

await check('T01 desktop loads clean: no errors, no external requests, English menu', async () => {
  const { context, page, errors, external } = await open();
  await page.waitForTimeout(500);
  ok(await G(page, 'state') === 'menu', 'not in menu');
  ok(await visible(page, '#screen-menu'), 'menu not visible');
  ok((await page.textContent('#menu-title')) === 'Puffling Flight', 'title text');
  ok((await page.getAttribute('html', 'lang')) === 'en', 'html lang');
  ok((await page.title()).startsWith('Puffling Flight'), 'document title');
  await page.screenshot({ path: `${OUT}/01-menu-en.png` });
  ok(errors.length === 0, 'errors: ' + errors.join(' | '));
  ok(external.length === 0, 'external requests: ' + external.join(' '));
  await context.close();
});

await check('T02 keyboard flow: Space -> ready -> playing, flap rises, held key = one flap, audio unlocks', async () => {
  const { context, page, errors } = await open();
  await page.keyboard.press('Space');
  await waitState(page, 'ready');
  ok(await visible(page, '#screen-ready'), 'ready screen hidden');
  await page.screenshot({ path: `${OUT}/02-ready.png` });
  const f0 = await G(page, 'flaps');
  await page.keyboard.down('Space');
  await page.keyboard.down('Space'); // auto-repeat
  await page.keyboard.up('Space');
  await waitState(page, 'playing');
  ok((await G(page, 'flaps')) - f0 === 1, 'held key produced more than one flap');
  const y0 = await G(page, 'birdY');
  await page.waitForTimeout(120);
  ok((await G(page, 'birdY')) < y0, 'bird did not rise after flap');
  const audioState = await G(page, 'audioState');
  ok(audioState !== 'none', 'no AudioContext was created on the first key press');
  // Headless Firefox/WebKit on Linux servers often have no audio device, so their context can stay
  // 'suspended'; Chromium must reach 'running'. Real-browser audio is checked by hand in Step 13.
  if (isChromium) ok(audioState === 'running', 'audio context not running: ' + audioState);
  else console.log(`  note: ${which} AudioContext state = ${audioState}`);
  await page.waitForFunction(() => window.__puffling.musicReady, null, { timeout: 5000 });
  ok(errors.length === 0, 'errors: ' + errors.join(' | '));
  await context.close();
});

await check('T03 no input -> crash -> game-over panel, score 0, restart lockout', async () => {
  const { context, page } = await open();
  await page.click('#btn-play');
  await waitState(page, 'ready');
  await page.mouse.click(640, 400);
  await waitState(page, 'playing');
  await waitState(page, 'over', 6000);
  ok(await visible(page, '#screen-over'), 'game-over panel hidden');
  ok((await page.textContent('#over-score')) === '0', 'score not 0');
  await page.keyboard.press('Space'); // within the 600 ms lockout: must not restart
  await page.waitForTimeout(100);
  ok(await G(page, 'state') === 'over', 'restarted during lockout');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/03-over.png` });
  await page.waitForTimeout(700);
  await page.keyboard.press('Space');
  await waitState(page, 'ready');
  await context.close();
});

await check('T04 autopilot scores, pause freezes the world, resume counts down, best persists after reload', async () => {
  const { context, page } = await open({ query: '?autopilot=1' });
  await page.keyboard.press('Space');
  await waitState(page, 'ready');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__puffling.score >= 3, null, { timeout: 30000 });
  await page.screenshot({ path: `${OUT}/04-playing.png` });
  await page.keyboard.press('p');
  await waitState(page, 'paused');
  ok(await visible(page, '#screen-pause'), 'pause screen hidden');
  const y1 = await G(page, 'birdY'), s1 = await G(page, 'score');
  await page.waitForTimeout(800);
  ok(await G(page, 'birdY') === y1 && await G(page, 'score') === s1, 'world moved while paused');
  await page.screenshot({ path: `${OUT}/05-paused.png` });
  await page.keyboard.press('p');
  await waitState(page, 'resuming', 1000);
  await waitState(page, 'playing', 2000);
  await page.waitForFunction(() => window.__puffling.score >= 5, null, { timeout: 30000 });
  await page.evaluate(() => window.__puffling.setAutopilot(false));
  await waitState(page, 'over', 8000);
  const best = await G(page, 'best');
  ok(best >= 5, 'best not updated: ' + best);
  ok(await visible(page, '#new-best'), 'new best badge hidden');
  await page.waitForTimeout(400); // let the panel pop-in animation finish
  await page.screenshot({ path: `${OUT}/06-over-best.png` });
  await page.reload();
  await page.waitForFunction(() => document.documentElement.classList.contains('booted'));
  ok(Number(await page.textContent('#menu-best')) === best, 'best not shown after reload');
  await context.close();
});

await check('T05 mute toggle (M key and button) persists', async () => {
  const { context, page } = await open();
  await page.keyboard.press('m');
  ok(await G(page, 'muted') === true, 'not muted');
  ok((await page.getAttribute('#btn-mute', 'aria-pressed')) === 'true', 'aria-pressed not true');
  await page.reload();
  await page.waitForFunction(() => document.documentElement.classList.contains('booted'));
  ok(await G(page, 'muted') === true, 'mute not persisted');
  await page.click('#btn-mute');
  ok(await G(page, 'muted') === false, 'button did not unmute');
  await context.close();
});

await check('T06 Chinese browser -> Chinese UI; toggle to English; choice survives reload', async () => {
  const { context, page } = await open({ locale: 'zh-CN' });
  ok(await G(page, 'lang') === 'zh', 'lang not zh');
  ok((await page.textContent('#menu-title')) === '小海鹦飞飞', 'zh title');
  ok((await page.getAttribute('html', 'lang')) === 'zh-Hans', 'html lang zh-Hans');
  ok((await page.textContent('#btn-play')) === '开始', 'zh play button');
  await page.screenshot({ path: `${OUT}/07-menu-zh.png` });
  await page.click('#btn-lang');
  ok((await page.textContent('#menu-title')) === 'Puffling Flight', 'did not switch to English');
  await page.reload();
  await page.waitForFunction(() => document.documentElement.classList.contains('booted'));
  ok(await G(page, 'lang') === 'en', 'saved language not used after reload');
  await context.close();
});

await check('T07 every text node from the table is filled in both languages', async () => {
  for (const locale of ['en-US', 'zh-CN']) {
    const { context, page } = await open({ locale });
    const empty = await page.evaluate(() => [...document.querySelectorAll('[data-i18n]')].filter((e) => !e.textContent.trim()).map((e) => e.dataset.i18n));
    ok(empty.length === 0, `${locale} empty: ${empty.join(',')}`);
    const noAria = await page.evaluate(() => [...document.querySelectorAll('[data-i18n-aria]')].filter((e) => !e.getAttribute('aria-label')).length);
    ok(noAria === 0, `${locale} missing aria-labels`);
    await context.close();
  }
});

await check('T08 settings: toggles, language buttons, Escape closes', async () => {
  const { context, page } = await open();
  await page.click('#btn-settings-menu');
  ok(await visible(page, '#screen-settings'), 'settings hidden');
  await page.click('#set-music');
  ok((await page.getAttribute('#set-music', 'aria-checked')) === 'false', 'music switch');
  await page.click('#set-lang-zh');
  ok((await page.textContent('#settings-title')) === '设置', 'settings title not zh');
  await page.screenshot({ path: `${OUT}/08-settings-zh.png` });
  await page.click('#set-lang-en');
  await page.click('#btn-reset-best');
  ok((await page.textContent('#btn-reset-best')) === 'Tap again to confirm', 'reset confirm text');
  await page.keyboard.press('Escape');
  ok(!(await visible(page, '#screen-settings')) && await visible(page, '#screen-menu'), 'Escape did not close settings');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('puffling-flight.v1')));
  ok(saved.music === false && saved.lang === 'en', 'settings not saved: ' + JSON.stringify(saved));
  await context.close();
});

await check('T09 hidden tab auto-pauses', async () => {
  const { context, page } = await open();
  await page.keyboard.press('Space'); await waitState(page, 'ready');
  await page.keyboard.press('Space'); await waitState(page, 'playing');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await waitState(page, 'paused', 1000);
  await context.close();
});

await check('T10 layouts: small, wide and very wide windows keep the whole stage on screen', async () => {
  for (const [w, h] of [[800, 600], [1920, 1080], [2560, 1080], [1024, 1366]]) {
    const { context, page, errors } = await open({ ctxOpts: { viewport: { width: w, height: h } } });
    const box = await page.evaluate(() => { const r = document.getElementById('stage').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, sx: scrollX, sy: scrollY }; });
    ok(box.x >= -1 && box.y >= -1 && box.x + box.w <= w + 1 && box.y + box.h <= h + 1, `stage off screen at ${w}x${h}: ${JSON.stringify(box)}`);
    ok(box.h >= Math.min(h, 640) * 0.9 || box.w >= w - 2, `stage too small at ${w}x${h}`);
    ok(box.sx === 0 && box.sy === 0, 'page scrolled');
    await page.screenshot({ path: `${OUT}/10-layout-${w}x${h}.png` });
    ok(errors.length === 0, 'errors: ' + errors.join(' | '));
    await context.close();
  }
});

if (isChromium) {
  await check('T11 performance: 60 fps and frame work budget (normal and 4x CPU throttle)', async () => {
    const { context, page } = await open({ query: '?autopilot=1' });
    await page.keyboard.press('Space'); await waitState(page, 'ready');
    await page.keyboard.press('Space'); await waitState(page, 'playing');
    const measure = async () => {
      await page.evaluate(() => window.__puffling.perf.reset());
      await page.waitForTimeout(4000);
      return page.evaluate(() => {
        const p = window.__puffling.perf;
        const n = Math.min(p.i, p.work.length);
        const w = Array.from(p.work.slice(0, n)).sort((a, b) => a - b);
        return { fps: p.frames / 4, p95: w[Math.floor(n * 0.95)] || 0, max: w[n - 1] || 0 };
      });
    };
    const normal = await measure();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const slow = await measure();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    console.log(`  perf normal fps=${normal.fps.toFixed(1)} p95=${normal.p95.toFixed(2)}ms max=${normal.max.toFixed(2)}ms | 4x throttle fps=${slow.fps.toFixed(1)} p95=${slow.p95.toFixed(2)}ms`);
    ok(normal.fps >= 55, 'fps below 55');
    ok(normal.p95 <= 4, 'p95 frame work above 4 ms');
    ok(slow.p95 <= 12, 'p95 frame work above 12 ms at 4x throttle');
    await context.close();
  });
}

if (supportsMobile) {
  await check('T12 phone portrait (iPhone 13 profile): tap to play, full-bleed, no scroll, pause button works', async () => {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'en-US' });
    const { page, errors } = await open({ ctx });
    const vp = page.viewportSize();
    const box = await page.evaluate(() => { const r = document.getElementById('stage').getBoundingClientRect(); return { w: r.width, h: r.height }; });
    ok(Math.abs(box.w - vp.width) <= 1 && Math.abs(box.h - vp.height) <= 1, `not full-bleed: ${JSON.stringify(box)} vs ${JSON.stringify(vp)}`);
    ok((await page.textContent('#menu-hint')) === 'Tap anywhere to flap', 'touch hint not shown');
    await page.screenshot({ path: `${OUT}/12-phone-menu.png` });
    await page.touchscreen.tap(vp.width / 2, vp.height * 0.45);
    await waitState(page, 'ready');
    await page.touchscreen.tap(vp.width / 2, vp.height * 0.45);
    await waitState(page, 'playing');
    await page.screenshot({ path: `${OUT}/13-phone-playing.png` });
    const pb = await page.locator('#btn-pause').boundingBox();
    ok(pb && pb.width >= 44 && pb.height >= 44, 'pause button smaller than 44 px');
    await page.touchscreen.tap(pb.x + pb.width / 2, pb.y + pb.height / 2);
    await waitState(page, 'paused', 2000);
    const flapsBefore = await G(page, 'flaps');
    await page.touchscreen.tap(vp.width / 2, vp.height * 0.2);
    ok(await G(page, 'flaps') === flapsBefore, 'tap while paused flapped');
    const scroll = await page.evaluate(() => ({ y: scrollY, sh: document.documentElement.scrollHeight, ih: innerHeight }));
    ok(scroll.y === 0 && scroll.sh <= scroll.ih + 1, 'page can scroll: ' + JSON.stringify(scroll));
    ok(errors.length === 0, 'errors: ' + errors.join(' | '));
    await ctx.close();
  });

  await check('T13 phone landscape (Pixel 7 profile) and Chinese locale', async () => {
    const d = devices['Pixel 7 landscape'] || devices['Pixel 5 landscape'];
    const ctx = await browser.newContext({ ...d, locale: 'zh-CN' });
    const { page, errors } = await open({ ctx });
    const vp = page.viewportSize();
    const box = await page.evaluate(() => { const r = document.getElementById('stage').getBoundingClientRect(); return { x: r.x, w: r.width, h: r.height }; });
    ok(Math.abs(box.h - vp.height) <= 1 && box.x >= 0 && box.x + box.w <= vp.width + 1, 'landscape layout: ' + JSON.stringify(box));
    ok((await page.textContent('#menu-hint')) === '轻触屏幕任意位置振翅', 'zh touch hint');
    await page.screenshot({ path: `${OUT}/14-phone-landscape-zh.png` });
    ok(errors.length === 0, 'errors: ' + errors.join(' | '));
    await ctx.close();
  });
}

await browser.close();
if (server) await server.close();
console.log(`SUMMARY browser=${which} pass=${passed} fail=${failed}`);
process.exit(failed ? 1 : 0);
