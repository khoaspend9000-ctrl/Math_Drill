'use strict';
/* POLISH M4 — Responsive + Assets + RealisticBook content (Node behavioral).
 * T01-T02 asset hashes; T03-T10 book contract/integration/theory content;
 * T11-T12 scaling; T13-T14 bounds/scroll. Real APIs only (goTo/reset/update). */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const JS = path.join(ROOT, 'web', 'js');

require(path.join(JS, 'save.js'));
require(path.join(JS, 'player.js'));
require(path.join(JS, 'state_manager.js'));
require(path.join(JS, 'renderer.js'));
require(path.join(JS, 'engine.js'));
require(path.join(JS, 'input.js'));
require(path.join(JS, 'ui.js'));
require(path.join(JS, 'theory_pages.js'));
const sm = require(path.join(JS, 'state_manager.js'));
const st = require(path.join(JS, 'states_real.js'));

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('PASS ' + name); }
  catch (e) { fail++; console.log('FAIL ' + name + ' :: ' + (e && e.message)); }
}

function makeRenderer() {
  const calls = [];
  const rec = m => function () { calls.push({ m: m, args: Array.prototype.slice.call(arguments) }); };
  const R = {
    ctx: {
      save() {}, restore() {}, beginPath() {}, rect() {}, clip() {},
      measureText: function () { return { width: 10 }; }, font: '', fillStyle: ''
    },
    clear: rec('clear'), fillRoundRect: rec('fillRoundRect'), text: rec('text'),
    drawRoundRect: rec('drawRoundRect'), fillRect: rec('fillRect'),
    drawRect: rec('drawRect'), line: rec('line'), circle: rec('circle'),
    image: rec('image')
  };
  R._calls = calls;
  return R;
}

function makeGame() {
  const manager = new sm.StateManager();
  global.Game = {
    auth: { currentUser: 't', data: () => ({}) },
    player: null, states: manager, renderer: null,
    audio: { playSfx: () => false },
    assets: { get: () => null },
    engine: { WIDTH: 1300, HEIGHT: 800 }
  };
  const PlayerData = require(path.join(JS, 'player.js')).PlayerData;
  const pd = new PlayerData();
  pd.username = 't'; pd.grade = 1; pd.level = 20; pd.gold = 100; pd.exp = 500;
  global.Game.player = pd;
  return manager;
}

class FakeInput {
  constructor() { this.clicks = []; }
  click(x, y) { this.clicks.push({ x: x, y: y, button: 0 }); }
  consumeClick() { return this.clicks.length ? this.clicks.shift() : null; }
  consumeWheel() { return null; }
  consumePressedKey() { return null; }
  getPointerPosition() { return { x: 0, y: 0 }; }
  isDown() { return false; }
}

/* T01 — asset existence (byte-real, no fake assets) */
check('T01 required assets exist in web/assets with non-zero size', function () {
  ['nen_game.png', 'pixel_clover.png', 'favicon.png', 'defeat.png', 'gt2.gif',
   'main_character.png', 'setting.png', 'Untitled_design.png', 'victory_text.png',
   'backround1.jpg'].forEach(n => {
    const f = path.join(ROOT, 'web', 'assets', n);
    assert.ok(fs.existsSync(f), 'missing asset ' + n);
    assert.ok(fs.statSync(f).size > 0, 'empty asset ' + n);
  });
});

