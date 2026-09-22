/* M10-F — SECURITY HARDENING TESTS (T01–T20). Real HTTP server. */
'use strict';
const http = require('http');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

process.env.PORT = '0';
process.env.NODE_ENV = 'test';
process.env.MATHDRILL_ADMIN_PASSWORD = 'secpw_secret';
process.env.MATHDRILL_BACKEND = 'sqlite';

let pass = 0, fail = 0;
const failures = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () {
    pass++; console.log('PASS ' + name);
  }, function (err) {
    fail++; failures.push(name);
    console.log('FAIL ' + name + ' :: ' + (err && err.message));
  });
}

const DATA_DIR = path.join(__dirname, '..', 'data');
for (const f of ['users.json', 'sessions.json', 'mathdrill.db', 'mathdrill.db-shm', 'mathdrill.db-wal']) {
  const fp = path.join(DATA_DIR, f);
  if (fs.existsSync(fp)) { try { fs.unlinkSync(fp); } catch (e) {} }
}

function req(port, method, p, body, cookie, headersExtra) {
  return new Promise(function (resolve, reject) {
    const data = body ? JSON.stringify(body) : null;
    const headers = Object.assign({}, headersExtra || {});
    if (data) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(data); }
    if (cookie) headers['Cookie'] = cookie;
    const r = http.request({ host: 'localhost', port, path: p, method, headers }, function (res) {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: b }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

let PORT;

async function main() {
  const srv = require('../server.js');
  const server = await srv.start();
  PORT = server.address().port;

  await check('T01 security headers on static HTML', () =>
    req(PORT, 'GET', '/').then(function (res) {
      assert.strictEqual(res.status, 200);
      assert.ok(res.headers['content-security-policy'], 'CSP missing');
      assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
      assert.strictEqual(res.headers['referrer-policy'], 'no-referrer');
      assert.ok(res.headers['permissions-policy']);
      assert.strictEqual(res.headers['x-frame-options'], 'DENY');
    }));

  await check('T02 CSP restricts script/style to self', () =>
    req(PORT, 'GET', '/').then(function (res) {
      const csp = res.headers['content-security-policy'];
      assert.ok(csp.includes("script-src 'self'"));
      assert.ok(csp.includes("style-src 'self'"));
      assert.ok(csp.includes("frame-ancestors 'none'"));
      assert.ok(!csp.trim().startsWith('*'));
    }));

  await check('T03 nosniff on API responses', () =>
    req(PORT, 'GET', '/api/auth/me').then(function (res) {
      assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
    }));

  await check('T04 Referrer-Policy present on API', () =>
    req(PORT, 'GET', '/api/auth/me').then(function (res) {
      assert.strictEqual(res.headers['referrer-policy'], 'no-referrer');
    }));

  await check('T05 frame protection (frame-ancestors + XFO)', () =>
    req(PORT, 'GET', '/').then(function (res) {
      assert.ok(res.headers['content-security-policy'].includes("frame-ancestors 'none'"));
      assert.strictEqual(res.headers['x-frame-options'], 'DENY');
    }));

  // --- admin + auth hardening (sqlite backend path) ---
  let adminCookie = null;
  await check('T06 admin login works on sqlite backend', async function () {
    const r = await req(PORT, 'POST', '/api/auth/login', { username: 'admin', password: 'secpw_secret' });
    assert.strictEqual(r.status, 200, 'admin login ' + r.status + ' ' + r.body);
    const c = (r.headers['set-cookie'] || []).map(function (s) { return s.split(';')[0]; }).join('; ');
    assert.ok(c.indexOf('mathdrill_session=') === 0, 'session cookie set');
    adminCookie = c;
  });

  await check('T07 admin me authorized', async function () {
    const r = await req(PORT, 'GET', '/api/admin/me', null, adminCookie);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(JSON.parse(r.body).role, 'admin');
  });

  await check('T08 anonymous admin blocked', async function () {
    const r = await req(PORT, 'GET', '/api/admin/me');
    assert.strictEqual(r.status, 401);
  });

  await check('T09 unknown api endpoint 404', async function () {
    const r = await req(PORT, 'GET', '/api/nope');
    assert.strictEqual(r.status, 404);
  });

  await check('T10 non-json POST rejected 415', async function () {
    const r = await new Promise(function (resolve, reject) {
      const data = 'username=a&password=b';
      const h = { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(data) };
      const rq = http.request({ host: 'localhost', port: PORT, path: '/api/auth/login', method: 'POST', headers: h }, function (res) {
        let b = ''; res.on('data', c => b += c); res.on('end', function () { resolve({ status: res.statusCode, body: b }); });
      });
      rq.on('error', reject); rq.write(data); rq.end();
    });
    assert.strictEqual(r.status, 415);
  });

    await check('T11 cookie flags HttpOnly + SameSite', async function () {
    // Register secuser1 (needed for T12 duplicate test). Register does NOT
    // set a session cookie — only login does. So login to validate flags.
    await req(PORT, 'POST', '/api/auth/register', { username: 'secuser1', password: 'sec12345' });
    const r = await req(PORT, 'POST', '/api/auth/login', { username: 'secuser1', password: 'sec12345' });
    const sc = (r.headers['set-cookie'] || []).join('; ');
    assert.ok(sc.indexOf('HttpOnly') >= 0, 'HttpOnly missing');
    assert.ok(sc.indexOf('SameSite=Lax') >= 0, 'SameSite=Lax missing');
  });

  await check('T12 register duplicate 400', async function () {
    const r = await req(PORT, 'POST', '/api/auth/register', { username: 'secuser1', password: 'sec12345' });
    assert.strictEqual(r.status, 400);
    assert.strictEqual(JSON.parse(r.body).error, 'USERNAME_TAKEN');
  });

  await check('T13 path traversal blocked', async function () {
    const r = await req(PORT, 'GET', '/../server/server.js');
    assert.ok(r.status === 403 || r.status === 404, 'traversal status ' + r.status);
  });

  await check('T14 static asset served with nosniff', async function () {
    const r = await req(PORT, 'GET', '/js/engine.js');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.headers['x-content-type-options'], 'nosniff');
  });

  await check('T15 logout invalidates session immediately', async function () {
    const r1 = await req(PORT, 'POST', '/api/auth/login', { username: 'secuser1', password: 'sec12345' });
    const c1 = (r1.headers['set-cookie'] || []).map(function (s) { return s.split(';')[0]; }).join('; ');
    const me1 = await req(PORT, 'GET', '/api/auth/me', null, c1);
    assert.strictEqual(me1.status, 200);
    await req(PORT, 'POST', '/api/auth/logout', null, c1);
    const me2 = await req(PORT, 'GET', '/api/auth/me', null, c1);
    assert.strictEqual(me2.status, 401, 'after logout me=' + me2.status);
  });

  await check('T16 password change invalidates other sessions', async function () {
    const ra = await req(PORT, 'POST', '/api/auth/login', { username: 'secuser1', password: 'sec12345' });
    const ca = (ra.headers['set-cookie'] || []).map(function (s) { return s.split(';')[0]; }).join('; ');
    const rb = await req(PORT, 'POST', '/api/auth/login', { username: 'secuser1', password: 'sec12345' });
    const cb = (rb.headers['set-cookie'] || []).map(function (s) { return s.split(';')[0]; }).join('; ');
    const ch = await req(PORT, 'POST', '/api/auth/change-password',
      { username: 'secuser1', oldPassword: 'sec12345', newPassword: 'sec54321' }, ca);
    assert.strictEqual(ch.status, 200, 'change ' + ch.status + ' ' + ch.body);
    const meb = await req(PORT, 'GET', '/api/auth/me', null, cb);
    assert.strictEqual(meb.status, 401, 'other session invalidated');
    const rnew = await req(PORT, 'POST', '/api/auth/login', { username: 'secuser1', password: 'sec54321' });
    assert.strictEqual(rnew.status, 200, 'new password login');
    const rold = await req(PORT, 'POST', '/api/auth/login', { username: 'secuser1', password: 'sec12345' });
    assert.strictEqual(rold.status, 401, 'old password rejected');
  });

  await check('T17 admin cannot be created via register', async function () {
    const r = await req(PORT, 'POST', '/api/auth/register', { username: 'secuser2', password: 'sec12345', role: 'admin' });
    assert.ok(r.status === 201 || r.status === 400, 'register status ' + r.status);
    if (r.status === 201) {
      const rl = await req(PORT, 'POST', '/api/auth/login', { username: 'secuser2', password: 'sec12345' });
      const cu = (rl.headers['set-cookie'] || []).map(function (s) { return s.split(';')[0]; }).join('; ');
      const am = await req(PORT, 'GET', '/api/admin/me', null, cu);
      assert.strictEqual(am.status, 403, 'register never grants admin');
    }
  });

  await check('T19 session cookie name + 64 hex chars', async function () {
    const r = await req(PORT, 'POST', '/api/auth/login', { username: 'secuser1', password: 'sec54321' });
    const sc = (r.headers['set-cookie'] || []).join('; ');
    assert.ok(sc.indexOf('mathdrill_session=') >= 0, 'cookie name');
    const raw = sc.split(';')[0].split('=')[1] || '';
    assert.strictEqual(raw.length, 64, '64 hex chars, got ' + raw.length);
  });

  await check('T20 no secret in api responses', async function () {
    const r = await req(PORT, 'GET', '/api/admin/me', null, adminCookie);
    assert.ok(r.body.indexOf('secpw_secret') < 0, 'no secret');
    const ru = await req(PORT, 'GET', '/api/admin/users', null, adminCookie);
    assert.ok(ru.body.indexOf('secpw_secret') < 0, 'no secret in users');
    assert.ok(ru.body.indexOf('scrypt$') < 0, 'no hash in users');
  });

  console.log('\n=== SECURITY HARDENING SUMMARY ===');
  console.log('Passed: ' + pass + ' Failed: ' + fail);
  if (failures.length) console.log('FAILED: ' + failures.join(', '));
  process.exit(fail ? 1 : 0);
}

main().catch(function (e) {
  console.error('FATAL ' + (e && e.stack || e));
  process.exit(2);
});
