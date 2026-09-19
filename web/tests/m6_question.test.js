'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const QG = require('../js/question_generator.js');
const QuestionGenerator = QG.QuestionGenerator;
const SmartAI = require('../js/smart_ai.js');
const AdaptiveAI_module = require('../js/adaptive_ai.js');
const AdaptiveAI = AdaptiveAI_module.AdaptiveAI;

let failed = 0;
let passed = 0;
function check(name, fn) {
  try {
    fn();
    console.log('PASS  ' + name);
    passed++;
  } catch (err) {
    failed += 1;
    console.error('FAIL  ' + name);
    console.error('      ' + (err && err.stack ? err.stack : err));
  }
}

// ============================================================
// T01-T06: Question object structure for Grades 1-5
// ============================================================
const qg = new QuestionGenerator();

check('T01: Grade 1 generates valid Question', function () {
  const q = qg.generate_question(1, 'lesson_1');
  assert.ok(q, 'Question should not be null');
  assert.strictEqual(typeof q.question_text, 'string');
  assert.ok(q.question_text.length > 0);
  // Python source: correct_answer: str (not number)
  assert.strictEqual(typeof q.correct_answer, 'string');
  assert.ok(q.correct_answer.length > 0, 'correct_answer should not be empty');
  assert.ok(Array.isArray(q.options));
  assert.strictEqual(q.options.length, 4);
  assert.ok(q.options.indexOf(q.correct_answer) >= 0, 'Correct answer in options: ' + JSON.stringify(q.options) + ' ans=' + q.correct_answer);
  // Python Question dataclass has 'hint' field (not 'explanation' — plan was wrong)
  assert.strictEqual(typeof q.hint, 'string');
  // Difficulty: Python uses enum (1=EASY, 2=MEDIUM, 3=HARD), JS port uses same numeric values
  assert.ok([1, 2, 3].indexOf(q.difficulty) >= 0, 'difficulty should be 1/2/3: ' + q.difficulty);
});

check('T02: Grade 2 generates valid Question', function () {
  const q = qg.generate_question(2, 'lesson_1');
  assert.ok(q);
  assert.strictEqual(q.grade, 2);
  assert.strictEqual(q.options.length, 4);
  assert.ok(q.options.indexOf(q.correct_answer) >= 0);
});

check('T03: Grade 3 generates valid Question', function () {
  const q = qg.generate_question(3, 'lesson_1');
  assert.ok(q);
  assert.strictEqual(q.grade, 3);
  assert.strictEqual(q.options.length, 4);
});

check('T04: Grade 4 generates valid Question', function () {
  const q = qg.generate_question(4, 'lesson_1');
  assert.ok(q);
  assert.strictEqual(q.grade, 4);
  assert.strictEqual(q.options.length, 4);
});

check('T05: Grade 5 generates valid Question', function () {
  const q = qg.generate_question(5, 'lesson_1');
  assert.ok(q);
  assert.strictEqual(q.grade, 5);
  assert.strictEqual(q.options.length, 4);
});

check('T06: All options are unique', function () {
  for (let i = 0; i < 10; i++) {
    const q = qg.generate_question(1, 'lesson_1');
    assert.ok(q);
    const unique = new Set(q.options);
    assert.strictEqual(unique.size, q.options.length, 'Options must be unique: ' + JSON.stringify(q.options));
  }
});

// ============================================================
// T07-T09: SmartAI unique question + fallback
// ============================================================
check('T07: SmartAI.generate_unique_question returns tuple', function () {
  // Python returns tuple: [question_text, correct_answer, options, question_type]
  const result = SmartAI.generate_unique_question(1, 'lesson_1');
  assert.ok(result, 'Should return a result');
  assert.strictEqual(result.length, 4, 'Should be a 4-tuple');
  assert.strictEqual(typeof result[0], 'string', 'question_text should be string');
  assert.ok(result[0].length > 0, 'question_text should not be empty');
  assert.strictEqual(typeof result[1], 'string', 'correct_answer should be string');
  assert.ok(Array.isArray(result[2]), 'options should be array');
  assert.strictEqual(result[2].length, 4, 'should have 4 options');
  assert.ok(result[2].indexOf(result[1]) >= 0, 'correct answer in options');
});

check('T08: SmartAI fallback_logic returns tuple for all grades', function () {
  // Python grade_N_logic returns tuple: [text, answer, options, type]
  for (let g = 1; g <= 5; g++) {
    const result = SmartAI._fallback_generate(g, 'lesson_1');
    assert.ok(result, 'Grade ' + g + ' fallback should return result');
    assert.strictEqual(result.length, 4, 'Should be a 4-tuple');
    assert.strictEqual(typeof result[0], 'string');
    assert.ok(result[0].length > 0);
    assert.strictEqual(typeof result[1], 'string');
    assert.ok(Array.isArray(result[2]));
    assert.strictEqual(result[2].length, 4);
  }
});

check('T09: SmartAI distractor count is 3', function () {
  const distractors = SmartAI._distractors('numeric', 50, 3);
  assert.ok(Array.isArray(distractors));
  assert.strictEqual(distractors.length, 3);
  assert.ok(distractors.indexOf(50) < 0, 'Distractors should not contain correct answer');
});

// ============================================================
// T10-T11: Adaptive AI — difficulty adjustment
// ============================================================
check('T10: AdaptiveAI — difficulty increases on high performance', function () {
  const ai = new AdaptiveAI();
  assert.strictEqual(ai.getCurrentDifficulty(), 1);
  
  // Simulate 6 correct answers quickly (should trigger increase after cooldown)
  for (let i = 0; i < 7; i++) {
    ai.processAnswer(true, 2.0, 'lesson_1', 'ARITHMETIC');
  }
  
  assert.ok(ai.getCurrentDifficulty() > 1, 'Difficulty should increase after high performance');
});

check('T11: AdaptiveAI — difficulty decreases on low performance', function () {
  const ai = new AdaptiveAI();
  
  // First increase to level 2
  for (let i = 0; i < 7; i++) {
    ai.processAnswer(true, 2.0, 'lesson_1', 'ARITHMETIC');
  }
  const higherLevel = ai.getCurrentDifficulty();
  assert.ok(higherLevel > 1);
  
  // Now simulate poor performance (60s answer time to bring performance score < 40)
  // Performance score = accuracy*60 + max(0,(30-avgTime)*2); need avgTime>30 to eliminate time bonus
  for (let i = 0; i < 7; i++) {
    ai.processAnswer(false, 60.0, 'lesson_1', 'ARITHMETIC');
  }
  
  assert.ok(ai.getCurrentDifficulty() < higherLevel, 'Difficulty should decrease after poor performance');
});

// ============================================================
// Summary
// ============================================================
console.log('\n' + passed + '/' + (passed + failed) + ' tests passed');

if (failed) {
  console.error(failed + ' test(s) failed');
  process.exit(1);
}
console.log('All M6-A tests passed.');
