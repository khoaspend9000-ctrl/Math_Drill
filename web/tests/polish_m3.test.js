'use strict';
/* POLISH M3 — Secondary Systems (Node structural).
 * Shop/Pet/Skin item cards w/ icon+desc+state, Gacha result panel rarity+NEW,
 * Daily 7-day grid, Achievement cards w/ desc+XP, SkillTree overflow fix,
 * ProfileState + SkillMapState (main.py:2100-2290 port), Menu profile routing. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const JS = path.join(ROOT, 'web', 'js');

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
const sm = require(path.join(JS, 'state_manager.js'));
const st = require(path.join(JS, 'states_real.js'));

const pets = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'pets.json'), 'utf8'));
const skins = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'skins.json'), 'utf8'));
const achDefs = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'achievements.json'), 'utf8'));
const dailyCfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'daily_rewards.json'), 'utf8'));
const skills = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'skills.json'), 'utf8'));

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('PASS ' + name); }
  catch (e) { fail++; console.log('FAIL ' + name + ' :: ' + (e && e.message)); }
}

function makeGame(data) {
  const acct = {
    currentUser: 'tester', _data: data,
    data: function () { return this._data; },
    saveCount: 0, save: function () { this.saveCount++; }
  };
  const manager = new sm.StateManager();
  global.Game = {
    auth: acct, player: null, states: manager, renderer: null,
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

function freshData(over) {
  const d = {
    gold: 5000, xp: 5000, level: 5,
    unlocked_pets: ['clover', 'star'], unlocked_skins: ['pen_basic', 'pen_magic', 'board_wood'],
    pet: { type: 'clover', stage: 0, name: 'Co Non' },
    equipped_pen: 'pen_basic', equipped_board: 'board_wood',
    skill_levels: {}, gacha_state: { pull_count: 0, total_pulls: 0, guaranteed_legendary: false, rare_pity: 0 },
    inventory: [], daily_streak: 0, last_claim: '', claimed_days: {},
    achievements_unlocked: ['first_win'], skill_mastery: { phep_cong: 0.9, phep_tru: 0.2 },
    history: [{ score: 80 }, { score: 40 }], best_combo: 4, play_time_seconds: 3675,
    difficulty: 1, username: 'tester', grade: 1
  };
  if (over) for (const k of Object.keys(over)) d[k] = over[k];
  return d;
}

class FakeInput {
  constructor() { this.clicks = []; }
  click(x, y) { this.clicks.push({ x: x, y: y, button: 0, time: Date.now() }); }
  consumeClick() { return this.clicks.length ? this.clicks.shift() : null; }
  consumePressedKey() { return null; }
  getPointerPosition() { return { x: 0, y: 0 }; }
  isDown() { return false; }
}

function makeRenderer() {
  const calls = [];
  const rec = function (m) { return function () { calls.push({ m: m, args: Array.from(arguments) }); }; };
  const R = {
    ctx: {},
    clear: rec('clear'), fillRoundRect: rec('fillRoundRect'),
    text: rec('text'), drawRoundRect: rec('drawRoundRect'),
    fillRect: rec('fillRect'), drawRect: rec('drawRect'),
    line: rec('line'), circle: rec('circle')
  };
  R._calls = calls;
  R.texts = function () { return calls.filter(c => c.m === 'text').map(c => String(c.args[0])); };
  return R;
}

/* T01 Shop item cards */
check('T01 Shop card draws icon, name, desc, owned/equipped state + gold border', function () {
  const d = freshData();
  makeGame(d);
  const s = new st.ShopState();
  s.enter({ petTypes: pets, skinTypes: skins });
  assert.strictEqual(s.dataMissing, false);
  global.Game.renderer = makeRenderer();
  s.draw(null, 1300, 800);
  const texts = global.Game.renderer.texts().join(' | ');
  assert.ok(texts.includes('Cỏ Non'), 'pet icon drawn');
  assert.ok(texts.includes('✓ Đã sở hữu'), 'owned state drawn');
  assert.ok(/\d+ 💰/.test(texts), 'price drawn for unowned');
  assert.ok(texts.includes('★ ĐANG DÙNG'), 'equipped gold border state drawn');
  const equippedCards = global.Game.renderer._calls.filter(c =>
    c.m === 'fillRoundRect' && c.args[7] === 3);
  assert.ok(equippedCards.length >= 1, 'equipped card uses borderW=3');
});

