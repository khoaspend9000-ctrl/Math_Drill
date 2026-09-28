/* M13 SettingsState + PasswordChangeState: Desktop-parity controls and persistence. */
(function (global) {
  'use strict';
  var Base = global.BaseState;
  var L = global.GameLogger || { info: function () {}, warn: function () {}, error: function () {} };
  var BLUE = [0, 188, 212], GREEN = [76, 175, 80], PURPLE = [138, 43, 176];
  var ORANGE = [255, 152, 0], RED = [244, 67, 54], TEAL = [90, 170, 160];
  function hit(c, r) { return !!c && c.x >= r.x && c.x <= r.x + r.w && c.y >= r.y && c.y <= r.y + r.h; }
  function color(c) { return Array.isArray(c) ? 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')' : c; }
  function drawButton(R, r, label, bg) {
    R.fillRoundRect(r.x, r.y, r.w, r.h, 12, color(bg), '#ffffff', 2);
    R.text(label, r.x + r.w / 2, r.y + r.h / 2, { font: 'bold 16px Quicksand, sans-serif', fill: '#fff', align: 'center', baseline: 'middle' });
  }
  function player() { var g = global.Game || {}; if (!g.player) g.player = { brightness: 1, volume: 1 }; return g.player; }
  function readSettings() { var S = global.Save; var d = S && S.load ? S.load(S.KEYS.SETTINGS, {}) : {}; return d && typeof d === 'object' ? d : {}; }
  function writeSettings(s) { var S = global.Save; return !!(S && S.save && S.save(S.KEYS.SETTINGS, { brightness: s.brightness, volume: s.volume, fullscreen: s.fullscreen, quality: s.quality })); }
  function SettingsState() { this.name = 'settings'; }
  SettingsState.prototype = Object.create(Base.prototype);
  SettingsState.prototype.constructor = SettingsState;
  SettingsState.prototype.enter = function () {
    var d = readSettings(), p = player();
    this.brightness = Number(d.brightness !== undefined ? d.brightness : (p.brightness || 1));
    this.volume = Number(d.volume !== undefined ? d.volume : (p.volume || 1));
    this.fullscreen = d.fullscreen === true; this.quality = d.quality === undefined ? 1 : Number(d.quality);
    this.msg = ''; this.msgTimer = 0; this.msgOk = true;
    this.buttons = { brightness: { x: 810, y: 150, w: 300, h: 60 }, volume: { x: 810, y: 250, w: 300, h: 60 }, fullscreen: { x: 810, y: 350, w: 300, h: 60 }, quality: { x: 810, y: 450, w: 300, h: 60 }, password: { x: 810, y: 550, w: 300, h: 60 }, back: { x: 810, y: 680, w: 300, h: 60 } };
    this.persist();
  };
  SettingsState.prototype.persist = function () { var p = player(); p.brightness = this.brightness; p.volume = this.volume; p.fullscreen = this.fullscreen; var a = global.Game && global.Game.audio; if (a && a.setMasterVolume) a.setMasterVolume(this.volume); writeSettings(this); };
  SettingsState.prototype.feedback = function (m, ok) { this.msg = m; this.msgOk = ok !== false; this.msgTimer = 3; };
  SettingsState.prototype.handleInput = function (input) {
    var c = input.consumeClick ? input.consumeClick() : null; if (!c) return; var b = this.buttons;
    if (hit(c, b.back)) { global.Game.states.change('menu', null, 'fade'); return; }
    if (hit(c, b.brightness)) { this.brightness = this.brightness <= .4 ? 1 : Math.max(.2, this.brightness - .2); this.persist(); this.feedback('Độ sáng đã lưu: ' + Math.round(this.brightness * 100) + '%', true); return; }
    if (hit(c, b.volume)) { this.volume = this.volume <= 0 ? 1 : this.volume - .5; this.persist(); this.feedback('Âm lượng đã lưu: ' + Math.round(this.volume * 100) + '%', true); return; }
    if (hit(c, b.fullscreen)) { if (this.fullscreen) { if (document.exitFullscreen) document.exitFullscreen().catch(function () {}); this.fullscreen = false; this.persist(); this.feedback('Đã tắt toàn màn hình', true); } else if (document.documentElement.requestFullscreen) { var self = this; document.documentElement.requestFullscreen().then(function () { self.fullscreen = true; self.persist(); self.feedback('Đã bật toàn màn hình', true); }).catch(function () { self.feedback('Trình duyệt không cho phép toàn màn hình', false); }); } else this.feedback('Trình duyệt không hỗ trợ toàn màn hình', false); return; }
    if (hit(c, b.quality)) { this.quality = this.quality >= 2 ? 0 : this.quality + 1; this.persist(); this.feedback('Chất lượng đồ họa đã lưu: ' + ['Thấp', 'Vừa', 'Cao'][this.quality], true); return; }
    if (hit(c, b.password)) global.Game.states.change('passwordChange', null, 'fade');
  };
  SettingsState.prototype.update = function (dt) { if (this.msgTimer > 0) this.msgTimer = Math.max(0, this.msgTimer - dt); };
  SettingsState.prototype.draw = function (ctx, W, H) {
    var R = global.Game.renderer; R.clear('#a5d6a7');
    R.text('CÀI ĐẶT', W / 2, 85, { font: 'bold 40px Quicksand, sans-serif', fill: '#20242e', align: 'center', baseline: 'middle' });
    R.text('HỆ THỐNG', 340, 190, { font: 'bold 30px Quicksand, sans-serif', fill: '#20242e', align: 'center', baseline: 'middle' });
    var b = this.buttons, rows = [['brightness', '☀️ Độ sáng: ' + Math.round(this.brightness * 100) + '%', BLUE], ['volume', '🔊 Âm lượng: ' + Math.round(this.volume * 100) + '%', GREEN], ['fullscreen', '📺 Toàn màn hình: ' + (this.fullscreen ? 'BẬT' : 'TẮT'), PURPLE], ['quality', '🖥️ Đồ họa: ' + ['Thấp', 'Vừa', 'Cao'][this.quality], TEAL], ['password', '🔑 Đổi mật khẩu', ORANGE], ['back', '⬅️ Quay lại menu', RED]];
    rows.forEach(function (v) { drawButton(R, b[v[0]], v[1], v[2]); });
    if (this.msgTimer > 0 && this.msg) R.text(this.msg, W / 2, 755, { font: '20px Quicksand, sans-serif', fill: this.msgOk ? '#187a2e' : '#9a3030', align: 'center', baseline: 'middle' });
  };
  function PasswordChangeState() { this.name = 'passwordChange'; this.fields = ['', '', '']; this.active = 0; this.msg = ''; this.msgOk = false; this.msgTimer = 0; this.rects = [{ x: 450, y: 220, w: 400, h: 50 }, { x: 450, y: 300, w: 400, h: 50 }, { x: 450, y: 380, w: 400, h: 50 }]; this.changeBtn = { x: 450, y: 480, w: 400, h: 60 }; this.backBtn = { x: 450, y: 570, w: 400, h: 60 }; }
  PasswordChangeState.prototype = Object.create(Base.prototype); PasswordChangeState.prototype.constructor = PasswordChangeState;
  PasswordChangeState.prototype.enter = function () { this.fields = ['', '', '']; this.active = 0; this.msg = ''; this.msgTimer = 0; };
  PasswordChangeState.prototype.feedback = function (m, ok) { this.msg = m; this.msgOk = ok; this.msgTimer = 4; };
  PasswordChangeState.prototype.change = async function () {
    if (!this.fields[0] || !this.fields[1] || !this.fields[2]) { this.feedback('Vui lòng nhập đầy đủ thông tin!', false); return; }
    if (this.fields[1] !== this.fields[2]) { this.feedback('Mật khẩu xác nhận không khớp!', false); return; }
    var a = global.Game && global.Game.auth;
    if (!a || !a.currentUser || typeof a.changePassword !== 'function') { this.feedback('Phiên đăng nhập không hợp lệ', false); return; }
    try { var r = await a.changePassword(a.currentUser, this.fields[0], this.fields[1]); if (r && r.ok) { this.fields = ['', '', '']; this.feedback(r.msg || 'Đổi mật khẩu thành công!', true); } else this.feedback((r && r.msg) || 'Không thể đổi mật khẩu', false); }
    catch (e) { L.error('[Password] change failed', e); this.feedback('Không thể đổi mật khẩu', false); }
  };
  PasswordChangeState.prototype.handleInput = function (input) {
    var c = input.consumeClick ? input.consumeClick() : null;
    if (c) { this.rects.forEach(function (r, i) { if (hit(c, r)) this.active = i; }, this); if (hit(c, this.backBtn)) { global.Game.states.change('settings', null, 'fade'); return; } if (hit(c, this.changeBtn)) { this.change(); return; } }
    var k = input.consumePressedKey ? input.consumePressedKey() : null; if (!k) return; var key = k.key || '';
    if (key === 'Backspace') this.fields[this.active] = this.fields[this.active].slice(0, -1);
    else if (key === 'Tab') this.active = (this.active + 1) % 3;
    else if (key === 'Enter' || key === 'NumpadEnter') this.change();
    else if (key.length === 1 && this.fields[this.active].length < 64) this.fields[this.active] += key;
  };
  PasswordChangeState.prototype.update = function (dt) { if (this.msgTimer > 0) this.msgTimer = Math.max(0, this.msgTimer - dt); };
  PasswordChangeState.prototype.draw = function (ctx, W, H) {
    var R = global.Game.renderer; R.clear('#a5d6a7'); R.text('ĐỔI MẬT KHẨU', W / 2, 125, { font: 'bold 40px Quicksand, sans-serif', fill: '#20242e', align: 'center', baseline: 'middle' });
    var labels = ['Mật khẩu hiện tại', 'Mật khẩu mới', 'Xác nhận mật khẩu'];
    this.rects.forEach(function (r, i) { R.fillRoundRect(r.x, r.y, r.w, r.h, 10, 'rgb(220,220,220)', this.active === i ? 'rgb(80,120,220)' : '#fff', this.active === i ? 3 : 1); R.text(this.fields[i] ? new Array(this.fields[i].length + 1).join('*') : labels[i], r.x + 15, r.y + r.h / 2, { font: '20px Quicksand, sans-serif', fill: this.fields[i] ? '#303030' : '#999', baseline: 'middle' }); }, this);
    drawButton(R, this.changeBtn, '🔑 ĐỔI MẬT KHẨU', GREEN); drawButton(R, this.backBtn, '⬅️ QUAY LẠI', RED);
    if (this.msgTimer > 0 && this.msg) R.text(this.msg, W / 2, 670, { font: '20px Quicksand, sans-serif', fill: this.msgOk ? '#187a2e' : '#9a3030', align: 'center', baseline: 'middle' });
  };
  // =========================================================
  // REVIEW STATE  (main.py:1324-1417) — "PHÂN TÍCH LỖI SAI"
  // M15-B1/B2: ports Python ReviewState so the existing "XEM LỖI"
  // buttons on Victory/Defeat stop being no-ops. Counts errors per
  // operation (main.py:1345-1349), reports the most common one plus
  // one suggestion based on the error count (main.py:1352-1362),
  // then lists the first 3 wrong answers with user/correct text.
  // The practice entry goes to PracticeState when wrong answers
  // exist (main.py:1368-1372); the continue button returns to the
  // caller's `next` state (ReviewState is entered with next:'menu'
  // from both victory and defeat, main.py:1036-1038, 1147-1149).
  // NOTE: buttons copy the M13 PasswordChange contract: fixed
  // rects (no canvas measurement), same handleInput shape, and a
  // Node-testable module surface.
  // =========================================================
  function analyzeReviewErrors(wrongAnswers) {
    var patterns = { operation_errors: {}, common_mistakes: [], suggestions: [] };
    var list = Array.isArray(wrongAnswers) ? wrongAnswers : [];
    if (!list.length) return patterns;
    var i, k, op;
    for (i = 0; i < list.length; i++) {
      op = (list[i] && list[i].operation) || 'unknown';
      patterns.operation_errors[op] = (patterns.operation_errors[op] || 0) + 1;
    }
    var top = null, topN = 0;
    for (k in patterns.operation_errors) {
      if (patterns.operation_errors[k] > topN) { topN = patterns.operation_errors[k]; top = k; }
    }
    if (top !== null) {
      patterns.common_mistakes.push('Ban thuong nham lan voi ' + top);
      patterns.suggestions.push('Hay luyen tap them cac bai ' + top + ' de cai thien');
    }
    if (list.length >= 5) patterns.suggestions.push('REVIEW_SUG_5');
    else if (list.length >= 3) patterns.suggestions.push('REVIEW_SUG_3');
    else patterns.suggestions.push('REVIEW_SUG_1');
    return patterns;
  }
  function ReviewState() {
    this.name = 'review';
    this.wrongAnswers = [];
    this.lessonTitle = '';
    this.nextState = 'menu';
    this.patterns = analyzeReviewErrors([]);
    this.continueBtn = { x: 525, y: 680, w: 250, h: 60 };
    this.practiceBtn = { x: 525, y: 600, w: 250, h: 60 };
    this.backBtn = { x: 20, y: 720, w: 200, h: 60 };
  }
  ReviewState.prototype = Object.create(Base.prototype); ReviewState.prototype.constructor = ReviewState;
  ReviewState.prototype.enter = function (params) {
    this.wrongAnswers = (params && params.wrongAnswers) || [];
    this.lessonTitle = (params && params.lessonTitle) || '';
    this.nextState = (params && params.next) || 'menu';
    this.patterns = analyzeReviewErrors(this.wrongAnswers);
    // M15-B3 — the app has always recorded per-lesson accuracy but could
    // never read it back. Now that AdaptiveDifficulty exposes weak lessons,
    // show the child what to revise instead of only listing today's errors.
    this.weakLessons = [];
    this.recommendation = '';
    var ad = global.adaptive_difficulty;
    var uid = (global.Game && global.Game.player && global.Game.player.username) || null;
    if (ad && typeof ad.get_weak_lessons === 'function' && uid) {
      try {
        this.weakLessons = ad.get_weak_lessons(uid) || [];
        this.recommendation = ad.get_recommendation(uid) || '';
      } catch (e) {
        this.weakLessons = [];
        this.recommendation = '';
      }
    }
  };
  ReviewState.prototype.handleInput = function (input) {
    var c = input.consumeClick ? input.consumeClick() : null;
    if (!c) return;
    if (hit(c, this.backBtn)) { global.Game.states.change('menu', null, 'fade'); return; }
    if (hit(c, this.continueBtn)) { global.Game.states.change(this.nextState, null, 'fade'); return; }
    if (this.wrongAnswers && this.wrongAnswers.length && hit(c, this.practiceBtn)) {
      global.Game.states.change('practice', {
        wrongAnswers: this.wrongAnswers,
        lessonTitle: this.lessonTitle,
        next: this.nextState
      }, 'fade');
    }
  };
  ReviewState.prototype.update = function (dt) {};
  ReviewState.prototype.draw = function (ctx, W, H) {
    var R = global.Game.renderer; R.clear('#f5f5fa');
    R.text('PHAN TICH LOI SAI', W / 2, 80, { font: 'bold 40px Quicksand, sans-serif', fill: '#323250', align: 'center', baseline: 'middle' });
    if (!this.wrongAnswers.length) {
      R.text('KHONG CO CAU SAI', W / 2, 200, { font: '20px Quicksand, sans-serif', fill: '#329632', align: 'center', baseline: 'middle' });
    } else {
      var i, y;
      R.text('So cau sai: ' + this.wrongAnswers.length, W / 2, 150, { font: '20px Quicksand, sans-serif', fill: '#c83232', align: 'center', baseline: 'middle' });
      y = 220;
      for (i = 0; i < this.patterns.common_mistakes.length && y < 300; i++, y += 40) {
        R.text('XEMLOI ' + this.patterns.common_mistakes[i], W / 2, y, { font: '20px Quicksand, sans-serif', fill: '#c86400', align: 'center', baseline: 'middle' });
      }
      y += 20;
      for (i = 0; i < this.patterns.suggestions.length && y < 340; i++, y += 35) {
        R.text('GOIY ' + this.patterns.suggestions[i], W / 2, y, { font: '18px Quicksand, sans-serif', fill: '#326496', align: 'center', baseline: 'middle' });
      }
      y += 30;
      R.text('Cac cau sai can on tap:', W / 2, y, { font: '20px Quicksand, sans-serif', fill: '#505064', align: 'center', baseline: 'middle' });
      y += 40;
      var show = this.wrongAnswers.slice(0, 3);
      for (i = 0; i < show.length; i++, y += 60) {
        var w = show[i] || {};
        R.text((i + 1) + '. ' + String(w.question || ''), 150, y, { font: '18px Quicksand, sans-serif', fill: '#3c3c3c', baseline: 'middle' });
        R.text('Ban: ' + String(w.userAnswer || '') + ' | Dung: ' + String(w.correctAnswer || ''), 150, y + 25, { font: '16px Quicksand, sans-serif', fill: '#c83232', baseline: 'middle' });
      }
    }
    drawButton(R, this.continueBtn, 'TIEP TUC', GREEN);
    if (this.wrongAnswers && this.wrongAnswers.length) {
      // main.py:1416-1417 — practice entry is only drawn when errors exist
      drawButton(R, this.practiceBtn, 'LUYEN TAP LAI', BLUE);
    }
    drawButton(R, this.backBtn, 'QUAY LAI', RED);
    // M15-B3 — weak-topic strip: the lessons this child is worst at,
    // drawn above the fixed buttons so it never overlaps them.
    if (this.weakLessons && this.weakLessons.length) {
      var wy = this.continueBtn.y - 34, wi;
      R.text('NEU YEU: ' + this.recommendation, W / 2, wy,
        { font: 'bold 18px Quicksand, sans-serif', fill: '#b06a00', align: 'center', baseline: 'middle' });
      for (wi = 0; wi < this.weakLessons.length && wi < 3; wi++, wy -= 26) {
        var wk = this.weakLessons[wi];
        R.text('Bai ' + wk.lesson_id + ' dung ' + wk.correct + '/' + wk.total
          + ' (' + Math.round(wk.accuracy * 100) + '%)', W / 2, wy,
          { font: '16px Quicksand, sans-serif', fill: '#7a5a20', align: 'center', baseline: 'middle' });
      }
    }
  };

  // =========================================================
  // PRACTICE STATE  (main.py:1220-1323) — "LUYỆN TẬP LẠI"
  // M15-B1/B2: re-asks at most the first 3 wrong answers
  // (main.py:1223 wrong_answers[:3]). Question text and correct
  // answer are preserved; distractors are numeric neighbours for
  // numeric answers and A/B/C otherwise (main.py:1243-1247).
  // Completion reports through the victory screen like
  // main.py:1283. HỦY (main.py:1232) returns to review.
  // =========================================================
  function practiceOptions(ans) {
    var opts = [String(ans)];
    var num = parseFloat(ans);
    var isNum = String(ans) !== '' && isFinite(num);
    if (isNum) {
      var seen = {}; seen[String(ans)] = true;
      for (var d = 1; d <= 8 && opts.length < 4; d++) {
        for (var s = -1; s <= 1 && opts.length < 4; s += 2) {
          var cand = String(num + s * d);
          if (!seen[cand]) { seen[cand] = true; opts.push(cand); }
        }
      }
      var pad = 1;
      while (opts.length < 4) { var p2 = String(num + 9 + pad); if (!seen[p2]) { seen[p2] = true; opts.push(p2); } pad++; }
    } else {
      var alts = ['A', 'B', 'C'];
      for (var i = 0; i < alts.length && opts.length < 4; i++) if (opts.indexOf(alts[i]) < 0) opts.push(alts[i]);
    }
    for (var j = opts.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var t = opts[j]; opts[j] = opts[k]; opts[k] = t;
    }
    return opts.slice(0, 4);
  }

  function PracticeState() {
    this.name = 'practice';
    this.wrongAnswers = [];
    this.lessonTitle = '';
    this.nextState = 'menu';
    this.index = 0;
    this.correctCount = 0;
    this.q = '';
    this.ans = null;
    this.buttons = [];
    this.feedback = null;
    this.cancelBtn = { x: 20, y: 720, w: 200, h: 60 };
  }
  PracticeState.prototype = Object.create(Base.prototype);
  PracticeState.prototype.constructor = PracticeState;
  PracticeState.prototype.enter = function (params) {
    this.wrongAnswers = ((params && params.wrongAnswers) || []).slice(0, 3);
    this.lessonTitle = (params && params.lessonTitle) || '';
    this.nextState = (params && params.next) || 'menu';
    this.index = 0;
    this.correctCount = 0;
    this.feedback = null;
    this._loadCurrent();
  };
  PracticeState.prototype._loadCurrent = function () {
    this.feedback = null;
    if (this.index >= this.wrongAnswers.length) { this.q = ''; this.ans = null; this.buttons = []; return; }
    var w = this.wrongAnswers[this.index] || {};
    this.q = String(w.question || '');
    this.ans = String(w.correctAnswer !== undefined && w.correctAnswer !== null ? w.correctAnswer : '');
    var all = practiceOptions(this.ans);
    // same 2x2 grid geometry as the lesson answer buttons (states_real.js 1191-1203)
    this.buttons = all.map(function (o, i) {
      return { x: 420 + (i % 2) * 240, y: 440 + Math.floor(i / 2) * 110, w: 220, h: 90, value: o, index: i };
    });
  };
  PracticeState.prototype.handleInput = function (input) {
    var c = input.consumeClick ? input.consumeClick() : null;
    if (!c) return;
    if (this.feedback && this.feedback.active) { this.feedback.active = false; this._advance(); return; }
    if (hit(c, this.cancelBtn)) {
      global.Game.states.change('review', { wrongAnswers: this.wrongAnswers, lessonTitle: this.lessonTitle, next: this.nextState }, 'fade');
      return;
    }
    for (var i = 0; i < this.buttons.length; i++) {
      var b = this.buttons[i];
      if (hit(c, b)) {
        var okHit = String(b.value) === String(this.ans);
        if (okHit) this.correctCount++;
        this.feedback = { question: this.q, correctAnswer: String(this.ans), userAnswer: String(b.value), correct: okHit, active: true };
        return;
      }
    }
  };
  PracticeState.prototype._advance = function () {
    this.index++;
    if (this.index >= this.wrongAnswers.length) {
      var total = this.wrongAnswers.length;
      var acc = total > 0 ? (this.correctCount / total) * 100 : 100;
      global.Game.states.change('victory', {
        title: 'HOAN THANH LUYEN TAP!',
        score: this.correctCount * 10,
        lessonTitle: this.lessonTitle,
        lessonId: 0,
        stats: { correct: this.correctCount, total: total, accuracy: acc, avgTime: 0, wrongAnswers: this.wrongAnswers }
      }, 'fade');
      return;
    }
    this._loadCurrent();
  };
  PracticeState.prototype.update = function (dt) {};
  PracticeState.prototype.draw = function (ctx, W, H) {
    var R = global.Game.renderer;
    R.clear('#f5f5fa');
    R.text('LUYEN TAP LAI', W / 2, 80, { font: 'bold 40px Quicksand, sans-serif', fill: '#323250', align: 'center', baseline: 'middle' });
    R.text('Cau ' + Math.min(this.index + 1, Math.max(this.wrongAnswers.length, 1)) + '/' + this.wrongAnswers.length, W / 2, 150, { font: '20px Quicksand, sans-serif', fill: '#646478', align: 'center', baseline: 'middle' });
    if (this.index < this.wrongAnswers.length) {
      R.fillRoundRect(W / 2 - 400, 220, 800, 200, 20, '#ffffff', 'rgb(100,150,200)', 3);
      R.text(this.q, W / 2, 320, { font: 'bold 24px Quicksand, sans-serif', fill: '#282828', align: 'center', baseline: 'middle' });
      for (var i = 0; i < this.buttons.length; i++) drawButton(R, this.buttons[i], String(this.buttons[i].value), PURPLE);
      if (this.feedback && this.feedback.active) {
        var fcol = this.feedback.correct ? '#16a34a' : '#dc2626';
        R.fillRoundRect(W / 2 - 300, 300, 600, 120, 18, 'rgba(10,14,28,0.92)', fcol, 3);
        R.text(this.feedback.correct ? 'DUNG ROI! (bam de tiep tuc)' : 'SAI ROI — bam de tiep tuc', W / 2, 340, { font: 'bold 24px Quicksand, sans-serif', fill: '#ffffff', align: 'center', baseline: 'middle' });
        if (!this.feedback.correct) R.text('Dap an dung: ' + this.feedback.correctAnswer, W / 2, 388, { font: '18px Quicksand, sans-serif', fill: '#ffe9a8', align: 'center', baseline: 'middle' });
      }
    } else {
      R.text('Ban da hoan thanh luyen tap!', W / 2, 300, { font: '20px Quicksand, sans-serif', fill: '#329632', align: 'center', baseline: 'middle' });
    }
    drawButton(R, this.cancelBtn, 'HUY', RED);
  };

  global.SettingsState = SettingsState; global.PasswordChangeState = PasswordChangeState;
  global.ReviewState = ReviewState; global.PracticeState = PracticeState;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      SettingsState: SettingsState, PasswordChangeState: PasswordChangeState,
      ReviewState: ReviewState, PracticeState: PracticeState,
      practiceOptions: practiceOptions, analyzeReviewErrors: analyzeReviewErrors
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
