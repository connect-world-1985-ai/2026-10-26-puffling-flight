# Puffling Flight · 小海鹦飞飞

An original one-button flying game for the browser. Guide a little puffin between rocky sea stacks;
the sky turns from dawn to day, sunset and night as your score grows.

一款原创的浏览器单键飞行小游戏：帮小海鹦穿过海蚀柱，分数越高，天色从清晨变为白天、黄昏和夜晚。

**Website:** this repository's GitHub Pages site (link in the About panel) · **Play:** the `play/` page of that site.

## What is where · 目录说明

| Path on the site | What it is |
|---|---|
| `/` (`index.html`, `site.css`, `site.js`) | Official launch website (premiere style): cinematic-trailer hero, posters, gameplay trailer, key-art gallery + screenshots, features, how to play, end band, **Play now** → `./play/`. Bilingual EN / 中文 |
| `/play/` (`play/index.html`, `play/styles.css`, `play/src/`, `play/assets/`) | The full game |
| `/media/cinematic-trailer.mp4`, `/media/cinematic-trailer-poster.jpg` | 40.8 s cinematic launch trailer (1280×720 H.264 + AAC), the website's hero video, and its poster frame (logo + Play now end card) |
| `/media/trailer.mp4`, `/media/trailer-poster.png` | 43 s gameplay trailer (1280×720 H.264 + AAC) and its poster, further down the website |
| `/media/posters/` | The three launch posters from the art pack, 1200×1800: `.webp` on the page, `.jpg` as the download |
| `/media/gallery/`, `/media/launch/` | Key-art stills (`.webp`), the hero poster still and end-band still (`.jpg`), web-size logos (`.webp`) |
| `/assets/icons/`, `/assets/fonts/` | The pack's six SVG feature icons; the two display fonts subsetted to WOFF2, with their SIL OFL licence files |
| `src/trailer/` | Dev-only cinematic-trailer pipeline: `shots.json` (shot list), `cinematic.py` (picture), `score.py` (music) |
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

The game and the website have no build step. The gameplay trailer is rebuilt with `node tools/record-trailer.mjs && python3 tools/make-trailer.py`
(needs Chrome, ffmpeg with libass, Python 3 + numpy, and the Noto Sans CJK font).

The cinematic trailer is rebuilt with (needs the UI/UX launch-art pack next to the repo, or `PUFFLING_ART_PACK=<folder>`):

```sh
node tools/record-cinematic.mjs          # real gameplay sessions + per-frame event logs -> test-output/cinematic/
node tools/render-music-stems.mjs        # the game's own music, one layer per stem, + its 7 SFX (OfflineAudioContext)
python3 src/trailer/cinematic.py src/trailer/shots.json   # 25 shots, 17 bars at 100 BPM -> media/cinematic-trailer.mp4
python3 tools/subset-fonts.py ../2026-10-26-puffling-flight-launch-art/fonts   # website display-font subsets
```

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
- Cinematic trailer (`media/cinematic-trailer.mp4`): key-art stills, title cards and logo by the project's UI/UX designer
  (launch-art pack), real gameplay recorded from this game (`tools/record-cinematic.mjs`), cut by `src/trailer/cinematic.py`.
  **Music:** only the game's own code-generated music and sound effects (`play/src/audio.js`, rendered stem by stem by
  `tools/render-music-stems.mjs`, arranged with numpy by `src/trailer/score.py`): intro (arpeggio) → rise (+bass, +hats/snare,
  +kick, snare roll, one silent beat) → drop at 0:19.2 (full loop + lead) → hard cut on the crash → C-major resolve under the logo.
  No licensed or third-party music. No voice-over. Same MIT licence.
- Website display fonts (bundled in `assets/fonts/`, subsetted to the characters the site uses, `font-display: swap`):
  **Lilita One** (Copyright 2011 Juan Montoreano, Reserved Font Name Lilita; SIL Open Font License 1.1, `OFL-LilitaOne.txt`) and **ZCOOL KuaiLe / 站酷快乐体**
  (Copyright 2018 The ZCOOL KuaiLe Project Authors; SIL Open Font License 1.1, `OFL-ZCOOLKuaiLe.txt`). Body text uses the visitor's system fonts.
- Posters, key-art stills, title cards, logo and the six feature icons (`assets/icons/`): from the project's UI/UX launch-art pack.
- Game fonts: the visitor's own system fonts; the game ships no font files.
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
| 10 | Emoji in feature cards depend on the system emoji font | Replaced in phase 2 by the pack's SVG icons (inline, `aria-hidden`, orange chip from `ICONS.md`) |

### Phase 2 (cinematic launch) GAPS

