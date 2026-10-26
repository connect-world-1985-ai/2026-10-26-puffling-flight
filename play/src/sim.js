// Pure game simulation: no DOM, no timers, deterministic for a given seed and input sequence.
import { C } from './config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;

export function difficulty(score) {
  const t = clamp(score / C.DIFF_FULL_SCORE, 0, 1);
  return t * t * (3 - 2 * t);
}

export function levelParams(score, out = {}) {
  const d = difficulty(score);
  out.speed = lerp(C.SPEED_START, C.SPEED_END, d);
  out.gap = lerp(C.GAP_START, C.GAP_END, d);
  out.spacing = lerp(C.SPACING_START, C.SPACING_END, d);
  out.maxRise = lerp(C.MAX_RISE_START, C.MAX_RISE_END, d);
  out.maxDrop = lerp(C.MAX_DROP_START, C.MAX_DROP_END, d);
  out.moveAmp = score >= C.MOVE_FROM_SCORE
    ? Math.min(C.MOVE_AMP_MAX, (score - C.MOVE_FROM_SCORE + 1) * C.MOVE_AMP_STEP) : 0;
  return out;
}

export function medalFor(score) {
  for (const [min, name] of C.MEDALS) if (score >= min) return name;
  return null;
}

function newPillar() {
  return { active: false, x: 0, gapY: 0, gap: 0, amp: 0, phase: 0, passed: false };
}

export function createSim(seed = 1) {
  const sim = {
    rng: mulberry32(seed),
    viewW: 360, birdX: 108,
    bird: { y: C.BIRD_HOVER_Y, prevY: C.BIRD_HOVER_Y, vy: 0 },
    pillars: [],
    scroll: 0, prevScroll: 0, nextSpawnX: 0, lastGapY: 0, lastAmp: 0,
    score: 0, time: 0, landed: false, hitPillar: false, flaps: 0,
    params: levelParams(0),
    events: [],
  };
  for (let i = 0; i < 12; i++) sim.pillars.push(newPillar());
  return sim;
}

export function setView(sim, viewW) {
  sim.viewW = viewW;
  sim.birdX = clamp(Math.round(viewW * C.BIRD_X_FRAC), C.BIRD_X_MIN, C.BIRD_X_MAX);
}

export function resetRun(sim, seed) {
  if (seed !== undefined) sim.rng = mulberry32(seed);
  for (const p of sim.pillars) p.active = false;
  sim.bird.y = sim.bird.prevY = C.BIRD_HOVER_Y;
  sim.bird.vy = 0;
  sim.score = 0;
  sim.landed = false;
  sim.hitPillar = false;
  levelParams(0, sim.params);
  sim.lastGapY = (C.GAP_MARGIN_TOP + C.GROUND_Y - C.GAP_MARGIN_BOTTOM) / 2;
  sim.lastAmp = 0;
  sim.events.length = 0;
}

export function startPlay(sim) {
  sim.nextSpawnX = sim.scroll + Math.max(sim.viewW + 40, sim.birdX + C.FIRST_PILLAR_LEAD);
}

export function flap(sim) {
  sim.bird.vy = C.FLAP_V;
  sim.flaps++;
  sim.events.push('flap');
}

export function pillarGapY(p, time) {
  return p.amp ? p.gapY + Math.sin(time * C.MOVE_SPEED + p.phase) * p.amp : p.gapY;
}

function spawnPillar(sim) {
  let p = null;
  for (const q of sim.pillars) if (!q.active) { p = q; break; }
  if (!p) { p = newPillar(); sim.pillars.push(p); }
  const prm = sim.params;
  const amp = prm.moveAmp > 0 && sim.rng() < 0.5 ? prm.moveAmp : 0;
  const lo = C.GAP_MARGIN_TOP + prm.gap / 2 + amp;
  const hi = C.GROUND_Y - C.GAP_MARGIN_BOTTOM - prm.gap / 2 - amp;
  const slack = amp + sim.lastAmp; // bobbing columns use up part of the allowed change
  const from = Math.max(lo, sim.lastGapY - prm.maxRise + slack);
  const to = Math.min(hi, sim.lastGapY + prm.maxDrop - slack);
  const y = from <= to ? from + sim.rng() * (to - from) : clamp(sim.lastGapY, lo, hi);
  p.active = true;
  p.x = sim.nextSpawnX;
  p.gapY = y;
  p.gap = prm.gap;
  p.amp = amp;
  p.phase = sim.rng() * Math.PI * 2;
  p.passed = false;
  sim.lastGapY = y;
  sim.lastAmp = amp;
  sim.nextSpawnX += prm.spacing;
}

