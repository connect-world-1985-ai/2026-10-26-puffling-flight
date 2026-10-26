#!/usr/bin/env python3
"""Dev-only: subsets the launch-art pack's OFL fonts to exactly the characters the website uses, as WOFF2.
Run from the repo root: python3 tools/subset-fonts.py <pack-fonts-dir>
Writes assets/fonts/*.woff2 and copies each font's OFL licence next to it."""
import os, re, shutil, subprocess, sys

PACK = sys.argv[1]
OUT = 'assets/fonts'
os.makedirs(OUT, exist_ok=True)
text = ''.join(open(f, encoding='utf-8').read() for f in ('index.html', 'site.js'))
text = re.sub(r'\s+', ' ', text)
chars = set(text) | set(' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~·—–…“”‘’©×↑→←')
cjk = {c for c in chars if ord(c) > 0x2E80}
latin = {c for c in chars if ord(c) < 0x2E80}
open('test-output/subset-latin.txt', 'w', encoding='utf-8').write(''.join(sorted(latin)))
open('test-output/subset-all.txt', 'w', encoding='utf-8').write(''.join(sorted(latin | cjk)))
JOBS = [
    ('LilitaOne-Regular.ttf', 'lilita-one.woff2', 'subset-latin.txt', [], 'OFL-LilitaOne.txt'),
    ('ZCOOLKuaiLe-Regular.ttf', 'zcool-kuaile.woff2', 'subset-all.txt', [], 'OFL-ZCOOLKuaiLe.txt'),
    # Noto Sans SC stays print-only (WEBSITE.md): the body text uses the system font stack
]
for src, dst, chars_file, extra, lic in JOBS:
    subprocess.run(['pyftsubset', f'{PACK}/{src}', f'--text-file=test-output/{chars_file}', '--flavor=woff2',
                    '--layout-features=*', '--no-hinting', '--desubroutinize', f'--output-file={OUT}/{dst}', *extra], check=True)
    shutil.copy(f'{PACK}/{lic}', f'{OUT}/{lic}')
    print(f'{dst}: {os.path.getsize(f"{OUT}/{dst}")} bytes')
print(f'SUBSET_OK latin={len(latin)} cjk={len(cjk)}')
