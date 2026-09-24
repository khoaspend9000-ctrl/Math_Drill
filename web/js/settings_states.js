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
  global.SettingsState = SettingsState; global.PasswordChangeState = PasswordChangeState;
  if (typeof module !== 'undefined' && module.exports) module.exports = { SettingsState: SettingsState, PasswordChangeState: PasswordChangeState };
})(typeof window !== 'undefined' ? window : globalThis);
