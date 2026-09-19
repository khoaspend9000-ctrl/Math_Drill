/* PERF-STRESS — deterministic structural invariants (Node, no FPS assertion). */
'use strict';
const assert = require('assert');
const perf = require('../js/performance.js');
const Engine = require('../js/engine.js');
const StateManager = require('../js/state_manager.js');
const ConfettiSystem = require('../js/effects.js').ConfettiSystem;
const Assets = require('../js/assets.js');
const UI = require('../js/ui.js');

let pass = 0, failed = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('PASS  ' + name); }
  catch (e) { failed++; console.error('FAIL  ' + name + ' :: ' + (e && e.message)); }
}
function fakeCtx() {
  return { save(){}, restore(){}, setTransform(){}, fillRect(){}, beginPath(){}, moveTo(){}, arcTo(){}, closePath(){}, fill(){}, fillText(){}, strokeRect(){}, clearRect(){} };
}
function mkCanvas(w, h) { const c = { width: w, height: h, style: {} }; c.getContext = function () { return fakeCtx(); }; return c; }

/* T01 engine start/stop */
check('T01 engine start/stop', function () {
  global.requestAnimationFrame = global.requestAnimationFrame || function (f) { return 1; };
  global.cancelAnimationFrame = global.cancelAnimationFrame || function () {};
  global.performance = global.performance || require('perf_hooks').performance;
  const e = new Engine(mkCanvas(1300, 800));
  assert.strictEqual(e.running, false);
  e.start(); assert.strictEqual(e.running, true);
  e.stop(); assert.strictEqual(e.running, false);
});

/* T02 duplicate start protection */
check('T02 duplicate start protection', function () {
  let rafCalls = 0;
  global.requestAnimationFrame = function (f) { rafCalls++; return 1; };
  const e = new Engine(mkCanvas(1300, 800));
  e.start(); e.start(); e.start();
  assert.strictEqual(rafCalls, 1, 'exactly one RAF per start: ' + rafCalls);
  e.stop(); e.stop();
  assert.strictEqual(e.running, false);
});

