'use strict';
/* FINAL-QA browser gate runner (Part H wrapper).
   Runs web/tests/_final_browser.js (real backend + real Chromium, ~5-6 min) and
   only passes when it reports fail=0. Wrapped via spawn instead of execFileSync
   so the full output is preserved and forwarded (execFileSync truncates the
   child's stdout to a Buffer dump on failure).
   This file contains NO admin secrets (the admin credential is read at runtime
   from the server bootstrap stdout). */
const path = require('path');
const { spawnSync } = require('child_process');
const out = spawnSync(process.execPath, [path.join(__dirname, '_final_browser.js')], {
  cwd: path.join(__dirname, '..', '..'),
  timeout: 12 * 60 * 1000,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024
});
process.stdout.write(out.stdout || '');
process.stderr.write(out.stderr || '');
const m = (out.stdout || '').match(/FINAL_QA_BROWSER: pass=(\d+) fail=(\d+)/);
if (out.status !== 0 || !m || Number(m[2]) > 0) {
  console.log('FAILED: final browser QA did not report zero failures');
  process.exit(1);
}
console.log('FINAL_BROWSER_WRAPPER: pass=' + m[1] + ' fail=0');