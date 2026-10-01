// M15-D1/D2 focused tests.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const WEB = path.join(__dirname, '..');
// states_real.js extends BaseState from state_manager.js, so the real
// dependency order from m4_states.test.js is required here.
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

// Minimal Game + renderer stubs matching the shapes the states actually use.
function makeGame(level) {
  const texts = [];
  const R = {
    clear: function () {},
    fillRoundRect: function () {},
    text: function (t) { texts.push(String(t)); },
    line: function () {}, circle: function () {}, rect: function () {},
    fillCircle: function () {}, roundRect: function () {}, fill: function () {}
  };
  const player = { level: level || 1, grade: 3, exp: 0, gold: 0, expToNextLevel: 100, displayExp: 0 };
  const changes = [];
  // NOTE: the states read `global.Game` at call time, so the stub must be
  // assigned before any state is constructed and must not self-reference.
  const stub = {
    renderer: R,
    player: player,
    states: {
      current: null,
      change: function (n) { changes.push(n); }
    },
    audio: { playSfx: function () { return false; } },
    save: { load: function () { return null; }, set: function () {} },
    dataLoader: null
  };
  global.Game = stub;
  // Return the live sub-objects too, so tests can assert on them.
  return {
    R: R, texts: texts, changes: changes, player: player,
    Game: stub, states: stub.states, renderer: stub.renderer
  };
}

function keyInput(keys) {
  const queue = keys.slice();
  return {
    consumeClick: function () { return null; },
    consumePressedKey: function () { return queue.length ? { key: queue.shift() } : null; }
  };
}

function lesson(buttons) {
  const g = makeGame(1);
  const st = new statesReal.LessonState();
  g.states.current = st;
  st.buttons = buttons;
  st.feedback = null;
  const seen = { clicked: -1 };
  st._onOptionClick = function (b) { seen.clicked = st.buttons.indexOf(b); };
  return { g: g, st: st, seen: seen };
}

const FOUR = [{ value: 'A' }, { value: 'B' }, { value: 'C' }, { value: 'D' }];

check('D1-T01 a locked card never promises a developer milestone', function () {
  const src = fs.readFileSync(path.join(WEB, 'js', 'states_real.js'), 'utf8');
  const m = src.match(/this\.examMsg = c\.label \+ ([^;]+);/);
  assert.ok(m, 'locked-card message assignment not found');
  assert.ok(!/M\d/.test(m[1]),
    'locked-card message still exposes a milestone label: ' + m[1]);
});

check('D1-T02 clicking a locked card explains itself in plain language', function () {
  const g = makeGame(1);
  const st = new statesReal.MenuState();
  g.states.current = st;
  // M29.2 ships TimeAttackState (Desktop main.py:1745), so the exam card is now
  // the ONLY locked card. Time Attack was unlocked because Desktop main.py:674-676
  // opens it with no gate at all -- keeping it locked was a parity defect.
  // M30.1: the exam gate is Desktop main.py:690-698 -- unlock only when every
  // lesson for the grade is unlocked, otherwise report HOW MANY remain for 3.0s.
  const card = st.cards.filter(function (c) { return c.id === 'exam'; })[0];
  assert.ok(card, 'exam card must exist');
  st.examMsg = null; st.examMsgTimer = 0;
  st.handleInput({ consumeClick: function () { return { x: card.x + 5, y: card.y + 5 }; } });
  assert.ok(st.examMsg, 'player must be told how many lessons remain');
  assert.ok(!/M\d/.test(st.examMsg), 'message leaks a milestone: ' + st.examMsg);
  assert.ok(/\d/.test(st.examMsg), 'message must count the remaining lessons: ' + st.examMsg);
  assert.ok(st.examMsgTimer > 0, 'the notice must stay visible');
  assert.strictEqual(g.states.current, st, 'must not navigate away while locked');
});

check('D1-T03 the undelivered mode stays locked and Time Attack is now unlocked', function () {
  const st = new statesReal.MenuState();
  const locked = st.cards.filter(function (c) { return !!c.locked; })
    .map(function (c) { return c.id; }).sort();
  // M30.1: no card carries a static lock any more -- both gates are formulas.
  assert.deepStrictEqual(locked, [],
    'no card may carry a fabricated milestone lock, got ' + JSON.stringify(locked));
  // STRENGTHENED: the Time Attack card must now exist, be UNLOCKED, and route.
  const timeCard = st.cards.filter(function (c) { return c.id === 'time'; })[0];
  assert.ok(timeCard, 'Time Attack card must still be visible');
  assert.ok(!timeCard.locked, 'Time Attack must be unlocked now that M29.2 ships it');
});

