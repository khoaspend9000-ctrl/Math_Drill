// =========================================================
// M15-A1/A2/A3/A4 — every lesson must produce a FRESH question.
// ---------------------------------------------------------
// REPRODUCED on the M14 baseline: of 342 lessons, 106 emitted only
// 3 or fewer distinct question_text across a 15-question lesson
// (worst cases emitted the identical question 15x, while still
// granting XP and combo). Root causes were the `else` fallthrough of
// all five grade generators synthesising `Tính: <lesson_id> + 1 = ?`
// and the de-dup exhaustion path re-serving the cached question.
// FIX: on de-dup exhaustion mint a randomised, template-matched
// question (math_lessons.json `template` is now finally consumed).
// =========================================================
'use strict';
const assert = require('assert');
const path = require('path');
const WEB = path.join(__dirname, '..');
const qg = require(path.join(WEB, 'js', 'question_generator.js'));
const lessons = require(path.join(WEB, 'data', 'math_lessons.json'));

function register() {
  Object.keys(lessons).forEach(function (gk) {
    if (gk === 'meta') return;
    const grade = parseInt(String(gk).split('_')[1], 10);
    if (!isFinite(grade)) return;
    const map = {};
    Object.keys(lessons[gk]).forEach(function (id) {
      const t = lessons[gk][id].template;
      if (t) map[parseInt(id, 10)] = t;
    });
    qg.QuestionGenerator.setLessonTemplates(grade, map);
  });
}

function gradeKeys() {
  return Object.keys(lessons).filter(function (k) { return k !== 'meta'; });
}

// Walks every lesson the way the game does: one generator, a live
// question_cache, 15 consecutive questions in a single lesson.
function sweep(perLesson, opts) {
  const G = new qg.QuestionGenerator();
  const problems = [];
  gradeKeys().forEach(function (gk) {
    const grade = parseInt(String(gk).split('_')[1], 10);
    Object.keys(lessons[gk]).forEach(function (id) {
      const lid = parseInt(id, 10);
      G.question_cache = {};
      const seen = new Set();
      for (let i = 0; i < perLesson; i++) {
        const q = G.generate_question(grade, lid);
        const tag = gk + ' L' + lid;
        if (opts.checkQuestion) {
          const msg = opts.checkQuestion(q, tag);
          if (msg) problems.push(msg);
        }
        seen.add(q.question_text);
      }
      if (new Set(Array.from(seen)).size <= opts.minUnique) {
        problems.push(tag + ' only ' + seen.size + ' distinct question(s) in ' + perLesson);
      }
    });
  });
  return problems;
}

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log('PASS ' + name); pass++; }
  catch (e) { console.log('FAIL ' + name + ' :: ' + e.message); fail++; }
}

register();

check('A1-T01 every template used by math_lessons.json is implemented', function () {
  const used = new Set();
  gradeKeys().forEach(function (gk) {
    Object.keys(lessons[gk]).forEach(function (id) {
      if (lessons[gk][id].template) used.add(lessons[gk][id].template);
    });
  });
  used.forEach(function (t) {
    assert.ok(qg.QuestionGenerator.KNOWN_TEMPLATES.indexOf(t) >= 0,
      'template not implemented: ' + t);
  });
});

check('A1-T02 no lesson repeats itself across a real 15-question lesson', function () {
  const problems = sweep(15, { minUnique: 4 });
  assert.strictEqual(problems.length, 0,
    problems.length + ' lesson(s) repeat: ' + problems.slice(0, 12).join(' | '));
});

check('A1-T03 every question has 4 distinct options containing a real answer', function () {
  const problems = sweep(8, {
    minUnique: 1,
    checkQuestion: function (q, tag) {
      const o = (q.options || []).map(String);
      if (o.length !== 4) return tag + ' options=' + o.length;
      if (new Set(o).size !== 4) return tag + ' duplicate options: ' + o.join('/');
      const a = String(q.correct_answer);
      if (!a || /NaN|undefined|null/.test(a)) return tag + ' bad answer: ' + a;
      if (o.indexOf(a) < 0) return tag + ' answer "' + a + '" not among ' + o.join('/');
      return null;
    }
  });
  assert.strictEqual(problems.length, 0,
    problems.length + ' malformed question(s): ' + problems.slice(0, 10).join(' | '));
});

check('A2-T01 the lesson-number fallthrough no longer produces a fixed question', function () {
  // The real defect was a DETERMINISTIC question built from the lesson id
  // ("Tính: 79 + 1 = ?", identical on every attempt). Random arithmetic may
  // coincidentally contain "<n> + 1", so assert on determinism, not on text:
  // within one lesson no question text may repeat more than twice.
  const G = new qg.QuestionGenerator();
  const offenders = [];
  gradeKeys().forEach(function (gk) {
    const grade = parseInt(String(gk).split('_')[1], 10);
    Object.keys(lessons[gk]).forEach(function (id) {
      const lid = parseInt(id, 10);
      G.question_cache = {};
      const counts = new Map();
      for (let i = 0; i < 8; i++) {
        const t = G.generate_question(grade, lid).question_text;
        counts.set(t, (counts.get(t) || 0) + 1);
      }
      counts.forEach(function (n, t) {
        if (n > 2) offenders.push(gk + ' L' + lid + ' repeated ' + n + 'x: ' + t);
      });
    });
  });
  assert.strictEqual(offenders.length, 0,
    offenders.length + ' non-randomised question(s): ' + offenders.slice(0, 8).join(' | '));
});

