'use strict';
/* FINAL QA — Node-side interaction contracts (Part H).
 * Complements web/tests/_final_browser.js (real Chromium) with behavioural
 * assertions that do not need a browser:
 *   - state registry completeness (main.js <-> states_real.js)
 *   - every change() target is registered (no "Unknown state" possible)
 *   - no duplicate transition + input blocked during a transition
 *   - back navigation + menu card routing for every screen
 *   - theory chain lesson -> theory (Desktop content + book pages) -> lesson
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const JS = path.join(ROOT, 'web', 'js');

require(path.join(JS, 'save.js'));
require(path.join(JS, 'player.js'));
require(path.join(JS, 'shop.js'));
require(path.join(JS, 'pet.js'));
require(path.join(JS, 'skin.js'));
require(path.join(JS, 'gacha.js'));
require(path.join(JS, 'achievements.js'));
require(path.join(JS, 'daily.js'));
require(path.join(JS, 'skill_tree.js'));
/* Minimal TransitionEffect so StateManager exercises its real transition path. */
global.TransitionEffect = class {
  constructor() { this.effect_type = 'fade'; this.active = false; this.onMidpoint = null; this._t = 0; this._mid = false; }
  start() { this.active = true; this._t = 0; this._mid = false; }
  update(dt) {
    if (!this.active) return;
    this._t += dt;
    if (!this._mid && this._t >= 0.2) { this._mid = true; if (this.onMidpoint) this.onMidpoint(); }
    if (this._t >= 0.4) this.active = false;
  }
  draw() {}
};
const sm = require(path.join(JS, 'state_manager.js'));
const st = require(path.join(JS, 'states_real.js'));

let pass = 0, fail = 0;
function check(name, fn) {
  try { const r = fn(); if (r && typeof r.then === 'function') { return r.then(function () { pass++; console.log('PASS ' + name); }, function (e) { fail++; console.log('FAIL ' + name + ' :: ' + (e && e.message)); }); } pass++; console.log('PASS ' + name); }
  catch (e) { fail++; console.log('FAIL ' + name + ' :: ' + (e && e.message)); }
}

