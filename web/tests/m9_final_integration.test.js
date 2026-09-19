'use strict';
/* M9-G FINAL INTEGRATION — cross-system consistency (Node, deterministic).
 * Rebuilt after kernel-disconnect corruption (two files were interleaved).
 * Uses the REAL module APIs proven by m9a/m9b/m9c/m9d/m9e/m9f tests.
 * Covers: shop purchase → pet → skin → gacha → achievement → daily →
 * skill → item, save/reload roundtrip, no double reward. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const { ShopSystem } = require('../js/shop.js');
const { PetSystem, PetManager } = require('../js/pet.js');
const { SkinSystem, SkinManager } = require('../js/skin.js');
const GachaSystem = require('../js/gacha.js');
const AchievementSystem = require('../js/achievements.js').AchievementSystem;
const Daily = require('../js/daily.js');
const { PlayerData } = require('../js/player.js');
const Skill = require('../js/skill_tree.js');
const Item = require('../js/item_effects.js');

let pass = 0, failed = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('PASS  ' + name); }
  catch (e) { failed++; console.error('FAIL  ' + name + ' :: ' + (e && e.message)); }
}

const pets = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'pets.json'), 'utf8'));
const skins = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'skins.json'), 'utf8'));
const skills = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'skills.json'), 'utf8'));
const dailyCfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'daily_rewards.json'), 'utf8'));

function fixedRng(vals) {
  let i = 0;
  return { random: function () { return vals[i++ % vals.length]; },
    nextFloat: function () { return vals[i++ % vals.length]; },
    randint: function (a, b) { return a; }, choice: function (arr) { return arr[0]; } };
}

function mkAccount(over) {
  const FRESH = {
    level: 5, exp: 0, xp: 5000, gold: 5000,
    unlocked_pets: [], unlocked_skins: [],
    pet: { type: 'clover', stage: 0, name: 'Co Non' },
    inventory: [], bag: {}, skill_levels: {}, active_shields: 0,
    active_buffs: {},
    selected_pet: 'clover', equipped_pet: 'clover',
    equipped_skin: 'pen_basic', board_skin: 'board_wood',
    streak: 0, daily_streak: 0, last_login: null, last_claim: null,
    claimed_days: {},
    achievement_progress: {}, achievements_unlocked: [],
    gacha_state: { pull_count: 0, total_pulls: 0, guaranteed_legendary: false, rare_pity: 0 }
  };
  // fresh deep copy per call — tests must never share state
  const d = JSON.parse(JSON.stringify(FRESH));
  if (over) Object.assign(d, over);
  return {
    currentUser: 'tester', _data: d,
    data: function () { return this._data; },
    saveCount: 0,
    save: function () { this.saveCount++; }
  };
}

const D = function (m, day) {
  return '2026-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
};

/* T01 Shop purchase → exact gold deduction + ownership (single gold source) */
check('T01 Shop purchase exact gold + ownership', function () {
  const acct = mkAccount();
  const shop = new ShopSystem({ petTypes: pets, skinTypes: skins, data: acct._data });
  const before = acct._data.gold;
  const r = shop.purchasePet('star');
  assert.strictEqual(r.ok, true, 'purchase must succeed with 5000 gold');
  assert.strictEqual(acct._data.gold, before - shop.getPetPrice('star'), 'exact deduction');
  assert.strictEqual(shop.ownsPet('star'), true);
});

/* T02 duplicate purchase blocked — no double deduction */
check('T02 Duplicate purchase blocked, gold untouched', function () {
  const acct = mkAccount({ level: 5, xp: 5000, gold: 5000, unlocked_pets: ['star'] });
  const shop = new ShopSystem({ petTypes: pets, skinTypes: skins, data: acct._data });
  const before = acct._data.gold;
  const r = shop.purchasePet('star');
  assert.strictEqual(r.ok, false, 'duplicate must be blocked');
  assert.strictEqual(acct._data.gold, before, 'gold must not change on duplicate');
});

/* T03 Pet select + Skin equip → persistence in one account data */
check('T03 Pet select + Skin equip persist to account data', function () {
  const acct = mkAccount({ level: 5, xp: 5000, gold: 5000,
    unlocked_pets: ['clover', 'star'], unlocked_skins: ['pen_wood', 'pen_magic'] });
  const ps = new PetSystem(pets);
  const pm = new PetManager({ petSystem: ps, data: acct._data });
  assert.strictEqual(pm.changePetType('star'), true);
  assert.strictEqual(acct._data.pet.type, 'star');
  const ss = new SkinSystem(skins);
  const sm = new SkinManager({ skinSystem: ss, data: acct._data });
  assert.strictEqual(sm.equipSkin('pen_magic').ok, true);
  // skin.js persists pen skins in equipped_pen (getEquippedSkins contract)
  assert.strictEqual(acct._data.equipped_pen, 'pen_magic');
  const snap = JSON.parse(JSON.stringify(acct._data));
  assert.strictEqual(snap.pet.type, 'star');
  assert.strictEqual(snap.equipped_pen, 'pen_magic');
  assert.ok(snap.unlocked_pets.indexOf('star') >= 0);
});

