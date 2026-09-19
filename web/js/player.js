/* =========================================================
   MathDrill Web — M5: PLAYER (port từ player.py — source of truth)
   ---------------------------------------------------------
   - getRequiredExp  : player.py:10-25 (game_init.py:360-370 trùng,
                       chỉ khác guard level<=0 mà player.py xử lý)
   - PlayerData      : player.py:28-164 — giữ nguyên công thức XP
                       curve, level-up loop, combo, shake, display.
   - updateCombo     : game_init.py:396-428 (update_combo — override
                       multiplier sau increment_combo; bỏ trigger_shake
                       và combo sound — port ở M8).
   - Web extension   : username/grade (Python giữ ở
                       account_system.current_user / account data).
   - addExp/addGold  : có sync accountSystem.data() như Python
                       (d['xp']/d['level']/d['gold']).
   ========================================================= */
(function (global) {
  'use strict';

  const L = global.GameLogger || {
    info: function () {}, warn: function () {}, error: function () {}
  };

  // ---- player.py:10-25 ----
  // level<=0 → 100 | level>=1000 → 1_000_000
  // level<=50 → int(100 * 1.15^(level-1)) | >50 → base_50 + (level-50)*500
  function getRequiredExp(level) {
    if (level <= 0) return 100;
    if (level >= 1000) return 1000000;
    if (level <= 50) return Math.floor(100 * Math.pow(1.15, level - 1));
    const base50 = Math.floor(100 * Math.pow(1.15, 49));
    return base50 + (level - 50) * 500;
  }

  // ---- player.py:28-164 ----
  class PlayerData {
    constructor() {
      this.level = 1;
      this.exp = 0;
      this.expToNextLevel = 100;
      this.comboStreak = 0;
      this.comboMultiplier = 1.0;
      this.gold = 0;
      this.lives = 3;

      // Visual effects (player.py:40-42)
      this.screenShakeTime = 0;
      this.screenShakeIntensity = 0;

      // Smooth animations (player.py:44-46)
      this.displayExp = 0.0;
      this.displayGold = 0.0;

      // Audio settings (player.py:48-51)
      this.volume = 1.0;
      this.brightness = 1.0;
      this.fullscreen = false;

      // --- Web extension (không có trong player.py; Python lưu username
      //     ở account_system.current_user, grade ở account data) ---
      this.username = '';
      this.grade = 1;
    }

    // player.py:53-74 — onLevelUp thay cho snd_levelup.play()
    addExp(amount, accountSystem, onLevelUp) {
      this.exp += amount;
      if (accountSystem && accountSystem.currentUser) {
        const d = accountSystem.data();
        d.xp = this.exp;
        d.level = this.level;
      }
      while (this.exp >= this.expToNextLevel) {
        this.exp -= this.expToNextLevel;
        this.level += 1;
        this.expToNextLevel = getRequiredExp(this.level);
        if (onLevelUp) onLevelUp(this.level);
        if (accountSystem && accountSystem.currentUser) {
          const d = accountSystem.data();
          d.xp = this.exp;
          d.level = this.level;
        }
      }
    }

    // player.py:76-83 — Python KHÔNG clamp (amount âm sẽ trừ); giữ nguyên
    addGold(amount, accountSystem) {
      this.gold += amount;
      if (accountSystem && accountSystem.currentUser) {
        const d = accountSystem.data();
        d.gold = this.gold;
      }
      return this.gold;
    }

    // player.py:85-88
    resetCombo() {
      this.comboStreak = 0;
      this.comboMultiplier = 1.0;
    }

    // player.py:90-100 (base multiplier — update_combo sẽ override)
    incrementCombo() {
      this.comboStreak += 1;
      if (this.comboStreak >= 5) this.comboMultiplier = 2.0;
      else if (this.comboStreak >= 3) this.comboMultiplier = 1.5;
      else this.comboMultiplier = 1.0;
    }

    // game_init.py:396-428 update_combo — logic multiplier thuần:
    //   streak>=10 → 4.0 | >=5 → 3.0 | >=3 → 2.0 | else → 1.5
    // (comboBonusThreshold từ skill system — M9; mặc định 0)
    updateCombo(isCorrect, comboBonusThreshold) {
      const bonus = comboBonusThreshold || 0;
      if (isCorrect) {
        this.incrementCombo();
        const t3 = Math.max(0, 3 - bonus);
        const t5 = Math.max(0, 5 - bonus);
        const t10 = Math.max(0, 10 - bonus);
        if (this.comboStreak >= t10) this.comboMultiplier = 4.0;
        else if (this.comboStreak >= t5) this.comboMultiplier = 3.0;
        else if (this.comboStreak >= t3) this.comboMultiplier = 2.0;
        else this.comboMultiplier = 1.5;
      } else {
        this.resetCombo();
      }
      return this.comboMultiplier;
    }

    // player.py:102-105
    triggerScreenShake(intensity, duration) {
      this.screenShakeTime = duration;
      this.screenShakeIntensity = intensity;
    }

    // player.py:107-112
    updateScreenShake(dt) {
      if (this.screenShakeTime > 0) {
        this.screenShakeTime -= dt;
        if (this.screenShakeTime <= 0) this.screenShakeIntensity = 0.0;
      }
    }

    // player.py:114-120
    updateAnimations(dt) {
      this.displayExp += (this.exp - this.displayExp) * 0.08;
      this.displayGold += (this.gold - this.displayGold) * 0.1;
    }

    // player.py:122-131 — time.time() → performance.now()/1000
    getScreenOffset() {
      if (this.screenShakeIntensity > 0) {
        const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
        const offsetX = Math.sin(t * 40) * this.screenShakeIntensity;
        const offsetY = Math.cos(t * 35) * this.screenShakeIntensity * 0.7;
        return [Math.trunc(offsetX), Math.trunc(offsetY)];
      }
      return [0, 0];
    }

    // player.py:133-135
    setVolume(volume) {
      this.volume = Math.max(0.0, Math.min(1.0, volume));
    }

    // player.py:137-139
    setBrightness(brightness) {
      this.brightness = Math.max(0.0, Math.min(2.0, brightness));
    }

    // player.py:141-143
    setFullscreen(fullscreen) {
      this.fullscreen = fullscreen;
    }

    // player.py:145-154 + web extras (username/grade)
    getSaveData() {
      return {
        level: this.level,
        exp: this.exp,
        gold: this.gold,
        volume: this.volume,
        brightness: this.brightness,
        fullscreen: this.fullscreen,
        username: this.username,
        grade: this.grade
      };
    }

    // player.py:156-164 — data.get(k, default) → so sánh undefined chính xác
    loadSaveData(data) {
      const d = data || {};
      if (d.level !== undefined) this.level = d.level;
      if (d.exp !== undefined) this.exp = d.exp;
      if (d.gold !== undefined) this.gold = d.gold;
      if (d.volume !== undefined) this.volume = d.volume;
      if (d.brightness !== undefined) this.brightness = d.brightness;
      if (d.fullscreen !== undefined) this.fullscreen = d.fullscreen;
      if (d.username !== undefined) this.username = d.username;
      if (d.grade !== undefined) this.grade = d.grade;
      this.expToNextLevel = getRequiredExp(this.level);
    }

  }

  PlayerData.getRequiredExp = getRequiredExp;
  global.PlayerData = PlayerData;
  global.getRequiredExp = getRequiredExp;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PlayerData: PlayerData, getRequiredExp: getRequiredExp };
  }
})(typeof window !== 'undefined' ? window : globalThis);

