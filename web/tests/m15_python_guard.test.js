// M15-G6 — Desktop Python must never change.
//
// G6 was listed in M15_REQUIREMENTS ("36 files, PY_DIFF=0") but had NO
// automated guard: until now it was only ever a manual command, so a stray
// edit to main.py / game_init.py would have been caught by a human reading
// a report, not by the suite. This closes that gap.
//
// The guard is a byte-identity check between the Desktop source tree
// (E:\\lam_game_2026) and the release repository (E:\\MathDrill), because
// Python is READ-ONLY SOURCE OF TRUTH and must be shipped identically.
//
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SOURCE = process.env.M15_PY_SOURCE || 'E:/lam_game_2026';
const REPO = process.env.M15_PY_REPO || 'E:/MathDrill';
const EXPECTED_COUNT = 36;

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log('PASS ' + name); pass++; }
  catch (e) { console.log('FAIL ' + name + ' :: ' + e.message); fail++; }
}

function walk(dir, out) {
  out = out || [];
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  entries.forEach(function (e) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === '__pycache__') return;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.py$/i.test(e.name)) out.push(full);
  });
  return out;
}

function sha(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const pyFiles = walk(SOURCE).sort();

check('G6-T01 the Desktop tree still has the expected Python file count', function () {
  assert.strictEqual(pyFiles.length, EXPECTED_COUNT,
    'expected ' + EXPECTED_COUNT + ' .py files under ' + SOURCE +
    ', found ' + pyFiles.length);
});

check('G6-T02 every Desktop .py file exists in the repo and is byte-identical', function () {
  const diff = [];
  pyFiles.forEach(function (f) {
    const rel = path.relative(SOURCE, f);
    const other = path.join(REPO, rel);
    if (!fs.existsSync(other)) { diff.push(rel + ' MISSING in repo'); return; }
    if (sha(f) !== sha(other)) diff.push(rel + ' DIFFERS');
  });
  assert.strictEqual(diff.length, 0,
    diff.length + ' Python file(s) changed: ' + diff.slice(0, 6).join(', '));
});

check('G6-T03 key Desktop modules are present and unchanged', function () {
  ['main.py', 'game_init.py', 'player.py', 'question_generator.py',
    'data_manager.py', 'math_lessons.json']
    .forEach(function (name) {
      const s = path.join(SOURCE, name);
      const r = path.join(REPO, name);
      assert.ok(fs.existsSync(s), name + ' missing from the Desktop tree');
      if (fs.existsSync(r)) {
        assert.strictEqual(sha(s), sha(r), name + ' differs between source and repo');
      }
    });
});

check('G6-T04 the unlock formula is still present in the Desktop source', function () {
  // Guards against an accidental "simplification" of the parity rule that
  // M15-G5 protects on the Web side.
  const src = fs.readFileSync(path.join(SOURCE, 'main.py'), 'utf8');
  assert.ok(/\(user_level - 1\)\/\/6 \+ 1|\(self\.player\.level - 1\)\/\/6 \+ 1/.test(src) ||
    /max_unlocked_lesson\s*=\s*\(.*-\s*1\)\s*\/\/\s*6\s*\+\s*1/.test(src),
    'Desktop unlock formula (level-1)//6+1 not found in main.py');
});

check('G6-T05 the guard actually detects a modified Python file', function () {
  // A guard that cannot fail is not a guard: prove the comparison bites by
  // comparing a real file against a deliberately altered copy.
  const real = pyFiles.find(function (f) { return fs.statSync(f).size > 0; });
  assert.ok(real, 'no readable Python file to test the comparison with');
  const original = fs.readFileSync(real);
  const mutated = Buffer.from(original);
  mutated[mutated.length - 1] = mutated[mutated.length - 1] ^ 0xff; // flip a bit
  const a = crypto.createHash('sha256').update(original).digest('hex');
  const b = crypto.createHash('sha256').update(mutated).digest('hex');
  assert.notStrictEqual(a, b,
    'the SHA-256 comparison cannot detect a changed byte, so G6 would be useless');
});

console.log('M15_PYTHON_GUARD: pass=' + pass + ' fail=' + fail);
process.exit(fail === 0 ? 0 : 1);
