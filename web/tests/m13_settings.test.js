'use strict';
/* M13 focused contracts for SettingsState and PasswordChangeState. */
const assert = require('assert');
const path = require('path');
const JS = path.join(__dirname, '..', 'js');
require(path.join(JS, 'save.js'));
require(path.join(JS, 'state_manager.js'));
const mod = require(path.join(JS, 'settings_states.js'));
let pass = 0, fail = 0;
function check(name, fn) { try { fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.log('FAIL ' + name + ' :: ' + e.message); } }
function input(click) { return { consumeClick: () => click || null, consumePressedKey: () => null }; }
global.Game = { player: { brightness: 1, volume: 1, setBrightness(v) { this.brightness = v; }, setVolume(v) { this.volume = v; }, setFullscreen(v) { this.fullscreen = v; } }, states: { change() {} }, audio: { setMasterVolume(v) { this.volume = v; } } };
check('settings state contract', function () { const s = new mod.SettingsState(); s.enter(); assert.strictEqual(s.name, 'settings'); assert.strictEqual(typeof s.handleInput, 'function'); assert.strictEqual(Object.keys(s.buttons).length, 6); });
check('volume control persists and reports', function () { const s = new mod.SettingsState(); s.enter(); const before = s.volume; s.handleInput(input({ x: s.buttons.volume.x + 1, y: s.buttons.volume.y + 1 })); assert.notStrictEqual(s.volume, before); assert.ok(s.msg.indexOf('Âm lượng') >= 0); assert.strictEqual(Save.load(Save.KEYS.SETTINGS, {}).volume, s.volume); });
check('settings back routes to menu', function () { let target = null; global.Game.states.change = function (name) { target = name; }; const s = new mod.SettingsState(); s.enter(); s.handleInput(input({ x: s.buttons.back.x + 1, y: s.buttons.back.y + 1 })); assert.strictEqual(target, 'menu'); });
check('password state contract and back route', function () { let target = null; global.Game.states.change = function (name) { target = name; }; const p = new mod.PasswordChangeState(); p.enter(); assert.strictEqual(p.name, 'passwordChange'); assert.strictEqual(p.rects.length, 3); p.handleInput(input({ x: p.backBtn.x + 1, y: p.backBtn.y + 1 })); assert.strictEqual(target, 'settings'); });
console.log('M13_SETTINGS: pass=' + pass + ' fail=' + fail); process.exit(fail ? 1 : 0);
