// Canvas 2D renderer. Every visual is drawn by this code; there are no image files.
import { C } from './config.js';
import { pillarGapY, mulberry32 } from './sim.js';

const TAU = Math.PI * 2;
const TILE_H = 96;

// Sky palettes: dawn -> day -> sunset -> night, one step every C.PALETTE_EVERY points.
const PALETTES = [
  { skyTop: [255, 160, 170], skyMid: [255, 200, 170], skyBot: [255, 232, 200], sun: [255, 244, 214], sunX: 0.72, sunY: 330, sunR: 34,
    far: [214, 150, 170], near: [168, 112, 146], seaTop: [92, 146, 196], seaBot: [36, 70, 128], foam: [255, 238, 230], cloud: 0.9, stars: 0, shade: [255, 150, 120, 0.05] },
  { skyTop: [70, 166, 236], skyMid: [134, 204, 244], skyBot: [206, 238, 250], sun: [255, 250, 222], sunX: 0.8, sunY: 120, sunR: 30,
    far: [140, 186, 210], near: [88, 136, 164], seaTop: [40, 150, 200], seaBot: [14, 72, 132], foam: [255, 255, 255], cloud: 1, stars: 0, shade: [0, 0, 0, 0] },
  { skyTop: [70, 50, 128], skyMid: [236, 104, 96], skyBot: [255, 186, 112], sun: [255, 214, 140], sunX: 0.3, sunY: 360, sunR: 40,
    far: [128, 70, 112], near: [84, 46, 92], seaTop: [126, 80, 132], seaBot: [40, 30, 80], foam: [255, 214, 196], cloud: 0.8, stars: 0.15, shade: [255, 90, 60, 0.07] },
  { skyTop: [8, 14, 44], skyMid: [24, 38, 88], skyBot: [52, 72, 128], sun: [236, 240, 255], sunX: 0.75, sunY: 110, sunR: 22,
    far: [34, 46, 92], near: [22, 30, 66], seaTop: [26, 46, 96], seaBot: [8, 14, 42], foam: [170, 196, 236], cloud: 0.35, stars: 1, shade: [16, 24, 80, 0.28] },
];
const COLOR_KEYS = ['skyTop', 'skyMid', 'skyBot', 'sun', 'far', 'near', 'seaTop', 'seaBot', 'foam'];
const NUM_KEYS = ['sunX', 'sunY', 'sunR', 'cloud', 'stars'];
const PAL = { shade: [0, 0, 0, 0] };
for (const k of COLOR_KEYS) PAL[k] = [0, 0, 0];

function blendPalette(pos) {
  const i = Math.floor(pos), f = pos - i;
  const a = PALETTES[((i % 4) + 4) % 4], b = PALETTES[(((i + 1) % 4) + 4) % 4];
  for (const k of COLOR_KEYS) for (let c = 0; c < 3; c++) PAL[k][c] = a[k][c] + (b[k][c] - a[k][c]) * f;
  for (const k of NUM_KEYS) PAL[k] = a[k] + (b[k] - a[k]) * f;
  for (let c = 0; c < 4; c++) PAL.shade[c] = a.shade[c] + (b.shade[c] - a.shade[c]) * f;
  return PAL;
}