/* T04 Gacha roll → inventory mapping + isNew + pity counters advance */
check('T04 Gacha reward → inventory + isNew + pity', function () {
  const acct = mkAccount();
  const g = new GachaSystem({ data: acct._data, rng: fixedRng([0.5]) });
  const r1 = g.roll(1);
  assert.ok(r1 && r1.card, 'roll returns card');
  assert.strictEqual(r1.isNew, true, 'first card is new');
  assert.ok(acct._data.inventory.indexOf(r1.card.title) >= 0, 'inventory tracks title');
  assert.ok(acct._data.gacha_state.pull_count >= 1, 'pity pull_count advances');
  assert.ok(acct._data.gacha_state.total_pulls >= 1, 'total_pulls advances');
  const before = acct._data.inventory.length;
  const r2 = g.roll(1);
  if (r2.card.title === r1.card.title) {
    assert.strictEqual(r2.isNew, false);
    assert.strictEqual(acct._data.inventory.length, before, 'no duplicate inventory entry');
  }
});


/* T05 Achievement unlock once + XP exactly once */
check('T05 Achievement unlock once, reward XP once', function () {
  const s = new AchievementSystem();
  const e1 = s.unlock('streak_5');
  assert.ok(e1 && e1.xp === 50, 'unlock returns xp entry');
  assert.strictEqual(s.unlock('streak_5'), null, 'duplicate unlock returns null');
  const q = s.getQueue();
  assert.strictEqual(q.filter(function (x) { return x.id === 'streak_5'; }).length, 1,
    'queue must not duplicate the unlock');
});

/* T06 Daily claim: once per day, streak grows, next day consecutive */
check('T06 Daily claim once/day + streak increment', function () {
  const p = new PlayerData();
  const day1 = mkAccount({ streak: 0, last_login: null, gold: 0 });
  const sys1 = new Daily.DailyRewardSystem({
    player: p, accountSystem: day1, cfg: dailyCfg,
    nowISO: function () { return D(9, 1); }
  });
  const r1 = sys1.claim();
  assert.ok(r1 && r1.xp === 50 && r1.gold === 20, 'day1 = 50xp/20gold');
  // daily.js persists daily_streak + last_claim (game_init.py contract)
  assert.strictEqual(day1._data.daily_streak, 1);
  assert.strictEqual(day1._data.last_claim, '2026-09-01');
  assert.strictEqual(day1._data.gold, 20, 'gold applied once');
  assert.strictEqual(sys1.claim(), null, 'duplicate claim same day returns null');
  assert.strictEqual(day1._data.gold, 20, 'no double gold');
  const sys2 = new Daily.DailyRewardSystem({
    player: p, accountSystem: day1, cfg: dailyCfg,
    nowISO: function () { return D(9, 2); }
  });
  const r2 = sys2.claim();
  assert.ok(r2 && r2.day === 2, 'day2 reward');
  assert.strictEqual(day1._data.daily_streak, 2, 'streak increments');
});

/* T07 Skill unlock→upgrade: XP deducted exactly, level persisted */

/* T08 Item consumable: card in bag → activate → shield usable once */
check('T08 Item activate + shield consume once', function () {
  const acct = mkAccount();
  // activate() takes the CARD TITLE from bag (CARD_EFFECT_MAP: 'Khiên Tri Thức' → shield_1life)
  acct._data.bag = { 'Khiên Tri Thức': 1 };
  const fx = new Item.ItemEffectSystem({ accountSystem: acct });
  const act = fx.activate('Khiên Tri Thức');
  assert.ok(act, 'shield activation returns: ' + JSON.stringify(act));
  assert.strictEqual(fx.hasShield(), true, 'shield buff active');
  assert.strictEqual(fx.useShield(), true, 'shield usable');
  assert.strictEqual(fx.hasShield(), false, 'shield consumed once');
  assert.strictEqual(fx.useShield(), false, 'no shield left');
});

