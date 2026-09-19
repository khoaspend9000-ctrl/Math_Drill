(function (global) {
  'use strict';
  // M8-B Audio — exact port of audio.py (source of truth).
  // Python: .ogg-first fallback, core/extra sounds, BGM map+volumes,
  // combo tier >=10/>=5/>=3, master vol bgm=v*0.5 sfx=v, fever bgm*0.9.
  var L = global.GameLogger || { info: function () {}, warn: function () {}, error: function () {} };
  var fs = null, pathMod = null;
  try { if (typeof require === 'function') { fs = require('fs'); pathMod = require('path'); } } catch (_) {}
  function clamp01(v) { var n = Number(v); if (!isFinite(n)) return 0; if (n < 0) return 0; if (n > 1) return 1; return n; }
  // Exact port of _resolve_audio_file: .ogg candidate FIRST.
  function audioCandidates(filename) {
    var i = filename.lastIndexOf('.');
    var base = i >= 0 ? filename.slice(0, i) : filename;
    var ext = i >= 0 ? filename.slice(i) : '';
    var candidates = [filename];
    if (ext.toLowerCase() !== '.ogg') candidates.unshift(base + '.ogg');
    return candidates;
  }
  var CORE_SOUNDS = ['tra_loi_dung.mp3','tra_loi_sai.mp3','sound 1.mp3','sound 2.mp3','sound 3.mp3','sound 4.mp3','sound 5.mp3','sound 6.mp3','combo.mp3','xp_gain.mp3','level_up.mp3'];
  var EXTRA_SOUNDS = ['victory.mp3','gacha5sao.mp3','defeat.mp3','purchase.mp3'];
  var FEVER_SOUND = 'fever.mp3';
  var BGM_FILES = { menu: 'menu_bgm.mp3', gameplay: 'gameplay_bgm.mp3', victory: 'victory_bgm.mp3', defeat: 'defeat_bgm.mp3', default: 'nhac_nen.mp3' };
  var BGM_VOLUME_DEFAULTS = { menu: 0.15, gameplay: 0.3, victory: 0.8, defeat: 0.8, default: 0.3 };

  class SoundManager {
    constructor(basePath) {
      this.basePath = basePath || './';
      if (this.basePath && this.basePath.charAt(this.basePath.length - 1) !== '/') this.basePath += '/';
      this._fs = fs; this._pathMod = pathMod;
      this.mixerWorks = false; this.unlocked = false;
      this.soundEnabled = true; this.muted = false;
      this.bgmVolume = 0.3; this.sfxVolume = 0.7;
      this.currentBgm = null; this.bgmState = 'stopped';
      this.feverModeActive = false;
      this._sfxCache = new Map();
      this.coreSounds = {}; this.sounds = {};
      this._bgm = null; this._ctx = null;
      this._unlockBound = this.unlock.bind(this);
      var i; for (i = 0; i < CORE_SOUNDS.length; i++) { this.coreSounds[CORE_SOUNDS[i]] = null; this._sfxCache.set(CORE_SOUNDS[i], null); }
      for (i = 0; i < EXTRA_SOUNDS.length; i++) { this.sounds[EXTRA_SOUNDS[i]] = null; this._sfxCache.set(EXTRA_SOUNDS[i], null); }
      this._sfxCache.set(FEVER_SOUND, null);
    }
    static resolveAudioCandidates(filename) { return audioCandidates(filename); }
    _join(name) { if (this._pathMod && this._pathMod.join) return this._pathMod.join(this.basePath, name); return this.basePath + name; }
    resolveAudioFile(filename) {
      var candidates = audioCandidates(filename);
      if (this._fs && this._fs.existsSync) {
        for (var k = 0; k < candidates.length; k++) {
          try {
            if (this._fs.existsSync(candidates[k])) return candidates[k];
            var alt = this._join(candidates[k]);
            if (alt !== candidates[k] && this._fs.existsSync(alt)) return candidates[k];
          } catch (_) {}
        }
        return filename;
      }
      return candidates[0];
    }
    _fileExists(filename) {
      if (!this._fs || !this._fs.existsSync) return true;
      var resolved = this.resolveAudioFile(filename);
      var tries = [resolved, filename, this._join(resolved), this._join(filename)];
      for (var i = 0; i < tries.length; i++) { try { if (this._fs.existsSync(tries[i])) return true; } catch (_) {} }
      return false;
    }
    initAudio() { this.mixerWorks = true; this.bgmVolume = 0.3; return true; }
    preloadCoreSounds() { var n = 0, all = CORE_SOUNDS.concat(EXTRA_SOUNDS); for (var i = 0; i < all.length; i++) if (this.loadSound(all[i])) n++; return n; }
    loadSound(name) {
      if (!this.mixerWorks) return null;
      if (this._sfxCache.has(name) && this._sfxCache.get(name)) return this._sfxCache.get(name);
      var resolved = this.resolveAudioFile(name);
      if (!this._fileExists(name) && !this._fileExists(resolved)) { L.warn('[Audio] Sound file not found: ' + this._join(resolved)); return null; }
      var entry = { name: name, resolved: resolved, url: this._join(resolved), volume: this.sfxVolume };
      this._sfxCache.set(name, entry);
      if (Object.prototype.hasOwnProperty.call(this.coreSounds, name)) this.coreSounds[name] = entry; else this.sounds[name] = entry;
      return entry;
    }
    getBgmVolume(bgmName) { if (bgmName && Object.prototype.hasOwnProperty.call(BGM_VOLUME_DEFAULTS, bgmName)) return BGM_VOLUME_DEFAULTS[bgmName]; return 0.3; }

    attachUnlock(target) {
      var el = target || (typeof window !== 'undefined' ? window : null);
      if (!el || !el.addEventListener) return;
      el.addEventListener('pointerdown', this._unlockBound, { once: false });
      if (typeof window !== 'undefined') window.addEventListener('keydown', this._unlockBound, { once: false });
    }
    unlock() {
      if (this.unlocked) { this.mixerWorks = true; return Promise.resolve(true); }
      var self = this;
      function done(v) { self.unlocked = true; self.mixerWorks = true; return v; }
      try {
        var AudioCtx = global.AudioContext || global.webkitAudioContext;
        if (AudioCtx) {
          if (!this._ctx) { try { this._ctx = new AudioCtx(); } catch (e) { return Promise.resolve(done(true)); } }
          if (this._ctx && this._ctx.state === 'suspended' && this._ctx.resume) {
            var p = null; try { p = this._ctx.resume(); } catch (e) { return Promise.resolve(done(true)); }
            if (p && typeof p.then === 'function') return p.then(function () { return done(true); }, function () { return done(true); });
          }
        }
        return Promise.resolve(done(true));
      } catch (_) { return Promise.resolve(done(false)); }
    }
    _canPlay() { return !!(this.mixerWorks && this.unlocked && this.soundEnabled && !this.muted); }
    playSfx(name, volumeOverride) {
      if (!this._canPlay()) return false;
      var entry = this.loadSound(name);
      if (!entry) return false;
      try {
        if (typeof Audio !== 'undefined') {
          var node = new Audio(entry.url);
          node.volume = clamp01(volumeOverride != null ? volumeOverride : this.sfxVolume);
          node.preload = 'auto';
          var p = node.play();
          if (p && typeof p.catch === 'function') p.catch(function () {});
        }
        return true;
      } catch (_) { return false; }
    }
    playSound(soundName) {
      if (!soundName) return false;
      if (soundName === 'correct') { var pick = Math.floor(Math.random() * 6) + 1; return this.playSfx('sound ' + pick + '.mp3'); }
      if (soundName === 'wrong') return this.playSfx('tra_loi_sai.mp3');
      if (soundName === 'click')    return this.playSfx('sound 2.mp3', 0.5);      // button multiplier
      if (soundName === 'victory')  return this.playSfx('victory.mp3');
      if (soundName === 'defeat')   return this.playSfx('defeat.mp3');
      if (soundName === 'level_up') return this.playSfx('level_up.mp3');
      if (soundName === 'xp_gain')  return this.playSfx('xp_gain.mp3', 0.8);      // xp_gain multiplier
      if (soundName === 'achievement') return this.playSfx('sound 6.mp3');
      if (soundName === 'purchase') return this.playSfx('purchase.mp3');
      if (soundName === 'combo')    return this.playSfx('combo.mp3');
      if (soundName === 'fever')    return this.playSfx('fever.mp3');
      if (soundName === 'gacha_5sao') return this.playSfx('gacha5sao.mp3');
      if (soundName === 'menu_bgm') { this.playBgm('menu'); return true; }
      if (soundName === 'gameplay_bgm') { this.playBgm('gameplay'); return true; }
      if (soundName === 'victory_bgm') { this.playBgm('victory'); return true; }
      if (soundName === 'defeat_bgm')  { this.playBgm('defeat'); return true; }
      return this.playSfx(soundName);
    }
    playComboByStreak(streak) {
      var s = Number(streak) || 0;
      if (s >= 10) return this.playSfx('combo.mp3');
      if (s >= 5) return this.playSfx('sound 4.mp3');
      if (s >= 3) return this.playSfx('sound 5.mp3');
      return false;
    }
    comboSoundForStreak(streak) {
      var s = Number(streak) || 0;
      if (s >= 10) return 'combo.mp3';
      if (s >= 5) return 'sound 4.mp3';
      if (s >= 3) return 'sound 5.mp3';
      return null;
    }
    playBgm(bgmName) {
      var key = bgmName || 'default';
      if (!Object.prototype.hasOwnProperty.call(BGM_FILES, key)) key = 'default';
      if (!this.mixerWorks || !this.unlocked) { this.currentBgm = key; this.bgmState = 'stopped'; return false; }
      if (this.muted || !this.soundEnabled) { this.currentBgm = key; this.bgmState = 'stopped'; return false; }
      var vol = this.feverModeActive ? this.bgmVolume * 0.9 : this.getBgmVolume(key);
      this.currentBgm = key; this.bgmState = 'playing';
      this._bgmInfo = { file: BGM_FILES[key], volume: vol, loop: true };
      try {
        if (typeof Audio !== 'undefined') {
          if (this._bgm && typeof this._bgm.pause === 'function') { try { this._bgm.pause(); } catch (_) {} }
          var node = new Audio(this._join(this.resolveAudioFile(BGM_FILES[key])));
          node.loop = true; node.volume = clamp01(vol); this._bgm = node;
          var p = node.play(); if (p && typeof p.catch === 'function') p.catch(function () {});
        }
      } catch (_) {}
      return true;
    }
    stopBgm() { if (this._bgm && typeof this._bgm.pause === 'function') { try { this._bgm.pause(); } catch (_) {} } this._bgm = null; this.bgmState = 'stopped'; }
    stopAllAudio() { this.stopBgm(); }
    setMasterVolume(volume) { var v = clamp01(volume); this.bgmVolume = v * 0.5; this.sfxVolume = v; return v; }
    setVolume(volume) { return this.setMasterVolume(volume); }
    setMuted(m) { this.muted = !!m; if (this.muted) this.stopBgm(); return this.muted; }
    toggleMute() { return this.setMuted(!this.muted); }
    getAudioStatus() {
      var loaded = 0, k;
      for (k in this.coreSounds) if (this.coreSounds[k]) loaded++;
      for (k in this.sounds) if (this.sounds[k]) loaded++;
      return { mixer_works: this.mixerWorks, unlocked: this.unlocked, bgm_volume: this.bgmVolume, sfx_volume: this.sfxVolume, current_bgm: this.currentBgm, bgm_state: this.bgmState, fever_mode_active: this.feverModeActive, muted: this.muted, loaded_sounds: loaded };
    }
    _url(filename) { return this._join(filename); }
  }
  var _globalManager = null;
  function getSoundManager(basePath) { if (!_globalManager) _globalManager = new SoundManager(basePath); return _globalManager; }
  function cleanupAudio() { if (_globalManager) _globalManager.cleanup(); _globalManager = null; }
  SoundManager.prototype.activateFeverMode = function () { this.feverModeActive = true; this.playSfx(FEVER_SOUND); };
  SoundManager.prototype.deactivateFeverMode = function () { this.feverModeActive = false; };
  SoundManager.prototype.effectiveBgmVolume = function () { if (this.feverModeActive) return this.bgmVolume * 0.9; return this.getBgmVolume(this.currentBgm); };
  SoundManager.prototype.cleanup = function () {
    this.stopAllAudio(); this._sfxCache.clear();
    var i; for (i = 0; i < CORE_SOUNDS.length; i++) this.coreSounds[CORE_SOUNDS[i]] = null;
    var keys = Object.keys(this.sounds); for (i = 0; i < keys.length; i++) this.sounds[keys[i]] = null;
    this.mixerWorks = false; this.unlocked = false; this.currentBgm = null; this.feverModeActive = false;
  };
  var api = { SoundManager: SoundManager, getSoundManager: getSoundManager, cleanupAudio: cleanupAudio, resolveAudioCandidates: audioCandidates, CORE_SOUNDS: CORE_SOUNDS.slice(), EXTRA_SOUNDS: EXTRA_SOUNDS.slice(), FEVER_SOUND: FEVER_SOUND, BGM_FILES: Object.assign({}, BGM_FILES), BGM_VOLUME_DEFAULTS: Object.assign({}, BGM_VOLUME_DEFAULTS) };
  global.AudioSys = api; global.SoundManager = SoundManager;
  if (typeof module !== 'undefined' && module.exports) {
    // phase1 legacy: require('audio.js') used directly as SoundManager constructor.
    // Export constructor itself with static + namespace props attached.
    SoundManager.resolveAudioCandidates = SoundManager.resolveAudioCandidates || audioCandidates;
    SoundManager.AudioSys = api; SoundManager.getSoundManager = getSoundManager;
    SoundManager.cleanupAudio = cleanupAudio; SoundManager.CORE_SOUNDS = api.CORE_SOUNDS;
    SoundManager.EXTRA_SOUNDS = api.EXTRA_SOUNDS; SoundManager.BGM_FILES = api.BGM_FILES;
    SoundManager.BGM_VOLUME_DEFAULTS = api.BGM_VOLUME_DEFAULTS;
    module.exports = SoundManager;
  }
})(typeof window !== 'undefined' ? window : globalThis);
