'use strict';
const http = require('http');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

let passed = 0, failed = 0;
const failures = [];

function test(name, fn) {
  return new Promise(async (resolve) => {
    try { await fn(); passed++; console.log('PASS  ' + name); }
    catch (e) { failed++; failures.push({ name, err: e }); console.log('FAIL  ' + name + ' — ' + e.message); }
    resolve();
  });
}

function httpRequest(port, method, p, body, cookie) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
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

async function main() {
  const SERVER_PATH = path.join(__dirname, '..', 'server.js');
  process.env.PORT = '0';
  process.env.NODE_ENV = 'test';
  process.env.MATHDRILL_ADMIN_PASSWORD = 'auth_test_secret';
  process.env.MATHDRILL_DATA_DIR = path.join(__dirname, 'data_test_auth_part2');
  delete process.env.MATHDRILL_BACKEND;

  const testDataDir = path.join(__dirname, 'data_test_auth_part2');
  if (!fs.existsSync(testDataDir)) fs.mkdirSync(testDataDir, { recursive: true });
  for (const f of ['users.json', 'sessions.json', 'mathdrill.db', 'mathdrill.db-shm', 'mathdrill.db-wal']) {
    const fp = path.join(testDataDir, f);
    if (fs.existsSync(fp)) try { fs.unlinkSync(fp); } catch (e) {}
  }
  delete require.cache[require.resolve(SERVER_PATH)];
  const srv = require(SERVER_PATH);
  const server = await srv.start();
  const PORT = server.address().port;
  console.log('[Test] Server on port', PORT);

  // Self-contained: register the test user this file relies on (each file now
  // starts from a clean data dir, so no cross-file dependency on auth.test.js).
  await httpRequest(PORT, 'POST', '/api/auth/register', { username: 'testuser', password: 'pass123' });

  // T13-T17
  await test('T13 /me auth', async () => {
    const login = await httpRequest(PORT, 'POST', '/api/auth/login', { username: 'testuser', password: 'pass123' });
    const mc = `mathdrill_session=${parseCookies(login.headers['set-cookie']).mathdrill_session}`;
    const res = await httpRequest(PORT, 'GET', '/api/auth/me', null, mc);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(JSON.parse(res.body).user.username, 'testuser');
  });
  await test('T14 /me unauth', async () => {
    const res = await httpRequest(PORT, 'GET', '/api/auth/me');
    assert.strictEqual(res.status, 401);
  });
  await test('T15 logout', async () => {
    const login = await httpRequest(PORT, 'POST', '/api/auth/login', { username: 'testuser', password: 'pass123' });
    const mc = `mathdrill_session=${parseCookies(login.headers['set-cookie']).mathdrill_session}`;
    assert.strictEqual((await httpRequest(PORT, 'POST', '/api/auth/logout', null, mc)).status, 200);
  });
  await test('T16 session after logout', async () => {
    const login = await httpRequest(PORT, 'POST', '/api/auth/login', { username: 'testuser', password: 'pass123' });
    const mc = `mathdrill_session=${parseCookies(login.headers['set-cookie']).mathdrill_session}`;
    await httpRequest(PORT, 'POST', '/api/auth/logout', null, mc);
    assert.strictEqual((await httpRequest(PORT, 'GET', '/api/auth/me', null, mc)).status, 401);
  });
  await test('T17 expired session', async () => {
    const login = await httpRequest(PORT, 'POST', '/api/auth/login', { username: 'testuser', password: 'pass123' });
    const sid = parseCookies(login.headers['set-cookie']).mathdrill_session;
    srv.sessionStore.expireSession(sid);
    assert.strictEqual((await httpRequest(PORT, 'GET', '/api/auth/me', null, `mathdrill_session=${sid}`)).status, 401);
  });

  await srv.stop();
  console.log('\nPassed: ' + passed + ' Failed: ' + failed);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch(err => { console.error(err); process.exit(1); });