/* T02 Pet cards */
check('T02 PetState lists pets with icon and current-selection star', function () {
  const d = freshData();
  makeGame(d);
  const s = new st.PetState();
  s.enter({ petTypes: pets, skinTypes: skins });
  assert.strictEqual(s.dataMissing, false);
  assert.ok(s.itemButtons.find(b => b.item.key === 'clover'), 'clover listed');
  assert.ok(s.itemButtons.find(b => b.item.key === 'star'), 'star listed');
  global.Game.renderer = makeRenderer();
  s.draw(null, 1300, 800);
  assert.ok(global.Game.renderer.texts().join(' | ').includes('Cỏ May Mắn'), 'pet name drawn');
});

/* T03 Skin cards */
check('T03 SkinState shows equipped pen + board state and descriptions', function () {
  const d = freshData();
  makeGame(d);
  const s = new st.SkinState();
  s.enter({ petTypes: pets, skinTypes: skins, filter: 'pen' });
  assert.strictEqual(s.dataMissing, false);
  global.Game.renderer = makeRenderer();
  s.draw(null, 1300, 800);
  const texts = global.Game.renderer.texts().join(' | ');
  assert.ok(texts.includes('★ ĐANG DÙNG'), 'equipped pen shown');
  assert.ok(texts.includes('Bút'), 'skin name drawn');
});

/* T04 Gacha result panel */
check('T04 GachaState result panel shows rarity color + NEW/duplicate indicator', function () {
  const d = freshData();
  makeGame(d);
  const s = new st.GachaState();
  s.enter({});
  assert.strictEqual(s.dataMissing, false);
  s.lastResult = { card: { title: 'Thẻ Toán 1' }, rarity: 'rare', isNew: true };
  global.Game.renderer = makeRenderer();
  s.draw(null, 1300, 2000);
  const texts = global.Game.renderer.texts().join(' | ');
  assert.ok(texts.includes('KẾT QUẢ'), 'result panel title');
  assert.ok(texts.includes('Thẻ Toán 1'), 'card title drawn');
  assert.ok(texts.includes('★ RARE'), 'rarity label');
  assert.ok(texts.includes('✨ MỚI!'), 'new indicator');
  s.lastResult = { card: { title: 'Thẻ Toán 1' }, rarity: 'common', isNew: false };
  global.Game.renderer = makeRenderer();
  s.draw(null, 1300, 2000);
  assert.ok(global.Game.renderer.texts().join(' | ').includes('Đã có (trùng)'), 'duplicate indicator');
});

/* T05 Daily 7-day grid */
check('T05 DailyState 7-day grid with rewards from data + current-day highlight', function () {
  const d = freshData({ daily_streak: 3 });
  makeGame(d);
  const s = new st.DailyState();
  s.enter({ cfg: dailyCfg });
  assert.strictEqual(s.dataMissing, false);
  global.Game.renderer = makeRenderer();
  s.draw(null, 1300, 800);
  const texts = global.Game.renderer.texts().join(' | ');
  assert.ok(texts.includes('Ngày 1'), 'day 1 cell');
  assert.ok(texts.includes('Ngày 7'), 'day 7 cell');
  assert.ok(texts.includes('🎁 NHẬN THƯỞNG'), 'claim button');
  assert.ok(texts.includes('Streak: 3'), 'streak shown');
});

/* T06 Achievement cards */
check('T06 AchievementState cards show icon, desc, XP, completed state', function () {
  const d = freshData();
  makeGame(d);
  const s = new st.AchievementState();
  s.enter({ definitions: achDefs });
  assert.strictEqual(s.dataMissing, false);
  assert.strictEqual(s.rows.length, 9, '9 achievements listed');
  global.Game.renderer = makeRenderer();
  s.draw(null, 1300, 800);
  const texts = global.Game.renderer.texts().join(' | ');
  assert.ok(texts.includes('Chuỗi 5!'), 'ach name drawn');
  assert.ok(texts.includes('Trả lời đúng 5 câu liên tiếp'), 'ach desc drawn');
  assert.ok(texts.includes('+50 XP'), 'ach XP drawn');
  assert.ok(texts.includes('✓'), 'completed check');
  assert.ok(texts.includes('🔒'), 'locked indicator');
});

/* T07 SkillTree 4-col wrap bounds */
check('T07 SkillTree layout 4 columns, all cards within canvas bounds', function () {
  const d = freshData();
  makeGame(d);
  const s = new st.SkillTreeState();
  s.enter({ skills: skills });
  assert.strictEqual(s.dataMissing, false);
  assert.ok(s.items.length > 0, 'skills listed');
  for (const it of s.items) {
    assert.ok(it.x >= 0 && it.x + it.w <= 1300, 'card ' + it.id + ' within bounds');
    assert.ok(it.y >= 0 && it.y + it.h <= 800, 'card vertical bounds');
  }
  const maxCol = Math.max.apply(null, s.items.map(i => i.x));
  assert.ok(maxCol <= 120 + 3 * 250, 'max 4 columns (max x <= 870)');
});

