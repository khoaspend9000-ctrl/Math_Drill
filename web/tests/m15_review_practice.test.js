'use strict';
/* M15-B1/B2 focused contracts: ReviewState + PracticeState (Desktop parity)
   for the previously no-op "XEM LỖI" buttons on Victory/Defeat.
   source of truth: main.py:1005-1417.
   Repro before this fix: clicking XEM LỖI only logged
   "ReviewState sẽ port ở M8" — nothing changed for the player. */
const assert = require('assert');
const path = require('path');
const JS = path.join(__dirname, '..', 'js');
require(path.join(JS, 'save.js'));
require(path.join(JS, 'state_manager.js'));
require(path.join(JS, 'player.js'));
const mod = require(path.join(JS, 'settings_states.js'));

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('PASS  ' + name); }
  catch (e) { fail++; console.log('FAIL  ' + name + ' :: ' + e.message); }
}
function input(click) {
  return { consumeClick: () => click || null, consumePressedKey: () => null };
}
function rendererStub() {
  const calls = { clear: 0, text: 0, fillRoundRect: 0, texts: [] };
  return {
    calls: calls,
    clear: function () { calls.clear++; },
    text: function (s) { calls.text++; calls.texts.push(String(s)); },
    fillRoundRect: function () { calls.fillRoundRect++; },
    image: function () {}
  };
}
function gameWithRoute() {
  let target = null, params = null;
  const r = rendererStub();
  global.Game = {
    player: {},
    audio: { setMasterVolume: function () {} },
    renderer: r,
    states: { change: function (n, p) { target = n; params = p; } }
  };
  return { renderer: r, get target() { return target; }, get params() { return params; } };
}

// ---------------- analyzeReviewErrors (main.py:1335-1363) ----------------
check('T01 empty transcript => no mistakes and no suggestions', function () {
  const p = mod.analyzeReviewErrors([]);
  assert.deepStrictEqual(p, { operation_errors: {}, common_mistakes: [], suggestions: [] });
  assert.deepStrictEqual(mod.analyzeReviewErrors(null), p);
});

check('T02 errors counted per operation, top one reported', function () {
  const p = mod.analyzeReviewErrors([
    { operation: 'add' }, { operation: 'sub' }, { operation: 'add' }
  ]);
  assert.strictEqual(p.operation_errors.add, 2);
  assert.strictEqual(p.operation_errors.sub, 1);
  assert.strictEqual(p.common_mistakes.length, 1);
  assert.ok(p.common_mistakes[0].indexOf('add') >= 0, 'mentions the top op');
  assert.ok(p.suggestions[0].indexOf('add') >= 0, 'suggests practising the top op');
});

check('T03 suggestion tier follows the error count (>=5 / >=3 / <3)', function () {
  const mk = n => mod.analyzeReviewErrors(Array.from({ length: n }, () => ({ operation: 'x' })));
  assert.ok(mk(5).suggestions.some(s => s === 'REVIEW_SUG_5'), '>=5 tier');
  assert.ok(mk(3).suggestions.some(s => s === 'REVIEW_SUG_3'), '>=3 tier');
  assert.ok(mk(2).suggestions.some(s => s === 'REVIEW_SUG_1'), '1-2 tier');
  assert.ok(mk(2).suggestions.length >= 1, 'a suggestion is always produced');
});

check('T04 missing operation falls back to "unknown" (main.py:1346)', function () {
  const p = mod.analyzeReviewErrors([{}, { operation: null }]);
  assert.strictEqual(p.operation_errors.unknown, 2);
});

// ---------------- ReviewState ----------------
check('T05 ReviewState enter stores transcript, lesson and next', function () {
  const r = new mod.ReviewState();
  assert.strictEqual(r.name, 'review');
  const wa = [{ question: '2+2?', userAnswer: '3', correctAnswer: '4', operation: 'add', lesson: 'B_1' }];
  r.enter({ wrongAnswers: wa, lessonTitle: 'B_1', next: 'menu' });
  assert.strictEqual(r.wrongAnswers, wa);
  assert.strictEqual(r.lessonTitle, 'B_1');
  assert.strictEqual(r.nextState, 'menu');
  assert.strictEqual(r.patterns.operation_errors.add, 1);
  assert.ok(r.continueBtn && r.practiceBtn && r.backBtn, 'three buttons exist');
});

