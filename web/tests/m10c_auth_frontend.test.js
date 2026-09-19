/* =========================================================
   M10-C — FRONTEND AUTH INTEGRATION TEST (real HTTP backend)
   ---------------------------------------------------------
   auth.js trong backend mode (browser / __M10C_API_BASE set)
   phải gọi thật POST /api/auth/register|login|logout,
   GET /api/auth/me, POST /api/auth/change-password.
   Cookie jar là browser-primitive mock (browser tự quản cookie;
   Node fetch không — jar thay thế đúng primitive đó).
   Production code KHÔNG bị sửa để phục vụ test này.
   ========================================================= */
'use strict';
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

process.env.PORT = '0'; // ephemeral port
process.env.NODE_ENV = 'test';

const DATA_DIR = path.join(__dirname, '..', '..', 'server', 'data');

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

// ---- Cookie-jar fetch (mock của primitive cookie trình duyệt) ----
function makeJarFetch(jar, capture) {
  return function jarFetch(url, opts) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      let body = opts.body || null;
      if (body && typeof body !== 'string') body = JSON.stringify(body);
      const u = new URL(url);
      const mod = u.protocol === 'https:' ? require('https') : http;
      const headers = Object.assign({}, opts.headers || {});
      if (jar.cookie) headers['Cookie'] = jar.cookie;
      if (body) headers['Content-Length'] = Buffer.byteLength(body);
      const req = mod.request({
        hostname: u.hostname, port: u.port || 80,
        path: u.pathname + u.search,
        method: opts.method || 'GET', headers: headers
      }, function (res) {
        const setCookies = res.headers['set-cookie'] || [];
        if (setCookies.length) {
          if (capture) capture.push.apply(capture, setCookies);
          jar.cookie = setCookies.map(function (s) { return s.split(';')[0]; }).join('; ');
          if (jar.cookie && jar.cookie.trim() === 'mathdrill_session=') jar.cookie = null;
        }
        let data = '';
        res.on('data', function (c) { data += c; });
        res.on('end', function () {
          let json = null;
          try { json = JSON.parse(data); } catch (e) { /* non-json */ }
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            headers: res.headers,
            json: function () { return Promise.resolve(json); }
          });
        });
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  };
}

