'use strict';
/* UI_PARITY_P1.test.js â€” P1 UI parity remediation regression (structural + runtime).
 *
 * P1 remediation scope:
 *   P1-1  RealisticBook integration on Menu + LessonSelect.
 *         Desktop parity: main.py:416/745 (MenuState) and main.py:922/971
 *         (LessonSelectState) both draw RealisticBook(50,50,1200,700) with
 *         draw_left / draw_right page callbacks.
 *   P1-2  Loading background (main.py:162 â†’ fill (20,30,55) + nen_game overlay).
 *
 * This suite was referenced by the milestone task list but missing on disk, so it
 * is added here. It verifies EXISTING production code (web/js/ui.js,
 * web/js/states_real.js, web/index.html) â€” no production contract is invented.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const JS = path.join(ROOT, 'web', 'js');

const STATES_PATH = path.join(JS, 'states_real.js');
const STATES_SRC = fs.readFileSync(STATES_PATH, 'utf8');
const UI_SRC = fs.readFileSync(path.join(JS, 'ui.js'), 'utf8');
const INDEX = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');

let pass = 0, fail = 0;
const failures = [];
function check(name, fn) {
  try { fn(); pass++; console.log('PASS ' + name); }
  catch (e) { fail++; failures.push(name); console.log('FAIL ' + name + ' :: ' + (e && e.message)); }
}

/* ---------- harness: same module set main.js loads before states_real.js ---------- */
require(path.join(JS, 'save.js'));
require(path.join(JS, 'player.js'));
require(path.join(JS, 'state_manager.js'));
require(path.join(JS, 'shop.js'));
require(path.join(JS, 'pet.js'));
require(path.join(JS, 'skin.js'));
require(path.join(JS, 'gacha.js'));
require(path.join(JS, 'achievements.js'));
require(path.join(JS, 'daily.js'));
require(path.join(JS, 'skill_tree.js'));

const UI = require(path.join(JS, 'ui.js')); // publishes globalThis.UI (browser contract)

function makeRenderer() {
  const calls = [];
  const rec = function (m) { return function () { calls.push({ m: m, args: Array.from(arguments) }); }; };
  const R = {
    ctx: {},
    clear: rec('clear'), fillRoundRect: rec('fillRoundRect'),
    text: rec('text'), drawRoundRect: rec('drawRoundRect'),
    fillRect: rec('fillRect'), drawRect: rec('drawRect'),
    image: rec('image'), line: rec('line'), circle: rec('circle')
  };
  R._calls = calls;
  R.texts = function () { return calls.filter(c => c.m === 'text').map(c => String(c.args[0])); };
  return R;
}

function freshData() {
  return {
    gold: 5000, xp: 5000, level: 5, grade: 1,
    unlocked_pets: ['clover', 'star'], unlocked_skins: ['pen_basic'],
    pet: { type: 'clover', stage: 0, name: 'Co Non' },
    equipped_pen: 'pen_basic', equipped_board: 'board_wood',
    skill_levels: {}, inventory: [], daily_streak: 0, last_claim: '', claimed_days: {},
    achievements_unlocked: [], skill_mastery: {}, history: [], best_combo: 0,
    play_time_seconds: 0, difficulty: 1, username: 'tester', gacha_state: {}
  };
}

function makeGame(data) {
  const acct = {
    currentUser: 'tester', _data: data,
    data: function () { return this._data; },
    saveCount: 0, save: function () { this.saveCount++; }
  };
  const Sm = require(path.join(JS, 'state_manager.js'));
  const manager = new Sm.StateManager();
  global.Game = {
    auth: acct, player: null, states: manager, renderer: makeRenderer(),
    audio: { playSfx: function () { return false; } },
    assets: { get: function () { return null; } },
    dataLoader: { loadLesson: function () { return null; } },
    engine: { WIDTH: 1300, HEIGHT: 800 }
  };
  const PlayerData = require(path.join(JS, 'player.js')).PlayerData;
  const pd = new PlayerData();
  pd.username = 'tester'; pd.grade = 1;
  pd.gold = data.gold || 0; pd.exp = data.xp || 0; pd.level = data.level || 1;
  global.Game.player = pd;
  return manager;
}

