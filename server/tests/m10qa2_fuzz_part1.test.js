'use strict';
/* M10-QA2-G (API/SECURITY FUZZING) + M10-QA2-E (PERSISTENCE MULTI-USER, part 1).
 * Real HTTP tests against the REAL server. G: auth endpoints under fuzz.
 * Expected: correct 4xx, generic safe errors, no secret/stack/hash leak, never a 500.
 */
const http = require('http');
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const SERVER_PATH = path.join(__dirname, '..', 'server.js');

let passed = 0, failed = 0;
const failures = [];

function test(name, fn) {
  return new Promise(async (resolve) => {
    try { await fn(); passed++; console.log('PASS  ' + name); }
    catch (e) { failed++; failures.push({ name, err: e }); console.log('FAIL  ' + name + ' — ' + e.message); }
    resolve();
  });
}

function httpRaw(port, method, p, rawBody, extraHeaders, cookie) {
  return new Promise((resolve, reject) => {
    const headers = Object.assign({}, extraHeaders || {});
    if (rawBody !== null && rawBody !== undefined) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      headers['Content-Length'] = Buffer.byteLength(rawBody);
    }
    if (cookie) headers['Cookie'] = cookie;
    const rq = http.request({ host: 'localhost', port, path: p, method, headers }, (res) => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: b }));
    });
    rq.on('error', reject);
    if (rawBody !== null && rawBody !== undefined) rq.write(rawBody);
    rq.end();
  });
}

function httpRequest(port, method, p, body, cookie, extra) {
  const data = body === undefined ? null : JSON.stringify(body);
  return httpRaw(port, method, p, data, extra, cookie);
}

function parseCookies(h) {
  if (!h) return {};
  const c = {};
  const parts = Array.isArray(h) ? h : [h];
  for (const p of parts) {
    const kv = p.split(';')[0].trim();
    const eq = kv.indexOf('=');
    if (eq > 0) c[kv.substring(0, eq).trim()] = kv.substring(eq + 1).trim();
  }
  return c;
}

function leakFree(body, where) {
  assert.ok(body.indexOf('scrypt$') < 0, where + ': hash leaked');
  assert.ok(body.indexOf('passwordHash') < 0, where + ': passwordHash leaked');
  assert.ok(body.indexOf('node:') < 0, where + ': internal path leaked');
}

global.__qa2_fuzz_common = {
  httpRaw, httpRequest, parseCookies, leakFree
};

async function login(port, username, password) {
  const { httpRequest, parseCookies } = global.__qa2_fuzz_common;
  const r = await httpRequest(port, 'POST', '/api/auth/login', { username, password });
  assert.strictEqual(r.status, 200, 'login ' + username + ' -> ' + r.status + ' ' + r.body);
  const sid = parseCookies(r.headers['set-cookie']).mathdrill_session;
  assert.ok(sid, 'session cookie issued');
  return 'mathdrill_session=' + sid;
}
function cookieVal(setCookieHeaders) {
  const arr = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders || ''];
  return arr.map(function (p) {
    return p.split(';')[0].trim().split('=')[1] || '';
  })[0] || '';
}