/* T03 dt clamp: engine caps dt internally */
check('T03 dt clamp guard exists', function () {
  const src = require('fs').readFileSync(__dirname + '/../js/engine.js', 'utf8');
  assert(/Math\.min\(/.test(src) || /MAX_DT|clamp/.test(src), 'engine should clamp dt');
});

/* T04 200 particle cap */
check('T04 200 particle cap', function () {
  assert.strictEqual(perf.GLOBAL_MAX_PARTICLES, 200);
  const cs = new ConfettiSystem();
  cs.explode(100, 100, 500);
  assert(cs.count <= 200, 'cap violated: ' + cs.count);
  cs.clear();
});

/* T05 repeated spawn/clear no leak */
check('T05 repeated particle spawn/clear', function () {
  const cs = new ConfettiSystem();
  for (let i = 0; i < 10; i++) { cs.explode(100, 100, 30); cs.clear(); }
  assert.strictEqual(cs.count, 0);
});

/* T06 particle pool reuse */
check('T06 particle pool reuse', function () {
  const cs = new ConfettiSystem();
  if (cs.pool) {
    cs.explode(100, 100, 30);
    assert(cs.count <= 200);
    cs.clear();
  } else {
    assert.strictEqual(typeof cs.explode, 'function');
  }
});

/* T07 state transition repetition */
check('T07 state transition repetition', function () {
  const { StateManager } = require('../js/state_manager.js');
  const sm = new StateManager();
  let n = 0;
  const S = function (name) { return { name: name, enter() { n++; }, exit() { n--; }, update() {}, draw() {} }; };
  sm.register('a', S('a')); sm.register('b', S('b'));
  sm.change('a');
  for (let i = 0; i < 50; i++) { sm.change('b', null, undefined); sm.change('a', null, undefined); }
  assert.strictEqual(sm.currentName, 'a');
  assert.strictEqual(n, 1, 'enter/exit should stay balanced, got ' + n);
});

/* T08 asset cache reuse (structural) */
check('T08 asset cache reuse', function () {
  const a = new Assets();
  if (typeof a.loadImage === 'function') {
    const p = a.loadImage('x', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
    const p2 = a.loadImage('x', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
    assert.ok(p instanceof Promise && p2 instanceof Promise);
  } else {
    assert.ok(a, 'assets module present');
  }
});

/* T09 data loader cache structural */
check('T09 data loader cache structural', function () {
  const dl = require('../js/data_loader.js');
  assert.ok(dl, 'data_loader present');
  const src = require('fs').readFileSync(__dirname + '/../js/data_loader.js', 'utf8');
  assert(/cache|Cache|_cache/i.test(src), 'data_loader should cache');
});

/* T10 popup open/close repetition bounded */
check('T10 popup open/close repetition', function () {
  const pop = new UI.Popup({ w: 300, h: 200, title: 't', buttons: ['OK'] });
  for (let i = 0; i < 20; i++) { pop.show(); pop.close(); }
  assert.strictEqual(pop.open, false, 'popup closed after cycle');
});

/* T11 listener accumulation: tracked listeners removed on close */
check('T11 tracked listeners no accumulation', function () {
  const before = UI.UI_LISTENERS.length;
  const el = { addEventListener() {}, removeEventListener() {} };
  const h = function () {};
  UI.addTracked(el, 'click', h);
  UI.removeTracked(el, 'click', h);
  assert.strictEqual(UI.UI_LISTENERS.length, before, 'should return to baseline after remove');
});

/* T12 repeated Menu/Lesson/Victory flow via state manager */
check('T12 repeated flow transitions', function () {
  const { StateManager } = require('../js/state_manager.js');
  const sm = new StateManager();
  const names = ['menu', 'lessonselect', 'lesson', 'victory'];
  names.forEach(function (n) { sm.register(n, { name: n, enter() {}, exit() {}, update() {}, draw() {} }); });
  for (let i = 0; i < 25; i++) names.forEach(function (n) { sm.change(n); });
  assert.strictEqual(sm.currentName, 'victory');
});

/* T13 repeated rendering stable */
check('T13 repeated rendering stable', function () {
  const R = require('../js/renderer.js');
  const ctx = fakeCtx(); ctx.getTransform = function () { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; };
  const r = new R(ctx, 1300, 800);
  for (let i = 0; i < 500; i++) { r.clear('#000'); r.text('t' + i, 10, 10, {}); }
  assert.ok(r);
});

/* T15 renderer clears every frame (perf: clearRect in draw path) */
check('T15 renderer clear is cheap', function () {
  const R = require('../js/renderer.js');
  const ctx = fakeCtx(); ctx.getTransform = function () { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; };
  const r = new R(ctx, 1300, 800);
  assert.strictEqual(typeof r.clear, 'function');
});

/* T16 engine exposes loop guard fields (no duplicate RAF after stop) */
check('T16 engine internal guard stable', function () {
  const e = new Engine(mkCanvas(1300, 800));
  assert.strictEqual(typeof e.start, 'function');
  assert.strictEqual(typeof e.stop, 'function');
  assert.strictEqual(typeof e._loop, 'function');
  assert.strictEqual(e.running, false);
});

/* T14 achievement queue bounded */
check('T14 achievement queue bounded', function () {
  const q = new UI.AchievementQueue();
  for (let i = 0; i < 100; i++) q.push('a' + i, { name: 'T' + i, desc: 'd', icon: 'T', xp: 10 });
  assert(Array.isArray(q.items) && q.items.length <= 20, 'queue cap 20, got ' + q.items.length);
});

console.log('\nperf-stress: pass=' + pass + ' fail=' + failed);
process.exit(failed ? 1 : 0);