check('T06 ReviewState continue -> caller next; back -> menu', function () {
  let h = gameWithRoute();
  const r = new mod.ReviewState();
  r.enter({ wrongAnswers: [], next: 'victory' });
  r.handleInput(input({ x: r.continueBtn.x + 1, y: r.continueBtn.y + 1 }));
  assert.strictEqual(h.target, 'victory', 'continue honours the caller next state');
  h = gameWithRoute();
  r.enter({ wrongAnswers: [], next: 'defeat' });
  r.handleInput(input({ x: r.backBtn.x + 1, y: r.backBtn.y + 1 }));
  assert.strictEqual(h.target, 'menu', 'back always goes to menu');
});

check('T07 practice entry requires wrong answers (main.py:1368)', function () {
  let h = gameWithRoute();
  const r = new mod.ReviewState();
  r.enter({ wrongAnswers: [] });
  r.handleInput(input({ x: r.practiceBtn.x + 1, y: r.practiceBtn.y + 1 }));
  assert.strictEqual(h.target, null, 'no transcript => practice must not navigate');
  h = gameWithRoute();
  r.enter({ wrongAnswers: [{ question: 'q', correctAnswer: 'a', operation: 'add' }] });
  r.handleInput(input({ x: r.practiceBtn.x + 1, y: r.practiceBtn.y + 1 }));
  assert.strictEqual(h.target, 'practice');
  assert.strictEqual(h.params.wrongAnswers.length, 1, 'transcript forwarded');
  assert.strictEqual(h.params.next, 'menu');
});

check('T08 ReviewState draw renders count, analysis and practice button', function () {
  const g = gameWithRoute();
  const r = new mod.ReviewState();
  r.enter({
    wrongAnswers: [
      { question: 'q1?', userAnswer: '6', correctAnswer: '7', operation: 'add' },
      { question: 'q2?', userAnswer: '8', correctAnswer: '7', operation: 'sub' },
      { question: 'q3?', userAnswer: '9', correctAnswer: '7', operation: 'add' }
    ]
  });
  r.draw(null, 1300, 800);
  const t = g.renderer.calls.texts.join('|');
  assert.ok(t.indexOf('So cau sai: 3') >= 0, 'error count shown: ' + t);
  assert.ok(t.indexOf('add') >= 0, 'top operation shown');
  assert.ok(t.indexOf('q1?') >= 0, 'first wrong question shown');
  assert.ok(g.renderer.calls.fillRoundRect >= 0, 'draw ran');
  assert.ok(t.indexOf('LUYEN TAP LAI') >= 0, 'practice button label drawn');
});

check('T09 ReviewState draw with no errors shows the praise line (main.py:1383)', function () {
  const g = gameWithRoute();
  const r = new mod.ReviewState();
  r.enter({ wrongAnswers: [] });
  r.draw(null, 1300, 800);
  const t = g.renderer.calls.texts.join('|');
  assert.ok(t.indexOf('KHONG CO CAU SAI') >= 0, 'praise line shown');
  assert.ok(t.indexOf('LUYEN TAP LAI') < 0, 'practice button hidden without errors (main.py:1416)');
});

// ---------------- PracticeState (main.py:1220-1323) ----------------
check('T10 practiceOptions: 4 unique options containing the answer', function () {
  ['12', '0', '-3', '1000000'].forEach(function (a) {
    const o = mod.practiceOptions(a);
    assert.strictEqual(o.length, 4, 'numeric ' + a + ' -> 4 opts');
    assert.strictEqual(new Set(o).size, 4, 'unique for ' + a);
    assert.ok(o.indexOf(a) >= 0, 'contains answer ' + a);
  });
  ['Bằng nhau', 'Hình vuông', 'Đồng hồ'].forEach(function (a) {
    const o = mod.practiceOptions(a);
    assert.strictEqual(o.length, 4, 'text -> 4 opts');
    assert.strictEqual(new Set(o).size, 4, 'unique text');
    assert.ok(o.indexOf(a) >= 0, 'contains answer');
  });
});