| # | Gap | Decision |
|---|---|---|
| 11 | **Wording mismatch (resolved):** the designer's end card `tc-05` and `WEBSITE.md` read **Play now / 立即游玩**; the owner's brief said **Play now / 立即开玩** | Resolved by the project manager's decision (21:27): **立即游玩 everywhere**. The website buttons and the top-bar short label now read 立即游玩 / 游玩, matching `tc-05` in the trailer (not re-rendered). The game in `play/` never used 开玩 |
| 12 | `WEBSITE.md` asks for a 1920×1080 hero video plus a 1280×720 one | Only 1280×720 is rendered (the owner's 720p cap); the one file serves every screen |
| 13 | `WEBSITE.md` links the lightbox download to the 1.1–1.4 MB `.png` poster masters | Linked the pack's optimised `.jpg` (184–228 KB); the page shows the `.webp` (109–141 KB). The `.png` masters stay in the pack only |
| 14 | The first poster export printed the GitHub Pages address on poster-01 and poster-03, and the trailer's end card had an optional address line | **Resolved:** the designer re-issued poster-01 and poster-03 (21:42) with the line 'PLAY FREE IN YOUR BROWSER · 浏览器免费畅玩' instead of the address; copied into `media/posters/` (`.webp` + `.jpg`). poster-02 never had an address and is unchanged. No poster, title card, logo, hero still or website text shows a URL |
| 14b | `ART.md` row 26 now asks the end card to carry the free-in-browser line instead of the address | Trailer **not re-rendered** (project manager's decision): the address line was already left out. The designer's `tc-05` end card itself already prints 'FREE IN YOUR BROWSER · 浏览器免费畅玩' (visible in `verify/frames/cine-37.0-endcard.jpg`); only the extra small line under it, from row 26, is missing |
| 15 | The hero loops the whole cinematic cut, gameplay HUD included, behind the centred logo | A soft radial veil over the video behind the title, on top of the pack's gradient scrim; poster frame is still-01, never still-07 (still-07 only in the gallery and in the trailer's drop, as in the shot list) |
| 16 | "▶ Watch trailer" target | Opens the cinematic cut with sound in a `<dialog>` lightbox (hero pauses, resumes on close) |
| 17 | Where the screenshots go | Kept below the key-art stills in the Gallery section |
| 18 | Pack's prebuilt web font subsets vs this page's text | Re-subsetted from the pack's OFL TTFs to exactly the site's characters (`tools/subset-fonts.py`): 6.5 KB + 35 KB; Noto Sans SC kept off the site (print-only, per `WEBSITE.md`) |
| 19 | The pack's icon `.svg` files carry the standard `xmlns="http://www.w3.org/2000/svg"` identifier | Kept in `assets/icons/` as delivered (it is a namespace name, never fetched); the inline copies in `index.html` drop it, so the page has no `http(s)://` strings |
| 20 | GitHub account suspended during phase 2 (403 / Pages 404) | Phase 2 is committed **locally only**, not pushed; verified against a local static server (`verify/static-server.mjs`, Range support, real MIME types) as a Pages stand-in |
| 21 | Local-only screenshots folder `verify/shots-local-server/` is 38 MB of full-size PNGs | Kept on disk, added to `.gitignore` (the only change to the plan's `.gitignore`); downscaled JPEG copies are committed in `verify/shots-launch/` |

Rough share invented by the builder: **0 %** of the game itself (plan code used as-is); about **35 %** of the whole repo
by decisions, all of it in the website, trailer and verification that the plan never covered.

## Phase 2 verification (2026-10-26 evening, local only: headless Google Chrome 156, `verify/static-server.mjs` on 127.0.0.1)

`SITE_BASE_URL=http://127.0.0.1:8765/ LABEL=local-server node verify/acceptance.mjs` → **26/26 pass** (`verify/results-local-server.json`):
the original website/game/locale/audio/phone checks plus C1–C8: cinematic-trailer ffprobe, HTTP 200 for 36 URLs (site, both trailers + posters,
3 posters ×2 formats, 7 stills, 6 icons, fonts + licences, logos, `/play/`), hero autoplay muted loop (readyState 4, currentTime advancing,
unmute / pause), reduced-motion poster-only hero, every image loads (naturalWidth > 0), SVG icons in the chip with no emoji left, lightbox
(arrows, Esc, download link, cinematic-with-sound dialog), and EN / zh-CN / zh-TW / zh-HK + toggle on desktop, Pixel 7 and iPhone 13 with no
horizontal overflow, no console errors and no requests to other hosts; the old gameplay trailer still plays below the posters.
Plan unit tests 12/12, plan browser suite 13/13 at `/play/`; `play/` unchanged (`git diff` empty, SHA-256 match).
Cinematic trailer frame grabs: `verify/frames/` (contact sheets `sheet.jpg`, `sheet2.jpg`). Screenshots: `verify/shots-launch/`.

## Phase 1 verification (2026-10-26, headless Google Chrome 156 via playwright-core 1.64.1)

| Check | Local | Live GitHub Pages |
|---|---|---|
| Plan Step 4 extractor | `CHECKSUMS_OK 18` | — |
| Plan Step 7 unit tests | 12/12 pass | — |
| Plan Step 8 browser suite (Chrome, desktop + iPhone 13 + Pixel 7 landscape) at `/play/` | 13/13 pass | 13/13 pass |
| Plan Step 9 browser suite (Firefox 157) | 10/10 pass | — |
| Plan Step 10 WebKit (optional) | skipped: missing Linux libraries (as predicted) | — |
| Plan T11 performance | fps 59.8, p95 0.40 ms; 4× throttle fps 60.3, p95 1.20 ms | fps 60.3, p95 0.40 ms; 4× throttle p95 1.40 ms |
| Plan Step 11 names / size | `NAMES_CLEAN`, game 108 KB | — |
| Builder acceptance `verify/acceptance.mjs` (website, game, phones, locales, audio, trailer) | 16/16 pass | 15/15 pass (static grep W0 is local-only) |
| HTTP status `/`, `/play/`, `/media/trailer.mp4` | — | 200, 200, 200 |
| Trailer (ffprobe) | 43.32 s, 1280×720 H.264 High yuv420p 25 fps + AAC-LC 48 kHz stereo, 4,205,120 bytes, faststart | same file, plays in the page (readyState 4, currentTime advances) |

Details: `verify/results-local.json`, `verify/results-live.json`, `verify/plan-file-hashes.json`, `verify/logs/`, and screenshots in `verify/shots-local/` and `verify/shots-live/`.
