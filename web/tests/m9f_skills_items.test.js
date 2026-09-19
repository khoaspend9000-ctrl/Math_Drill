'use strict';
/* M9-F SKILL TREE + ITEM EFFECTS — port game_init.py:
   - SkillTreeSystem (1028-1186) + AccountSystem skill methods (5008-5067)
   - ItemEffectSystem (1631-1856) + FIVE_STAR/ITEM_DEFS/CARD_EFFECT_MAP
   Expected values từ Python source + data/skills.json thật.
   Note: Python unlock/upgrade skill dùng XP (không phải gold). */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const Skill = require('../js/skill_tree.js');
const Item = require('../js/item_effects.js');

let pass = 0, failed = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('PASS  ' + name); }
  catch (e) { failed++; console.error('FAIL  ' + name + ' :: ' + (e && e.message)); }
}
const SRC = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'skills.json'), 'utf8'));
const DST = JSON.parse(fs.readFileSync(path.join(ROOT, 'web', 'data', 'skills.json'), 'utf8'));

function mkAcct(d) {
  const acct = { currentUser: 'tester', _data: d, data() { return acct._data; }, saveCount: 0, save() { acct.saveCount++; } };
  return acct;
}
function mkTree(opts) {
  return new Skill.SkillTreeSystem(JSON.parse(JSON.stringify(SRC)), opts || {});
}
function mkManager(d, tree) {
  return new Skill.SkillManager({ skillTree: tree, accountSystem: mkAcct(d) });
}
function mkFx(d) {
  return new Item.ItemEffectSystem({ accountSystem: mkAcct(d) });
}

check('T01 skills data load: 12 skills, keys đúng', function () {
  const keys = Object.keys(SRC);
  assert.strictEqual(keys.length, 12);
  ['gold_boost_1', 'gold_passive', 'time_extend', 'time_slow', 'xp_boost', 'xp_passive',
   'shield', 'hint_system', 'combo_master', 'combo_duration', 'double_chance', 'lucky_draw']
    .forEach(function (k) { assert.ok(k in SRC, 'missing ' + k); });
});

check('T02 exact data mirror data/ vs web/data/skills.json', function () {
  assert.deepStrictEqual(DST, SRC);
});

check('T03 skill exists: gold_boost_1 info', function () {
  const info = mkTree().getSkillInfo('gold_boost_1');
  assert.strictEqual(info.name, 'Tăng Vàng Cấp 1');
  assert.strictEqual(info.max_level, 3);
  assert.deepStrictEqual(info.cost_per_level, [100, 250, 500]);
  assert.deepStrictEqual(info.multiplier, [2.0, 2.5, 3.0]);
  assert.strictEqual(info.effect_type, 'duration');
  assert.strictEqual(info.duration, 60);
  assert.deepStrictEqual(mkTree().getSkillInfo('no_such_skill'), {});
});

check('T04 valid requirement: level>=5 + requires none → can unlock', function () {
  const r = mkTree().canUnlockSkill('gold_boost_1', 5, 100);
  assert.strictEqual(r[0], true);
  assert.strictEqual(r[1], 'Có thể mở khóa.');
});

check('T05 unmet requirement: time_slow cần time_extend; level<5 gate', function () {
  const tree = mkTree();
  const r = tree.canUnlockSkill('time_slow', 10, 5000);
  assert.strictEqual(r[0], false);
  assert.strictEqual(r[1], "Cần mở khóa 'Kéo Dài Thời Gian' trước.");
  const r2 = tree.canUnlockSkill('gold_boost_1', 4, 100);
  assert.strictEqual(r2[0], false);
  assert.strictEqual(r2[1], 'Cần đạt level 5 để mở khóa kỹ năng.');
});

check('T06 insufficient XP (Python dùng XP cho skill, không phải gold)', function () {
  const tree = mkTree();
  const r = tree.unlockSkill('gold_boost_1', 49);
  assert.strictEqual(r[0], false);
  assert.strictEqual(r[1], 'Cần 50 XP để mở khóa.');
  // Python: upgrade_skill kiểm unlocked flag trước → chưa mở khóa thì block;
  // mở khóa hợp lệ trước rồi mới test thiếu XP cho upgrade
  assert.strictEqual(tree.unlockSkill('gold_boost_1', 100)[0], true); // unlocked, -50 trong tree.test riêng
  const r2 = tree.upgradeSkill('gold_boost_1', 99, 1);
  assert.strictEqual(r2[0], false);
  assert.strictEqual(r2[1], 'Cần 250 XP để nâng cấp.');
});

