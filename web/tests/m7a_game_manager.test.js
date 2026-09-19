'use strict';
/* M7-A: Game Manager / Reward Pipeline tests.
   Verify formulas match Python game_init.py + main.py exactly. */
const assert = require('assert');
const {
  GameManager,
  calculateGoldReward,
  calculateXpReward,
  calculateScorePoints,
  getComboMultiplier
} = require('../js/game_manager.js');
const { PlayerData } = require('../js/player.js');

let pass = 0, failed = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('PASS  ' + name); }
  catch (e) { failed++; console.error('FAIL  ' + name + ' :: ' + (e && e.message)); }
}

// ---- Combo multiplier thresholds (game_init.py:409-420) ----
check('T01 combo multiplier: streak<3 → 1.5x', function () {
  assert.strictEqual(getComboMultiplier(0, 0), 1.5);
  assert.strictEqual(getComboMultiplier(1, 0), 1.5);
  assert.strictEqual(getComboMultiplier(2, 0), 1.5);
});

check('T02 combo multiplier: streak>=3 → 2x', function () {
  assert.strictEqual(getComboMultiplier(3, 0), 2.0);
  assert.strictEqual(getComboMultiplier(4, 0), 2.0);
});

check('T03 combo multiplier: streak>=5 → 3x', function () {
  assert.strictEqual(getComboMultiplier(5, 0), 3.0);
  assert.strictEqual(getComboMultiplier(9, 0), 3.0);
});

check('T04 combo multiplier: streak>=10 → 4x', function () {
  assert.strictEqual(getComboMultiplier(10, 0), 4.0);
  assert.strictEqual(getComboMultiplier(99, 0), 4.0);
});

check('T05 combo multiplier with skill bonus threshold', function () {
  assert.strictEqual(getComboMultiplier(0, 2), 1.5);
  assert.strictEqual(getComboMultiplier(1, 2), 2.0);
  assert.strictEqual(getComboMultiplier(3, 2), 3.0);
  assert.strictEqual(getComboMultiplier(8, 2), 4.0);
});

// ---- Score points (main.py:1809-1813) ----
check('T06 score points: base 20 * combo_multiplier', function () {
  assert.strictEqual(calculateScorePoints(1.0, 1.0), 20);
  assert.strictEqual(calculateScorePoints(1.5, 1.0), 30);
  assert.strictEqual(calculateScorePoints(2.0, 1.0), 40);
  assert.strictEqual(calculateScorePoints(3.0, 1.0), 60);
  assert.strictEqual(calculateScorePoints(4.0, 1.0), 80);
});

check('T07 score points: with item score multiplier', function () {
  assert.strictEqual(calculateScorePoints(2.0, 1.5), Math.floor(40 * 1.5));
  assert.strictEqual(calculateScorePoints(1.0, 3.0), 60);
});

// ---- XP reward (main.py:1580-1589) ----
check('T08 XP reward: base 10 * combo_multiplier', function () {
  assert.strictEqual(calculateXpReward(1.0, {}), 10);
  assert.strictEqual(calculateXpReward(1.5, {}), 15);
  assert.strictEqual(calculateXpReward(2.0, {}), 20);
  assert.strictEqual(calculateXpReward(4.0, {}), 40);
});

check('T09 XP reward: fever mode x2', function () {
  assert.strictEqual(calculateXpReward(1.0, { fever: true }), 20);
  assert.strictEqual(calculateXpReward(2.0, { fever: true }), 40);
});

check('T10 XP reward: combo boost', function () {
  assert.strictEqual(calculateXpReward(1.0, { comboBoost: 2 }), 20);
  assert.strictEqual(calculateXpReward(2.0, { comboBoost: 3 }), 60);
});

check('T11 XP reward: score multiplier', function () {
  assert.strictEqual(calculateXpReward(1.0, { scoreMult: 1.5 }), 15);
  assert.strictEqual(calculateXpReward(2.0, { scoreMult: 2.0 }), 40);
});

check('T12 XP reward: combined fever + combo_boost + score_mult', function () {
  assert.strictEqual(calculateXpReward(2.0, { fever: true, comboBoost: 2, scoreMult: 1.5 }), 120);
});

// ---- Gold reward (game_init.py:380-386) ----
check('T13 gold reward: lesson mode', function () {
  assert.strictEqual(calculateGoldReward('lesson', 0, 0), 20);
  assert.strictEqual(calculateGoldReward('lesson', 10, 0), 25);
  assert.strictEqual(calculateGoldReward('lesson', 0, 50), 25);
  assert.strictEqual(calculateGoldReward('lesson', 100, 80), 78);
});

check('T14 gold reward: all modes', function () {
  assert.strictEqual(calculateGoldReward('time_attack', 0, 0), 25);
  assert.strictEqual(calculateGoldReward('daily', 0, 0), 18);
  assert.strictEqual(calculateGoldReward('mock_exam', 0, 0), 30);
  assert.strictEqual(calculateGoldReward('achievement', 0, 0), 12);
  assert.strictEqual(calculateGoldReward('other', 0, 0), 10);
  assert.strictEqual(calculateGoldReward('unknown', 0, 0), 10);
});