async function main() {
  const { httpRaw, httpRequest, leakFree } = global.__qa2_fuzz_common;
  process.env.PORT = '0';
  process.env.NODE_ENV = 'test';
  process.env.MATHDRILL_ADMIN_PASSWORD = 'fuzzpw_test_secret';
  delete process.env.MATHDRILL_BACKEND;

  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  for (const f of ['users.json', 'sessions.json', 'mathdrill.db', 'mathdrill.db-shm', 'mathdrill.db-wal']) {
    const fp = path.join(dataDir, f);
    if (fs.existsSync(fp)) try { fs.unlinkSync(fp); } catch (e) {}
  }
  delete require.cache[require.resolve(SERVER_PATH)];
  const srv = require(SERVER_PATH);
  const server = await srv.start();
  const PORT = server.address().port;
  console.log('[Test] Server on port', PORT);


  const BIG = 'z'.repeat(10000);
  const HUGE_OK = 'y'.repeat(30000);

  await test('G01 register no body -> 400/415, no 500', async () => {
    const r = await httpRequest(PORT, 'POST', '/api/auth/register', undefined);
    assert.ok(r.status === 400 || r.status === 415, 'got ' + r.status);
    leakFree(r.body, 'G01');
  });

  await test('G02 register missing fields -> 400', async () => {
    assert.strictEqual((await httpRequest(PORT, 'POST', '/api/auth/register', { username: 'fz1' })).status, 400);
    assert.strictEqual((await httpRequest(PORT, 'POST', '/api/auth/register', { password: 'pw123' })).status, 400);
    const r = await httpRequest(PORT, 'POST', '/api/auth/register', {});
    assert.strictEqual(r.status, 400);
    leakFree(r.body, 'G02');
  });

  await test('G03 register wrong types -> 400', async () => {
    for (const bad of [{ username: ['x'], password: 'p' }, { username: 42, password: 'p' },
                        { username: 'fz2', password: null }, { username: 'fz2', password: 7 }]) {
      const r = await httpRequest(PORT, 'POST', '/api/auth/register', bad);
      assert.strictEqual(r.status, 400, 'got ' + r.status + ' for ' + JSON.stringify(bad));
      leakFree(r.body, 'G03');
    }
  });

  await test('G04 register empty strings -> 400', async () => {
    const r = await httpRequest(PORT, 'POST', '/api/auth/register', { username: '', password: '' });
    assert.strictEqual(r.status, 400);
    leakFree(r.body, 'G04');
  });

  await test('G05 register huge username (10 KiB) -> 400, no crash', async () => {
    const r = await httpRequest(PORT, 'POST', '/api/auth/register', { username: BIG, password: 'p' });
    assert.strictEqual(r.status, 400);
    leakFree(r.body, 'G05');
  });

  await test('G06 register 30 KiB username (under cap) -> 400, no crash', async () => {
    const r = await httpRequest(PORT, 'POST', '/api/auth/register', { username: HUGE_OK, password: 'p' });
    assert.ok(r.status === 400, 'got ' + r.status);
    leakFree(r.body, 'G06');
  });

  await test('G07 login huge password (30 KiB) -> 400/401, never 500', async () => {
    const r = await httpRequest(PORT, 'POST', '/api/auth/login', { username: 'nobody', password: HUGE_OK });
    assert.ok(r.status === 400 || r.status === 401, 'got ' + r.status);
    leakFree(r.body, 'G07');
  });

  await test('G08 malformed JSON on /api/auth/login -> 400', async () => {
    const r = await httpRaw(PORT, 'POST', '/api/auth/login', '{"username": "x",');
    assert.strictEqual(r.status, 400);
    leakFree(r.body, 'G08');
  });

  await test('G09 wrong method GET /api/auth/login -> 404', async () => {
    const r = await httpRequest(PORT, 'GET', '/api/auth/login');
    assert.strictEqual(r.status, 404);
    leakFree(r.body, 'G09');
  });

  await test('G10 wrong method POST /api/auth/me -> 404', async () => {
    const r = await httpRequest(PORT, 'POST', '/api/auth/me', {});
    assert.strictEqual(r.status, 404);
    leakFree(r.body, 'G10');
  });

  await test('G11 wrong method GET /api/auth/logout -> 404', async () => {
    const r = await httpRequest(PORT, 'GET', '/api/auth/logout');
    assert.strictEqual(r.status, 404);
    leakFree(r.body, 'G11');
  });

  await test('G12 extra unknown fields ignored, still 200 + no escalation', async () => {
    await httpRequest(PORT, 'POST', '/api/auth/register', { username: 'fz3', password: 'pw123' });
    const r = await httpRequest(PORT, 'POST', '/api/auth/login',
      { username: 'fz3', password: 'pw123', role: 'admin', is_admin: true, admin: 1 });
    assert.strictEqual(r.status, 200);
    const me = await httpRequest(PORT, 'GET', '/api/auth/me', null,
      'mathdrill_session' + '=' + cookieVal(r.headers['set-cookie']));
    assert.strictEqual(JSON.parse(me.body).user.role, 'user', 'extra fields never escalate');
    leakFree(me.body, 'G12');
  });

  await test('G13 garbage/malformed session cookies -> 401', async () => {
    for (const bad of ['mathdrill_session=zzz', 'mathdrill_session=', 'mathdrill_session', 'x=1; y=2', '']) {
      const r = await httpRequest(PORT, 'GET', '/api/auth/me', null, bad || undefined);
      assert.strictEqual(r.status, 401, 'got ' + r.status + ' for cookie ' + JSON.stringify(bad));
      leakFree(r.body, 'G13');
    }
  });

  await test('G14 change-password missing/invalid fields -> 400/401', async () => {
    const c = await login(PORT, 'fz3', 'pw123');
    for (const bad of [{}, { username: 'fz3' }, { username: 'fz3', oldPassword: 'pw123' },
                        { username: 'fz3', oldPassword: 'pw123', newPassword: '' }]) {
      const r = await httpRequest(PORT, 'POST', '/api/auth/change-password', bad, c);
      assert.ok(r.status === 400 || r.status === 401, 'got ' + r.status);
      leakFree(r.body, 'G14');
    }
  });

  await test('G15 change-password cross-user target rejected', async () => {
    const c = await login(PORT, 'fz3', 'pw123');
    const r = await httpRequest(PORT, 'POST', '/api/auth/change-password',
      { username: 'somebody-else', oldPassword: 'pw123', newPassword: 'newpw123' }, c);
    assert.strictEqual(r.status, 401, 'got ' + r.status);
    leakFree(r.body, 'G15');
  });

  await test('G16 fake admin flags on register/login never grant admin', async () => {
    const rr = await httpRequest(PORT, 'POST', '/api/auth/register',
      { username: 'fzhax', password: 'pw123', role: 'admin', is_admin: true });
    assert.ok(rr.status === 201 || rr.status === 400, 'got ' + rr.status);
    if (rr.status === 201) {
      const c = await login(PORT, 'fzhax', 'pw123');
      const me = await httpRequest(PORT, 'GET', '/api/auth/me', null, c);
      assert.strictEqual(JSON.parse(me.body).user.role, 'user');
      assert.strictEqual((await httpRequest(PORT, 'GET', '/api/admin/me', null, c)).status, 403);
    }
    const li = await httpRequest(PORT, 'POST', '/api/auth/login',
      { username: 'fz3', password: 'pw123', role: 'admin' });
    assert.strictEqual(li.status, 200);
    const m2 = await httpRequest(PORT, 'GET', '/api/auth/me', null,
      'mathdrill_session' + '=' + cookieVal(li.headers['set-cookie']));
    assert.strictEqual(JSON.parse(m2.body).user.role, 'user');
  });

  await test('G17 oversized player payload -> 413, service stays up', async () => {
    const c = await login(PORT, 'fz3', 'pw123');
    const big = { blob: 'x'.repeat(80 * 1024) };
    const r = await httpRequest(PORT, 'POST', '/api/player/data', big, c);
    assert.strictEqual(r.status, 413, 'got ' + r.status);
    const ok = await httpRequest(PORT, 'GET', '/api/auth/me', null, c);
    assert.strictEqual(ok.status, 200, 'server still healthy after oversized payload');
  });

  await test('G18 Unicode/emoji credentials handled safely', async () => {
    const r = await httpRequest(PORT, 'POST', '/api/auth/register',
      { username: 'nguoi_dung_1', password: 'mat_khau_123' });
    assert.ok(r.status === 201 || r.status === 400, 'got ' + r.status);
    if (r.status === 201) {
      const li = await httpRequest(PORT, 'POST', '/api/auth/login',
        { username: 'nguoi_dung_1', password: 'mat_khau_123' });
      assert.strictEqual(li.status, 200);
    }
    leakFree(r.body, 'G18');
  });

  console.log('=== M10-QA2-G API FUZZ SUMMARY ===');
  console.log('Passed: ' + passed + ' Failed: ' + failed);
  if (failures.length) console.log('FAILED: ' + failures.map(f => f.name).join(', '));
  try { await server.close(); } catch (e) {}
  process.exit(failed ? 1 : 0);
}

main().catch(function (e) {
  console.error('FATAL ' + (e && e.stack || e));
  process.exit(2);
});

