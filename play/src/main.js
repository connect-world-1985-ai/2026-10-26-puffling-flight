// Boot, layout, input, state machine and the main loop.
import { C } from './config.js';
import { createSim, setView, resetRun, startPlay, flap, step, medalFor, autopilotShouldFlap } from './sim.js';
import { createRenderer, setRenderView, renderFrame, resetEffects, fx } from './render.js';
import { GameAudio } from './audio.js';
import { detectLang, t, htmlLang } from './i18n.js';
import { loadSave, writeSave } from './storage.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const canvas = $('game');
const save = loadSave();
const motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const coarsePointer = window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false;
const navLangs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
let lang = detectLang(save.lang, navLangs);

const newSeed = () => (Math.random() * 4294967296) >>> 0;
const sim = createSim(newSeed());
const R = createRenderer(canvas);
const audio = new GameAudio();
audio.setPrefs(save);

const S = { MENU: 'menu', READY: 'ready', PLAYING: 'playing', RESUMING: 'resuming', PAUSED: 'paused', DYING: 'dying', OVER: 'over' };
let state = S.MENU;
let settingsOpen = false;
let overAt = 0;
let dyingT = 0;
let landedAt = -1;
let countdownT = 0;
let shownScore = -1;
let resetTimer = 0;
let autopilot = new URLSearchParams(location.search).has('autopilot');

const perf = { frames: 0, work: new Float32Array(600), i: 0, reset() { this.frames = 0; this.i = 0; this.work.fill(0); } };

// ---------- helpers ----------
function persist() { writeSave(save); }
function reduceMotion() { return save.reduceMotion === null ? !!(motionQuery && motionQuery.matches) : save.reduceMotion; }
function announce(msg) { $('live').textContent = msg; }
function blurActive() { const a = document.activeElement; if (a && a !== document.body && a.blur) a.blur(); }
function focusEl(id) { const el = $(id); if (el) el.focus({ preventScroll: true }); }

function applyMotion() {
  const rm = reduceMotion();
  R.reduceMotion = rm;
  document.documentElement.classList.toggle('reduce-motion', rm);
}

function applyLanguage() {
  document.documentElement.lang = htmlLang(lang);
  document.title = t(lang, 'pageTitle');
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(lang, el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(lang, el.dataset.i18nAria));
  const hint = t(lang, coarsePointer ? 'hintTouch' : 'hintDesktop');
  $('menu-hint').textContent = hint;
  $('ready-hint').textContent = hint;
  refreshControls();
}

function refreshControls() {
  const setSwitch = (id, on) => { const b = $(id); b.setAttribute('aria-checked', String(on)); b.textContent = t(lang, on ? 'on' : 'off'); };
  setSwitch('set-sfx', save.sfx);
  setSwitch('set-music', save.music);
  setSwitch('set-motion', reduceMotion());
  $('set-lang-en').setAttribute('aria-pressed', String(lang === 'en'));
  $('set-lang-zh').setAttribute('aria-pressed', String(lang === 'zh'));
  const mute = $('btn-mute');
  mute.setAttribute('aria-pressed', String(save.muted));
  mute.setAttribute('aria-label', t(lang, save.muted ? 'ariaUnmute' : 'ariaMute'));
  $('menu-best').textContent = String(save.best);
}

function refreshUI() {
  stage.dataset.state = state;
  stage.classList.toggle('settings-open', settingsOpen);
  const screen = settingsOpen ? 'settings'
    : state === S.MENU ? 'menu' : state === S.READY ? 'ready' : state === S.PAUSED ? 'pause' : state === S.OVER ? 'over' : '';
  for (const el of document.querySelectorAll('.screen')) el.classList.toggle('active', el.id === 'screen-' + screen);
}

function updateScore() {
  shownScore = sim.score;
  const el = $('score');
  el.textContent = String(sim.score);
  if (sim.score > 0) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
}

// ---------- state transitions ----------
function toMenu() {
  state = S.MENU;
  settingsOpen = false;
  resetRun(sim, newSeed());
  resetEffects(R);
  R.palPos = R.palTarget = 0;
  audio.setDucked(false);
  refreshControls();
  refreshUI();
  focusEl('btn-play');
}

function toReady() {
  state = S.READY;
  settingsOpen = false;
  resetRun(sim, newSeed());
  resetEffects(R);
  R.palPos = R.palTarget = 0;
  audio.setDucked(false);
  updateScore();
  refreshUI();
  blurActive();
}

function startPlaying() {
  state = S.PLAYING;
  startPlay(sim);
  refreshUI();
}

function pauseGame() {
  if (state !== S.PLAYING && state !== S.RESUMING) return;
  state = S.PAUSED;
  audio.setDucked(true);
  refreshUI();
  focusEl('btn-resume');
}

function resumeGame() {
  if (state !== S.PAUSED) return;
  settingsOpen = false;
  state = S.RESUMING;
  countdownT = C.RESUME_COUNTDOWN;
  audio.setDucked(false);
  refreshUI();
  blurActive();
}

