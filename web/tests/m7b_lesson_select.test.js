'use strict';
/* M7-B: Lesson Select tests.
   Verify data loading, unlock rules, grade selection. */
const assert = require('assert');
const {
  getLessonsForGrade,
  isLessonUnlocked,
  getUnlockedCount
} = require('../js/data_loader.js');

let pass = 0, failed = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('PASS  ' + name); }
  catch (e) { failed++; console.error('FAIL  ' + name + ' :: ' + (e && e.message)); }
}

// ---- Unlock rules (main.py: (level-1)//6 + 1) ----
check('T01 unlock count: level 1 → 1 lesson', function () {
  assert.strictEqual(getUnlockedCount(1), 1);
});

check('T02 unlock count: level 6 → 1 lesson', function () {
  assert.strictEqual(getUnlockedCount(6), 1);
});

check('T03 unlock count: level 7 → 2 lessons', function () {
  assert.strictEqual(getUnlockedCount(7), 2);
});

check('T04 unlock count: level 12 → 2 lessons', function () {
  assert.strictEqual(getUnlockedCount(12), 2);
});

check('T05 unlock count: level 13 → 3 lessons', function () {
  assert.strictEqual(getUnlockedCount(13), 3);
});

check('T06 isLessonUnlocked: level 1, lesson 1 unlocked', function () {
  assert.strictEqual(isLessonUnlocked(0, 1), true);
});

check('T07 isLessonUnlocked: level 1, lesson 2 locked', function () {
  assert.strictEqual(isLessonUnlocked(1, 1), false);
});

check('T08 isLessonUnlocked: level 7, lesson 2 unlocked', function () {
  assert.strictEqual(isLessonUnlocked(1, 7), true);
});

check('T09 isLessonUnlocked: level 7, lesson 3 locked', function () {
  assert.strictEqual(isLessonUnlocked(2, 7), false);
});

// ---- Data loading (math_lessons.json) ----
check('T10 getLessonsForGrade(1) returns 40 lessons', function () {
  return getLessonsForGrade(1).then(function (lessons) {
    assert.strictEqual(lessons.length, 40);
    assert.ok(lessons[0].title.indexOf('Bài 1') >= 0);
  });
});

check('T11 getLessonsForGrade(2) returns 73 lessons', function () {
  return getLessonsForGrade(2).then(function (lessons) {
    assert.strictEqual(lessons.length, 73);
  });
});

check('T12 getLessonsForGrade(3) returns 81 lessons', function () {
  return getLessonsForGrade(3).then(function (lessons) {
    assert.strictEqual(lessons.length, 81);
  });
});

check('T13 getLessonsForGrade(4) returns 73 lessons', function () {
  return getLessonsForGrade(4).then(function (lessons) {
    assert.strictEqual(lessons.length, 73);
  });
});

check('T14 getLessonsForGrade(5) returns 75 lessons', function () {
  return getLessonsForGrade(5).then(function (lessons) {
    assert.strictEqual(lessons.length, 75);
  });
});

check('T15 lesson has required fields', function () {
  return getLessonsForGrade(1).then(function (lessons) {
    var l = lessons[0];
    assert.ok(l.id, 'has id');
    assert.ok(l.title, 'has title');
    assert.ok(l.template, 'has template');
  });
});

check('T16 lessons sorted by id', function () {
  return getLessonsForGrade(1).then(function (lessons) {
    for (var i = 1; i < lessons.length; i++) {
      assert.ok(lessons[i].id > lessons[i-1].id, 'lessons sorted by id');
    }
  });
});

console.log('M7-B LessonSelect: pass=' + pass + ' fail=' + failed);
process.exit(failed ? 1 : 0);
