# Cinematic trailer — technical listening review

Date: 2026-10-31 (Asia/Shanghai). File reviewed: `media/cinematic-trailer.mp4` (after impact accents + loudness pass).
Chart: `verify/cinematic-loudness-curve.png` (and `.csv`).

## Loudness summary

| | Integrated (LUFS) | LRA (LU) | True peak (dBTP) |
|--|--:|--:|--:|
| **Before** (HEAD 4e24e2f) | −15.3 | 10.8 | **+0.5** (over −1) |
| **After** (this commit) | −15.0 | 12.0 | **−1.5** |

Target band: about −16 LUFS integrated, true peak ≤ −1 dBTP. After is in band on peak; integrated is about 1 LU hotter than −16 (acceptable “about −16”, keeps drop punch).

## Method

- `ffmpeg ebur128=peak=true` for I / LRA / TP.
- Momentary (~400 ms) and short-term (~3 s) RMS proxies plotted in the chart (not full ITU gating; enough to see shape).
- `silencedetect=noise=-40dB:d=0.3` for dropouts.
- Timestamps from `src/trailer/shots.json` / arrangement: beat = 0.6 s, bar = 2.4 s; **title DROP at 19.2 s** (shot 14 still-07 + white flash); **crash / music cut at 31.2 s**; resolve / logo at 33.6 s. Score from `src/trailer/score.py` + stems under `test-output/cinematic/stems/`.

## Continuity (music present start→end?)

Music is present for the whole cut **except the two designed gaps**:

| Gap | Time | Duration | Verdict |
|--|--|--|--|
| Fade-in | 0.00–0.31 s | ~0.3 s | Intentional (0.6 s fade-in in score) |
| Air-gap before DROP | 18.52–19.21 s | ~0.68 s | Intentional (shot 13 black + `silence` 18.6–19.2) |
| Crash music cut | 31.68–32.28 s | ~0.59 s | Intentional (`music_cuts` 31.2–33.6); hit/splash/boom SFX still fire |

No mid-section dropout outside those gaps.

## Title reveal (DROP @ 19.2 s)

- Pre-roll (16.8–18.6) mean energy ≈ 0.118; DROP window (19.2–20.4) ≈ 0.311 → **~+8.4 dB** jump after the silence gap.
- Clear transient / onset on the downbeat (kick + snare crack + sub-boom accents added in `score.py`).
- Short-term curve in the chart rises sharply at 19.2 s. **Punchy enough** after the change (before: drop bar only ~+2.7 dB over the roll — judged not clearly 有冲击力).

## Climax / crash (@ 31.2 s)

- Music hard-cuts by design; gameplay hit/splash remain.
- Added a climax kick + snare + sub-boom under the cut so the hit still has weight.
- Crash window energy ≈ 0.314 (similar to the DROP). Chart shows a short-term peak into the cut, then resolve.

## Flatness

- Before: LRA 10.8 LU with a real build → silence → drop; not flat, but drop contrast was mild and **true peak was clipping (+0.5 dBTP)**.
- After: LRA **12.0 LU**, stronger DROP/crash accents, TP fixed. Not flat.

## What changed

1. **`src/trailer/score.py`**: hotter DROP layer gains; title-drop downbeat (+1 bar) kick/snare/sub-boom accents; crash climax boom; 75th-percentile leveling so one accent bar cannot crush the groove; docstring updated.
2. **`src/trailer/shots.json`** (and baked `test-output/cinematic/build-final/cues.json` arrangement): `build_db` −10→−3, `music_gain` 1.05.
3. Rebuilt `score.wav`, remuxed onto the **existing** picture with `-c:v copy` (video MD5 unchanged: `91840188919e345dc47f9ef6027557f1`), then gain+alimiter to about −15 LUFS / TP −1.5.
4. No visual re-render; no typed-in text on frames.

## Verdict

Objective problems found: **true peak over −1 dBTP**, and **title/climax impact not clearly punchy**. Both addressed. No other media/site/poster defects found in this pass that needed a fix.
