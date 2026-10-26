// Builder's acceptance checks (in addition to the plan's tests/e2e.mjs), headless Chrome via playwright-core.
// Covers the website at / and the game at /play/, desktop + Chrome phone emulation, locales, audio, trailer.
// Run: node verify/acceptance.mjs                      (local server on a random port)
//      SITE_BASE_URL=https://.../ node verify/acceptance.mjs   (live site)
// Writes verify/results-<local|live>.json and screenshots to media/ (website) and verify/shots-<label>/.
import { chromium, devices } from 'playwright-core';
import { mkdirSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { startServer } from '../tools/serve.mjs';

const LIVE = process.env.SITE_BASE_URL || '';
const label = LIVE ? 'live' : 'local';
const server = LIVE ? null : await startServer(0);
const ROOT = LIVE ? LIVE.replace(/\/?$/, '/') : `http://127.0.0.1:${server.port}/`;
const GAME = ROOT + 'play/';
const SHOTS = `verify/shots-${label}`;
mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const results = { label, root: ROOT, browser: `chrome ${browser.version()}`, started: new Date().toISOString(), checks: [] };
console.log(`acceptance ${label} at ${ROOT} (${results.browser})`);

async function check(id, name, fn) {
  const r = { id, name };
  try { r.detail = (await fn()) || undefined; r.pass = true; }
  catch (e) { r.pass = false; r.error = String(e && e.message || e).split('\n')[0]; }
  results.checks.push(r);
  console.log(`${r.pass ? 'PASS' : 'FAIL'} ${id} ${name}${r.pass ? '' : ' :: ' + r.error}`);
}
const ok = (c, m) => { if (!c) throw new Error(m); };

async function open(url, ctxOpts = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US', ...ctxOpts });
  const page = await context.newPage();
  const errors = [], external = [], failed = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(ROOT) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
  // A <video preload=metadata> fetch that the browser itself cancels (net::ERR_ABORTED) is normal media behaviour, not a failure.
  page.on('requestfailed', (r) => { const f = r.failure(); if (r.resourceType() === 'media' && f && /ERR_ABORTED/.test(f.errorText)) return; failed.push(`${r.url()} ${f && f.errorText}`); });
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  await page.goto(url);
  return { context, page, errors, external, failed };
}
const bootGame = (page) => page.waitForFunction(() => window.__puffling && document.documentElement.classList.contains('booted'));
const G = (page, k) => page.evaluate((p) => window.__puffling[p], k);
const waitState = (page, s, timeout = 8000) => page.waitForFunction((x) => window.__puffling.state === x, s, { timeout });
const clean = (o) => { ok(o.errors.length === 0, 'console errors: ' + o.errors.join(' | ')); ok(o.external.length === 0, 'external requests: ' + o.external.join(' ')); ok(o.failed.length === 0, 'failed requests: ' + o.failed.join(' ')); };
const overflow = (page) => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, bw: document.body.scrollWidth }));

