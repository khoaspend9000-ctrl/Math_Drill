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