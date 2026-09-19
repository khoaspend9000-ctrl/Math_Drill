'use strict';
/* M10-B — REAL M9 STATE + MENU INTEGRATION (Node deterministic).
 * Verifies states_real.js exposes 8 M9 states (Shop/Pet/Skin/Gacha/
 * Achievement/Daily/SkillTree/Bag), Menu cards route to them, each
 * state wires the real M9 module API against the account data dict,
 * persists through it, and returns to Menu without crash/double-reward.
 * Browser smoke (real canvas/DOM) is M10-B+ with browser tooling.
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
const sm = require(path.join(JS, 'state_manager.js'));
const st = require(path.join(JS, 'states_real.js'));

const pets = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'pets.json'), 'utf8'));
const skins = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'skins.json'), 'utf8'));
const skills = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'skills.json'), 'utf8'));

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('PASS ' + name); }
  catch (e) { fail++; console.log('FAIL ' + name + ' :: ' + (e && e.message)); }
}

function makeGame(data) {
  const acct = {
    currentUser: 'tester',
    _data: data,
    data: function () { return this._data; },
    saveCount: 0,
    save: function () { this.saveCount++; }
  };
  const manager = new sm.StateManager();
  global.Game = {
    auth: acct,
    player: null,
    states: manager,
    renderer: null,
    audio: { playSfx: function () { return false; } },
    assets: { get: function () { return null; } },
    engine: { WIDTH: 1300, HEIGHT: 800 }
  };
  const PlayerData = require(path.join(JS, 'player.js')).PlayerData;
  const pd = new PlayerData();
  pd.username = 'tester'; pd.grade = 1;
  pd.gold = data.gold !== undefined ? data.gold : 0;
  pd.exp = data.xp !== undefined ? data.xp : 0;
  pd.level = data.level !== undefined ? data.level : 1;
  global.Game.player = pd;
  return manager;
}

function registerAll(manager) {
  manager.register('menu', new st.MenuState());
  manager.register('shop', new st.ShopState());
  manager.register('pet', new st.PetState());
  manager.register('skin', new st.SkinState());
  manager.register('gacha', new st.GachaState());
  manager.register('achievement', new st.AchievementState());
  manager.register('daily', new st.DailyState());
  manager.register('skill_tree', new st.SkillTreeState());
  manager.register('bag', new st.BagState());
}

class FakeInput {
  constructor() { this.clicks = []; }
  click(x, y) { this.clicks.push({ x: x, y: y, button: 0, time: Date.now() }); }
  consumeClick() { return this.clicks.length ? this.clicks.shift() : null; }
  consumePressedKey() { return null; }
  getPointerPosition() { return { x: 0, y: 0 }; }
  isDown() { return false; }
}

function freshData(over) {
  const d = {
    gold: 5000, xp: 5000, level: 5,
    unlocked_pets: ['clover'], unlocked_skins: ['pen_basic', 'board_wood'],
    pet: { type: 'clover', stage: 0, name: 'Co Non' },
    equipped_pen: 'pen_basic', equipped_board: 'board_wood',
    skill_levels: {}, gacha_state: { pull_count: 0, total_pulls: 0, rare_pity: 0 },
    inventory: [], bag: {},
    daily_streak: 0, last_claim: '', claimed_days: {},
    achievements_unlocked: []
  };
  if (over) Object.assign(d, over);
  return d;
}
function clickCard(managerObj, cardId) {
    // NOTE: called inline, uses managerObj.current (NOT legacy states global)

    const menu = managerObj.current;
  const c = menu.cards.find(x => x.id === cardId);
  assert.ok(c, 'menu card ' + cardId + ' exists');
  return { x: c.x + c.w / 2, y: c.y + c.h / 2 };
}

check('T01 8 M9 states exported + extend BaseState + method surface', function () {
  for (const name of ['ShopState', 'PetState', 'SkinState', 'GachaState',
    'AchievementState', 'DailyState', 'SkillTreeState', 'BagState']) {
    const C = st[name];
    assert.strictEqual(typeof C, 'function', name + ' is a class');
    assert.ok(C.prototype instanceof sm.BaseState, name + ' extends BaseState');
    for (const m of ['enter', 'exit', 'handleInput', 'update', 'draw']) {
      assert.strictEqual(typeof C.prototype[m], 'function', name + '#' + m);
    }
  }
});

check('T02 Menu cards route shop/skill/gacha/daily/ach/bag/pet/skin to M9 states', function () {
  const manager = makeGame(freshData());
  registerAll(manager);
  manager.change('menu');
  const input = new FakeInput();
  const routes = [['shop', 'shop'], ['skill', 'skill_tree'], ['gacha', 'gacha'],
    ['daily', 'daily'], ['ach', 'achievement'], ['bag', 'bag'], ['pet', 'pet'], ['skin', 'skin']];
  for (const [cardId, stateName] of routes) {
    manager.change('menu');
    manager.current.enter(null);
        const c = clickCard(manager, cardId);
    input.click(c.x, c.y);
    manager.current.handleInput(input, 0.016);
    for (let i = 0; i < 40 && manager.currentName === 'menu'; i++) manager.update(0.033);
    assert.strictEqual(manager.currentName, stateName, cardId + ' -> ' + stateName);
  }
});

check('T03 Shop purchase deducts gold + ownership, duplicate blocked', function () {
  const d = freshData();
  makeGame(d);
  const s = new st.ShopState();
  s.enter({ petTypes: pets, skinTypes: skins });
  assert.strictEqual(s.dataMissing, false, 'shop ready');
  const price = s.shop.getPetPrice('star');
  const r1 = s._actItem({ category: 'pet', key: 'star', name: 'Star' });
  assert.strictEqual(r1.ok, true, 'purchase ok');
  assert.strictEqual(d.gold, 5000 - price, 'exact gold deduction');
  assert.ok(d.unlocked_pets.indexOf('star') >= 0, 'ownership added');
  const r2 = s._actItem({ category: 'pet', key: 'star', name: 'Star' });
  assert.strictEqual(r2.ok, false, 'duplicate blocked');
  assert.strictEqual(d.gold, 5000 - price, 'gold unchanged on dup');
  assert.strictEqual(d.pet.type, 'star', 'pet selected');
});

check('T04 PetState click persists pet selection to account data', function () {
  const d = freshData({ unlocked_pets: ['clover', 'star'] });
  makeGame(d);
  const s = new st.PetState();
  s.enter({ petTypes: pets, skinTypes: skins });
  assert.strictEqual(s.dataMissing, false, 'pet ready');
  const item = s.itemButtons.find(x => x.item.key === 'star');
  assert.ok(item, 'star pet listed');
  const input = new FakeInput();
  input.click(item.x + item.w / 2, item.y + item.h / 2);
  s.handleInput(input, 0.016);
  assert.strictEqual(d.pet.type, 'star', 'pet type changed');
});

check('T05 SkinState equip persists to equipped_pen', function () {
  const d = freshData({ unlocked_skins: ['pen_basic', 'pen_magic'] });
  makeGame(d);
  const s = new st.SkinState();
  s.enter({ petTypes: pets, skinTypes: skins, filter: 'pen' });
  assert.strictEqual(s.dataMissing, false, 'skin ready');
  const item = s.itemButtons.find(x => x.item.key === 'pen_magic');
  assert.ok(item, 'pen_magic listed');
  const input = new FakeInput();
  input.click(item.x + item.w / 2, item.y + item.h / 2);
  s.handleInput(input, 0.016);
  assert.strictEqual(d.equipped_pen, 'pen_magic');
});
