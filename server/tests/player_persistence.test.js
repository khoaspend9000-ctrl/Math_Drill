'use strict';
/* M10-B REGRESSION — /api/player/data server-side progress persistence.
 * Real HTTP tests against the REAL server (no mocks).
 * Covers the exact gap found by the M10-QA2 deep browser run: in backend mode
 * XP/gold/level were never persisted server-side, so a reload + login reset the
 * player to level 1.
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

function httpRequest(port, method, p, body, cookie, extra) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = Object.assign({}, (extra && extra.headers) || {});
    if (data) {
      headers['Content-Type'] = (extra && extra.contentType) || 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    if (cookie) headers['Cookie'] = cookie;
    const req = http.request({ host: 'localhost', port, path: p, method, headers }, (res) => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: b }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
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

async function login(port, username, password) {
  const r = await httpRequest(port, 'POST', '/api/auth/login', { username, password });
  assert.strictEqual(r.status, 200, 'login ' + username + ' -> ' + r.status + ' ' + r.body);
  const sid = parseCookies(r.headers['set-cookie']).mathdrill_session;
  assert.ok(sid, 'session cookie issued');
  return 'mathdrill_session=' + sid;
}

async function main() {
  process.env.PORT = '0';
  process.env.NODE_ENV = 'test';
  process.env.MATHDRILL_ADMIN_PASSWORD = 'playerpw_test_secret';
  process.env.MATHDRILL_DATA_DIR = path.join(__dirname, 'data_test_player_persistence');
  // File backend (production default) — also proves the file store's new
  // getUserData/setUserData interface used by /api/player/data.
  delete process.env.MATHDRILL_BACKEND;

  // Use isolated test directory to avoid clashing with other test suites.
  const testDataDir = path.join(__dirname, 'data_test_player_persistence');
  if (!fs.existsSync(testDataDir)) fs.mkdirSync(testDataDir, { recursive: true });
  for (const f of ['users.json', 'sessions.json', 'mathdrill.db', 'mathdrill.db-shm', 'mathdrill.db-wal']) {
    const fp = path.join(testDataDir, f);
    if (fs.existsSync(fp)) try { fs.unlinkSync(fp); } catch (e) {}
  }
  delete require.cache[require.resolve(SERVER_PATH)];
  let srv = require(SERVER_PATH);
  let server = await srv.start();
  let PORT = server.address().port;
  console.log('[Test] Server on port', PORT);

  const BLOB = {
    xp: 1234, gold: 567, level: 8, grade: 2,
    completed_lessons: { '2_1': true, '2_2': true },
    achievements: { first_win: true },
    inventory: { cards: ['pi'], pets: ['clover'] },
    settings: { volume: 0.5 }
  };

  await test('T01 anonymous GET /api/player/data -> 401', async () => {
    const r = await httpRequest(PORT, 'GET', '/api/player/data');
    assert.strictEqual(r.status, 401);
  });

  await test('T02 POST /api/player/data without session -> 401', async () => {
    const r = await httpRequest(PORT, 'POST', '/api/player/data', { xp: 1 });
    assert.strictEqual(r.status, 401);
  });

  await test('T03 fresh user GET returns empty object', async () => {
    await httpRequest(PORT, 'POST', '/api/auth/register', { username: 'pa', password: 'pass123' });
    const cookie = await login(PORT, 'pa', 'pass123');
    const r = await httpRequest(PORT, 'GET', '/api/player/data', null, cookie);
    assert.strictEqual(r.status, 200);
    const b = JSON.parse(r.body);
    assert.strictEqual(b.ok, true);
    assert.deepStrictEqual(b.data, {});
  });

  await test('T04 save blob then read it back exactly', async () => {
    const cookie = await login(PORT, 'pa', 'pass123');
    const w = await httpRequest(PORT, 'POST', '/api/player/data', BLOB, cookie);
    assert.strictEqual(w.status, 200, 'save ' + w.status + ' ' + w.body);
    const g = await httpRequest(PORT, 'GET', '/api/player/data', null, cookie);
    assert.strictEqual(g.status, 200);
    assert.deepStrictEqual(JSON.parse(g.body).data, BLOB);
  });

  await test('T05 blob survives logout + re-login (not session-bound)', async () => {
    const cookie = await login(PORT, 'pa', 'pass123');
    await httpRequest(PORT, 'POST', '/api/auth/logout', undefined, cookie);
    const again = await login(PORT, 'pa', 'pass123');
    const g = await httpRequest(PORT, 'GET', '/api/player/data', null, again);
    assert.deepStrictEqual(JSON.parse(g.body).data, BLOB);
  });

  await test('T06 per-user isolation: user B never sees user A blob', async () => {
    await httpRequest(PORT, 'POST', '/api/auth/register', { username: 'pb', password: 'pass123' });
    const cb = await login(PORT, 'pb', 'pass123');
    const g = await httpRequest(PORT, 'GET', '/api/player/data', null, cb);
    const d = JSON.parse(g.body).data;
    assert.notDeepStrictEqual(d, BLOB, 'user B must not inherit user A data');
    assert.deepStrictEqual(d, {}, 'user B starts empty');
    const wb = await httpRequest(PORT, 'POST', '/api/player/data', { xp: 9, gold: 9, level: 2 }, cb);
    assert.strictEqual(wb.status, 200);
    const ca = await login(PORT, 'pa', 'pass123');
    const ga = await httpRequest(PORT, 'GET', '/api/player/data', null, ca);
    assert.deepStrictEqual(JSON.parse(ga.body).data, BLOB, 'user A blob untouched by user B writes');
  });

  await test('T07 invalid cookie -> 401', async () => {
    const r = await httpRequest(PORT, 'GET', '/api/player/data', null, 'mathdrill_session=' + 'f'.repeat(64));
    assert.strictEqual(r.status, 401);
  });

  await test('T08 array body -> 400', async () => {
    const cookie = await login(PORT, 'pa', 'pass123');
    const r = await httpRequest(PORT, 'POST', '/api/player/data', [1, 2, 3], cookie);
    assert.strictEqual(r.status, 400);
  });

  await test('T09 string body -> 400', async () => {
    const cookie = await login(PORT, 'pa', 'pass123');
    const r = await httpRequest(PORT, 'POST', '/api/player/data', 'not-an-object', cookie);
    assert.strictEqual(r.status, 400);
  });

  await test('T10 malformed JSON -> 400 (not 500)', async () => {
    const cookie = await login(PORT, 'pa', 'pass123');
    const r = await new Promise((resolve, reject) => {
      const raw = '{"xp": 12,';
      const h = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(raw), 'Cookie': cookie };
      const rq = http.request({ host: 'localhost', port: PORT, path: '/api/player/data', method: 'POST', headers: h }, (res) => {
        let b = ''; res.on('data', c => b += c);
        res.on('end', () => resolve({ status: res.statusCode, body: b }));
      });
      rq.on('error', reject); rq.write(raw); rq.end();
    });
    assert.strictEqual(r.status, 400);
  });

  await test('T11 non-JSON content type -> 415', async () => {
    const cookie = await login(PORT, 'pa', 'pass123');
    const r = await httpRequest(PORT, 'POST', '/api/player/data', 'a=1', cookie,
      { contentType: 'application/x-www-form-urlencoded' });
    assert.strictEqual(r.status, 415);
  });

  await test('T12 oversized payload -> 413', async () => {
    const cookie = await login(PORT, 'pa', 'pass123');
    const big = { blob: 'x'.repeat(80 * 1024) };
    const r = await httpRequest(PORT, 'POST', '/api/player/data', big, cookie);
    assert.strictEqual(r.status, 413);
  });

  await test('T13 cross-origin Origin header -> 403', async () => {
    const cookie = await login(PORT, 'pa', 'pass123');
    const r = await httpRequest(PORT, 'POST', '/api/player/data', { xp: 2 }, cookie, {
      headers: { Origin: 'http://evil.example.com' }
    });
    assert.strictEqual(r.status, 403);
  });

  await test('T14 unknown /api/player route -> 404', async () => {
    const cookie = await login(PORT, 'pa', 'pass123');
    const r = await httpRequest(PORT, 'GET', '/api/player/nope', null, cookie);
    assert.strictEqual(r.status, 404);
  });

  await test('T15 player endpoint never leaks credentials', async () => {
    const cookie = await login(PORT, 'pa', 'pass123');
    const g = await httpRequest(PORT, 'GET', '/api/player/data', null, cookie);
    assert.ok(g.body.indexOf('scrypt$') < 0, 'no password hash');
    assert.ok(g.body.indexOf('passwordHash') < 0, 'no passwordHash field');
    assert.ok(g.body.indexOf('pass123') < 0, 'no plaintext password');
  });

  await test('T16 blob survives a REAL server restart (file store)', async () => {
    await srv.stop();
    delete require.cache[require.resolve(SERVER_PATH)];
    srv = require(SERVER_PATH);
    server = await srv.start();
    PORT = server.address().port;
    const cookie = await login(PORT, 'pa', 'pass123');
    const g = await httpRequest(PORT, 'GET', '/api/player/data', null, cookie);
    assert.deepStrictEqual(JSON.parse(g.body).data, BLOB, 'progress persisted across restart');
  });

  console.log('');
  console.log('=== M10-B PLAYER PERSISTENCE SUMMARY ===');
  console.log('Passed: ' + passed + ' Failed: ' + failed);
  if (failures.length) console.log('FAILED: ' + failures.map(f => f.name).join(', '));
  try { await srv.stop(); } catch (e) {}
  process.exit(failed ? 1 : 0);
}

main().catch(function (e) {
  console.error('FATAL ' + (e && e.stack || e));
  process.exit(2);
});