// ---------- static: self-contained website ----------
if (!LIVE) await check('W0', 'website + game are self-contained: no http(s):// or protocol-relative URLs in src/href/url()', async () => {
  const files = ['index.html', 'site.css', 'site.js', 'play/index.html', 'play/styles.css', 'play/src/main.js', 'play/src/render.js', 'play/src/audio.js', 'play/src/i18n.js', 'play/src/storage.js', 'play/src/config.js', 'play/src/sim.js'];
  const bad = [];
  for (const f of files) {
    const t = readFileSync(f, 'utf8');
    for (const m of t.matchAll(/https?:\/\/[^\s"'<>)]*/g)) bad.push(`${f}: ${m[0]}`);
    for (const m of t.matchAll(/(?:src|href|poster)\s*=\s*["']\/\/[^"']*/g)) bad.push(`${f}: ${m[0]}`);
    for (const m of t.matchAll(/url\(\s*["']?\/\/[^)]*\)/g)) bad.push(`${f}: ${m[0]}`);
    for (const m of t.matchAll(/(?:src|href|poster)\s*=\s*["']\/(?!\/)[^"']*/g)) bad.push(`${f} (root-absolute): ${m[0]}`);
  }
  ok(bad.length === 0, bad.join(' ; '));
  return { filesScanned: files.length };
});

// ---------- trailer file ----------
await check('V1', 'trailer: 30-45 s, 1280x720, h264 yuv420p + aac, <= 15 MB, faststart', async () => {
  const src = LIVE ? ROOT + 'media/trailer.mp4' : 'media/trailer.mp4';
  const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,width,height,pix_fmt', '-of', 'json', src]).toString());
  const v = j.streams.find((s) => s.codec_type === 'video'), a = j.streams.find((s) => s.codec_type === 'audio');
  const dur = +j.format.duration, size = +j.format.size;
  ok(dur >= 30 && dur <= 45, 'duration ' + dur);
  ok(v && v.codec_name === 'h264' && v.width === 1280 && v.height === 720 && v.pix_fmt === 'yuv420p', 'video ' + JSON.stringify(v));
  ok(a && a.codec_name === 'aac', 'audio ' + JSON.stringify(a));
  ok(size <= 15 * 1024 * 1024, 'size ' + size);
  if (!LIVE) { const head = readFileSync('media/trailer.mp4').subarray(0, 64).toString('latin1'); ok(head.indexOf('moov') > 0, 'moov atom not at start (no faststart)'); }
  return { duration: dur, size, video: `${v.codec_name} ${v.width}x${v.height} ${v.pix_fmt}`, audio: a.codec_name };
});

// ---------- website ----------
await check('W1', 'website desktop: loads clean, all sections, Play now -> ./play/, no horizontal overflow, images load', async () => {
  const o = await open(ROOT); const { page } = o;
  await page.waitForLoadState('networkidle');
  for (const sel of ['.hero', '#trailer video', '#screens .gallery', '#features .cards', '#how .steps']) ok(await page.$(sel), 'missing ' + sel);
  ok((await page.getAttribute('#play-now', 'href')) === './play/', 'play-now href');
  ok((await page.textContent('#play-now')) === 'Play now', 'play-now text');
  ok((await page.getAttribute('#trailer video', 'poster')) === 'media/trailer-poster.png', 'poster');
  const ov = await overflow(page); ok(ov.sw <= ov.iw, 'horizontal overflow ' + JSON.stringify(ov));
  await page.evaluate(async () => { for (const i of document.images) { i.loading = 'eager'; } window.scrollTo(0, document.body.scrollHeight); });
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${SHOTS}/site-desktop.png` });
  await page.screenshot({ path: `${SHOTS}/site-desktop-full.png`, fullPage: true });
  clean(o); await o.context.close();
  return { images: 'all loaded', overflow: ov };
});

await check('W2', 'website trailer plays in the page: readyState >= 3 and currentTime advances', async () => {
  const o = await open(ROOT + '#trailer'); const { page } = o;
  const r = await page.evaluate(async () => {
    const v = document.getElementById('trailer-video'); v.muted = true;
    await v.play();
    const t0 = v.currentTime;
    await new Promise((res) => setTimeout(res, 2000));
    return { readyState: v.readyState, t0, t1: v.currentTime, duration: v.duration, w: v.videoWidth, h: v.videoHeight, src: v.currentSrc.split('/').slice(-2).join('/') };
  });
  ok(r.readyState >= 3, 'readyState ' + r.readyState);
  ok(r.t1 > r.t0 + 0.5, `currentTime ${r.t0} -> ${r.t1}`);
  ok(r.w === 1280 && r.h === 720, 'video size');
  await page.screenshot({ path: `${SHOTS}/site-trailer-playing.png` });
  clean(o); await o.context.close();
  return r;
});

for (const [id, dev] of [['W3', 'Pixel 7'], ['W4', 'iPhone 13']]) {
  await check(id, `website phone (${dev}, Chromium emulation): no horizontal overflow, Play now visible and tappable`, async () => {
    const o = await open(ROOT, { ...devices[dev], locale: 'en-US' }); const { page } = o;
    await page.waitForLoadState('networkidle');
    const ov = await overflow(page); ok(ov.sw <= ov.iw && ov.bw <= ov.iw, 'horizontal overflow ' + JSON.stringify(ov));
    const box = await page.locator('#play-now').boundingBox(); ok(box && box.height >= 44 && box.x >= 0 && box.x + box.width <= ov.iw, 'play-now box ' + JSON.stringify(box));
    await page.screenshot({ path: `${SHOTS}/site-phone-${dev.replace(/ /g, '')}.png` });
    if (dev === 'Pixel 7') await page.screenshot({ path: `${SHOTS}/site-phone-full.png`, fullPage: true });
    await page.tap('#play-now');
    await page.waitForURL(/\/play\/$/); await bootGame(page);
    ok(await G(page, 'state') === 'menu', 'game not booted after tap');
    clean(o); await o.context.close();
    return { overflow: ov, playNowBox: box };
  });
}

await check('W5', 'website locales: en-US English; zh-CN / zh-TW / zh-HK Simplified Chinese', async () => {
  const seen = {};
  for (const loc of ['en-US', 'zh-CN', 'zh-TW', 'zh-HK']) {
    const o = await open(ROOT, { locale: loc }); const { page } = o;
    const l = await page.evaluate(() => window.__pufflingSite.lang);
    const h = await page.textContent('#hero-title span'); const html = await page.getAttribute('html', 'lang');
    seen[loc] = { lang: l, title: h, html };
    ok(loc.startsWith('zh') ? (l === 'zh' && h === '小海鹦飞飞' && html === 'zh-Hans') : (l === 'en' && h === 'Puffling Flight' && html === 'en'), loc + ' ' + JSON.stringify(seen[loc]));
    if (loc === 'zh-CN') await page.screenshot({ path: `${SHOTS}/site-desktop-zh.png` });
    clean(o); await o.context.close();
  }
  return seen;
});

await check('W6', 'website language toggle: switches instantly, persists after reload, and the game opens in the same language', async () => {
  const o = await open(ROOT, { locale: 'en-US' }); const { page } = o;
  await page.click('#lang-toggle');
  ok((await page.textContent('#play-now')) === '立即开玩', 'toggle to zh');
  await page.reload(); ok(await page.evaluate(() => window.__pufflingSite.lang) === 'zh', 'not persisted');
  await page.click('#play-now'); await page.waitForURL(/\/play\/$/); await bootGame(page);
  ok(await G(page, 'lang') === 'zh', 'game language ' + await G(page, 'lang'));
  await page.goto(ROOT); await page.click('#lang-toggle');
  ok((await page.textContent('#play-now')) === 'Play now', 'toggle back to en');
  // every data-i18n key exists in both tables
  const miss = await page.evaluate(() => { const s = window.__pufflingSite.strings; const keys = [...document.querySelectorAll('[data-i18n],[data-i18n-aria],[data-i18n-alt]')].flatMap((e) => [e.dataset.i18n, e.dataset.i18nAria, e.dataset.i18nAlt]).filter(Boolean); return keys.filter((k) => !(k in s.en) || !(k in s.zh)); });
  ok(miss.length === 0, 'missing keys ' + miss.join(','));
  const same = await page.evaluate(() => { const s = window.__pufflingSite.strings; return Object.keys(s.en).length === Object.keys(s.zh).length && Object.keys(s.en).every((k) => k in s.zh); });
  ok(same, 'en/zh key sets differ');
  clean(o); await o.context.close();
});

await check('W7', 'website Play now (desktop click) lands on /play/ and the game is playable', async () => {
  const o = await open(ROOT); const { page } = o;
  await page.click('#play-now'); await page.waitForURL(/\/play\/$/); await bootGame(page);
  await page.click('#btn-play'); await waitState(page, 'ready');
  await page.keyboard.press('Space'); await waitState(page, 'playing');
  clean(o); await o.context.close();
  return { url: 'play/' };
});

// ---------- game at /play/ ----------
await check('G1', 'game desktop: loads clean at /play/, English menu', async () => {
  const o = await open(GAME); const { page } = o; await bootGame(page);
  ok(await G(page, 'state') === 'menu', 'state'); ok((await page.textContent('#menu-title')) === 'Puffling Flight', 'title');
  await page.waitForTimeout(400); clean(o); await o.context.close();
});

await check('G2', 'game: start by mouse click, flap rises, columns scroll, score increments, collision -> game over, restart, best persists', async () => {
  const o = await open(GAME); const { page } = o; await bootGame(page);
  await page.click('#btn-play'); await waitState(page, 'ready');
  await page.mouse.click(640, 400); await waitState(page, 'playing');
  const y0 = await G(page, 'birdY'); await page.waitForTimeout(120); const y1 = await G(page, 'birdY');
  ok(y1 < y0, `flap did not rise ${y0} -> ${y1}`);
  await page.evaluate(() => window.__puffling.setAutopilot(true));
  await page.waitForFunction(() => window.__puffling.score >= 4, null, { timeout: 20000 });
  const score = await G(page, 'score');
  await page.evaluate(() => window.__puffling.setAutopilot(false));
  await waitState(page, 'over', 15000);
  ok(await page.isVisible('#screen-over'), 'game-over panel hidden');
  const overScore = +(await page.textContent('#over-score'));
  await page.screenshot({ path: `${SHOTS}/game-over-desktop.png` });
  await page.waitForTimeout(700);
  await page.click('#btn-again'); await waitState(page, 'ready');
  await page.mouse.click(640, 400); await waitState(page, 'playing');
  const best = await G(page, 'best');
  await page.reload(); await bootGame(page);
  const bestAfter = await G(page, 'best');
  ok(bestAfter === best && best >= score, `best ${best} -> ${bestAfter}`);
  clean(o); await o.context.close();
  return { scoreReached: score, overScore, bestAfterReload: bestAfter };
});

await check('G3', 'game: start with Space key, Space flaps, P pauses/resumes', async () => {
  const o = await open(GAME); const { page } = o; await bootGame(page);
  await page.keyboard.press('Space'); await waitState(page, 'ready');
  await page.keyboard.press('Space'); await waitState(page, 'playing');
  const f0 = await G(page, 'flaps'); await page.keyboard.press('Space'); await page.waitForTimeout(60);
  ok(await G(page, 'flaps') > f0, 'Space did not flap');
  await page.keyboard.press('p'); await waitState(page, 'paused');
  await page.keyboard.press('p'); await page.waitForFunction(() => ['resuming', 'playing'].includes(window.__puffling.state));
  clean(o); await o.context.close();
});

await check('G4', 'game audio: no audio before input; after a gesture AudioContext running + music rendered; M and button mute', async () => {
  const o = await open(GAME); const { page } = o; await bootGame(page);
  ok(['none', 'suspended'].includes(await G(page, 'audioState')), 'audio before input: ' + await G(page, 'audioState'));
  await page.click('#btn-play'); await page.waitForFunction(() => window.__puffling.musicReady, null, { timeout: 10000 });
  const st = await G(page, 'audioState'); ok(st === 'running', 'audio state ' + st);
  const ms = await G(page, 'audioRenderMs'); ok(ms > 0, 'render ms ' + ms);
  await page.keyboard.press('m'); ok(await G(page, 'muted') === true, 'M did not mute');
  await page.click('#btn-mute'); ok(await G(page, 'muted') === false, 'button did not unmute');
  clean(o); await o.context.close();
  return { audioState: st, audioRenderMs: Math.round(ms) };
});

await check('G5', 'game locales: en-US English; zh-CN / zh-TW / zh-HK Simplified Chinese; EN/中文 chip toggles', async () => {
  const seen = {};
  for (const loc of ['en-US', 'zh-CN', 'zh-TW', 'zh-HK']) {
    const o = await open(GAME, { locale: loc }); const { page } = o; await bootGame(page);
    const l = await G(page, 'lang'), t = await page.textContent('#menu-title');
    seen[loc] = { lang: l, title: t };
    ok(loc.startsWith('zh') ? (l === 'zh' && t === '小海鹦飞飞') : (l === 'en' && t === 'Puffling Flight'), loc + ' ' + JSON.stringify(seen[loc]));
    if (loc === 'zh-HK') { await page.click('#btn-lang'); ok(await G(page, 'lang') === 'en', 'chip toggle'); }
    clean(o); await o.context.close();
  }
  return seen;
});

for (const [id, dev] of [['G6', 'Pixel 7'], ['G7', 'iPhone 13']]) {
  await check(id, `game phone (${dev}, Chromium emulation): real touch taps start + flap, fits without scrolling, playable, game over + restart by tap`, async () => {
    const o = await open(GAME, { ...devices[dev], locale: 'en-US' }); const { page } = o; await bootGame(page);
    ok(await page.evaluate(() => matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0), 'not a touch profile');
    const vp = page.viewportSize();
    await page.tap('#btn-play'); await waitState(page, 'ready');
    await page.touchscreen.tap(vp.width / 2, vp.height / 2); await waitState(page, 'playing');
    const f0 = await G(page, 'flaps'); await page.touchscreen.tap(vp.width / 2, vp.height / 2); await page.waitForTimeout(80);
    ok(await G(page, 'flaps') > f0, 'tap did not flap');
    const dims = await page.evaluate(() => { const r = document.getElementById('stage').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight, stage: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] }; });
    ok(dims.sw <= dims.iw && dims.sh <= dims.ih, 'page scrolls ' + JSON.stringify(dims));
    await page.mouse.wheel(0, 400); ok(await page.evaluate(() => scrollY) === 0, 'scrolled');
    await page.evaluate(() => window.__puffling.setAutopilot(true));
    await page.waitForFunction(() => window.__puffling.score >= 3, null, { timeout: 20000 });
    await page.screenshot({ path: `${SHOTS}/game-phone-${dev.replace(/ /g, '')}.png` });
    await page.evaluate(() => window.__puffling.setAutopilot(false));
    await waitState(page, 'over', 15000); await page.waitForTimeout(700);
    await page.tap('#btn-again'); await waitState(page, 'ready');
    await page.touchscreen.tap(vp.width / 2, vp.height / 2); await waitState(page, 'playing');
    clean(o); await o.context.close();
    return dims;
  });
}

await browser.close();
if (server) await server.close();
results.finished = new Date().toISOString();
results.pass = results.checks.filter((c) => c.pass).length;
results.fail = results.checks.filter((c) => !c.pass).length;
writeFileSync(`verify/results-${label}.json`, JSON.stringify(results, null, 2) + '\n');
console.log(`SUMMARY acceptance=${label} pass=${results.pass} fail=${results.fail}`);
process.exit(results.fail ? 1 : 0);
