'use strict';
/* M14-D3 regression: modifier combinations (Ctrl/Alt/Meta) must never reach the
   canvas key queue.
   Bug being guarded: `_onKeyDown` used to enqueue every keydown, and every text
   field in the game appends any event whose `key.length === 1`. Chromium reports
   Ctrl+A / Ctrl+C / Ctrl+V / Ctrl+Z / Alt+A with key 'a'/'c'/'v'/'z', so pressing
   Ctrl+A while typing silently corrupted usernames and passwords (a user could no
   longer log in with the password they had just typed).
   The fix lives in web/js/input.js `_onKeyDown`.
   Proven in real Chromium: live production 4 pass / 14 fail, fixed build 18/18. */
const assert = require('assert');
const InputManager = require('../js/input.js');

let pass = 0, failed = 0;
const errLog = [];
const _err = console.error;
console.error = function () { errLog.push(Array.prototype.slice.call(arguments).join(' ')); };
function check(name, fn) {
  try { fn(); pass++; console.log('PASS  ' + name); }
  catch (e) { failed++; _err.call(console, 'FAIL  ' + name + ' :: ' + (e && e.message)); }
}

/* Capture the real window keydown handler so the production code path runs. */
let keyHandler = null;
global.window = {
  addEventListener: function (type, fn) { if (type === 'keydown') keyHandler = fn; },
  removeEventListener: function () {}
};
function mockCanvas() {
  return {
    width: 2600, height: 1600, style: {},
    addEventListener: function () {},
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 1300, height: 800 }; }
  };
}
function freshInput() {
  InputManager._singleton = null;
  keyHandler = null;
  const input = new InputManager(mockCanvas());
  input.setLogicalSize(1300, 800);
  return input;
}
/* Feed a synthetic keydown exactly as Chromium would report it. */
function keydown(input, k, opts) {
  const o = opts || {};
  keyHandler({
    key: k, code: o.code || ('Key' + String(k).toUpperCase()),
    ctrlKey: !!o.ctrl, metaKey: !!o.meta, altKey: !!o.alt, shiftKey: !!o.shift,
    repeat: false
  });
}
function drain(input) {
  const out = [];
  let k = input.consumePressedKey();
  while (k) { out.push(k.key); k = input.consumePressedKey(); }
  return out;
}

check('T01 Shift is not treated as a bare modifier press', function () {
  const input = freshInput();
  keydown(input, 'Shift', { code: 'ShiftLeft', shift: true });
  assert.deepStrictEqual(drain(input), [], 'bare Shift must not enqueue');
});

check('T02 Control / Alt / Meta presses do not enqueue', function () {
  const input = freshInput();
  keydown(input, 'Control', { code: 'ControlLeft', ctrl: true });
  keydown(input, 'Alt', { code: 'AltLeft', alt: true });
  keydown(input, 'Meta', { code: 'MetaLeft', meta: true });
  keydown(input, 'CapsLock');
  keydown(input, 'Dead');
  keydown(input, 'Unidentified');
  assert.deepStrictEqual(drain(input), [], 'bare modifiers must not enqueue');
});

check('T03 Ctrl+A does NOT enqueue the letter a', function () {
  const input = freshInput();
  keydown(input, 'a', { code: 'KeyA', ctrl: true });
  assert.deepStrictEqual(drain(input), [], 'Ctrl+A must be a no-op (was the reported bug)');
});

check('T04 Ctrl+C / Ctrl+V / Ctrl+X / Ctrl+Z / Ctrl+Y / Ctrl+S do not enqueue', function () {
  const input = freshInput();
  ['c', 'v', 'x', 'z', 'y', 's'].forEach(function (ch) {
    keydown(input, ch, { code: 'Key' + ch.toUpperCase(), ctrl: true });
  });
  assert.deepStrictEqual(drain(input), [], 'every Ctrl+letter must be a no-op');
});

check('T05 Alt+A and Meta+A do not enqueue', function () {
  const input = freshInput();
  keydown(input, 'a', { code: 'KeyA', alt: true });
  keydown(input, 'a', { code: 'KeyA', meta: true });
  assert.deepStrictEqual(drain(input), [], 'Alt/Meta combinations must be no-ops');
});

check('T06 Ctrl+Shift+A must not enqueue either', function () {
  const input = freshInput();
  keydown(input, 'A', { code: 'KeyA', ctrl: true, shift: true });
  assert.deepStrictEqual(drain(input), [], 'Ctrl+Shift+A must be a no-op');
});

check('T07 plain typing still enqueues exactly the typed characters', function () {
  const input = freshInput();
  keydown(input, 'p'); keydown(input, 'w'); keydown(input, '1');
  assert.deepStrictEqual(drain(input), ['p', 'w', '1']);
});

check('T08 shifted characters still enqueue (Shift must not be over-filtered)', function () {
  const input = freshInput();
  keydown(input, 'A', { shift: true });
  keydown(input, '!', { shift: true });
  keydown(input, '+', { shift: true });
  assert.deepStrictEqual(drain(input), ['A', '!', '+']);
});

check('T09 Backspace / Tab / Enter still enqueue (editing preserved)', function () {
  const input = freshInput();
  keydown(input, 'Backspace', { code: 'Backspace' });
  keydown(input, 'Tab', { code: 'Tab' });
  keydown(input, 'Enter', { code: 'Enter' });
  keydown(input, 'NumpadEnter', { code: 'NumpadEnter' });
  assert.deepStrictEqual(drain(input), ['Backspace', 'Tab', 'Enter', 'NumpadEnter']);
});

check('T10 arrow keys and Escape still enqueue (navigation preserved)', function () {
  const input = freshInput();
  keydown(input, 'ArrowUp', { code: 'ArrowUp' });
  keydown(input, 'ArrowDown', { code: 'ArrowDown' });
  keydown(input, 'Escape', { code: 'Escape' });
  assert.deepStrictEqual(drain(input), ['ArrowUp', 'ArrowDown', 'Escape']);
});

check('T11 a full password-typing session is not corrupted by Ctrl+A', function () {
  const input = freshInput();
  let buffer = '';
  function apply() {
    let k = input.consumePressedKey();
    while (k) {
      if (k.key === 'Backspace') buffer = buffer.slice(0, -1);
      else if (k.key && k.key.length === 1) buffer += k.key;
      k = input.consumePressedKey();
    }
  }
  ['p', 'w', '1'].forEach(function (ch) { keydown(input, ch); apply(); });
  assert.strictEqual(buffer, 'pw1');
  keydown(input, 'a', { code: 'KeyA', ctrl: true }); apply();   // user tries select-all
  keydown(input, 'c', { code: 'KeyC', ctrl: true }); apply();
  assert.strictEqual(buffer, 'pw1', 'Ctrl+A / Ctrl+C must not append letters');
  keydown(input, 'Backspace', { code: 'Backspace' }); apply();
  assert.strictEqual(buffer, 'pw', 'Backspace must still delete');
});

check('T12 keyQueue entries keep the shape consumers expect', function () {
  const input = freshInput();
  keydown(input, 'x', { code: 'KeyX' });
  const k = input.consumePressedKey();
  assert.strictEqual(k.key, 'x');
  assert.strictEqual(k.code, 'KeyX');
  assert.strictEqual(typeof k.time, 'number');
  assert.strictEqual(k.repeat, false);
});

console.log('\nM14-D3-CONTROLKEYS: pass=' + pass + ' fail=' + failed +
  ' consoleErrors=' + errLog.length);
console.error = _err;
process.exit(failed || errLog.length ? 1 : 0);
