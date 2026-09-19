'use strict';
// Repro: verify that qa_bootstrap seeds the admin with the harness-supplied
// MATHDRILL_ADMIN_PASSWORD (not a different random value).
const { spawn } = require('child_process');
const path = require('path');

const PORT = 3031;
const ADMIN_PW = 'qa-admin-repro-' + Date.now().toString(36);
const ROOT = 'E:/lam_game_2026';
const cwd = path.join(ROOT, 'server');

const child = spawn(process.execPath, ['qa_bootstrap.js'], {
  cwd: cwd,
  env: Object.assign({}, process.env, {
    QA_PORT: String(PORT),
    MATHDRILL_ADMIN_PASSWORD: ADMIN_PW,
    NODE_ENV: 'test'
  }),
  stdio: ['ignore', 'pipe', 'pipe']
});

let out = '';
let settled = false;
child.stdout.on('data', d => { out += String(d); });
child.stderr.on('data', d => { console.log('[STDERR]', d.toString().trim()); });

const http = require('http');
function tryLogin(attempt) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1', port: PORT, method: 'POST',
      path: '/api/auth/login',
      headers: { 'Content-Type': 'application/json' }
    }, res => {
      let b = '';
      res.on('data', d => b += String(d));
      res.on('end', () => {
        console.log(`[LOGIN_ATTEMPT_${attempt}] status=${res.statusCode} body=${b}`);
        resolve(res.statusCode === 200);
      });
    });
    req.on('error', e => { console.log(`[REQ_ERR_${attempt}]`, e.message); resolve(false); });
    req.end(JSON.stringify({ username: 'admin', password: ADMIN_PW }));
  });
}

child.on('exit', () => { console.log('[CHILD_EXIT]'); });

setTimeout(async () => {
  console.log('[REPRO] seeded PW (harness-known):', ADMIN_PW);
  console.log('[REPRO] bootstrap stdout so far:', JSON.stringify(out));
  const ok1 = await tryLogin(1);
  console.log('[REPRO] tryLogin(1) using harness-known PW ->', ok1 ? 'OK' : 'FAIL');
  if (!ok1) {
    // Fallback: fetch the actual seeded password from bootstrap stdout
    const m = out.match(/QA_ADMIN user=admin password=([^\\s]+)/);
    console.log('[REPRO] parsed pw from stdout:', m ? m[1] : 'NONE');
    if (m) {
      const ok2 = await tryLogin(2);
      console.log('[REPRO] tryLogin(2) using stdout-parsed PW ->', ok2 ? 'OK' : 'FAIL');
    }
  }
  setTimeout(() => { child.kill(); process.exit(0); }, 500);
}, 3500);
