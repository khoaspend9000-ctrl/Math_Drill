// POLISH M2 tests — additive polish module contract (Menu dashboard + Theory)
'use strict';
const assert = require('assert');
const P = require('../js/polish_m2.js');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('PASS ' + name); }
  catch (e) { fail++; console.log('FAIL ' + name + ' :: ' + e.message); }
}

t('T01 module surface', () => {
  assert.strictEqual(typeof P.install, 'function');
  assert.strictEqual(typeof P.VERSION, 'string');
  assert.ok(P.VERSION.length > 0);
});

t('T02 expRatio matches exp/need contract', () => {
  assert.strictEqual(P.expRatio(0, 100), 0);
  assert.strictEqual(P.expRatio(50, 100), 0.5);
  assert.strictEqual(P.expRatio(100, 100), 1);
  assert.strictEqual(P.expRatio(250, 100), 1);   // clamped
  assert.strictEqual(P.expRatio(5, 0), 0);       // guard div0
  assert.strictEqual(P.expRatio(-5, 100), 0);    // clamped low
  assert.strictEqual(P.expRatio('abc', 100), 0); // NaN guard
});

t('T03 difficultyLabel covers all tiers', () => {
  assert.strictEqual(P.difficultyLabel(1), 'Dễ');
  assert.strictEqual(P.difficultyLabel(2), 'Trung Bình');
  assert.strictEqual(P.difficultyLabel(3), 'Khó');
  assert.strictEqual(P.difficultyLabel(4), 'Thử Thách');
  assert.strictEqual(P.difficultyLabel(undefined), 'Dễ');
});

t('T04 petProgress', () => {
  assert.strictEqual(P.petProgress(0, 100), 0);
  assert.strictEqual(P.petProgress(25, 100), 0.25);
  assert.strictEqual(P.petProgress(300, 100), 1);
  assert.strictEqual(P.petProgress(10, 0), 0);
});

t('T05 wrapText greedy wrap', () => {
  const out = P.wrapText('a b c d e', 3);
  assert.ok(Array.isArray(out) && out.length >= 2);
  out.forEach(l => assert.ok(l.length <= 3, 'line too long: ' + l));
  assert.strictEqual(P.wrapText('', 10).length, 0);
});

t('T06 clampScroll', () => {
  assert.strictEqual(P.clampScroll(-10, 500, 200), 0);
  assert.strictEqual(P.clampScroll(100, 500, 200), 100);
  assert.strictEqual(P.clampScroll(9999, 500, 200), 300);
  assert.strictEqual(P.clampScroll(50, 100, 200), 0); // content fits
});

t('T07 scrollbarGeometry', () => {
  const g0 = P.scrollbarGeometry(0, 100, 200, 10, 100);
  assert.strictEqual(g0.visible, false);
  const g1 = P.scrollbarGeometry(0, 400, 100, 10, 100);
  assert.strictEqual(g1.visible, true);
  const g2 = P.scrollbarGeometry(300, 400, 100, 10, 100);
  assert.ok(g2.y > g1.y, 'thumb must move down with offset');
  assert.ok(g1.h >= 24);
});

t('T08 install() is safe with no states present', () => {
  const before = P.installed;
  const r = P.install();
  assert.strictEqual(r, P);
  assert.strictEqual(P.installed, true);
  assert.ok(before === false || before === true); // idempotent either way
  P.install(); // second call must not throw
});

t('T09 no global pollution besides PolishM2', () => {
  assert.strictEqual(typeof global.PolishM2, 'object');
  assert.strictEqual(global.PolishM2.VERSION, P.VERSION);
});

t('T10 drawExtras is a no-op without ctx/profile (Node safety)', () => {
  // Must never throw in a headless environment
  P.drawExtras(null, null, 'left');
  P.drawExtras(undefined, undefined, 'right');
  P.drawExtras({}, {}, 'left');
  assert.ok(true);
});

t('T11 drawExtras tolerates minimal fake ctx + profile', () => {
  const calls = [];
  const ctx = {
    fillRect: () => calls.push('rect'),
    fillText: () => calls.push('text'),
    set fillStyle(v) {}, get fillStyle() { return '#000'; },
    set font(v) {}, get font() { return '10px'; }
  };
  const st = { game: { profile: { level: 3, grade: 2, xp: 10, exp_to_next_level: 100, gold: 55, difficulty: 2,
    pet: { xp: 5, xp_next: 10 } } } };
  P.drawExtras(ctx, st, 'left');
  assert.ok(calls.length > 0, 'overlay should draw when ctx+profile exist');
  const calls2 = calls.length;
  P.drawExtras(ctx, { game: { profile: null } }, 'left');
  assert.strictEqual(calls.length, calls2, 'no draw when profile missing');
});

t('T12 drawExtras throws inside ctx are swallowed', () => {
  const ctx = { get fillRect() { throw new Error('boom'); } };
  const st = { game: { profile: { level: 1 } } };
  P.drawExtras(ctx, st, 'left'); // must not throw
  assert.ok(true);
});

console.log('\nPOLISH M2: pass=' + pass + ' fail=' + fail);
process.exit(fail === 0 ? 0 : 1);