check('T15 gold reward: negative score/accuracy clamped', function () {
  assert.strictEqual(calculateGoldReward('lesson', -10, -5), 20);
});

// ---- GameManager integration ----

// ---- GameManager integration ----
check('T16 GameManager: onCorrect updates score, xp, combo', function () {
  const gm = new GameManager();
  const r1 = gm.onCorrect();
  assert.strictEqual(r1.scoreGained, 30);  // int(20 * 1.5) = 30
  assert.strictEqual(r1.xpGained, 15);     // int(10 * 1.5) = 15
  assert.strictEqual(r1.comboStreak, 1);
  assert.strictEqual(r1.comboMultiplier, 1.5);
  assert.strictEqual(gm.score, 30);
  assert.strictEqual(gm.correctCount, 1);
});

check('T17 GameManager: combo builds over multiple correct', function () {
  const gm = new GameManager();
  gm.onCorrect(); // streak=1, mult=1.5
  gm.onCorrect(); // streak=2, mult=1.5
  const r3 = gm.onCorrect(); // streak=3, mult=2.0
  assert.strictEqual(r3.comboMultiplier, 2.0);
  assert.strictEqual(r3.comboStreak, 3);
  assert.strictEqual(r3.scoreGained, 40); // int(20 * 2.0)
});

check('T18 GameManager: onWrong resets combo', function () {
  const gm = new GameManager();
  gm.onCorrect();
  gm.onCorrect();
  gm.onCorrect(); // streak=3, mult=2.0
  const r = gm.onWrong();
  assert.strictEqual(r.comboStreak, 0);
  assert.strictEqual(r.comboMultiplier, 1.0);
});

check('T19 GameManager: advanceQuestion victory at 60%', function () {
  const gm = new GameManager();
  for (let i = 0; i < 9; i++) gm.onCorrect();
  for (let i = 0; i < 6; i++) gm.onWrong();
  let result = { finished: false };
  for (let i = 0; i < 15; i++) {
    result = gm.advanceQuestion();
  }
  assert.strictEqual(result.finished, true);
  assert.strictEqual(result.victory, true);
  assert.strictEqual(result.stats.accuracy, 60);
});

check('T20 GameManager: advanceQuestion defeat below 60%', function () {
  const gm = new GameManager();
  for (let i = 0; i < 8; i++) gm.onCorrect();
  for (let i = 0; i < 7; i++) gm.onWrong();
  let result = { finished: false };
  for (let i = 0; i < 15; i++) {
    result = gm.advanceQuestion();
  }
  assert.strictEqual(result.finished, true);
  assert.strictEqual(result.victory, false);
});

check('T21 GameManager: lives preserved (no lives system in lesson)', function () {
  const gm = new GameManager();
  assert.strictEqual(gm.player.lives, 3);
  gm.onWrong();
  assert.strictEqual(gm.player.lives, 3);
});

check('T22 GameManager: reset clears session', function () {
  const gm = new GameManager();
  gm.onCorrect();
  gm.onCorrect();
  gm.reset();
  assert.strictEqual(gm.score, 0);
  assert.strictEqual(gm.questionCount, 0);
  assert.strictEqual(gm.correctCount, 0);
});

check('T23 GameManager: calculateEndGold adds to player', function () {
  const gm = new GameManager();
  for (let i = 0; i < 10; i++) gm.onCorrect();
  for (let i = 0; i < 5; i++) gm.onWrong();
  const gold = gm.calculateEndGold('lesson');
  assert.strictEqual(gold, calculateGoldReward('lesson', gm.score, (10/15)*100));
  assert.strictEqual(gm.player.gold, gold);
});

check('T24 GameManager: getGameInfo returns all fields', function () {
  const gm = new GameManager();
  const info = gm.getGameInfo();
  assert.strictEqual(info.level, 1);
  assert.strictEqual(info.exp, 0);
  assert.strictEqual(info.gold, 0);
  assert.strictEqual(info.comboStreak, 0);
  assert.strictEqual(info.comboMultiplier, 1.0);
  assert.strictEqual(info.lives, 3);
  assert.strictEqual(info.score, 0);
  assert.strictEqual(info.questionCount, 0);
  assert.strictEqual(info.totalQuestions, 15);
  assert.strictEqual(info.correctCount, 0);
});

check('T25 XP formula: base 10 * level_mult 1.1 * combo 2x * diff 1.2 = 26', function () {
  const xp = calculateXpReward(2.0, { scoreMult: 1.1 * 1.2 });
  assert.strictEqual(xp, 26);
});

console.log('M7-A GameManager: pass=' + pass + ' fail=' + failed);
process.exit(failed ? 1 : 0);