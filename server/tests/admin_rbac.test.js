/* =========================================================
   M10-D — ADMIN RBAC TESTS (real HTTP backend, T01–T14+)
   Server là authority duy nhất cho role. Client không thể
   tự cấp quyền bằng body/cookie/localStorage.
   ========================================================= */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

process.env.PORT = '0';
process.env.NODE_ENV = 'test';
process.env.MATHDRILL_ADMIN_PASSWORD = 'adminpw_test_secret'; // chỉ tồn tại ở env server

const DATA_DIR = path.join(__dirname, '..', 'data');

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

function makeJarFetch(jar) {
  return function jarFetch(url, opts) {
    opts = opts || {};
    return new Promise(function (resolve, reject) {
      let body = opts.body || null;
      if (body && typeof body !== 'string') body = JSON.stringify(body);
      const u = new URL(url);
      const m = (opts.method || 'GET').toUpperCase();
      const headers = Object.assign({}, opts.headers || {});
      if (jar.cookie) headers['Cookie'] = jar.cookie;
      // M10-F F3: server yêu cầu application/json trên mọi POST (kể cả không body
      // — auth.test.js/auth_frontend.test.js/... set header vô điều kiện giống vậy).
      if (m === 'POST' && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
      if (body) headers['Content-Length'] = Buffer.byteLength(body);
      const req = http.request({
        hostname: u.hostname, port: u.port || 80,
        path: u.pathname + u.search,
        method: opts.method || 'GET', headers: headers
      }, function (res) {
        const sc = res.headers['set-cookie'] || [];
        if (sc.length) {
          jar.cookie = sc.map(function (s) { return s.split(';')[0]; }).join('; ');
          if (jar.cookie && jar.cookie.trim() === 'mathdrill_session=') jar.cookie = null;
        }
        let d = '';
        res.on('data', function (c) { d += c; });
        res.on('end', function () {
          let json = null;
          try { json = JSON.parse(d); } catch (e) {}
          resolve({ status: res.statusCode, headers: res.headers, raw: d,
            json: function () { return Promise.resolve(json); } });
        });
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  };
}
async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  ['users.json', 'sessions.json', 'mathdrill.db', 'mathdrill.db-shm', 'mathdrill.db-wal'].forEach(function (f) {
    try { fs.unlinkSync(path.join(DATA_DIR, f)); } catch (e) {}
  });

  const srv = require('../server.js');
  const server = await srv.start();
  const port = server.address().port;
  const BASE = 'http://127.0.0.1:' + port;
  console.log('backend on ' + BASE);

  const adminJar = {}, userJar = {}, bareJar = {}, tamperJar = {};
  const adminFetch = makeJarFetch(adminJar);
  const userFetch = makeJarFetch(userJar);
  const bareFetch = makeJarFetch(bareJar);
  const tamperFetch = makeJarFetch(tamperJar);
  const ADMIN_ROUTES = ['/api/admin/me', '/api/admin/users',
    '/api/admin/set-max', '/api/admin/lock-user', '/api/admin/reset-user'];

  // ---- setup: admin + normal user đăng nhập ----
  const li = await adminFetch(BASE + '/api/auth/login',
    { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'adminpw_test_secret' }) });
  assert.strictEqual(li.status, 200, 'admin login phải OK: ' + li.status);

  await userFetch(BASE + '/api/auth/register',
    { method: 'POST', body: JSON.stringify({ username: 'user1', password: 'userpw1' }) });
  const uli = await userFetch(BASE + '/api/auth/login',
    { method: 'POST', body: JSON.stringify({ username: 'user1', password: 'userpw1' }) });
  assert.strictEqual(uli.status, 200, 'user login phải OK');
  const userBody = await uli.json();
  assert.strictEqual(userBody.user.role, 'user', 'role mặc định = user');

  // T01 unauthenticated admin API → 401
  await check('T01 unauthenticated admin API → 401', async function () {
    for (const route of ADMIN_ROUTES) {
      const res = await bareFetch(BASE + route,
        { method: route.indexOf('me') > 0 || route.indexOf('users') > 0 ? 'GET' : 'POST' });
      assert.strictEqual(res.status, 401, route + ' phải 401, got ' + res.status);
    }
  });

  // T02 normal user → 403
  await check('T02 normal user → 403', async function () {
    for (const route of ADMIN_ROUTES) {
      const res = await userFetch(BASE + route,
        { method: route.indexOf('me') > 0 || route.indexOf('users') > 0 ? 'GET' : 'POST' });
      assert.strictEqual(res.status, 403, route + ' phải 403, got ' + res.status);
    }
  });

  // T03 admin → 200
  await check('T03 admin → 200', async function () {
    const me = await adminFetch(BASE + '/api/admin/me');
    assert.strictEqual(me.status, 200);
    const users = await adminFetch(BASE + '/api/admin/users');
    assert.strictEqual(users.status, 200);
  });

  // T04 frontend role tampering → 403 (user ĐÃ có session gửi body role/is_admin)
  await check('T04 role tampering qua body → 403', async function () {
    const res = await userFetch(BASE + '/api/admin/me',
      { method: 'POST', body: JSON.stringify({ role: 'admin', is_admin: true }) });
    assert.strictEqual(res.status, 403, 'tamper /me phải 403');
    const res2 = await userFetch(BASE + '/api/admin/users');
    assert.strictEqual(res2.status, 403, 'tamper /users phải 403');
  });

  // T05 body is_admin=true không cấp quyền
  await check('T05 body is_admin=true không cấp quyền', async function () {
    for (const route of ['/api/admin/set-max', '/api/admin/lock-user', '/api/admin/reset-user']) {
      const res = await userFetch(BASE + route, {
        method: 'POST',
        body: JSON.stringify({ username: 'user1', is_admin: true })
      });
      assert.strictEqual(res.status, 403, route + ' vẫn phải 403');
    }
  });

  // T06 body role=admin không cấp quyền
  await check('T06 body role=admin không cấp quyền', async function () {
    for (const route of ['/api/admin/set-max', '/api/admin/lock-user', '/api/admin/reset-user']) {
      const res = await userFetch(BASE + route, {
        method: 'POST',
        body: JSON.stringify({ username: 'user1', role: 'admin' })
      });
      assert.strictEqual(res.status, 403, route + ' vẫn phải 403');
    }
    const users = await adminFetch(BASE + '/api/admin/users');
    const body = await users.json();
    const u1 = body.users.find(function (u) { return u.username === 'user1'; });
    assert.ok(u1, 'user1 tồn tại trong list');
    assert.strictEqual(u1.role, 'user', 'role user1 không thể tự nâng');
  });


  // T07 localStorage admin flag không cấp quyền (server không đọc flag nào)
  await check('T07 admin flag trong mọi nơi không cấp quyền', async function () {
    for (const route of ['/api/admin/set-max', '/api/admin/lock-user', '/api/admin/reset-user']) {
      const res = await bareFetch(BASE + route, {
        method: 'POST',
        body: JSON.stringify({ username: 'user1', is_admin: true, role: 'admin', isAdmin: true })
      });
      assert.strictEqual(res.status, 401, route + ' bare vẫn 401');
    }
  });

  // T08 admin secret không xuất hiện API response
  await check('T08 secret không trong API response', async function () {
    const me = await adminFetch(BASE + '/api/admin/me');
    assert.ok(me.raw.indexOf('adminpw_test_secret') < 0, 'leak secret trong /me');
    const users = await adminFetch(BASE + '/api/admin/users');
    assert.ok(users.raw.indexOf('adminpw_test_secret') < 0, 'leak secret trong /users');
    assert.ok(users.raw.indexOf('passwordHash') < 0 && users.raw.indexOf('scrypt$') < 0, 'leak hash trong /users');
  });

  // T09 admin secret không xuất hiện frontend source
  await check('T09 secret không trong frontend source', function () {
    const jsDir = path.join(__dirname, '..', '..', 'web');
    function walk(dir) {
      const out = [];
      for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        const st = fs.statSync(p);
        if (st.isDirectory()) out.push.apply(out, walk(p));
        else if (/\.js$|\.html$|\.json$/.test(f)) out.push(p);
      }
      return out;
    }
    for (const p of walk(jsDir)) {
      const c = fs.readFileSync(p, 'utf8');
      assert.ok(c.indexOf('adminpw_test_secret') < 0, 'secret leak: ' + p);
      assert.ok(c.indexOf('MATHDRILL_ADMIN_PASSWORD') < 0, 'env var name leak: ' + p);
    }
  });

  // T10 admin endpoint session required (tất cả routes)
  await check('T10 admin endpoint session required', async function () {
    for (const route of ADMIN_ROUTES) {
      const res = await bareFetch(BASE + route,
        { method: route.indexOf('me') > 0 || route.indexOf('users') > 0 ? 'GET' : 'POST' });
      assert.strictEqual(res.status, 401, route + ' không session → 401');
    }
  });

  // T11 logout invalidates admin access
  await check('T11 logout invalidates admin access', async function () {
    const loJar = {};
    const f = makeJarFetch(loJar);
    await f(BASE + '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'adminpw_test_secret' }) });
    const me1 = await f(BASE + '/api/admin/me');
    assert.strictEqual(me1.status, 200, 'admin me sau login = 200');
    await f(BASE + '/api/auth/logout', { method: 'POST' });
    const me2 = await f(BASE + '/api/admin/me');
    assert.strictEqual(me2.status, 401, 'admin me sau logout phải 401');
  });

  // T12 expired session invalidates admin access
  await check('T12 expired session invalidates admin access', async function () {
    const expJar = {};
    const f = makeJarFetch(expJar);
    await f(BASE + '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'adminpw_test_secret' }) });
    srv.sessionStore.deleteAllUserSessions('admin');
    const me = await f(BASE + '/api/admin/me');
    assert.strictEqual(me.status, 401, 'session expired → 401');
  });


  // T13 arbitrary username cannot become admin
  await check('T13 arbitrary username không thành admin', async function () {
    const f = makeJarFetch({});
    await f(BASE + '/api/auth/register',
      { method: 'POST', body: JSON.stringify({ username: 'hacker', password: 'pw123' }) });
    const li2 = await f(BASE + '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ username: 'hacker', password: 'pw123', role: 'admin', is_admin: true }) });
    assert.strictEqual(li2.status, 200, 'login OK nhưng role vẫn user');
    const b = await li2.json();
    assert.strictEqual(b.user.role, 'user', 'role từ server record, không phải body');
    const me = await f(BASE + '/api/admin/me');
    assert.strictEqual(me.status, 403, 'hacker /me → 403');
  });

  // T14 admin audit log không leak secrets
  // (T12 đã xoá mọi session 'admin' — re-login admin cho jar chính trước khi audit)
  await check('T14 audit log không leak secrets', async function () {
    const relogin = await adminFetch(BASE + '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'adminpw_test_secret' }) });
    assert.strictEqual(relogin.status, 200, 'admin re-login sau T12');
    const logs = [];
    const orig = console.log;
    console.log = function () {
      logs.push(Array.prototype.slice.call(arguments).join(' '));
      orig.apply(console, arguments);
    };
    try {
      await adminFetch(BASE + '/api/admin/users');           // list_users
      await adminFetch(BASE + '/api/admin/set-max',
        { method: 'POST', body: JSON.stringify({ username: 'user1' }) });
    } finally {
      console.log = orig;
    }
    const joined = logs.join('\n');
    assert.ok(joined.indexOf('[AdminAudit]') >= 0, 'audit log được ghi');
    assert.ok(joined.indexOf('adminpw_test_secret') < 0, 'audit KHÔNG chứa secret');
    assert.ok(joined.indexOf('userpw1') < 0, 'audit KHÔNG chứa user password');
  });

  // T15+T16 bonus: admin action thật sự hoạt động (set-max + lock)
  await check('T15 admin set-max hoạt động', async function () {
    const res = await adminFetch(BASE + '/api/admin/set-max',
      { method: 'POST', body: JSON.stringify({ username: 'user1' }) });
    assert.strictEqual(res.status, 200);
    const users = await adminFetch(BASE + '/api/admin/users');
    const body = await users.json();
    const u1 = body.users.find(function (u) { return u.username === 'user1'; });
    assert.strictEqual(u1.level, 9999, 'set-max level=9999 (game_init.py:4558)');
    assert.strictEqual(u1.xp, 9800, 'set-max xp=9800');
  });
  await check('T16 admin lock-user hoạt động', async function () {
    const res = await adminFetch(BASE + '/api/admin/lock-user',
      { method: 'POST', body: JSON.stringify({ username: 'user1' }) });
    assert.strictEqual(res.status, 200);
    const users = await adminFetch(BASE + '/api/admin/users');
    const body = await users.json();
    const u1 = body.users.find(function (u) { return u.username === 'user1'; });
    assert.strictEqual(u1.status, 'locked', 'user1 bị khóa');
    const f = makeJarFetch({});
    const li3 = await f(BASE + '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ username: 'user1', password: 'userpw1' }) });
    assert.strictEqual(li3.status, 401, 'user bị khóa login → 401 (game_init.py:4524)');
  });

  await srv.stop();
  console.log('\nM10-D admin RBAC: pass=' + pass + ' fail=' + fail);
  if (fail > 0) { console.log('FAILED: ' + failures.join(', ')); process.exit(1); }
  process.exit(0);
}

main().catch(function (e) {
  console.error('FATAL', e);
  process.exit(1);
});

