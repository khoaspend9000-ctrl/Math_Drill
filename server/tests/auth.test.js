'use strict';
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
  process.env.PORT = '0'; // ephemeral: immune to lingering listeners (EADDRINUSE)
  // Wipe data BEFORE loading server module: UserStore._load()/SessionStore.loadFromFile()
  // run at construction — stale records from prior runs caused flaky 401/ENOENT.
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

  // T01-T06
  await test('T01 server boots', async () => {
    assert.strictEqual((await httpRequest(PORT, 'GET', '/api/auth/me')).status, 401);
  });
  await test('T02 register valid', async () => {
    const res = await httpRequest(PORT, 'POST', '/api/auth/register', { username: 'testuser', password: 'pass123' });
    assert.strictEqual(res.status, 201);
    const b = JSON.parse(res.body);
    assert.strictEqual(b.user.username, 'testuser');
    assert.strictEqual(b.user.password, undefined);
  });
  await test('T03 register duplicate', async () => {
    const res = await httpRequest(PORT, 'POST', '/api/auth/register', { username: 'testuser', password: 'x' });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(JSON.parse(res.body).error, 'USERNAME_TAKEN');
  });
  await test('T04 invalid username', async () => {
    assert.strictEqual((await httpRequest(PORT, 'POST', '/api/auth/register', { username: '', password: 'p' })).status, 400);
  });
  await test('T05 invalid password', async () => {
    assert.strictEqual((await httpRequest(PORT, 'POST', '/api/auth/register', { username: 'u', password: '' })).status, 400);
  });
  await test('T06 password hashed', async () => {
    // Backend-neutral: file backend -> users.json; sqlite backend -> mathdrill.db
    const usersJsonPath = path.join(dataDir, 'users.json');
    let stored = null;
    if (fs.existsSync(usersJsonPath)) {
      const u = JSON.parse(fs.readFileSync(usersJsonPath, 'utf8'));
      stored = u.testuser.passwordHash;
    } else {
      const { DatabaseUserStore } = require(path.join('..', 'database'));
      const db = new DatabaseUserStore({ filePath: path.join(dataDir, 'mathdrill.db') });
      stored = db.findUser('testuser').passwordHash;
      db.close();
    }
    assert.ok(stored.startsWith('scrypt$'));
    assert.strictEqual(stored.includes('pass123'), false);
  });

  // T07-T12
  let cookie = null;
  await test('T07 login valid', async () => {
    const res = await httpRequest(PORT, 'POST', '/api/auth/login', { username: 'testuser', password: 'pass123' });
    assert.strictEqual(res.status, 200);
    cookie = `mathdrill_session=${parseCookies(res.headers['set-cookie']).mathdrill_session}`;
  });
  await test('T08 login invalid', async () => {
    assert.strictEqual((await httpRequest(PORT, 'POST', '/api/auth/login', { username: 'testuser', password: 'wrong' })).status, 401);
  });
  await test('T09 login generic', async () => {
    const r1 = await httpRequest(PORT, 'POST', '/api/auth/login', { username: 'testuser', password: 'wrong' });
    const r2 = await httpRequest(PORT, 'POST', '/api/auth/login', { username: 'noone', password: 'x' });
    assert.strictEqual(JSON.parse(r1.body).error, JSON.parse(r2.body).error);
  });
  await test('T10 cookie length', async () => {
    const res = await httpRequest(PORT, 'POST', '/api/auth/login', { username: 'testuser', password: 'pass123' });
    assert.strictEqual(parseCookies(res.headers['set-cookie']).mathdrill_session.length, 64);
  });
  await test('T11 cookie HttpOnly', async () => {
    const res = await httpRequest(PORT, 'POST', '/api/auth/login', { username: 'testuser', password: 'pass123' });
    const h = (Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'].join(';') : String(res.headers['set-cookie']));
    assert.ok(h.includes('HttpOnly'));
  });
  await test('T12 cookie SameSite', async () => {
    const res = await httpRequest(PORT, 'POST', '/api/auth/login', { username: 'testuser', password: 'pass123' });
    const h = (Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'].join(';') : String(res.headers['set-cookie']));
    assert.ok(h.includes('SameSite=Lax'));
  });

  await srv.stop();
  console.log('\n=== M10-C TEST SUMMARY ===');
  console.log('Passed: ' + passed + ' Failed: ' + failed);
  if (failed > 0) { for (const f of failures) console.log('  - ' + f.name + ': ' + f.err.message); process.exit(1); }
  else { console.log('ALL M10-C tests passed.'); process.exit(0); }
}
main().catch(err => { console.error(err); process.exit(1); });