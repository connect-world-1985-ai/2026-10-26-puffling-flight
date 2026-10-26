// Unit tests for the pure modules. Run: node --test tests/unit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { C } from '../play/src/config.js';
import {
  createSim, setView, resetRun, startPlay, flap, step, circleRect, levelParams, medalFor,
  autopilotShouldFlap, pillarGapY,
} from '../play/src/sim.js';
import { STRINGS, detectLang, t, htmlLang } from '../play/src/i18n.js';
import { loadSave, writeSave, SAVE_KEY } from '../play/src/storage.js';

const fakeStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };

test('string tables: same keys, no empty strings, Chinese is Chinese', () => {
  const en = Object.keys(STRINGS.en).sort(), zh = Object.keys(STRINGS.zh).sort();
  assert.deepEqual(zh, en);
  for (const lang of ['en', 'zh']) for (const k of en) assert.ok(STRINGS[lang][k].trim().length > 0, `${lang}.${k} empty`);
  const cjk = /[一-鿿]/;
  const sameOnPurpose = new Set(['langNameEn', 'langNameZh', 'langToggle']);
  for (const k of en) if (!sameOnPurpose.has(k)) assert.ok(cjk.test(STRINGS.zh[k]), `zh.${k} has no Chinese characters`);
});

test('every data-i18n key used in index.html exists', () => {
  const html = readFileSync(new URL('../play/index.html', import.meta.url), 'utf8');
  const keys = [...html.matchAll(/data-i18n(?:-aria)?="(\w+)"/g)].map((m) => m[1]);
  assert.ok(keys.length >= 30, `only ${keys.length} keys found`);
  for (const k of keys) assert.ok(k in STRINGS.en, `missing key ${k}`);
});

test('language detection and formatting', () => {
  assert.equal(detectLang(null, ['zh-CN']), 'zh');
  assert.equal(detectLang(null, ['zh-TW', 'en']), 'zh');
  assert.equal(detectLang(null, ['fr-FR', 'zh-CN']), 'zh');
  assert.equal(detectLang(null, ['en-GB', 'zh-CN']), 'en');
  assert.equal(detectLang(null, ['de-DE']), 'en');
  assert.equal(detectLang(null, []), 'en');
  assert.equal(detectLang(null, undefined), 'en');
  assert.equal(detectLang('en', ['zh-CN']), 'en');
  assert.equal(detectLang('zh', ['en-US']), 'zh');
  assert.equal(detectLang('xx', ['zh']), 'zh');
  assert.equal(t('en', 'announceOver', { score: 3, best: 9 }), 'Game over. Score 3. Best 9.');
  assert.equal(t('zh', 'announceOver', { score: 3, best: 9 }), '游戏结束。得分 3，最高分 9。');
  assert.equal(htmlLang('zh'), 'zh-Hans');
  assert.equal(htmlLang('en'), 'en');
});

test('storage: round trip, corrupt data, blocked storage', () => {
  const s = fakeStorage();
  assert.equal(loadSave(s).best, 0);
  assert.ok(writeSave({ best: 12, lang: 'zh', muted: true, sfx: false, music: true, reduceMotion: null }, s));
  assert.deepEqual(loadSave(s), { best: 12, lang: 'zh', muted: true, sfx: false, music: true, reduceMotion: null });
  s.setItem(SAVE_KEY, '{not json');
  assert.equal(loadSave(s).best, 0);
  s.setItem(SAVE_KEY, JSON.stringify({ best: -4, lang: 'fr', muted: 'yes' }));
  assert.deepEqual(loadSave(s), { best: 0, lang: null, muted: false, sfx: true, music: true, reduceMotion: null });
  const blocked = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceededError'); } };
  assert.equal(loadSave(blocked).best, 0);
  assert.equal(writeSave({ best: 1 }, blocked), false);
});

test('flap physics: rise height and apex time', () => {
  const sim = createSim(1); setView(sim, 400); resetRun(sim); startPlay(sim);
  sim.bird.y = 400; flap(sim);
  let minY = 400, tMin = 0;
  for (let i = 1; i <= 120; i++) { step(sim, C.STEP, 'play'); if (sim.bird.y < minY) { minY = sim.bird.y; tMin = i * C.STEP; } }
  const expected = (C.FLAP_V * C.FLAP_V) / (2 * C.GRAVITY);
  assert.ok(Math.abs(400 - minY - expected) < 4, `rise ${400 - minY} vs ${expected}`);
  assert.ok(Math.abs(tMin + C.FLAP_V / C.GRAVITY) < 0.02, `apex at ${tMin}`);
});