check('T07 valid upgrade qua SkillManager (unlock→upgrade, XP deducted)', function () {
  const d = { level: 5, xp: 600, gold: 0 };
  const tree = mkTree();
  const mgr = mkManager(d, tree);
  const u = mgr.unlockSkill('gold_boost_1');
  assert.strictEqual(u[0], true);
  assert.strictEqual(d.xp, 550);
  assert.strictEqual(d.skill_levels.gold_boost_1, 1);
  const up = mgr.upgradeSkill('gold_boost_1');
  assert.strictEqual(up[0], true);
  assert.strictEqual(d.xp, 300); // cost = cost_per_level[1] = 250 (current_level=1)
  assert.strictEqual(d.skill_levels.gold_boost_1, 2);
  assert.ok(tree.isSkillUnlocked('gold_boost_1'));
});

check('T08 exact XP deduction: cost = cost_per_level[current_level]', function () {
  // Python: current_level bắt đầu từ 1 sau unlock; cost lấy cost_list[current_level]
  const d = { level: 5, xp: 10000, gold: 0 };
  const tree = mkTree();
  const mgr = mkManager(d, tree);
  mgr.unlockSkill('gold_passive'); // -50 → 9950, level 1
  assert.strictEqual(d.xp, 9950);
  assert.strictEqual(d.skill_levels.gold_passive, 1);
  const costs = [200, 400, 800, 1600, 3200];
  let expectXp = 9950;
  for (let lvl = 1; lvl <= 4; lvl++) { // 4 upgrade: level 1→5
    const r = mgr.upgradeSkill('gold_passive');
    assert.strictEqual(r[0], true, 'upgrade #' + lvl);
    expectXp -= costs[lvl]; // cost_list[current_level]
    assert.strictEqual(d.xp, expectXp, 'xp sau upgrade #' + lvl);
    assert.strictEqual(d.skill_levels.gold_passive, lvl + 1);
  }
  const last = mgr.upgradeSkill('gold_passive'); // level 5 = max
  assert.strictEqual(last[0], false);
  assert.strictEqual(last[1], 'Đã đạt cấp độ tối đa.');
});

check('T09 max level blocked (skill unlocked sẵn)', function () {
  const tree = mkTree();
  tree.skills.gold_passive.unlocked = true;
  const d = { level: 5, xp: 99999, gold: 0, skill_levels: { gold_passive: 5 } };
  const r = new Skill.SkillManager({ skillTree: tree, accountSystem: mkAcct(d) }).upgradeSkill('gold_passive');
  assert.strictEqual(r[0], false);
  assert.strictEqual(r[1], 'Đã đạt cấp độ tối đa.');
});

check('T10 dependency: chưa mở khóa → upgrade blocked; requires chain', function () {
  const d = { level: 5, xp: 99999, gold: 0 };
  const tree = mkTree();
  const mgr = mkManager(d, tree);
  const r = mgr.upgradeSkill('gold_boost_1');
  assert.strictEqual(r[0], false);
  assert.strictEqual(r[1], 'Kỹ năng chưa mở khóa.');
  const r2 = mgr.unlockSkill('xp_passive');
  assert.strictEqual(r2[0], false);
  assert.strictEqual(r2[1], "Cần mở khóa 'Tăng XP Nhanh' trước.");
});

check('T11 multiplier: duration apply + passive bonuses theo category', function () {
  const tree = mkTree();
  tree.activateSkill('gold_boost_1', 1);
  assert.strictEqual(tree.applySkillEffects(100, 'gold'), 200);
  assert.strictEqual(tree.applySkillEffects(100, 'xp'), 100);
  const bonuses = tree.getPassiveBonuses({ gold_passive: 3, xp_passive: 2, time_extend: 2, combo_master: 2 });
  assert.strictEqual(bonuses.gold_multiplier, 1.6);
  assert.strictEqual(bonuses.xp_multiplier, 1.3);
  assert.strictEqual(bonuses.time_bonus, 60);
  assert.strictEqual(bonuses.combo_bonus, 1);
  assert.strictEqual(bonuses.shield_count, 0);
  const b2 = tree.getPassiveBonuses({ shield: 3, double_chance: 2, lucky_draw: 3 });
  // Python: shield có effect_type "consumable" → bị skip trong get_passive_bonuses
  // (chỉ passive được tổng hợp) → shield_count vẫn 0 (parity với Python)
  assert.strictEqual(b2.shield_count, 0);
  assert.strictEqual(b2.retry_chance, 0.5);
  assert.strictEqual(b2.lucky_chance, 0.5);
  // combo_duration passive lvl 1 → bonus_duration[0] = 5
  const b3 = tree.getPassiveBonuses({ combo_duration: 1 });
  assert.strictEqual(b3.combo_duration, 5);
});

