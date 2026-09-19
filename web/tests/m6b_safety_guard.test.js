'use strict';
/* M6-B BƯẬC 3: SAFETY_GUARD test (spec diem 3,4,5,6,7,8,9).
   Trei blocc SAFETY_GUARD în question_generator.js:
     - g2 L19-21 cong_co_nho        (py:646-652)   a%10==0 -> Python treo vo han
     - g2 L22-24 tru_co_muon        (py:654-660)   a%10==9 -> Python treo vo han
     - g2 L62-65 cong_tru_co_nho    (py:871-880, nam în _generate_grade_2_question)
       a%10==0 (add) sau a%10==9 (sub) -> Python treo vo han
   Assert (yêu câu B3):
     1. genera luon return în thoi gian huu han (<10s) - khong freeze/browse
     2. khong throw ngoaie contract (exception => failure)
     3. output Question hop le per contract: text/hint neempty, 4 options
        distincte, correct în options, type/difficulty/grade/lesson_id valide
     4. log [QuestionGenerator] SAFETY_GUARD triggered cu grade/lesson_id/
        generator (fără giu log fake din test)
     5. duong binh thuong (1005 normal vectors): parity CHINH XAC + guard
        KHONG tieu RNG draw + KHONG log (guard nu modifică duong binh thuong)
     6. 9 Python hang vectors: JS return finite, fără freeze
        => SKIP PARITY: KNOWN_PYTHON_INFINITE_LOOP
     7. 6 Python error vectors: Web KHONG crash, sinh hop le
        => SKIP PARITY: KNOWN_PYTHON_ERROR
   KHONG modifică question_generator.js (guard deja hoàn thit). */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const MASK64 = (1n << 64n) - 1n;
const LC_A = 6364136223846793005n;
const LC_C = 1442695040888963407n;
let st = 2026n;
function lcg() { st = (st * LC_A + LC_C) & MASK64; return Number(st >> 11n) / 9007199254740992; }

const warns = [];
global.GameLogger = {
  info: function () {},
  warn: function (m) { warns.push(String(m)); },
  error: function () {}
};
const QG = require('../js/question_generator.js');
const QuestionGenerator = QG.QuestionGenerator;

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'vectors', 'question_vectors.json'), 'utf8'));
const hangVectors = DATA.vectors.filter(function (v) { return v.hang; });
const errorVectors = DATA.vectors.filter(function (v) { return v.py_error; });
const normalVectors = DATA.vectors.filter(function (v) { return !(v.hang || v.py_error); });

function scriptedRandom(queue) {
  return function () { return queue.length ? queue.shift() : lcg(); };
}
function resetWarns() { warns.length = 0; }

/* Contract Question (vezi Question class în question_generator.js). Nu există
   camp "explanation" în acest port — contract hien foloseste "hint"
   (WEB_PORT_PLAN M6-A T01). */
function isValidQ(q) {
  if (!q) return false;
  if (typeof q.question_text !== 'string' || q.question_text.length === 0) return false;
  if (!Array.isArray(q.options) || q.options.length !== 4) return false;
  if (typeof q.correct_answer !== 'string' || q.correct_answer.length === 0) return false;
  if (q.options.indexOf(q.correct_answer) < 0) return false;
  if (new Set(q.options).size !== q.options.length) return false; // fără duplicate
  if (typeof q.hint !== 'string' || q.hint.length === 0) return false;
  if (typeof q.question_type !== 'string' || q.question_type.length === 0) return false;
  if (!Number.isInteger(q.difficulty) || q.difficulty < 1 || q.difficulty > 3) return false;
  if (!Number.isInteger(q.grade) || !Number.isInteger(q.lesson_id)) return false;
  return true;
}

let pass = 0, failed = 0;
let normalChecked = 0, hangSafety = 0, pyErrHandled = 0;
function check(name, fn) {
  resetWarns();
  try { fn(); pass++; console.log('PASS  ' + name); }
  catch (e) { failed++; console.error('FAIL  ' + name + ' :: ' + (e && e.message)); }
}

