'use strict';
/* POLISH M3 checkpoint verifier.
   1) recompute the file manifest + MASTER_SHA256 from the filesystem
   2) read the recorded MASTER_SHA256 from the polish-m3-secondary-systems block
   3) recompute the Python Desktop guard and compare with the recorded value */
const fs = require('fs');
const crypto = require('crypto');

const ROOT = 'E:/lam_game_2026';
const CP = ROOT + '/web/CHECKPOINTS.md';
const TAG = '## polish-m3-secondary-systems';

const changed = [
  'web/js/states_real.js',
  'web/js/ui.js',
  'web/js/main.js',
  'web/tests/polish_m3.test.js',
  'web/tests/ui_parity_p1.test.js',
  'web/tests/_run_m3_gate.ps1',
  'web/tests/_run_full_regression.ps1'
];

const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const master = map => {
  const lines = Object.keys(map).sort().map(k => k + ':' + map[k] + '\n');
  return crypto.createHash('sha256').update(lines.join('')).digest('hex');
};

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

const pyFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.py')).sort();
const pyMap = {};
for (const f of pyFiles) pyMap[f] = sha(ROOT + '/' + f);
const pyGuard = master(pyMap);
const pyRecorded = (tail.match(/PYTHON_SOURCE_GUARD_SHA256: ([0-9a-f]{64})/) || [])[1];

console.log('RECOMPUTED_MASTER   :', recomputed);
console.log('RECORDED_MASTER     :', recorded);
console.log('MASTER_VERIFY       :', recomputed === recorded ? 'PASS' : 'MISMATCH');
console.log('RECOMPUTED_PY_GUARD :', pyGuard);
console.log('RECORDED_PY_GUARD   :', pyRecorded);
console.log('PYTHON_GUARD_VERIFY :', pyGuard === pyRecorded ? 'PASS' : 'MISMATCH');
for (const k of changed) console.log('FILE_OK', k, manifest[k]);
console.log('VERIFY:', (recomputed === recorded && pyGuard === pyRecorded) ? 'PASS' : 'FAIL');
process.exit((recomputed === recorded && pyGuard === pyRecorded) ? 0 : 1);