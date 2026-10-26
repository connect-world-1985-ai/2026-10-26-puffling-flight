// Dev-only: renders the game's OWN music as separate stems (arp, bass, kick, snare, hats, lead) plus the 7 SFX,
// using the unmodified helpers and data of play/src/audio.js (tone, noise, CHORDS, MELODY, BEAT, SFX) inside headless
// Chrome's OfflineAudioContext. The layer split copies buildMusic() with one flag per layer (game code is not changed).
// Output (git-ignored): test-output/cinematic/stems/*.wav, 48 kHz mono 16-bit.
// Run: node tools/render-music-stems.mjs
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'test-output/cinematic/stems';
mkdirSync(OUT, { recursive: true });
const gameAudio = readFileSync('play/src/audio.js', 'utf8').replace(/^export /gm, '');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.setContent('<!doctype html><title>stems</title>');
await page.addScriptTag({ content: gameAudio + `
// --- builder's stem splitter: same notes, gains and timing as buildMusic(), one layer at a time ---
function buildStem(oc, out, layer) {
  const lead = oc.createBiquadFilter();
  lead.type = 'lowpass'; lead.frequency.value = 2300; lead.connect(out);
  for (let bar = 0; bar < BARS; bar++) {
    const ch = CHORDS[bar % 4], t0 = bar * 4 * BEAT, root = ch[0] - 12;
    if (layer === 'bass') {
      tone(oc, out, { type: 'triangle', f0: midiHz(root), t: t0, dur: BEAT * 0.9, gain: 0.32 });
      tone(oc, out, { type: 'triangle', f0: midiHz(root + 12), t: t0 + BEAT * 1.5, dur: BEAT * 0.4, gain: 0.22 });
      tone(oc, out, { type: 'triangle', f0: midiHz(root), t: t0 + BEAT * 2, dur: BEAT * 0.9, gain: 0.32 });
      tone(oc, out, { type: 'triangle', f0: midiHz(ch[2] - 12), t: t0 + BEAT * 3.5, dur: BEAT * 0.4, gain: 0.22 });
    }
    if (layer === 'arp') {
      const tones = [ch[0], ch[1], ch[2], ch[0] + 12];
      [0, 1, 2, 3, 2, 1, 2, 1].forEach((n, i) => tone(oc, out, { type: 'triangle', f0: midiHz(tones[n] + 12), t: t0 + i * BEAT / 2, dur: BEAT * 0.45, gain: 0.07 }));
    }
    for (let beat = 0; beat < 4; beat++) {
      const tb = t0 + beat * BEAT;
      if (layer === 'kick' && beat % 2 === 0) tone(oc, out, { f0: 140, f1: 45, t: tb, dur: 0.18, gain: 0.5 });
      if (layer === 'snare' && beat % 2 === 1) noise(oc, out, { t: tb, dur: 0.12, gain: 0.12, type: 'bandpass', f0: 1800, q: 0.7 });
      if (layer === 'hats') noise(oc, out, { t: tb + BEAT / 2, dur: 0.04, gain: 0.06, type: 'highpass', f0: 7000, q: 0.7 });
    }
  }
  if (layer === 'lead') for (const [beat, note, len] of MELODY) tone(oc, lead, { type: 'square', f0: midiHz(note), t: beat * BEAT, dur: len * BEAT * 0.95, gain: 0.07, attack: 0.01 });
  // resolve: C chord (bass C + arp on C) for 4 bars and the last lead phrase landing on C (72) on bar 2 beat 1
  if (layer === 'resolve') {
    const ch = CHORDS[0], tones = [ch[0], ch[1], ch[2], ch[0] + 12];
    for (let bar = 0; bar < 4; bar++) {
      const t0 = bar * 4 * BEAT, fade = 1 - bar * 0.22;
      tone(oc, out, { type: 'triangle', f0: midiHz(ch[0] - 12), t: t0, dur: BEAT * 3.8, gain: 0.3 * fade, attack: 0.02 });
      [0, 1, 2, 3, 2, 1, 2, 1].forEach((n, i) => tone(oc, out, { type: 'triangle', f0: midiHz(tones[n] + 12), t: t0 + i * BEAT / 2, dur: BEAT * 0.45, gain: 0.07 * fade }));
    }
    for (const [beat, note, len] of [[1, 79, 1], [2, 76, 0.5], [2.5, 74, 0.5], [4, 72, 6]]) tone(oc, lead, { type: 'square', f0: midiHz(note), t: beat * BEAT, dur: len * BEAT * 0.95, gain: 0.07, attack: 0.01 });
  }
}
window.__renderStems = async () => {
  const sr = 48000, out = { sampleRate: sr, stems: {}, sfx: {} };
  const enc = (buf) => { const d = buf.getChannelData(0); const b = new Int16Array(d.length); for (let i = 0; i < d.length; i++) b[i] = Math.max(-1, Math.min(1, d[i])) * 32767; let s = ''; const u = new Uint8Array(b.buffer); for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode(...u.subarray(i, i + 32768)); return btoa(s); };
  for (const layer of ['arp', 'bass', 'kick', 'snare', 'hats', 'lead', 'resolve']) {
    const secs = layer === 'resolve' ? 4 * 4 * BEAT + 2 : LOOP_S + 1.5;
    out.stems[layer] = enc(await renderOffline(sr, secs, (oc, dest) => { const g = oc.createGain(); g.gain.value = 0.8; g.connect(dest); buildStem(oc, g, layer); }));
  }
  out.full = enc(await renderOffline(sr, LOOP_S + 1.5, (oc, dest) => { const g = oc.createGain(); g.gain.value = 0.8; g.connect(dest); buildMusic(oc, g); }));
  for (const [name, [dur, build]] of Object.entries(SFX)) out.sfx[name] = enc(await renderOffline(sr, dur, build));
  out.loopS = LOOP_S; out.bpm = BPM;
  return out;
};` });
const r = await page.evaluate(() => window.__renderStems());
await browser.close();
function wav(path, b64, sr) {
  const pcm = Buffer.from(b64, 'base64'); const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40); writeFileSync(path, Buffer.concat([h, pcm]));
}
for (const [k, v] of Object.entries(r.stems)) wav(`${OUT}/stem-${k}.wav`, v, r.sampleRate);
wav(`${OUT}/full.wav`, r.full, r.sampleRate);
for (const [k, v] of Object.entries(r.sfx)) wav(`${OUT}/sfx-${k}.wav`, v, r.sampleRate);
writeFileSync(`${OUT}/info.json`, JSON.stringify({ sampleRate: r.sampleRate, loopS: r.loopS, bpm: r.bpm }));
console.log('STEMS_OK', Object.keys(r.stems).join(','), 'loop', r.loopS, 'bpm', r.bpm);
