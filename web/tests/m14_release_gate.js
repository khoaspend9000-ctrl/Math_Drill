#!/usr/bin/env node
/* =============================================================================
 * M14-G1 / J1 — PRODUCTION RELEASE GATE
 * -----------------------------------------------------------------------------
 * One command that answers, with evidence instead of guesses:
 *   1. WHICH commit is live?   -> GET /api/meta/version (server identity)
 *   2. DO the live bytes match it?
 *      -> SHA-256 of the critical static files compared against the Git blobs
 *         of the SAME commit in the local repo.
 *   3. Are the auth/player endpoints properly gated?
 *      -> anonymous POST /api/player/data must be 401/403, NEVER 404
 *      -> anonymous GET  /api/admin/me   must be 401/403, NEVER 404
 *
 * M13 burned a long release window because the deployed commit could not be
 * identified from outside; the byte hashes had to be matched by hand. This
 * script closes that gap permanently.
 *
 * Usage:
 *   node web/tests/m14_release_gate.js
 *   MATHDRILL_BASE=https://math-drill-iwys.onrender.com node web/tests/m14_release_gate.js
 *
 * In-memory counters + one compact summary. No artifacts written.
 * Exit 0 = gate passed, 1 = gate failed, 2 = harness error.
 * ========================================================================== */
'use strict';
const crypto = require('crypto');
const path = require('path');
const { execFileSync } = require('child_process');

const BASE = (process.env.MATHDRILL_BASE || 'https://math-drill-iwys.onrender.com').replace(/\/+$/, '');
const REPO = path.join(__dirname, '..', '..');
/* git is not always on PATH (Windows GUI installs); allow an explicit binary. */
const GIT = process.env.MATHDRILL_GIT || 'git';

/* The critical static files that define the shipped web app. */
const CRITICAL = [
  'web/index.html',
  'web/style.css',
  'web/js/main.js',
  'web/js/states_real.js',
  'web/js/settings_states.js',
  'web/js/question_generator.js',
  'web/js/ui.js',
  'web/js/state_manager.js',
  /* M14-D2: the locked-lesson required-level affordance. */
  'web/js/data_loader.js'
];

let pass = 0, fail = 0;
const failures = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () {
    pass++; console.log('PASS  ' + name);
  }, function (e) {
    fail++; failures.push(name);
    console.log('FAIL  ' + name + ' :: ' + (e && e.message));
  });
}


