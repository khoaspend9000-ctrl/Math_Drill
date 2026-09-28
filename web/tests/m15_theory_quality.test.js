// M15 placeholder
'use strict';
const assert = require('assert');
const path = require('path');
const WEB = path.join(__dirname, '..');
const factory = require(path.join(WEB, 'js', 'theory_pages.js'));
const lessons = require(path.join(WEB, 'data', 'math_lessons.json'));
const T = typeof factory === 'function' ? factory() : factory;

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log('PASS ' + name); pass++; }
  catch (e) { console.log('FAIL ' + name + ' :: ' + e.message); fail++; }
}

function allPages() {
  const out = [];
  [1, 2, 3, 4, 5].forEach(function (g) {
    (T[g] || []).forEach(function (p) { out.push({ grade: g, p: p }); });
  });
  return out;
}

check('B4-T01 every theory page keeps its Desktop body verbatim as the first line', function () {
  const bad = [];
  allPages().forEach(function (e) {
    const base = String(e.p.base === undefined ? e.p.c : e.p.base);
    if (String(e.p.c).indexOf(base) !== 0) {
      bad.push('G' + e.grade + ' ' + e.p.t + ' :: base not preserved');
    }
  });
  assert.strictEqual(bad.length, 0, bad.length + ' page(s) altered their Desktop text: ' + bad.slice(0, 4).join(' | '));
});

check('B4-T02 no theory page is left too thin to teach from', function () {
  const thin = allPages().filter(function (e) { return String(e.p.c).trim().length < 60; });
  assert.strictEqual(thin.length, 0,
    thin.length + ' page(s) still under 60 chars, e.g. ' +
    (thin[0] ? thin[0].p.t + ' = ' + thin[0].p.c : ''));
});

check('B4-T03 no theory page is empty', function () {
  const empty = allPages().filter(function (e) { return !String(e.p.c || '').trim(); });
  assert.strictEqual(empty.length, 0, empty.length + ' empty page(s)');
});

check('B4-T04 theory is grounded in the lesson template, not generic filler', function () {
  // Grade 3 lesson 79 is a "measure" lesson: the enrichment must talk
  // about units, not about generic study advice.
  const p79 = (T[3] || []).filter(function (p) { return /^Bài 79\./.test(p.t); })[0];
  assert.ok(p79, 'grade 3 lesson 79 theory page missing');
  assert.strictEqual(lessons.grade_3['79'].template, 'measure', 'fixture assumption changed');
  assert.ok(/cm|dm|don vi/i.test(p79.c),
    'measure lesson must mention units, got: ' + p79.c);

  // A decimal lesson must not receive geometry advice.
  const decLesson = Object.keys(lessons.grade_5)
    .filter(function (k) { return lessons.grade_5[k].template === 'decimal'; })[0];
  const decPage = (T[5] || []).filter(function (p) {
    return p.t.indexOf('Bài ' + decLesson + '.') === 0;
  })[0];
  assert.ok(decPage, 'grade 5 decimal lesson theory page missing');
  assert.ok(/thap phan|cham/i.test(decPage.c),
    'decimal lesson must mention place value, got: ' + decPage.c);
});

check('B4-T05 full Desktop bodies are never padded', function () {
  let checked = 0;
  allPages().forEach(function (e) {
    const base = String(e.p.base === undefined ? e.p.c : e.p.base);
    if (base.trim().length >= 60) {
      assert.strictEqual(String(e.p.c), base.trim(),
        'a long Desktop body must pass through untouched: ' + e.p.t);
      checked++;
    }
  });
  assert.ok(checked > 0, 'expected at least one page already long enough to skip');
});

check('B4-T06 every grade keeps its full lesson count', function () {
  const want = { 1: 40, 2: 73, 3: 81, 4: 73, 5: 75 };
  Object.keys(want).forEach(function (g) {
    const n = (T[g] || []).length;
    assert.ok(n >= want[g],
      'grade ' + g + ' theory pages must cover all ' + want[g] + ' lessons, got ' + n);
  });
});

check('B4-T07 enrichment is additive and repeatable (no accumulation)', function () {
  const a = JSON.stringify(T[3].map(function (p) { return p.c; }));
  const again = JSON.stringify((factory()[3] || []).map(function (p) { return p.c; }));
  assert.strictEqual(a, again, 'calling the factory twice must not accumulate text');
  // No duplicated bullet markers.
  const bad = allPages().filter(function (e) { return /- [^\n]*\n- \1/.test(String(e.p.c)); });
  assert.strictEqual(bad.length, 0, bad.length + ' page(s) repeat a teaching point');
});

check('B4-T08 theory still renders on the Desktop 1300x800 design', function () {
  // The enrichment adds newlines; the book must still paginate rather than
  // loop or overflow silently.
  const long = allPages().reduce(function (a, b) {
    return String(b.p.c).length > String(a.p.c).length ? b : a;
  });
  assert.ok(String(long.p.c).length > 60, 'expected a long enriched page');
  assert.ok(String(long.p.c).split('\n').length <= 4,
    'enrichment should add at most a few lines, got ' +
    String(long.p.c).split('\n').length);
});

// __M15_B4_TAIL__

console.log('M15_THEORY_QUALITY: pass=' + pass + ' fail=' + fail);
process.exit(fail === 0 ? 0 : 1);
