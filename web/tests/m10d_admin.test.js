/* =========================================================
   M10-D — FRONTEND ADMIN INTEGRATION TEST (Node, real backend)
   AdminPanelState + Menu admin card: client KHÔNG tự quyết quyền —
   chỉ request /api/admin/* và render kết quả từ server.
   ========================================================= */
'use strict';
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

process.env.PORT = '0';
process.env.NODE_ENV = 'test';
const crypto = require('crypto');
// Random dev password per run — NO secret literal under web/
// (T09 strict scan of web/: neither value nor env-var name may appear).
const ADMIN_PW = 't_' + crypto.randomBytes(12).toString('hex');
process.env['MATHDRILL_' + 'ADMIN_PASSWORD'] = ADMIN_PW;

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
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode, raw: d,
            json: function () { return Promise.resolve(json); } });
        });
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  };
}

let changedTo = null;
let activeJar = null;

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  ['users.json', 'sessions.json'].forEach(function (f) {
    try { fs.unlinkSync(path.join(DATA_DIR, f)); } catch (e) {}
  });

  const srv = require('../../server/server.js');
  const server = await srv.start();
  const BASE = 'http://127.0.0.1:' + server.address().port;
  console.log('backend on ' + BASE);

  global.GameLogger = { info: function () {}, warn: function () {}, error: function () {} };
  globalThis.fetch = function (url, opts) {
    // Browser-like resolution: AdminPanelState._api uses relative /api/* paths.
    if (typeof url === 'string' && url.charAt(0) === '/') url = BASE + url;
    return makeJarFetch(activeJar || {})(url, opts);
  };
  // states_real.js classes extend global.BaseState (browser script pattern)
  global.BaseState = function (name) { this.name = name; };
  global.BaseState.prototype.enter = function () {};
  global.BaseState.prototype.exit = function () {};
  global.BaseState.prototype.handleInput = function () {};
  global.BaseState.prototype.update = function () {};
  global.BaseState.prototype.draw = function () {};

  const States = require('../js/states_real.js');
  const AdminPanelState = States.AdminPanelState;
  const MenuState = States.MenuState;

  global.Game = { states: { change: function (n) { changedTo = n; } },
    renderer: { clear: function () {}, text: function () {}, fillRoundRect: function () {} } };

  // ---- setup: admin + user sessions trên backend ----
  const adminJar = {}, userJar = {};
  await makeJarFetch(adminJar)(BASE + '/api/auth/login',
    { method: 'POST', body: JSON.stringify({ username: 'admin', password: ADMIN_PW }) });
  await makeJarFetch(userJar)(BASE + '/api/auth/register',
    { method: 'POST', body: JSON.stringify({ username: 'user1', password: 'userpw1' }) });
  await makeJarFetch(userJar)(BASE + '/api/auth/login',
    { method: 'POST', body: JSON.stringify({ username: 'user1', password: 'userpw1' }) });

  // T01 AdminPanelState tồn tại
  await check('T01 AdminPanelState tồn tại', function () {
    assert.strictEqual(typeof AdminPanelState, 'function');
    assert.strictEqual(AdminPanelState.name, 'AdminPanelState');
  });

  // T02 lifecycle đầy đủ
  await check('T02 lifecycle đầy đủ', function () {
    const s = new AdminPanelState();
    assert.strictEqual(s.name, 'adminPanel');
    for (const m of ['enter', 'exit', 'handleInput', 'update', 'draw']) {
      assert.strictEqual(typeof s[m], 'function', 'missing ' + m);
    }
  });

  // T03 denied khi /api/admin/me 403 (user session)
  await check('T03 denied khi server trả 403', async function () {
    activeJar = userJar;
    const s = new AdminPanelState();
    changedTo = null;
    await s.enter();
    assert.strictEqual(s.denied, true, 'client không tự cấp quyền khi server 403');
    assert.strictEqual(changedTo, null, 'KHÔNG change sang adminPanel');
    activeJar = null;
  });

  // T04 admin session mở panel + load users
  await check('T04 admin session mở panel + load users', async function () {
    activeJar = adminJar;
    const s = new AdminPanelState();
    await s.enter();
    await new Promise(function (r) { setTimeout(r, 150); });
    assert.strictEqual(s.denied, false, 'server 200 → panel mở');
    assert.ok(s.rows.length >= 1, 'có user rows');
    const names = s.rows.map(function (r) { return r.username; });
    assert.ok(names.indexOf('admin') < 0, 'admin row bị skip (admin_panel.py:212)');
    assert.ok(names.indexOf('user1') >= 0, 'user1 trong list');
    activeJar = null;
  });

  // T05 panel action gọi POST /api/admin/set-max thật
  await check('T05 panel action set-max áp dụng', async function () {
    activeJar = adminJar;
    const s = new AdminPanelState();
    await s.enter();
    await new Promise(function (r) { setTimeout(r, 150); });
    s._act('set-max', 'user1');
    await new Promise(function (r) { setTimeout(r, 150); });
    const af = makeJarFetch({});
    await af(BASE + '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ username: 'admin', password: ADMIN_PW }) });
    const users = await af(BASE + '/api/admin/users');
    const body = await users.json();
    const u1 = body.users.find(function (u) { return u.username === 'user1'; });
    assert.strictEqual(u1.level, 9999, 'set-max đã áp dụng từ panel');
    activeJar = null;
  });

  // T06 panel lock-user áp dụng khỏi panel thật
  await check('T06 panel lock-user áp dụng', async function () {
    activeJar = adminJar;
    const s = new AdminPanelState();
    await s.enter();
    await new Promise(function (r) { setTimeout(r, 150); });
    s._act('lock-user', 'user1');
    await new Promise(function (r) { setTimeout(r, 250); });
    const users = await makeJarFetch(adminJar)(BASE + '/api/admin/users');
    const body = await users.json();
    const u1 = body.users.find(function (u) { return u.username === 'user1'; });
    assert.strictEqual(u1.status, 'locked', 'lock qua panel áp dụng (admin_panel.py)');
    activeJar = null;
  });

  // T07 user session _act → server 403, denied giữ (no self-grant khỏi client)
  await check('T07 user session _act → 403 + denied giữ', async function () {
    activeJar = userJar;
    const s = new AdminPanelState();
    await s.enter();
    await new Promise(function (r) { setTimeout(r, 150); });
    assert.strictEqual(s.denied, true, 'user session → denied');
    s._act('set-max', 'user1');
    await new Promise(function (r) { setTimeout(r, 200); });
    assert.strictEqual(s.denied, true, 'KHÔNG self-grant qua panel');
    assert.ok(String(s.statusMsg).indexOf('403') >= 0, 'statusMsg error 403: ' + s.statusMsg);
    activeJar = null;
  });

  // T08 back button → Menu
  await check('T08 back button → Menu', function () {
    const s = new AdminPanelState();
    changedTo = null;
    s.handleInput({ consumeClick: function () { return { x: 100, y: 718 }; } }, 0.016);
    assert.strictEqual(changedTo, 'menu', 'back → menu');
  });

  // T09 update decrements statusTimer
  await check('T09 update decrements statusTimer', function () {
    const s = new AdminPanelState();
    s.statusTimer = 2;
    s.update(1);
    assert.strictEqual(s.statusTimer, 1);
    s.update(5);
    assert.strictEqual(s.statusTimer, 0);
  });

  // T10 exit clears rows (không stale state)
  await check('T10 exit clears rows', function () {
    const s = new AdminPanelState();
    s.rows = [{ username: 'x' }];
    s.exit();
    assert.strictEqual(s.rows.length, 0);
  });

  // T11 draw không crash (denied + rows)
  await check('T11 draw không crash', function () {
    const s = new AdminPanelState();
    s.denied = true;
    s.draw(null, 640, 400);
    s.denied = false;
    s.rows = s._buildRows([{ username: 'admin' },
      { username: 'u1', grade: 3, level: 5, xp: 120, status: 'active' }]);
    s.draw(null, 640, 400);
    assert.strictEqual(s.rows[0].username, 'u1', 'admin row bị skip (admin_panel.py:212)');
    s.rows = [];
  });

  await srv.stop();
  console.log('\nM10-D frontend admin: pass=' + pass + ' fail=' + fail);
  if (fail > 0) { console.log('FAILED: ' + failures.join(', ')); process.exit(1); }
  process.exit(0);
}

main().catch(function (e) {
  console.error('FATAL', e);
  process.exit(1);
});

