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

// M14-D2: locked-lesson required-level helper (display-only, gating unchanged).
check('T17 requiredLevelForLesson lesson 1 needs level 1', function () {
  var dl = require('../js/data_loader.js');
  assert.strictEqual(dl.requiredLevelForLesson(0), 1);
});
check('T18 requiredLevelForLesson lesson 2 needs level 7', function () {
  var dl = require('../js/data_loader.js');
  assert.strictEqual(dl.requiredLevelForLesson(1), 7);
});
check('T19 requiredLevelForLesson Grade3 79 80 81 need 469 475 481', function () {
  var dl = require('../js/data_loader.js');
  assert.strictEqual(dl.requiredLevelForLesson(78), 469);
  assert.strictEqual(dl.requiredLevelForLesson(79), 475);
  assert.strictEqual(dl.requiredLevelForLesson(80), 481);
});
check('T20 gating unchanged lesson 79 locked at 468 open at 469', function () {
  assert.strictEqual(isLessonUnlocked(78, 468), false);
  assert.strictEqual(isLessonUnlocked(78, 469), true);
});

/* ---- M14-D2: the locked-lesson LABEL actually renders the required level ----
   The helper alone is not enough; this drives the real LessonSelectState.draw()
   with a recording renderer and asserts the user-facing string. */
var path = require('path');
var JS = path.join(__dirname, '..', 'js');
/* states_real.js extends BaseState from state_manager.js, which needs the
   transition effect + the M5/M9 modules loaded first (same preload order the
   m4_states / final_qa harnesses use). */
require(path.join(JS, 'save.js'));
require(path.join(JS, 'player.js'));
require(path.join(JS, 'shop.js'));
require(path.join(JS, 'pet.js'));
require(path.join(JS, 'skin.js'));
require(path.join(JS, 'gacha.js'));
require(path.join(JS, 'achievements.js'));
require(path.join(JS, 'daily.js'));
require(path.join(JS, 'skill_tree.js'));
global.TransitionEffect = global.TransitionEffect || class {
  constructor() { this.effect_type = 'fade'; this.active = false; this.onMidpoint = null; }
  start() { this.active = true; }
  update(dt) { if (this.active && dt > 0.4) this.active = false; }
  draw() {}
};
/* state_manager.js installs global.BaseState, which states_real.js extends. */
require(path.join(JS, 'state_manager.js'));
var statesReal = require(path.join(JS, 'states_real.js'));

function makeRecordingGame(level, grade) {
  var texts = [];
  global.Game = {
    renderer: {
      clear: function () {}, fillRoundRect: function () {},
      text: function (s) { texts.push(String(s)); },
      roundRect: function () {}
    },
    player: { level: level, grade: grade, exp: 0, gold: 0 },
    states: { change: function () {} },
    audio: { playSfx: function () { return false; } },
    assets: { get: function () { return null; } },
    engine: { WIDTH: 1300, HEIGHT: 800 }
  };
  return texts;
}
function drawLessonSelectPage(level, grade, page, titlePrefix) {
  var texts = makeRecordingGame(level, grade);
  var s = new statesReal.LessonSelectState();
  s.grade = grade;
  s.lessons = [];
  s.lessonIds = [];
  for (var i = 0; i < 81; i++) {
    s.lessons.push(titlePrefix + (i + 1) + '. On tap hoc ky');
    s.lessonIds.push(i + 1);
  }
  s.totalPages = Math.ceil(81 / s.itemsPerPage);
  s.currentPage = page;
  s.loading = false;
  s.dataMissing = false;
  s.draw(null, 1300, 800);
  return texts;
}

check('T21 locked lesson label shows the exact required level (G3 L79 -> Lv469)', function () {
  // level 1 => only lesson 1 unlocked; page 9 (0-based) starts at lesson 73.
  var texts = drawLessonSelectPage(1, 3, 9, 'Bai');
  var found = texts.filter(function (t) { return t.indexOf('Lv469') >= 0; });
  assert.strictEqual(found.length, 1, 'expected exactly one Lv469 label, got ' + JSON.stringify(found));
});

check('T22 locked lesson label still carries the padlock affordance', function () {
  var texts = drawLessonSelectPage(1, 3, 9, 'Bai');
  var locked = texts.filter(function (t) { return t.indexOf('\u{1F512}') >= 0; });
  assert.strictEqual(locked.length, 8, 'all 8 tiles on the locked page must be padlocked, got ' + locked.length);
});

check('T23 required level matches formula for every locked tile on page 9', function () {
  var dl = require('../js/data_loader.js');
  var texts = drawLessonSelectPage(1, 3, 9, 'Bai');
  for (var idx = 72; idx < 80; idx++) {
    var need = dl.requiredLevelForLesson(idx);
    var hit = texts.some(function (t) { return t.indexOf('Lv' + need) >= 0; });
    assert.ok(hit, 'tile for lesson ' + (idx + 1) + ' must show Lv' + need);
  }
});