export function circleRect(cx, cy, r, x, y, w, h) {
  const nx = cx < x ? x : cx > x + w ? x + w : cx;
  const ny = cy < y ? y : cy > y + h ? y + h : cy;
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

export function hitsPillar(sim) {
  const cx = sim.scroll + sim.birdX, cy = sim.bird.y, r = C.BIRD_R;
  const W = C.PILLAR_W, O = C.CAP_OVER, CH = C.CAP_H;
  for (const p of sim.pillars) {
    if (!p.active) continue;
    if (cx + r < p.x - O || cx - r > p.x + W + O) continue;
    const gy = pillarGapY(p, sim.time);
    const top = gy - p.gap / 2, bot = gy + p.gap / 2;
    if (circleRect(cx, cy, r, p.x, -1000, W, top + 1000)) return true;            // upper column
    if (circleRect(cx, cy, r, p.x - O, top - CH, W + 2 * O, CH)) return true;      // upper cap
    if (circleRect(cx, cy, r, p.x, bot, W, C.GROUND_Y - bot + 100)) return true;   // lower column
    if (circleRect(cx, cy, r, p.x - O, bot, W + 2 * O, CH)) return true;           // lower cap
  }
  return false;
}

// Advances the world by dt seconds. mode: 'hover' (menu / get ready), 'play', 'fall' (after a hit).
// Returns 'dead' on the step the bird crashes in 'play' mode.
export function step(sim, dt, mode) {
  const b = sim.bird;
  b.prevY = b.y;
  sim.prevScroll = sim.scroll;
  sim.time += dt;

  if (mode === 'hover') {
    sim.scroll += C.SPEED_START * dt;
    b.vy = 0;
    b.y = C.BIRD_HOVER_Y + Math.sin(sim.time * 5) * 7;
    return null;
  }

  if (mode === 'fall') {
    if (sim.landed) return null;
    b.vy = Math.min(b.vy + C.GRAVITY * dt, C.MAX_FALL);
    b.y += b.vy * dt;
    if (b.y >= C.GROUND_Y - C.BIRD_R * 0.3) {
      b.y = C.GROUND_Y - C.BIRD_R * 0.3;
      sim.landed = true;
      sim.events.push('splash');
    }
    return null;
  }

  const prm = sim.params;
  sim.scroll += prm.speed * dt;
  b.vy = Math.min(b.vy + C.GRAVITY * dt, C.MAX_FALL);
  b.y += b.vy * dt;
  if (b.y < C.BIRD_R) { b.y = C.BIRD_R; if (b.vy < 0) b.vy = 0; }

  while (sim.nextSpawnX - sim.scroll < sim.viewW + 40) spawnPillar(sim);

  const bx = sim.scroll + sim.birdX;
  for (const p of sim.pillars) {
    if (!p.active) continue;
    if (p.x + C.PILLAR_W + C.CAP_OVER < sim.scroll - 20) { p.active = false; continue; }
    if (!p.passed && p.x + C.PILLAR_W / 2 < bx) {
      p.passed = true;
      sim.score++;
      levelParams(sim.score, sim.params);
      sim.events.push('score');
    }
  }

  if (hitsPillar(sim)) {
    sim.hitPillar = true;
    sim.events.push('hit');
    return 'dead';
  }
  if (b.y + C.BIRD_R >= C.GROUND_Y) {
    b.y = C.GROUND_Y - C.BIRD_R * 0.3;
    sim.landed = true;
    sim.events.push('splash');
    return 'dead';
  }
  return null;
}

// Simple bot used by the tests (and by ?autopilot=1). It flaps when the bird drops below a target height:
// as low as is safe in the current gap, nudged towards the next gap while the bird is between the columns.
export function autopilotShouldFlap(sim) {
  const b = sim.bird, bx = sim.scroll + sim.birdX, r = C.BIRD_R;
  const rise = (C.FLAP_V * C.FLAP_V) / (2 * C.GRAVITY);
  const apexT = -C.FLAP_V / C.GRAVITY;
  let cur = null, next = null;
  for (const p of sim.pillars) {
    if (!p.active || p.x + C.PILLAR_W + C.CAP_OVER < bx - r) continue;
    if (!cur || p.x < cur.x) { next = cur; cur = p; } else if (!next || p.x < next.x) next = p;
  }
  if (!cur) return b.y > C.BIRD_HOVER_Y && b.vy > 0;
  const window = (p) => {
    const g0 = pillarGapY(p, sim.time), g1 = pillarGapY(p, sim.time + apexT);
    return [Math.max(g0, g1) - p.gap / 2 + r + rise + 6, Math.min(g0, g1) + p.gap / 2 - r - 10];
  };
  const [hiCur, loCur] = window(cur);
  let target = hiCur;
  if (next && bx + r >= cur.x - C.CAP_OVER) {
    const [hiNext] = window(next);
    target = Math.min(Math.max(hiNext, hiCur), Math.max(hiCur, loCur));
  }
  return b.y > target && b.vy > -60;
}