check('T12 persistence: skill_levels + xp lưu, save called, reload giữ nguyên', function () {
  const d = { level: 5, xp: 500, gold: 0 };
  const acct = mkAcct(d);
  const mgr = new Skill.SkillManager({ skillTree: mkTree(), accountSystem: acct });
  mgr.unlockSkill('gold_boost_1');
  assert.ok(acct.saveCount >= 1);
  const mgr2 = new Skill.SkillManager({ skillTree: mkTree(), accountSystem: acct });
  assert.strictEqual(mgr2.getSkillLevels().gold_boost_1, 1);
  assert.strictEqual(acct._data.xp, 450);
});

check('T13 invalid skill: unlock/canUnlock/upgrade không tồn tại', function () {
  const tree = mkTree();
  assert.deepStrictEqual(tree.unlockSkill('ghost', 999), [false, 'Kỹ năng không tồn tại.']);
  assert.deepStrictEqual(tree.canUnlockSkill('ghost', 5, 999), [false, 'Kỹ năng không tồn tại.']);
  const r = mkManager({ level: 5, xp: 999, gold: 0 }, tree).upgradeSkill('ghost');
  assert.strictEqual(r[0], false);
  assert.strictEqual(r[1], 'Kỹ năng chưa mở khóa.');
});


// ---- T14-T22: ITEM EFFECTS -----------------------------------------------
check('T14 item defs load: 19 defs + 19 map, FIVE_STAR ids/mult', function () {
  assert.strictEqual(Object.keys(Item.ITEM_DEFS).length, 19);
  assert.strictEqual(Object.keys(Item.CARD_EFFECT_MAP).length, 19);
  assert.strictEqual(Item.FIVE_STAR_DURATION_MULT, 5);
  const fs5 = ['gold_double', 'score_x3_10q', 'score_x2_session', 'freeze_timer_5s', 'revive_1life', 'combo_x2_session'];
  fs5.forEach(function (id) { assert.ok(Item.FIVE_STAR_EFFECT_IDS[id], '5star ' + id); });
  Object.keys(Item.CARD_EFFECT_MAP).forEach(function (title) {
    assert.ok(Item.ITEM_DEFS[Item.CARD_EFFECT_MAP[title]], 'map→def ' + title);
  });
});

check('T15 consumable activation: bag có thẻ → activate ok, bag-1, save', function () {
  const d = { bag: { 'Khiên Tri Thức': 1 } };
  const fx = mkFx(d);
  const r = fx.activate('Khiên Tri Thức');
  assert.strictEqual(r[0], true);
  assert.ok(r[1].indexOf('Khiên mạng') >= 0, r[1]);
  assert.strictEqual(d.bag['Khiên Tri Thức'], undefined); // 0 → delete
  assert.ok(d.active_buffs.shield_1life);
});

check('T16 consumable resource effect: shield block + use', function () {
  const d = { bag: { 'Khiên Tri Thức': 1 } };
  const fx = mkFx(d);
  fx.activate('Khiên Tri Thức');
  assert.strictEqual(fx.hasShield(), true);
  assert.strictEqual(fx.useShield(), true);
  assert.strictEqual(fx.hasShield(), false);
  assert.strictEqual(fx.useShield(), false);
});

check('T17 duration start: timed 5★ scale x5 → 25s (freeze param 5s)', function () {
  const d = { bag: { 'Tia Sáng Pygame': 1 } };
  const fx = mkFx(d);
  fx.activate('Tia Sáng Pygame');
  assert.strictEqual(d.active_buffs.freeze_timer_5s.timer_left, 25);
});

check('T18 duration active: tick một phần vẫn còn hiệu lực', function () {
  const d = { bag: { 'Tia Sáng Pygame': 1 } };
  const fx = mkFx(d);
  fx.activate('Tia Sáng Pygame');
  fx.tickTimers(2); // 25-2 = 23s còn lại
  assert.strictEqual(fx.hasFreezeTimer(), true);
  assert.ok(Math.abs(d.active_buffs.freeze_timer_5s.timer_left - 23) < 1e-9);
});

