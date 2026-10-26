#!/usr/bin/env python3
"""Cinematic launch-trailer pipeline for Puffling Flight, driven by a JSON shot list (src/trailer/shots.json).

  python3 src/trailer/cinematic.py src/trailer/shots.json

Each shot is rendered to its own 1280x720 / 25 fps clip (never above 720p), clips are joined with hard cuts, and the
score is arranged by src/trailer/score.py from stems of the game's OWN music (tools/render-music-stems.mjs) with the
game's own sound effects on the real gameplay events. Output: H.264 High yuv420p + AAC, +faststart, plus a poster.

Shot kinds (durations in beats of the game's 100 BPM: 1 beat = 0.6 s = 15 frames)
  black : solid colour, nothing else (the silent beat before the drop)
  still : key-art still, eased pan & zoom (zoompan on a 2x upscale); "zoom": [from, to], "focus": [[fx,fy],[fx,fy]]
  card  : transparent title-card PNG popped in 92% -> 104% -> 100% over 6 frames, hard cut out, over solid ink or a
          blurred, darkened still ("bg": "#0d1126" | "still:<path>", "bg_focus": [fx, fy])
  clip  : REAL gameplay recorded by tools/record-cinematic.mjs: "session" + ("at": mark | "at_score": n) + "offset",
          "speed", optional "zoom"/"focus" push-in; desktop footage gets a blurred-stage fill instead of the plain bands
  end   : end card overlay (popped in, then a slow 100 -> 103% drift) over a blurred still, optional small text line,
          fade to black at the end
Common: "flash": true (2-frame white flash), "sfx": [[name, beat_offset, gain_db]], "event_sfx": true
"""
import json, os, subprocess, sys

SPEC = json.load(open(sys.argv[1]))
# "{pack}" in any string = the UI/UX launch-art pack folder (relative to the repo root; not part of the repo)
PACK = os.environ.get('PUFFLING_ART_PACK', SPEC.get('pack', '../2026-10-26-puffling-flight-launch-art'))
SPEC = json.loads(json.dumps(SPEC).replace('{pack}', PACK))
REC = SPEC.get('recordings', 'test-output/cinematic')
BUILD = SPEC.get('build_dir', 'test-output/cinematic/build')
OUT = SPEC.get('output', 'media/cinematic-trailer.mp4')
POSTER = SPEC.get('poster', 'media/cinematic-trailer-poster.jpg')
FONTS = SPEC.get('fonts_dir', 'assets/fonts')
W, H, FPS = 1280, 720, 25
BEAT = 60 / SPEC.get('bpm', 100)
assert W <= 1280 and H <= 720, 'renders must stay at 720p or below'
os.makedirs(BUILD, exist_ok=True)
EV = {s['name']: s for s in json.load(open(f'{REC}/events.json'))['sessions']}


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.stderr.write(r.stderr[-3000:]); raise SystemExit('ffmpeg failed')


def ts(x):
    return f'{int(x // 3600)}:{int(x % 3600 // 60):02d}:{x % 60:05.2f}'


def ease(e):
    return f'(({e})*({e})*(3-2*({e})))'


def zp(z0, z1, f0, f1, n, per_frame):
    """zoompan with eased zoom and a focus point (fraction of the frame) that stays at the same place on screen."""
    p = ease(f'min(on/{max(1, n - 1)},1)')
    z = f'({z0}+({z1}-{z0})*{p})'
    fx = f'({f0[0]}+({f1[0]}-{f0[0]})*{p})'
    fy = f'({f0[1]}+({f1[1]}-{f0[1]})*{p})'
    x = f'max(0,min(iw-iw/zoom,iw*{fx}-iw/zoom/2))'
    y = f'max(0,min(ih-ih/zoom,ih*{fy}-ih/zoom/2))'
    return f"zoompan=z='{z}':x='{x}':y='{y}':d={1 if per_frame else n}:s={W}x{H}:fps={FPS}"


def bg_chain(bg, n, inp, idx, focus=(0.5, 0.5), blur=18, darken=-0.25, drift=(1.0, 1.03)):
    if bg.startswith('still:'):
        inp += ['-loop', '1', '-framerate', str(FPS), '-t', f'{n / FPS + 0.2}', '-i', bg[6:]]
        return (f"[{idx}:v]scale={W * 2}:{H * 2}:force_original_aspect_ratio=increase,crop={W * 2}:{H * 2},"
                f"{zp(drift[0], drift[1], focus, focus, n, False)},gblur=sigma={blur},eq=brightness={darken}:saturation=1.1")
    inp += ['-f', 'lavfi', '-t', f'{n / FPS + 0.2}', '-i', f'color=c={bg.replace("#", "0x")}:s={W}x{H}:r={FPS}']
    return f'[{idx}:v]null'


