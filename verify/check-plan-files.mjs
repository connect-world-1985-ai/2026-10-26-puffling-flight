// Compares every file extracted from the plan with the plan's own SHA-256 list (Step 4 "Checksums").
// Files moved under play/ for the website layout keep their exact bytes; 4 dev files and README differ on purpose.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const PLAN = {
  'index.html': 'c3b921fde0551d35960061c195e0cbea01ba06f9fcfb45f3d02b1723baa0fa26',
  'styles.css': 'cbbace4a8cd32a2f5aeb566a7a1d5920726f203be5dc22ffc8f7916003db1e61',
  'src/config.js': '6c2af42793daf1c8997dec348f0b0d77a7d7cba725c5d72b1a113159b03bff4e',
  'src/sim.js': 'a760aa680c06060b91ef8832fee40589d4367c52739b66e41c019e603defb62f',
  'src/i18n.js': 'a1b49ddfc73c6db384e7f250332262d8a74600ef9d02a679ae3ae5401a4ae3d8',
  'src/storage.js': '19590d56998dadacb8c9278fb63db702be6d219d53a2003c265c3f931ab9ae78',
  'src/audio.js': '58d1210f8f8cffb172b2ad89d1f24e004d6d3eafdae7b3e876e1e0a407bddf26',
  'src/render.js': 'b388b49447c0b0eedfaf9691498152f977f67e046c75a683689b6348d82f9d5c',
  'src/main.js': 'b480517ac70b293a42f56b652995a1af098767b7bebbbd58e69ded1a01c6c59a',
  'assets/icon.svg': 'ccb01ee74e78fb2c046ed0879717f95ec3a99c99b36630f8c922ce28f5062434',
  'tools/serve.mjs': 'c498d78892c121dccc81f71df958ae5eebbb0602b55090c91a8782d77b83e805',
  'tools/make-icons.mjs': '1e4ed67e0cc1e3798c2cda1328ea555baace417fe7d0fae4522098b619d17d43',
  'tests/unit.test.mjs': '0462aa5203a1debfdea84fa6479eb3375555675bcc9f3bbb966d2a4b67e4ebcf',
  'tests/e2e.mjs': 'd15ddb62fbd5ed55723de877ae74c3d3122edc588aa782a48d2f5c46ec5157b0',
  'package.json': '0af3fa709552615c64da0deadcb2ce27c311d7b90489958e4631729989b39187',
  '.gitignore': '84cd6aba0bc2387660a5831ddcf6494fdf14bfe9d32093f871f1231d3353fc67',
  'README.md': 'a046ec10e3dbd7edb8391ff985cce6752eb5dadb656a3cba0bc135540fac64a8',
  'LICENSE': '247593549bea0d8a270b5dabbda6e7d40a1420318f4d592e9cb325830abbc17f',
  'tools/extract-plan.mjs': '69a490b91d999ee94c0dd1a80a864333e34213bf9c1b17188e2bcff384038afe',
};
const MOVED = new Set(['index.html', 'styles.css', 'src/config.js', 'src/sim.js', 'src/i18n.js', 'src/storage.js', 'src/audio.js', 'src/render.js', 'src/main.js', 'assets/icon.svg']);
const rows = [];
for (const [p, h] of Object.entries(PLAN)) {
  const at = MOVED.has(p) ? 'play/' + p : p;
  const actual = existsSync(at) ? createHash('sha256').update(readFileSync(at)).digest('hex') : 'MISSING';
  rows.push({ planPath: p, repoPath: at, identical: actual === h, plan: h, actual });
}
const same = rows.filter((r) => r.identical).length;
writeFileSync('verify/plan-file-hashes.json', JSON.stringify({ identical: same, total: rows.length, rows }, null, 2) + '\n');
for (const r of rows) console.log(`${r.identical ? 'SAME   ' : 'CHANGED'} ${r.repoPath}`);
console.log(`PLAN_FILES identical=${same}/${rows.length}`);
