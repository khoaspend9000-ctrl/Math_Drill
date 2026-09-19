'use strict';
/* M8-D PERFORMANCE — verify budget cap, no unbounded allocations, image cache stability, engine stability. */
const assert = require('assert');
const perf = require('../js/performance.js');
const Engine = require('../js/engine.js');
let pass = 0, failed = 0;
function check(name, fn) {
  try {
    fn();
    pass++;
    console.log('PASS  ' + name);
  } catch (e) {
    failed++;
    console.error('FAIL  ' + name + ' :: ' + (e && e.message));
  }
}
try { check('T01 ParticleBudget cap = 200', function () { assert.strictEqual(perf.GLOBAL_MAX_PARTICLES, 200); }); }
catch (e) { failed++; console.error('FAIL  T01 :: ' + (e && e.message)); }
try { check('T02 ParticleBudget request max 200', function () { const p = new perf.ParticleBudget(); assert.strictEqual(p.request(300), 200); assert.strictEqual(p.available(), 0); }); }
catch (e) { failed++; console.error('FAIL  T02 :: ' + (e && e.message)); }
try { check('T03 ParticleBudget request partially', function () { const p = new perf.ParticleBudget(); assert.strictEqual(p.request(50), 50); assert.strictEqual(p.available(), 150); p.release(20); assert.strictEqual(p.available(), 170); }); }
catch (e) { failed++; console.error('FAIL  T03 :: ' + (e && e.message)); }
try { check('T04 ParticleBudget reset clears', function () { const p = new perf.ParticleBudget(); p.request(100); assert.strictEqual(p.count, 100); p.reset(); assert.strictEqual(p.count, 0); assert.strictEqual(p.available(), 200); }); }
catch (e) { failed++; console.error('FAIL  T04 :: ' + (e && e.message)); }
try { check('T05 SurfaceCache basic', function () { const c = new perf.SurfaceCache(); const surf1 = c.get('key1', function () { return 'surf'; }); assert.strictEqual(surf1, 'surf'); const surf2 = c.get('key1', function () { return 'other'; }); assert.strictEqual(surf2, 'surf'); assert.strictEqual(c.size, 1); }); }
catch (e) { failed++; console.error('FAIL  T05 :: ' + (e && e.message)); }
try { check('T06 SurfaceCache FIFO eviction matches Python pop-first-key', function () {
  const c = new perf.SurfaceCache(2);
  c.get('a', function () { return 'A'; });
  c.get('b', function () { return 'B'; });
  c.get('c', function () { return 'C'; }); // evict a → {b, c}
  assert.strictEqual(c.size, 2);
  assert.strictEqual(c.get('b', function () { return 'x'; }), 'B');
  assert.strictEqual(c.get('c', function () { return 'x'; }), 'C');
  // get('a') → miss → factory → evict b → insert a → {c, a}
  assert.strictEqual(c.get('a', function () { return 'filled'; }), 'filled');
  assert.strictEqual(c.size, 2);
  // b bị eviction → factory gọi
  assert.strictEqual(c.get('b', function () { return 'notB'; }), 'notB');
  assert.strictEqual(c.size, 2); // {a, b}
}); }
catch (e) { failed++; console.error('FAIL  T06 :: ' + (e && e.message)); }
try { check('T07 SurfaceCache clear', function () { const c = new perf.SurfaceCache(); c.get('x', function () { return 1; }); assert.strictEqual(c.size, 1); c.clear(); assert.strictEqual(c.size, 0); }); }
catch (e) { failed++; console.error('FAIL  T07 :: ' + (e && e.message)); }
try { check('T08 Engine instantiation stable', function () { const fakeCanvas = { width: 1300, height: 800, getContext: function () { return { save: function () {}, restore: function () {}, setTransform: function () {}, fillRect: function () {}, beginPath: function () {}, moveTo: function () {}, arcTo: function () {}, closePath: function () {}, fill: function () {}, fillText: function () {}, strokeRect: function () {}, clearRect: function () {} }; } }; const e = new Engine(fakeCanvas); assert.ok(e); e.stop(); }); }
catch (e) { failed++; console.error('FAIL  T08 :: ' + (e && e.message)); }
try { check('T09 Renderer basic operations', function () { const ctx = { save: function () {}, restore: function () {}, setTransform: function () {}, getTransform: function () { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; }, fillRect: function () {}, beginPath: function () {}, moveTo: function () {}, arcTo: function () {}, closePath: function () {}, fill: function () {}, fillText: function () {}, strokeRect: function () {}, clearRect: function () {} }; const Renderer = require('../js/renderer.js'); const r = new Renderer(ctx, 1300, 800); r.clear('#000'); r.text('m8-d', 10, 10, {}); }); }
catch (e) { failed++; console.error('FAIL  T09 :: ' + (e && e.message)); }
try { check('T10 No console errors in performance tests', function () { assert.strictEqual(failed, 0); }); }
catch (e) { failed++; console.error('FAIL  T10 :: ' + (e && e.message)); }
console.log('\nM8-D Performance: pass=' + pass + ' fail=' + failed);
process.exit(failed ? 1 : 0);
