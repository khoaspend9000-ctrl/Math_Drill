// POLISH M2 - Menu dashboard extras + Theory scroll polish (additive; no gameplay change)
var assert = require('assert');
var path = require('path');
var P = require(path.join(__dirname, '..', 'js', 'polish.js'));

var passed = 0, failed = 0, log = [];
function t(name, fn) {
  try { fn(); passed++; log.push('PASS ' + name); }
  catch (e) { failed++; log.push('FAIL ' + name + ' :: ' + e.message); }
}

function fakeCtx(W, H) {
  var calls = [];
  return {
    canvas: { width: W, height: H },
    calls: calls,
    save: function () { calls.push('save'); },
    restore: function () { calls.push('restore'); },
    fillRect: function () { calls.push('fillRect'); },
    strokeRect: function () { calls.push('strokeRect'); },
    fillText: function (s) { calls.push('fillText:' + s); },
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textBaseline: '', globalAlpha: 1
  };
}

t('T01 exports api object', function () {
  assert.strictEqual(typeof P, 'object');
  ['clamp','difficultyLabel','formatStreak','petEvolutionText','formatAchievements','drawMenuLeft','drawTheory','theoryMetrics','attachTheoryScroll'].forEach(function (k) {
    assert.strictEqual(typeof P[k], 'function', 'missing ' + k);
  });
});

t('T02 clamp bounds', function () {
  assert.strictEqual(P.clamp(-5, 0, 10), 0);
  assert.strictEqual(P.clamp(50, 0, 10), 10);
  assert.strictEqual(P.clamp(5, 0, 10), 5);
});

t('T03 clamp non-number returns lo', function () {
  assert.strictEqual(P.clamp(NaN, 3, 10), 3);
  assert.strictEqual(P.clamp(undefined, 7, 10), 7);
});

t('T04 difficultyLabel mapping', function () {
  assert.strictEqual(P.difficultyLabel(1), 'De');
  assert.strictEqual(P.difficultyLabel(2), 'Trung Binh');
  assert.strictEqual(P.difficultyLabel(3), 'Kho');
  assert.strictEqual(P.difficultyLabel(undefined), 'De');
});

t('T05 formatStreak', function () {
  assert.strictEqual(P.formatStreak(0), 'Chuoi: 0 ngay');
  assert.strictEqual(P.formatStreak(4), 'Chuoi: 4 ngay');
  assert.strictEqual(P.formatStreak(-9), 'Chuoi: 0 ngay');
});

t('T06 petEvolutionText', function () {
  assert.strictEqual(P.petEvolutionText(1, 3), 'Tien hoa: 1/3');
  assert.strictEqual(P.petEvolutionText(undefined, undefined), 'Tien hoa: 0/3');
});

t('T07 formatAchievements', function () {
  assert.strictEqual(P.formatAchievements({ achievements_unlocked: [1, 2, 3] }), 'Thanh tich: 3');
  assert.strictEqual(P.formatAchievements({ achievements: [1] }), 'Thanh tich: 1');
  assert.strictEqual(P.formatAchievements(null), 'Thanh tich: 0');
});

t('T08 drawMenuLeft renders on normal canvas', function () {
  var ctx = fakeCtx(1280, 720);
  var state = { game: { player: { data: { difficulty: 2, daily_streak: 3, pet_stage: 1, pet_max_stage: 3, achievements_unlocked: [1, 2] } } } };
  assert.strictEqual(P.drawMenuLeft(state, ctx), true);
  assert.ok(ctx.calls.indexOf('fillRect') >= 0, 'expected fillRect');
  assert.ok(ctx.calls.indexOf('fillText:Do kho: Trung Binh') >= 0, 'expected difficulty line');
  assert.ok(ctx.calls.indexOf('fillText:Chuoi: 3 ngay') >= 0, 'expected streak line');
  assert.ok(ctx.calls.indexOf('fillText:Thanh tich: 2') >= 0, 'expected achievement line');
  assert.ok(ctx.calls.indexOf('save') >= 0 && ctx.calls.indexOf('restore') >= 0, 'balanced save/restore');
});

t('T09 drawMenuLeft tolerates missing state', function () {
  var ctx = fakeCtx(1280, 720);
  assert.strictEqual(P.drawMenuLeft(null, ctx), true);
});

t('T10 drawMenuLeft returns false without ctx or tiny canvas', function () {
  assert.strictEqual(P.drawMenuLeft({}, null), false);
  assert.strictEqual(P.drawMenuLeft({}, fakeCtx(50, 50)), false);
});

t('T11 theoryMetrics clamps scroll', function () {
  var state = { _theoryContentHeight: 1000, _theoryViewHeight: 400, _theoryScroll: 9999 };
  var m = P.theoryMetrics(state, fakeCtx(800, 400), 400);
  assert.strictEqual(m.max, 600);
  assert.strictEqual(m.scroll, 600);
  assert.ok(m.ratio > 0 && m.ratio < 1);
});

t('T12 attachTheoryScroll binds once and clamps wheel', function () {
  var handlers = {};
  var canvas = { addEventListener: function (ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); } };
  var state = { _theoryMaxScroll: 100, _theoryScroll: 0 };
  assert.strictEqual(P.attachTheoryScroll(state, canvas), true);
  P.attachTheoryScroll(state, canvas);
  assert.strictEqual(handlers.wheel.length, 1, 'wheel must bind exactly once');
  handlers.wheel[0]({ deltaY: 40, preventDefault: function () {} });
  assert.strictEqual(state._theoryScroll, 40);
  handlers.wheel[0]({ deltaY: 1000, preventDefault: function () {} });
  assert.strictEqual(state._theoryScroll, 100, 'must clamp to max');
  handlers.wheel[0]({ deltaY: -1000, preventDefault: function () {} });
  assert.strictEqual(state._theoryScroll, 0, 'must clamp to 0');
});

t('T13 drawTheory draws indicator when overflow', function () {
  var ctx = fakeCtx(1280, 720);
  var state = { _theoryContentHeight: 2000, _theoryViewHeight: 500, _theoryScroll: 100 };
  assert.strictEqual(P.drawTheory(state, ctx), true);
  assert.ok(ctx.calls.indexOf('fillRect') >= 0);
  assert.strictEqual(P.drawTheory({ _theoryContentHeight: 100, _theoryViewHeight: 500 }, fakeCtx(1280, 720)), false);
});

t('T14 global MenuDashboardExtras exposed', function () {
  assert.strictEqual(typeof globalThis.MenuDashboardExtras, 'object');
  assert.strictEqual(typeof globalThis.MenuDashboardExtras.drawMenuLeft, 'function');
});

log.forEach(function (l) { console.log(l); });
console.log('');
console.log('M2 POLISH: pass=' + passed + ' fail=' + failed);
process.exit(failed ? 1 : 0);