const rgb = (c, a = 1) => (a >= 1
  ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
  : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`);
const mod = (a, n) => ((a % n) + n) % n;

// Fixed decorative layouts (same every visit).
const rnd0 = mulberry32(7);
const STARS = Array.from({ length: 70 }, () => ({ u: rnd0(), v: rnd0() * 0.62, s: rnd0() < 0.2 ? 2 : 1.2, ph: rnd0() * TAU }));
const CLOUDS = Array.from({ length: 7 }, (_, i) => ({ u: i / 7 + rnd0() * 0.08, y: 40 + rnd0() * 250, sp: i % 3, sc: 0.6 + rnd0() * 0.55, drift: 4 + rnd0() * 9 }));
const GLINTS = Array.from({ length: 22 }, () => ({ u: rnd0(), v: rnd0(), len: 6 + rnd0() * 14 }));

function farH(x) { return Math.max(0, 52 * Math.sin(x * 0.0058) + 26 * Math.sin(x * 0.0149 + 1.7) + 9 * Math.sin(x * 0.043 + 0.4) + 14); }
function nearH(x) { return Math.max(0, 44 * Math.sin(x * 0.0043 + 2.1) + 22 * Math.sin(x * 0.0119 + 0.5) + 8 * Math.sin(x * 0.037 + 0.8) - 6); }

function makeCanvas(w, h, k) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * k));
  c.height = Math.max(1, Math.ceil(h * k));
  const g = c.getContext('2d');
  g.setTransform(k, 0, 0, k, 0, 0);
  return [c, g];
}

function drawPuffin(g, wing) {
  g.translate(24, 20);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  // feet
  g.fillStyle = '#ff7b39';
  g.beginPath(); g.ellipse(-5, 11, 4, 2.2, 0.3, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(1, 11.6, 4, 2.2, 0.3, 0, TAU); g.fill();
  // body
  g.fillStyle = '#20222e'; g.strokeStyle = '#0b0c12'; g.lineWidth = 1.6;
  g.beginPath(); g.ellipse(0, 0, 15.5, 12.5, 0, 0, TAU); g.fill(); g.stroke();
  // belly and face
  g.fillStyle = '#f7f3ea';
  g.beginPath(); g.ellipse(3, 4.5, 10.5, 7.2, -0.15, 0, TAU); g.fill();
  g.fillStyle = '#eef0f3';
  g.beginPath(); g.ellipse(7, -3, 7.5, 6.5, 0.1, 0, TAU); g.fill();
  // beak
  g.beginPath(); g.moveTo(12.5, -7); g.quadraticCurveTo(23.5, -3, 22.2, 1.5); g.quadraticCurveTo(18, 4.8, 12.5, 4.6); g.closePath();
  g.fillStyle = '#ff6a2b'; g.fill();
  g.strokeStyle = '#8a2a0a'; g.lineWidth = 1.2; g.stroke();
  g.fillStyle = '#ffd24a';
  g.beginPath(); g.moveTo(12.5, -7); g.quadraticCurveTo(15, -1.2, 12.5, 4.6); g.lineTo(14.6, 4.4); g.quadraticCurveTo(17, -1.2, 14.4, -6.4); g.closePath(); g.fill();
  g.strokeStyle = '#ffb27a'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(17.4, -5); g.quadraticCurveTo(19.4, -1, 17.8, 3.6); g.stroke();
  // eye
  g.fillStyle = '#111';
  g.beginPath(); g.arc(8, -4.5, 2.3, 0, TAU); g.fill();
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(8.8, -5.3, 0.85, 0, TAU); g.fill();
  g.strokeStyle = '#e8574a'; g.lineWidth = 0.9;
  g.beginPath(); g.arc(8, -4.5, 3.3, Math.PI * 0.85, Math.PI * 1.65); g.stroke();
  g.strokeStyle = '#9aa0ab'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(5, -3.6); g.lineTo(1.5, -2.2); g.stroke();
  // cheek
  g.fillStyle = 'rgba(255,120,120,0.45)';
  g.beginPath(); g.ellipse(7.5, 0.8, 2.6, 1.6, 0, 0, TAU); g.fill();
  // wing (rotated around the shoulder)
  g.save();
  g.translate(-2, 1);
  g.rotate(wing);
  g.fillStyle = '#2f3346'; g.strokeStyle = '#0b0c12'; g.lineWidth = 1.4;
  g.beginPath(); g.ellipse(-7, 0, 9, 4.8, 0, 0, TAU); g.fill(); g.stroke();
  g.strokeStyle = '#555c78'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(-13, 0.5); g.lineTo(-2, 0); g.stroke();
  g.restore();
}

function drawRockTile(g, w, h, rnd) {
  const gr = g.createLinearGradient(0, 0, w, 0);
  gr.addColorStop(0, '#a48f7b'); gr.addColorStop(0.2, '#8f7a67'); gr.addColorStop(0.7, '#78634f'); gr.addColorStop(1, '#5a4636');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  for (let y = 6; y < h; y += 16) {
    g.fillStyle = 'rgba(58,40,28,0.30)';
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin((x + y) * 0.25) * 1.5);
    g.lineTo(w, y + 4); g.lineTo(0, y + 4); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,240,220,0.13)';
    g.fillRect(0, y - 2, w, 1);
  }
  for (let i = 0; i < 26; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(40,28,20,0.25)' : 'rgba(255,245,230,0.16)';
    g.fillRect(4 + rnd() * (w - 8), 2 + rnd() * (h - 4), 2, 2);
  }
  g.fillStyle = 'rgba(30,20,14,0.6)';
  g.fillRect(0, 0, 2, h); g.fillRect(w - 2, 0, 2, h);
}

function drawCap(g, w, rnd) {
  // rock lip occupies y 10..36 of the sprite; grass sits above it (y 0..14)
  const gr = g.createLinearGradient(0, 0, w, 0);
  gr.addColorStop(0, '#b29c86'); gr.addColorStop(0.25, '#9c8671'); gr.addColorStop(1, '#634e3d');
  g.fillStyle = gr;
  g.beginPath(); g.roundRect ? g.roundRect(1, 10, w - 2, 25, 6) : g.rect(1, 10, w - 2, 25); g.fill();
  g.strokeStyle = 'rgba(30,20,14,0.7)'; g.lineWidth = 2; g.stroke();
  g.fillStyle = 'rgba(40,25,15,0.35)';
  g.fillRect(4, 29, w - 8, 5);
  g.fillStyle = '#4fae3e';
  g.beginPath(); g.moveTo(0, 16);
  for (let x = 0; x < w; x += 6) g.quadraticCurveTo(x + 3, 4 - rnd() * 5, x + 6, 11 + rnd() * 2);
  g.lineTo(w, 17); g.lineTo(0, 17); g.closePath(); g.fill();
  g.fillStyle = '#7fd35c';
  for (let x = 4; x < w - 4; x += 9) { g.beginPath(); g.ellipse(x + rnd() * 4, 12 + rnd() * 2, 3, 1.4, 0, 0, TAU); g.fill(); }
  const flowers = ['#fff4f8', '#ffd84a', '#ff9ec4'];
  for (let i = 0; i < 3; i++) {
    g.fillStyle = flowers[i];
    g.beginPath(); g.arc(10 + rnd() * (w - 20), 8 + rnd() * 4, 1.8, 0, TAU); g.fill();
  }
}

function drawCloud(g, rnd, w, h) {
  const n = 5 + Math.floor(rnd() * 3);
  const puffs = [];
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    puffs.push([20 + (w - 40) * f + (rnd() - 0.5) * 10, h * 0.6 - Math.sin(Math.PI * f) * h * 0.22 - rnd() * 5, h * 0.2 + rnd() * h * 0.1 + Math.sin(Math.PI * f) * h * 0.12]);
  }
  const shape = (dy) => {
    g.beginPath();
    for (const [x, y, r] of puffs) { g.moveTo(x + r, y + dy); g.arc(x, y + dy, r, 0, TAU); }
    g.rect(16, h * 0.55 + dy, w - 32, h * 0.22);
    g.fill();
  };
  g.fillStyle = 'rgba(205,214,238,0.75)'; shape(4);
  g.fillStyle = 'rgba(255,255,255,0.97)'; shape(0);
}

function buildSprites(k) {
  const rnd = mulberry32(99);
  const bird = [0.85, 0.1, -0.6].map((wing) => { const [c, g] = makeCanvas(48, 40, k); drawPuffin(g, wing); return c; });
  const [rock, rg] = makeCanvas(C.PILLAR_W, TILE_H, k); drawRockTile(rg, C.PILLAR_W, TILE_H, rnd);
  const capW = C.PILLAR_W + 2 * C.CAP_OVER;
  const [cap, cg] = makeCanvas(capW, 36, k); drawCap(cg, capW, rnd);
  const clouds = [0, 1, 2].map(() => { const [c, g] = makeCanvas(170, 72, k); drawCloud(g, rnd, 170, 72); return c; });
  return { bird, rock, cap, capW, clouds };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false }) || canvas.getContext('2d');
  const particles = [];
  for (let i = 0; i < 96; i++) particles.push({ on: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, g: 0, life: 0, max: 1, size: 1, rot: 0, vr: 0, color: '#fff' });
  return {
    canvas, ctx, W: 360, k: 1, sprites: null,
    palPos: 0, palTarget: 0, time: 0,
    angle: 0, wingT: 0, wingBoost: 0, shake: 0, flash: 0, reduceMotion: false,
    particles,
  };
}

export function setRenderView(R, W, k) {
  R.W = W;
  R.k = k;
  R.sprites = buildSprites(k);
}

export function resetEffects(R) {
  for (const p of R.particles) p.on = false;
  R.shake = 0; R.flash = 0; R.angle = 0; R.wingBoost = 0;
}

const FEATHER = 0, SPARK = 1, DROP = 2, RING = 3;

function emit(R, kind, x, y, vx, vy, g, life, size, color) {
  for (const p of R.particles) {
    if (p.on) continue;
    p.on = true; p.kind = kind; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.g = g;
    p.life = life; p.max = life; p.size = size; p.color = color;
    p.rot = Math.random() * TAU; p.vr = (Math.random() - 0.5) * 8;
    return;
  }
}

// Visual reaction to a simulation event ('flap', 'score', 'hit', 'splash').
export function fx(R, sim, name) {
  const x = sim.birdX, y = sim.bird.y, r = Math.random;
  if (name === 'flap') {
    R.wingBoost = 0.2;
    for (let i = 0; i < 3; i++) emit(R, FEATHER, x - 10, y + 4, -40 - r() * 60, 10 + r() * 50, 90, 0.55, 2.4, i ? '#2f3346' : '#f7f3ea');
  } else if (name === 'score') {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU, s = 90 + r() * 70;
      emit(R, SPARK, x + 6, y, Math.cos(a) * s, Math.sin(a) * s, 0, 0.45, 3.2, i % 2 ? '#ffd23f' : '#fff6c4');
    }
  } else if (name === 'hit') {
    R.shake = 0.32; R.flash = 1;
    for (let i = 0; i < 10; i++) emit(R, FEATHER, x, y, (r() - 0.5) * 260, (r() - 0.7) * 240, 160, 0.9, 2.8, i % 3 ? '#2f3346' : '#f7f3ea');
  } else if (name === 'splash') {
    const sy = C.GROUND_Y;
    for (let i = 0; i < 16; i++) emit(R, DROP, x + (r() - 0.5) * 16, sy, (r() - 0.5) * 240, -140 - r() * 220, 900, 0.9, 2 + r() * 2.2, i % 2 ? '#e8f6ff' : '#9fd3f5');
    emit(R, RING, x, sy + 2, 0, 0, 0, 0.7, 1, '#ffffff');
  }
}

function drawRidge(ctx, W, base, shift, fn, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-24, base);
  for (let x = -24; x <= W + 24; x += 8) ctx.lineTo(x, base - fn(x + shift));
  ctx.lineTo(W + 24, base);
  ctx.closePath();
  ctx.fill();
}

function drawLighthouse(ctx, x, base, pal, time) {
  ctx.fillStyle = rgb(pal.near);
  ctx.beginPath(); ctx.ellipse(x, base, 36, 20, 0, Math.PI, TAU); ctx.fill();
  const top = base - 60;
  ctx.fillStyle = '#f2ede4';
  ctx.beginPath(); ctx.moveTo(x - 7.5, base - 14); ctx.lineTo(x - 4.5, top); ctx.lineTo(x + 4.5, top); ctx.lineTo(x + 7.5, base - 14); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d9483b';
  ctx.fillRect(x - 6.6, base - 30, 13.2, 7);
  ctx.fillRect(x - 5.6, base - 46, 11.2, 6);
  ctx.fillStyle = '#3a3f55'; ctx.fillRect(x - 6, top - 3, 12, 3);
  ctx.fillStyle = '#ffe9a3'; ctx.fillRect(x - 3.5, top - 10, 7, 7);
  ctx.fillStyle = '#d9483b';
  ctx.beginPath(); ctx.moveTo(x - 5.5, top - 10); ctx.lineTo(x, top - 16); ctx.lineTo(x + 5.5, top - 10); ctx.closePath(); ctx.fill();
  if (pal.stars > 0.05) {
    const a = pal.stars * (0.55 + 0.45 * Math.sin(time * 3));
    const glow = ctx.createRadialGradient(x, top - 6, 2, x, top - 6, 34);
    glow.addColorStop(0, `rgba(255,236,150,${(0.85 * a).toFixed(3)})`);
    glow.addColorStop(1, 'rgba(255,236,150,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 34, top - 40, 68, 68);
  }
}

export function renderFrame(R, sim, alpha, dt, mode) {
  const { ctx, W, k, sprites: spr } = R;
  const H = C.H, GY = C.GROUND_Y, PW = C.PILLAR_W;
  R.time += dt;
  const time = R.time;

  if (R.palPos < R.palTarget) R.palPos = Math.min(R.palTarget, R.palPos + dt / C.PALETTE_BLEND_S);
  else if (R.palPos > R.palTarget) R.palPos = R.palTarget;
  const pal = blendPalette(R.palPos);

  const scroll = sim.prevScroll + (sim.scroll - sim.prevScroll) * alpha;
  const birdY = sim.bird.prevY + (sim.bird.y - sim.bird.prevY) * alpha;

  let ox = 0, oy = 0;
  if (R.shake > 0) {
    R.shake = Math.max(0, R.shake - dt);
    if (!R.reduceMotion) { const m = R.shake * 26; ox = (Math.random() - 0.5) * m; oy = (Math.random() - 0.5) * m; }
  }
  ctx.setTransform(k, 0, 0, k, ox * k, oy * k);

  // sky
  const sg = ctx.createLinearGradient(0, 0, 0, GY);
  sg.addColorStop(0, rgb(pal.skyTop)); sg.addColorStop(0.55, rgb(pal.skyMid)); sg.addColorStop(1, rgb(pal.skyBot));
  ctx.fillStyle = sg;
  ctx.fillRect(-24, -24, W + 48, GY + 48);

  // stars
  if (pal.stars > 0.01) {
    for (const s of STARS) {
      const a = pal.stars * (0.55 + 0.45 * Math.sin(time * 2 + s.ph));
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      ctx.fillRect(mod(s.u * W - scroll * 0.02, W), s.v * 420, s.s, s.s);
    }
  }

  // sun or moon
  const sx = pal.sunX * W, sy = pal.sunY, sr = pal.sunR;
  const glow = ctx.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 3.2);
  glow.addColorStop(0, rgb(pal.sun, 0.5)); glow.addColorStop(1, rgb(pal.sun, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(sx - sr * 3.2, sy - sr * 3.2, sr * 6.4, sr * 6.4);
  ctx.fillStyle = rgb(pal.sun);
  ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
  if (pal.stars > 0.5) {
    ctx.fillStyle = `rgba(170,180,215,${((pal.stars - 0.5) * 0.9).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(sx - sr * 0.3, sy - sr * 0.2, sr * 0.22, 0, TAU); ctx.arc(sx + sr * 0.35, sy + sr * 0.3, sr * 0.15, 0, TAU); ctx.fill();
  }

  // clouds
  const per = W + 340;
  ctx.globalAlpha = pal.cloud;
  for (const c of CLOUDS) {
    const x = mod(c.u * per - scroll * 0.2 - time * c.drift, per) - 170;
    ctx.drawImage(spr.clouds[c.sp], x, c.y, 170 * c.sc, 72 * c.sc);
  }
  ctx.globalAlpha = 1;

  // distant islands, lighthouse, near cliffs
  drawRidge(ctx, W, GY + 2, scroll * 0.12, farH, rgb(pal.far));
  const nearShift = scroll * 0.3;
  for (let i = Math.floor((nearShift - 60) / 1700); i <= Math.floor((nearShift + W + 60) / 1700); i++) {
    const lx = i * 1700 + 900 - nearShift;
    if (lx > -60 && lx < W + 60) drawLighthouse(ctx, lx, GY + 2, pal, time);
  }
  drawRidge(ctx, W, GY + 2, nearShift, nearH, rgb(pal.near));

  // rock columns
  const capW = spr.capW;
  for (const p of sim.pillars) {
    if (!p.active) continue;
    const x = p.x - scroll;
    if (x > W + 20 || x + PW + C.CAP_OVER < -20) continue;
    const gy = pillarGapY(p, sim.time);
    const top = gy - p.gap / 2, bot = gy + p.gap / 2;
    for (let y = top - C.CAP_H - TILE_H; y > -TILE_H - 24; y -= TILE_H) ctx.drawImage(spr.rock, x, y, PW, TILE_H + 1);
    for (let y = bot + C.CAP_H - 2; y < GY + 12; y += TILE_H) ctx.drawImage(spr.rock, x, y, PW, TILE_H + 1);
    ctx.drawImage(spr.cap, x - C.CAP_OVER, bot - 10, capW, 36);
    ctx.save();
    ctx.translate(x - C.CAP_OVER, top + 10);
    ctx.scale(1, -1);
    ctx.drawImage(spr.cap, 0, 0, capW, 36);
    ctx.restore();
  }

  // sea
  const seaG = ctx.createLinearGradient(0, GY, 0, H);
  seaG.addColorStop(0, rgb(pal.seaTop)); seaG.addColorStop(1, rgb(pal.seaBot));
  ctx.fillStyle = seaG;
  ctx.beginPath();
  ctx.moveTo(-24, H + 24);
  for (let x = -24; x <= W + 24; x += 10) ctx.lineTo(x, GY + Math.sin((x + scroll) * 0.05 + time * 2.2) * 2.5);
  ctx.lineTo(W + 24, H + 24);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgb(pal.foam, 0.85); ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let x = -24; x <= W + 24; x += 10) {
    const y = GY + Math.sin((x + scroll) * 0.05 + time * 2.2) * 2.5;
    if (x === -24) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.strokeStyle = rgb(pal.foam, 0.25); ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = -24; x <= W + 24; x += 12) {
    const y = GY + 24 + Math.sin((x + scroll) * 0.035 - time * 1.6) * 2;
    if (x === -24) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = rgb(pal.foam, 0.5);
  for (const s of GLINTS) {
    const x = mod(s.u * 960 - scroll, 960) - 60;
    if (x < W + 10) ctx.fillRect(x, GY + 10 + s.v * (H - GY - 18), s.len, 2);
  }
  ctx.strokeStyle = rgb(pal.foam, 0.8); ctx.lineWidth = 2;
  for (const p of sim.pillars) {
    if (!p.active) continue;
    const x = p.x - scroll + PW / 2;
    if (x < -60 || x > W + 60) continue;
    ctx.beginPath(); ctx.ellipse(x, GY + 3, PW / 2 + 5 + Math.sin(time * 3 + p.phase) * 1.5, 4, 0, 0, TAU); ctx.stroke();
  }

  // puffin
  let target;
  if (sim.landed) target = 0.2;
  else if (mode === 'play' || mode === 'fall') target = sim.bird.vy < 0 ? -0.42 : Math.min(1.35, -0.42 + sim.bird.vy / 520);
  else target = Math.sin(time * 3) * 0.06;
  R.angle += (target - R.angle) * Math.min(1, dt * (sim.bird.vy < 0 ? 18 : 7));
  let frame = 1;
  if (!sim.landed) {
    if (mode === 'fall') frame = 0;
    else {
      R.wingT += dt * (R.wingBoost > 0 ? 26 : mode === 'play' ? 11 : 8);
      R.wingBoost = Math.max(0, R.wingBoost - dt);
      frame = [0, 1, 2, 1][Math.floor(R.wingT) & 3];
    }
  }
  const by = birdY + (sim.landed ? Math.sin(time * 3) * 1.5 : 0);
  ctx.save();
  ctx.translate(sim.birdX, by);
  ctx.rotate(R.angle);
  ctx.drawImage(spr.bird[frame], -27.6, -23, 55.2, 46); // sprite drawn at 1.15x
  ctx.restore();

  // particles
  for (const p of R.particles) {
    if (!p.on) continue;
    p.life -= dt;
    if (p.life <= 0) { p.on = false; continue; }
    p.vy += p.g * dt;
    if (p.kind === FEATHER) { p.vx *= 1 - Math.min(1, dt * 2); p.vy *= 1 - Math.min(1, dt * 1.5); }
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    const f = p.life / p.max;
    ctx.globalAlpha = Math.min(1, f * 1.6);
    ctx.fillStyle = p.color;
    if (p.kind === RING) {
      ctx.strokeStyle = p.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 8 + (1 - f) * 44, 3 + (1 - f) * 7, 0, 0, TAU); ctx.stroke();
    } else if (p.kind === SPARK) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      const s = p.size * (0.4 + f);
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    } else if (p.kind === FEATHER) {
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size * 1.6, p.size * 0.7, p.rot, 0, TAU); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // colour grade for the time of day
  if (pal.shade[3] > 0.002) {
    ctx.fillStyle = `rgba(${pal.shade[0] | 0},${pal.shade[1] | 0},${pal.shade[2] | 0},${pal.shade[3].toFixed(3)})`;
    ctx.fillRect(-24, -24, W + 48, H + 48);
  }
  if (R.flash > 0) {
    if (!R.reduceMotion) { ctx.fillStyle = `rgba(255,255,255,${(R.flash * 0.7).toFixed(3)})`; ctx.fillRect(-24, -24, W + 48, H + 48); }
    R.flash = Math.max(0, R.flash - dt * 7);
  }
}
