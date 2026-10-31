#!/usr/bin/env python3
"""Arranges the cinematic-trailer score from stems of the game's OWN music (play/src/audio.js buildMusic, rendered
layer by layer by tools/render-music-stems.mjs) and the game's own sound effects. numpy only; no outside music.

Build (ART.md section 7, 100 BPM, 1 bar = 2.4 s):
  bars 1-2  arp only, low-pass sweep 500 -> 2300 Hz, quiet sea bed (splash SFX slowed 0.5x, -18 dB)
  bars 3-4  + bass          bars 5-6  + hats + snare          bar 7  + kick (full groove, no lead)
  bar 8     snare roll (8ths -> 16ths) with the game's snare, swoosh riser on beat 3, beat 4 total silence
  bar 9     THE DROP: the loop restarts at bar 1 with every layer + lead melody, through bar 13;
            extra kick/snare/sub-boom accents on the title-drop downbeats for punch
  bar 14    hard cut of the music on the crash (hit / splash / best + a climax boom)
  bars 15-17 resolve on C under the logo (bass + arp on C, last lead phrase landing on C), 'best' an octave up,
            short room tail, fade to black over the last 1.2 s
Usage: python3 src/trailer/score.py cues.json out.wav
"""
import json, sys, wave
import numpy as np

CFG = json.load(open(sys.argv[1]))
A = CFG['arrangement']
STEMS = A.get('stems', 'test-output/cinematic/stems')
SR = 48000
TOTAL = CFG['total']
N = int(TOTAL * SR)


def rd(p):
    with wave.open(p) as w:
        assert w.getframerate() == SR
        return np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float64) / 32767


stem = {k: rd(f'{STEMS}/stem-{k}.wav') for k in ('arp', 'bass', 'kick', 'snare', 'hats', 'lead', 'resolve')}
sfx = {k: rd(f'{STEMS}/sfx-{k}.wav') for k in ('flap', 'score', 'hit', 'splash', 'swoosh', 'click', 'best')}
PAN = {'arp': -0.25, 'lead': 0.2, 'hats': 0.3, 'snare': 0.05, 'bass': 0, 'kick': 0, 'resolve': 0}
music = np.zeros((2, N)); fx = np.zeros((2, N))


def place(buf, sig, t, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= N: return
    if i < 0: sig = sig[-i:]; i = 0
    sig = sig[: N - i]
    l, r = np.cos((pan + 1) * np.pi / 4) * np.sqrt(2), np.sin((pan + 1) * np.pi / 4) * np.sqrt(2)
    buf[0, i:i + len(sig)] += sig * gain * l
    buf[1, i:i + len(sig)] += sig * gain * r


def window(sig, src_t0, t0, t1, fade=0.004):
    """Take stem audio from loop time src_t0 for the span t0..t1 with tiny edge fades (hard cuts without clicks)."""
    a = int(src_t0 * SR); n = int((t1 - t0) * SR)
    seg = sig[a:a + n].copy()
    if len(seg) < n: seg = np.pad(seg, (0, n - len(seg)))
    f = int(fade * SR)
    seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f)
    return seg


def sweep_lowpass(x, f0, f1):
    """One-pole low-pass whose cutoff glides exponentially f0 -> f1 across x."""
    y = np.empty_like(x); s = 0.0
    fc = f0 * (f1 / f0) ** (np.arange(len(x)) / max(1, len(x) - 1))
    a = 1 - np.exp(-2 * np.pi * fc / SR)
    for i in range(len(x)):
        s += a[i] * (x[i] - s); y[i] = s
    return y


bar = A.get('bar', 2.4); beat = bar / 4
silence0, drop = A['silence'], A['drop']
# pre-drop layers: loop time = trailer time (the loop starts with the picture)
for name, spans in A['layers'].items():
    for t0, t1 in spans:
        seg = window(stem[name], t0, t0, t1)
        if name == 'arp' and A.get('arp_sweep') and t0 < A['arp_sweep'][1]:
            s0, s1, f0, f1 = A['arp_sweep']
            k = int((s1 - t0) * SR)
            seg[:k] = sweep_lowpass(seg[:k], f0, f1)
        place(music, seg, t0, 1.0, PAN[name])
# sea bed: the game's splash slowed to half speed, very quiet, under the cold open
sb0, sb1, sb_db = A['seabed']
slow = np.interp(np.arange(0, len(sfx['splash']) - 1, 0.5), np.arange(len(sfx['splash'])), sfx['splash'])
t = sb0
while t < sb1:
    seg = slow[: int(min(len(slow), (sb1 - t) * SR))]
    if len(seg) < SR // 4: break  # a fixed step (not the shrinking tail) so the loop always ends
    place(music, seg * np.hanning(len(seg)), t, 10 ** (sb_db / 20) * 3, 0); t += len(slow) / SR * 0.6
