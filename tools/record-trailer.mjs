// Dev-only: records REAL gameplay of /play/ in headless Chrome for the launch trailer,
// and captures the game's own code-generated music and sound effects from src/audio.js.
// Output (git-ignored): test-output/trailer/{desktop.webm,phone.webm,zh.webm,events.json,*.wav}
// Run: node tools/record-trailer.mjs
import { chromium, devices } from 'playwright-core';
import { mkdirSync, writeFileSync, renameSync, readdirSync, rmSync } from 'node:fs';
import { startServer } from './serve.mjs';

const OUT = 'test-output/trailer';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/raw`, { recursive: true });
const server = await startServer(0);
const BASE = `http://127.0.0.1:${server.port}/play/`;
const browser = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });

// Polls the read-only test hook every animation frame and logs changes with wall-clock time.
const POLLER = () => {
  window.__log = [];
  const tick = () => {
    const p = window.__puffling;
    if (p) {
      const s = { state: p.state, score: p.score, flaps: p.flaps };
      const l = window.__last || {};
      if (s.state !== l.state || s.score !== l.score || s.flaps !== l.flaps) { window.__log.push({ wall: Date.now(), ...s }); window.__last = s; }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

async function session(name, ctxOpts, run) {
  const ctx = await browser.newContext({ ...ctxOpts, recordVideo: { dir: `${OUT}/raw`, size: ctxOpts.viewport } });
  await ctx.addInitScript(POLLER);
  await ctx.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  const page = await ctx.newPage();
  const videoStart = Date.now();
  await page.goto(BASE);
  await page.waitForFunction(() => window.__puffling && document.documentElement.classList.contains('booted'));
  const marks = {};
  const mark = (k) => { marks[k] = (Date.now() - videoStart) / 1000; };
  await run(page, mark);
  const log = (await page.evaluate(() => window.__log)).map((e) => ({ ...e, t: (e.wall - videoStart) / 1000 }));
  const video = page.video();
  await ctx.close();
  renameSync(await video.path(), `${OUT}/${name}.webm`);
  return { name, marks, log };
}

const waitScore = (page, n, timeout) => page.waitForFunction((x) => window.__puffling.score >= x, n, { timeout, polling: 100 });

const events = [];
// 1) Desktop 1280x720, English: menu, play with scripted (autopilot) input through all four sky palettes, crash, game over.
events.push(await session('desktop', { viewport: { width: 1280, height: 720 }, locale: 'en-US' }, async (page, mark) => {
  await page.waitForTimeout(3500); mark('menuEnd');
  await page.click('#btn-play'); mark('play');
  await page.waitForTimeout(900);
  await page.keyboard.press('Space'); mark('playing');
  await page.evaluate(() => window.__puffling.setAutopilot(true));
  for (const n of [10, 20, 30, 33]) { await waitScore(page, n, 120000); mark('score' + n); }
  await page.evaluate(() => window.__puffling.setAutopilot(false)); mark('autopilotOff');
  await page.waitForFunction(() => window.__puffling.state === 'over', null, { timeout: 15000 }); mark('over');
  await page.waitForTimeout(3500); mark('end');
}));
// 2) Phone portrait (iPhone 13 emulation in Chromium): real taps to start, then autopilot.
events.push(await session('phone', { ...devices['iPhone 13'], locale: 'en-US' }, async (page, mark) => {
  await page.waitForTimeout(1500); mark('menuEnd');
  await page.tap('#btn-play'); await page.waitForTimeout(600);
  await page.touchscreen.tap(200, 400); mark('playing');
  await page.evaluate(() => window.__puffling.setAutopilot(true));
  await page.waitForTimeout(7000); mark('end');
}));
// 3) Chinese locale menu and settings.
events.push(await session('zh', { viewport: { width: 1280, height: 720 }, locale: 'zh-CN' }, async (page, mark) => {
  await page.waitForTimeout(3000); mark('menuEnd');
  await page.click('#btn-settings-menu'); await page.waitForTimeout(2500); mark('end');
}));

// 4) Capture the game's own synthesised audio (src/audio.js renders it with OfflineAudioContext).
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(BASE);
const audio = await page.evaluate(async () => {
  const { GameAudio } = await import('./src/audio.js');
  const a = new GameAudio();
  a.setPrefs({ muted: true, sfx: true, music: true, reduceMotion: false });
  a.unlock();
  for (let i = 0; i < 200 && !a.musicBuffer; i++) await new Promise((r) => setTimeout(r, 50));
  const enc = (buf) => { const d = buf.getChannelData(0); const b = new Int16Array(d.length); for (let i = 0; i < d.length; i++) b[i] = Math.max(-1, Math.min(1, d[i])) * 32767; let s = ''; const u = new Uint8Array(b.buffer); for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode(...u.subarray(i, i + 32768)); return btoa(s); };
  const out = { sampleRate: a.ctx.sampleRate, music: enc(a.musicBuffer), sfx: {} };
  for (const [k, v] of a.buffers) out.sfx[k] = enc(v);
  return out;
});
await ctx.close();
function wav(path, b64, sr) {
  const pcm = Buffer.from(b64, 'base64');
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sr, 24);
  h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  writeFileSync(path, Buffer.concat([h, pcm]));
}
wav(`${OUT}/music.wav`, audio.music, audio.sampleRate);
for (const [k, v] of Object.entries(audio.sfx)) wav(`${OUT}/sfx-${k}.wav`, v, audio.sampleRate);
writeFileSync(`${OUT}/events.json`, JSON.stringify({ sampleRate: audio.sampleRate, sessions: events }, null, 1));
await browser.close();
await server.close();
console.log('RECORDED', readdirSync(OUT).join(' '));
