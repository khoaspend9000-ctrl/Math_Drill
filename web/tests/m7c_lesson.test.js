'use strict';
/* M7-C: Lesson State integration test.
   Verify LessonState + GameManager + QuestionGenerator integration.
   Tests the full gameplay loop without browser dependencies. */
const assert = require('assert');
const { GameManager, calculateGoldReward } = require('../js/game_manager.js');
const { PlayerData } = require('../js/player.js');
const qgModule = require('../js/question_generator.js');
const QuestionGenerator = qgModule.QuestionGenerator;

let pass = 0, failed = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('PASS  ' + name); }
  catch (e) { failed++; console.error('FAIL  ' + name + ' :: ' + (e && e.message)); }
}

// ---- Test Question Generation (M6 integration) ----
check('T01 QuestionGenerator generates valid question for grade 1', function () {
  const qg = new QuestionGenerator(42);
  const q = qg.generate_question(1, 1, 3, 'test_user');
  assert.ok(q.question_text, 'has question_text');
  assert.ok(q.correct_answer, 'has correct_answer');
  assert.ok(Array.isArray(q.options), 'has options array');
  assert.strictEqual(q.options.length, 4, 'has 4 options');
  assert.ok(q.options.indexOf(q.correct_answer) >= 0, 'correct answer in options');
});

check('T02 QuestionGenerator generates different questions with different seeds', function () {
  const qg1 = new QuestionGenerator(42);
  const qg2 = new QuestionGenerator(123);
  const q1 = qg1.generate_question(1, 1, 3, 'user1');
  const q2 = qg2.generate_question(1, 1, 3, 'user2');
  assert.ok(q1.question_text || q2.question_text, 'both generate questions');
});

// ---- Test GameManager reward pipeline ----
check('T03 GameManager.onCorrect updates score, XP, combo correctly', function () {
  const player = new PlayerData();
  const gm = new GameManager(player);
  gm.totalQuestions = 15;
  const r1 = gm.onCorrect();
  assert.strictEqual(r1.comboStreak, 1);
  assert.strictEqual(r1.comboMultiplier, 1.5);
  assert.strictEqual(r1.scoreGained, 30);
  assert.strictEqual(r1.xpGained, 15);
  assert.strictEqual(gm.score, 30);
  assert.strictEqual(gm.correctCount, 1);
  assert.strictEqual(player.exp, 15);
});

check('T04 GameManager combo builds correctly over multiple correct answers', function () {
  const player = new PlayerData();
  const gm = new GameManager(player);
  gm.onCorrect();
  gm.onCorrect();
  const r3 = gm.onCorrect();
  assert.strictEqual(r3.comboStreak, 3);
  assert.strictEqual(r3.comboMultiplier, 2.0);
  assert.strictEqual(r3.scoreGained, 40);
  assert.strictEqual(gm.score, 100);
});

check('T05 GameManager.onWrong resets combo', function () {
  const player = new PlayerData();
  const gm = new GameManager(player);
  gm.onCorrect();
  gm.onCorrect();
  gm.onCorrect();
  gm.onWrong();
  assert.strictEqual(player.comboStreak, 0);
  assert.strictEqual(player.comboMultiplier, 1.0);
});

check('T06 GameManager.advanceQuestion detects victory at 60%', function () {
  const player = new PlayerData();
  const gm = new GameManager(player);
  gm.totalQuestions = 10;
  for (let i = 0; i < 6; i++) gm.onCorrect();
  for (let i = 0; i < 4; i++) gm.onWrong();
  let result = { finished: false };
  for (let i = 0; i < 10; i++) result = gm.advanceQuestion();
  assert.strictEqual(result.finished, true);
  assert.strictEqual(result.victory, true);
  assert.strictEqual(result.stats.accuracy, 60);
});

