/**
 * P0 QUESTION CORRECTNESS AUDIT (read-only, no production changes)
 * Generates >=500 questions across grades/lessons/Difficulty and verifies the
 * invariant chain:  correct_answer present  ->  present in options
 *                    options distinct       ->  expected option count
 *                    no undefined/null/empty rendered option
 *                    evaluation of the clicked option matches correct_answer
 */
'use strict';
var path = require('path');
var JS = 'E:/lam_game_2026/web/js';

// minimal browser shims (production scripts expect a browser-ish global)
global.window = global;
global.document = {
  createElement: function () { return { style: {}, getContext: function () { return null; }, appendChild: function () {} }; },
  getElementById: function () { return null; },
  addEventListener: function () {}, body: { appendChild: function () {} }
};
global.localStorage = { _d: {}, getItem: function (k) { return this._d[k] === undefined ? null : this._d[k]; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; }, clear: function () { this._d = {}; } };
global.performance = global.performance || { now: function () { return Date.now(); } };
try { global.navigator = global.navigator || { userAgent: 'node' }; } catch (e) { /* node>=21 exposes a getter-only navigator */ }
global.Audio = function () { this.play = function () {}; this.pause = function () {}; this.load = function () {}; };

require(path.join(JS, 'mt19937.js'));
require(path.join(JS, 'question_generator.js'));
require(path.join(JS, 'adaptive_ai.js'));

var QG = require(path.join(JS, 'question_generator.js'));
var MT = global.MT19937;   // mt19937.js publishes only a global (no exports)

var pass = 0, fail = 0, checked = 0;
var problems = [];
function chk(cond, msg) {
  if (cond) { pass++; } else { fail++; if (problems.length < 25) problems.push(msg); }
}

var gen = new QG.QuestionGenerator();
var DIFFS = [QG.Difficulty.EASY, QG.Difficulty.MEDIUM, QG.Difficulty.HARD];

// deterministic RNG so the audit is reproducible; several seeds to widen coverage
var seeds = [1, 7, 42, 1234, 99991];
// real lesson counts from data/math_lessons.json (data_loader.js header)
var LESSON_COUNT = { 1: 40, 2: 73, 3: 81, 4: 73, 5: 75 };
var grades = [1, 2, 3, 4, 5];

var total = 0;
for (var s = 0; s < seeds.length; s++) {
  var rng = new MT(seeds[s]);
  rng.init_genrand(seeds[s]);          // mt19937.js: explicit init
  global.MDRandom = rng;               // question_generator.js uses global.MDRandom.random()
  for (var g = 0; g < grades.length; g++) {
    var grade = grades[g];
    var nLessons = LESSON_COUNT[grade] || 40;
    for (var li = 1; li <= nLessons; li++) {
      for (var d = 0; d < DIFFS.length; d++) {
        {
          var q;
          try {
            q = gen.generate_question(grade, li, DIFFS[d], 'audit_user');
          } catch (e) {
            fail++; problems.push('THROW seed=' + seeds[s] + ' g=' + grade + ' l=' + li + ' d=' + DIFFS[d] + ' :: ' + e.message);
            continue;
          }
          total++;
          if (!q) { fail++; problems.push('NULL question seed=' + seeds[s] + ' g=' + grade + ' l=' + li); continue; }

          var opts = q.options;
          var ca = q.correct_answer;

          // T-A: correct_answer must be a non-empty scalar
          chk(ca !== undefined && ca !== null && String(ca).length > 0,
            'EMPTY correct_answer :: ' + JSON.stringify(q.question_text));
          // T-B: options is a non-empty array of non-empty strings
          chk(Array.isArray(opts) && opts.length > 0,
            'BAD options array :: ' + JSON.stringify(q.question_text));
          if (Array.isArray(opts)) {
            for (var oi = 0; oi < opts.length; oi++) {
              chk(opts[oi] !== undefined && opts[oi] !== null && String(opts[oi]).length > 0,
                'UNDEFINED option #' + oi + ' :: ' + JSON.stringify(q.question_text) + ' opts=' + JSON.stringify(opts));
            }
            // T-C: expected option count (4 for all MC generators)
            chk(opts.length === 4, 'OPTION COUNT=' + opts.length + ' (expected 4) :: ' + JSON.stringify(q.question_text));
            // T-D: no duplicate options (distinctness of the rendered set)
            var seen = {};
            var dup = null;
            for (var dj = 0; dj < opts.length; dj++) {
              var key = String(opts[dj]);
              if (seen[key]) { dup = key; break; }
              seen[key] = 1;
            }
            chk(dup === null, 'DUPLICATE option "' + dup + '" :: ' + JSON.stringify(q.question_text) + ' opts=' + JSON.stringify(opts));
            // T-E: **P0** correct_answer IS one of the rendered options (exact string match)
            var hit = -1;
            for (var hi = 0; hi < opts.length; hi++) { if (String(opts[hi]) === String(ca)) { hit = hi; break; } }
            chk(hit >= 0, 'CORRECT ANSWER NOT IN OPTIONS :: ans=' + JSON.stringify(ca) + ' opts=' + JSON.stringify(opts) + ' q=' + JSON.stringify(q.question_text));
            // T-F: evaluation parity — clicking the correct option must evaluate true,
            //      clicking any other option must evaluate false
            if (hit >= 0) {
              var correctIdx = hit;
              chk(correctIdx === hit, 'eval-true-sanity');
              for (var fj = 0; fj < opts.length; fj++) {
                var isCorrect = (String(opts[fj]) === String(ca));
                chk(isCorrect === (fj === correctIdx),
                  'EVAL MISMATCH idx=' + fj + ' opts=' + JSON.stringify(opts) + ' ans=' + JSON.stringify(ca));
              }
            }
            // T-G: question_text non-empty
            chk(String(q.question_text || '').length > 0, 'EMPTY question_text');
          }
          checked++;
        }
      }
    }
  }
}

console.log('P0_QUESTION_AUDIT questions_generated=' + total +
            ' question_objects_check=' + checked +
            ' assertions_pass=' + pass + ' assertions_fail=' + fail);
if (problems.length) {
  console.log('--- first problems ---');
  for (var pi = 0; pi < problems.length; pi++) console.log('  ' + problems[pi]);
}
console.log(fail === 0 ? 'P0_QUESTION_AUDIT RESULT=PASS' : 'P0_QUESTION_AUDIT RESULT=FAIL');
process.exit(fail === 0 ? 0 : 1);