check('T24 unlocked lesson label has NO lock marker and NO level prefix', function () {
  var texts = drawLessonSelectPage(1, 3, 0, 'Bai');
  var first = texts.filter(function (t) { return t.indexOf('Bai1') >= 0 || t.indexOf('Bài 1') >= 0; });
  assert.ok(first.length >= 1, 'lesson 1 label must render');
  assert.ok(first[0].indexOf('Lv') < 0, 'unlocked lesson must not be prefixed with Lv: ' + first[0]);
});

check('T25 a player at level 469 sees lesson 79 unlocked (no padlock on page 9 tile 7)', function () {
  var dl = require('../js/data_loader.js');
  assert.strictEqual(dl.isLessonUnlocked(78, 469), true);
  var texts = drawLessonSelectPage(469, 3, 9, 'Bai');
  var tile = texts.filter(function (t) { return t.indexOf('Lv475') >= 0; });
  assert.strictEqual(tile.length, 1, 'lesson 80 still locked at level 469 -> Lv475 shown');
  assert.ok(texts.every(function (t) { return t.indexOf('Lv469') < 0; }),
    'lesson 79 is unlocked at level 469 and must not show the locked label');
});

/* ---- M14-C1: theory lookup must not silently fall back to the placeholder ----
   theory_pages.js comes from math_theory.json; its titles are often more specific
   than the math_lessons.json titles, so an exact-title lookup missed 273 of 342
   lessons. The lesson number is the key both files share. */
var LESSONS_JSON = require(path.join(JS, '..', 'data', 'math_lessons.json'));
var theoryFactory = require(path.join(JS, 'theory_pages.js'));
var THEORY = typeof theoryFactory === 'function' ? theoryFactory() : theoryFactory;
var GRADE_KEY = { grade_1: 1, grade_2: 2, grade_3: 3, grade_4: 4, grade_5: 5 };

function makeTheoryGame() {
  global.Game = {
    renderer: { clear: function () {}, fillRoundRect: function () {}, text: function () {} },
    player: { level: 1, grade: 3, exp: 0, gold: 0 },
    states: { change: function () {} },
    audio: { playSfx: function () { return false; } },
    assets: { get: function () { return null; } },
    engine: { WIDTH: 1300, HEIGHT: 800 }
  };
}

check('T26 theory resolves for EVERY lesson in EVERY grade (no placeholder)', function () {
  var missing = [];
  Object.keys(LESSONS_JSON).forEach(function (gk) {
    var grade = GRADE_KEY[gk];
    var pages = THEORY[grade] || [];
    var lessons = Object.keys(LESSONS_JSON[gk]).sort(function (a, b) { return Number(a) - Number(b); });
    lessons.forEach(function (id) {
      var title = LESSONS_JSON[gk][id].title;
      var num = Number(id);
      makeTheoryGame();
      var s = new statesReal.TheoryState();
      s.enter({ grade: grade, title: title, lessonId: num });
      if (!s.theoryFound) missing.push(gk + '#' + id);
    });
  });
  assert.strictEqual(missing.length, 0,
    'theory missing for ' + missing.length + ' lessons: ' + missing.slice(0, 8).join(', '));
});

check('T27 the number fallback picks the RIGHT page (grade 3 lesson 2)', function () {
  makeTheoryGame();
  var s = new statesReal.TheoryState();
  s.enter({ grade: 3, title: 'Bài 2. Ôn tập phép cộng, phép trừ', lessonId: 2 });
  assert.strictEqual(s.theoryFound, true);
  var want = (THEORY[3] || []).filter(function (p) { return String(p.t).indexOf('Bài 2.') === 0; })[0];
  assert.strictEqual(s.content, want.c);
  assert.ok(s.content.indexOf('Nội dung đang được cập nhật') < 0, 'must not be the placeholder');
});

check('T28 exact-title match still wins over the number fallback', function () {
  makeTheoryGame();
  var s = new statesReal.TheoryState();
  var exact = (THEORY[3] || [])[5];
  s.enter({ grade: 3, title: exact.t, lessonId: 6 });
  assert.strictEqual(s.content, exact.c);
});

check('T29 a genuinely absent lesson still shows the placeholder (no crash)', function () {
  makeTheoryGame();
  var s = new statesReal.TheoryState();
  s.enter({ grade: 3, title: 'Bài 9999. Không tồn tại', lessonId: 9999 });
  assert.strictEqual(s.theoryFound, false);
  assert.ok(typeof s.content === 'string' && s.content.length > 0);
});

console.log('M7-B LessonSelect: pass=' + pass + ' fail=' + failed);
process.exit(failed ? 1 : 0);