# bar 8 roll with the game's own snare hit (one hit cut from the snare stem at beat 2 of bar 1)
hit_snare = window(stem['snare'], beat, 0, 0.14, 0.002)
r0, r8, r1 = A['roll']
t, k = r0, 0
while t < r1 - 1e-6:
    place(music, hit_snare, t, 1.2 + 1.6 * (t - r0) / (r1 - r0), 0.05)
    t += beat / 2 if t < r8 - 1e-6 else beat / 4
    k += 1
place(fx, sfx[A['riser'][0]], A['riser'][1], 1.0, 0)
# the rise: pre-drop music climbs from build_db[0] to build_db[1] so the drop lands clearly louder
b_db0, b_db1 = A.get('build_db', [0, 0]); kd = int(drop[0] * SR)
music[:, :kd] *= 10 ** (np.linspace(b_db0, b_db1, kd) / 20)
# THE DROP: every layer + lead from loop bar 1 (kick/bass/snare a touch hotter for punch)
d0, d1 = drop
DROP_GAIN = {'arp': 1.05, 'bass': 1.3, 'kick': 1.65, 'snare': 1.4, 'hats': 1.12, 'lead': 1.22}
for name in ('arp', 'bass', 'kick', 'snare', 'hats', 'lead'):
    place(music, window(stem[name], 0, d0, d1), d0, DROP_GAIN[name], PAN[name])
# Impact accents: one heavy title-drop downbeat + a lighter hit one bar later; boom on the crash climax.
kick_hit = window(stem['kick'], 0, 0, 0.22, 0.002)

def sub_boom(dur=0.48, f0=55, f1=34):
    n = int(dur * SR); t = np.arange(n) / SR
    env = np.exp(-t * 8.0) * (1 - np.exp(-t * 100))
    return np.sin(2 * np.pi * (f0 * t + (f1 - f0) * t * t / (2 * max(dur, 1e-9)))) * env

boom = sub_boom()
for dt, g in ((0.0, 1.35), (bar, 0.95)):
    place(music, kick_hit, d0 + dt, g, 0)
    place(music, boom, d0 + dt, g * 0.85, 0)
    place(music, hit_snare, d0 + dt, g * 0.7, 0.05)
crash_t = A.get('music_cuts', [[None]])[0][0]
if crash_t is not None:
    place(fx, boom, crash_t, 1.45, 0)
    place(fx, kick_hit, crash_t, 1.1, 0)
    place(fx, hit_snare, crash_t + 0.02, 0.85, 0.05)
# resolve under the logo, with a short room tail, then fade
v0, v1 = A['resolve']
res = window(stem['resolve'], 0, 0, v1 - v0, 0.004)
ir_n = int(1.6 * SR); rng = np.random.default_rng(7)
ir = rng.standard_normal(ir_n) * np.exp(-np.arange(ir_n) / SR * 4.0); ir /= np.sqrt((ir ** 2).sum()) * 3
L = 1 << int(np.ceil(np.log2(len(res) + ir_n)))
wet = np.fft.irfft(np.fft.rfft(res, L) * np.fft.rfft(ir, L), L)[: len(res)]
place(music, res + wet, v0, 1.1, 0)
best_up = sfx['best'][::2]  # one octave up
place(fx, best_up, A.get('logo_best', v0), 10 ** (-6 / 20), 0)
# sound effects on the picture (explicit cues + the real logged gameplay events)
for c in CFG['cues']:
    if c['name'] in sfx: place(fx, sfx[c['name']], c['t'], 10 ** (c.get('db', 0) / 20), c.get('pan', 0))
# hard silence for the air-gap beat and after the crash cut (effects keep ringing)
music[:, int(silence0[0] * SR):int(silence0[1] * SR)] = 0
for c0, c1 in A.get('music_cuts', []):
    music[:, int(c0 * SR):int(c1 * SR)] = 0
mix = music * A.get('music_gain', 1.0) + fx * A.get('sfx_gain', 0.6)
fo = int(A.get('fade_out', 1.2) * SR); mix[:, -fo:] *= np.linspace(1, 0, fo) ** 1.3
fi = int(0.6 * SR); mix[:, :fi] *= np.linspace(0, 1, fi)
# level: 75th-percentile 2.4 s window to about -14 dBFS RMS; soft-clip above 0.92
w = int(bar * SR)
wins = [np.sqrt((mix[:, i:i + w] ** 2).mean()) for i in range(0, N - w, w // 2)]
rms = float(np.percentile(wins, 75))
mix *= 10 ** (-14 / 20) / max(rms, 1e-9)
over = np.abs(mix) > 0.92
mix[over] = np.sign(mix[over]) * (0.92 + 0.07 * np.tanh((np.abs(mix[over]) - 0.92) / 0.07))
with wave.open(sys.argv[2], 'w') as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR)
    f.writeframes((np.clip(mix.T, -1, 1) * 32767).astype('<i2').tobytes())
seg_db = [round(20 * np.log10(np.sqrt((mix[:, i:i + w] ** 2).mean()) + 1e-9), 1) for i in range(0, N - w + 1, w)]
print('SCORE_OK', sys.argv[2], f'{TOTAL:.2f}s', 'per-bar RMS dB:', seg_db)
