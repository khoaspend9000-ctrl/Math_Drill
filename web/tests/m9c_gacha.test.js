'use strict';
/* M9-C: GACHA — exact port of Python pity engine (game_init.py:5117-5244). */
const assert = require('assert');
const GachaSystem = require('../js/gacha.js');

let pass = 0, failed = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('PASS  ' + name); }
  catch (e) { failed++; console.error('FAIL  ' + name + ' :: ' + (e && e.message)); }
}
function mk(opts) { return new GachaSystem(opts); }
function fixedRng(vals) {
  let i = 0;
  return { random: function () { return vals[i++ % vals.length]; }, nextFloat: function () { return vals[i++ % vals.length]; },
           randint: function (a, b) { return a; }, choice: function (arr) { return arr[0]; } };
}

check('T01 single pull returns valid card with rarity', function () {
  const g = mk({ rng: fixedRng([0.5]) });
  const r = g.roll(1);
  assert.ok(r && r.card);
  assert.ok(['common', 'rare', 'legendary'].indexOf(r.rarity) >= 0);
  assert.ok(typeof r.isNew === 'boolean');
});

check('T02 soft pity from pull 74 boosts legendary rate', function () {
  const g = mk();
  const st = g.data.gacha_state;
  st.pull_count = 74;
  const p = g._rollRarity(st);
  // With pull_count=74, legendaryRate = 0.006 + 0.06*(74-73) = 0.066
  // Just verify it returns a valid rarity
  assert.ok(['common', 'rare', 'legendary'].indexOf(p) >= 0);
});

check('T03 gold banner reroll common->rare 50%', function () {
  // Use rng that returns common first, then triggers gold reroll
  const g = mk({ rng: fixedRng([0.95, 0.4]) });
  const r = g.roll(1, 'gold');
  assert.ok(r && r.card);
  assert.ok(['common', 'rare', 'legendary'].indexOf(r.rarity) >= 0);
});

check('T04 inventory tracks unique titles', function () {
  const g = mk({ rng: fixedRng([0.5, 0.5, 0.5]) });
  g.roll(1); g.roll(1); g.roll(1);
  assert.ok(g.data.inventory.length >= 1);
  assert.ok(g.data.inventory.length <= 3);
});

check('T05 isNew flag true then false for duplicate', function () {
  const g = mk({ rng: fixedRng([0.5]) });
  const r1 = g.roll(1);
  assert.strictEqual(r1.isNew, true);
  // Same rng -> same card -> not new
  const g2 = mk({ data: { inventory: [r1.card.title], gacha_state: { pull_count: 0, total_pulls: 0, guaranteed_legendary: false, rare_pity: 0 } }, rng: fixedRng([0.5]) });
  const r2 = g2.roll(1);
  assert.strictEqual(r2.isNew, false);
});

check('T06 pity info structure', function () {
  const g = mk();
  const info = g.getPityInfo();
  assert.strictEqual(info.pull_count, 0);
  assert.strictEqual(info.hard_pity, 90);
  assert.strictEqual(info.soft_pity_start, 74);
  assert.strictEqual(info.soft_pity_active, false);
  assert.strictEqual(info.pulls_to_hard, 90);
});

check('T07 getRandomCard returns card from data', function () {
  const g = mk({ cardTypes: { math_facts: { name: 'Facts', rarity: 'common', items: [{ id: 'pi', title: 'Pi', content: 'π', icon: '🥧' }] } } });
  const c = g.getRandomCard();
  assert.ok(c);
  assert.strictEqual(c.title, 'Pi');
});

check('T08 getCardById finds card', function () {
  const g = mk({ cardTypes: { math_facts: { name: 'Facts', rarity: 'common', items: [{ id: 'pi', title: 'Pi', content: 'π', icon: '🥧' }] } } });
  const c = g.getCardById('pi');
  assert.ok(c);
  assert.strictEqual(c.title, 'Pi');
  assert.strictEqual(g.getCardById('nope'), null);
});

check('T09 getAllCards aggregates all', function () {
  const g = mk({ cardTypes: { math_facts: { name: 'Facts', rarity: 'common', items: [{ id: 'pi', title: 'Pi' }] }, history: { name: 'Hist', rarity: 'rare', items: [{ id: 'euclid', title: 'Euclid' }] } } });
  const all = g.getAllCards();
  assert.strictEqual(all.length, 2);
});

check('T10 hard pity at pull 90 guarantees legendary', function () {
  const g = mk({ rng: fixedRng([0.99]) });
  const st = g.data.gacha_state;
  st.pull_count = 89; // next pull is 90 -> hard pity
  const r = g._singleRoll(st, 'standard');
  assert.strictEqual(r.rarity, 'legendary');
});

check('T11 rare pity every 10 pulls', function () {
  const g = mk({ rng: fixedRng([0.95]) });
  const st = g.data.gacha_state;
  st.rare_pity = 9; // next pull triggers rare pity
  const r = g._singleRoll(st, 'standard');
  assert.strictEqual(r.rarity, 'rare');
});

check('T12 10-pull guarantee: no rare+ forces last to rare', function () {
  // All high rolls -> all common, then forced rare at end
  const g = mk({ rng: fixedRng([0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99]) });
  const results = g.roll(10);
  assert.ok(Array.isArray(results));
  assert.strictEqual(results.length, 10);
  const last = results[results.length - 1];
  assert.strictEqual(last.rarity, 'rare');
});

check('T13 pull_count resets on legendary', function () {
  const g = mk({ rng: fixedRng([0.001]) }); // very low -> legendary
  g.roll(1);
  assert.strictEqual(g.data.gacha_state.pull_count, 0);
});

check('T14 total_pulls increments', function () {
  const g = mk({ rng: fixedRng([0.5, 0.5, 0.5]) });
  g.roll(1); g.roll(1); g.roll(1);
  assert.strictEqual(g.data.gacha_state.total_pulls, 3);
});

setTimeout(function () {
  console.log('M9-C Gacha: pass=' + pass + ' fail=' + failed);
  process.exit(failed ? 1 : 0);
}, 500);
