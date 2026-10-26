#!/usr/bin/env python3
"""Dev-only: cuts the launch trailer from the REAL gameplay recorded by tools/record-trailer.mjs.
Burns in bilingual EN/中文 captions (libass, font Noto Sans CJK SC, SIL OFL 1.1, installed locally),
and mixes the game's own code-generated music + sound effects (captured from src/audio.js) with numpy.
Output: media/trailer.mp4 (1280x720 H.264 yuv420p + AAC, faststart) and media/trailer-poster.png.
Run from the repo root: python3 tools/make-trailer.py"""
import json, subprocess, wave, os
import numpy as np

T = 'test-output/trailer'
FONT_DIR = '/usr/share/fonts/opentype/noto'
FONT = 'Noto Sans CJK SC'
ev = json.load(open(f'{T}/events.json'))
SR = ev['sampleRate']
S = {s['name']: s for s in ev['sessions']}
M = S['desktop']['marks']

# (source video, start, end, EN caption, 中文 caption)
SEG = [
    ('desktop', 0.3, 3.6, 'Puffling Flight', '小海鹦飞飞'),
    ('desktop', M['playing'] - 0.6, M['playing'] + 6.4, 'Tap, click or press Space to flap', '轻触、点击或按空格键振翅'),
    ('desktop', M['score10'] - 0.6, M['score10'] + 4.4, 'The sky changes every 10 points', '每得 10 分，天色就会变化'),
    ('desktop', M['score20'] - 0.6, M['score20'] + 4.4, 'From dawn to sunset…', '从清晨飞到黄昏……'),
    ('desktop', M['score30'] - 0.4, M['autopilotOff'] + 0.2, '…and on into the night', '……一直飞进夜晚'),
    ('desktop', M['autopilotOff'] + 0.2, M['over'] + 3.2, 'Earn medals and beat your best', '赢取奖牌，刷新最高分'),
    ('phone', S['phone']['marks']['playing'] - 0.4, S['phone']['marks']['playing'] + 5.6, 'Plays on phones and desktops', '手机和电脑都能玩'),
    ('zh', 0.3, S['zh']['marks']['end'] - 0.1, 'English / 中文 · music and sound made in code', '中英双语 · 音乐和音效均由代码生成'),
    ('end', 0.0, 3.2, 'Play free in your browser', '在浏览器中免费畅玩'),
]
FADE = 0.25

def ts(x):
    h = int(x // 3600); m = int(x % 3600 // 60); s = x % 60
    return f'{h}:{m:02d}:{s:05.2f}'

# ---- video segments ----
inputs, chains, labels, out_t, t = [], [], [], [], 0.0
for i, (src, a, b, en, zh) in enumerate(SEG):
    d = b - a
    src_idx = {src: i, 'desktop': i}  # one decoder input per segment (an input stream feeds one filter pad)
    if src == 'end':
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '1.0', '-i', f'{T}/desktop.webm', '-frames:v', '1', f'{T}/endframe.png'], check=True)
        inputs += ['-loop', '1', '-framerate', '25', '-t', f'{d:.3f}', '-i', f'{T}/endframe.png']
    else:
        inputs += ['-i', f'{T}/{src}.webm']
    if src == 'end':
        f = (f"[{i}:v]boxblur=12:2,eq=brightness=-0.12,fps=25,scale=1280:720")
    elif src == 'phone':
        f = (f"[{src_idx['phone']}:v]trim=start={a:.3f}:end={b:.3f},setpts=PTS-STARTPTS,fps=25,scale=-2:720,"
             f"pad=1280:720:(ow-iw)/2:0:color=0x1a2446")
    else:
        f = f"[{src_idx[src]}:v]trim=start={a:.3f}:end={b:.3f},setpts=PTS-STARTPTS,fps=25,scale=1280:720"
    f += f",setsar=1,format=yuv420p,fade=t=in:st=0:d={FADE},fade=t=out:st={d-FADE:.3f}:d={FADE}[v{i}]"
    chains.append(f); labels.append(f'[v{i}]'); out_t.append((t, t + d)); t += d
TOTAL = t