check('T11 PracticeState caps the transcript at 3 (main.py:1223)', function () {
  const p = new mod.PracticeState();
  const wa = Array.from({ length: 7 }, (_, i) => ({
    question: 'q' + i, correctAnswer: String(10 + i), operation: 'add'
  }));
  p.enter({ wrongAnswers: wa, lessonTitle: 'B_1', next: 'review' });
  assert.strictEqual(p.wrongAnswers.length, 3, 'only the first 3 are re-asked');
  assert.strictEqual(p.index, 0);
  assert.strictEqual(p.q, 'q0');
  assert.strictEqual(p.ans, '10');
  assert.strictEqual(p.buttons.length, 4, '4 answer buttons');
  assert.strictEqual(p.buttons.filter(b => b.value === '10').length, 1, 'exactly one correct button');
});

check('T12 PracticeState wrong answer -> feedback, correct button -> +1', function () {
  const p = new mod.PracticeState();
  p.enter({ wrongAnswers: [{ question: '5+5?', correctAnswer: '10' }] });
  const wrong = p.buttons.find(b => b.value !== p.ans);
  p.handleInput(input({ x: wrong.x + 1, y: wrong.y + 1 }));
  assert.ok(p.feedback && p.feedback.active, 'feedback shows');
  assert.strictEqual(p.feedback.correct, false);
  assert.strictEqual(p.feedback.correctAnswer, '10', 'correct answer is shown on wrong');
  assert.strictEqual(p.correctCount, 0);
  // dismiss feedback (click anywhere, main.py:1255-1260)
  p.handleInput(input({ x: 5, y: 5 }));
  assert.strictEqual(p.index, 1, 'advanced to the completion point');
  // rebuild and answer correctly (buttons are reshuffled on re-enter,
  // so the correct target must be looked up again, not reused)
  p.enter({ wrongAnswers: [{ question: '5+5?', correctAnswer: '10' }] });
  const right2 = p.buttons.find(b => b.value === p.ans);
  p.handleInput(input({ x: right2.x + 1, y: right2.y + 1 }));
  assert.strictEqual(p.feedback.correct, true);
  assert.strictEqual(p.correctCount, 1, 'correct count increments');
});

check('T13 PracticeState completion reports through victory (main.py:1283)', function () {
  const h = gameWithRoute();
  const p = new mod.PracticeState();
  p.enter({ wrongAnswers: [{ question: 'q', correctAnswer: '7' }, { question: 'r', correctAnswer: '8' }], lessonTitle: 'B_2' });
  for (let i = 0; i < 2; i++) {
    const right = p.buttons.find(b => b.value === p.ans);
    p.handleInput(input({ x: right.x + 1, y: right.y + 1 }));
    p.handleInput(input({ x: 5, y: 5 })); // dismiss
  }
  assert.strictEqual(h.target, 'victory');
  assert.ok(h.params.title.indexOf('LUYEN TAP') >= 0 || h.params.title.indexOf('LUYỆN TẬP') >= 0,
    'victory title announces the practice session: ' + h.params.title);
  assert.strictEqual(h.params.stats.correct, 2);
  assert.strictEqual(h.params.stats.total, 2);
  assert.strictEqual(h.params.stats.accuracy, 100);
  assert.strictEqual(h.params.score, 20, 'score = correct*10 (main.py:1283)');
  assert.strictEqual(h.params.lessonTitle, 'B_2');
});

check('T14 PracticeState HUY returns to review with the same transcript', function () {
  const h = gameWithRoute();
  const p = new mod.PracticeState();
  const wa = [{ question: 'q', correctAnswer: '7' }];
  p.enter({ wrongAnswers: wa, lessonTitle: 'B_3', next: 'menu' });
  p.handleInput(input({ x: p.cancelBtn.x + 1, y: p.cancelBtn.y + 1 }));
  assert.strictEqual(h.target, 'review');
  // enter() slices to the first 3 (main.py:1223) so compare content, not identity
  assert.deepStrictEqual(h.params.wrongAnswers, wa, 'transcript preserved');
  assert.strictEqual(h.params.next, 'menu');
});