/* T02 — byte-identical copy: sha256(source) === sha256(web/assets) */
check('T02 web/assets are byte-identical to Desktop source (sha256)', function () {
  function sha(f) { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); }
  ['nen_game.png', 'pixel_clover.png', 'favicon.png', 'defeat.png', 'gt2.gif',
   'main_character.png', 'setting.png', 'Untitled_design.png', 'victory_text.png',
   'backround1.jpg'].forEach(n => {
    const s = path.join(ROOT, n), d = path.join(ROOT, 'web', 'assets', n);
    assert.ok(fs.existsSync(s), 'Desktop source missing: ' + n);
    assert.strictEqual(sha(d), sha(s), 'hash mismatch for ' + n);
  });
});
/* T03 — RealisticBook page state contract (single UI module, real mutators) */
check('T03 RealisticBook exposes real page-state contract (goTo/reset/update/page)', function () {
  const RB = global.UI && global.UI.RealisticBook;
  assert.strictEqual(typeof RB, 'function', 'UI.RealisticBook must exist');
  const b = new RB(['a', 'b', 'c'], { x: 50, y: 50, w: 1200, h: 700 });
  ['reset', 'update', 'goTo', 'next', 'prev', 'canNext'].forEach(m =>
    assert.strictEqual(typeof b[m], 'function', 'book#' + m));
  assert.strictEqual(b.page, 'a', 'starts on first page');
  b.goTo(2);
  assert.strictEqual(b.animating, true, 'goTo starts a flip (animating getter true)');
  for (let i = 0; i < 120; i++) b.update(0.016);
  assert.strictEqual(b.page, 'c', 'flip completes to target page');
  assert.strictEqual(b.animating, false, 'flip animation ends');
});

/* T04 — Menu book integration */
check('T04 MenuState.enter creates and resets its book', function () {
  makeGame();
  const s = new st.MenuState();
  s.enter();
  assert.ok(s._rbBook, 'MenuState._rbBook created on enter');
  assert.strictEqual(typeof s._rbBook.reset, 'function');
});

/* T05 — LessonSelect book integration */
check('T05 LessonSelectState.enter creates and resets its book', function () {
  makeGame();
  const s = new st.LessonSelectState();
  s.enter({ grade: 1 });
  assert.ok(s._rbBook, 'LessonSelectState._rbBook created on enter');
});

/* T06 — Theory book integration with REAL Desktop content */
check('T06 TheoryState loads Desktop theory content and builds its book', function () {
  makeGame();
  const pages = require(path.join(JS, 'theory_pages.js'))();
  const total = Object.keys(pages).reduce((a, g) => a + pages[g].length, 0);
  assert.ok(total > 300, 'theory_pages must carry Desktop content, got ' + total);
  const s = new st.TheoryState();
  s.enter({ grade: 1, title: pages['1'][0].t });
  assert.ok(s._rbBook, 'TheoryState._rbBook created on enter');
  assert.strictEqual(s.content, pages['1'][0].c, 'theory content must come from Desktop data');
  assert.strictEqual(s.bookX, 50); assert.strictEqual(s.bookW, 1200);
  assert.strictEqual(s.bookH, 700);
});
/* T07 — Theory character integration (exact Desktop asset, preloaded) */
check('T07 Theory character uses main_character asset (preloaded, in-bounds)', function () {
  makeGame();
  const s = new st.TheoryState();
  s.enter({ grade: 1, title: 'B\u00e0i 1' });
  assert.ok(s.characterRect.x + s.characterRect.w <= 1300, 'character panel within canvas');
  assert.ok(s.characterRect.y + s.characterRect.h <= 800, 'character panel within canvas');
  const src = fs.readFileSync(path.join(JS, 'states_real.js'), 'utf8');
  assert.ok(src.includes("name: 'main_character', url: 'assets/main_character.png'"),
    'LoadingState must preload main_character (Desktop parity game_init.py:292)');
  const g = global.Game;
  g.assets = { get: n => (n === 'main_character' ? { width: 600, height: 600 } : null) };
  g.renderer = makeRenderer();
  s.draw(g.renderer.ctx, 1300, 800);
  const img = g.renderer._calls.filter(c => c.m === 'image');
  assert.ok(img.length >= 1, 'character image drawn in Theory');
  assert.deepStrictEqual(img[0].args.slice(0, 5), [{ width: 600, height: 600 }, 860, 80, 200, 200],
    'character drawn at Desktop panel position');
});

