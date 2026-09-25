/* =========================================================
   MathDrill Web — M7-B: DATA LOADER
   ---------------------------------------------------------
   Load lessons from math_lessons.json (data_manager.py equivalent).
   Grade 1: 40 lessons, Grade 2: 73, Grade 3: 81, Grade 4: 73, Grade 5: 75.
   Unlock rule (main.py): max_unlocked_lesson = (level-1)//6 + 1.
   ========================================================= */
(function (global) {
  'use strict';

  const L = global.GameLogger || {
    info: function () {}, warn: function () {}, error: function () {}
  };

  let _cache = null;

  function _gradeKey(grade) {
    return 'grade_' + grade;
  }

  function _parseGradeData(data) {
    var result = [];
    Object.keys(data).sort(function (a, b) {
      return parseInt(a) - parseInt(b);
    }).forEach(function (lessonId) {
      var lesson = data[lessonId];
      result.push({
        id: parseInt(lessonId),
        title: lesson.title,
        template: lesson.template,
        type: lesson.type,
        range: lesson.range
      });
    });
    return result;
  }

  function _fetchJson(url) {
    if (typeof fetch === 'function') {
      return fetch(url).then(function (r) { return r.json(); });
    }
    if (typeof require === 'function') {
      var fs = require('fs');
      var path = require('path');
      var filePath = path.join(__dirname, '..', url);
      return new Promise(function (resolve, reject) {
        fs.readFile(filePath, 'utf8', function (err, data) {
          if (err) return reject(err);
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(e); }
        });
      });
    }
    return Promise.reject(new Error('No fetch or fs available'));
  }

  function loadAll() {
    if (_cache) return Promise.resolve(_cache);
    return _fetchJson('data/math_lessons.json')
      .then(function (data) {
        _cache = data;
        return data;
      })
      .catch(function (err) {
        L.error('[DataLoader] loadAll failed:', err);
        return {};
      });
  }

  function getLessonsForGrade(grade) {
    return loadAll().then(function (data) {
      var gk = _gradeKey(grade);
      var gradeData = data[gk] || {};
      return _parseGradeData(gradeData);
    });
  }

  function isLessonUnlocked(lessonIndex, playerLevel) {
    var maxUnlocked = Math.floor((playerLevel - 1) / 6) + 1;
    return (lessonIndex + 1) <= maxUnlocked;
  }

  function getUnlockedCount(level) {
    return Math.floor((level - 1) / 6) + 1;
  }

  function requiredLevelForLesson(lessonIndex) {
    return Math.floor(lessonIndex) * 6 + 1;
  }

  var DataLoader = {
    loadAll: loadAll,
    getLessonsForGrade: getLessonsForGrade,
    isLessonUnlocked: isLessonUnlocked,
    getUnlockedCount: getUnlockedCount,
    requiredLevelForLesson: requiredLevelForLesson
  };

  global.DataLoader = DataLoader;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataLoader;
  }
})(typeof window !== 'undefined' ? window : globalThis);