check('D2-T01 the digit keys answer the lesson question', function () {
  const { st, seen } = lesson(FOUR);
  st.handleInput(keyInput(['Digit3']));
  assert.strictEqual(seen.clicked, 2, 'key 3 must select the third option');
});

check('D2-T02 all four digits map to their own option', function () {
  for (let n = 1; n <= 4; n++) {
    const { st, seen } = lesson(FOUR);
    st.handleInput(keyInput(['Digit' + n]));
    assert.strictEqual(seen.clicked, n - 1, 'Digit' + n + ' must select option ' + n);
  }
});

check('D2-T03 numpad and bare digits work too', function () {
  ['Numpad2', '2'].forEach(function (k) {
    const { st, seen } = lesson(FOUR);
    st.handleInput(keyInput([k]));
    assert.strictEqual(seen.clicked, 1, k + ' must select option 2');
  });
});

check('D2-T04 keys outside 1-4 are ignored, not mis-answered', function () {
  ['Digit5', 'Digit0', 'a', 'Escape', 'Tab', 'F1'].forEach(function (k) {
    const { st, seen } = lesson(FOUR);
    st.handleInput(keyInput([k]));
    assert.strictEqual(seen.clicked, -1, k + ' must not answer anything');
  });
});

check('D2-T05 a digit is ignored while feedback shows (no double answer)', function () {
  const { st, seen } = lesson(FOUR);
  st.feedback = { active: true };
  st.handleInput(keyInput(['Digit2']));
  assert.strictEqual(seen.clicked, -1, 'a digit must not score a second answer mid-feedback');
});

check('D2-T06 an out-of-range digit is clamped, never throws', function () {
  const { st, seen } = lesson([{ value: 'A' }, { value: 'B' }]);
  st.handleInput(keyInput(['Digit4']));
  assert.strictEqual(seen.clicked, -1, 'digit 4 with 2 buttons must do nothing');
});

check('D2-T07 Space and Enter still dismiss feedback (parity preserved)', function () {
  const { st } = lesson(FOUR);
  let dismissed = 0;
  st._dismissFeedback = function () { dismissed++; };
  st.feedback = { active: true };
  st.handleInput(keyInput([' ']));
  assert.strictEqual(dismissed, 1, 'Space must still dismiss the feedback overlay');
  st.feedback = { active: true };
  st.handleInput(keyInput(['Enter']));
  assert.strictEqual(dismissed, 2, 'Enter must still dismiss the feedback overlay');
});

check('D2-T08 the answers are visibly numbered so the shortcut is discoverable', function () {
  const g = makeGame(1);
  const st = new statesReal.LessonState();
  g.states.current = st;
  // Use the REAL option layout: the Desktop answer grid is 2x2
  // (main.py:1484-1488), so key order is top-left, top-right,
  // bottom-left, bottom-right.
  st.opts = ['A', 'B', 'C', 'D'];
  st.q = '1 + 1 = ?';
  st.ans = '2';
  st.feedback = null;
  st.buttons = st._buildOptionButtons();
  assert.strictEqual(st.buttons.length, 4, 'expected 4 rendered answers');
  // Grid geometry: 0/1 on the top row, 2/3 on the bottom row.
  assert.ok(st.buttons[0].y === st.buttons[1].y, 'buttons 1-2 share the top row');
  assert.ok(st.buttons[2].y > st.buttons[0].y, 'button 3 is on the lower row');
  g.texts.length = 0;
  st.draw(null, 1300, 800);
  ['1', '2', '3', '4'].forEach(function (n) {
    assert.ok(g.texts.indexOf(n) >= 0,
      'the answer number ' + n + ' must be drawn: got ' + JSON.stringify(g.texts));
  });
});

check('D2-T09 digit order follows the real 2x2 grid, not list order', function () {
  const g = makeGame(1);
  const st = new statesReal.LessonState();
  g.states.current = st;
  st.opts = ['A', 'B', 'C', 'D'];
  st.buttons = st._buildOptionButtons();
  st.feedback = null;
  for (let n = 1; n <= 4; n++) {
    let clicked = -1;
    st._onOptionClick = function (b) { clicked = b.index; };
    st.feedback = null;
    st.handleInput(keyInput(['Digit' + n]));
    assert.strictEqual(clicked, n - 1,
      'key ' + n + ' must select grid position ' + n);
  }
});

// __M15_D12_TAIL__

console.log('M15_UX_CONSISTENCY: pass=' + pass + ' fail=' + fail);
process.exit(fail === 0 ? 0 : 1);