/* T08 — reset page identity (real contract: goTo flips away, reset restores) */
check('T08 book.reset restores page identity after goTo moved away', function () {
  const RB = global.UI.RealisticBook;
  const b = new RB(['a', 'b', 'c'], { x: 50, y: 50, w: 1200, h: 700 });
  b.reset();
  assert.strictEqual(b.page, 'a', 'fresh reset lands on first page');
  b.goTo(1);
  for (let i = 0; i < 120; i++) b.update(0.016);
  assert.strictEqual(b.page, 'b', 'flip moved the page away');
  b.reset();
  assert.strictEqual(b.page, 'a', 'reset() restores page identity');
  makeGame();
  const s = new st.TheoryState();
  s.enter({ grade: 1, title: 'B\u00e0i 1' });
  s._rbBook.goTo(1);
  for (let i = 0; i < 120; i++) s._rbBook.update(0.016);
  const oldBook = s._rbBook;
  s.enter({ grade: 1, title: 'B\u00e0i 1' });
  assert.ok(s._rbBook !== oldBook, 're-enter builds a fresh book (page identity restored by construction)');
  assert.notStrictEqual(s._rbBook.page, 'b', 'fresh book is not on the flipped page');
});

/* T09 — flip guard: input ignored while the book is animating (real flip) */
check('T09 TheoryState ignores clicks during a real book flip, allows after finish', function () {
  makeGame();
  const mgr = new sm.StateManager();
  global.Game.states = mgr;
  mgr.register('theory', new st.TheoryState());
  mgr.register('lesson', new st.LessonState());
  mgr.change('theory', { grade: 1, title: 'B\u00e0i 1' });
  const s = mgr.current;
  const RB = global.UI.RealisticBook;
  s._rbBook = new RB(['p1', 'p2', 'p3'], { x: 50, y: 50, w: 1200, h: 700 });
  s._rbBook.goTo(1);
  assert.strictEqual(s._rbBook.animating, true, 'flip in progress');
  const input = new FakeInput();
  input.click(s.startBtn.x + 10, s.startBtn.y + 10);
  s.handleInput(input, 0.016);
  assert.strictEqual(mgr.currentName, 'theory', 'click during flip must be blocked');
  for (let i = 0; i < 120; i++) s._rbBook.update(0.016);
  assert.strictEqual(s._rbBook.animating, false, 'flip finished');
  const input2 = new FakeInput();
  input2.click(s.startBtn.x + 10, s.startBtn.y + 10);
  s.handleInput(input2, 0.016);
  for (let i = 0; i < 40; i++) mgr.update(0.033);
  assert.strictEqual(mgr.currentName, 'lesson', 'click after flip navigates to lesson');
});
/* T10 — 1300x800 bounds: every draw rect of core states inside canvas */
function assertAllRectsInBounds(state, name) {
  const g = global.Game;
  g.renderer = makeRenderer();
  state.draw(g.renderer.ctx, 1300, 800);
  g.renderer._calls.forEach(c => {
    if (c.m !== 'fillRoundRect' && c.m !== 'fillRect' && c.m !== 'drawRoundRect') return;
    const a = c.args;
    assert.ok(a[0] >= -1 && a[1] >= -1, name + ' rect x/y >= 0 (' + a[0] + ',' + a[1] + ')');
    assert.ok(a[0] + a[2] <= 1301 && a[1] + a[3] <= 801,
      name + ' rect within 1300x800 (x=' + a[0] + ' y=' + a[1] + ' w=' + a[2] + ' h=' + a[3] + ')');
  });
}
check('T10 all core states draw within 1300x800 at logical resolution', function () {
  makeGame();
  assertAllRectsInBounds(new st.MenuState(), 'MenuState');
  assertAllRectsInBounds(new st.LessonSelectState(), 'LessonSelectState');
  const th = new st.TheoryState();
  th.enter({ grade: 1, title: 'B\u00e0i 1' });
  assertAllRectsInBounds(th, 'TheoryState');
});
/* T11/T12 — clientToCanvas scaling safety (real InputManager math).
 * Logical canvas stays 1300x800; browser CSS scales the canvas keeping the
 * 13:8 aspect: 720p window -> 1170x720 rect, 1080p window -> 1755x1080. */
