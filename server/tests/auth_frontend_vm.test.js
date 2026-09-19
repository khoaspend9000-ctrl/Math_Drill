'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const AUTH_PATH = path.join(__dirname, '..', '..', 'web', 'js', 'auth.js');

let passed = 0, failed = 0;

function test(name, fn) {
  return new Promise(async (resolve) => {
    try { await fn(); passed++; console.log('PASS  ' + name); }
    catch (e) { failed++; console.log('FAIL  ' + name + ' — ' + e.message); }
    resolve();
  });
}

async function main() {
  await test('F09 auth.js loads in Node', async () => {
    const code = fs.readFileSync(AUTH_PATH, 'utf8');
    const ctx = { window: undefined, module: { exports: {} }, crypto: require('crypto'), TextEncoder: require('util').TextEncoder, TextDecoder: require('util').TextDecoder, console: console };
    ctx.globalThis = ctx; ctx.global = ctx;
    vm.createContext(ctx);
    vm.runInContext(code, ctx);
    assert.ok(ctx.module.exports.AccountSystem, 'AccountSystem exported');
    assert.ok(typeof ctx.module.exports.hashPassword === 'function');
  });

  await test('F10 auth.js with API_BASE', async () => {
    const code = fs.readFileSync(AUTH_PATH, 'utf8');
    let fetchCalled = false;
    const ctx = {
      window: { __M10C_API_BASE: 'http://localhost:39999/api' },
      fetch: function(url, opts) {
        fetchCalled = true;
        // REAL server contract: POST /api/auth/register → 201.
        return Promise.resolve({ ok: true, status: 201, json: () => Promise.resolve({ ok: true, user: { username: opts.body ? JSON.parse(opts.body).username || 'x' : 'x' } }) });
      },
      module: { exports: {} },
      crypto: require('crypto'),
      TextEncoder: require('util').TextEncoder,
      TextDecoder: require('util').TextDecoder,
      console: console
    };
    ctx.globalThis = ctx; ctx.global = ctx;
    vm.createContext(ctx);
    vm.runInContext(code, ctx);
    const auth = new ctx.module.exports.AccountSystem();
    const reg = await auth.register('vmuser', 'pw123');
    assert.ok(reg.ok, 'register: ' + reg.msg);
    assert.ok(fetchCalled, 'fetch called');
  });

  console.log('\nFrontend VM: Passed: ' + passed + ' Failed: ' + failed);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch(err => { console.error(err); process.exit(1); });