POP = "if(lt(n,3),0.92+0.04*n,if(lt(n,6),1.04-0.04*(n-3)/3,1))"


def score_time(session, n):
    for e in EV[session]['log']:
        if e['score'] >= n: return e['t']
    raise SystemExit(f'score {n} not reached in {session}')


def clip_t0(s):
    if 'at_score' in s: base = score_time(s['session'], s['at_score'])
    elif 'at' in s: base = EV[s['session']]['marks'][s['at']]
    else: base = 0.0
    return max(0.0, base + s.get('offset', 0.0))


def text_ass(s, path, d):
    lines = ['[Script Info]', 'ScriptType: v4.00+', f'PlayResX: {W}', f'PlayResY: {H}', '', '[V4+ Styles]',
             'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
             f"Style: T,{SPEC.get('small_font', 'Lilita One')},26,&H00EEF8FF,&H00FFFFFF,&H0040231D,&H80000000,0,0,0,0,100,100,1,0,1,2.5,0,5,20,20,20,1",
             '', '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text']
    for t in s.get('texts', []):
        t0 = t.get('beat', 0) * BEAT
        lines.append(f"Dialogue: 0,{ts(t0)},{ts(d)},T,,0,0,0,,{{\\an5\\pos({int(W * t.get('x', 0.5))},{int(H * t['y'])})\\fs{t.get('size', 26)}\\fad(300,0)}}{t['text']}")
    open(path, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')


def render(i, s):
    n = int(round(s['beats'] * BEAT * FPS))
    d = n / FPS
    out = f'{BUILD}/shot_{i:02d}.mp4'
    k = s['kind']; inp = []
    if k == 'black':
        inp = ['-f', 'lavfi', '-t', f'{d + 0.2}', '-i', f"color=c={s.get('bg', 'black')}:s={W}x{H}:r={FPS}"]
        chain = '[0:v]null'
    elif k == 'still':
        inp = ['-loop', '1', '-framerate', str(FPS), '-t', f'{d + 0.2}', '-i', s['src']]
        z = s.get('zoom', [1.0, 1.08]); f = s.get('focus', [[0.5, 0.5], [0.5, 0.5]])
        assert max(z) <= 1.15, 'keep still zooms under ~115% (pack note)'
        chain = (f"[0:v]scale={W * 2}:{H * 2}:force_original_aspect_ratio=increase,crop={W * 2}:{H * 2},"
                 f"{zp(z[0], z[1], f[0], f[1], n, False)}")
    elif k in ('card', 'end'):
        bgc = bg_chain(s.get('bg', '#0d1126'), n, inp, 0, tuple(s.get('bg_focus', (0.5, 0.5))),
                       drift=(1.0, 1.03) if k == 'end' else (1.0, 1.02))
        inp += ['-loop', '1', '-framerate', str(FPS), '-t', f'{d + 0.2}', '-i', s['src']]
        if k == 'card':
            sc = f"trunc({W}*{POP}/2)*2"
        else:  # pop in, then a slow 100 -> 103 % drift
            sc = f"trunc({W}*if(lt(n,6),{POP},1+0.03*(n-6)/{max(1, n - 6)})/2)*2"
        chain = (f"{bgc}[bg];[1:v]format=rgba,scale=w='{sc}':h=-2:eval=frame[c];"
                 f"[bg][c]overlay=x=(W-w)/2:y=(H-h)/2:eval=frame")
    elif k == 'clip':
        sp = s.get('speed', 1.0)
        t0 = clip_t0(s)
        inp = ['-ss', f'{t0:.3f}', '-t', f'{d * sp + 0.6:.3f}', '-i', f"{REC}/{s['session']}.webm"]
        head = f"[0:v]setpts=(PTS-STARTPTS)/{sp},fps={FPS},trim=duration={d + 0.1:.3f},setpts=PTS-STARTPTS"
        vp = EV[s['session']]['viewport']
        if vp['width'] != W or vp['height'] != H:  # phone: pillarbox on deep night ink, as the shot list asks
            chain = (f"{head},scale=-2:{H - 40}[fg];color=c=0x0d1126:s={W}x{H}:r={FPS}[pb];"
                     f"[pb][fg]overlay=(W-w)/2:20:shortest=1")
        else:  # desktop: crop the game stage and fill the side bands with a blurred copy of it
            vw = next((e['w'] for e in EV[s['session']]['log'] if e.get('w')), 720)
            sw = min(W, int(round(vw * H / 640 / 2) * 2))
            chain = (f"{head},crop={sw}:{H}:{(W - sw) // 2}:0,split[a][b];"
                     f"[a]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},gblur=sigma=28,"
                     f"eq=brightness=-0.22:saturation=1.2[bgc];[bgc][b]overlay=(W-w)/2:0")
        if s.get('zoom'):
            z = s['zoom']; f = s.get('focus', [[0.5, 0.5], [0.5, 0.5]])
            chain += f",scale={W * 2}:{H * 2},{zp(z[0], z[1], f[0], f[1], n, True)}"
    else:
        raise SystemExit('unknown kind ' + k)
    post = ['eq=contrast=1.06:saturation=1.1', 'vignette=angle=PI/6']
    if s.get('texts'):
        ass = f'{BUILD}/shot_{i:02d}.ass'; text_ass(s, ass, d)
        post.append(f'subtitles={ass}:fontsdir={FONTS}')
    if s.get('flash'): post.append('fade=t=in:st=0:d=0.08:color=white')
    if s.get('fade_in'): post.append(f"fade=t=in:st=0:d={s['fade_in']}")
    if s.get('fade_out'): post.append(f"fade=t=out:st={d - s['fade_out']:.3f}:d={s['fade_out']}")
    post.append('format=yuv420p')
    graph = chain + ',' + ','.join(post) + '[v]'
    run(['ffmpeg', '-v', 'error', '-y', '-threads', '2', *inp, '-filter_complex', graph, '-map', '[v]', '-frames:v', str(n),
         '-r', str(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-an', out])
    return out, n


def cues_for(s, t_start, d):
    """SFX cues: explicit ones (in beats) plus, for gameplay, the real logged events inside the clip window."""
    cues = [{'name': nm, 't': t_start + b * BEAT, 'db': db} for nm, b, db in s.get('sfx', [])]
    if s['kind'] == 'clip' and s.get('event_sfx'):
        sp = s.get('speed', 1.0); t0 = clip_t0(s); prev = None
        for e in EV[s['session']]['log']:
            if prev is not None and t0 <= e['t'] < t0 + d * sp:
                at = t_start + (e['t'] - t0) / sp
                if e['flaps'] > prev['flaps']: cues.append({'name': 'flap', 't': at, 'db': -3})
                if e['score'] > prev['score']: cues.append({'name': 'score', 't': at, 'db': 0})
                if e['state'] == 'dying' and prev['state'] != 'dying': cues.append({'name': 'hit', 't': at, 'db': 2})
                if e['state'] == 'over' and prev['state'] != 'over':
                    cues.append({'name': 'splash', 't': at - 0.5, 'db': 0})
                    cues.append({'name': 'best', 't': at, 'db': 1})
            prev = e
    return cues


def main():
    parts, frames, cues = [], 0, []
    for i, s in enumerate(SPEC['shots']):
        p, n = render(i, s)
        t = frames / FPS
        cues += cues_for(s, t, n / FPS)
        parts.append(p); frames += n
        print(f"shot {i + 1:02d} {s['kind']:5s} {t:6.2f}-{frames / FPS:6.2f} {s.get('id', '')}", flush=True)
    total = frames / FPS
    json.dump({'total': total, 'cues': cues, 'arrangement': SPEC['music']}, open(f'{BUILD}/cues.json', 'w'), indent=1)
    run([sys.executable, 'src/trailer/score.py', f'{BUILD}/cues.json', f'{BUILD}/score.wav'])
    with open(f'{BUILD}/concat.txt', 'w') as f:
        for p in parts: f.write(f"file '{os.path.abspath(p)}'\n")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', f'{BUILD}/concat.txt', '-i', f'{BUILD}/score.wav',
         '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', str(SPEC.get('crf', 19)),
         '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', str(FPS), '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2',
         '-shortest', '-movflags', '+faststart', OUT])
    run(['ffmpeg', '-v', 'error', '-y', '-ss', f"{SPEC.get('poster_time', total - 3):.2f}", '-i', OUT, '-frames:v', '1', '-q:v', '2', POSTER])
    print(f'CINEMATIC_OK {OUT} {total:.2f}s shots={len(parts)} cues={len(cues)}')


main()