async function main() {
  // reset dev store (temporary dev store — M10-E sẽ thay bằng DB)
  fs.mkdirSync(DATA_DIR, { recursive: true });
  ['users.json', 'sessions.json'].forEach(function (f) {
    try { fs.unlinkSync(path.join(DATA_DIR, f)); } catch (e) {}
  });

  const srvmod = require('../../server/server.js');
  const server = await srvmod.start();
  const port = server.address().port;
  const BASE = 'http://127.0.0.1:' + port;
  console.log('backend on ' + BASE);

  // browser primitives trong Node
  const jar = {};
  const setCookieCapture = [];
  globalThis.fetch = makeJarFetch(jar, setCookieCapture);
  globalThis.__M10C_API_BASE = BASE;

  const Save = require('../js/save.js');
  const mod = require('../js/auth.js');
  const AccountSystem = mod.AccountSystem;
  const auth = new AccountSystem();

  const U = 'm10c_user_' + Date.now();
  const PW = 'pw_' + Math.random().toString(36).slice(2, 10);
  const PW2 = 'pw2_' + Math.random().toString(36).slice(2, 10);

  // T01 register
  await check('T01 register', async function () {
    const r = await auth.register(U, PW, 1);
    assert.strictEqual(r.ok, true, 'register ok, got: ' + JSON.stringify(r));
  });

  // T02 duplicate register
  await check('T02 duplicate register rejected', async function () {
    const r = await auth.register(U, PW, 1);
    assert.strictEqual(r.ok, false);
  });

  // T03 login valid
  await check('T03 login valid', async function () {
    const r = await auth.login(U, PW);
    assert.strictEqual(r.ok, true, JSON.stringify(r));
    assert.strictEqual(auth.currentUser, U);
  });

  // T04 login invalid
  await check('T04 login invalid rejected', async function () {
    const a2 = new AccountSystem();
    const r = await a2.login(U, 'wrong-password');
    assert.strictEqual(r.ok, false);
    assert.strictEqual(a2.currentUser, null);
  });

  // T05-T08 cookie attributes (từ Set-Cookie thật của server)
  await check('T05 cookie được tạo', function () {
    assert.ok(setCookieCapture.length > 0, 'no Set-Cookie captured');
    const c = setCookieCapture.find(function (s) { return s.indexOf('mathdrill_session=') === 0; });
    assert.ok(c, 'no session cookie set');
  });
  await check('T06 cookie HttpOnly', function () {
    const c = setCookieCapture.find(function (s) { return s.indexOf('mathdrill_session=') === 0 && s.indexOf('Max-Age=0') < 0; });
    assert.ok(/HttpOnly/i.test(c), 'HttpOnly missing: ' + c);
  });
  await check('T07 cookie SameSite=Lax', function () {
    const c = setCookieCapture.find(function (s) { return s.indexOf('mathdrill_session=') === 0 && s.indexOf('Max-Age=0') < 0; });
    assert.ok(/SameSite=Lax/i.test(c), 'SameSite=Lax missing: ' + c);
  });
  await check('T08 cookie Path=/', function () {
    const c = setCookieCapture.find(function (s) { return s.indexOf('mathdrill_session=') === 0 && s.indexOf('Max-Age=0') < 0; });
    assert.ok(/Path=\//.test(c), 'Path=/ missing: ' + c);
  });

  // T09 /me authenticated (qua auth.me() — dùng cookie jar)
  await check('T09 /me authenticated', async function () {
    const user = await auth.me();
    assert.ok(user, 'me() returned null');
    assert.strictEqual(user.username, U);
    assert.strictEqual(auth.currentUser, U);
  });

  // T10 /me unauthenticated → 401 (jar độc lập, không cookie)
  await check('T10 /me unauthenticated = 401', async function () {
    const bareFetch = makeJarFetch({});
    const res = await bareFetch(BASE + '/api/auth/me');
    assert.strictEqual(res.status, 401);
  });

  // T11 logout
  await check('T11 logout', async function () {
    await auth.logout();
    assert.strictEqual(auth.currentUser, null);
  });

  // T12 /me sau logout = 401
  await check('T12 /me sau logout = 401', async function () {
    const res = await globalThis.fetch(BASE + '/api/auth/me');
    assert.strictEqual(res.status, 401);
  });

  // T13 change password (cần login lại — server xoá session sau đổi)
  await check('T13 change password', async function () {
    const r = await auth.login(U, PW);
    assert.strictEqual(r.ok, true);
    const c = await auth.changePassword(U, PW, PW2);
    assert.strictEqual(c.ok, true, JSON.stringify(c));
  });

  // T14 old password fail
  await check('T14 old password rejected sau đổi', async function () {
    const a2 = new AccountSystem();
    const r = await a2.login(U, PW);
    assert.strictEqual(r.ok, false);
  });

  // T15 new password works
  await check('T15 new password works', async function () {
    const r = await auth.login(U, PW2);
    assert.strictEqual(r.ok, true, JSON.stringify(r));
    assert.strictEqual(auth.currentUser, U);
  });

  // T16-T18 response không chứa secret
  await check('T16 response không chứa password', async function () {
    const res = await globalThis.fetch(BASE + '/api/auth/me');
    const s = JSON.stringify(await res.json());
    assert.ok(s.indexOf('password') < 0, 'leak password field: ' + s);
    assert.ok(s.indexOf(PW) < 0 && s.indexOf(PW2) < 0, 'leak plaintext password');
  });
  await check('T17 response không chứa hash/salt', async function () {
    const res = await globalThis.fetch(BASE + '/api/auth/me');
    const s = JSON.stringify(await res.json());
    assert.ok(s.indexOf('passwordHash') < 0, 'leak passwordHash');
    assert.ok(s.indexOf('salt') < 0, 'leak salt');
    assert.ok(s.indexOf('scrypt$') < 0, 'leak scrypt hash');
  });
  await check('T18 response không chứa session ID', async function () {
    const res = await globalThis.fetch(BASE + '/api/auth/me');
    const s = JSON.stringify(await res.json());
    assert.ok(s.indexOf('sessionId') < 0 && s.indexOf('session_id') < 0, 'leak session id: ' + s);
    assert.ok(s.toLowerCase().indexOf('mathdrill_session') < 0, 'leak cookie name');
  });

  // T19-T20 localStorage không chứa password/token
  await check('T19 localStorage không chứa plaintext password', function () {
    for (const k of Object.keys(Save.KEYS)) {
      const v = Save.load(Save.KEYS[k], null);
      if (v == null) continue;
      const s = JSON.stringify(v);
      assert.ok(s.indexOf(PW) < 0 && s.indexOf(PW2) < 0, 'plaintext password leak trong ' + Save.KEYS[k]);
      assert.ok(s.indexOf('passwordHash') < 0 && s.indexOf('scrypt$') < 0, 'hash leak trong ' + Save.KEYS[k]);
    }
  });
  await check('T20 localStorage không chứa session token', function () {
    for (const k of Object.keys(Save.KEYS)) {
      const v = Save.load(Save.KEYS[k], null);
      if (v == null) continue;
      const s = JSON.stringify(v);
      assert.ok(s.indexOf('mathdrill_session') < 0 && s.indexOf('sessionId') < 0, 'session token leak trong ' + Save.KEYS[k]);
    }
  });

  // T21 server unavailable → KHÔNG fallback localStorage
  await check('T21 server unavailable: no localStorage fallback', async function () {
    Save.save(Save.KEYS.ACCOUNTS, { legacyuser: { password: 'legacy_plain_pw', status: 'active', data: {} } });
    delete require.cache[require.resolve('../js/auth.js')];
    globalThis.__M10C_API_BASE = 'http://127.0.0.1:1'; // port đóng
    const mod2 = require('../js/auth.js');
    const a2 = new mod2.AccountSystem();
    const r = await a2.login('legacyuser', 'legacy_plain_pw');
    assert.strictEqual(r.ok, false, 'KHÔNG được login từ localStorage khi server down');
    assert.strictEqual(a2.currentUser, null);
    delete require.cache[require.resolve('../js/auth.js')];
    globalThis.__M10C_API_BASE = BASE;
    require('../js/auth.js');
  });

  // T22 repeated login/logout consistency
  await check('T22 repeated login/logout consistency', async function () {
    const a = new AccountSystem();
    for (let i = 0; i < 3; i++) {
      const li = await a.login(U, PW2);
      assert.strictEqual(li.ok, true, 'login #' + i);
      assert.strictEqual(a.currentUser, U);
      const me1 = await a.me();
      assert.ok(me1, 'me after login #' + i);
      await a.logout();
      assert.strictEqual(a.currentUser, null);
      const res = await globalThis.fetch(BASE + '/api/auth/me');
      assert.strictEqual(res.status, 401, 'me sau logout #' + i);
    }
  });

  await srvmod.stop();
  console.log('\nM10-C frontend auth: pass=' + pass + ' fail=' + fail);
  if (fail > 0) { console.log('FAILED: ' + failures.join(', ')); process.exit(1); }
  process.exit(0);
}

main().catch(function (e) {
  console.error('FATAL', e);
  process.exit(1);
});

