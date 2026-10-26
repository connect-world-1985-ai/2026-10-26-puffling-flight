// All sound is synthesised with the Web Audio API: effects and the music loop are rendered once into
// AudioBuffers with OfflineAudioContext after the first user input, then played from memory.
const midiHz = (n) => 440 * Math.pow(2, (n - 69) / 12);
const noiseCache = new WeakMap();

function noiseBuffer(oc) {
  let b = noiseCache.get(oc);
  if (!b) {
    b = oc.createBuffer(1, oc.sampleRate, oc.sampleRate);
    const d = b.getChannelData(0);
    let seed = 22222;
    for (let i = 0; i < d.length; i++) { seed = (seed * 16807) % 2147483647; d[i] = (seed / 2147483647) * 2 - 1; }
    noiseCache.set(oc, b);
  }
  return b;
}

function env(oc, t, dur, gain, attack) {
  const g = oc.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  return g;
}

function tone(oc, out, { type = 'sine', f0, f1 = f0, t = 0, dur, gain = 0.3, attack = 0.005 }) {
  const o = oc.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = env(oc, t, dur, gain, attack);
  o.connect(g); g.connect(out);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(oc, out, { t = 0, dur, gain = 0.3, type = 'bandpass', f0 = 1000, f1 = f0, q = 1, attack = 0.004 }) {
  const src = oc.createBufferSource();
  src.buffer = noiseBuffer(oc);
  const flt = oc.createBiquadFilter();
  flt.type = type;
  flt.Q.value = q;
  flt.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) flt.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = env(oc, t, dur, gain, attack);
  src.connect(flt); flt.connect(g); g.connect(out);
  src.start(t, Math.random() * 0.4); src.stop(t + dur + 0.02);
}

const SFX = {
  flap: [0.16, (oc, o) => {
    noise(oc, o, { dur: 0.12, gain: 0.32, type: 'bandpass', f0: 1800, f1: 500, q: 0.9 });
    tone(oc, o, { f0: 420, f1: 720, dur: 0.09, gain: 0.1 });
  }],
  score: [0.4, (oc, o) => {
    tone(oc, o, { type: 'triangle', f0: 987.77, dur: 0.12, gain: 0.32 });
    tone(oc, o, { type: 'triangle', f0: 1318.51, t: 0.07, dur: 0.28, gain: 0.32 });
    tone(oc, o, { f0: 2637, t: 0.07, dur: 0.2, gain: 0.05 });
  }],
  hit: [0.45, (oc, o) => {
    tone(oc, o, { type: 'square', f0: 240, f1: 60, dur: 0.25, gain: 0.18 });
    noise(oc, o, { dur: 0.2, gain: 0.45, type: 'lowpass', f0: 2400, f1: 200, q: 0.7 });
    tone(oc, o, { f0: 110, f1: 40, dur: 0.38, gain: 0.55 });
  }],
  splash: [0.85, (oc, o) => {
    noise(oc, o, { dur: 0.75, gain: 0.5, type: 'lowpass', f0: 5000, f1: 300, q: 0.7, attack: 0.01 });
    noise(oc, o, { t: 0.05, dur: 0.4, gain: 0.22, type: 'bandpass', f0: 1500, f1: 3200, q: 2 });
    tone(oc, o, { f0: 300, f1: 900, t: 0.02, dur: 0.12, gain: 0.08 });
  }],
  swoosh: [0.45, (oc, o) => {
    noise(oc, o, { dur: 0.38, gain: 0.6, type: 'bandpass', f0: 400, f1: 2400, q: 1.2, attack: 0.12 });
  }],
  click: [0.07, (oc, o) => {
    tone(oc, o, { type: 'triangle', f0: 1400, f1: 1100, dur: 0.05, gain: 0.18 });
  }],
  best: [1.1, (oc, o) => {
    [1046.5, 1318.51, 1567.98, 2093].forEach((f, i) => {
      tone(oc, o, { type: 'triangle', f0: f, t: i * 0.09, dur: i === 3 ? 0.7 : 0.2, gain: 0.26 });
      tone(oc, o, { f0: f * 2, t: i * 0.09, dur: 0.15, gain: 0.04 });
    });
  }],
};

