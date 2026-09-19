/* =========================================================
   MathDrill Web — M6-A: ADAPTIVE AI (port từ systems/adaptive_ai.py)
   ---------------------------------------------------------
   Port 1:1 từ systems/adaptive_ai.py (200 dòng — source of truth):
   - PerformanceTracker: record_answer, get_accuracy, get_avg_time, get_topic_accuracy
   - DifficultyManager: adjust_difficulty (cooldown 5), get_difficulty_params
   - AdaptiveAI: process_answer, _generate_recommendations, get_current_difficulty, etc.

   Không dùng pygame/time — dùng Date.now()/performance.now() nếu cần.
   ========================================================= */
(function (global) {
  'use strict';

  class PerformanceTracker {
    constructor(maxHistory) {
      this.maxHistory = maxHistory || 100;
      this.answerTimes = [];
      this.correctAnswers = 0;
      this.totalAnswers = 0;
      this.topicPerformance = {};
      this.questionTypePerformance = {};
    }

    recordAnswer(isCorrect, answerTime, topicId, questionType) {
      this.answerTimes.push(answerTime);
      if (this.answerTimes.length > this.maxHistory) {
        this.answerTimes.shift();
      }
      if (isCorrect) this.correctAnswers += 1;
      this.totalAnswers += 1;

      if (topicId !== undefined && topicId !== null) {
        if (!this.topicPerformance[topicId]) {
          this.topicPerformance[topicId] = { correct: 0, total: 0, times: [] };
        }
        const perf = this.topicPerformance[topicId];
        perf.total += 1;
        if (isCorrect) perf.correct += 1;
        perf.times.push(answerTime);
        if (perf.times.length > 10) {
          perf.times = perf.times.slice(-10);
        }
      }

      if (questionType !== undefined && questionType !== null) {
        if (!this.questionTypePerformance[questionType]) {
          this.questionTypePerformance[questionType] = { correct: 0, total: 0 };
        }
        const qtPerf = this.questionTypePerformance[questionType];
        qtPerf.total += 1;
        if (isCorrect) qtPerf.correct += 1;
      }
    }

    getAccuracy() {
      if (this.totalAnswers === 0) return 0.5;
      return this.correctAnswers / this.totalAnswers;
    }

    getAvgTime() {
      if (this.answerTimes.length === 0) return 5.0;
      const sum = this.answerTimes.reduce(function (a, b) { return a + b; }, 0);
      return sum / this.answerTimes.length;
    }

    getTopicAccuracy(topicId) {
      if (!this.topicPerformance[topicId]) return 0.5;
      const perf = this.topicPerformance[topicId];
      return perf.correct / Math.max(1, perf.total);
    }
  }

  class DifficultyManager {
    constructor() {
      this.currentDifficulty = 1;
      this.difficultyHistory = [];
      this.adjustmentCooldown = 0;
      this.minDifficulty = 1;
      this.maxDifficulty = 5;
    }

    adjustDifficulty(accuracy, avgTime, performanceScore) {
      if (this.adjustmentCooldown > 0) {
        this.adjustmentCooldown -= 1;
        return;
      }

      const oldDifficulty = this.currentDifficulty;

      if (performanceScore > 80) {
        if (this.currentDifficulty < this.maxDifficulty) {
          this.currentDifficulty += 1;
        }
      } else if (performanceScore < 40) {
        if (this.currentDifficulty > this.minDifficulty) {
          this.currentDifficulty -= 1;
        }
      }

      if (oldDifficulty !== this.currentDifficulty) {
        this.difficultyHistory.push({
          time: Date.now(),
          from: oldDifficulty,
          to: this.currentDifficulty,
          reason: 'Performance: ' + performanceScore.toFixed(1) + '%'
        });
        this.adjustmentCooldown = 5;
      }
    }

    getDifficultyParams() {
      const params = {
        1: { timeLimit: 30, hintAvailable: true, errorMargin: 0.1 },
        2: { timeLimit: 25, hintAvailable: true, errorMargin: 0.05 },
        3: { timeLimit: 20, hintAvailable: false, errorMargin: 0.02 },
        4: { timeLimit: 15, hintAvailable: false, errorMargin: 0.01 },
        5: { timeLimit: 10, hintAvailable: false, errorMargin: 0.005 }
      };
      return params[this.currentDifficulty] || params[1];
    }
  }

  class AdaptiveAI {
    constructor() {
      this.performanceTracker = new PerformanceTracker();
      this.difficultyManager = new DifficultyManager();
      this.sessionStartTime = Date.now();
      this.recommendations = [];
    }

    processAnswer(isCorrect, answerTime, topicId, questionType) {
      this.performanceTracker.recordAnswer(isCorrect, answerTime, topicId, questionType);

      const accuracy = this.performanceTracker.getAccuracy();
      const avgTime = this.performanceTracker.getAvgTime();

      let performanceScore = accuracy * 60;
      performanceScore += Math.max(0, (30 - avgTime) * 2);
      performanceScore = Math.min(100, performanceScore);

      this.difficultyManager.adjustDifficulty(accuracy, avgTime, performanceScore);
      this._generateRecommendations();
    }

    _generateRecommendations() {
      this.recommendations = [];

      const topics = this.performanceTracker.topicPerformance;
      for (const topicId in topics) {
        if (topics.hasOwnProperty(topicId)) {
          const perf = topics[topicId];
          const accuracy = perf.correct / Math.max(1, perf.total);
          if (accuracy < 0.6) {
            this.recommendations.push({
              type: 'practice_topic',
              topic: topicId,
              reason: 'Accuracy: ' + (accuracy * 100).toFixed(1) + '%'
            });
          }
        }
      }

      const avgTime = this.performanceTracker.getAvgTime();
      if (avgTime > 20) {
        this.recommendations.push({
          type: 'speed_practice',
          reason: 'Average time: ' + avgTime.toFixed(1) + 's'
        });
      }
    }

    getCurrentDifficulty() {
      return this.difficultyManager.currentDifficulty;
    }

    getDifficultyParams() {
      return this.difficultyManager.getDifficultyParams();
    }

    getRecommendations() {
      return this.recommendations;
    }

    getSessionStats() {
      const sessionTime = (Date.now() - this.sessionStartTime) / 1000;
      return {
        sessionTime: sessionTime,
        accuracy: this.performanceTracker.getAccuracy(),
        avgTime: this.performanceTracker.getAvgTime(),
        totalAnswers: this.performanceTracker.totalAnswers,
        currentDifficulty: this.difficultyManager.currentDifficulty,
        difficultyChanges: this.difficultyManager.difficultyHistory.length
      };
    }
  }

  const adaptiveAIInstance = new AdaptiveAI();

  global.PerformanceTracker = PerformanceTracker;
  global.DifficultyManager = DifficultyManager;
  global.AdaptiveAI = AdaptiveAI;
  global.adaptiveAI = adaptiveAIInstance;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      PerformanceTracker: PerformanceTracker,
      DifficultyManager: DifficultyManager,
      AdaptiveAI: AdaptiveAI,
      adaptiveAI: adaptiveAIInstance
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
