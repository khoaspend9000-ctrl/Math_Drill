// M15-E2 focused tests: on-screen numeric keypad for touch devices.
'use strict';
const assert = require('assert');
const path = require('path');
const WEB = path.join(__dirname, '..');
require(path.join(WEB, 'js', 'effects.js'));
require(path.join(WEB, 'js', 'save.js'));
require(path.join(WEB, 'js', 'player.js'));
require(path.join(WEB, 'js', 'state_manager.js'));
const statesReal = require(path.join(WEB, 'js', 'states_real.js'));

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log('PASS ' + name); pass++; }
  catch (e) { console.log('FAIL ' + name + ' :: ' + e.message); fail++; }
}

function game() {
  const texts = [];
  global.Game = {
    renderer: {
      clear: function () {}, fillRoundRect: function () {},
      text: function (t) { texts.push(String(t)); },
      line: function () {}, circle: function () {}, rect: function () {},
      fillCircle: function () {}, roundRect: function () {}, fill: function () {}
    },
    player: { level: 1, grade: 3, exp: 0, gold: 0, expToNextLevel: 100, displayExp: 0 },
    states: { current: null, change: function () {} },
    audio: { playSfx: function () { return false; } },
    save: { load: function () { return null; }, set: function () {} },
    dataLoader: null
  };
  return texts;
}

// Force touch on/off regardless of the machine running the test.
function withTouch(on) {
  const g = global.Game || game();
  if (on) {
    g.engine = { WIDTH: 1300, HEIGHT: 800, isTouch: true };
  } else {
    delete g.engine;
  }
  return g;
}

function lessonWithKeypad() {
  withTouch(true);
  const st = new statesReal.LessonState();
  global.Game.states.current = st;
  st.opts = ['A', 'B', 'C', 'D'];
  st.buttons = st._buildOptionButtons();
  st.feedback = null;
  return st;
}

check('E2-T01 a touch device gets a keypad and a desktop device does not', function () {
  game();
  const touchLesson = lessonWithKeypad();
  assert.ok(Array.isArray(touchLesson.keypad) && touchLesson.keypad.length === 4,
    'a touch device must get four keypad keys');

  withTouch(false);
  const deskLesson = new statesReal.LessonState();
  assert.strictEqual(deskLesson.keypad, null,
    'a desktop device must not get an on-screen keypad (it has the D2 digit row)');
});

check('E2-T02 the keypad sits below the answers and inside the 1300x800 design', function () {
  const st = lessonWithKeypad();
  const answersBottom = Math.max.apply(null, st.buttons.map(function (b) { return b.y + b.h; }));
  const padTop = Math.min.apply(null, st.keypad.map(function (k) { return k.y; }));
  assert.ok(padTop > answersBottom,
    'keypad must not overlap the answer grid (answers end ' + answersBottom +
    ', keypad starts ' + padTop + ')');
  st.keypad.forEach(function (k) {
    assert.ok(k.x >= 0 && k.y >= 0 && k.x + k.w <= 1300 && k.y + k.h <= 800,
      'key ' + k.digit + ' leaves the logical canvas: ' + JSON.stringify(k));
  });
});

check('E2-T03 the keypad does not cover the back button', function () {
  const st = lessonWithKeypad();
  const b = st.backBtn;
  st.keypad.forEach(function (k) {
    const overlap = k.x < b.x + b.w && k.x + k.w > b.x && k.y < b.y + b.h && k.y + k.h > b.y;
    assert.ok(!overlap, 'key ' + k.digit + ' overlaps the back button');
  });
});

check('E2-T04 tapping a keypad key answers the matching option', function () {
  const st = lessonWithKeypad();
  for (let n = 1; n <= 4; n++) {
    let clicked = -1;
    st._onOptionClick = function (b) { clicked = b.index; };
    st.feedback = null;
    const k = st.keypad.filter(function (x) { return x.digit === n; })[0];
    st.handleInput({ consumeClick: function () { return { x: k.x + 5, y: k.y + 5 }; } });
    assert.strictEqual(clicked, n - 1, 'keypad key ' + n + ' must answer option ' + n);
  }
});

check('E2-T05 a keypad tap is ignored while feedback shows (no double answer)', function () {
  const st = lessonWithKeypad();
  // With feedback up, a tap anywhere dismisses and advances (Desktop
  // main.py:1508-1513) — that is correct, so the test needs the game
  // manager the dismiss path calls. The point under test is that the
  // keypad must NOT score a second answer.
  st.gm = { advanceQuestion: function () { return { finished: false, stats: {} }; } };
  let clicked = -1;
  let dismissed = 0;
  st._onOptionClick = function (b) { clicked = b.index; };
  const realDismiss = st._dismissFeedback.bind(st);
  st._dismissFeedback = function () { dismissed++; realDismiss(); };
  st.feedback = { active: true, dismissed: false };
  const k = st.keypad[1];
  st.handleInput({ consumeClick: function () { return { x: k.x + 5, y: k.y + 5 }; } });
  assert.strictEqual(clicked, -1, 'the answer is already given; no second score');
  assert.strictEqual(dismissed, 1, 'the tap should dismiss the feedback, as on Desktop');
});

check('E2-T06 the keypad is drawn and its digits are visible', function () {
  const texts = game();
  const st = lessonWithKeypad();
  st.q = '1 + 1 = ?';
  st.ans = '2';
  st.feedback = null;
  texts.length = 0;
  st.draw(null, 1300, 800);
  ['1', '2', '3', '4'].forEach(function (n) {
    assert.ok(texts.indexOf(n) >= 0, 'keypad digit ' + n + ' must be drawn');
  });
});

check('E2-T07 no keypad is drawn on a desktop device', function () {
  const texts = game();
  withTouch(false);
  const st = new statesReal.LessonState();
  global.Game.states.current = st;
  st.opts = ['A', 'B', 'C', 'D'];
  st.buttons = st._buildOptionButtons();
  st.q = '1 + 1 = ?';
  st.ans = '2';
  st.feedback = null;
  texts.length = 0;
  st.draw(null, 1300, 800);
  assert.strictEqual(st.keypad, null);
  assert.ok(texts.indexOf('PHIM SO') < 0,
    'the keypad caption must not appear on a desktop device');
});

check('E2-T08 tapping a real answer button still works on a touch device', function () {
  const st = lessonWithKeypad();
  let clicked = -1;
  st._onOptionClick = function (b) { clicked = b.index; };
  st.feedback = null;
  const b = st.buttons[2];
  st.handleInput({ consumeClick: function () { return { x: b.x + 5, y: b.y + 5 }; } });
  assert.strictEqual(clicked, 2, 'tapping the answer button itself must still work');
});

// __M15_E2_TAIL__

console.log('M15_MOBILE_TOUCH: pass=' + pass + ' fail=' + fail);
process.exit(fail === 0 ? 0 : 1);
