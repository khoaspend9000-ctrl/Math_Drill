'use strict';
/* M12 — clover-rain + book-chrome regression.
 *
 * Root causes reproduced here (both were silent no-ops in the M12 RC commit):
 *  1. Renderer.clear(color) is a FULL-CANVAS fillRect, so the raw "book frame"
 *     that the RC painted before R.clear() in MenuState.draw / LessonSelectState.draw
 *     was erased on the very same frame. Desktop paints the book AFTER the
 *     background (main.py:2084 fill -> book.draw), never before.
 *  2. effects2.js FallingClover is a BURST pool: `particles` starts empty and
 *     draw() renders nothing until spawn() seeds it. Desktop FallingCloverEffect
 *     pre-allocates `num_clovers` CloverParticle instances (game_init.py:4208) and
 *     recycles them, i.e. an always-on rain. The RC called update()/draw() on an
 *     empty pool, so Menu/Victory/Defeat had no clover layer at all.
 *
 * The tests below pin the fixed behaviour: clear ordering, pool semantics, the
 * Desktop caps (Menu 20 / Victory 15 / Defeat 15), the Desktop book rect
 * (50,50,1200,700) and the clover layer's z-order (background, before content).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Renderer = require('../js/renderer.js');
const FX = require('../js/effects2.js');

const ROOT = path.join(__dirname, '..');
const STATES = fs.readFileSync(path.join(ROOT, 'js', 'states_real.js'), 'utf8');
const UIJS = fs.readFileSync(path.join(ROOT, 'js', 'ui.js'), 'utf8');

let pass = 0, fail = 0;
const failures = [];
function check(name, fn) {
  try { fn(); pass++; console.log('PASS  ' + name); }
  catch (e) { fail++; failures.push(name); console.log('FAIL  ' + name + ' :: ' + (e && e.message)); }
}
function count(hay, needle) {
  return String(hay).split(String(needle)).length - 1;
}

/* Recording 2D-context stub: keeps an ordered op log so the draw order of
   fillRoundRect (beginPath..fill) vs clear (full-canvas fillRect) is provable. */
function stubCtx() {
  const ops = [];
  const rec = (n) => function () { ops.push(n); };
  return {
    ops: ops,
    fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 1, font: '',
    save: rec('save'), restore: rec('restore'),
    fillRect: function (x, y, w, h) { ops.push(['fillRect', x, y, w, h]); },
    beginPath: rec('beginPath'), closePath: rec('closePath'),
    fill: rec('fill'), stroke: rec('stroke'),
    moveTo: rec('moveTo'), lineTo: rec('lineTo'),
    arcTo: rec('arcTo'), quadraticCurveTo: rec('quadraticCurveTo'), arc: rec('arc'),
    translate: rec('translate'), rotate: rec('rotate'),
    getTransform: function () { return {}; }, setTransform: rec('setTransform'),
  };
}
function firstIndex(ops, pred) {
  for (let i = 0; i < ops.length; i++) if (pred(ops[i])) return i;
  return -1;
}

// ---- T01: clear() is a full-canvas fill (root cause of the erased book frame)
check('T01 Renderer.clear() repaints the whole canvas after the frame', function () {
  const c = stubCtx();
  const R = new Renderer(c, 1300, 800);
  R.fillRoundRect(50, 50, 1200, 700, 15, '#503214');
  const frameFill = firstIndex(c.ops, (o) => o === 'fill');
  assert.ok(frameFill >= 0, 'fillRoundRect must emit a fill op');
  R.clear('#192341');
  const clearFill = firstIndex(c.ops, (o) => Array.isArray(o) && o[0] === 'fillRect'
    && o[1] === 0 && o[2] === 0 && o[3] === 1300 && o[4] === 800);
  assert.ok(clearFill >= 0, 'clear must emit a full-canvas fillRect');
  assert.ok(clearFill > frameFill,
    'clear fill (idx ' + clearFill + ') must come AFTER the frame fill (idx ' + frameFill + ') -> frame erased');
});

// ---- T02: unseeded FallingClover renders nothing (the RC no-op, reproduced)
check('T02 unseeded FallingClover draws nothing (RC no-op reproduced)', function () {
  const e = new FX.FallingClover(20);
  assert.strictEqual(e.count, 0, 'pool starts empty');
  const c = stubCtx();
  for (let i = 0; i < 30; i++) { e.update(0.016); e.draw(c); }
  assert.strictEqual(e.count, 0, 'update() alone never seeds the pool');
  assert.strictEqual(count(c.ops.join(','), 'arc'), 0, 'no clover geometry emitted');
  assert.strictEqual(e.active, false, 'empty pool is inactive');
});