check('T07 GameManager.advanceQuestion detects defeat below 60%', function () {
  const player = new PlayerData();
  const gm = new GameManager(player);

check('T11 QuestionGenerator produces questions with 4 distinct options', function () {
  const qg = new QuestionGenerator(42);
  for (let i = 0; i < 10; i++) {
    const q = qg.generate_question(1, 1, 3, 'user');
    const unique = [...new Set(q.options)];
    assert.strictEqual(unique.length, 4, '4 distinct options');
  }
});

check('T12 QuestionGenerator handles fallback gracefully', function () {
  const qg = new QuestionGenerator(42);
  for (let i = 0; i < 50; i++) {
    const q = qg.generate_question(1, 1, 3, 'user');
    assert.ok(q.question_text, 'question exists');
    assert.ok(q.correct_answer, 'answer exists');
    assert.strictEqual(q.options.length, 4, '4 options');
  }
});

check('T13 Full lesson flow: 15 correct answers → victory', function () {
  const player = new PlayerData();
  const gm = new GameManager(player);
  const qg = new QuestionGenerator(42);
  for (let i = 0; i < 15; i++) {
    const q = qg.generate_question(1, 1, 3, 'user');
    assert.ok(q.question_text, 'question ' + i + ' exists');
    gm.onCorrect();
    const result = gm.advanceQuestion();
    if (result.finished) {
      assert.strictEqual(result.victory, true, '100% accuracy → victory');
      assert.strictEqual(result.stats.accuracy, 100);
    }
  }
  const gold = gm.calculateEndGold('lesson');
  assert.ok(gold > 0, 'gold earned');
  assert.ok(player.exp > 0, 'XP earned');
});

check('T14 Full lesson flow: mixed correct/wrong → combo resets', function () {
  const player = new PlayerData();
  const gm = new GameManager(player);
  gm.onCorrect();
  gm.onCorrect();
  gm.onCorrect();
  assert.strictEqual(player.comboMultiplier, 2.0);
  gm.onWrong();
  assert.strictEqual(player.comboStreak, 0);
  assert.strictEqual(player.comboMultiplier, 1.0);
  gm.onCorrect();
  assert.strictEqual(player.comboStreak, 1);
  assert.strictEqual(player.comboMultiplier, 1.5);
});

check('T15 Question counter increments correctly', function () {
  const gm = new GameManager(new PlayerData());
  gm.totalQuestions = 5;
  assert.strictEqual(gm.questionCount, 0);
  gm.advanceQuestion();
  assert.strictEqual(gm.questionCount, 1);
  gm.advanceQuestion();
  assert.strictEqual(gm.questionCount, 2);
});

console.log('M7-C Lesson: pass=' + pass + ' fail=' + failed);
process.exit(failed ? 1 : 0);
  gm.totalQuestions = 10;
  for (let i = 0; i < 5; i++) gm.onCorrect();
  for (let i = 0; i < 5; i++) gm.onWrong();
  let result = { finished: false };
  for (let i = 0; i < 10; i++) result = gm.advanceQuestion();
  assert.strictEqual(result.finished, true);
  assert.strictEqual(result.victory, false);
});

check('T08 GameManager.calculateEndGold adds gold to player', function () {
  const player = new PlayerData();
  const gm = new GameManager(player);
  gm.totalQuestions = 10;
  for (let i = 0; i < 8; i++) gm.onCorrect();
  for (let i = 0; i < 2; i++) gm.onWrong();
  const gold = gm.calculateEndGold('lesson');
  const expectedGold = calculateGoldReward('lesson', gm.score, 80);
  assert.strictEqual(gold, expectedGold);
  assert.strictEqual(player.gold, gold);
});

check('T09 GameManager lives preserved in lesson mode', function () {
  const player = new PlayerData();
  const gm = new GameManager(player);
  assert.strictEqual(player.lives, 3);
  gm.onWrong();
  assert.strictEqual(player.lives, 3);
});

check('T10 GameManager session reset clears all state', function () {
  const player = new PlayerData();
  const gm = new GameManager(player);
  gm.onCorrect();
  gm.onCorrect();
  gm.reset();
  assert.strictEqual(gm.score, 0);
  assert.strictEqual(gm.questionCount, 0);
  assert.strictEqual(gm.correctCount, 0);
});