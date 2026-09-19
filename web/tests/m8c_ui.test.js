'use strict';
/* M8-C UI tests: Button/CardButton/ProgressBar/Popup/Achievement/Book/Daily. */
const assert = require('assert');
const UI = require('../js/ui.js');
const InputManager = require('../js/input.js');
let pass = 0, failed = 0;
const errLog = [];
const _err = console.error;
console.error = function () { errLog.push(Array.prototype.slice.call(arguments).join(' ')); };
function check(name, fn) {
  try { fn(); pass++; console.log('PASS  ' + name); }
  catch (e) { failed++; _err.call(console, 'FAIL  ' + name + ' :: ' + (e && e.message)); }
}
function mockR() {
  return { calls: [], fillRoundRect: function () { this.calls.push('rr'); }, text: function (s) { this.calls.push('t:' + s); } };
}
check('T01 Button hitTest inside', function () {
  const b = new UI.Button(100, 100, 200, 60, 'OK', [80, 120, 220], {});
  assert.strictEqual(b.hitTest(150, 130), true);
  assert.strictEqual(b.hitTest(100, 100), true);
  assert.strictEqual(b.clicked({ x: 150, y: 130 }), true);
});
check('T02 Button outside hitTest', function () {
  const b = new UI.Button(100, 100, 200, 60, 'OK', [80, 120, 220], {});
  assert.strictEqual(b.hitTest(50, 50), false);
  assert.strictEqual(b.hitTest(301, 130), false);
  assert.strictEqual(b.clicked({ x: 50, y: 50 }), false);
});
check('T03 disabled button cannot click', function () {
  const b = new UI.Button(100, 100, 200, 60, 'OK', [80, 120, 220], { disabled: true });
  assert.strictEqual(b.clicked({ x: 150, y: 130 }), false);
  assert.strictEqual(b.handleClick({ x: 150, y: 130 }), false);
  b.setDisabled(false);
  assert.strictEqual(b.clicked({ x: 150, y: 130 }), true);
});
check('T04 hover state', function () {
  const b = new UI.Button(100, 100, 200, 60, 'OK', [80, 120, 220], {});
  assert.strictEqual(b.setPointer(150, 130), true);
  assert.strictEqual(b.hovered, true);
  assert.strictEqual(b.setPointer(10, 10), false);
  assert.strictEqual(b.hovered, false);
  const d = new UI.Button(100, 100, 200, 60, 'X', [80, 120, 220], { disabled: true });
  assert.strictEqual(d.setPointer(150, 130), false);
});
check('T05 ProgressBar zero', function () {
  const p = new UI.ProgressBar(0, 0, 200, 20, {});
  p.set(0, 100);
  assert.strictEqual(p.ratio, 0);
  assert.strictEqual(p.pct, 0);
  p.draw(mockR());
});
check('T06 ProgressBar full', function () {
  const p = new UI.ProgressBar(0, 0, 200, 20, {});
  p.set(100, 100);
  assert.strictEqual(p.ratio, 1);
  assert.strictEqual(p.pct, 100);
});
check('T07 ProgressBar clamp NaN neg overflow', function () {
  const p = new UI.ProgressBar(0, 0, 200, 20, {});
  p.set(-5, 100); assert.strictEqual(p.ratio, 0);
  p.set(500, 100); assert.strictEqual(p.ratio, 1);
  p.set(NaN, 100); assert.ok(isFinite(p.ratio));
  p.set(10, 0); assert.strictEqual(p.ratio, 0);
  p.set(Infinity, 100); assert.ok(isFinite(p.ratio));
});
check('T08 Popup open close', function () {
  const p = new UI.Popup({ title: 'Hi', buttons: ['OK', 'Cancel'] });
  assert.strictEqual(p.open, false);
  assert.strictEqual(p.show(), true);
  assert.strictEqual(p.open, true);
  assert.strictEqual(p.buttons.length, 2);
  const r = p.clickButton(0);
  assert.strictEqual(r, 'OK');
  assert.strictEqual(p.open, false);
});
check('T09 popup repeated open close no listener leak', function () {
  const start = UI.UI_LISTENERS.count;
  const fake = { addEventListener: function () {}, removeEventListener: function () {} };
  const p = new UI.Popup({ title: 'L', buttons: ['OK'] });
  for (let i = 0; i < 10; i++) { p.show(); p.attachDom(fake, 'click'); p.close(); }
  assert.strictEqual(p.listenerCount, 0);
  assert.strictEqual(UI.UI_LISTENERS.count, start);
});
check('T10 AchievementPopup queue order', function () {
  const q = new UI.AchievementQueue();
  assert.strictEqual(q.push('a1', { name: 'A1' }), true);
  assert.strictEqual(q.push('a2', { name: 'A2' }), true);
  assert.strictEqual(q.push('a1', { name: 'A1' }), false);
  assert.strictEqual(q.pending, 2);
  q.update(0.1);
  assert.strictEqual(q.current.key, 'a1');
  assert.strictEqual(q.shown, 1);
});
check('T11 AchievementPopup expiry 4s', function () {
  const a = new UI.AchievementPopup('k', { name: 'N', desc: 'D' });
  assert.strictEqual(a.active, true);
  a.update(1.0); assert.strictEqual(a.active, true);
  a.update(3.5); assert.strictEqual(a.active, false);
  const q = new UI.AchievementQueue();
  q.push('x', {}); q.push('y', {});
  for (let i = 0; i < 20; i++) q.update(0.5);
  assert.strictEqual(q.pending, 0);
});
check('T12 RealisticBook next page', function () {
  const b = new UI.RealisticBook(['p1', 'p2', 'p3'], {});
  assert.strictEqual(b.pageIndex, 0);
  assert.strictEqual(b.next(), true);
  b.update(0.5);
  assert.strictEqual(b.pageIndex, 1);
  assert.strictEqual(b.page, 'p2');
});
check('T13 RealisticBook previous page', function () {
  const b = new UI.RealisticBook(['p1', 'p2', 'p3'], {});
  b.next(); b.update(0.5);
  assert.strictEqual(b.prev(), true);
  b.update(0.5);
  assert.strictEqual(b.pageIndex, 0);
  assert.strictEqual(b.prev(), false);
});
check('T14 RealisticBook rapid input protection', function () {
  const b = new UI.RealisticBook(['p1', 'p2', 'p3'], {});
  assert.strictEqual(b.next(), true);
  assert.strictEqual(b.next(), false);
  assert.strictEqual(b.prev(), false);
  assert.strictEqual(b.click({ x: b.nextRect.x + 5, y: b.nextRect.y + 5 }), null);
  b.update(0.5);
  assert.strictEqual(b.pageIndex, 1);
  assert.strictEqual(b.click({ x: b.nextRect.x + 5, y: b.nextRect.y + 5 }), 'next');
});
check('T15 DailyRewardPopup 7-day model', function () {
  const d = new UI.DailyRewardPopup({ today: 3 });
  assert.strictEqual(d.days.length, 7);
  assert.strictEqual(d.days[2].today, true);
  assert.strictEqual(d.days[0].today, false);
  const c = d.claimToday();
  assert.ok(c); assert.strictEqual(c.day, 3);
  assert.strictEqual(d.claimToday(), null);
  assert.strictEqual(d.todayClaimed, true);
  const d2 = new UI.DailyRewardPopup({ today: 7 });
  assert.strictEqual(d2.setToday(9), 7);
  assert.strictEqual(d2.setToday(0), 1);
});
check('T16 Canvas coordinate mapping used by UI', function () {
  InputManager._singleton = null;
  const canvas = { width: 2600, height: 1600, style: {}, addEventListener: function () {},
    getBoundingClientRect: function () { return { left: 100, top: 50, width: 650, height: 400 }; } };
  const input = new InputManager(canvas);
  input.setLogicalSize(1300, 800);
  const mid = input.clientToCanvas({ clientX: 425, clientY: 250 });
  const b = new UI.Button(600, 350, 100, 100, 'GO', [80, 120, 220], {});
  assert.strictEqual(b.hitTest(mid.x, mid.y), true);
  assert.strictEqual(b.clicked(mid), true);
  const tl = input.clientToCanvas({ clientX: 100, clientY: 50 });
  assert.strictEqual(b.hitTest(tl.x, tl.y), false);
});
check('T17 no duplicate UI listeners on repeat attach', function () {
  const start = UI.UI_LISTENERS.count;
  let n = 0;
  const fake = { addEventListener: function () { n++; }, removeEventListener: function () { n--; } };
  const hs = [];
  for (let i = 0; i < 5; i++) hs.push(UI.addTracked(fake, 'click', function () {}));
  assert.strictEqual(UI.UI_LISTENERS.count, start + 5);
  hs.forEach(function (h) { UI.removeTracked(h); });
  assert.strictEqual(UI.UI_LISTENERS.count, start);
  assert.strictEqual(n, 0);
});
check('T18 no console errors in UI test env', function () {
  const b = new UI.Button(0, 0, 50, 50, 'B', [1, 2, 3], {});
  b.draw(mockR()); b.update(0.016, 10, 10);
  const p = new UI.Popup({ title: 'T' }); p.show(); p.draw(mockR()); p.close();
  const bk = new UI.RealisticBook(['a', 'b'], {}); bk.draw(mockR()); bk.update(0.016);
  const d = new UI.DailyRewardPopup({}); d.show(); d.draw(mockR()); d.close();
  const q = new UI.AchievementQueue(); q.push('z', {}); q.update(0.1);
  assert.strictEqual(errLog.length, 0);
});
console.error = _err;
if (failed) { console.error('\n' + failed + ' test(s) failed'); process.exit(1); }
console.log('\nM8-C UI: pass=' + pass + ' fail=' + failed);
process.exit(failed ? 1 : 0);