// ri(15,75): a=20 khi floor(r*61)=5   -> r = 5.5/61   (20%10==0 -> nhanh treo)
const R_A20 = 5.5 / 61;
// ri(30,95): a=39 khi floor(r*66)=9   -> r = 9.5/66   (39%10==9 -> nhanh treo)
const R_A39 = 9.5 / 66;
// ri(100,900): a=200 khi floor(r*801)=100 -> r=100.5/801 (200%10==0 -> treo nhanh cong)
const R_A200 = 100.5 / 801;
// ri(100,900): a=709 khi floor(r*801)=609 -> r=609.5/801 (709%10==9 -> treo nhanh tru)
const R_A709 = 609.5 / 801;
check('T01 g2 L19 (cong_co_nho): ep a%10==0 -> guard + question hop le + bounded time', function () {
  global.MDRandom = { random: scriptedRandom([0.35, 0.25, R_A20]) }; // 2 draw dau: obj + name
  const gen = new QuestionGenerator();
  const t0 = Date.now();
  const q = gen.generate_question(2, 19, 2, null);
  const dt = Date.now() - t0;
  assert.ok(isValidQ(q), 'question hop le per contract');
  assert.ok(dt < 2000, 'return huu han, thuc te ' + dt + 'ms');
  assert.ok(warns.some(function (w) {
    return w.indexOf('[QuestionGenerator] SAFETY_GUARD triggered') === 0 &&
      w.indexOf('grade=2') >= 0 && w.indexOf('lesson_id=19') >= 0 &&
      w.indexOf('cong_co_nho') >= 0 && w.indexOf('KNOWN_PYTHON_INFINITE_LOOP') >= 0;
  }), 'log guard dung format: ' + JSON.stringify(warns));
});

check('T02 g2 L22 (tru_co_muon): ep a%10==9 -> guard + question hop le + bounded time', function () {
  global.MDRandom = { random: scriptedRandom([0.35, 0.25, R_A39]) };
  const gen = new QuestionGenerator();
  const t0 = Date.now();
  const q = gen.generate_question(2, 22, 2, null);
  const dt = Date.now() - t0;
  assert.ok(isValidQ(q), 'question hop le per contract');
  assert.ok(dt < 2000, 'return huu han, thuc te ' + dt + 'ms');
  assert.ok(warns.some(function (w) {
    return w.indexOf('SAFETY_GUARD triggered') >= 0 && w.indexOf('grade=2') >= 0 &&
      w.indexOf('lesson_id=22') >= 0 && w.indexOf('tru_co_muon') >= 0;
  }), 'log guard: ' + JSON.stringify(warns));
});

check('T03 g2 L62 (cong_tru_co_nho, py:871-880): ep a%10==0 + add -> guard + hop le', function () {
  // draws: obj, name, a=200, b=ri(10,100) tu r=0.5 -> 55, choice r=0.25 < 0.5 -> adunare
  global.MDRandom = { random: scriptedRandom([0.35, 0.25, R_A200, 0.5, 0.25]) };
  const gen = new QuestionGenerator();
  const t0 = Date.now();
  const q = gen.generate_question(2, 62, 2, null);
  const dt = Date.now() - t0;
  assert.ok(isValidQ(q), 'question hop le per contract');
  assert.ok(dt < 2000, 'return huu han, thuc te ' + dt + 'ms');
  assert.ok(warns.some(function (w) {
    return w.indexOf('SAFETY_GUARD triggered') >= 0 && w.indexOf('grade=2') >= 0 &&
      w.indexOf('lesson_id=62') >= 0 && w.indexOf('cong_tru_co_nho') >= 0;
  }), 'log guard: ' + JSON.stringify(warns));
});
check('T03b g2 L62 (cong_tru_co_nho): ep a%10==9 + sub -> guard + hop le', function () {
  // a=709, b=55, choice r=0.6 >= 0.5 -> scadere; a%10=9 >= b%10 -> treo b peste maara -> guard
  global.MDRandom = { random: scriptedRandom([0.35, 0.25, R_A709, 0.5, 0.6]) };
  const gen = new QuestionGenerator();
  const t0 = Date.now();
  const q = gen.generate_question(2, 62, 2, null);
  const dt = Date.now() - t0;
  assert.ok(isValidQ(q), 'question hop le per contract');
  assert.ok(dt < 2000, 'return huu han, thuc te ' + dt + 'ms');
  assert.ok(warns.some(function (w) {
    return w.indexOf('SAFETY_GUARD triggered') >= 0 && w.indexOf('grade=2') >= 0 &&
      w.indexOf('lesson_id=62') >= 0 && w.indexOf('cong_tru_co_nho') >= 0;
  }), 'log guard: ' + JSON.stringify(warns));
});

check('T04 50 attempt deu treo -> fallback tinh hop le (27+48=75) + van log guard', function () {
  // Ep MOI draw = R_A20: a=20 moi attempt -> moi attempt deu treo (0 + b%10 < 10 luon dung)
  global.MDRandom = { random: function () { return R_A20; } };
  const gen = new QuestionGenerator();
  const t0 = Date.now();
  const q = gen.generate_question(2, 19, 2, null);
  const dt = Date.now() - t0;
  assert.ok(q, 'question tra ve');
  assert.strictEqual(q.correct_answer, '75', 'fallback 27+48=75, got ' + q.correct_answer);
  assert.ok(q.options.indexOf('75') >= 0, 'options chua 75: ' + JSON.stringify(q.options));
  assert.ok(q.options.length === 4, '4 options');
  assert.ok(dt < 5000, 'bounded time, thuc te ' + dt + 'ms');
  assert.ok(warns.length >= 1, 'co log guard');
});

