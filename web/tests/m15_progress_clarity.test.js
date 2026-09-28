// M15 placeholder
'use strict';
const assert = require('assert');
const path = require('path');
const WEB = path.join(__dirname, '..');
const dl = require(path.join(WEB, 'js', 'data_loader.js'));
const player = require(path.join(WEB, 'js', 'player.js'));

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log('PASS ' + name); pass++; }
  catch (e) { console.log('FAIL ' + name + ' :: ' + e.message); fail++; }
}

check('C2-T01 nextUnlockProgress reports the next gate and its distance', function () {
  const p = dl.nextUnlockProgress(1, 81);
  assert.strictEqual(p.level, 1);
  assert.strictEqual(p.unlocked, 1, 'level 1 unlocks lesson 1 (Desktop parity)');
  assert.strictEqual(p.next_lesson, 2);
  assert.strictEqual(p.required_level, 7, 'lesson 2 needs level 7');
  assert.strictEqual(p.levels_needed, 6, 'level 1 -> 7 is 6 levels away');
  assert.strictEqual(p.lessons_to_unlock, 1);
  assert.strictEqual(p.all_unlocked, false);
});

check('C2-T02 the far end of Grade 3 is computed, not guessed', function () {
  const p = dl.nextUnlockProgress(469, 81);
  assert.strictEqual(p.unlocked, 79, 'level 469 unlocks lesson 79');
  assert.strictEqual(p.next_lesson, 80);
  assert.strictEqual(p.required_level, 475, 'lesson 80 needs level 475');
  const q = dl.nextUnlockProgress(475, 81);
  assert.strictEqual(q.unlocked, 80);
  assert.strictEqual(q.required_level, 481, 'lesson 81 needs level 481');
  const r = dl.nextUnlockProgress(481, 81);
  assert.strictEqual(r.unlocked, 81, 'level 481 unlocks all 81 grade 3 lessons');
  assert.strictEqual(r.all_unlocked, true);
});

check('C2-T03 a finished grade reports all_unlocked, not a phantom lock', function () {
  const p = dl.nextUnlockProgress(1000, 81);
  assert.strictEqual(p.all_unlocked, true);
  assert.strictEqual(p.lessons_to_unlock, null, 'no next lesson exists past the grade');
  assert.strictEqual(dl.nextUnlockProgress(500, 40).all_unlocked, true, 'grade 1 at level 500');
});

check('C2-T04 levels_needed always counts forward to the NEXT lock', function () {
  // At a gate level (7 unlocks lesson 2) the following lock is lesson 3 at
  // level 13, so the countdown is 6 — never 0. A child standing exactly on
  // a gate is told "6 more levels to lesson 3", which is correct.
  assert.strictEqual(dl.nextUnlockProgress(7, 81).levels_needed, 6);
  assert.strictEqual(dl.nextUnlockProgress(6, 81).levels_needed, 1, 'one level below the gate');
  assert.strictEqual(dl.nextUnlockProgress(8, 81).levels_needed, 5, 'one level past the gate');
  // And it always shrinks by exactly one per level gained.
  let prev = null;
  for (let l = 1; l <= 20; l++) {
    const n = dl.nextUnlockProgress(l, 81).levels_needed;
    if (prev !== null && n > prev) {
      assert.ok(n === 6, 'levels_needed may only reset to 6 at a gate, saw ' + n);
    }
    assert.ok(n >= 1 && n <= 6, 'levels_needed out of range at level ' + l + ': ' + n);
    prev = n;
  }
});

check('C2-T05 missing/garbage inputs never throw or produce NaN', function () {
  [undefined, null, 0, -5, 'abc', NaN].forEach(function (bad) {
    const p = dl.nextUnlockProgress(bad, 81);
    assert.ok(p.level >= 1, 'level must be clamped, got ' + p.level);
    assert.ok(Number.isFinite(p.unlocked));
    assert.ok(Number.isFinite(p.required_level));
    assert.ok(Number.isFinite(p.levels_needed));
  });
  const noTotal = dl.nextUnlockProgress(1, null);
  assert.strictEqual(noTotal.lessons_to_unlock, null, 'unknown total -> null, not NaN');
  assert.strictEqual(noTotal.all_unlocked, false, 'unknown total cannot claim completion');
});

check('C2-T06 expToReachLevel sums the Desktop curve', function () {
  const req = player.getRequiredExp;
  // level 1 -> 3 needs the cost of level 1 plus the cost of level 2
  const expect = req(1) + req(2);
  assert.strictEqual(dl.expToReachLevel(1, 0, 3, req), expect,
    'expected ' + expect + ' XP to go from level 1 to level 3');
  // current XP is subtracted
  assert.strictEqual(dl.expToReachLevel(1, 20, 3, req), expect - 20);
  // never negative even if the player somehow has excess XP
  assert.strictEqual(dl.expToReachLevel(5, 99999, 5, req), 0, 'same level -> 0');
  assert.ok(dl.expToReachLevel(3, 0, 2, req) === 0, 'target below current -> 0');
  assert.strictEqual(dl.expToReachLevel(1, 0, 5, null), null, 'no curve supplied -> null');
});

check('C2-T07 progress is consistent with the untouched unlock formula', function () {
  for (const lvl of [1, 6, 7, 12, 13, 79, 469, 475, 481]) {
    const p = dl.nextUnlockProgress(lvl, 81);
    // Whatever we advertise must match the real gate, byte-for-byte.
    assert.strictEqual(dl.getUnlockedCount(lvl), p.unlocked, 'unlocked count differs at level ' + lvl);
    assert.strictEqual(dl.requiredLevelForLesson(p.next_lesson - 1), p.required_level,
      'required level differs at level ' + lvl);
    assert.strictEqual(dl.isLessonUnlocked(p.unlocked - 1, lvl), true,
      'last unlocked lesson must actually be open at level ' + lvl);
    if (!p.all_unlocked) {
      assert.strictEqual(dl.isLessonUnlocked(p.next_lesson - 1, lvl), false,
        'next lesson must still be locked at level ' + lvl);
    }
  }
});

// __M15_C2_TAIL__

console.log('M15_PROGRESS_CLARITY: pass=' + pass + ' fail=' + fail);
process.exit(fail === 0 ? 0 : 1);
