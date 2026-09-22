'use strict';
const http = require('http');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

let passed = 0, failed = 0;

function test(name, fn) {
  return new Promise(async (resolve) => {
    try { await fn(); passed++; console.log('PASS  ' + name); }
    catch (e) { failed++; console.log('FAIL  ' + name + ' — ' + e.message); }
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
  process.env.MATHDRILL_DATA_DIR = path.join(__dirname, 'data_test_auth_part3');
  delete process.env.MATHDRILL_BACKEND;

  const testDataDir = path.join(__dirname, 'data_test_auth_part3');
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

  // T18-T22
  await test('T18 change password', async () => {
    await httpRequest(PORT, 'POST', '/api/auth/register', { username: 'cpuser', password: 'old' });
    const login = await httpRequest(PORT, 'POST', '/api/auth/login', { username: 'cpuser', password: 'old' });
    const mc = `mathdrill_session=${parseCookies(login.headers['set-cookie']).mathdrill_session}`;
    const res = await httpRequest(PORT, 'POST', '/api/auth/change-password', { username: 'cpuser', oldPassword: 'old', newPassword: 'new' }, mc);
    assert.strictEqual(res.status, 200);
  });
  await test('T19 wrong old pw', async () => {
    const login = await httpRequest(PORT, 'POST', '/api/auth/login', { username: 'cpuser', password: 'new' });
    const mc = `mathdrill_session=${parseCookies(login.headers['set-cookie']).mathdrill_session}`;
    const res = await httpRequest(PORT, 'POST', '/api/auth/change-password', { username: 'cpuser', oldPassword: 'wrong', newPassword: 'x' }, mc);
    assert.strictEqual(res.status, 400);
    assert.strictEqual(JSON.parse(res.body).error, 'PASSWORD_MISMATCH');
  });
  await test('T20 new pw works', async () => {
    assert.strictEqual((await httpRequest(PORT, 'POST', '/api/auth/login', { username: 'cpuser', password: 'new' })).status, 200);
  });
  await test('T21 old pw fails', async () => {
    assert.strictEqual((await httpRequest(PORT, 'POST', '/api/auth/login', { username: 'cpuser', password: 'old' })).status, 401);
  });
  await test('T22 malformed json', async () => {
    const res = await new Promise((resolve, reject) => {
      const data = '{bad';
      const req = http.request({ host: 'localhost', port: PORT, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (r) => {
        let b = ''; r.on('data', c => b += c); r.on('end', () => resolve({ status: r.statusCode, body: b }));
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
    assert.strictEqual(res.status, 400);
  });

  // T23-T27 - register testuser first
  await httpRequest(PORT, 'POST', '/api/auth/register', { username: 'testuser', password: 'pass123' });
  await test('T23 unknown endpoint', async () => {
    const res = await httpRequest(PORT, 'GET', '/api/unknown');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(JSON.parse(res.body).ok, false);
  });
  await test('T24 no password leak', async () => {
    const res = await httpRequest(PORT, 'POST', '/api/auth/login', { username: 'testuser', password: 'pass123' });
    assert.strictEqual(res.body.includes('pass123'), false);
    assert.strictEqual(res.body.includes('scrypt'), false);
  });
  await test('T25 no session in body', async () => {
    const b = JSON.parse((await httpRequest(PORT, 'POST', '/api/auth/login', { username: 'testuser', password: 'pass123' })).body);
    assert.strictEqual(b.sessionId, undefined);
    assert.strictEqual(b.session, undefined);
  });
  await test('T26 user data field', async () => {
    // Backend-neutral: file backend -> users.json; sqlite backend -> players table
    const usersJsonPath = path.join(testDataDir, 'users.json');
    let hasData = false;
    if (fs.existsSync(usersJsonPath)) {
      const u = JSON.parse(fs.readFileSync(usersJsonPath, 'utf8'));
      hasData = !!u.cpuser.data;
    } else {
      const { DatabaseUserStore } = require(path.join('..', 'database'));
      const db = new DatabaseUserStore({ filePath: path.join(testDataDir, 'mathdrill.db') });
      hasData = !!db._publicUser('cpuser').data;
      db.close();
    }
    assert.ok(hasData);
  });
  await test('T27 repeated login/logout', async () => {
    for (let i = 0; i < 5; i++) {
      const login = await httpRequest(PORT, 'POST', '/api/auth/login', { username: 'testuser', password: 'pass123' });
      assert.strictEqual(login.status, 200);
      const mc = `mathdrill_session=${parseCookies(login.headers['set-cookie']).mathdrill_session}`;
      assert.strictEqual((await httpRequest(PORT, 'GET', '/api/auth/me', null, mc)).status, 200);
      await httpRequest(PORT, 'POST', '/api/auth/logout', null, mc);
    }
  });

  await srv.stop();
  console.log('\nPassed: ' + passed + ' Failed: ' + failed);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch(err => { console.error(err); process.exit(1); });