function request(url, method, body) {
  return new Promise(function (resolve, reject) {
    const u = new URL(url);
    const lib = u.protocol === 'http:' ? require('http') : require('https');
    const headers = {};
    let payload = null;
    if (body !== undefined) {
      payload = Buffer.from(JSON.stringify(body));
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = payload.length;
    }
    const req = lib.request({
      hostname: u.hostname, port: u.port || (u.protocol === 'http:' ? 80 : 443),
      path: u.pathname + u.search, method: method || 'GET', headers: headers, timeout: 60000
    }, function (res) {
      const chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        const buf = Buffer.concat(chunks);
        resolve({ status: res.statusCode, headers: res.headers, buf: buf,
          sha256: crypto.createHash('sha256').update(buf).digest('hex') });
      });
    });
    req.on('timeout', function () { req.destroy(new Error('timeout ' + url)); });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function git(args) {
  return execFileSync(GIT, ['-C', REPO].concat(args), { encoding: 'utf8', timeout: 30000, maxBuffer: 1 << 24 });
}
/* Git stores a blob as "blob <len>\0<bytes>"; hashing the raw object bytes
   makes it directly comparable with an HTTP response body. */
function gitBlobSha(sha, rel) {
  const raw = execFileSync(GIT, ['-C', REPO, 'cat-file', 'blob', sha + ':' + rel],
    { timeout: 30000, maxBuffer: 1 << 26 });
  return crypto.createHash('sha256').update(raw).digest('hex');
}
function gitBlobSize(sha, rel) {
  return Number(git(['cat-file', '-s', sha + ':' + rel]).trim());
}


async function main() {
  const t0 = Date.now();
  let liveCommit = 'unknown';
  const hashLines = [];
  const anon = {};

  /* ---- 1. deployed identity ---------------------------------------------- */
  await check('GATE-01 GET / returns 200', async function () {
    const r = await request(BASE + '/', 'GET');
    if (r.status !== 200) throw new Error('status ' + r.status);
  });

  await check('GATE-02 GET /api/meta/version returns 200 + a commit', async function () {
    const r = await request(BASE + '/api/meta/version', 'GET');
    if (r.status !== 200) throw new Error('status ' + r.status);
    const b = JSON.parse(r.buf.toString('utf8'));
    if (b.ok !== true) throw new Error('ok=' + b.ok);
    if (typeof b.commit !== 'string' || !b.commit) throw new Error('no commit field');
    liveCommit = b.commit;
    console.log('      live_commit=' + liveCommit + ' branch=' + b.branch);
  });

  const knownCommit = /^[0-9a-f]{40}$/.test(liveCommit);

  await check('GATE-03 local repo contains the live commit', function () {
    if (!knownCommit) throw new Error('live commit is not a full sha: ' + liveCommit);
    git(['cat-file', '-e', liveCommit + '^{commit}']);
  });

  /* ---- 2. live bytes vs the live commit ---------------------------------- */
  if (knownCommit) {
    for (const rel of CRITICAL) {
      await check('GATE-HASH ' + rel.replace(/^web\//, '/'), async function () {
        const r = await request(BASE + '/' + rel.replace(/^web\//, ''), 'GET');
        if (r.status !== 200) throw new Error('status ' + r.status);
        const expected = gitBlobSha(liveCommit, rel);
        const size = gitBlobSize(liveCommit, rel);
        const line = (r.sha256 === expected ? 'MATCH' : 'MISMATCH') + ' ' + rel
          + ' live=' + r.sha256.slice(0, 12) + '/' + r.buf.length
          + ' git=' + expected.slice(0, 12) + '/' + size;
        hashLines.push(line);
        if (r.sha256 !== expected) throw new Error('live bytes differ from ' + liveCommit + ' (' + line + ')');
      });
    }
  }

  /* ---- 3. auth gating (never 404) ----------------------------------------- */
  await check('GATE-04 anonymous POST /api/player/data = 401/403 (not 404)', async function () {
    const r = await request(BASE + '/api/player/data', 'POST', { data: {} });
    anon.playerData = r.status;
    if (r.status !== 401 && r.status !== 403) {
      throw new Error('status ' + r.status + ' body=' + r.buf.toString('utf8').slice(0, 120));
    }
  });
  await check('GATE-05 anonymous GET /api/admin/me = 401/403 (not 404)', async function () {
    const r = await request(BASE + '/api/admin/me', 'GET');
    anon.adminMe = r.status;
    if (r.status !== 401 && r.status !== 403) throw new Error('status ' + r.status);
  });
  await check('GATE-06 unknown /api/* is JSON 404 (never static)', async function () {
    const r = await request(BASE + '/api/definitely-not-a-route', 'GET');
    if (r.status !== 404) throw new Error('status ' + r.status);
    const b = JSON.parse(r.buf.toString('utf8'));
    if (b.error !== 'NOT_FOUND') throw new Error('error=' + b.error);
  });

  const allMatch = hashLines.length === CRITICAL.length
    && hashLines.every(function (l) { return l.indexOf('MATCH') === 0; });
  console.log('');
  console.log('=== M14 PRODUCTION RELEASE GATE ===');
  console.log('BASE=' + BASE);
  console.log('LIVE_COMMIT=' + liveCommit);
  console.log('HASH_MATCH=' + (allMatch ? 'YES ' + hashLines.length + '/' + CRITICAL.length : 'NO'));
  hashLines.forEach(function (l) { console.log('  ' + l); });
  console.log('ANON_PLAYER_DATA=' + anon.playerData + '  ANON_ADMIN_ME=' + anon.adminMe);
  console.log('pass=' + pass + ' fail=' + fail + ' ms=' + (Date.now() - t0));
  if (fail > 0) {
    for (const f of failures) console.log('  - ' + f);
    process.exit(1);
  }
  console.log('PRODUCTION GATE PASSED');
  process.exit(0);
}
main().catch(function (err) {
  console.error('HARNESS_ERROR ' + (err && err.message));
  process.exit(2);
});