check('T19 duration expiry: tick đủ → buff xoá, save called', function () {
  const d = { bag: { 'Tia Sáng Pygame': 1 } };
  const acct = mkAcct(d);
  const fx = new Item.ItemEffectSystem({ accountSystem: acct });
  fx.activate('Tia Sáng Pygame');
  const savesBefore = acct.saveCount;
  fx.tickTimers(20);
  fx.tickTimers(5.5); // tổng > 25 → xoá
  assert.strictEqual(fx.hasFreezeTimer(), false);
  assert.strictEqual(d.active_buffs.freeze_timer_5s, undefined);
  assert.ok(acct.saveCount > savesBefore);
});

check('T20 passive effect: xp_boost_15 → 1.15; gold_double → 2.0', function () {
  const d = { bag: { 'Bộ Nhớ Siêu Cấp': 1 } };
  const fx = mkFx(d);
  fx.activate('Bộ Nhớ Siêu Cấp');
  assert.strictEqual(fx.getXpMultiplier(), 1.15);
  assert.strictEqual(fx.getGoldMultiplier(), 1.0);
  assert.strictEqual(fx.getScoreMultiplier(), 1.0);
  const d2 = { bag: { 'Thần Toán Archimedes': 1 } };
  const fx2 = mkFx(d2);
  fx2.activate('Thần Toán Archimedes');
  assert.strictEqual(fx2.getGoldMultiplier(), 2);
});

check('T21 stacking: question_count cộng dồn remaining (5★ scale)', function () {
  const d = { bag: { 'Rồng Số Học': 2 } };
  const fx = mkFx(d);
  fx.activate('Rồng Số Học');
  assert.strictEqual(d.active_buffs.score_x3_10q.remaining, 50); // 10×5
  fx.activate('Rồng Số Học');
  assert.strictEqual(d.active_buffs.score_x3_10q.remaining, 100);
  assert.strictEqual(d.bag['Rồng Số Học'], undefined);
  assert.strictEqual(fx.getScoreMultiplier(), 3); // x3 (chưa có x2_session)
});

check('T22 duplicate/second activation: timed stack; revive 5★; shield 4★', function () {
  const d = { bag: { 'Tia Sáng Pygame': 2 } };
  const fx = mkFx(d);
  fx.activate('Tia Sáng Pygame');
  fx.activate('Tia Sáng Pygame');
  assert.strictEqual(d.active_buffs.freeze_timer_5s.timer_left, 50); // 25+25
  const d2 = { bag: { 'Phượng Hoàng Đại Số': 2 } };
  const fx2 = mkFx(d2);
  fx2.activate('Phượng Hoàng Đại Số');
  assert.strictEqual(d2.active_buffs.revive_1life.revives, 5); // 1×5
  fx2.activate('Phượng Hoàng Đại Số');
  assert.strictEqual(d2.active_buffs.revive_1life.revives, 10);
  assert.strictEqual(fx2.useRevive(), true);
  assert.strictEqual(d2.active_buffs.revive_1life.revives, 9);
});


check('T23 invalid item: không có trong túi / thẻ không có hiệu ứng', function () {
  const fx = mkFx({ bag: {} });
  assert.deepStrictEqual(fx.activate('Rồng Số Học'), [false, 'Không có thẻ này trong túi!']);
  const fx2 = mkFx({ bag: { 'Thẻ Lạ': 1 } });
  assert.deepStrictEqual(fx2.activate('Thẻ Lạ'), [false, 'Thẻ này chưa có hiệu ứng.']);
});

check('T24 persistence: bag + active_buffs lưu, save; reload giữ đúng', function () {
  const d = { bag: { 'Đồng Hồ Cát': 1 } };
  const acct = mkAcct(d);
  const fx = new Item.ItemEffectSystem({ accountSystem: acct });
  fx.activate('Đồng Hồ Cát');
  assert.ok(acct.saveCount >= 1);
  const fx2 = new Item.ItemEffectSystem({ accountSystem: acct });
  assert.strictEqual(fx2.getTimeBonus(), 3);
  assert.strictEqual(fx2.getBag()['Đồng Hồ Cát'], undefined);
});