const mainSrc = fs.readFileSync(path.join(JS, 'main.js'), 'utf8');
const REGISTERED = (mainSrc.match(/states\.register\('([A-Za-z_]+)'/g) || [])
  .map(s => s.replace(/^states\.register\('/, '').replace(/'$/, ''));
const REGISTRY = {
  loading: st.LoadingState, login: st.LoginState, menu: st.MenuState,
  lesson_select: st.LessonSelectState, theory: st.TheoryState, lesson: st.LessonState,
  victory: st.VictoryState, defeat: st.DefeatState, shop: st.ShopState,
  pet: st.PetState, skin: st.SkinState, gacha: st.GachaState,
  achievement: st.AchievementState, daily: st.DailyState, skill_tree: st.SkillTreeState,
  bag: st.BagState, profile: st.ProfileState, skill_map: st.SkillMapState,
  adminPanel: st.AdminPanelState
};

function makeGame(data) {
  const acct = {
    currentUser: 'tester', _data: data,
    data: function () { return this._data; }, save: function () {}
  };
  const manager = new sm.StateManager();
  const PlayerData = require(path.join(JS, 'player.js')).PlayerData;
  const pd = new PlayerData();
  pd.username = 'tester'; pd.grade = 1;
  pd.gold = data.gold; pd.exp = data.xp; pd.level = data.level;
  global.Game = {
    auth: acct, player: pd, states: manager, renderer: null,
    audio: { playSfx: function () { return false; } },
    assets: { get: function () { return null; } },
    engine: { WIDTH: 1300, HEIGHT: 800 }
  };
  return manager;
}
function freshData(over) {
  const d = {
    gold: 5000, xp: 5000, level: 5,
    unlocked_pets: ['clover'], unlocked_skins: ['pen_basic'],
    pet: { type: 'clover', stage: 0 }, equipped_pen: 'pen_basic', equipped_board: 'board_wood',
    skill_levels: {}, gacha_state: { pull_count: 0, total_pulls: 0 },
    inventory: [], daily_streak: 0, last_claim: '', claimed_days: {},
    achievements_unlocked: [], skill_mastery: { phep_cong: 0.9 },
    history: [], best_combo: 0, play_time_seconds: 0, difficulty: 1,
    username: 'tester', grade: 1
  };
  if (over) for (const k of Object.keys(over)) d[k] = over[k];
  return d;
}
const click = (x, y) => ({ consumeClick: () => ({ x: x, y: y }), consumeWheel: () => null, consumePressedKey: () => null });

/* T01 — registry completeness: main.js registers exactly the shipped states */
check('FQA-T01 main.js registers all 19 shipped states', function () {
  assert.strictEqual(REGISTERED.length, 19, 'registered=' + REGISTERED.length);
  for (const k of Object.keys(REGISTRY)) {
    assert.ok(REGISTERED.indexOf(k) >= 0, 'missing registration: ' + k);
  }
});
check('FQA-T02 every registered state class exists and is exported', function () {
  for (const k of Object.keys(REGISTRY)) {
    assert.strictEqual(typeof REGISTRY[k], 'function', 'state class missing: ' + k);
  }
});
check('FQA-T03 every state exposes the BaseState contract + matching name', function () {
  for (const k of Object.keys(REGISTRY)) {
    const inst = new REGISTRY[k]();
    for (const m of ['enter', 'exit', 'update', 'handleInput', 'draw']) {
      assert.strictEqual(typeof inst[m], 'function', k + '#' + m);
    }
    assert.strictEqual(inst.name, k, 'state.name "' + inst.name + '" != registry key "' + k + '"');
  }
});
check('FQA-T04 every change() target anywhere is a registered state', function () {
  const src = fs.readFileSync(path.join(JS, 'states_real.js'), 'utf8');
  const targets = (src.match(/states\.change\('([A-Za-z_]+)'/g) || [])
    .map(s => s.replace(/^states\.change\('/, '').replace(/'$/, ''));
  assert.ok(targets.length > 20, 'expected many change() targets, got ' + targets.length);
  for (const t of targets) {
    assert.ok(REGISTERED.indexOf(t) >= 0, 'change() to unregistered state: ' + t);
  }
});
check('FQA-T05 StateManager rejects an unknown state (no silent route)', function () {
  const m = makeGame(freshData());
  assert.throws(function () { m.change('nope_state'); }, /Unknown state/);
});

function settle(m) {
  for (let i = 0; i < 120; i++) {
    m.update(0.05);
    if (m._pendingName === null && (!m.transition || m.transition.active === false)) break;
  }
}

/* T06/T07 — real transition path: no double transition, input blocked while animating */
check('FQA-T06 two rapid change() calls cause exactly ONE swap', function () {
  const m = makeGame(freshData());
  let entersA = 0, entersB = 0;
  const blank = { enter: function () {}, exit: function () {}, update: function () {},
    handleInput: function () {}, draw: function () {} };
  m.register('home', Object.assign({ name: 'home' }, blank));
  m.register('a', Object.assign({ name: 'a' }, blank, { enter: function () { entersA++; } }));
  m.register('b', Object.assign({ name: 'b' }, blank, { enter: function () { entersB++; } }));
  m.change('home', null, null);
  m.change('a', null, 'fade');
  m.change('b', null, 'fade');   // overwrites the same pending slot -> only B swaps in
  settle(m);
  assert.strictEqual(entersA, 0, 'stale pending transition leaked a swap into A');
  assert.strictEqual(entersB, 1, 'enter count B=' + entersB);
  assert.strictEqual(m.currentName, 'b', 'final state is ' + m.currentName);
  assert.strictEqual(m._pendingName, null, 'pending transition left behind');
});
check('FQA-T07 input is ignored while a transition is active', function () {
  const m = makeGame(freshData());
  let handled = 0;
  const blank = { enter: function () {}, exit: function () {}, update: function () {},
    handleInput: function () { handled++; }, draw: function () {} };
  m.register('home', Object.assign({ name: 'home' }, blank));
  m.register('dummy2', Object.assign({ name: 'dummy2' }, blank));
  m.change('home', null, null);
  m.change('dummy2', null, 'fade');
  m.handleInput(click(650, 400), 0.016);          // transition active -> must be skipped
  assert.strictEqual(handled, 0, 'input leaked through an active transition');
  settle(m);
  m.handleInput(click(650, 400), 0.016);          // settled -> must be delivered
  assert.ok(handled >= 1, 'input never delivered after settle');
});

/* T08/T09 — menu card routing + locked cards (behavioural) */
const MENU_TARGET = { lesson: 'lesson_select', daily: 'daily', ach: 'achievement',
  profile: 'profile', shop: 'shop', skill: 'skill_tree', gacha: 'gacha',
  bag: 'bag', pet: 'pet', skin: 'skin' };
check('FQA-T08 every menu mode card routes to its registered screen', function () {
  for (const id of Object.keys(MENU_TARGET)) {
    const m = makeGame(freshData());
    m.register('menu', new st.MenuState());
    m.register(MENU_TARGET[id], new REGISTRY[MENU_TARGET[id]]());
    m.change('menu', null, null);
    const menu = m.current;
    const card = menu.cards.filter(c => c.id === id)[0];
    assert.ok(card, 'menu card missing: ' + id);
    menu.handleInput(click(card.x + card.w / 2, card.y + card.h / 2), 0.016);
    settle(m);
    assert.strictEqual(m.currentName, MENU_TARGET[id],
      'card "' + id + '" did not route to ' + MENU_TARGET[id] + ' (at ' + m.currentName + ')');
  }
});
/* T10/T11 — back navigation + theory chain (behavioural, real back buttons).
   The menu card clicks fire change() with a fade transition, so settle the
   manager before asserting the new state. */
const BACK_STATES = ['shop', 'pet', 'skin', 'gacha', 'daily', 'achievement',
  'skill_tree', 'bag', 'profile', 'adminPanel'];
check('FQA-T09 locked menu cards never navigate and report a lock message', function () {
  const m = makeGame(freshData());
  m.register('menu', new st.MenuState());
  m.change('menu', null, null);
  const menu = m.current;
  const locked = menu.cards.filter(c => c.locked);
  assert.ok(locked.length >= 2, 'expected locked cards');
  for (const c of locked) {
    menu.handleInput(click(c.x + c.w / 2, c.y + c.h / 2), 0.016);
    assert.strictEqual(m.currentName, 'menu', 'locked card "' + c.id + '" navigated!');
    assert.ok(menu.examMsg.length > 3, 'no lock message for ' + c.id);
  }
});
check('FQA-T10 every secondary screen returns to menu through its real back button', function () {
  for (const name of BACK_STATES) {
    const m = makeGame(freshData());
    m.register('menu', new st.MenuState());
    m.register(name, new REGISTRY[name]());
    m.change(name, null, null);
    const s = m.current;
    assert.ok(s.backBtn, name + ' has no backBtn');
    s.handleInput(click(s.backBtn.x + s.backBtn.w / 2, s.backBtn.y + s.backBtn.h / 2), 0.016);
    settle(m);
    assert.strictEqual(m.currentName, 'menu', name + ' back button did not route to menu');
  }
});
check('FQA-T11 lesson -> theory carries Desktop content, book pages and routes to lesson', function () {
  const m = makeGame(freshData({ level: 6 }));
  m.register('lesson_select', new st.LessonSelectState());
  m.register('theory', new st.TheoryState());
  m.register('lesson', new st.LessonState());
  m.change('lesson_select', { grade: 1 }, null);
  assert.strictEqual(m.current.lessons.length, 0, 'sync loader absent in Node harness');
  const pages = require(path.join(JS, 'theory_pages.js'))();
  const title = pages['1'][0].t;
  m.change('theory', { grade: 1, title: title }, null);
  const th = m.current;
  assert.strictEqual(th.content, pages['1'][0].c, 'theory content is not the Desktop page');
  assert.strictEqual(th._rbBook.pages.length, pages['1'].length,
    'book pages != grade pages');
  assert.strictEqual(typeof th._rbBook.pageApi, 'function', 'theory pageApi not wired');
  th.handleInput(click(th.startBtn.x + 5, th.startBtn.y + 5), 0.016);
  settle(m);
  assert.strictEqual(m.currentName, 'lesson', 'theory start button did not route to lesson');
  assert.strictEqual(m.current.title, title, 'lesson title lost on the theory -> lesson hop');
});
check('FQA-T12 theory book respects page bounds (no flip past the last page)', function () {
  const m = makeGame(freshData());
  m.register('theory', new st.TheoryState());
  m.change('theory', { grade: 1, title: 'B\u00e0i 1. C\u00e1c s\u1ed1 0, 1, 2, 3, 4, 5' }, null);
  const b = m.current._rbBook;
  const n = b.pages.length;
  b.goTo(n + 5);
  assert.ok(b.index < n, 'goTo escaped the page bounds');
  b.goTo(-3);
  assert.ok(b.index >= 0, 'goTo went below the first page');
  for (let i = 0; i < 120; i++) b.update(0.016);
  assert.ok(b.index >= 0 && b.index < n, 'flip landed out of bounds');
});
check('FQA-T13 theory scroll clamps to the content bounds', function () {
  const m = makeGame(freshData());
  m.register('theory', new st.TheoryState());
  m.change('theory', { grade: 1, title: 'B\u00e0i 1. C\u00e1c s\u1ed1 0, 1, 2, 3, 4, 5' }, null);
  const th = m.current;
  th.contentHeight = 99999; th.viewHeight = 480; th.scrollOffset = 1e9;
  th._clampScroll();
  assert.strictEqual(th.scrollOffset, th.maxScroll, 'did not clamp to maxScroll');
  th.scrollOffset = -999;
  th._clampScroll();
  assert.strictEqual(th.scrollOffset, 0, 'did not clamp to 0');
});

console.log('FINAL_QA: pass=' + pass + ' fail=' + fail);
if (fail > 0) { console.log('FAILED: ' + fail); process.exit(1); }