function die() {
  state = S.DYING;
  dyingT = 0;
  landedAt = -1;
  refreshUI();
}

function toOver() {
  state = S.OVER;
  overAt = performance.now();
  const score = sim.score;
  const isBest = score > save.best;
  if (isBest) { save.best = score; persist(); }
  $('over-score').textContent = String(score);
  $('over-best').textContent = String(save.best);
  $('new-best').hidden = !isBest;
  const medal = medalFor(score);
  $('medal').className = 'medal ' + (medal || 'none');
  const medalKey = medal ? 'medal' + medal[0].toUpperCase() + medal.slice(1) : 'medalNone';
  $('medal-name').dataset.i18n = medalKey;
  $('medal-name').textContent = t(lang, medalKey);
  refreshControls();
  audio.play(isBest ? 'best' : 'swoosh');
  announce(t(lang, 'announceOver', { score, best: save.best }));
  refreshUI();
  focusEl('btn-again');
}

function openSettings() {
  settingsOpen = true;
  refreshControls();
  refreshUI();
  focusEl('btn-settings-back');
}

function closeSettings() {
  settingsOpen = false;
  refreshUI();
  focusEl(state === S.PAUSED ? 'btn-resume' : state === S.OVER ? 'btn-again' : 'btn-play');
}

function canRestart() { return performance.now() - overAt >= C.RESTART_LOCK_MS; }

// Space / tap / click on the play field
function primaryAction() {
  if (settingsOpen) return;
  switch (state) {
    case S.MENU: toReady(); break;
    case S.READY: startPlaying(); flap(sim); break;
    case S.PLAYING: flap(sim); break;
    case S.RESUMING: state = S.PLAYING; refreshUI(); flap(sim); break;
    case S.OVER: if (canRestart()) toReady(); break;
    default: break;
  }
}

function toggleMute() {
  save.muted = !save.muted;
  audio.setPrefs(save);
  persist();
  refreshControls();
}

function setLang(next) {
  if (next !== 'en' && next !== 'zh') return;
  lang = next;
  save.lang = next;
  persist();
  applyLanguage();
}

// ---------- layout ----------
function layout() {
  const vw = Math.max(1, window.innerWidth), vh = Math.max(1, window.innerHeight);
  let scale = vh / C.H;
  let W = vw / scale;
  if (W > C.MAX_W) W = C.MAX_W;
  if (W < C.MIN_W) { W = C.MIN_W; scale = vw / C.MIN_W; }
  const cssW = Math.round(W * scale), cssH = Math.round(C.H * scale);
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  dpr = Math.max(0.75, Math.min(dpr, Math.sqrt(C.MAX_BACKING_PIXELS / (cssW * cssH))));
  stage.style.width = cssW + 'px';
  stage.style.height = cssH + 'px';
  stage.classList.toggle('framed', cssW < vw - 4 || cssH < vh - 4);
  stage.style.setProperty('--u', Math.min(1.35, Math.max(0.78, cssH / C.H)) + 'px');
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const logicalW = cssW / scale;
  setView(sim, logicalW);
  setRenderView(R, logicalW, (cssW * dpr) / logicalW);
}

// ---------- input ----------
const unlockAudio = () => audio.unlock();
for (const type of ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click']) {
  window.addEventListener(type, unlockAudio, { capture: true, passive: true });
}

stage.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button, .panel')) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (!e.isPrimary) return;
  e.preventDefault();
  primaryAction();
});
stage.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const code = e.code;
  const onButton = e.target && e.target.tagName === 'BUTTON';
  if (code === 'KeyM') { e.preventDefault(); if (!e.repeat) toggleMute(); return; }
  if (code === 'KeyP' || code === 'Escape') {
    e.preventDefault();
    if (e.repeat) return;
    if (settingsOpen) closeSettings();
    else if (state === S.PLAYING || state === S.RESUMING) pauseGame();
    else if (state === S.PAUSED) resumeGame();
    return;
  }
  const flapKey = code === 'Space' || code === 'ArrowUp' || code === 'KeyW';
  if (flapKey || code === 'Enter' || code === 'NumpadEnter') {
    if (onButton && (settingsOpen || state === S.MENU || state === S.PAUSED || state === S.OVER)) return; // native button press
    if (!flapKey && state !== S.MENU && state !== S.OVER) return;
    e.preventDefault();
    if (e.repeat) return;
    primaryAction();
  }
});