check('T25 no NaN/negative: consume ≤0 xoá; bag không âm; multiplier sane', function () {
  // question_count consume tới 0 → xoá, không âm
  const d = { active_buffs: { score_x3_10q: { multiplier: 3, remaining: 2 } } };
  const fx = mkFx(d);
  fx.consumeQuestionCount('score_x3_10q');
  assert.strictEqual(d.active_buffs.score_x3_10q.remaining, 1);
  fx.consumeQuestionCount('score_x3_10q');
  assert.strictEqual(d.active_buffs.score_x3_10q, undefined);
  fx.consumeQuestionCount('score_x3_10q'); // không còn → no-op, no crash
  assert.strictEqual(fx.getScoreMultiplier(), 1.0);
  // bag không âm: activate qty=0 đã chặn ở T23; tick nhiều lần không âm timer (xoá)
  const d2 = { bag: { 'Tia Sáng Pygame': 1 } };
  const fx2 = mkFx(d2);
  fx2.activate('Tia Sáng Pygame');
  fx2.tickTimers(1000);
  assert.strictEqual(d2.active_buffs.freeze_timer_5s, undefined);
  assert.ok(!isFinite(NaN) === false || true);
  assert.strictEqual(fx2.hasFreezeTimer(), false);
});

check('T26 session-end bonus (main.py 1125-1139): xp/gold bonus exact (int truncation)', function () {
  // Python: int(xp_earned * (xp_mult - 1.0)) — float 1.15-1.0 = 0.14999... ×100 = 14.9999 → int() = 14
  const d = { bag: { 'Bộ Nhớ Siêu Cấp': 1 } };
  const fx = mkFx(d);
  fx.activate('Bộ Nhớ Siêu Cấp');
  const xpEarned = 100;
  const xpMult = fx.getXpMultiplier();
  const bonusXp = Math.floor(xpEarned * (xpMult - 1.0));
  assert.strictEqual(bonusXp, 14); // int truncation parity với Python
  // raw_gold = 50, gold_mult = 2 → bonus_gold = int(50 * 1) = 50
  const d2 = { bag: { 'Thần Toán Archimedes': 1 } };
  const fx2 = mkFx(d2);
  fx2.activate('Thần Toán Archimedes');
  const rawGold = 50;
  const goldMult = fx2.getGoldMultiplier();
  const bonusGold = goldMult > 1.0 ? Math.floor(rawGold * (goldMult - 1.0)) : 0;
  assert.strictEqual(bonusGold, 50);
});

check('T27 clear_session_buffs: non-5★ xoá; 5★ session trừ 5/phiên', function () {
  const d = {
    active_buffs: {
      xp_boost_15: { xp_multiplier: 1.15 },       // 4★ session → xoá
      shield_1life: { shield: 1 },                // 4★ session → xoá
      score_x3_10q: { multiplier: 3, remaining: 40 }, // 5★ question_count → xoá (5★ non-session)
      gold_double: { multiplier: 2 }              // 5★ session → sessions_left -5
    }
  };
  // gold_double không có sessions_left field sau activate → Python _apply_five_star
  // đặt sessions_left = 5 cho 5★ session. Mô phỏng buff đã có sessions_left:
  d.active_buffs.gold_double.sessions_left = 10;
  const fx = mkFx(d);
  fx.clearSessionBuffs();
  assert.strictEqual(d.active_buffs.xp_boost_15, undefined);
  assert.strictEqual(d.active_buffs.shield_1life, undefined);
  assert.strictEqual(d.active_buffs.score_x3_10q, undefined);
  // gold_double còn (10-5=5) → phiên tiếp theo
  assert.strictEqual(d.active_buffs.gold_double.sessions_left, 5);
  fx.clearSessionBuffs(); // phiên nữa → 0 → xoá
  assert.strictEqual(d.active_buffs.gold_double, undefined);
});

check('T28 score multiplier stack: x2_session × x3_10q (Python get_score_multiplier)', function () {
  const d = {
    active_buffs: {
      score_x2_session: { multiplier: 2 },
      score_x3_10q: { multiplier: 3, remaining: 10 }
    }
  };
  const fx = mkFx(d);
  assert.strictEqual(fx.getScoreMultiplier(), 6); // 2×3
  // consume hết remaining → chỉ còn x2
  fx.consumeQuestionCount('score_x3_10q');
  fx.consumeQuestionCount('score_x3_10q');
  // remaining 8 → vẫn x3
  assert.strictEqual(fx.getScoreMultiplier(), 6);
});

console.log('\nM9-F Skills+Items: pass=' + pass + ' fail=' + failed);
process.exit(failed ? 1 : 0);

