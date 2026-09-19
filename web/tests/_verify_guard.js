'use strict';
/* _verify_guard.js — confirm PYTHON_SOURCE_GUARD unchanged from M3 baseline */
const fs = require('fs');
const c = require('crypto');
const R = 'E:/lam_game_2026';
const py = fs.readdirSync(R).filter(f => /\.py$/i.test(f) && !f.includes('pycache')).sort();
/* Canonical master() used by the checkpoint writers:
   sha256 of the sorted "path:sha256\n" lines, joined with ''.            */
const sha = f => c.createHash('sha256').update(fs.readFileSync(R + '/' + f)).digest('hex');
const map = {};
for (const f of py) map[f] = sha(f);
const guard = c.createHash('sha256')
  .update(Object.keys(map).sort().map(k => k + ':' + map[k] + '\n').join(''))
  .digest('hex');
console.log('PYTHON_SOURCE_GUARD=' + guard);
console.log('EXPECTED           =e6024127fe8f1dc5e68c3b91f7cb64d1ebd225b5bf6fb17cc534fb7e1566fe93');
console.log('PYTHON_GUARD_VERIFY=' + (guard === 'e6024127fe8f1dc5e68c3b91f7cb64d1ebd225b5bf6fb17cc534fb7e1566fe93' ? 'PASS' : 'MISMATCH'));
console.log('PY_COUNT=' + py.length);
console.log('\n--- per-file mtime (sorted by name) ---');
for (const f of py) {
  const st = fs.statSync(R + '/' + f);
  console.log(st.mtime.toISOString().slice(0, 16).replace('T', ' ') + '  ' + f);
}