function freshStates() {
  delete require.cache[require.resolve(STATES_PATH)];
  return require(STATES_PATH);
}
check('T01 ui.js exposes RealisticBook on global.UI (not a bare global)', function () {
  assert.ok(UI && typeof UI === 'object', 'ui.js exports UI');
  assert.strictEqual(typeof UI.RealisticBook, 'function', 'UI.RealisticBook is a class');
  assert.strictEqual(globalThis.UI, UI, 'globalThis.UI published for browser <script> usage');
  assert.strictEqual(typeof globalThis.RealisticBook, 'undefined',
    'RealisticBook must not be a bare global (IIFE-scoped) â€” resolution must go through UI');
  const b = new UI.RealisticBook(['a', 'b', 'c'], {});
  ['reset', 'draw', 'update', 'next', 'prev', 'goTo', 'click'].forEach(function (m) {
    assert.strictEqual(typeof b[m], 'function', 'RealisticBook.' + m + ' exists');
  });
  assert.strictEqual(b.reset(), 0, 'reset() opens on the first page');
  b.index = 2;
  assert.strictEqual(b.reset(), 0, 'reset() after browsing returns to page 0');
});

check('T02 integration resolves RealisticBook from global.UI before require fallback', function () {
  assert.ok(STATES_SRC.indexOf('REALISTICBOOK_P1_INTEGRATION') >= 0, 'integration block present');
  const uiIdx = STATES_SRC.indexOf('ROOT.UI && ROOT.UI.RealisticBook');
  const reqIdx = STATES_SRC.indexOf("require('./ui.js').RealisticBook");
  assert.ok(uiIdx >= 0, 'browser path ROOT.UI.RealisticBook present');
  assert.ok(reqIdx >= 0, 'CommonJS fallback present');
  assert.ok(uiIdx < reqIdx, 'global.UI path must be checked BEFORE the require fallback');
  assert.ok(STATES_SRC.indexOf('if (!RB) return;') >= 0, 'guard when the class is unavailable');
});

check('T03 index.html loads ui.js before states_real.js (integration contract)', function () {
  const uiI = INDEX.indexOf('js/ui.js');
  const stI = INDEX.indexOf('js/states_real.js');
  assert.ok(uiI >= 0 && stI >= 0, 'both scripts referenced');
  assert.ok(uiI < stI, 'ui.js must load first so global.UI already exists');
});
/* P1-1 runtime: Menu/LessonSelect get a book built from the UI class */
class SpyBook {
  constructor() { this.pages = []; this.resetCount = 0; this.drawArgs = []; this.updateCount = 0; }
  reset() { this.resetCount++; return 0; }
  draw(R) { this.drawArgs.push(R); }
  update(dt) { this.updateCount++; return false; }
}

/* The integration captures the book class at module-eval time, so installing the
   spy on global.UI (the browser resolution path) must happen BEFORE re-requiring
   states_real.js. */
function withSpyBook(fn) {
  const real = UI.RealisticBook;
  UI.RealisticBook = SpyBook;
  try { return fn(freshStates()); } finally { UI.RealisticBook = real; }
}

check('T04 MenuState.enter builds _rbBook from UI.RealisticBook + resets page', function () {
  withSpyBook(function (st) {
    const manager = makeGame(freshData());
    const s = new st.MenuState();
    manager.register('menu', s);
    manager.change('menu');
    s.enter();
    assert.ok(s._rbBook, '_rbBook created on MenuState.enter');
    assert.ok(s._rbBook instanceof SpyBook,
      '_rbBook must come from the UI.RealisticBook class (browser resolution path)');
    assert.ok(s._rbBook.resetCount >= 1, 'reset() called on enter (page identity restored)');
    // LessonSelect parity (main.py:922)
    const ls = new st.LessonSelectState();
    ls.enter({ grade: 1 });
    assert.ok(ls._rbBook instanceof SpyBook, 'LessonSelectState also gets _rbBook');
    assert.ok(ls._rbBook.resetCount >= 1, 'LessonSelectState resets the book too');
  });
});

