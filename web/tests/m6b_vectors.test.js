'use strict';
/* M6-B: JS question_generator vs PY REFERENCE VECTORS (plan R2).
   Nguon: web/tests/vectors/question_vectors.json (sinh boi py_reference_qg.py
   tren source Python that, LCG 64-bit inject vao random module).
   JS tai lap dung LCG (BigInt) qua global.MDRandom.

   Do khop:
   - Vector NORMAL: CHINH XAC question_text, correct_answer, hint,
     question_type, difficulty. Options: so khop NOI DUNG (multiset,
     bo qua thu tu) — Python _mix_options dung SET (py:167-176), thu tu
     list(opts) phu thuoc string-hash randomization cua process Python.
   - Vector hang/py_error (KNOWN_PYTHON_*): SKIP parity theo thiet ke B+C
     (Python khong sinh duoc question). Chi assert JS (co SAFETY_GUARD)
     tra ve question HOP LE trong thoi gian huu han, khong freeze. M6-B B2: grade+lesson_id 8-field check, counters separate, KH5 L31-34 explicit. */
const assert = require('assert');
const path = require('path');
const fs = require('fs');

const QG = require('../js/question_generator.js');
const QuestionGenerator = QG.QuestionGenerator;

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'vectors', 'question_vectors.json'), 'utf8'));

const MASK64 = (1n << 64n) - 1n;
const LC_A = 6364136223846793005n;
const LC_C = 1442695040888963407n;
let state = 0n;
function lcg() {
  state = (state * LC_A + LC_C) & MASK64;
  return Number(state >> 11n) / 9007199254740992; // (state>>11)/2^53 — dung cong thuc Python
}

function sortedOptions(opts) {
  return JSON.stringify(opts.slice().sort());
}

(function goldenCheck() {
  state = BigInt(42);
  for (let i = 0; i < DATA.lcg_golden_seed42.length; i++) {
    const v = lcg();
    assert.ok(v === DATA.lcg_golden_seed42[i],
      'LCG golden mismatch #' + i + ': ' + v + ' != ' + DATA.lcg_golden_seed42[i]);
  }
  console.log('PASS  LCG golden seed42 bit-identical (x' + DATA.lcg_golden_seed42.length + ')');
})();

let pass = 0, hangSkipped = 0, errSkipped = 0, safetyFailed = 0, failed = 0;
const failures = [];

for (const v of DATA.vectors) {
  const tag = 'g' + v.grade + ' L' + v.lesson_id + ' seed' + v.seed;
  state = BigInt(v.seed);
  global.MDRandom = { random: lcg };
  const gen = new QuestionGenerator();
  let q = null, err = null;
  try { q = gen.generate_question(v.grade, v.lesson_id, 2, null); }
  catch (e) { err = e; }

  if (v.hang || v.py_error) {
    const t0 = Date.now();
    const okQ = !err && q && typeof q.question_text === 'string' && q.question_text.length > 0 &&
      Array.isArray(q.options) && q.options.length === 4 &&
      q.options.indexOf(q.correct_answer) >= 0 &&
      typeof q.hint === 'string' && q.hint.length > 0;
    if (okQ && (Date.now() - t0) < 10000) {
      hangSkipped += v.hang ? 1 : 0;
      errSkipped += v.py_error ? 1 : 0;
      const src = /question_generator\.py line \d+/.exec(v.detail || '');
      const exc = v.py_error ? ((v.detail || '').split('(')[0].trim()) : '';
      console.log('SKIP  [' + v.reason + '] ' + tag + (src ? ' (' + src[0] + ')' : '') + ' — JS SAFETY_GUARD tra ve question hop le in ' + (Date.now() - t0) + 'ms' + (exc ? ' | ' + exc : ''));
    }
    else {
      // guard failure numai in safetyFailed (jos) — nu conteaza ca normal-mismatch
      safetyFailed++; // guard: question invalida sau prea lenta (>=10s sau freeze)
      failures.push({ tag: tag, field: 'guard', want: 'valid question (finite time <10s)', got: err ? ('exception: ' + err.message) : ('time=' + (Date.now() - t0) + 'ms q=' + JSON.stringify(q)) });
    }
    continue;
  }

  if (err) {
    failed++;
    failures.push({ tag: tag, field: 'exception', want: v.question_text, got: 'exception: ' + err.message });
    continue;
  }
  const fields = { grade: q.grade, lesson_id: q.lesson_id, question_text: q.question_text, correct_answer: q.correct_answer, hint: q.hint, question_type: q.question_type, difficulty: q.difficulty };
  let bad = null;
  for (const k in fields) {
    if (fields[k] !== v[k]) { bad = k; break; }
  }
  if (!bad && q.options.length !== v.options.length) bad = 'options(len)';
  if (!bad && q.options.indexOf(q.correct_answer) < 0) bad = 'options(missing correct)';
  if (!bad && sortedOptions(q.options) !== sortedOptions(v.options)) bad = 'options(content)';
  if (bad) {
    failed++;
    const wantV = bad.indexOf('options') === 0 ? v.options : v[bad];
    const gotV = bad.indexOf('options') === 0 ? q.options : fields[bad];
    failures.push({ tag: tag, field: bad, want: JSON.stringify(wantV), got: JSON.stringify(gotV) });
  } else pass++;
}

console.log('------------------------------------------------------------');
const normalCompared = pass + failed;
console.log('M6-B VECTORS — normal compared=' + normalCompared + '  normal mismatch=' + failed + '  hang skipped=' + hangSkipped + '  py_error skipped=' + errSkipped + '  safety failures=' + safetyFailed + '  / total=' + DATA.vectors.length);
console.log('            SUM: normal(' + normalCompared + ') + hang(' + hangSkipped + ') + py_error(' + errSkipped + ') = ' + (normalCompared + hangSkipped + errSkipped));
const byGrade = {};
for (const f of failures) { const g = f.tag.charAt(1); byGrade[g] = (byGrade[g] || 0) + 1; }
console.log('fail by grade:', JSON.stringify(byGrade));
const kh5 = DATA.vectors.filter(function (x) { return x.grade === 5 && x.lesson_id >= 31 && x.lesson_id <= 34 && !(x.hang || x.py_error); });
const kh5Fail = failures.filter(function (f) { return /g5 L3[1-4]/.test(f.tag); }).length;
console.log('SPECIAL KH5 L31-34 (uniform + round2/pyRound banker + pyFloatStr "10.0"): normal vect=' + kh5.length + ' mismatch=' + kh5Fail);
const groups = {};
for (const f of failures) {
  const key = f.tag.replace(/ seed\d+/, '');
  if (!groups[key]) groups[key] = { fields: {}, seeds: [] };
  const g = groups[key];
  if (!g.fields[f.field]) { g.fields[f.field] = { want: f.want, got: f.got }; g.seeds.push(f.tag.replace(/g\d+ L\d+ /, '')); }
}
const keys = Object.keys(groups).sort();
console.log('== unique failing (grade,lesson): ' + keys.length + ' ==');
for (const k of keys) {
  const g = groups[k];
  const fl = Object.keys(g.fields).map(function (x) { return x + '(' + g.seeds.length + ')'; }).join(',');
  console.log(k + ' :: ' + fl + ' :: seeds=' + g.seeds.join(','));
  for (const fn of Object.keys(g.fields)) {
    console.log('   ' + fn + ' want: ' + g.fields[fn].want);
    console.log('   ' + fn + ' got : ' + g.fields[fn].got);
  }
}
process.exit((failed || safetyFailed) ? 1 : 0);
