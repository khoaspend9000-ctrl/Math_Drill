/* =========================================================
   MathDrill Web — M6-A: SMART AI (port từ smart_ai.py)
   ---------------------------------------------------------
   Port 1:1 từ smart_ai.py (2150 dòng — source of truth):
   - SmartAI class: load_data, get_question_generator,
     is_question_used, mark_question_used,
     generate_unique_question, _fallback_generate,
     _difficulty_multiplier, fallback_logic
   - grade_1_logic → grade_5_logic: fallback generation
     khi QuestionGenerator trả về null
   - _distractors: tạo đáp án nhiễu numeric

   RNG (plan R2 — KHÔNG tuyên báo tương đương MT19937):
   mặc định Math.random; có thể inject global.MDRandom cho test.
   ========================================================= */
(function (global) {
  'use strict';
  const L = global.GameLogger || { info: function(){}, warn: function(){}, error: function(){} };
  function rngSrc() { return (typeof global.MDRandom !== 'undefined' && global.MDRandom) || Math; }
  function rf() { return rngSrc().random(); }
  function ri(a, b) { return Math.floor(rf() * (b - a + 1)) + a; }
  function pick(arr) { return arr[Math.floor(rf() * arr.length)]; }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rf() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function gcd(a, b) {
    a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b));
    while (b) { const t = b; b = a % b; a = t; }
    return a;
  }
  function round2(x, digits) {
    const factor = Math.pow(10, digits);
    return Math.round(x * factor) / factor;
  }

  class SmartAI {
    static load_data() {
      if (SmartAI._data_cache === undefined) SmartAI._data_cache = {};
      return SmartAI._data_cache;
    }
    static get_question_generator() {
      if (SmartAI._question_generator === null) {
        try {
          const qg = global.QuestionGenerator;
          SmartAI._question_generator = qg ? new qg() : null;
        } catch (e) { SmartAI._question_generator = null; }
      }
      return SmartAI._question_generator;
    }
    static get_used_questions_key(g, l, d) { return 'grade_'+g+'_lesson_'+l+'_diff_'+d; }
    static is_question_used(txt, g, l, d) {
      const k = SmartAI.get_used_questions_key(g, l, d);
      if (!(k in SmartAI._used_questions)) SmartAI._used_questions[k] = [];
      return SmartAI._used_questions[k].indexOf(txt) >= 0;
    }
    static mark_question_used(txt, g, l, d) {
      const k = SmartAI.get_used_questions_key(g, l, d);
      if (!(k in SmartAI._used_questions)) SmartAI._used_questions[k] = [];
      SmartAI._used_questions[k].push(txt);
      if (SmartAI._used_questions[k].length > 50) SmartAI._used_questions[k] = SmartAI._used_questions[k].slice(-25);
    }
    static generate_unique_question(grade, lesson_id, difficulty, max_attempts, user_id) {
      const max_att = max_attempts || 10;
      const gen = SmartAI.get_question_generator();
      if (!gen) return SmartAI._fallback_generate(grade, lesson_id, difficulty);
      const D = global.Difficulty;
      let diff = D.MEDIUM;
      if (difficulty == null) diff = D.MEDIUM;
      else if (difficulty <= 1) diff = D.EASY;
      else if (difficulty >= 3) diff = D.HARD;
      else diff = D.MEDIUM;
      for (let a = 0; a < max_att; a++) {
        try {
          const q = gen.generate_question(grade, lesson_id, diff, user_id);
          if (!SmartAI.is_question_used(q.question_text, grade, lesson_id, difficulty)) {
            SmartAI.mark_question_used(q.question_text, grade, lesson_id, difficulty);
            return [q.question_text, q.correct_answer, q.options, q.question_type];
          } else if (a === max_att - 1) {
            return [q.question_text, q.correct_answer, q.options, q.question_type];
          }
        } catch (e) { continue; }
      }
      return SmartAI._fallback_generate(grade, lesson_id, difficulty);
    }
    static _fallback_generate(grade, lesson_id, difficulty) {
      const g = parseInt(grade, 10);
      if (g === 1) return SmartAI.grade_1_logic(lesson_id, difficulty);
      if (g === 2) return SmartAI.grade_2_logic(lesson_id, difficulty);
      if (g === 3) return SmartAI.grade_3_logic(lesson_id, difficulty);
      if (g === 4) return SmartAI.grade_4_logic(lesson_id, difficulty);
      if (g === 5) return SmartAI.grade_5_logic(lesson_id, difficulty);
      return SmartAI.fallback_logic();
    }
    static _difficulty_multiplier(d) {
      let v = 1; try { v = parseInt(d, 10) || 1; } catch(e) { v = 1; }
      return 1.0 + (Math.max(1, Math.min(5, v)) - 1) * 0.5;
    }
    static fallback_logic() {
      const a = ri(1,10), b = ri(1,10); const ans = String(a+b);
      return [a+' + '+b+' = ?', ans, [ans, String(a+b+1), String(Math.abs(a+b-1)), String(a+b+2)], 'numeric'];
    }
    static _distractors(type, correct, count) {
    const c = parseInt(correct, 10);
    const distractors = [];
    const used = {};
    used[c] = true;
    let attempts = 0;
    while (distractors.length < count && attempts < 100) {
      attempts++;
      const delta = ri(1, 5);
      const sign = rf() < 0.5 ? -1 : 1;
      const d = c + sign * delta;
      if (d >= 0 && !used[d]) {
        used[d] = true;
        distractors.push(String(d));
      }
    }
    return distractors;
  }

  static grade_1_logic(lesson_id, difficulty) {
    const diff = parseInt(difficulty, 10) || 1;
    const dm = SmartAI._difficulty_multiplier(diff);
    const maxNum = Math.min(20, Math.round(10 * dm));
    const lesson = String(lesson_id).toLowerCase();
    if (lesson.indexOf('cộng') >= 0 || lesson.indexOf('cong') >= 0 || lesson_id <= 10) {
      const a = ri(1, maxNum);
      const b = ri(1, maxNum);
      const ans = String(a + b);
      return [a + ' + ' + b + ' = ?', ans, [ans, ...SmartAI._distractors('numeric', ans, 3)], 'numeric'];
    }
    if (lesson.indexOf('trừ') >= 0 || lesson.indexOf('tru') >= 0 || (lesson_id > 10 && lesson_id <= 20)) {
      const a = ri(5, maxNum);
      const b = ri(1, a);
      const ans = String(a - b);
      return [a + ' - ' + b + ' = ?', ans, [ans, ...SmartAI._distractors('numeric', ans, 3)], 'numeric'];
    }
    if (lesson.indexOf('nhân') >= 0 || lesson.indexOf('nhan') >= 0 || (lesson_id > 20 && lesson_id <= 30)) {
      const a = ri(2, Math.min(10, Math.round(5 * dm)));
      const b = ri(2, Math.min(10, Math.round(5 * dm)));
      const ans = String(a * b);
      return [a + ' × ' + b + ' = ?', ans, [ans, ...SmartAI._distractors('numeric', ans, 3)], 'numeric'];
    }
    if (lesson.indexOf('chia') >= 0 || (lesson_id > 30 && lesson_id <= 40)) {
      const b = ri(2, 10);
      const ans = ri(2, 10);
      const a = b * ans;
      return [a + ' ÷ ' + b + ' = ?', String(ans), [String(ans), ...SmartAI._distractors('numeric', String(ans), 3)], 'numeric'];
    }
    if (lesson.indexOf('so sánh') >= 0 || lesson.indexOf('so sanh') >= 0) {
      const a = ri(1, maxNum);
      const b = ri(1, maxNum);
      const ans = a > b ? '>' : (a < b ? '<' : '=');
      return [a + ' ? ' + b, ans, ['>', '<', '='], 'compare'];
    }
    const a = ri(1, maxNum);
    const b = ri(1, maxNum);
    const ans = String(a + b);
    return [a + ' + ' + b + ' = ?', ans, [ans, ...SmartAI._distractors('numeric', ans, 3)], 'numeric'];
  }

  static grade_2_logic(lesson_id, difficulty) {
    const diff = parseInt(difficulty, 10) || 1;
    const dm = SmartAI._difficulty_multiplier(diff);
    const maxNum = Math.min(100, Math.round(50 * dm));
    const lesson = String(lesson_id).toLowerCase();
    if (lesson.indexOf('cộng') >= 0 || lesson.indexOf('cong') >= 0) {
      const a = ri(10, maxNum);
      const b = ri(10, maxNum);
      const ans = String(a + b);
      return [a + ' + ' + b + ' = ?', ans, [ans, ...SmartAI._distractors('numeric', ans, 3)], 'numeric'];
    }
    if (lesson.indexOf('trừ') >= 0 || lesson.indexOf('tru') >= 0) {
      const a = ri(20, maxNum);
      const b = ri(1, a - 1);
      const ans = String(a - b);
      return [a + ' - ' + b + ' = ?', ans, [ans, ...SmartAI._distractors('numeric', ans, 3)], 'numeric'];
    }
    if (lesson.indexOf('nhân') >= 0 || lesson.indexOf('nhan') >= 0) {
      const a = ri(2, Math.min(12, Math.round(6 * dm)));
      const b = ri(2, Math.min(12, Math.round(6 * dm)));
      const ans = String(a * b);
      return [a + ' × ' + b + ' = ?', ans, [ans, ...SmartAI._distractors('numeric', ans, 3)], 'numeric'];
    }
    if (lesson.indexOf('chia') >= 0) {
      const b = ri(2, 12);
      const ans = ri(2, 12);
      const a = b * ans;
      return [a + ' ÷ ' + b + ' = ?', String(ans), [String(ans), ...SmartAI._distractors('numeric', String(ans), 3)], 'numeric'];
    }
    if (lesson.indexOf('phân số') >= 0 || lesson.indexOf('phan so') >= 0) {
      const n = ri(1, 5);
      const d = ri(2, 5);
      return [n + '/' + d + ' + ' + n + '/' + d + ' = ?', '2×' + n + '/' + d, ['2×' + n + '/' + d, n + '/' + (2 * d), (2 * n + 1) + '/' + d, n + '/' + d], 'fraction'];
    }
    const a = ri(10, maxNum);
    const b = ri(10, maxNum);
    const ans = String(a + b);
    return [a + ' + ' + b + ' = ?', ans, [ans, ...SmartAI._distractors('numeric', ans, 3)], 'numeric'];
  }

  static grade_3_logic(lesson_id, difficulty) {
    const diff = parseInt(difficulty, 10) || 1;
    const dm = SmartAI._difficulty_multiplier(diff);
    const maxNum = Math.min(1000, Math.round(500 * dm));
    const lesson = String(lesson_id).toLowerCase();
    if (lesson.indexOf('cộng') >= 0 || lesson.indexOf('cong') >= 0) {
      const a = ri(100, maxNum);
      const b = ri(100, maxNum);
      const ans = String(a + b);
      return [a + ' + ' + b + ' = ?', ans, [ans, ...SmartAI._distractors('numeric', ans, 3)], 'numeric'];
    }
    if (lesson.indexOf('trừ') >= 0 || lesson.indexOf('tru') >= 0) {
      const a = ri(200, maxNum);
      const b = ri(1, a - 1);
      const ans = String(a - b);
      return [a + ' - ' + b + ' = ?', ans, [ans, ...SmartAI._distractors('numeric', ans, 3)], 'numeric'];
    }
    if (lesson.indexOf('nhân') >= 0 || lesson.indexOf('nhan') >= 0) {
      const a = ri(3, Math.min(20, Math.round(10 * dm)));
      const b = ri(3, Math.min(20, Math.round(10 * dm)));
      const ans = String(a * b);
      return [a + ' × ' + b + ' = ?', ans, [ans, ...SmartAI._distractors('numeric', ans, 3)], 'numeric'];
    }
    if (lesson.indexOf('chia') >= 0) {
      const b = ri(3, 15);
      const ans = ri(3, 15);
      const a = b * ans;
      return [a + ' ÷ ' + b + ' = ?', String(ans), [String(ans), ...SmartAI._distractors('numeric', String(ans), 3)], 'numeric'];
    }
    if (lesson.indexOf('phân số') >= 0 || lesson.indexOf('phan so') >= 0) {
      const n = ri(1, 10);
      const d = ri(2, 10);
      const n2 = ri(1, 10);
      return [n + '/' + d + ' + ' + n2 + '/' + d + ' = ?', (n + n2) + '/' + d, [(n + n2) + '/' + d, (n + n2 + 1) + '/' + d, (n + n2) + '/' + (d + 1), (n + n2 - 1) + '/' + d], 'fraction'];
    }
    if (lesson.indexOf('hình') >= 0 || lesson.indexOf('hinh') >= 0 || lesson.indexOf('diện tích') >= 0) {
      const w = ri(3, 15);
      const h = ri(3, 15);
      const ans = String(w * h);
      return ['Diện tích hình chữ nhật ' + w + '×' + h + ' = ?', ans, [ans, ...SmartAI._distractors('numeric', ans, 3)], 'geometry'];
    }
    const a = ri(100, maxNum);
    const b = ri(100, maxNum);
    const ans = String(a + b);
    return [a + ' + ' + b + ' = ?', ans, [ans, ...SmartAI._distractors('numeric', ans, 3)], 'numeric'];
  }

  static grade_4_logic(lesson_id, difficulty) {
    const diff = parseInt(difficulty, 10) || 1;
    const dm = SmartAI._difficulty_multiplier(diff);
    const maxNum = Math.min(10000, Math.round(5000 * dm));
    const lesson = String(lesson_id).toLowerCase();
    if (lesson.indexOf('cộng') >= 0 || lesson.indexOf('cong') >= 0) {
      const a = ri(1000, maxNum);
      const b = ri(1000, maxNum);
      const ans = String(a + b);
      return [a + ' + ' + b + ' = ?', ans, [ans, ...SmartAI._distractors('numeric', ans, 3)], 'numeric'];
    }
    if (lesson.indexOf('trừ') >= 0 || lesson.indexOf('tru') >= 0) {
      const a = ri(2000, maxNum);
      const b = ri(1, a - 1);
      const ans = String(a - b);
      return [a + ' - ' + b + ' = ?', ans, [ans, ...SmartAI._distractors('numeric', ans, 3)], 'numeric'];
    }
    if (lesson.indexOf('nhân') >= 0 || lesson.indexOf('nhan') >= 0) {
      const a = ri(10, Math.min(50, Math.round(25 * dm)));
      const b = ri(10, Math.min(50, Math.round(25 * dm)));
      const ans = String(a * b);
      return [a + ' × ' + b + ' = ?', ans, [ans, ...SmartAI._distractors('numeric', ans, 3)], 'numeric'];
    }
    if (lesson.indexOf('chia') >= 0) {
      const b = ri(5, 25);
      const ans = ri(5, 25);
      const a = b * ans;
      return [a + ' ÷ ' + b + ' = ?', String(ans), [String(ans), ...SmartAI._distractors('numeric', String(ans), 3)], 'numeric'];
    }
    if (lesson.indexOf('phân số') >= 0 || lesson.indexOf('phan so') >= 0) {
      const n1 = ri(1, 10);
      const d1 = ri(2, 10);
      const n2 = ri(1, 10);
      const d2 = ri(2, 10);
      const num = n1 * d2 + n2 * d1;
      const den = d1 * d2;
      const g = gcd(num, den);
      return [n1 + '/' + d1 + ' + ' + n2 + '/' + d2 + ' = ?', (num / g) + '/' + (den / g), [(num / g) + '/' + (den / g), (num / g + 1) + '/' + (den / g), (num / g) + '/' + (den / g + 1), (num / g - 1) + '/' + (den / g)], 'fraction'];
    }
    if (lesson.indexOf('thập phân') >= 0 || lesson.indexOf('thap phan') >= 0) {
      const a = round2(rf() * 100, 2);
      const b = round2(rf() * 100, 2);
      const ans = String(round2(a + b, 2));
      return [a + ' + ' + b + ' = ?', ans, [ans, ...SmartAI._distractors('numeric', ans, 3)], 'decimal'];
    }
    const a = ri(1000, maxNum);
    const b = ri(1000, maxNum);
    const ans = String(a + b);
    return [a + ' + ' + b + ' = ?', ans, [ans, ...SmartAI._distractors('numeric', ans, 3)], 'numeric'];
  }

  static grade_5_logic(lesson_id, difficulty) {
    const diff = parseInt(difficulty, 10) || 1;
    const dm = SmartAI._difficulty_multiplier(diff);
    const maxNum = Math.min(100000, Math.round(50000 * dm));
    const lesson = String(lesson_id).toLowerCase();
    if (lesson.indexOf('cộng') >= 0 || lesson.indexOf('cong') >= 0) {
      const a = ri(10000, maxNum);
      const b = ri(10000, maxNum);
      const ans = String(a + b);
      return [a + ' + ' + b + ' = ?', ans, [ans, ...SmartAI._distractors('numeric', ans, 3)], 'numeric'];
    }
    if (lesson.indexOf('trừ') >= 0 || lesson.indexOf('tru') >= 0) {
      const a = ri(20000, maxNum);
      const b = ri(1, a - 1);
      const ans = String(a - b);
      return [a + ' - ' + b + ' = ?', ans, [ans, ...SmartAI._distractors('numeric', ans, 3)], 'numeric'];
    }
    if (lesson.indexOf('nhân') >= 0 || lesson.indexOf('nhan') >= 0) {
      const a = ri(10, Math.min(100, Math.round(50 * dm)));
      const b = ri(10, Math.min(100, Math.round(50 * dm)));
      const ans = String(a * b);
      return [a + ' × ' + b + ' = ?', ans, [ans, ...SmartAI._distractors('numeric', ans, 3)], 'numeric'];
    }
    if (lesson.indexOf('chia') >= 0) {
      const b = ri(5, 50);
      const ans = ri(5, 50);
      const a = b * ans;
      return [a + ' ÷ ' + b + ' = ?', String(ans), [String(ans), ...SmartAI._distractors('numeric', String(ans), 3)], 'numeric'];
    }
    if (lesson.indexOf('phân số') >= 0 || lesson.indexOf('phan so') >= 0) {
      const n1 = ri(1, 15);
      const d1 = ri(2, 15);
      const n2 = ri(1, 15);
      const d2 = ri(2, 15);
      const num = n1 * d2 + n2 * d1;
      const den = d1 * d2;
      const g = gcd(num, den);
      return [n1 + '/' + d1 + ' + ' + n2 + '/' + d2 + ' = ?', (num / g) + '/' + (den / g), [(num / g) + '/' + (den / g), (num / g + 1) + '/' + (den / g), (num / g) + '/' + (den / g + 1), (num / g - 1) + '/' + (den / g)], 'fraction'];
    }
    if (lesson.indexOf('thập phân') >= 0 || lesson.indexOf('thap phan') >= 0) {
      const a = round2(rf() * 1000, 2);
      const b = round2(rf() * 1000, 2);
      const ans = String(round2(a + b, 2));
      return [a + ' + ' + b + ' = ?', ans, [ans, ...SmartAI._distractors('numeric', ans, 3)], 'decimal'];
    }
    if (lesson.indexOf('tỉ lệ') >= 0 || lesson.indexOf('ti le') >= 0 || lesson.indexOf('phần trăm') >= 0) {
      const pct = ri(10, 90);
      const val = ri(100, 1000);
      const ans = String(Math.round(val * pct / 100));
      return [pct + '% của ' + val + ' = ?', ans, [ans, ...SmartAI._distractors('numeric', ans, 3)], 'percentage'];
    }
    const a = ri(10000, maxNum);
    const b = ri(10000, maxNum);
    const ans = String(a + b);
    return [a + ' + ' + b + ' = ?', ans, [ans, ...SmartAI._distractors('numeric', ans, 3)], 'numeric'];
  }
}

  SmartAI._data_cache = undefined;
  SmartAI._question_generator = null;
  SmartAI._used_questions = {};
  global.SmartAI = SmartAI;
  if (typeof module !== 'undefined' && module.exports) module.exports = SmartAI;
})(typeof window !== 'undefined' ? window : globalThis);


