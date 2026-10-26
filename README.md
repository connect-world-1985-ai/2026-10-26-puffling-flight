# Puffling Flight · 小海鹦飞飞

An original one-button flying game for the browser. Guide a little puffin between rocky sea stacks;
the sky turns from dawn to day, sunset and night as your score grows.

一款原创的浏览器单键飞行小游戏：帮小海鹦穿过海蚀柱，分数越高，天色从清晨变为白天、黄昏和夜晚。

**Website:** this repository's GitHub Pages site (link in the About panel) · **Play:** the `play/` page of that site.

## What is where · 目录说明

| Path on the site | What it is |
|---|---|
| `/` (`index.html`, `site.css`, `site.js`) | Official website: hero, trailer, screenshots, features, how to play, **Play now** button → `./play/`. Bilingual EN / 中文 |
| `/play/` (`play/index.html`, `play/styles.css`, `play/src/`, `play/assets/`) | The full game |
| `/media/trailer.mp4`, `/media/trailer-poster.png` | 43 s launch trailer (1280×720 H.264 + AAC) and its poster |
| `/media/shot-*.jpg` | Screenshots used on the website (all taken from the real game) |
| `tests/`, `tools/`, `verify/` | Dev-only: the plan's unit and browser tests, build tools, the builder's acceptance checks, results and evidence screenshots |

Everything uses relative paths, so the site works from any host or sub-folder, and it makes no network requests other than its own files.

## How to play · 玩法

1. **Flap:** tap the screen, click, or press Space, ↑ or W. Each flap lifts the puffin a little. · 轻触屏幕、点击，或按空格键、↑、W 振翅。
2. **Fly through the gaps** between the sea stacks for a point. Don't touch the rocks or the sea. · 穿过海蚀柱之间的空隙得分，别碰到岩石和海面。
3. **Beat your best:** medals at 10, 20, 30 and 50 points; the sky changes every 10 points. · 10/20/30/50 分获得奖牌，每 10 分天色变化一次。

## Controls · 操作

| Action | Keyboard | Mouse / touch |
|---|---|---|
| Flap / start | Space, ↑ or W | Click or tap anywhere |
| Pause / resume | P or Esc | Pause button (top right) |
| Mute | M | Speaker button |
| Language EN / 中文 | — | Language button on the menu, or Settings (the website has its own EN/中文 button; the choice is shared) |

## Features

- Bilingual interface (English / 简体中文), defaults to your browser language (any `zh-*` → 简体中文), choice saved
- Sound effects and a looping chiptune soundtrack, all synthesised in code (Web Audio API)
- Best score, mute, music, sound and reduced-motion settings saved in `localStorage`
- Works with keyboard, mouse and touch; responsive from small phones to wide desktops
- No tracking, no accounts, no network requests other than this site's own files

## Run locally

```sh
npm install                      # dev dependency for tests only (playwright-core)
npm run serve                    # then open http://127.0.0.1:4173/ (website) and http://127.0.0.1:4173/play/ (game)
npm run test:unit                # simulation, i18n and storage tests (plan: 12)
npm run test:e2e                 # the plan's browser tests against /play/ (needs Google Chrome; PW_BROWSER=firefox also)
node verify/acceptance.mjs       # builder's acceptance checks: website + game, desktop + phone emulation, trailer
SITE_BASE_URL=https://<pages-site>/ node verify/acceptance.mjs   # same checks against the live site
node verify/check-plan-files.mjs # compares the files with the plan's SHA-256 list
```

The game and the website have no build step. The trailer is rebuilt with `node tools/record-trailer.mjs && python3 tools/make-trailer.py`
(needs Chrome, ffmpeg with libass, Python 3 + numpy, and the Noto Sans CJK font).

## Credits and licences

- Code: MIT licence (see `LICENSE`), © 2026 connect-world-1985-ai.
- Graphics: drawn at runtime by `play/src/render.js`; icon `play/assets/icon.svg` hand-written SVG, `play/assets/icon-180.png`
  rendered from it by `tools/make-icons.mjs`. Original to this project, same MIT licence.
- Sound and music: synthesised at runtime by `play/src/audio.js`. Original to this project, same MIT licence.
- Trailer (`media/trailer.mp4`): cut from real headless-Chrome gameplay recordings of this game (`tools/record-trailer.mjs`);
  its soundtrack is the game's own music loop and sound effects, rendered by `play/src/audio.js` and mixed with numpy
  (`tools/make-trailer.py`). Same MIT licence.