// Music: 8 bars at 100 BPM in C major (C G Am F, twice), 19.2 s, rendered once and looped seamlessly.
const BPM = 100;
const BEAT = 60 / BPM;
const BARS = 8;
const LOOP_S = BARS * 4 * BEAT;
const CHORDS = [[48, 52, 55], [43, 47, 50], [45, 48, 52], [41, 45, 48]];
// [beat, midi note, length in beats]
const MELODY = [
  [0, 76, 1], [1, 79, 0.5], [1.5, 76, 0.5], [2, 74, 1], [3, 72, 1],
  [4, 74, 1], [5, 79, 0.5], [5.5, 81, 0.5], [6, 79, 1.5],
  [8, 76, 1], [9, 81, 0.5], [9.5, 79, 0.5], [10, 76, 1], [11, 74, 1],
  [12, 72, 1.5], [13.5, 74, 0.5], [14, 76, 1], [15, 72, 1],
  [16, 79, 0.5], [16.5, 81, 0.5], [17, 79, 0.5], [17.5, 76, 0.5], [18, 79, 1], [19, 84, 1],
  [20, 86, 1], [21, 81, 0.5], [21.5, 79, 0.5], [22, 74, 1.5],
  [24, 76, 0.5], [24.5, 79, 0.5], [25, 81, 1], [26, 84, 1], [27, 81, 1],
  [28, 79, 1], [29, 76, 0.5], [29.5, 74, 0.5], [30, 72, 2],
];

function buildMusic(oc, out) {
  const lead = oc.createBiquadFilter();
  lead.type = 'lowpass'; lead.frequency.value = 2300;
  lead.connect(out);
  for (let bar = 0; bar < BARS; bar++) {
    const ch = CHORDS[bar % 4];
    const t0 = bar * 4 * BEAT;
    const root = ch[0] - 12;
    // bass
    tone(oc, out, { type: 'triangle', f0: midiHz(root), t: t0, dur: BEAT * 0.9, gain: 0.32 });
    tone(oc, out, { type: 'triangle', f0: midiHz(root + 12), t: t0 + BEAT * 1.5, dur: BEAT * 0.4, gain: 0.22 });
    tone(oc, out, { type: 'triangle', f0: midiHz(root), t: t0 + BEAT * 2, dur: BEAT * 0.9, gain: 0.32 });
    tone(oc, out, { type: 'triangle', f0: midiHz(ch[2] - 12), t: t0 + BEAT * 3.5, dur: BEAT * 0.4, gain: 0.22 });
    // arpeggio in eighth notes
    const tones = [ch[0], ch[1], ch[2], ch[0] + 12];
    [0, 1, 2, 3, 2, 1, 2, 1].forEach((n, i) => {
      tone(oc, out, { type: 'triangle', f0: midiHz(tones[n] + 12), t: t0 + i * BEAT / 2, dur: BEAT * 0.45, gain: 0.07 });
    });
    // drums: kick on 1 and 3, soft snare on 2 and 4, hats on the off-beats
    for (let beat = 0; beat < 4; beat++) {
      const tb = t0 + beat * BEAT;
      if (beat % 2 === 0) tone(oc, out, { f0: 140, f1: 45, t: tb, dur: 0.18, gain: 0.5 });
      else noise(oc, out, { t: tb, dur: 0.12, gain: 0.12, type: 'bandpass', f0: 1800, q: 0.7 });
      noise(oc, out, { t: tb + BEAT / 2, dur: 0.04, gain: 0.06, type: 'highpass', f0: 7000, q: 0.7 });
    }
  }
  for (const [beat, note, len] of MELODY) {
    tone(oc, lead, { type: 'square', f0: midiHz(note), t: beat * BEAT, dur: len * BEAT * 0.95, gain: 0.07, attack: 0.01 });
  }
}

