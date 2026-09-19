/* =========================================================
   MathDrill Web — M7-A: GAME MANAGER / REWARD PIPELINE
   ---------------------------------------------------------
   Port reward calculation từ game_init.py + main.py (source of truth).

   Formulas (giữ nguyên Python):
   - Score (main.py:1809-1813): points = int(20 * combo_multiplier) * item_score_mult
   - XP gain (main.py:1580-1589): xp_gain = int(10 * combo_multiplier) * fever(2x) * combo_boost * score_mult
   - Gold (game_init.py:380-386): base(mode) + max(0,int(score))//2 + int(max(0,acc)//10)
   - Combo (game_init.py:409-420): streak>=10→4x, >=5→3x, >=3→2x, else 1.5x (với skill bonus threshold)
   - Combo reset (game_init.py:419): wrong → reset_combo (streak=0, mult=1.0)
   - Lives (player.py:38): mặc định 3 (không trừ trong LessonState — main.py:1600 comment)
   - Victory (main.py:76-87): cc>=tc(15) & accuracy>=60% → Victory, else Defeat
   =========================================================
   Test: web/tests/m7a_game_manager.test.js
   ========================================================= */
(function (global) {
  'use strict';

  const L = global.GameLogger || {
    info: function () {}, warn: function () {}, error: function () {}
  };

  // ---- game_init.py:380-386 ----
  const GOLD_MODE_BONUS = {
    lesson: 20,
    time_attack: 25,
    daily: 18,
    mock_exam: 30,
    achievement: 12,
    other: 10
  };

  function calculateGoldReward(modeKey, score, accuracy) {
    const base = GOLD_MODE_BONUS[modeKey] !== undefined ? GOLD_MODE_BONUS[modeKey] : GOLD_MODE_BONUS.other;
    const scorePart = Math.max(0, Math.floor(score)) >> 1;
    const accPart = Math.floor(Math.max(0, accuracy) / 10);
    return base + scorePart + accPart;
  }

  function calculateXpReward(comboMultiplier, opts) {
    const o = opts || {};
    let xp = Math.floor(10 * (comboMultiplier || 1.0));
    if (o.fever) xp *= 2;
    const comboBoost = o.comboBoost !== undefined ? o.comboBoost : 1;
    if (comboBoost > 1) xp = Math.floor(xp * comboBoost);
    const scoreMult = o.scoreMult !== undefined ? o.scoreMult : 1.0;
    return Math.floor(xp * scoreMult);
  }

  class GameManager {
    constructor(player) {
      this.player = player || new global.PlayerData();
      this.reset();
    }

    reset() {
      this.score = 0;
      this.questionCount = 0;
      this.totalQuestions = 15;
      this.correctCount = 0;
      this.wrongAnswers = [];
      this.answerTimes = [];
      this.feverMode = false;
      this.comboBoost = 1;
      this.scoreMult = 1.0;
      this.shield = false;
    }

    onCorrect() {
      this.player.comboStreak += 1;
      this.player.comboMultiplier = getComboMultiplier(this.player.comboStreak, 0);
      const points = calculateScorePoints(this.player.comboMultiplier, this.scoreMult);
      this.score += points;
      const xp = calculateXpReward(this.player.comboMultiplier, {
        fever: this.feverMode,
        comboBoost: this.comboBoost,
        scoreMult: this.scoreMult
      });
      this.player.addExp(xp, null, null);
      this.correctCount += 1;
      return {
        scoreGained: points,
        xpGained: xp,
        comboStreak: this.player.comboStreak,
        comboMultiplier: this.player.comboMultiplier
      };
    }

    onWrong() {
      this.player.resetCombo();
      return {
        comboStreak: this.player.comboStreak,
        comboMultiplier: this.player.comboMultiplier
      };
    }

    advanceQuestion() {
      this.questionCount += 1;
      if (this.questionCount >= this.totalQuestions) {
        const accuracy = (this.correctCount / this.totalQuestions) * 100;
        const victory = accuracy >= 60;
        const stats = {
          correct: this.correctCount,
          total: this.totalQuestions,
          accuracy: accuracy,
          wrongAnswers: this.wrongAnswers
        };
        return { finished: true, victory: victory, stats: stats };
      }
      return { finished: false, victory: false, stats: null };
    }

    calculateEndGold(modeKey) {
      const accuracy = (this.correctCount / this.totalQuestions) * 100;
      const gold = calculateGoldReward(modeKey || 'lesson', this.score, accuracy);
      this.player.addGold(gold, null);
      return gold;
    }

    getGameInfo() {
      return {
        level: this.player.level,
        exp: this.player.exp,
        gold: this.player.gold,
        comboStreak: this.player.comboStreak,
        comboMultiplier: this.player.comboMultiplier,
        lives: this.player.lives,
        score: this.score,
        questionCount: this.questionCount,
        totalQuestions: this.totalQuestions,
        correctCount: this.correctCount
      };
    }
  }

  global.GameManager = GameManager;
  global.calculateGoldReward = calculateGoldReward;
  global.calculateXpReward = calculateXpReward;
  global.calculateScorePoints = calculateScorePoints;
  global.getComboMultiplier = getComboMultiplier;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      GameManager: GameManager,
      calculateGoldReward: calculateGoldReward,
      calculateXpReward: calculateXpReward,
      calculateScorePoints: calculateScorePoints,
      getComboMultiplier: getComboMultiplier
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
  function calculateScorePoints(comboMultiplier, itemScoreMult) {
    const mult = itemScoreMult !== undefined ? itemScoreMult : 1.0;
    return Math.floor(Math.floor(20 * (comboMultiplier || 1.0)) * mult);
  }

  function getComboMultiplier(streak, comboBonusThreshold) {
    const bonus = comboBonusThreshold || 0;
    const t3 = Math.max(0, 3 - bonus);
    const t5 = Math.max(0, 5 - bonus);
    const t10 = Math.max(0, 10 - bonus);
    if (streak >= t10) return 4.0;
    if (streak >= t5) return 3.0;
    if (streak >= t3) return 2.0;
    return 1.5;
  }