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
    // M15-G4: Node >= 18 defines a global fetch but rejects relative
    // URLs, so a bare `typeof fetch` guard routed every Node caller into a
    // guaranteed "Failed to parse URL" error and loadAll() fell back to {}.
    // This hid behind the m7b harness defect (async checks never awaited),
    // so lesson data silently did not load under Node. In the browser the
    // document base resolves the relative path, so fetch is still correct there.
    var canFetch = typeof fetch === 'function' && (typeof window !== 'undefined' || typeof location !== 'undefined');
    if (canFetch) {
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

  // M15-A3/A4 — math_lessons.json carries a `template` per lesson that no
  // generator ever read. Register the whole grade->lesson->template map on
  // the QuestionGenerator so its fallback questions match the lesson topic.
  function registerTemplates(data) {
    if (typeof global.QuestionGenerator !== 'function') return false;
    if (typeof global.QuestionGenerator.setLessonTemplates !== 'function') return false;
    var applied = 0;
    Object.keys(data).forEach(function (gradeKey) {
      if (gradeKey === 'meta') return;
      var grade = parseInt(String(gradeKey).split('_')[1], 10);
      if (!isFinite(grade)) return;
      var map = {};
      var lessons = data[gradeKey] || {};
      Object.keys(lessons).forEach(function (lessonId) {
        var t = lessons[lessonId].template;
        if (t) { map[parseInt(lessonId, 10)] = t; applied++; }
      });
      global.QuestionGenerator.setLessonTemplates(grade, map);
    });
    return applied;
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

  /* M30.1: synchronous lesson count per grade. Desktop main.py:687 needs
     len(all_lessons) for the exam gate, but getLessonsForGrade() is async here.
     These are the shipped curriculum counts from web/data/math_lessons.json. */
  var GRADE_LESSON_COUNTS = { 1: 40, 2: 73, 3: 81, 4: 73, 5: 75 };
  function lessonCountForGrade(grade) {
    var g = parseInt(grade, 10);
    if (!isFinite(g) || !GRADE_LESSON_COUNTS[g]) return 0;
    return GRADE_LESSON_COUNTS[g];
  }

  function getUnlockedCount(level) {
    return Math.floor((level - 1) / 6) + 1;
  }

  function requiredLevelForLesson(lessonIndex) {
    return Math.floor(lessonIndex) * 6 + 1;
  }

  // M15-C2 — "you are 12 lessons away".
  // REPRODUCED: M14-D2 puts a "Lv469" tag on a locked lesson, which tells the
  // child the gate but not how far away it is, and LessonSelect drew no
  // progress at all. The unlock formula is untouched (Desktop parity); this is
  // display-only arithmetic over data the game already has.
  function nextUnlockProgress(playerLevel, totalLessons) {
    var level = Math.max(1, Math.floor(playerLevel) || 1);
    var unlocked = getUnlockedCount(level);
    var total = (typeof totalLessons === 'number' && totalLessons > 0)
      ? Math.floor(totalLessons) : null;
    var nextLesson = unlocked + 1;
    var needLevel = requiredLevelForLesson(nextLesson - 1);
    var levelsNeeded = Math.max(0, needLevel - level);
    var lessonsToUnlock = (total !== null && nextLesson <= total)
      ? (nextLesson - unlocked) : null;
    return {
      level: level, unlocked: unlocked, next_lesson: nextLesson,
      required_level: needLevel, levels_needed: levelsNeeded,
      lessons_to_unlock: lessonsToUnlock,
      all_unlocked: (total !== null && unlocked >= total)
    };
  }

  // XP still required to reach targetLevel, summed over the Desktop
  // get_required_exp curve (player.py:10-25).
  function expToReachLevel(currentLevel, currentExp, targetLevel, requiredExpFn) {
    var lvl = Math.max(1, Math.floor(currentLevel) || 1);
    var tgt = Math.max(lvl, Math.floor(targetLevel) || lvl);
    if (typeof requiredExpFn !== 'function') return null;
    var need = 0;
    for (var i = lvl; i < tgt; i++) need += requiredExpFn(i);
    return Math.max(0, need - (Math.max(0, currentExp) || 0));
  }

  var DataLoader = {
    loadAll: loadAll,
    getLessonsForGrade: getLessonsForGrade,
    isLessonUnlocked: isLessonUnlocked,
    getUnlockedCount: getUnlockedCount,
    lessonCountForGrade: lessonCountForGrade,
    requiredLevelForLesson: requiredLevelForLesson,
    nextUnlockProgress: nextUnlockProgress,
    expToReachLevel: expToReachLevel,
  };

  global.DataLoader = DataLoader;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataLoader;
  }
})(typeof window !== 'undefined' ? window : globalThis);
