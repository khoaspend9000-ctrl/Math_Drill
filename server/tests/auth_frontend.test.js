'use strict';
const http = require('http');
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const SERVER_PATH = path.join(__dirname, '..', 'server.js');
const AUTH_PATH = path.join(__dirname, '..', '..', 'web', 'js', 'auth.js');

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
  for (const p of parts) { const kv = p.split(';')[0].trim(); const eq = kv.indexOf('='); if (eq > 0) c[kv.substring(0, eq).trim()] = kv.substring(eq + 1).trim(); }
  return c;
}

async function main() {
  process.env.PORT = '39200';
  // Wipe data BEFORE loading server module (see auth.test.js rationale).
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  for (const f of ['users.json', 'sessions.json']) { const fp = path.join(dataDir, f); if (fs.existsSync(fp)) fs.unlinkSync(fp); }
  delete require.cache[require.resolve(SERVER_PATH)];
  const srv = require(SERVER_PATH);
  const server = await srv.start();
  const PORT = server.address().port;
  console.log('[Test] Backend on port', PORT);

  // F01-F05
  await test('F01 register via backend', async () => {
    const res = await httpRequest(PORT, 'POST', '/api/auth/register', { username: 'feuser', password: 'pw123' });
    assert.strictEqual(res.status, 201);
    const u = JSON.parse(res.body).user;
    assert.strictEqual(u.username, 'feuser');
    assert.strictEqual(u.password, undefined);
  });
  await test('F02 login sets HttpOnly cookie', async () => {
    const res = await httpRequest(PORT, 'POST', '/api/auth/login', { username: 'feuser', password: 'pw123' });
    const h = (Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'].join(';') : String(res.headers['set-cookie']));
    assert.ok(h.includes('HttpOnly'));
    assert.ok(h.includes('SameSite=Lax'));
  });
  await test('F03 /me with cookie', async () => {
    const login = await httpRequest(PORT, 'POST', '/api/auth/login', { username: 'feuser', password: 'pw123' });
    const mc = `mathdrill_session=${parseCookies(login.headers['set-cookie']).mathdrill_session}`;
    assert.strictEqual((await httpRequest(PORT, 'GET', '/api/auth/me', null, mc)).status, 200);
  });
  await test('F04 /me without cookie', async () => {
    assert.strictEqual((await httpRequest(PORT, 'GET', '/api/auth/me')).status, 401);
  });
  await test('F05 logout invalidates session', async () => {
    const login = await httpRequest(PORT, 'POST', '/api/auth/login', { username: 'feuser', password: 'pw123' });
    const mc = `mathdrill_session=${parseCookies(login.headers['set-cookie']).mathdrill_session}`;
    await httpRequest(PORT, 'POST', '/api/auth/logout', null, mc);
    assert.strictEqual((await httpRequest(PORT, 'GET', '/api/auth/me', null, mc)).status, 401);
  });

  // F06-F08
  await test('F06 change password', async () => {
    await httpRequest(PORT, 'POST', '/api/auth/register', { username: 'cpuser', password: 'old' });
    const login = await httpRequest(PORT, 'POST', '/api/auth/login', { username: 'cpuser', password: 'old' });
    const mc = `mathdrill_session=${parseCookies(login.headers['set-cookie']).mathdrill_session}`;
    const cpRes = await httpRequest(PORT, 'POST', '/api/auth/change-password', { username: 'cpuser', oldPassword: 'old', newPassword: 'new' }, mc);
    assert.strictEqual(cpRes.status, 200, 'change pw status ' + cpRes.status + ' body=' + cpRes.body);
    // Old password should fail
    assert.strictEqual((await httpRequest(PORT, 'POST', '/api/auth/login', { username: 'cpuser', password: 'old' })).status, 401);
    // New password should work
    assert.strictEqual((await httpRequest(PORT, 'POST', '/api/auth/login', { username: 'cpuser', password: 'new' })).status, 200);
  });
  await test('F07 no password leak', async () => {
    const res = await httpRequest(PORT, 'POST', '/api/auth/login', { username: 'feuser', password: 'pw123' });
    assert.strictEqual(res.body.includes('pw123'), false);
    assert.strictEqual(res.body.includes('scrypt'), false);
  });
  await test('F08 no session in body', async () => {
    const b = JSON.parse((await httpRequest(PORT, 'POST', '/api/auth/login', { username: 'feuser', password: 'pw123' })).body);
    assert.strictEqual(b.sessionId, undefined);
    assert.strictEqual(b.session, undefined);
  });

  await srv.stop();
  console.log('\nFrontend integration: Passed: ' + passed + ' Failed: ' + failed);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch(err => { console.error(err); process.exit(1); });