- Trailer captions font: **Noto Sans CJK SC Bold** (© Google / Adobe, **SIL Open Font License 1.1**), burned into the video pixels
  by ffmpeg/libass; no font file is shipped.
- Website and game fonts: the visitor's own system fonts; no font files are shipped.
- Website emoji icons: the visitor's system emoji font.
- Test tooling (not part of the site): playwright-core, Apache-2.0.

This is an independent, original game in the one-button "tap to fly" genre; it uses no third-party art, names or sounds.

## Deviations from plan

The plan (Claude 方案顾问, "Puffling Flight", 2026-10-26) was followed step by step: Steps 1–16, with every game file
extracted by the plan's own extractor (`CHECKSUMS_OK 18`). Differences:

1. **Website + trailer added (scope addition from the project owner, after the plan was written).** The site root is now a
   website; the game moved, byte-for-byte unchanged, into `play/` (all 10 runtime files still match the plan's SHA-256;
   see `verify/plan-file-hashes.json`). New files: `index.html`, `site.css`, `site.js`, `media/`, `tools/record-trailer.mjs`,
   `tools/make-trailer.py`, `verify/`.
2. **Three dev files edited only for the move:** `tests/unit.test.mjs` and `tools/make-icons.mjs` import from `../play/…`;
   `tests/e2e.mjs` opens `/play/` when it starts its own server. No test logic or game code was changed.
3. **README rewritten** (plan text kept and extended with the layout table, how to play, deviations and GAPS).
4. **No `$HOME/puffling-build-env.sh`.** The four variables were exported in the build shell instead, so nothing was written
   outside the project folder (builder's house rule).
5. **Extra verification** (`verify/acceptance.mjs`): website checks, zh-TW / zh-HK locales, Pixel 7 *portrait* and iPhone 13 touch play,
   restart and best-score persistence, trailer ffprobe and in-page playback, plus a run against the live URL.
6. **Commit count / file count:** more than the plan's 22 files and one commit, because of items 1 and 5.
7. **Step 10 (WebKit):** skipped on Linux exactly as the plan predicts (missing system libraries, no sudo); log in `verify/logs/`.

## GAPS (what the plan did not cover, and the smallest decision taken)

| # | Gap | Decision |
|---|---|---|
| 1 | Plan puts the game at the site root; the owner later asked for website at `/`, game at `/play/` | Moved the 10 runtime files unchanged into `play/`; three dev paths updated |
| 2 | No website in the plan | Single static page in the game's palette and button style, its own 2-language string table in `site.js`, same language rule as the game (any `zh-*` → 中文) and the same save key, so the language follows you into the game |
| 3 | No trailer in the plan | Recorded real play in headless Chrome (`recordVideo`, scripted input + the game's built-in autopilot), cut 9 segments to 43.3 s with ffmpeg |
| 4 | Trailer audio | Captured the game's own `OfflineAudioContext` renders (music loop + 7 effects) from `play/src/audio.js`; placed effects at the recorded flap/score/crash times with numpy |
| 5 | Caption font | Noto Sans CJK SC Bold already installed on the build box (OFL 1.1), via libass |
| 6 | Screenshot location | `media/` (owner's layout); the plan's own e2e screenshots stay in git-ignored `test-output/` |
| 7 | Local server has no HTTP Range support, so a `<video preload=metadata>` request is cancelled by the browser | Acceptance treats only that browser-aborted media request as benign; real playback is tested separately (readyState ≥ 3, currentTime advances) |
| 8 | Plan's env file lives in `$HOME` | Shell variables instead (Deviation 4) |
| 9 | Website poster/screenshots size | Screenshots cropped to the game stage and saved as JPEG (~35–95 KB each) |
| 10 | Emoji in feature cards depend on the system emoji font | Accepted; purely decorative, `aria-hidden` |

Rough share invented by the builder: **0 %** of the game itself (plan code used as-is); about **35 %** of the whole repo
by decisions, all of it in the website, trailer and verification that the plan never covered.

## Verification

See `verify/results-local.json`, `verify/results-live.json`, `verify/logs/` and `verify/shots-*/`.
