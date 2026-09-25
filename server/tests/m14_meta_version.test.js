/* M14-G1 — DEPLOY IDENTITY ENDPOINT TESTS (T01-T09). Real HTTP server. */
'use strict';
const http = require('http');
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const SERVER_PATH = path.join(__dirname, '..', 'server.js');

let passed = 0, failed = 0;
const failures = [];

function test(name, fn) {
  return Promise.resolve().then(fn).then(function () {
    passed++; console.log('PASS  ' + name);
  }, function (e) {
    failed++; failures.push({ name: name, err: e });
    console.log('FAIL  ' + name + ' :: ' + (e && e.message));
  });
}

function httpRequest(port, method, p, body, cookie) {
  return new Promise(function (resolve, reject) {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    if (cookie) headers['Cookie'] = cookie;
    const req = http.request({ host: 'localhost', port: port, path: p, method: method, headers: headers }, function (res) {
      let b = ''; res.on('data', function (c) { b += c; });
      res.on('end', function () { resolve({ status: res.statusCode, headers: res.headers, body: b }); });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function boot(envPatch) {
  for (const k of Object.keys(envPatch || {})) {
    if (envPatch[k] === null) delete process.env[k]; else process.env[k] = envPatch[k];
  }
  delete require.cache[require.resolve(SERVER_PATH)];
  const srv = require(SERVER_PATH);
  const server = await srv.start();
  return { srv: srv, port: server.address().port };
}

async function main() {
  process.env.NODE_ENV = 'test';
  process.env.MATHDRILL_ADMIN_PASSWORD = 'meta_test_secret';
  const dataDir = path.join(__dirname, 'data_test_meta');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  for (const f of ['users.json', 'sessions.json', 'mathdrill.db', 'mathdrill.db-shm', 'mathdrill.db-wal']) {
    const fp = path.join(dataDir, f);
    if (fs.existsSync(fp)) { try { fs.unlinkSync(fp); } catch (e) {} }
  }

  // ---- 1) RENDER_GIT_COMMIT present (the production path) ----
  let s = await boot({ PORT: '0', MATHDRILL_DATA_DIR: dataDir, MATHDRILL_BACKEND: null,
                       RENDER_GIT_COMMIT: '9f0344c012b54b695def9612bc10b9d143292e23' });
  await test('T01 GET /api/meta/version returns 200', async function () {
    const r = await httpRequest(s.port, 'GET', '/api/meta/version');
    assert.strictEqual(r.status, 200);
  });
  await test('T02 body ok=true and service name', async function () {
    const r = await httpRequest(s.port, 'GET', '/api/meta/version');
    const b = JSON.parse(r.body);
    assert.strictEqual(b.ok, true);
    assert.strictEqual(b.service, 'math-drill');
  });
  await test('T03 commit comes from RENDER_GIT_COMMIT exactly', async function () {
    const r = await httpRequest(s.port, 'GET', '/api/meta/version');
    assert.strictEqual(JSON.parse(r.body).commit, '9f0344c012b54b695def9612bc10b9d143292e23');
  });
  await test('T04 no auth required (public read-only identity)', async function () {
    const r = await httpRequest(s.port, 'GET', '/api/meta/version');
    assert.ok(r.status === 200);
  });
  await test('T05 security headers still applied', async function () {
    const r = await httpRequest(s.port, 'GET', '/api/meta/version');
    assert.strictEqual(r.headers['x-content-type-options'], 'nosniff');
    assert.ok(r.headers['content-security-policy']);
  });
  await test('T06 unknown /api/meta/* is JSON 404 (never static)', async function () {
    const r = await httpRequest(s.port, 'GET', '/api/meta/does-not-exist');
    assert.strictEqual(r.status, 404);
    assert.strictEqual(JSON.parse(r.body).error, 'NOT_FOUND');
  });
  await test('T07 endpoint never leaks extra fields', async function () {
    const r = await httpRequest(s.port, 'GET', '/api/meta/version');
    const b = JSON.parse(r.body);
    assert.strictEqual(Object.keys(b).sort().join(','), 'branch,commit,ok,service,uptimeSec');
  });
  await test('T09 uptimeSec is a non-negative integer (M14-F1 cold-start visibility)', async function () {
    const r = await httpRequest(s.port, 'GET', '/api/meta/version');
    const b = JSON.parse(r.body);
    assert.strictEqual(typeof b.uptimeSec, 'number');
    assert.ok(Number.isInteger(b.uptimeSec), 'uptimeSec must be an integer, got ' + b.uptimeSec);
    assert.ok(b.uptimeSec >= 0, 'uptimeSec must be >= 0, got ' + b.uptimeSec);
    assert.ok(b.uptimeSec < 3600, 'a freshly booted server must report < 1h, got ' + b.uptimeSec);
  });
  await s.srv.stop();

  // ---- 2) RENDER_GIT_COMMIT absent -> must not 500 ----
  s = await boot({ RENDER_GIT_COMMIT: null, GIT_COMMIT: null });
  await test('T08 missing deploy env still 200, never a crash', async function () {
    const r = await httpRequest(s.port, 'GET', '/api/meta/version');
    assert.strictEqual(r.status, 200);
    const b = JSON.parse(r.body);
    assert.ok(b.commit === 'unknown' || /^[0-9a-f]{7,40}$/.test(b.commit),
      'commit must be unknown or a hex sha, got: ' + b.commit);
  });
  await s.srv.stop();

  console.log('');
  console.log('=== M14-G1 META TEST SUMMARY ===');
  console.log('Passed: ' + passed + ' Failed: ' + failed);
  if (failed > 0) {
    for (const f of failures) console.log('  - ' + f.name + ': ' + f.err.message);
    process.exit(1);
  }
  console.log('ALL M14-G1 meta tests passed.');
  process.exit(0);
}
main().catch(function (err) { console.error(err); process.exit(1); });
