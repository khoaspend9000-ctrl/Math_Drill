'use strict';
/* M8-B: Audio — exact port of audio.py. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const _AudioMod = require('../js/audio.js');
const AudioSys = (_AudioMod && _AudioMod.SoundManager && _AudioMod.AudioSys) ? _AudioMod.AudioSys : _AudioMod;
const SoundManager = (_AudioMod && typeof _AudioMod === 'function') ? _AudioMod : (_AudioMod.SoundManager || AudioSys.SoundManager);
let pass = 0, failed = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('PASS  ' + name); }
  catch (e) { failed++; console.error('FAIL  ' + name + ' :: ' + (e && e.message)); }
}
function mk(base) { return new SoundManager(base || './'); }
const ROOT = path.join(__dirname, '..', '..');
check('T01 init defaults bgm0.3 sfx0.7', function () {
  const m = mk();
  assert.strictEqual(m.bgmVolume, 0.3);
  assert.strictEqual(m.sfxVolume, 0.7);
  assert.strictEqual(m.mixerWorks, false);
  assert.strictEqual(m.unlocked, false);
  assert.strictEqual(m.initAudio(), true);
  assert.strictEqual(m.mixerWorks, true);
});
check('T02 ogg-first candidates', function () {
  const c = AudioSys.resolveAudioCandidates('nhac_nen.mp3');
  assert.deepStrictEqual(c, ['nhac_nen.ogg', 'nhac_nen.mp3']);
  const m = mk();
  assert.strictEqual(m.resolveAudioFile('nhac_nen.mp3'), 'nhac_nen.ogg');
  assert.strictEqual(m.resolveAudioFile('sound 1.mp3'), 'sound 1.ogg');
});
check('T03 ogg passthrough', function () {
  assert.strictEqual(mk().resolveAudioFile('combo.ogg'), 'combo.ogg');
});
check('T04 missing asset null no crash', function () {
  const m = mk(); m.initAudio();
  assert.strictEqual(m.loadSound('missing_xyz_nope.mp3'), null);
});
check('T05 BGM state no autoplay before gesture', function () {
  const m = mk(); m.initAudio();
  assert.strictEqual(m.playBgm('menu'), false);
  assert.strictEqual(m.currentBgm, 'menu');
  assert.strictEqual(m.bgmState, 'stopped');
  m.unlocked = true;
  assert.strictEqual(m.playBgm('menu'), true);
  assert.strictEqual(m.currentBgm, 'menu');
  assert.strictEqual(m.bgmState, 'playing');
  assert.strictEqual(m._bgmInfo.file, 'menu_bgm.mp3');
  assert.strictEqual(m._bgmInfo.volume, 0.15);
  assert.strictEqual(m.playBgm('gameplay'), true);
  assert.strictEqual(m._bgmInfo.volume, 0.3);
  m.stopBgm();
  assert.strictEqual(m.bgmState, 'stopped');
});
check('T06 SFX gated by unlock mute', function () {
  const m = mk(); m.initAudio();
  assert.strictEqual(m.playSfx('tra_loi_dung.mp3'), false);
  m.unlocked = true;
  assert.strictEqual(m.playSfx('tra_loi_dung.mp3'), true);
  m.setMuted(true);
  assert.strictEqual(m.playSfx('tra_loi_dung.mp3'), false);
  m.setMuted(false);
  assert.strictEqual(m.playSfx('tra_loi_dung.mp3'), true);
});
check('T07 master volume bgm=v_half sfx=v', function () {
  const m = mk(); m.initAudio();
  assert.strictEqual(m.setMasterVolume(0.8), 0.8);
  assert.strictEqual(m.bgmVolume, 0.4);
  assert.strictEqual(m.sfxVolume, 0.8);
  assert.strictEqual(m.setMasterVolume(2), 1);
  assert.strictEqual(m.bgmVolume, 0.5);
  assert.strictEqual(m.setMasterVolume(-1), 0);
  assert.strictEqual(m.sfxVolume, 0);
});
check('T08 mute unmute toggle', function () {
  const m = mk(); m.initAudio(); m.unlocked = true;
  m.playBgm('gameplay');
  assert.strictEqual(m.bgmState, 'playing');
  m.setMuted(true);
  assert.strictEqual(m.muted, true);
  assert.strictEqual(m.bgmState, 'stopped');
  m.toggleMute();
  assert.strictEqual(m.muted, false);
});

check('T10 combo tier mapping', function () {
  const m = mk();
  assert.strictEqual(m.comboSoundForStreak(10), 'combo.mp3');
  assert.strictEqual(m.comboSoundForStreak(5), 'sound 4.mp3');
  assert.strictEqual(m.comboSoundForStreak(3), 'sound 5.mp3');
  assert.strictEqual(m.comboSoundForStreak(2), null);
  assert.strictEqual(m.comboSoundForStreak(0), null);
  m.initAudio(); m.unlocked = true;
  assert.strictEqual(m.playComboByStreak(10), true);
  assert.strictEqual(m.playComboByStreak(5), true);
  assert.strictEqual(m.playComboByStreak(3), true);
  assert.strictEqual(m.playComboByStreak(2), false);
});
check('T09 unlock resolves no rejection', function () {
  const m = mk(); m.initAudio();
  const p = m.unlock();
  assert.ok(p && typeof p.then === 'function');
  p.then(function (v) {
    try { assert.strictEqual(v, true); assert.strictEqual(m.unlocked, true); pass++; console.log('PASS  T09-async'); }
    catch (e) { failed++; console.error('FAIL  T09-async :: ' + (e && e.message)); }
    tail();
  }, function (e) { failed++; console.error('FAIL  T09-async :: ' + (e && e.message)); tail(); });
});
check('T11 cache same entry', function () {
  const m = mk(); m.initAudio();
  const a = m.loadSound('tra_loi_dung.mp3');
  const b = m.loadSound('tra_loi_dung.mp3');
  assert.ok(a); assert.strictEqual(a, b);
});
check('T12 cleanup resets', function () {
  const m = mk(); m.initAudio(); m.unlocked = true;
  m.loadSound('tra_loi_dung.mp3');
  m.playBgm('menu');
  m.cleanup();
  assert.strictEqual(m.mixerWorks, false);
  assert.strictEqual(m.unlocked, false);
  assert.strictEqual(m.currentBgm, null);
  assert.strictEqual(m.bgmState, 'stopped');
  assert.strictEqual(m.getAudioStatus().loaded_sounds, 0);
});
check('T14 inventory root ogg present gaps graceful', function () {
  const mustExist = ['tra_loi_dung.ogg', 'tra_loi_sai.ogg', 'sound 1.ogg', 'sound 2.ogg', 'sound 3.ogg', 'sound 4.ogg', 'sound 5.ogg', 'sound 6.ogg', 'combo.ogg', 'xp_gain.ogg', 'level_up.ogg', 'victory.ogg', 'defeat.ogg', 'purchase.ogg', 'gacha5sao.ogg', 'nhac_nen.ogg', 'bgm_main.ogg'];
  const missing = mustExist.filter(function (f) { return !fs.existsSync(path.join(ROOT, f)); });
  assert.deepStrictEqual(missing, [], 'missing: ' + missing.join(','));
  const gaps = ['fever.mp3', 'menu_bgm.mp3', 'gameplay_bgm.mp3', 'defeat_bgm.mp3'];
  const m = mk(); m.initAudio();
  gaps.forEach(function (g) { assert.strictEqual(m.loadSound(g), null, g + ' graceful null'); });
  // victory_bgm.ogg EXISTS on disk (25859 B) -> must load, not null.
  assert.ok(m.loadSound('victory_bgm.mp3'), 'victory_bgm should load');
});
let _tailDone = false;
function tail() {
  if (_tailDone) return; _tailDone = true;
  console.log('M8-B Audio: pass=' + pass + ' fail=' + failed);
  process.exit(failed ? 1 : 0);
}
setTimeout(tail, 1500);