/* T09 FULL cross-system session on ONE account — no double reward */
check('T09 Full cross-system session, no double reward', function () {
  const acct = mkAccount();
  const d = acct._data;
  const shop = new ShopSystem({ petTypes: pets, skinTypes: skins, data: d });
  const ps = new PetSystem(pets); const pm = new PetManager({ petSystem: ps, data: d });
  const ss = new SkinSystem(skins); const sm = new SkinManager({ skinSystem: ss, data: d });
  const g = new GachaSystem({ data: d, rng: fixedRng([0.5]) });
  const ach = new AchievementSystem();
  const p = new PlayerData();
  const daily = new Daily.DailyRewardSystem({ player: p, accountSystem: acct, cfg: dailyCfg,
    nowISO: function () { return D(9, 1); } });
  const tree = new Skill.SkillTreeSystem(JSON.parse(JSON.stringify(skills)), {});
  const fx = new Item.ItemEffectSystem({ accountSystem: acct });

  assert.strictEqual(shop.purchasePet('star').ok, true);
  assert.strictEqual(pm.changePetType('star'), true);
  assert.strictEqual(shop.purchaseSkin('pen_magic').ok, true);
  assert.strictEqual(sm.equipSkin('pen_magic').ok, true);
  const gr = g.roll(1);
  assert.ok(gr && gr.card);
  const ae = ach.unlock('streak_5');
  assert.ok(ae && ae.xp === 50);
  assert.strictEqual(ach.unlock('streak_5'), null, 'ach duplicate null');
  // skill via SkillManager (AccountSystem.py port — the persistence path)
  const smgr = new Skill.SkillManager({ skillTree: tree, accountSystem: acct });
  assert.strictEqual(smgr.unlockSkill('gold_boost_1')[0], true);
  assert.strictEqual(smgr.upgradeSkill('gold_boost_1')[0], true,
    'upgrade persists skill level to account');
  const dr_pre = d.gold; // 4450 after both purchases
  // Real login flow: player gold is synced from account (loadSaveData),
  // and addGold mirrors player.gold into account data. Sync before claim.
  p.gold = dr_pre;
  const dr = daily.claim();
  assert.ok(dr && dr.gold === 20);
  assert.strictEqual(daily.claim(), null, 'daily double-claim blocked');
  acct._data.bag = { 'Khiên Tri Thức': 1 };
  assert.ok(fx.activate('Khiên Tri Thức'), 'shield card activates');

  // gold audit: shop deducts exact prices, daily adds 20 exactly once
  const petPrice = shop.getPetPrice('star');
  const skinPrice = shop.getSkinPrice('pen_magic');
  const expectedGold = 5000 - petPrice - skinPrice + 20;
  if (d.gold !== expectedGold) {
    console.error('  [trace] pet=' + petPrice + ' skin=' + skinPrice +
      ' gold=' + d.gold + ' expected=' + expectedGold +
      ' daily_streak=' + d.daily_streak);
  }
  assert.strictEqual(d.gold, expectedGold,
    'gold = 5000 - pet - skin + daily20, exactly once each');
  const snap = JSON.parse(JSON.stringify(d));
  assert.ok(snap.unlocked_pets.indexOf('star') >= 0);
  assert.ok(snap.unlocked_skins.indexOf('pen_magic') >= 0);
  assert.ok(snap.equipped_pen === 'pen_magic');
  assert.ok(snap.inventory.length >= 1);
  assert.strictEqual(snap.daily_streak, 1);
  assert.ok(snap.skill_levels['gold_boost_1'] >= 1);
  // achievements persist via own save() blob (m9d T11 contract), not account key
  assert.strictEqual(ach.isUnlocked('streak_5'), true);
  assert.ok(ach.save().unlocked['streak_5'], 'unlock persists in achievement save blob');
});

/* T10 Save → reload → systems rebuilt stay consistent */
check('T10 Save/reload roundtrip consistency', function () {
  const acct = mkAccount();
  const d = acct._data;
  const shop = new ShopSystem({ petTypes: pets, skinTypes: skins, data: d });
  shop.purchasePet('dragon');
  const snap = JSON.parse(JSON.stringify(d));
  const shop2 = new ShopSystem({ petTypes: pets, skinTypes: skins, data: snap });
  assert.strictEqual(shop2.ownsPet('dragon'), true, 'ownership survives reload');
  const before = snap.gold;
  assert.strictEqual(shop2.purchasePet('dragon').ok, false, 'duplicate blocked after reload');
  assert.strictEqual(snap.gold, before, 'gold unchanged by reload duplicate');
});

check('T07 Skill XP flow + level persisted (SkillManager = AccountSystem port)', function () {
  const tree = new Skill.SkillTreeSystem(JSON.parse(JSON.stringify(skills)), {});
  const acct = mkAccount({ level: 5, xp: 1000, gold: 0 });
  const mgr = new Skill.SkillManager({ skillTree: tree, accountSystem: acct });
  assert.strictEqual(mgr.unlockSkill('gold_boost_1')[0], true, 'unlock with enough XP');
  assert.strictEqual(acct._data.xp, 950, 'unlock deducted exactly 50 XP');
  assert.strictEqual(mgr.upgradeSkill('gold_boost_1')[0], true, 'upgrade level1');
  assert.strictEqual(acct._data.xp, 700, 'upgrade deducted exactly 250 XP');
  assert.strictEqual(acct._data.skill_levels['gold_boost_1'], 2, 'skill level persisted');
});

console.log('');
console.log('M9-G final integration: pass=' + pass + ' fail=' + failed);
process.exit(failed === 0 ? 0 : 1);