# ---- captions (ASS) ----
ass = [
    '[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 1280', 'PlayResY: 720', '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    f'Style: Cap,{FONT},36,&H00EEF8FF,&H00FFFFFF,&H2840231D,&H2840231D,1,0,0,0,100,100,0,0,3,9,0,2,40,40,40,1',
    f'Style: Big,{FONT},84,&H00EEF8FF,&H00FFFFFF,&H0040231D,&H8C40231D,1,0,0,0,100,100,0,0,1,6,3,5,40,40,40,1',
    '', '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
]
for i, (src, a, b, en, zh) in enumerate(SEG):
    s, e = out_t[i]
    fade = r'{\fad(250,250)}'
    if i == 0:
        ass.append(f'Dialogue: 0,{ts(s)},{ts(e)},Cap,,0,0,40,,{fade}An original one-button flying game\\N原创单键飞行小游戏')
    elif src == 'end':
        ass.append(f'Dialogue: 0,{ts(s)},{ts(e)},Big,,0,0,0,,{fade}Puffling Flight\\N小海鹦飞飞')
        ass.append(f'Dialogue: 0,{ts(s)},{ts(e)},Cap,,0,0,60,,{fade}{en}\\N{zh}')
    else:
        ass.append(f'Dialogue: 0,{ts(s)},{ts(e)},Cap,,0,0,40,,{fade}{en}\\N{zh}')
open(f'{T}/captions.ass', 'w', encoding='utf-8').write('\n'.join(ass) + '\n')

graph = ';'.join(chains) + ';' + ''.join(labels) + f'concat=n={len(SEG)}:v=1:a=0[cat];' \
        f"[cat]subtitles={T}/captions.ass:fontsdir={FONT_DIR}[vout]"

# ---- audio: the game's own music loop + its sound effects at the real event times ----
def rd(p):
    with wave.open(p) as w:
        assert w.getframerate() == SR
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32767
music = rd(f'{T}/music.wav')
sfx = {k: rd(f'{T}/sfx-{k}.wav') for k in ('flap', 'score', 'hit', 'splash', 'best', 'click', 'swoosh')}
n = int(TOTAL * SR) + SR
mix = np.zeros(n, np.float32)
reps = int(np.ceil(n / len(music)))
mix += np.tile(music, reps)[:n] * 0.42
def put(name, at, gain):
    i = int(at * SR); s = sfx[name][: max(0, n - i)]
    if i >= 0: mix[i:i + len(s)] += s * gain
for i, (src, a, b, en, zh) in enumerate(SEG):
    if src == 'end': continue
    o = out_t[i][0]
    log = S[src]['log']
    prev = None
    for e in log:
        if prev is not None and a <= e['t'] < b:
            at = o + e['t'] - a
            if e['flaps'] > prev['flaps']: put('flap', at, 0.55)
            if e['score'] > prev['score']: put('score', at, 0.6)
            if e['state'] == 'dying' and prev['state'] != 'dying': put('hit', at, 0.7)
            if e['state'] == 'over' and prev['state'] != 'over': put('splash', at - 0.5, 0.6); put('best', at, 0.7)
        prev = e
    if src == 'zh':
        zm = S['zh']['marks']['menuEnd']
        if a <= zm < b: put('click', o + zm - a, 0.7)
mix = mix[: int(TOTAL * SR)]
fo = int(1.5 * SR); mix[-fo:] *= np.linspace(1, 0, fo)
fi = int(0.3 * SR); mix[:fi] *= np.linspace(0, 1, fi)
peak = float(np.abs(mix).max())
mix *= 0.89 / peak  # normalise to about -1 dBFS peak
with wave.open(f'{T}/trailer-audio.wav', 'w') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())

os.makedirs('media', exist_ok=True)
cmd = ['ffmpeg', '-v', 'error', '-y', '-threads', '2', *inputs, '-i', f'{T}/trailer-audio.wav',
       '-filter_complex', graph, '-map', '[vout]', '-map', f'{len(SEG)}:a',
       '-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-pix_fmt', 'yuv420p', '-r', '25',
       '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2', '-shortest', '-movflags', '+faststart',
       'media/trailer.mp4']
subprocess.run(cmd, check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{TOTAL - 1.6:.2f}', '-i', 'media/trailer.mp4', '-frames:v', '1', 'media/trailer-poster.png'], check=True)
print(f'TRAILER_OK duration_plan={TOTAL:.2f}s audio_peak={peak:.2f} segments={len(SEG)}')
