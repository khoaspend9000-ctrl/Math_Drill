'use strict';
/* FINAL-QA checkpoint verifier — recomputes source manifest, asset manifest and
   the Python guard from the filesystem and compares with the recorded
   final-qa block. MUST mirror _make_checkpoint_finalqa.js's changed[] list and
   the pre-append rule for web/CHECKPOINTS.md (hash the file excluding the
   final-qa block). */
const fs = require('fs');
const crypto = require('crypto');

const ROOT = 'E:/lam_game_2026';
const CP = ROOT + '/web/CHECKPOINTS.md';
const TAG = '\n## final-qa';

const changed = [
  'server/server.js',
  'server/qa_bootstrap.js',
  'web/js/states_real.js',
  'web/tests/final_qa.test.js',
  'web/tests/final_qa_browser.test.js',
  'web/tests/_final_browser.js',
  'web/tests/_run_full_regression.ps1',
  'web/CHECKPOINTS.md'
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
const preAppend = cp.substring(0, idx);

const manifest = {};
for (const f of changed) {
  if (f === 'web/CHECKPOINTS.md') {
    /* Mirror the writer's pre-append rule: hash the file EXCLUDING the
       final-qa block so the hash is stable and non-self-referential
       (the block contains this very hash, so it must be computed against
       the state BEFORE the append — same as _make_checkpoint_finalqa.js). */
        const full = fs.readFileSync(ROOT + '/' + f, 'utf8');
    const marker = '\n## final-qa';
    const idx = full.lastIndexOf(marker);
    const base = idx >= 0 ? full.slice(0, idx) : full;
    manifest[f] = crypto.createHash('sha256').update(base).digest('hex');
  } else {
    manifest[f] = sha(ROOT + '/' + f);
  }
}
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