check('A2-T03 grade 1/3 fallthrough lessons now use their lesson template', function () {
  const G = new qg.QuestionGenerator();
  // grade_3 L79 is "measure" and used to emit "Tính: 79 + 1 = ?".
  G.question_cache = {};
  const uniq79 = new Set();
  for (let i = 0; i < 10; i++) uniq79.add(G.generate_question(3, 79).question_text);
  uniq79.forEach(function (t) {
    assert.ok(t.indexOf('79 + 1') < 0, 'grade 3 L79 still emits the fallthrough: ' + t);
  });
  // grade_1 L3 fell through to "Tính nhanh: 3 - 1 = ?".
  G.question_cache = {};
  const uniq3 = new Set();
  for (let i = 0; i < 10; i++) uniq3.add(G.generate_question(1, 3).question_text);
  uniq3.forEach(function (t) {
    assert.ok(t.indexOf('3 - 1 = ?') < 0, 'grade 1 L3 still emits the fallthrough: ' + t);
  });
  assert.ok(uniq79.size >= 3 && uniq3.size >= 3,
    'fallthrough lessons are not varied: G3L79=' + uniq79.size + ' G1L3=' + uniq3.size);
});

check('A2-T02 the hard-coded "1 + 1 = ?" placeholder is never returned', function () {
  const problems = sweep(4, {
    minUnique: 1,
    checkQuestion: function (q, tag) {
      return q.question_text === '1 + 1 = ?' ? tag + ' returned the placeholder' : null;
    }
  });
  assert.strictEqual(problems.length, 0, problems.join(' | '));
});

check('A4-T01 template metadata is consumed: grade 3 L79 is a measurement lesson', function () {
  const G = new qg.QuestionGenerator();
  const tpl = lessons.grade_3['79'].template;
  assert.ok(tpl, 'lesson 79 must declare a template');
  assert.strictEqual(G._template_for(3, 79), tpl, 'template not registered for G3 L79');
  G.question_cache = {};
  const uniq = new Set();
  for (let i = 0; i < 12; i++) uniq.add(G.generate_question(3, 79).question_text);
  assert.ok(uniq.size >= 3, 'G3 L79 still near-constant: ' + uniq.size);
  const measured = Array.from(uniq).filter(function (t) { return /cm|Diện tích|Chu vi/.test(t); });
  assert.ok(measured.length >= 1,
    'a "measure" lesson produced no measurement question: ' + Array.from(uniq).join(' | '));
});

check('A4-T02 grade 5 decimal and percentage lessons use their own generator', function () {
  const G = new qg.QuestionGenerator();
  G.question_cache = {};
  const dec = new Set(), pct = new Set();
  for (let i = 0; i < 10; i++) {
    dec.add(G.generate_question(5, 14).question_text);
    pct.add(G.generate_question(5, 27).question_text);
  }
  assert.ok(dec.size >= 2, 'G5 L14 decimal lesson not varied: ' + dec.size);
  assert.ok(pct.size >= 2, 'G5 L27 percentage lesson not varied: ' + pct.size);
  assert.ok(Array.from(pct).some(function (t) { return /%/.test(t); }),
    'percentage lesson produced no % question: ' + Array.from(pct).join(' | '));
});

check('A3-T01 get_lesson_info keeps Desktop parity (grade 1 only)', function () {
  const G = new qg.QuestionGenerator();
  assert.ok(G.get_lesson_info(1, 1), 'grade 1 topic lookup regressed');
  assert.ok(G.get_lesson_info(1, 40), 'grade 1 lesson 40 lookup regressed');
  assert.strictEqual(G.get_lesson_info(2, 1), null, 'grades 2-5 must stay null (parity)');
});

check('G5-T01 Desktop unlock parity formula is untouched', function () {
  const dl = require(path.join(WEB, 'js', 'data_loader.js'));
  assert.strictEqual(dl.getUnlockedCount(1), 1);
  assert.strictEqual(dl.getUnlockedCount(7), 2);
  assert.strictEqual(dl.getUnlockedCount(469), 79, 'lesson 79 gate moved');
  assert.strictEqual(dl.getUnlockedCount(481), 81, 'lesson 81 gate moved');
  assert.strictEqual(dl.requiredLevelForLesson(80), 481);
  assert.ok(dl.isLessonUnlocked(78, 469), 'lesson 79 should unlock at level 469');
  assert.ok(!dl.isLessonUnlocked(78, 468), 'lesson 79 must stay locked at level 468');
});

// __M15_VARIETY_TAIL__

console.log('M15_QUESTION_VARIETY: pass=' + pass + ' fail=' + fail);
process.exit(fail === 0 ? 0 : 1);