check('T05 _bookDrawBase forwards the Renderer (not the raw 2D ctx) to book.draw', function () {
  withSpyBook(function (st) {
    makeGame(freshData());
    const s = new st.MenuState();
    s.enter();
    const book = s._rbBook;
    assert.ok(book instanceof SpyBook, 'spy book installed');
    book.pages = ['page-1'];                 // a real Desktop book has pages
    const rawCtx = { save: function () {}, restore: function () {} };
    s.draw(rawCtx, 1300, 800);
    assert.strictEqual(book.drawArgs.length, 1, 'book.draw called exactly once');
    assert.strictEqual(book.drawArgs[0], global.Game.renderer,
      'book.draw must receive global.Game.renderer (has fillRoundRect), not ctx');
    assert.notStrictEqual(book.drawArgs[0], rawCtx, 'raw ctx must not be forwarded');
    assert.strictEqual(typeof book.drawArgs[0].fillRoundRect, 'function', 'renderer api available');
  });
});

check('T06 book chrome paints whenever a renderer+clear is available (Desktop parity: no pages-gate)', function () {
  withSpyBook(function (st) {
    makeGame(freshData());
    const s = new st.MenuState();
    s.enter();
    const book = s._rbBook;
    // A fresh book carries no page labels yet (content is port-pending for M7/M8),
    // but Desktop RealisticBook.draw ALWAYS paints cover+spine+page chrome — the
    // integration must reproduce that, NOT gate on pages.length === 0.
    assert.strictEqual(book.pages.length, 0, 'no page labels assigned (M7/M8 port pending)');
    book.drawArgs.length = 0;
    s.draw({ save: function () {}, restore: function () {} }, 1300, 800);
    assert.ok(book.drawArgs.length >= 1, 'chrome painted unconditionally after clear (Desktop parity)');
    assert.strictEqual(book.drawArgs[0], global.Game.renderer, 'rendered with the global renderer');
  });
});
check('T07 LessonSelectState.update forwards dt to the book (flip parity)', function () {
  withSpyBook(function (st) {
    makeGame(freshData());
    const ls = new st.LessonSelectState();
    ls.enter({ grade: 1 });
    const before = ls._rbBook.updateCount;
    ls.update(0.033);
    ls.update(0.033);
    assert.strictEqual(ls._rbBook.updateCount, before + 2, 'book.update called per state update');
  });
});

check('T08 integration is exception-safe (a broken book cannot break draw)', function () {
  withSpyBook(function (st) {
    makeGame(freshData());
    const s = new st.MenuState();
    s.enter();
    const R = global.Game.renderer;
    s._rbBook = { pages: ['p'], draw: function () { throw new Error('boom'); } };
    assert.doesNotThrow(function () { s.draw({ save: function () {}, restore: function () {} }, 1300, 800); });
    s._rbBook = { pages: ['p'] };                      // no draw method at all
    assert.doesNotThrow(function () { s.draw({ save: function () {}, restore: function () {} }, 1300, 800); });
    s._rbBook = null;
    assert.doesNotThrow(function () { s.draw({ save: function () {}, restore: function () {} }, 1300, 800); });
    // guard against missing renderer (stateless — confirmed in source)
    assert.ok(STATES_SRC.indexOf('!R || typeof R.clear') >= 0, 'missing-renderer guard present in _bookDrawBase');
    assert.ok(R && typeof R.clear === 'function', 'renderer intact after the test');
  });
});

check('T09 integration no-ops safely when the UI class is unavailable', function () {
  assert.ok(STATES_SRC.indexOf('if (!RB) return;') >= 0, 'early-return guard present');
  const sandbox = { console: console };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(UI_SRC, sandbox, { filename: 'ui.js' });
  assert.strictEqual(typeof sandbox.UI.RealisticBook, 'function', 'sandbox: UI.RealisticBook reachable');
  assert.strictEqual(typeof sandbox.RealisticBook, 'undefined',
    'sandbox: bare global absent â€” proves the UI resolution path is required');
  assert.ok(UI_SRC.indexOf('global.UI = UI;') >= 0, 'ui.js publishes only global.UI');
});
/* =========================================================
   P1-2  Loading background (main.py:162)
   ========================================================= */

