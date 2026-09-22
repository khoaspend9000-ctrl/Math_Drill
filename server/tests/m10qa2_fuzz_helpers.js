'use strict';
/* M10-QA2-E multi-user persistence (helpers only). Real HTTP helpers shared by
 * the parts that run as separate processes (each part re-boots the server). */
const http = require('http');

function httpRaw(port, method, p, rawBody, extraHeaders, cookie) {
  return new Promise((resolve, reject) => {
    const headers = Object.assign({}, extraHeaders || {});
    if (rawBody !== null && rawBody !== undefined) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      headers['Content-Length'] = Buffer.byteLength(rawBody);
    }
    if (cookie) headers['Cookie'] = cookie;
    const rq = http.request({ host: 'localhost', port, path: p, method, headers }, (res) => {
      let b = ''; res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: b }));
    });
    rq.on('error', reject);
    if (rawBody !== null && rawBody !== undefined) rq.write(rawBody);
    rq.end();
  });
}
function httpRequest(port, method, p, body, cookie, extra) {
  const data = body === undefined ? null : JSON.stringify(body);
  return httpRaw(port, method, p, data, extra, cookie);
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
function leakFree(body, where) {
  const assert = require('assert');
  assert.ok(body.indexOf('scrypt$') < 0, where + ': hash leaked');
  assert.ok(body.indexOf('passwordHash') < 0, where + ': passwordHash leaked');
  assert.ok(body.indexOf('node:') < 0, where + ': internal path leaked');
}
module.exports = { httpRaw, httpRequest, parseCookies, leakFree };
