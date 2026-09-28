// M15 placeholder
'use strict';
const assert = require('assert');
const path = require('path');
const WEB = path.join(__dirname, '..');
const qg = require(path.join(WEB, 'js', 'question_generator.js'));
const ad = qg.adaptive_difficulty;

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log('PASS ' + name); pass++; }
  catch (e) { console.log('FAIL ' + name + ' :: ' + e.message); fail++; }
}

function seed(uid, records) {
  records.forEach(function (r) {
    for (let i = 0; i < r.n; i++) ad.update_user_performance(uid, r.ok, r.lesson);
  });
}

check('B3-T01 the collected data is now readable (get_lesson_accuracy)', function () {
  const uid = 'b3acc';
  seed(uid, [{ lesson: 5, ok: false, n: 3 }, { lesson: 5, ok: true, n: 1 },
    { lesson: 7, ok: true, n: 4 }]);
  assert.strictEqual(ad.get_lesson_accuracy(uid, 5), 0.25, 'lesson 5 should be 1/4');
  assert.strictEqual(ad.get_lesson_accuracy(uid, 7), 1, 'lesson 7 should be 4/4');
  assert.strictEqual(ad.get_lesson_accuracy(uid, 9), null, 'unplayed lesson must be null');
  assert.strictEqual(ad.get_lesson_accuracy('nobody', 5), null, 'unknown user must be null');
});

check('B3-T02 get_lesson_breakdown returns attempts weakest-first', function () {
  const uid = 'b3break';
  seed(uid, [{ lesson: 2, ok: true, n: 4 }, { lesson: 3, ok: false, n: 4 },
    { lesson: 4, ok: true, n: 2 }]);
  const rows = ad.get_lesson_breakdown(uid);
  assert.strictEqual(rows.length, 3, 'expected 3 attempted lessons, got ' + rows.length);
  assert.strictEqual(rows[0].lesson_id, 3, 'weakest lesson must come first');
  assert.strictEqual(rows[0].accuracy, 0);
  assert.strictEqual(rows[0].total, 4);
  assert.strictEqual(rows[0].correct, 0);
  // Lessons 2 and 4 both score 1.0, so the tie-break is the lower id.
  assert.strictEqual(rows[1].accuracy, 1);
  assert.strictEqual(rows[2].accuracy, 1);
  assert.ok(rows[1].lesson_id < rows[2].lesson_id,
    'equal accuracy must tie-break on the lower lesson id');
});

check('B3-T03 min_total suppresses lessons with too little evidence', function () {
  const uid = 'b3min';
  seed(uid, [{ lesson: 1, ok: false, n: 1 }, { lesson: 2, ok: false, n: 5 }]);
  const all = ad.get_lesson_breakdown(uid, 1);
  const solid = ad.get_lesson_breakdown(uid, 3);
  assert.strictEqual(all.length, 2);
  assert.strictEqual(solid.length, 1, 'lesson 1 has 1 attempt, must be filtered');
  assert.strictEqual(solid[0].lesson_id, 2);
});

check('B3-T04 get_weak_lessons returns only genuinely weak lessons', function () {
  const uid = 'b3weak';
  seed(uid, [{ lesson: 10, ok: false, n: 4 }, { lesson: 11, ok: true, n: 2 },
    { lesson: 12, ok: true, n: 4 }]);
  const weak = ad.get_weak_lessons(uid);
  assert.strictEqual(weak.length, 1, 'only lesson 10 is below 70%');
  assert.strictEqual(weak[0].lesson_id, 10);
  assert.strictEqual(weak[0].accuracy, 0);
});

check('B3-T04b a strong player gets an empty weak list, not a to-do list', function () {
  const uid = 'b3strong';
  seed(uid, [{ lesson: 20, ok: true, n: 5 }, { lesson: 21, ok: true, n: 4 }]);
  assert.strictEqual(ad.get_weak_lessons(uid).length, 0);
  assert.strictEqual(ad.get_recommendation(uid), null,
    'a player with no weak lesson must get null so UI can praise instead');
});

check('B3-T05 get_recommendation names the weakest lesson', function () {
  const uid = 'b3rec';
  seed(uid, [{ lesson: 30, ok: false, n: 4 }, { lesson: 31, ok: false, n: 2 }]);
  const rec = ad.get_recommendation(uid);
  assert.ok(rec && rec.indexOf('30') >= 0, 'recommendation should name lesson 30: ' + rec);
  assert.ok(rec.indexOf('0%') >= 0, 'recommendation should carry the accuracy: ' + rec);
});

check('B3-T06 limit is honoured', function () {
  const uid = 'b3limit';
  seed(uid, [{ lesson: 41, ok: false, n: 4 }, { lesson: 42, ok: false, n: 4 },
    { lesson: 43, ok: false, n: 4 }, { lesson: 44, ok: false, n: 4 }]);
  assert.strictEqual(ad.get_weak_lessons(uid, { limit: 2 }).length, 2);
  assert.strictEqual(ad.get_weak_lessons(uid, { limit: 4 }).length, 4);
});

check('B3-T07 Desktop parity: get_user_difficulty is unchanged', function () {
  const uid = 'b3parity';
  const fresh = ad.get_user_difficulty('nobody', 1);
  assert.strictEqual(fresh, ad.base_difficulty, 'unknown user must get base difficulty');
  // A mixed record keeps the formula strictly inside (0,1).
  seed(uid, [{ lesson: 1, ok: false, n: 6 }, { lesson: 1, ok: true, n: 4 }]);
  const d1 = ad.get_user_difficulty(uid, 1);
  assert.ok(d1 > 0 && d1 <= 1, 'difficulty must stay in (0,1], got ' + d1);
  const before = d1;
  ad.get_weak_lessons(uid);
  ad.get_lesson_breakdown(uid);
  ad.get_recommendation(uid);
  assert.strictEqual(ad.get_user_difficulty(uid, 1), before,
    'read-only weak-topic queries must not perturb the difficulty formula');
});

// __M15_B3_TAIL__

console.log('M15_WEAK_TOPICS: pass=' + pass + ' fail=' + fail);
process.exit(fail === 0 ? 0 : 1);