async function renderOffline(sampleRate, seconds, build) {
  const oc = new OfflineAudioContext(1, Math.ceil(sampleRate * seconds), sampleRate);
  build(oc, oc.destination);
  return oc.startRendering();
}

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.buffers = new Map();
    this.musicBuffer = null;
    this.musicSource = null;
    this.muted = false;
    this.sfxOn = true;
    this.musicOn = true;
    this.ducked = false;
    this.renderMs = 0;
  }

  get state() { return this.ctx ? this.ctx.state : 'none'; }

  // Call synchronously inside every user-input handler (iOS and autoplay rules need a real gesture).
  unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) {
      try { this.ctx = new AC(); } catch (e) { return; }
      const c = this.ctx;
      this.master = c.createGain();
      this.sfxBus = c.createGain();
      this.musicBus = c.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.master.connect(c.destination);
      this.applyLevels(true);
      this.renderAll();
    }
    if (this.ctx.state !== 'running') {
      const p = this.ctx.resume();
      if (p && p.catch) p.catch(() => {});
      try {
        const s = this.ctx.createBufferSource();
        s.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
        s.connect(this.ctx.destination);
        s.start(0);
      } catch (e) { /* ignore */ }
    }
  }

  async renderAll() {
    const sr = this.ctx.sampleRate;
    const t0 = performance.now();
    try {
      for (const [name, [dur, build]] of Object.entries(SFX)) {
        this.buffers.set(name, await renderOffline(sr, dur, build));
      }
      const TAIL = 1.5;
      const raw = await renderOffline(sr, LOOP_S + TAIL, (oc, dest) => {
        const out = oc.createGain();
        out.gain.value = 0.8;
        out.connect(dest);
        buildMusic(oc, out);
      });
      const len = Math.round(sr * LOOP_S);
      const loop = this.ctx.createBuffer(1, len, sr);
      const src = raw.getChannelData(0), dst = loop.getChannelData(0);
      dst.set(src.subarray(0, len));
      for (let i = len; i < src.length; i++) dst[i - len] += src[i]; // wrap the tail so the loop is seamless
      this.musicBuffer = loop;
      this.renderMs = performance.now() - t0;
      this.startMusic();
    } catch (e) {
      this.renderMs = -1; // audio stays silent; the game still works
    }
  }

  startMusic() {
    if (!this.ctx || !this.musicBuffer || this.musicSource) return;
    const s = this.ctx.createBufferSource();
    s.buffer = this.musicBuffer;
    s.loop = true;
    s.connect(this.musicBus);
    s.start();
    this.musicSource = s;
  }

  setPrefs({ muted, sfx, music }) {
    this.muted = !!muted;
    this.sfxOn = sfx !== false;
    this.musicOn = music !== false;
    this.applyLevels(false);
  }

  setDucked(on) {
    this.ducked = !!on;
    this.applyLevels(false);
  }

  applyLevels(immediate) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const set = (param, v) => {
      param.cancelScheduledValues(now);
      if (immediate) param.setValueAtTime(v, now);
      else param.setTargetAtTime(v, now, 0.03);
    };
    set(this.master.gain, this.muted ? 0 : 0.9);
    set(this.sfxBus.gain, this.sfxOn ? 0.8 : 0);
    set(this.musicBus.gain, this.musicOn ? (this.ducked ? 0.12 : 0.34) : 0);
  }

  play(name) {
    const b = this.buffers.get(name);
    if (!b || !this.ctx || this.ctx.state !== 'running' || this.muted || !this.sfxOn) return;
    const s = this.ctx.createBufferSource();
    s.buffer = b;
    s.connect(this.sfxBus);
    s.start();
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  resumeIfAllowed() {
    if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }
}
