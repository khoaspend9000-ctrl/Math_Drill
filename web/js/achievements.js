(function (global) {
  'use strict';
  // M9-D Achievements - port of game_init.py achievement logic.
  var L = global.GameLogger || { info: function () {}, warn: function () {}, error: function () {} };
  var fs = null, pathMod = null;
  try { if (typeof require === 'function') { fs = require('fs'); pathMod = require('path'); } } catch (_) {}

  var DEFAULT_DATA = {
    /* M11 fix: fallback definitions must mirror the shipped
       web/data/achievements.json exactly (9 ids). The old fallback
       missed speed_demon / time_attack_50 / time_attack_100 / combo_x4,
       which made T15/T18 unlock checks fail when no dataPath is given. */
    streak_5: { name: 'Chuoi 5!', desc: '5 dung lien tiep', icon: '🔥', xp: 50 },
    streak_10: { name: 'Chuoi 10!', desc: '10 dung lien tiep', icon: '💎', xp: 150 },
    speed_demon: { name: 'Nhanh nhu chop', desc: 'Tra loi dung trong 2 giay', icon: '⚡', xp: 30 },
    perfect_lesson: { name: 'Hoan hao!', desc: 'Khong sai cau nao', icon: '⭐', xp: 200 },
    time_attack_50: { name: 'Toc do 50', desc: 'Dat 50+ diem trong Time Attack', icon: '⏱️', xp: 100 },
    time_attack_100: { name: 'Toc do 100', desc: 'Dat 100+ diem trong Time Attack', icon: '🏆', xp: 250 },
    combo_x4: { name: 'Combo x4!', desc: 'Dat combo x4 trong Time Attack', icon: '🎯', xp: 80 },
    first_win: { name: 'Chien thang dau tien', desc: 'Hoan thanh bai hoc dau', icon: '🎉', xp: 30 },
    math_master: { name: 'Bac thay toan', desc: '100 cau dung tong', icon: '🧠', xp: 300 }
  };

  function AchievementSystem(dataPath) {
    this.dataPath = dataPath || null;
    this.definitions = null;
    this.stats = { total_correct: 0, total_wrong: 0, best_streak: 0, lessons_completed: 0, best_combo: 0, last_answer_time_ms: 0, last_lesson_perfect: false };
    this.unlocked = {};
    this._queue = [];
    this._loadDefinitions();
  }

  AchievementSystem.prototype._loadDefinitions = function () {
    if (fs && fs.existsSync && this.dataPath) {
      try {
        var p = (pathMod ? pathMod.join(this.dataPath, 'achievements.json') : this.dataPath + '/achievements.json');
        if (fs.existsSync(p)) { this.definitions = JSON.parse(fs.readFileSync(p, 'utf8')); return; }
      } catch (e) {}
    }
    if (fs && fs.existsSync && fs.existsSync('data/achievements.json')) {
      try { this.definitions = JSON.parse(fs.readFileSync('data/achievements.json', 'utf8')); return; } catch (_) {}
    }
    this.definitions = DEFAULT_DATA;
  };

  AchievementSystem.prototype.load = function (saved) {
    if (!saved) return;
    this.stats = Object.assign(this.stats, saved.stats || {});
    this.unlocked = Object.assign(this.unlocked, saved.unlocked || {});
  };

  AchievementSystem.prototype.save = function () { return { stats: this.stats, unlocked: this.unlocked }; };
  AchievementSystem.prototype.isUnlocked = function (id) { return !!this.unlocked[id]; };
  AchievementSystem.prototype.getDefinitions = function () { return this.definitions; };
  AchievementSystem.prototype.getQueue = function () { return this._queue; };
  AchievementSystem.prototype.clearQueue = function () { this._queue = []; };

  AchievementSystem.prototype.unlock = function (id) {
    if (this.unlocked[id]) return null;
    var def = this.definitions[id];
    if (!def) return null;
    this.unlocked[id] = true;
    var xp = def.xp || 0;
    if (xp > 0 && global.Player && typeof global.Player.addXP === 'function') global.Player.addXP(xp);
    var entry = { id: id, name: def.name, desc: def.desc, icon: def.icon, xp: xp, ts: Date.now() };
    this._queue.push(entry);
    return entry;
  };

  AchievementSystem.prototype.checkAll = function () {
    var newly = [];
    var s = this.stats, i, id, ids = Object.keys(this.definitions);
    for (i = 0; i < ids.length; i++) {
      id = ids[i];
      if (this.unlocked[id]) continue;
      var ok = false;
      if (id === 'streak_5') ok = s.best_streak >= 5;
      else if (id === 'streak_10') ok = s.best_streak >= 10;
      else if (id === 'perfect_lesson') ok = s.lessons_completed > 0 && s.last_lesson_perfect === true;
      else if (id === 'first_win') ok = s.lessons_completed > 0;
      else if (id === 'math_master') ok = s.total_correct >= 100;
      else if (id === 'combo_x4') ok = s.best_combo >= 4;
      if (ok) { this.unlock(id); newly.push(id); }
    }
    return newly;
  };

  AchievementSystem.prototype.onAnswer = function (correct, answerTimeMs) {
    if (correct) { this.stats.total_correct++; if (answerTimeMs && answerTimeMs > 0) this.stats.last_answer_time_ms = answerTimeMs; }
    else { this.stats.total_wrong++; }
    this.checkAll();
  };

  AchievementSystem.prototype.onLessonEnd = function (correct, wrong, bestCombo) {
    if (wrong === 0 && correct > 0) this.stats.last_lesson_perfect = true; else this.stats.last_lesson_perfect = false;
    if (correct > 0) this.stats.lessons_completed++;
    if (bestCombo > this.stats.best_combo) this.stats.best_combo = bestCombo;
    if (correct > 0 && correct > this.stats.best_streak) this.stats.best_streak = correct;
    this.checkAll();
  };

  var _sys = null;
  function getAchievementSystem(dataPath) { if (!_sys) _sys = new AchievementSystem(dataPath); return _sys; }

  var api = { AchievementSystem: AchievementSystem, getAchievementSystem: getAchievementSystem, DEFAULT_DATA: DEFAULT_DATA };
  global.AchievementSys = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