test('fall speed is capped and the sea ends the run', () => {
  const sim = createSim(2); setView(sim, 400); resetRun(sim); startPlay(sim);
  let res = null, maxV = 0;
  for (let i = 0; i < 600 && res !== 'dead'; i++) { res = step(sim, C.STEP, 'play'); maxV = Math.max(maxV, sim.bird.vy); }
  assert.equal(res, 'dead');
  assert.ok(sim.landed);
  assert.ok(maxV <= C.MAX_FALL + 1e-9);
  assert.ok(sim.events.includes('splash'));
});

test('circle vs rectangle collision', () => {
  assert.equal(circleRect(0, 0, 10, 5, -5, 10, 10), true);
  assert.equal(circleRect(0, 0, 10, 11, -5, 10, 10), false);
  assert.equal(circleRect(0, 0, 10, 7.2, 7.2, 10, 10), false);
  assert.equal(circleRect(0, 0, 10, 7, 7, 10, 10), true);
});

test('difficulty ramps monotonically and stays inside limits', () => {
  let prev = levelParams(0);
  assert.equal(prev.gap, C.GAP_START); assert.equal(prev.speed, C.SPEED_START);
  for (let s = 1; s <= 120; s++) {
    const p = levelParams(s);
    assert.ok(p.speed >= prev.speed && p.gap <= prev.gap && p.spacing <= prev.spacing);
    assert.ok(p.gap >= C.GAP_END && p.speed <= C.SPEED_END && p.moveAmp <= C.MOVE_AMP_MAX);
    prev = p;
  }
  assert.equal(levelParams(24).moveAmp, 0);
  assert.ok(levelParams(25).moveAmp > 0);
});

test('medals', () => {
  assert.equal(medalFor(9), null);
  assert.equal(medalFor(10), 'bronze');
  assert.equal(medalFor(20), 'silver');
  assert.equal(medalFor(30), 'gold');
  assert.equal(medalFor(50), 'platinum');
});

function runBot(seed, viewW, targetScore, maxSeconds) {
  const sim = createSim(seed); setView(sim, viewW); resetRun(sim, seed); startPlay(sim);
  const gaps = [];
  const steps = Math.round(maxSeconds / C.STEP);
  for (let i = 0; i < steps; i++) {
    if (autopilotShouldFlap(sim)) flap(sim);
    const before = sim.score;
    if (step(sim, C.STEP, 'play') === 'dead') return { sim, dead: true, gaps };
    if (sim.score !== before) assert.equal(sim.score, before + 1, 'score jumped by more than 1');
    for (const p of sim.pillars) {
      if (!p.active) continue;
      const gy = pillarGapY(p, sim.time);
      assert.ok(gy - p.gap / 2 >= C.GAP_MARGIN_TOP - 1e-6, 'gap too high');
      assert.ok(gy + p.gap / 2 <= C.GROUND_Y - C.GAP_MARGIN_BOTTOM + 1e-6, 'gap too low');
    }
    sim.events.length = 0;
    if (sim.score >= targetScore) return { sim, dead: false, gaps };
  }
  return { sim, dead: false, gaps };
}

test('the game is beatable: a simple bot reaches 120 points on every screen width', () => {
  for (const viewW of [270, 360, 540, 720]) {
    for (let seed = 1; seed <= 8; seed++) {
      const { sim, dead } = runBot(seed * 7919 + viewW, viewW, 120, 900);
      assert.ok(!dead && sim.score >= 120, `bot died at score ${sim.score} (seed ${seed}, width ${viewW})`);
    }
  }
});

test('deterministic for the same seed and inputs', () => {
  const a = runBot(42, 360, 30, 120).sim, b = runBot(42, 360, 30, 120).sim;
  assert.equal(a.score, b.score);
  assert.equal(a.bird.y, b.bird.y);
  assert.equal(a.scroll, b.scroll);
});

test('hover mode never spawns columns or kills the bird', () => {
  const sim = createSim(5); setView(sim, 360); resetRun(sim);
  for (let i = 0; i < 1200; i++) assert.equal(step(sim, C.STEP, 'hover'), null);
  assert.equal(sim.pillars.filter((p) => p.active).length, 0);
});