function onClick(id, fn) {
  $(id).addEventListener('click', (e) => { audio.play('click'); fn(e); });
}
onClick('btn-play', () => { if (state === S.MENU) toReady(); });
onClick('btn-settings-menu', openSettings);
onClick('btn-resume', resumeGame);
onClick('btn-restart', toReady);
onClick('btn-pause-settings', openSettings);
onClick('btn-pause-menu', toMenu);
onClick('btn-again', () => { if (state === S.OVER && canRestart()) toReady(); });
onClick('btn-over-menu', () => { if (state === S.OVER && canRestart()) toMenu(); });
onClick('btn-settings-back', closeSettings);
onClick('btn-pause', pauseGame);
onClick('btn-mute', toggleMute);
onClick('btn-lang', () => setLang(lang === 'en' ? 'zh' : 'en'));
onClick('set-lang-en', () => setLang('en'));
onClick('set-lang-zh', () => setLang('zh'));
onClick('set-sfx', () => { save.sfx = !save.sfx; audio.setPrefs(save); persist(); refreshControls(); });
onClick('set-music', () => { save.music = !save.music; audio.setPrefs(save); persist(); refreshControls(); });
onClick('set-motion', () => { save.reduceMotion = !reduceMotion(); persist(); applyMotion(); refreshControls(); });
onClick('btn-reset-best', () => {
  const b = $('btn-reset-best');
  clearTimeout(resetTimer);
  if (b.dataset.i18n === 'resetConfirm') {
    save.best = 0;
    persist();
    refreshControls();
    b.dataset.i18n = 'resetDone';
  } else {
    b.dataset.i18n = 'resetConfirm';
  }
  b.textContent = t(lang, b.dataset.i18n);
  resetTimer = setTimeout(() => { b.dataset.i18n = 'resetBest'; b.textContent = t(lang, 'resetBest'); }, 3000);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pauseGame(); audio.suspend(); }
  else audio.resumeIfAllowed();
});
window.addEventListener('blur', pauseGame);
window.addEventListener('pagehide', pauseGame);
window.addEventListener('resize', layout);
window.addEventListener('orientationchange', layout);
if (window.visualViewport) window.visualViewport.addEventListener('resize', layout);
if (motionQuery && motionQuery.addEventListener) motionQuery.addEventListener('change', () => { applyMotion(); refreshControls(); });

// ---------- main loop ----------
let last = performance.now();
let acc = 0;

function simMode() {
  if (state === S.MENU || state === S.READY) return 'hover';
  if (state === S.PLAYING) return 'play';
  if (state === S.DYING || state === S.OVER) return 'fall';
  return null; // paused / resuming: world frozen
}

function drainEvents() {
  for (const ev of sim.events) {
    if (ev === 'flap') audio.play('flap');
    else if (ev === 'score') audio.play('score');
    else if (ev === 'hit') audio.play('hit');
    else if (ev === 'splash') audio.play('splash');
    fx(R, sim, ev);
  }
  sim.events.length = 0;
}

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (!(dt > 0)) dt = 0;
  if (dt > C.MAX_FRAME_DT) dt = C.MAX_FRAME_DT;
  const t0 = performance.now();

  let mode = simMode();
  if (mode) {
    acc += dt;
    while (acc >= C.STEP) {
      if (state === S.PLAYING && autopilot && autopilotShouldFlap(sim)) flap(sim);
      const result = step(sim, C.STEP, mode);
      acc -= C.STEP;
      if (result === 'dead' && state === S.PLAYING) { die(); mode = 'fall'; }
    }
  } else {
    acc = 0;
  }

  if (state === S.RESUMING) {
    countdownT -= dt;
    $('countdown').textContent = String(Math.max(1, Math.ceil(countdownT / (C.RESUME_COUNTDOWN / 3))));
    if (countdownT <= 0) { state = S.PLAYING; refreshUI(); }
  }
  if (state === S.DYING) {
    dyingT += dt;
    if (sim.landed && landedAt < 0) landedAt = dyingT;
    if (landedAt >= 0 && dyingT - landedAt >= C.OVER_DELAY) toOver();
  }

  drainEvents();
  if (sim.score !== shownScore) updateScore();
  R.palTarget = state === S.MENU ? 0 : Math.floor(sim.score / C.PALETTE_EVERY);
  renderFrame(R, sim, mode ? acc / C.STEP : 1, state === S.PAUSED || state === S.RESUMING ? 0 : dt, mode || 'still');

  perf.frames++;
  perf.work[perf.i++ % perf.work.length] = performance.now() - t0;
}

// Read-only hook for the automated tests (tests/e2e.mjs). Harmless in production.
window.__puffling = {
  get state() { return state; },
  get score() { return sim.score; },
  get best() { return save.best; },
  get lang() { return lang; },
  get muted() { return save.muted; },
  get settingsOpen() { return settingsOpen; },
  get audioState() { return audio.state; },
  get musicReady() { return !!audio.musicBuffer; },
  get audioRenderMs() { return audio.renderMs; },
  get birdY() { return sim.bird.y; },
  get flaps() { return sim.flaps; },
  get viewW() { return sim.viewW; },
  perf,
  setAutopilot(on) { autopilot = !!on; },
};

applyMotion();
applyLanguage();
layout();
toMenu();
document.documentElement.classList.add('booted');
requestAnimationFrame((t0) => { last = t0; frame(t0); });