/* T08 ProfileState stats */
check('T08 ProfileState shows username/level/xp/gold/stats/pet icon', function () {
  const d = freshData();
  makeGame(d);
  const s = new st.ProfileState();
  s.enter();
  assert.strictEqual(s.data.username, 'tester');
  global.Game.renderer = makeRenderer();
  s.draw(null, 1300, 800);
  const texts = global.Game.renderer.texts().join(' | ');
  assert.ok(texts.includes('HỒ SƠ NGƯỜI CHƠI'), 'title');
  assert.ok(texts.includes('tester'), 'username');
  assert.ok(texts.includes('⭐ Level'), 'level row');
  assert.ok(texts.includes('🎯 Độ chính xác'), 'accuracy row');
  assert.ok(texts.includes('🔥 Best Combo'), 'combo row');
  assert.ok(texts.includes('1g 1p'), 'play time format 3675s = 1h 1m 15s');
  assert.ok(texts.includes('📊 Bản Đồ Điểm Yếu'), 'skill map button');
});

/* T09 SkillMap weakest-first + colors */
check('T09 SkillMapState weakest-first order + mastery bar rendering', function () {
  const d = freshData();
  makeGame(d);
  const s = new st.SkillMapState();
  s.enter();
  assert.deepStrictEqual(s.rows, [['phep_tru', 0.2], ['phep_cong', 0.9]], 'weakest first');
  global.Game.renderer = makeRenderer();
  s.draw(null, 1300, 800);
  const texts = global.Game.renderer.texts().join(' | ');
  assert.ok(texts.includes('Phép trừ'), 'weakest skill label');
  assert.ok(texts.includes('Phép cộng'), 'strongest skill label');
  assert.ok(texts.includes('20%'), 'pct text');
  assert.ok(texts.includes('Cần hỗ trợ thêm'), 'legend drawn');
  assert.strictEqual(s._barColor(0.2).join(','), '220,90,90', 'weak color');
  assert.strictEqual(s._barColor(0.5).join(','), '230,180,70', 'mid color');
  assert.strictEqual(s._barColor(0.9).join(','), '90,190,120', 'good color');
});

/* T10 Profile routing roundtrip */
check('T10 Menu profile card routes to profile; skill_map roundtrip back', function () {
  const manager = makeGame(freshData());
  manager.register('menu', new st.MenuState());
  manager.register('profile', new st.ProfileState());
  manager.register('skill_map', new st.SkillMapState());
  manager.change('menu');
  manager.current.enter(null);
  const c = manager.current.cards.find(x => x.id === 'profile');
  assert.ok(c, 'profile card exists');
  assert.strictEqual(c.locked, undefined, 'profile card NOT locked');
  const input = new FakeInput();
  input.click(c.x + c.w / 2, c.y + c.h / 2);
  manager.current.handleInput(input, 0.016);
  for (let i = 0; i < 40 && manager.currentName === 'menu'; i++) manager.update(0.033);
  assert.strictEqual(manager.currentName, 'profile');
  const back = new FakeInput();
  back.click(960, 630); /* backBtn center (810,600,300,60) */
  manager.current.handleInput(back, 0.016);
  for (let i = 0; i < 40 && manager.currentName === 'profile'; i++) manager.update(0.033);
  assert.strictEqual(manager.currentName, 'menu', 'profile back → menu');
});

/* T11 Empty mastery friendly state */
check('T11 SkillMapState empty data shows friendly message', function () {
  const d = freshData({ skill_mastery: {} });
  makeGame(d);
  const s = new st.SkillMapState();
  s.enter();
  assert.strictEqual(s.rows.length, 0);
  global.Game.renderer = makeRenderer();
  s.draw(null, 1300, 800);
  assert.ok(global.Game.renderer.texts().join(' | ').includes('chưa làm đủ bài'), 'empty message');
});

/* T12 Daily claimed + future lock */
check('T12 Daily claimed current day shows check and locked future days', function () {
  const d = freshData({ daily_streak: 2 });
  makeGame(d);
  const s = new st.DailyState();
  s.enter({ cfg: dailyCfg });
  s.status.claimedToday = true;
  global.Game.renderer = makeRenderer();
  s.draw(null, 1300, 800);
  const texts = global.Game.renderer.texts().join(' | ');
  assert.ok(texts.includes('✔'), 'claimed check on grid');
  assert.ok(texts.includes('🔒'), 'future day lock');
});

console.log('POLISH M3: pass=' + pass + ' fail=' + fail);
if (fail > 0) process.exit(1);