check('T05 duong binh thuong (seed 2026, g2 L19): KHONG kich hoat guard', function () {
  st = 2026n;
  global.MDRandom = { random: lcg };
  const gen = new QuestionGenerator();
  const q = gen.generate_question(2, 19, 2, null);
  assert.ok(isValidQ(q), 'question hop le per contract');
  assert.strictEqual(warns.length, 0, 'khong duoc co log guard: ' + JSON.stringify(warns));
});
check('T06 duong binh thuong: toti 1005 normal vectors parity CHINH XAC + KHONG log guard (guard nu tieu RNG draw)', function () {
  let mism = 0;
  for (const v of normalVectors) {
    st = BigInt(v.seed);
    global.MDRandom = { random: lcg };
    const gen = new QuestionGenerator();
    let q = null;
    try { q = gen.generate_question(v.grade, v.lesson_id, 2, null); }
    catch (e) { mism++; continue; }
    if (!q) { mism++; continue; }
    const ok =
      q.grade === v.grade && q.lesson_id === v.lesson_id &&
      q.question_text === v.question_text && q.correct_answer === v.correct_answer &&
      q.hint === v.hint && q.question_type === v.question_type &&
      q.difficulty === v.difficulty &&
      JSON.stringify(q.options.slice().sort()) === JSON.stringify(v.options.slice().sort());
    if (!ok) mism++;
    normalChecked++;
  }
  assert.strictEqual(mism, 0, mism + ' normal vectors divergence vs PY reference (guard KHONG poate tieu draw sau thay output)');
  assert.strictEqual(warns.length, 0, 'KHONG co log SAFETY_GUARD pe duong binh thuong: ' + warns.slice(0, 3).join(' | '));
});

check('T07 9 Python hang vectors: JS SAFETY_GUARD return finite + hop le -> SKIP PARITY KNOWN_PYTHON_INFINITE_LOOP', function () {
  assert.strictEqual(hangVectors.length, 9, '9 hang vectors in JSON, got ' + hangVectors.length);
  for (const v of hangVectors) {
    const tag = 'g' + v.grade + ' L' + v.lesson_id + ' seed' + v.seed;
    resetWarns();
    st = BigInt(v.seed);
    global.MDRandom = { random: lcg };
    const gen = new QuestionGenerator();
    const t0 = Date.now();
    const q = gen.generate_question(v.grade, v.lesson_id, 2, null);
    const dt = Date.now() - t0;
    const src = /question_generator\.py line (\d+)/.exec(v.detail || '');
    assert.ok(dt < 10000, tag + ' finite, took ' + dt + 'ms');
    assert.ok(isValidQ(q), tag + ' valid question per contract');
    assert.ok(warns.length >= 1, tag + ' guard log hoasit; warns=' + JSON.stringify(warns));
    console.log('SKIP PARITY: ' + v.reason + ' ' + tag + (src ? ' (py:' + src[1] + ')' : '') + ' - JS guard finite + safe');
    hangSafety++;
  }
});

check('T08 6 Python error vectors: Web KHONG crash + sinh hop le -> SKIP PARITY KNOWN_PYTHON_ERROR', function () {
  assert.strictEqual(errorVectors.length, 6, '6 py_error vectors in JSON, got ' + errorVectors.length);
  for (const v of errorVectors) {
    const tag = 'g' + v.grade + ' L' + v.lesson_id + ' seed' + v.seed;
    resetWarns();
    st = BigInt(v.seed);
    global.MDRandom = { random: lcg };
    const gen = new QuestionGenerator();
    const t0 = Date.now();
    let q = null, err = null;
    try { q = gen.generate_question(v.grade, v.lesson_id, 2, null); }
    catch (e) { err = e; }
    const dt = Date.now() - t0;
    const src = /question_generator\.py line (\d+)/.exec(v.detail || '');
    const exc = v.detail ? v.detail.split(':')[0].trim() : '';
    assert.ok(!err, tag + ' KHONG crash: ' + (err && err.message));
    assert.ok(dt < 10000, tag + ' finite, took ' + dt + 'ms');
    assert.ok(isValidQ(q), tag + ' valid question per contract');
    console.log('SKIP PARITY: ' + v.reason + ' ' + tag + (src ? ' (py:' + src[1] + ')' : '') + ' (' + exc + ') - Web fallback/handling OK');
    pyErrHandled++;
  }
});

console.log('------------------------------------------------------------------------');
console.log('M6-B SAFETY_GUARD: normal checks=' + normalChecked +
  '  hang safety checks=' + hangSafety +
  '  py_error handling checks=' + pyErrHandled +
  '  safety failures=' + failed +
  '  / total failures=' + failed);
console.log('  test passes=' + pass + '  (T01-T05 scripted guard path, T06 normal-parity, T07 hang-safety, T08 py-error)');
process.exit(failed ? 1 : 0);