check('T15 PracticeState draw renders title, progress and question', function () {
  const g = gameWithRoute();
  const p = new mod.PracticeState();
  p.enter({ wrongAnswers: [{ question: '9*9?', correctAnswer: '81' }] });
  p.draw(null, 1300, 800);
  const t = g.renderer.calls.texts.join('|');
  assert.ok(t.indexOf('LUYEN TAP LAI') >= 0, 'title');
  assert.ok(t.indexOf('Cau 1/1') >= 0, 'progress');
  assert.ok(t.indexOf('9*9?') >= 0, 'question');
  assert.ok(t.indexOf('81') >= 0, 'correct answer appears among the buttons');
});

// ---------------- wiring: the buttons that used to be no-ops ----------------
check('T16 Victory/Defeat XEM LỔI now route to review (repro: was console-only)', function () {
  const fs = require('fs');
  const STATES = fs.readFileSync(path.join(JS, 'states_real.js'), 'utf8');
  assert.ok(STATES.indexOf("L.info('[Victory] Xem lỗi") < 0, 'victory stub removed');
  assert.ok(STATES.indexOf("L.info('[Defeat] Xem lỗi") < 0, 'defeat stub removed');
  const changes = (STATES.match(/states\.change\('review'/g) || []).length;
  assert.strictEqual(changes, 2, 'both victory and defeat open review, got ' + changes);
  assert.ok(STATES.indexOf('M15-B1') >= 0, 'both sites are annotated');
});

check('T17 main.js registers review + practice and loads settings_states.js', function () {
  const fs = require('fs');
  const MAIN = fs.readFileSync(path.join(JS, 'main.js'), 'utf8');
  assert.ok(MAIN.indexOf("register('review'") >= 0, 'review registered');
  assert.ok(MAIN.indexOf("register('practice'") >= 0, 'practice registered');
  assert.ok(MAIN.indexOf('const ReviewState = window.ReviewState') >= 0, 'ReviewState bound from window');
  assert.ok(MAIN.indexOf('const PracticeState = window.PracticeState') >= 0, 'PracticeState bound from window');
  const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const si = HTML.indexOf('js/settings_states.js');
  const mi = HTML.indexOf('js/main.js');
  assert.ok(si >= 0 && mi >= 0 && si < mi, 'settings_states.js loads before main.js');
});

check('T18 end-to-end: lesson wrong answer -> transcript -> victory -> review', function () {
  const { GameManager } = require(path.join(JS, 'game_manager.js'));
  const { PlayerData } = require(path.join(JS, 'player.js'));
  const player = new PlayerData();
  const gm = new GameManager(player);
  gm.totalQuestions = 2;
  const rec = { question: '3+3?', userAnswer: '5', correctAnswer: '6', operation: 'add', lesson: 'B_5' };
  gm.onCorrect(); gm.advanceQuestion();
  gm.onWrong(rec); gm.advanceQuestion();
  const res = gm.advanceQuestion();
  assert.strictEqual(res.finished, true);
  assert.strictEqual(res.stats.wrongAnswers.length, 1, 'lesson transcript reaches the session stats');
  // victory params carry it, review consumes it (main.py:1146-1149)
  const h = gameWithRoute();
  const v = new mod.ReviewState();
  v.enter({ wrongAnswers: res.stats.wrongAnswers, lessonTitle: 'B_5', next: 'menu' });
  assert.strictEqual(v.patterns.operation_errors.add, 1, 'analysis sees the real lesson operation');
  v.handleInput(input({ x: v.practiceBtn.x + 1, y: v.practiceBtn.y + 1 }));
  assert.strictEqual(h.target, 'practice', 'practice opens from a real lesson transcript');
  assert.strictEqual(h.params.wrongAnswers[0].correctAnswer, '6');
});

console.log('M15_REVIEW_PRACTICE: pass=' + pass + ' fail=' + fail);
process.exit(fail ? 1 : 0);

