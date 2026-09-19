const fs = require('fs');
const crypto = require('crypto');
const ROOT = 'E:/lam_game_2026';
const CP = ROOT + '/web/CHECKPOINTS.md';

// 1) recompute master from filesystem
const files = [
  'web/js/states_real.js',
  'web/tests/m10b_state_integration.test.js',
  'web/tests/m10a_browser_load.test.js',
  'web/assets/backround1.jpg'
];
const manifest = {};
for (const f of files) {
  manifest[f] = crypto.createHash('sha256').update(fs.readFileSync(ROOT + '/' + f)).digest('hex');
}
const lines = Object.keys(manifest).sort().map(k => k + ':' + manifest[k] + '\n');
const master = crypto.createHash('sha256').update(lines.join('')).digest('hex');

// 2) read recorded master from CHECKPOINTS.md
const cp = fs.readFileSync(CP, 'utf8');
const idx = cp.lastIndexOf('## polish-m2-menu-dashboard-theory');
const recorded = (cp.substring(idx).match(/MASTER_SHA256: ([0-9a-f]{64})/) || [])[1];

console.log('BLOCK_PRESENT:', idx >= 0 ? 'YES' : 'NO');
console.log('RECOMPUTED_MASTER:', master);
console.log('RECORDED_MASTER  :', recorded);
console.log('VERIFY:', master === recorded ? 'PASS' : 'MISMATCH');
for (const k of Object.keys(manifest)) console.log('FILE_OK', k, manifest[k]);