function makeLoadingGame(st) {
  const preloadCalls = [];
  const sfxCalls = [];
  let fontCalls = 0;
  global.Game = {
    renderer: makeRenderer(),
    states: { change: function () {} },
    assets: {
      get: function (n) { return n === 'nen_game' ? { placeholder: false } : null; },
      loadFonts: function () { fontCalls++; return Promise.resolve({}); },
      preload: function (list) {
        preloadCalls.push(list);
        return Promise.resolve({ total: list.length, loaded: list.length, failed: 0 });
      }
    },
    audio: { loadSfx: function (a, b) { sfxCalls.push([a, b]); return Promise.resolve('ok'); } }
  };
  const s = new st.LoadingState();
  s._preloadCalls = preloadCalls;
  s._sfxCalls = sfxCalls;
  s._fontCalls = function () { return fontCalls; };
  return s;
}

check('T10 LoadingState draws dark-navy clear + nen_game overlay at alpha 0.35', function () {
  const st = freshStates();
  const s = makeLoadingGame(st);
  const ctx = { save: function () { ctx.saved = true; }, restore: function () { ctx.restored = true; }, globalAlpha: 1 };
  s.draw(ctx, 1300, 800);
  const R = global.Game.renderer;
  const clear = R._calls.find(c => c.m === 'clear');
  assert.ok(clear, 'clear called');
  assert.strictEqual(clear.args[0], '#141e37', 'Python s.fill((20,30,55)) parity');
  const img = R._calls.find(c => c.m === 'image');
  assert.ok(img, 'nen_game overlay drawn when the asset is available');
  assert.strictEqual(img.args[3], 1300, 'overlay covers full width');
  assert.strictEqual(img.args[4], 800, 'overlay covers full height');
  assert.strictEqual(ctx.globalAlpha, 0.35, 'overlay alpha 0.35');
  assert.ok(ctx.saved && ctx.restored, 'save/restore balanced around the overlay');
});

check('T11 LoadingState renders title, percent text, progress bar and tip', function () {
  const st = freshStates();
  const s = makeLoadingGame(st);
  s.elapsed = s.minTime; s.ready = true;
  s.draw({ save: function () {}, restore: function () {}, globalAlpha: 1 }, 1300, 800);
  const texts = global.Game.renderer.texts().join(' | ');
  assert.ok(texts.indexOf('MATHDRILL') >= 0, 'title drawn');
  assert.ok(texts.indexOf('\u0110ang t\u1ea3i... 100%') >= 0, 'percent text is 100% when ready');
  assert.ok(texts.indexOf('M\u1eb9o:') >= 0, 'tip line drawn');
  const bars = global.Game.renderer._calls.filter(c => c.m === 'fillRoundRect');
  assert.ok(bars.length >= 3, 'track + fill + outline drawn');
});

check('T12 LoadingState preloads 6 assets (incl. main_character) + fonts + sfx', function () {
  const st = freshStates();
  const s = makeLoadingGame(st);
  s.enter();
  assert.strictEqual(s._preloadCalls.length, 1, 'assets.preload called once');
  const list = s._preloadCalls[0];
  // M4: theory character + victory/defeat art added (Desktop parity game_init.py:292).
  const REQUIRED = ['nen_game', 'pixel_clover', 'favicon', 'main_character', 'victory_text', 'defeat'];
  const names = list.map(i => i.name);
  REQUIRED.forEach(function (n) { assert.ok(names.includes(n), 'preload list must contain ' + n); });
  assert.strictEqual(names.length, REQUIRED.length, 'no unexpected extra assets');
  list.forEach(function (i) { assert.ok(/^assets\//.test(i.url), 'relative assets/ url for ' + i.name); });
  assert.strictEqual(s._fontCalls(), 1, 'assets.loadFonts called once');
  assert.deepStrictEqual(s._sfxCalls[0], ['correct', 'tra_loi_dung.ogg'], 'sfx preload parity');
  assert.strictEqual(s.ready, false, 'not ready until preload resolves');
  assert.ok(s.tips.length >= 1 && typeof s.tip === 'string', 'tip pool + active tip');
});

console.log('UI_PARITY_P1: pass=' + pass + ' fail=' + fail);
if (fail > 0) { console.log('FAILED: ' + failures.join(', ')); process.exit(1); }