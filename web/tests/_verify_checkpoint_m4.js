'use strict';
/* POLISH M4 checkpoint verifier.
   1) recompute the source manifest + MASTER_SHA256 from the filesystem
   2) recompute the asset manifest (Desktop source vs web copy byte-identity)
   3) recompute the Python Desktop guard
   and compare everything with the recorded polish-m4-responsive-assets-book block. */
const fs = require('fs');
const crypto = require('crypto');

const ROOT = 'E:/lam_game_2026';
const CP = ROOT + '/web/CHECKPOINTS.md';
const TAG = '## polish-m4-responsive-assets-book';

const changed = [
  'web/js/states_real.js',
  'web/js/ui.js',
  'web/js/main.js',
  'web/js/theory_pages.js',
  'web/index.html',
  'web/tests/polish_m4.test.js',
  'web/tests/book_runtime_probe.test.js',
  'web/tests/ui_parity_p1.test.js',
  'web/tests/m10a_browser_load.test.js',
  'web/tests/m4_states.test.js',
  'web/tests/_run_full_regression.ps1',
  'web/tests/_run_m4_gate.ps1',
  'web/tests/_m4_browser.js',
  'web/tests/_verify_guard.js'
];

const assets = [
  ['nen_game.png', 'web/assets/nen_game.png'],
  ['pixel_clover.png', 'web/assets/pixel_clover.png'],
  ['favicon.png', 'web/assets/favicon.png'],
  ['defeat.png', 'web/assets/defeat.png'],
  ['gt2.gif', 'web/assets/gt2.gif'],
  ['main_character.png', 'web/assets/main_character.png'],
  ['setting.png', 'web/assets/setting.png'],
  ['Untitled_design.png', 'web/assets/Untitled_design.png'],
  ['victory_text.png', 'web/assets/victory_text.png'],
  ['math_lessons.json', 'web/data/math_lessons.json']
];

const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const master = map => crypto.createHash('sha256')
  .update(Object.keys(map).sort().map(k => k + ':' + map[k] + '\n').join(''))
  .digest('hex');

if (!fs.existsSync(CP)) { console.log('BLOCK_PRESENT: NO (CHECKPOINTS.md missing)'); process.exit(1); }
const cp = fs.readFileSync(CP, 'utf8');
const idx = cp.lastIndexOf(TAG);
console.log('BLOCK_PRESENT:', idx >= 0 ? 'YES' : 'NO');
if (idx < 0) process.exit(1);
const tail = cp.substring(idx);

const manifest = {};
for (const f of changed) manifest[f] = sha(ROOT + '/' + f);
const recomputed = master(manifest);
const recorded = (tail.match(/MASTER_SHA256: ([0-9a-f]{64})/) || [])[1];

let assetAllOk = true;
const assetMap = {};
for (const [src, dst] of assets) {
  const s = sha(ROOT + '/' + src);
  const d = sha(ROOT + '/' + dst);
  assetMap[dst] = s + '|' + d;
  const ok = s === d;
  if (!ok) assetAllOk = false;
  console.log('ASSET_OK', ok ? 'YES' : 'NO ', src, '->', dst, d);
}
const assetRecomputed = master(assetMap);
const assetRecorded = (tail.match(/ASSET_MANIFEST_SHA256: ([0-9a-f]{64})/) || [])[1];

const pyFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.py')).sort();
const pyMap = {};
for (const f of pyFiles) pyMap[f] = sha(ROOT + '/' + f);
const pyGuard = master(pyMap);
const pyRecorded = (tail.match(/PYTHON_SOURCE_GUARD_SHA256: ([0-9a-f]{64})/) || [])[1];

const masterOk = recomputed === recorded;
const assetOk = assetRecomputed === assetRecorded && assetAllOk;
const pyOk = pyGuard === pyRecorded;

console.log('RECOMPUTED_MASTER   :', recomputed);
console.log('RECORDED_MASTER     :', recorded);
console.log('MASTER_VERIFY       :', masterOk ? 'PASS' : 'MISMATCH');
console.log('RECOMPUTED_ASSETS   :', assetRecomputed);
console.log('RECORDED_ASSETS     :', assetRecorded);
console.log('ASSET_VERIFY        :', assetOk ? 'PASS' : 'MISMATCH');
console.log('RECOMPUTED_PY_GUARD :', pyGuard);
console.log('RECORDED_PY_GUARD   :', pyRecorded);
console.log('PYTHON_GUARD_VERIFY :', pyOk ? 'PASS' : 'MISMATCH');
for (const k of changed) console.log('FILE_OK', k, manifest[k]);
console.log('VERIFY:', (masterOk && assetOk && pyOk) ? 'PASS' : 'FAIL');
process.exit((masterOk && assetOk && pyOk) ? 0 : 1);