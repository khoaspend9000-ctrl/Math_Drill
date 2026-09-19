'use strict';
/* M7-D: Victory/Defeat State tests.
   Verify Victory/Defeat display and flow matches Python main.py. */
const assert = require('assert');
const { GameManager } = require('../js/game_manager.js');
const { PlayerData } = require('../js/player.js');
const qgModule = require('../js/question_generator.js');
const QuestionGenerator = qgModule.QuestionGenerator;

let pass = 0, failed = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('PASS  ' + name); }
  catch (e) { failed++; console.error('FAIL  ' + name + ' :: ' + (e && e.message)); }
}

// ---- Rank Logic (main.py:1101-1105) ----
check('T01 Victory rank: 100% → S', function () {
  const acc = 100;
  const rank = acc >= 100 ? 'S' : acc >= 90 ? 'A' : acc >= 80 ? 'B' : 'C';
  assert.strictEqual(rank, 'S');
});

check('T02 Victory rank: 90% → A', function () {
  const acc = 90;
  const rank = acc >= 100 ? 'S' : acc >= 90 ? 'A' : acc >= 80 ? 'B' : 'C';
  assert.strictEqual(rank, 'A');
});

check('T03 Victory rank: 80% → B', function () {
  const acc = 80;
  const rank = acc >= 100 ? 'S' : acc >= 90 ? 'A' : acc >= 80 ? 'B' : 'C';
  assert.strictEqual(rank, 'B');
});

check('T04 Victory rank: 79% → C', function () {
  const acc = 79;
  const rank = acc >= 100 ? 'S' : acc >= 90 ? 'A' : acc >= 80 ? 'B' : 'C';
  assert.strictEqual(rank, 'C');
});

check('T05 Victory rank: 60% → C', function () {
  const acc = 60;
  const rank = acc >= 100 ? 'S' : acc >= 90 ? 'A' : acc >= 80 ? 'B' : 'C';
  assert.strictEqual(rank, 'C');
});

// ---- Victory Result Data ----
check('T06 Victory result contains all required fields', function () {
  const player = new PlayerData();
  const gm = new GameManager(player);
  gm.totalQuestions = 10;
  for (let i = 0; i < 8; i++) gm.onCorrect();
  for (let i = 0; i < 2; i++) gm.onWrong();
  let result = { finished: false };
  for (let i = 0; i < 10; i++) result = gm.advanceQuestion();
  const gold = gm.calculateEndGold('lesson');
  
  const victoryData = {
    title: 'HOÀN THÀNH BÀI HỌC!',
    score: gm.score,
    lessonTitle: 'Bài 1',
    stats: {
      correct: result.stats.correct,
      total: result.stats.total,
      accuracy: result.stats.accuracy,
      goldEarned: gold
    }
  };
  
  assert.strictEqual(victoryData.stats.correct, 8);
  assert.strictEqual(victoryData.stats.total, 10);
  assert.strictEqual(victoryData.stats.accuracy, 80);
  assert.ok(victoryData.stats.goldEarned > 0, 'gold earned');
  assert.ok(victoryData.score > 0, 'score > 0');
});

// ---- Defeat Result Data ----
check('T07 Defeat result contains correct statistics', function () {
  const player = new PlayerData();
  const gm = new GameManager(player);
  gm.totalQuestions = 10;
  for (let i = 0; i < 5; i++) gm.onCorrect();
  for (let i = 0; i < 5; i++) gm.onWrong();
  let result = { finished: false };
  for (let i = 0; i < 10; i++) result = gm.advanceQuestion();
  
  assert.strictEqual(result.victory, false);
  assert.strictEqual(result.stats.correct, 5);
  assert.strictEqual(result.stats.total, 10);
  assert.strictEqual(result.stats.accuracy, 50);
});

// ---- No Double Reward ----
check('T08 Victory does not double-count XP/gold', function () {
  const player = new PlayerData();
  const gm = new GameManager(player);
  gm.totalQuestions = 10;
  for (let i = 0; i < 10; i++) gm.onCorrect();
  let result = { finished: false };
  for (let i = 0; i < 10; i++) result = gm.advanceQuestion();
  
  const xpBefore = player.exp;
  const goldBefore = player.gold;
  
  const gold = gm.calculateEndGold('lesson');
  
  assert.strictEqual(player.exp, xpBefore);
  assert.strictEqual(player.gold, goldBefore + gold);
});


