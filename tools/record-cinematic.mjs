// Dev-only: records REAL gameplay of /play/ in headless Chrome for the cinematic launch trailer.
// All recordings are 1280x720 or smaller. Per-frame state (score, state, bird height, flaps) is logged
// so the trailer script can cut on real events (score streaks, sky changes, crashes, medals).
// Output (git-ignored): test-output/cinematic/{run,crash,phone,zh}.webm + events.json
// Run: node tools/record-cinematic.mjs
import { chromium, devices } from 'playwright-core';
import { mkdirSync, writeFileSync, renameSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { startServer } from './serve.mjs';

const OUT = 'test-output/cinematic';
// node tools/record-cinematic.mjs [session ...]  records only the named sessions and merges them into events.json
const ONLY = process.argv.slice(2);
if (!ONLY.length) rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/raw`, { recursive: true });
const server = await startServer(0);
const BASE = `http://127.0.0.1:${server.port}/play/`;
const browser = await chromium.launch({ channel: 'chrome' });

const POLLER = () => {
  window.__log = [];
  const tick = () => {
    const p = window.__puffling;
    if (p) window.__log.push({ wall: Date.now(), state: p.state, score: p.score, flaps: p.flaps, y: Math.round(p.birdY), w: Math.round(p.viewW) });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

async function session(name, ctxOpts, run) {
  if (ONLY.length && !ONLY.includes(name)) return null;
  const ctx = await browser.newContext({ ...ctxOpts, recordVideo: { dir: `${OUT}/raw`, size: ctxOpts.viewport } });
  await ctx.addInitScript(POLLER);
  await ctx.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  const page = await ctx.newPage();
  const videoStart = Date.now();
  await page.goto(BASE);
  await page.waitForFunction(() => window.__puffling && document.documentElement.classList.contains('booted'));
  const marks = {};
  const mark = (k) => { marks[k] = +((Date.now() - videoStart) / 1000).toFixed(3); };
  await run(page, mark);
  // thin the per-frame log: keep changes of state/score/flaps and every 4th frame for the bird height
  const raw = await page.evaluate(() => window.__log);
  const log = raw.filter((e, i) => i % 4 === 0 || i === 0 || e.state !== raw[i - 1].state || e.score !== raw[i - 1].score || e.flaps !== raw[i - 1].flaps)
    .map(({ wall, ...e }) => ({ t: +((wall - videoStart) / 1000).toFixed(3), ...e }));
  const video = page.video();
  await ctx.close();
  renameSync(await video.path(), `${OUT}/${name}.webm`);
  console.log('recorded', name, JSON.stringify(marks));
  return { name, viewport: ctxOpts.viewport, marks, log };
}
const waitScore = (page, n, timeout) => page.waitForFunction((x) => window.__puffling.score >= x, n, { timeout, polling: 50 });
const waitState = (page, s, timeout = 15000) => page.waitForFunction((x) => window.__puffling.state === x, s, { timeout, polling: 50 });
// Crash on purpose: stop the autopilot and flap hard so the puffin slams into an upper column (thud, shake, flash).
async function slam(page, mark) {
  await page.evaluate(() => window.__puffling.setAutopilot(false)); mark('slamStart');
  for (let i = 0; i < 12; i++) {
    if (await page.evaluate(() => window.__puffling.state) !== 'playing') break;
    await page.keyboard.press('Space'); await page.waitForTimeout(110);
  }
  await page.waitForFunction(() => ['dying', 'over'].includes(window.__puffling.state), null, { timeout: 15000, polling: 20 }); mark('hit');
  await waitState(page, 'over'); mark('over');
}

const sessions = [];
// 1) the long run: menu, all four skies (dawn, day, sunset, night) and on to the platinum medal at 50, then a crash
sessions.push(await session('run', { viewport: { width: 1280, height: 720 }, locale: 'en-US' }, async (page, mark) => {
  await page.waitForTimeout(2500); mark('menuEnd');
  await page.click('#btn-play'); await waitState(page, 'ready'); await page.waitForTimeout(600);
  await page.keyboard.press('Space'); mark('playing');
  await page.evaluate(() => window.__puffling.setAutopilot(true));
  for (const n of [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 52]) { await waitScore(page, n, 120000); mark('score' + n); }
  await slam(page, mark);
  await page.waitForTimeout(4000); mark('end');
}));
// 2) a short dramatic crash run
sessions.push(await session('crash', { viewport: { width: 1280, height: 720 }, locale: 'en-US' }, async (page, mark) => {
  await page.waitForTimeout(800);
  await page.keyboard.press('Space'); await waitState(page, 'ready');
  await page.keyboard.press('Space'); mark('playing');
  await page.evaluate(() => window.__puffling.setAutopilot(true));
  await waitScore(page, 7, 60000); mark('score7');
  await slam(page, mark);
  await page.waitForTimeout(3000); mark('end');
}));
// 3) phone portrait (iPhone 13 emulation in Chromium, real taps)
sessions.push(await session('phone', { ...devices['iPhone 13'], locale: 'en-US' }, async (page, mark) => {
  await page.waitForTimeout(1500); mark('menuEnd');
  await page.tap('#btn-play'); await waitState(page, 'ready'); await page.waitForTimeout(500);
  await page.touchscreen.tap(195, 400); mark('playing');
  await page.evaluate(() => window.__puffling.setAutopilot(true));
  await waitScore(page, 8, 60000); mark('score8');
  await page.evaluate(() => window.__puffling.setAutopilot(false));
  await waitState(page, 'over'); mark('over');
  await page.waitForTimeout(2500); mark('end');
}));
// 4) Chinese locale: menu, play, Chinese game-over panel
sessions.push(await session('zh', { viewport: { width: 1280, height: 720 }, locale: 'zh-CN' }, async (page, mark) => {
  await page.waitForTimeout(2500); mark('menuEnd');
  await page.click('#btn-play'); await waitState(page, 'ready'); await page.waitForTimeout(500);
  await page.keyboard.press('Space'); mark('playing');
  await page.evaluate(() => window.__puffling.setAutopilot(true));
  await waitScore(page, 11, 60000); mark('score11');
  await slam(page, mark);
  await page.waitForTimeout(3000); mark('end');
}));
// 5) "Get ready" hover at dawn, then the first flap
sessions.push(await session('ready', { viewport: { width: 1280, height: 720 }, locale: 'en-US' }, async (page, mark) => {
  await page.waitForTimeout(600);
  await page.click('#btn-play'); await waitState(page, 'ready'); mark('ready');
  await page.waitForTimeout(3200); await page.keyboard.press('Space'); mark('firstFlap');
  await page.evaluate(() => window.__puffling.setAutopilot(true));
  await waitScore(page, 3, 30000); mark('score3'); await page.waitForTimeout(500); mark('end');
}));
// 6) phone portrait with the Chinese UI
sessions.push(await session('phonezh', { ...devices['iPhone 13'], locale: 'zh-CN' }, async (page, mark) => {
  await page.waitForTimeout(1500); mark('menuEnd');
  await page.tap('#btn-play'); await waitState(page, 'ready'); await page.waitForTimeout(500);
  await page.touchscreen.tap(195, 400); mark('playing');
  await page.evaluate(() => window.__puffling.setAutopilot(true));
  await waitScore(page, 6, 60000); mark('score6'); mark('end');
}));
// 7) a run to 31 (gold medal) that ends in a crash: hit, splash, gold medal + New best
sessions.push(await session('gold', { viewport: { width: 1280, height: 720 }, locale: 'en-US' }, async (page, mark) => {
  await page.waitForTimeout(500);
  await page.keyboard.press('Space'); await waitState(page, 'ready');
  await page.keyboard.press('Space'); mark('playing');
  await page.evaluate(() => window.__puffling.setAutopilot(true));
  await waitScore(page, 31, 120000); mark('score31');
  await slam(page, mark);
  await page.waitForTimeout(3500); mark('end');
}));
const kept = sessions.filter(Boolean);
let all = kept;
if (ONLY.length && existsSync(`${OUT}/events.json`)) {
  const old = JSON.parse(readFileSync(`${OUT}/events.json`, 'utf8')).sessions.filter((s) => !ONLY.includes(s.name));
  all = [...old, ...kept];
}
writeFileSync(`${OUT}/events.json`, JSON.stringify({ sessions: all }, null, 1));
await browser.close();
await server.close();
console.log('RECORDED_OK');
