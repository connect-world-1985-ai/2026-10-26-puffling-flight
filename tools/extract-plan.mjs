// Usage (from the project root): node tools/extract-plan.mjs <path-to-plan.md>
// Writes every "#### File: `path`" code block of the plan into the current folder, then checks the
// "#### Checksums (sha256)" block of the plan. Prints CHECKSUMS_OK or the mismatching files.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';

const planPath = process.argv[2];
if (!planPath) { console.error('usage: node tools/extract-plan.mjs <plan.md>'); process.exit(2); }
const lines = readFileSync(planPath, 'utf8').replace(/\r\n/g, '\n').split('\n');
const root = process.cwd();
const sha = (text) => createHash('sha256').update(text).digest('hex');
const written = new Map();
let expected = null;

for (let i = 0; i < lines.length; i++) {
  const file = /^#### File: `([^`]+)`\s*$/.exec(lines[i]);
  const sums = /^#### Checksums \(sha256\)\s*$/.test(lines[i]);
  if (!file && !sums) continue;
  let j = i + 1;
  while (j < lines.length && lines[j].trim() === '') j++;
  const open = /^(`{3,})[\w-]*\s*$/.exec(lines[j] || '');
  if (!open) throw new Error(`No code fence after line ${i + 1}`);
  const body = [];
  for (j++; j < lines.length && lines[j] !== open[1]; j++) body.push(lines[j]);
  if (j >= lines.length) throw new Error(`Unclosed code fence after line ${i + 1}`);
  i = j;
  if (sums) {
    expected = new Map(body.filter((l) => l.trim()).map((l) => { const [h, p] = l.trim().split(/\s+/); return [p, h]; }));
    continue;
  }
  const rel = file[1];
  if (rel === 'tools/extract-plan.mjs') continue; // this script is typed in by hand
  const target = resolve(root, rel);
  if (!target.startsWith(root + sep)) throw new Error(`Refusing to write outside the project: ${rel}`);
  const text = body.join('\n') + '\n';
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
  written.set(rel, sha(text));
  console.log(`${sha(text)}  ${rel}`);
}
console.log(`EXTRACTED ${written.size} files`);
if (!expected) { console.log('NO_CHECKSUM_BLOCK'); process.exit(1); }
const bad = [...expected].filter(([p, h]) => written.get(p) !== h).map(([p]) => p);
const extra = [...written.keys()].filter((p) => !expected.has(p));
if (bad.length || extra.length) { console.log('CHECKSUMS_MISMATCH ' + [...bad, ...extra].join(' ')); process.exit(1); }
console.log(`CHECKSUMS_OK ${expected.size}`);