// ---- T03: seeded pool renders + respects the constructor cap
check('T03 seeded pool renders clovers and honours the pool cap', function () {
  const e = new FX.FallingClover(20);
  for (let i = 0; i < 20; i++) e.spawn(Math.random() * 1300, -Math.random() * 800);
  assert.strictEqual(e.count, 20, 'Desktop cap 20 for MenuState');
  const c = stubCtx();
  e.update(0.016);
  e.draw(c);
  assert.ok(count(c.ops.join(','), 'arc') >= 80,
    'each clover draws 4 arcs (got ' + count(c.ops.join(','), 'arc') + ')');
  assert.strictEqual(e.active, true);
  const capped = new FX.FallingClover(15);
  for (let i = 0; i < 40; i++) capped.spawn(0, 0);
  assert.strictEqual(capped.count, 15, 'constructor cap must be honoured (Victory/Defeat = 15)');
});


// ---- T04: Desktop clover caps wired into the three states
check('T04 Desktop clover caps 20/15/15 wired via cloverRain()', function () {
  const calls = STATES.match(/cloverRain\(this\.cloverEffect,\s*(\d+)\)/g) || [];
  const caps = calls.map(function (s) { return Number(s.match(/(\d+)\)$/)[1]); }).sort();
  assert.deepStrictEqual(caps, [15, 15, 20],
    'expected Menu 20 + Victory 15 + Defeat 15, got ' + JSON.stringify(caps));
  assert.strictEqual(count(STATES, 'function cloverRain(effect, cap)'), 1, 'helper defined once');
  assert.strictEqual(count(STATES, 'new global.FallingClover(20)'), 1, 'MenuState cap 20 (main.py:422)');
  assert.strictEqual(count(STATES, 'new global.FallingClover(15)'), 2, 'Victory/Defeat cap 15 (main.py:1091/1020)');
});

// ---- T05: clover layer is painted as a background layer (Desktop z-order)
check('T05 clover layer painted before state content', function () {
  assert.strictEqual(count(STATES, 'drawClover(R, this.cloverEffect)'), 3, '3 draw sites');
  assert.strictEqual(count(STATES, 'function drawClover(R, effect)'), 1, 'helper defined once');
  const menuBase = STATES.indexOf('class MenuState');
  const menu = STATES.indexOf('drawClover(R, this.cloverEffect)', menuBase);
  const menuTitle = STATES.indexOf("R.text('MATHDRILL'", menuBase);
  assert.ok(menu >= 0 && menuTitle > menu, 'Menu: clover before MATHDRILL title');
  const vicBase = STATES.indexOf('class VictoryState');
  const vic = STATES.indexOf('drawClover(R, this.cloverEffect)', vicBase);
  const vicTitle = STATES.indexOf('🏆 HOÀN THÀNH BÀI HỌC', vicBase);
  assert.ok(vic >= 0 && vicTitle > vic, 'Victory: clover before the victory UI');
  const defBase = STATES.indexOf('class DefeatState');
  const def = STATES.indexOf('drawClover(R, this.cloverEffect)', defBase);
  const defText = STATES.indexOf('CỐ LÊN NÀO! 💪', defBase);
  assert.ok(def >= 0 && defText > def, 'Defeat: clover before the panel');
});

// ---- T06: the dead pre-clear frame is gone, update no longer fakes dt
check('T06 dead pre-clear frame removed; clover advanced with real dt', function () {
  assert.strictEqual(count(STATES, "fillRoundRect(50, 50, 1200, 700, 15, '#503214')"), 0,
    'raw book frame must not be painted in a state draw()');
  assert.strictEqual(count(STATES, "fillRoundRect(600, 50, 10, 700, 5, '#969696')"), 0,
    'raw spine approximation must be gone (UI.RealisticBook owns the chrome)');
  assert.strictEqual(count(STATES, 'this.cloverEffect.update(0.016)'), 0,
    'clover must be advanced from update(dt), not draw() with a hard-coded dt');
});

// ---- T07: book chrome uses the Desktop rect (50,50,1200,700), not the default
check('T07 P1 book chrome built with Desktop rect 50,50,1200,700', function () {
  assert.ok(UIJS.indexOf('o.x || 150') >= 0, 'ui.js default rect still (150,100,1000,600)');
  assert.strictEqual(count(STATES, 'var BOOK_RECT = { x: 50, y: 50, w: 1200, h: 700 };'), 1,
    'Desktop book rect declared');
  assert.strictEqual(count(STATES, 'new RB([], BOOK_RECT)'), 1,
    'book constructed with the Desktop rect');
});

console.log('\nM12_CLOVER_BOOK: pass=' + pass + ' fail=' + fail);
if (fail > 0) {
  console.log('FAILED: ' + failures.join(', '));
  process.exit(1);
}