function scalingCheck(wpx, hpx, label) {
  const mod = require(path.join(JS, 'input.js'));
  const IM = mod.InputManager || mod.default || global.InputManager;
  IM._singleton = null; // test isolation: singleton would reuse the first canvas
  const canvas = {
    width: 1300, height: 800, style: {},
    getBoundingClientRect() { return { left: 0, top: 0, width: wpx, height: hpx }; },
    addEventListener() {}, removeEventListener() {}
  };
  const im = new IM(canvas);
  [[0, 0, 0, 0], [wpx, hpx, 1300, 800], [wpx / 2, hpx / 2, 650, 400]].forEach(t => {
    const r = im.clientToCanvas({ clientX: t[0], clientY: t[1] });
    assert.ok(Math.abs(r.x - t[2]) < 0.6, label + ' X mapping (' + r.x + ' vs ' + t[2] + ')');
    assert.ok(Math.abs(r.y - t[3]) < 0.6, label + ' Y mapping (' + r.y + ' vs ' + t[3] + ')');
  });
  const out = im.clientToCanvas({ clientX: -50, clientY: -50 });
  assert.ok(out.x === 0 && out.y === 0, label + ' clamps negative coords');
  const out2 = im.clientToCanvas({ clientX: wpx + 99, clientY: hpx + 99 });
  assert.ok(out2.x <= 1300 && out2.y <= 800, label + ' clamps overflow coords');
  IM._singleton = null;
}
check('T11 720p (1170x720 rect) scaling safety: corners map + clamp', function () {
  scalingCheck(1170, 720, '720p');
});
check('T12 1080p (1755x1080 rect) scaling safety: corners map + clamp', function () {
  scalingCheck(1755, 1080, '1080p');
});

/* T13 — Theory buttons in-bounds, right of the content column */
check('T13 Theory buttons in-bounds and outside the content column', function () {
  makeGame();
  const s = new st.TheoryState();
  s.enter({ grade: 1, title: 'B\u00e0i 1' });
  [s.startBtn, s.openBookBtn, s.backBtn].forEach(b => {
    assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= 1300 && b.y + b.h <= 800, 'button in canvas');
    assert.ok(b.x >= s.contentRect.x + s.contentRect.w, 'button right of content column (no overlap)');
  });
  assert.ok(s.backBtn.y > s.startBtn.y && s.startBtn.y > s.characterRect.y + 20, 'button stacking sane');
});

/* T14 — scroll clamp + scrollbar thumb inside track */
check('T14 theory scroll clamps and scrollbar thumb stays in track', function () {
  makeGame();
  const s = new st.TheoryState();
  s.enter({ grade: 1, title: 'B\u00e0i 1' });
  s.contentHeight = 5000; s.viewHeight = 480; s.scrollOffset = 99999;
  s._clampScroll();
  assert.strictEqual(s.scrollOffset, s.maxScroll, 'clamps to maxScroll');
  s.scrollOffset = -500;
  s._clampScroll();
  assert.strictEqual(s.scrollOffset, 0, 'clamps to 0');
  const h = Math.max(24, 480 * 480 / s.contentHeight);
  const ty = 180 + (480 - h) * s.scrollOffset / Math.max(1, s.maxScroll);
  assert.ok(ty >= 180 && ty + h <= 660, 'scrollbar thumb within track');
});

console.log('POLISH M4: pass=' + pass + ' fail=' + fail);
if (fail > 0) { console.log('FAILED: ' + fail); process.exit(1); }




