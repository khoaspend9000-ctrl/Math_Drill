'use strict';
/* M9-D Achievements test */
const assert = require('assert');
const AchievementSys = require('../js/achievements.js');
const AchievementSystem = AchievementSys.AchievementSystem;
let pass = 0, failed = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('PASS  ' + name); }
  catch (e) { failed++; console.error('FAIL  ' + name + ' :: ' + (e && e.message)); }
}
check('T01 load definitions from data/achievements.json', function () {
  const s = new AchievementSystem();
  const d = s.getDefinitions();
  assert.ok(d && typeof d === 'object');
  assert.ok(d.streak_5 && d.streak_10 && d.math_master);
});
check('T02 isUnlocked false initially', function () {
  const s = new AchievementSystem();
  assert.strictEqual(s.isUnlocked('streak_5'), false);
});
check('T03 unlock returns entry with xp', function () {
  const s = new AchievementSystem();
  const e = s.unlock('streak_5');
  assert.ok(e);
  assert.strictEqual(e.xp, 50);
  assert.strictEqual(s.isUnlocked('streak_5'), true);
});
check('T04 duplicate unlock returns null', function () {
  const s = new AchievementSystem();
  s.unlock('streak_5');
  assert.strictEqual(s.unlock('streak_5'), null);
});
check('T05 queue receives unlocked entry', function () {
  const s = new AchievementSystem();
  s.unlock('streak_5');
  const q = s.getQueue();
  assert.ok(q.length >= 1);
  assert.strictEqual(q[q.length - 1].id, 'streak_5');
});
check('T06 clearQueue empties queue', function () {
  const s = new AchievementSystem();
  s.unlock('streak_5');
  s.clearQueue();
  assert.strictEqual(s.getQueue().length, 0);
});
check('T07 checkAll streak_5 triggers at best_streak>=5', function () {
  const s = new AchievementSystem();
  s.stats.best_streak = 5;
  const n = s.checkAll();
  assert.ok(n.indexOf('streak_5') >= 0);
  assert.strictEqual(s.isUnlocked('streak_5'), true);
});
check('T08 checkAll math_master triggers at total_correct>=100', function () {
  const s = new AchievementSystem();
  s.stats.total_correct = 100;
  s.checkAll();
  assert.strictEqual(s.isUnlocked('math_master'), true);
});
check('T09 checkAll first_win triggers at lessons_completed>0', function () {
  const s = new AchievementSystem();
  s.stats.lessons_completed = 1;
  s.checkAll();
  assert.strictEqual(s.isUnlocked('first_win'), true);
});
check('T10 checkAll perfect_lesson needs lessons_completed>0 AND last_lesson_perfect', function () {
  const s = new AchievementSystem();
  s.stats.lessons_completed = 1;
  s.checkAll();
  assert.strictEqual(s.isUnlocked('perfect_lesson'), false);
  const s2 = new AchievementSystem();
  s2.stats.lessons_completed = 1;
  s2.stats.last_lesson_perfect = true;
  s2.checkAll();
  assert.strictEqual(s2.isUnlocked('perfect_lesson'), true);
});
check('T11 save then load roundtrip', function () {
  const s = new AchievementSystem();
  s.stats.total_correct = 42;
  s.unlock('streak_5');
  const saved = s.save();
  const s2 = new AchievementSystem();
  s2.load(saved);
  assert.strictEqual(s2.stats.total_correct, 42);
  assert.strictEqual(s2.isUnlocked('streak_5'), true);
});
check('T12 onAnswer updates total_correct', function () {
  const s = new AchievementSystem();
  s.onAnswer(true, 1500);
  s.onAnswer(true, 2000);
  assert.strictEqual(s.stats.total_correct, 2);
});
check('T13 onLessonEnd updates stats and triggers first_win', function () {
  const s = new AchievementSystem();
  s.onLessonEnd(10, 0, 3);
  assert.strictEqual(s.stats.lessons_completed, 1);
  assert.strictEqual(s.stats.last_lesson_perfect, true);
  assert.strictEqual(s.stats.best_streak, 10);
  assert.strictEqual(s.isUnlocked('first_win'), true);
  assert.strictEqual(s.isUnlocked('perfect_lesson'), true);
  assert.strictEqual(s.isUnlocked('streak_5'), true);
});
check('T14 onLessonEnd imperfect lesson does NOT trigger perfect_lesson', function () {
  const s = new AchievementSystem();
  s.onLessonEnd(10, 2, 3);
  assert.strictEqual(s.stats.last_lesson_perfect, false);
  assert.strictEqual(s.isUnlocked('perfect_lesson'), false);
});
check('T15 onLessonEnd updates best_combo', function () {
  const s = new AchievementSystem();
  s.onLessonEnd(5, 0, 4);
  assert.strictEqual(s.stats.best_combo, 4);
  assert.strictEqual(s.isUnlocked('combo_x4'), true);
});
check('T16 unlock unknown id returns null', function () {
  const s = new AchievementSystem();
  assert.strictEqual(s.unlock('nonexistent_id'), null);
});
check('T17 checkAll twice does not duplicate unlock', function () {
  const s = new AchievementSystem();
  s.stats.best_streak = 10;
  s.checkAll();
  s.checkAll();
  assert.strictEqual(s.isUnlocked('streak_5'), true);
  assert.strictEqual(s.isUnlocked('streak_10'), true);
});
check('T18 definitions contain all expected ids', function () {
  const s = new AchievementSystem();
  const d = s.getDefinitions();
  ['streak_5', 'streak_10', 'speed_demon', 'perfect_lesson', 'first_win', 'math_master', 'combo_x4'].forEach(function (id) {
    assert.ok(d[id], 'missing ' + id);
  });
});
console.log('M9-D Achievements: pass=' + pass + ' fail=' + failed);
process.exit(failed ? 1 : 0);