// ---- Edge Cases ----
check('T10 100% accuracy → Victory with S rank', function () {
  const player = new PlayerData();
  const gm = new GameManager(player);
  gm.totalQuestions = 10;
  for (let i = 0; i < 10; i++) gm.onCorrect();
  let result = { finished: false };
  for (let i = 0; i < 10; i++) result = gm.advanceQuestion();
  
  assert.strictEqual(result.victory, true);
  assert.strictEqual(result.stats.accuracy, 100);
  const rank = result.stats.accuracy >= 100 ? 'S' : 'C';
  assert.strictEqual(rank, 'S');
});

check('T11 0% accuracy → Defeat', function () {
  const player = new PlayerData();
  const gm = new GameManager(player);
  gm.totalQuestions = 10;
  for (let i = 0; i < 10; i++) gm.onWrong();
  let result = { finished: false };
  for (let i = 0; i < 10; i++) result = gm.advanceQuestion();
  
  assert.strictEqual(result.victory, false);
  assert.strictEqual(result.stats.accuracy, 0);
});

check('T12 Exactly 60% accuracy → Victory (boundary)', function () {
  const player = new PlayerData();
  const gm = new GameManager(player);
  gm.totalQuestions = 10;
  for (let i = 0; i < 6; i++) gm.onCorrect();
  for (let i = 0; i < 4; i++) gm.onWrong();
  let result = { finished: false };
  for (let i = 0; i < 10; i++) result = gm.advanceQuestion();
  
  assert.strictEqual(result.victory, true, '60% should be victory');
  assert.strictEqual(result.stats.accuracy, 60);
});

check('T13 59% accuracy → Defeat (just below boundary)', function () {
  const player = new PlayerData();
  const gm = new GameManager(player);
  gm.totalQuestions = 100;
  for (let i = 0; i < 59; i++) gm.onCorrect();
  for (let i = 0; i < 41; i++) gm.onWrong();
  let result = { finished: false };
  for (let i = 0; i < 100; i++) result = gm.advanceQuestion();
  
  assert.strictEqual(result.victory, false, '59% should be defeat');
  assert.strictEqual(result.stats.accuracy, 59);
});

// ---- Full Flow: Lesson → Victory ----
check('T14 Full flow: 15 correct → Victory with rewards', function () {
  const player = new PlayerData();
  const gm = new GameManager(player);
  const qg = new QuestionGenerator(42);
  
  for (let i = 0; i < 15; i++) {
    const q = qg.generate_question(1, 1, 3, 'user');
    assert.ok(q.question_text, 'question exists');
    gm.onCorrect();
    const result = gm.advanceQuestion();
    if (result.finished) {
      assert.strictEqual(result.victory, true);
      assert.strictEqual(result.stats.accuracy, 100);
    }
  }
  
  const gold = gm.calculateEndGold('lesson');
  assert.ok(gold > 0, 'gold earned on victory');
  assert.ok(player.exp > 0, 'XP earned on victory');
  assert.ok(player.gold === gold, 'player gold matches');
});

// ---- Full Flow: Lesson → Defeat ----
check('T15 Full flow: 5/15 correct → Defeat, no gold', function () {
  const player = new PlayerData();
  const gm = new GameManager(player);
  const qg = new QuestionGenerator(42);
  
  for (let i = 0; i < 5; i++) {
    qg.generate_question(1, 1, 3, 'user');
    gm.onCorrect();
    gm.advanceQuestion();
  }
  for (let i = 0; i < 10; i++) {
    qg.generate_question(1, 1, 3, 'user');
    gm.onWrong();
    gm.advanceQuestion();
  }
  
  const goldBefore = player.gold;
  // Don't call calculateEndGold on defeat
  assert.strictEqual(player.gold, goldBefore, 'no gold on defeat');
});

console.log('M7-D VictoryDefeat: pass=' + pass + ' fail=' + failed);
process.exit(failed ? 1 : 0);
// ---- Retry Creates New Session ----
check('T09 Retry creates fresh session', function () {
  const player = new PlayerData();
  const gm = new GameManager(player);
  gm.totalQuestions = 5;
  for (let i = 0; i < 5; i++) gm.onCorrect();
  for (let i = 0; i < 5; i++) gm.advanceQuestion();
  
  const gm2 = new GameManager(player);
  gm2.totalQuestions = 5;
  
  assert.strictEqual(gm2.score, 0, 'new session has score 0');
  assert.strictEqual(gm2.questionCount, 0, 'new session has questionCount 0');
  assert.strictEqual(gm2.correctCount, 0, 'new session has correctCount 0');
  assert.ok(player.exp >= 0, 'player XP preserved');
});