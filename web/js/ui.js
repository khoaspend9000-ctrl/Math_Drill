(function (global) {
  'use strict';
  /* M8-C UI: Button + CardButton (game_init.py 3855/3989) + ProgressBar + Popup + AchievementPopup + RealisticBook + DailyRewardPopup. */
  function clamp(v, lo, hi) {
    var n = Number(v); if (!isFinite(n)) return lo;
    if (n < lo) return lo; if (n > hi) return hi; return n;
  }
  function hitRect(x, y, r) {
    if (!r) return false;
    var rx = (r.x !== undefined) ? r.x : r.left;
    var ry = (r.y !== undefined) ? r.y : r.top;
    var w = (r.w !== undefined) ? r.w : r.width;
    var h = (r.h !== undefined) ? r.h : r.height;
    return x >= rx && x <= rx + w && y >= ry && y <= ry + h;
  }
  function smoothLerp(cur, target, speed) { return cur + (target - cur) * speed; }
  class Button {
    constructor(x, y, w, h, text, color, opts) {
      var o = opts || {};
      this.rect = { x: x, y: y, w: w, h: h };
      this.text = text || '';
      this.color = color || [80, 120, 220];
      this.disabled = !!o.disabled;
      this.hovered = false;
      this.hoverAnim = 0;
      this.glowPhase = 0;
      this.clickScale = 1.0;
      this.pressed = 0;
    }
    hitTest(px, py) { return hitRect(px, py, this.rect); }
    setPointer(px, py) {
      this.hovered = this.disabled ? false : this.hitTest(px, py);
      return this.hovered;
    }
    update(dt, px, py) {
      var t = (px !== undefined && !this.disabled && this.hitTest(px, py)) ? 1 : (this.hovered && !this.disabled ? 1 : 0);
      if (px !== undefined) this.hovered = (t === 1);
      this.hoverAnim = smoothLerp(this.hoverAnim, t, 0.20);
      this.glowPhase += 0.05;
      if (this.clickScale !== 1.0) this.clickScale = smoothLerp(this.clickScale, 1.0, 0.08);
      if (this.pressed > 0) this.pressed = Math.max(0, this.pressed - dt);
      return this.hoverAnim;
    }
    clicked(pos) {
      if (this.disabled) return false;
      var px = pos ? (pos.x !== undefined ? pos.x : pos[0]) : NaN;
      var py = pos ? (pos.y !== undefined ? pos.y : pos[1]) : NaN;
      if (this.hitTest(px, py)) { this.clickScale = 0.9; this.pressed = 0.18; return true; }
      return false;
    }
    handleClick(pos) { return this.clicked(pos); }
    setDisabled(d) { this.disabled = !!d; if (this.disabled) this.hovered = false; return this.disabled; }
    draw(R) {
      if (!R || typeof R.fillRoundRect !== 'function') return;
      var s = (1.0 + this.hoverAnim * 0.01) * this.clickScale;
      var w = Math.max(1, Math.round(this.rect.w * s));
      var h = Math.max(1, Math.round(this.rect.h * s));
      var cx = this.rect.x + this.rect.w / 2, cy = this.rect.y + this.rect.h / 2;
      var c = this.color, b = Math.round(this.hoverAnim * 50);
      var fill = this.disabled ? '#888888' : 'rgb(' + Math.min(255, c[0] + b) + ',' + Math.min(255, c[1] + b) + ',' + Math.min(255, c[2] + b) + ')';
      var pressDrop = this.pressed > 0 ? 3 : 0;
      R.fillRoundRect(Math.round(cx - w / 2), Math.round(cy - h / 2 - this.hoverAnim * 8 + pressDrop), w, h, 20, fill, null, 0);
      if (typeof R.text === 'function' && this.text) R.text(String(this.text), cx, cy, { align: 'center', baseline: 'middle' });
    }
  }
  class CardButton {
    constructor(x, y, w, h, icon, title, desc, color, accentColor, opts) {
      var o = opts || {};
      this.rect = { x: x, y: y, w: w, h: h };
      this.icon = icon || ''; this.title = title || ''; this.desc = desc || '';
      this.color = color || [90, 60, 160];
      this.accentColor = accentColor || this.color;
      this.disabled = !!o.disabled;
      this.hoverScale = 0; this.clickScale = 1.0; this.glowPhase = 0;
    }
    hitTest(px, py) { return hitRect(px, py, this.rect); }
    update(dt, px, py) {
      var t = (px !== undefined && !this.disabled && this.hitTest(px, py)) ? 1 : 0;
      var k = Math.min(1, (dt || 0.016) * 10);
      this.hoverScale += (t - this.hoverScale) * k;
      this.glowPhase += (dt || 0.016) * 3.0;
      if (this.clickScale < 1.0) this.clickScale = Math.min(1, this.clickScale + 0.05);
      return this.hoverScale;
    }
    clicked(pos) {
      if (this.disabled) return false;
      var px = pos ? (pos.x !== undefined ? pos.x : pos[0]) : NaN;
      var py = pos ? (pos.y !== undefined ? pos.y : pos[1]) : NaN;
      if (this.hitTest(px, py)) { this.clickScale = 0.92; return true; }
      return false;
    }
    handleClick(pos) { return this.clicked(pos); }
    draw(R) {
      if (!R || typeof R.fillRoundRect !== 'function') return;
      var s = (1.0 + this.hoverScale * 0.01) * this.clickScale;
      var w = Math.max(1, Math.round(this.rect.w * s)), h = Math.max(1, Math.round(this.rect.h * s));
      var cx = this.rect.x + this.rect.w / 2, cy = this.rect.y + this.rect.h / 2;
      R.fillRoundRect(Math.round(cx - w / 2), Math.round(cy - h / 2 - this.hoverScale * 6), w, h, 25, 'rgb(' + this.color[0] + ',' + this.color[1] + ',' + this.color[2] + ')', null, 0);
      if (typeof R.text === 'function') {
        if (this.icon) R.text(String(this.icon), this.rect.x + 20, cy, { align: 'left', baseline: 'middle' });
        if (this.title) R.text(String(this.title), this.rect.x + 75, this.desc ? this.rect.y + 30 : cy, { align: 'left', baseline: 'middle' });
        if (this.desc) R.text(String(this.desc), this.rect.x + 75, this.rect.y + 58, { align: 'left', baseline: 'middle' });
      }
    }
  }
  /* ProgressBar: port of draw_progress_bar (game_init.py ~2895). */
  function barColor(ratio) {
    if (ratio >= 0.8) return '#64dc64';
    if (ratio >= 0.5) return '#dcc832';
    return '#64b4dc';
  }
  class ProgressBar {
    constructor(x, y, w, h, opts) {
      var o = opts || {};
      this.rect = { x: x, y: y, w: w, h: h };
      this.value = 0; this.total = 100; this.label = o.label || '';
      this.set(0, 100);
    }
    set(current, total) {
      var t = Number(total); if (!isFinite(t) || t <= 0) t = 0;
      var c = Number(current); if (!isFinite(c)) c = 0;
      if (c < 0) c = 0; if (t > 0 && c > t) c = t;
      this.value = c; this.total = t;
      this.ratio = (t > 0) ? c / t : 0;
      this.pct = Math.round(this.ratio * 100);
      this.fillColor = barColor(this.ratio);
      return this.ratio;
    }
    text() { return this.label ? (this.label + ' ' + this.value + '/' + this.total + ' (' + this.pct + '%)') : (this.pct + '%'); }
    draw(R) {
      if (!R || typeof R.fillRoundRect !== 'function') return;
      var r = this.rect, h = Math.max(1, r.h), rr = Math.floor(h / 2);
      R.fillRoundRect(r.x, r.y, r.w, h, rr, '#3c3c3c', null, 0);
      var fw = Math.floor(r.w * this.ratio);
      if (fw > 0) R.fillRoundRect(r.x, r.y, fw, h, rr, this.fillColor, null, 0);
      if (typeof R.text === 'function') R.text(this.text(), r.x + r.w / 2, r.y + h / 2, { align: 'center', baseline: 'middle' });
    }
  }
  /* TrackedListener: no-leak DOM listeners (T09/T17). */
  var UI_LISTENERS = { count: 0 };
  function addTracked(el, type, fn, opts) {
    if (!el || typeof el.addEventListener !== 'function') return null;
    el.addEventListener(type, fn, opts);
    UI_LISTENERS.count += 1;
    return { el: el, type: type, fn: fn, opts: opts, _off: false };
  }
  function removeTracked(h) {
    if (!h || h._off) return;
    try { h.el.removeEventListener(h.type, h.fn, h.opts); } catch (_) {}
    h._off = true;
    UI_LISTENERS.count = Math.max(0, UI_LISTENERS.count - 1);
  }
  /* Popup: modal with backdrop + buttons (Python: overlay + card). */
  class Popup {
    constructor(opts) {
      var o = opts || {};
      this.w = o.w || 560; this.h = o.h || 320;
      this.title = o.title || '';
      this.open_ = false;
      this.buttons = [];
      this._handles = [];
      this.onClose = (typeof o.onClose === 'function') ? o.onClose : null;
      var labels = o.buttons || ['OK'];
      for (var i = 0; i < labels.length; i++) this.addButton(labels[i]);
    }
    get open() { return this.open_; }
    get listenerCount() { return this._handles.length; }
    addButton(label) {
      var bw = 160, bh = 52, n = this.buttons.length;
      var b = new Button(0, 0, bw, bh, label, [80, 120, 220], {});
      this.buttons.push(b);
      this._layout();
      return b;
    }
    _layout() {
      var cx = 650, cy = 400, gap = 20, bw = 160;
      var total = this.buttons.length * bw + (this.buttons.length - 1) * gap;
      for (var i = 0; i < this.buttons.length; i++) {
        this.buttons[i].rect.x = Math.round(cx - total / 2 + i * (bw + gap));
        this.buttons[i].rect.y = Math.round(cy + this.h / 2 - 90);
      }
    }
    show() {
      if (this.open_) return false;
      this.open_ = true;
      return true;
    }
    close() {
      if (!this.open_) return false;
      this.open_ = false;
      for (var i = 0; i < this._handles.length; i++) removeTracked(this._handles[i]);
      this._handles = [];
      if (this.onClose) { var f = this.onClose; this.onClose = null; try { f(); } catch (_) {} }
      return true;
    }
    attachDom(el, evName) {
      var self = this;
      function h() { self.close(); }
      var hh = addTracked(el, evName || 'click', h);
      if (hh) this._handles.push(hh);
      return hh;
    }
    clickButton(idx, pos) {
      if (!this.open_) return null;
      var b = this.buttons[idx];
      if (!b || b.disabled) return null;
      var p = pos || { x: b.rect.x + b.rect.w / 2, y: b.rect.y + b.rect.h / 2 };
      if (b.clicked(p)) { this.close(); return b.text; }
      return null;
    }
    draw(R) {
      if (!this.open_) return;
      if (R && typeof R.fillRoundRect === 'function') {
        var cx = 650, cy = 400;
        R.fillRoundRect(Math.round(cx - this.w / 2), Math.round(cy - this.h / 2), this.w, this.h, 24, '#232741', '#c8aa50', 4);
        if (this.title && typeof R.text === 'function') R.text(this.title, cx, Math.round(cy - this.h / 2 + 40), { align: 'center', baseline: 'middle' });
        for (var i = 0; i < this.buttons.length; i++) this.buttons[i].draw(R);
      }
    }
  }
  /* AchievementPopup: 4.0s fade in/hold/out. */
  class AchievementPopup {
    constructor(key, def) {
      var d = def || {};
      this.key = key || '';
      this.name = d.name || 'Achievement';
      this.desc = d.desc || '';
      this.icon = d.icon || 'T';
      this.xp = d.xp || 0;
      this.timer = 0; this.duration = 4.0;
      this.alpha = 0; this.yOff = 50; this.active = true;
    }
    update(dt) {
      this.timer += dt;
      if (this.timer < 0.5) { this.alpha = Math.min(255, Math.floor(this.timer * 510)); this.yOff = Math.max(0, 50 - this.timer * 100); }
      else if (this.timer < this.duration - 0.8) { this.alpha = 255; this.yOff = 0; }
      else { var f = (this.timer - (this.duration - 0.8)) / 0.8; if (f < 0) f = 0; if (f > 1) f = 1; this.alpha = Math.max(0, Math.floor(255 * (1 - f))); this.yOff = -30 * f; }
      if (this.timer >= this.duration) this.active = false;
      return this.active;
    }
    draw(R) {
      if (!this.active || !R || typeof R.fillRoundRect !== 'function') return;
      R.fillRoundRect(440, Math.round(20 + this.yOff), 420, 100, 16, '#232741', '#c8aa50', 3);
      if (typeof R.text === 'function') {
        R.text(this.icon, 470, 70 + this.yOff, { align: 'left', baseline: 'middle' });
        R.text(this.name, 520, 55 + this.yOff, { align: 'left', baseline: 'middle' });
        R.text(this.desc, 520, 85 + this.yOff, { align: 'left', baseline: 'middle' });
      }
    }
  }
  class AchievementQueue {
    constructor() { this.items = []; this.current = null; this.shown = 0; }
    push(key, def) {
      if (this.items.length >= 20) return false;
      for (var i = 0; i < this.items.length; i++) if (this.items[i].key === key) return false;
      if (this.current && this.current.key === key) return false;
      this.items.push(new AchievementPopup(key, def));
      return true;
    }
    update(dt) {
      if (!this.current) { if (!this.items.length) return false; this.current = this.items.shift(); this.shown += 1; }
      if (!this.current.update(dt)) this.current = null;
      return true;
    }
    get pending() { return this.items.length + (this.current ? 1 : 0); }
  }
  /* Static title/body data exported from Desktop data_manager.py.
     A book does not load all lessons by default: each state owns its content. */
  var _theoryPages = null;
  function _loadTheoryPages() {
    if (_theoryPages) return _theoryPages;
    var tp = global.TheoryPages;
    if (typeof tp !== 'function' && typeof module !== 'undefined' && module.exports) {
      tp = require('./theory_pages.js');
    }
    if (typeof tp === 'function') _theoryPages = tp();
    return _theoryPages;
  }

  /* RealisticBook: page order + flip animation + rapid-click guard.
     Python concept (game_init.py RealisticBook): ordered pages, next/prev
     with a short flip animation during which input is ignored. */
  class RealisticBook {
    constructor(pages, opts) {
      var o = opts || {};
      // Desktop constructs a shell; states explicitly own their page content.
      this.pages = Array.isArray(pages) ? pages.slice() : [];
      this.index = 0;
      this.flipping = false;
      this.flipT = 0;
      this.flipDur = (typeof o.flipDur === 'number' && o.flipDur > 0) ? o.flipDur : 0.35;
      this.flipDir = 0;
      this.rect = { x: o.x || 150, y: o.y || 100, w: o.w || 1000, h: o.h || 600 };
      this.nextRect = { x: this.rect.x + this.rect.w - 140, y: this.rect.y + this.rect.h - 70, w: 110, h: 44 };
      this.prevRect = { x: this.rect.x + 30, y: this.rect.y + this.rect.h - 70, w: 110, h: 44 };
      /* Desktop parity: game_init.py RealisticBook.page_api — optional callback
         that renders per-page content onto each page rect. When set, _drawPage
         delegates content rendering to it (same (surface, rect) contract). */
      this.pageApi = (typeof o.pageApi === 'function') ? o.pageApi : null;
    }
    get page() { return this.pages[this.index]; }
    get pageIndex() { return this.index; }
    get pageCount() { return this.pages.length; }
    get animating() { return this.flipping; }
    /* setPageApi(fn): wire a per-page content renderer (Desktop parity with
       game_init.py page_api). The callback receives (Renderer, pageRect, pageObj,
       currentIndex, totalPages). Used for theory pages (grade=N → theory_pages). */
    setPageApi(fn) {
      this.pageApi = (typeof fn === 'function') ? fn : null;
      return this;
    }
    /* reset: restore book-page identity when a state (re-)enters.
       P1 integration calls this on enter; Desktop parity = open on the first page. */
    reset(index) {
      var n = (index === undefined || index === null) ? 0 : Math.floor(Number(index));
      if (!isFinite(n)) n = 0;
      var last = this.pages.length ? this.pages.length - 1 : 0;
      this.index = Math.max(0, Math.min(last, n));
      this.flipping = false;
      this.flipT = 0;
      this.flipDir = 0;
      this._target = null;
      return this.index;
    }
    canNext() { return !this.flipping && this.index < this.pages.length - 1; }
    canPrev() { return !this.flipping && this.index > 0; }
    next() {
      if (!this.canNext()) return false;
      this.flipping = true; this.flipT = 0; this.flipDir = 1;
      return true;
    }
    prev() {
      if (!this.canPrev()) return false;
      this.flipping = true; this.flipT = 0; this.flipDir = -1;
      return true;
    }
    goTo(i) {
      var n = Number(i);
      if (!isFinite(n)) return false;
      n = Math.floor(n);
      if (n < 0 || n >= this.pages.length || this.flipping) return false;
      if (n === this.index) return true;
      this.flipDir = n > this.index ? 1 : -1;
      this._target = n;
      this.flipping = true; this.flipT = 0;
      return true;
    }
    click(pos) {
      if (!pos || this.flipping) return null;
      var px = (pos.x !== undefined ? pos.x : pos[0]);
      var py = (pos.y !== undefined ? pos.y : pos[1]);
      if (hitRect(px, py, this.nextRect)) return this.next() ? 'next' : null;
      if (hitRect(px, py, this.prevRect)) return this.prev() ? 'prev' : null;
      return null;
    }
    update(dt) {
      if (!this.flipping) return false;
      this.flipT += (dt || 0.016);
      if (this.flipT >= this.flipDur) {
        this.flipping = false; this.flipT = 0;
        if (this._target !== undefined && this._target !== null) {
          this.index = this._target; this._target = null;
        } else {
          this.index += this.flipDir;
          if (this.index < 0) this.index = 0;
          if (this.index > this.pages.length - 1) this.index = this.pages.length - 1;
        }
        this.flipDir = 0;
        return true; // completed
      }
      return false;
    }
    /* ---- Desktop parity geometry -------------------------------------
       game_init.py RealisticBook.__init__: page_w = (w - 40) // 2, and draw()
       paints a 40px spine strip between the two pages. */
    get pageW() { return Math.floor((this.rect.w - 40) / 2); }
    get leftRect() {
      return { x: this.rect.x, y: this.rect.y, w: this.pageW, h: this.rect.h };
    }
    get rightRect() {
      return { x: this.rect.x + this.pageW + 40, y: this.rect.y, w: this.pageW, h: this.rect.h };
    }
    get spineRect() {
      return { x: this.rect.x + this.pageW, y: this.rect.y + 10, w: 40, h: this.rect.h - 20 };
    }
    get coverRect() {
      return { x: this.rect.x - 12, y: this.rect.y - 10, w: this.rect.w + 24, h: this.rect.h + 20 };
    }
    get coverInnerRect() {
      return { x: this.rect.x - 8, y: this.rect.y - 8, w: this.rect.w + 16, h: this.rect.h + 16 };
    }
    /* flipProgress 0->1 maps to game_init.py flip_progress (animated at dt*3.0 =
       ~0.33s, i.e. flipDur 0.35 below). flipActive maps to flip_active. */
    get flipProgress() {
      if (!this.flipping) return 0;
      var p = this.flipDur > 0 ? (this.flipT / this.flipDur) : 1;
      return p < 0 ? 0 : (p > 1 ? 1 : p);
    }
    get flipActive() { return this.flipping; }
    /* Page-curl geometry (game_init.py _draw_page_with_curl): the outgoing page
       shrinks 1.0 -> 0.7, the incoming page expands 0.7 -> 1.0. The Desktop shadow
       gradient strip is approximated with a solid strip (the Renderer API has no
       per-pixel alpha gradient); no extra page-turn mode is introduced. */
    _curlRect(r, progress, isOldPage) {
      var p = progress < 0 ? 0 : (progress > 1 ? 1 : progress);
      var scale = isOldPage ? (1 - p * 0.3) : (0.7 + p * 0.3);
      var w = Math.max(1, Math.round(r.w * scale));
      var x = isOldPage ? r.x : Math.round(r.x + r.w * (1 - scale));
      return { x: x, y: r.y, w: w, h: r.h };
    }
    _drawPage(R, r, fn, progress, isOldPage, animate) {
      var rr = animate ? this._curlRect(r, progress, isOldPage) : r;
      var page = (this.index >= 0 && this.index < this.pages.length) ? this.pages[this.index] : null;
      /* Desktop parity: if pageApi is set, delegate content rendering to it
         (same (surface, rect, page) contract as game_init.py page_api).
         The page argument may be an empty label (e.g. the two leading blank
         slots Desktop puts in self.pages before "Bài 1"); the callback decides
         what to paint, so we do NOT gate on `page` truthiness. */
      if (typeof this.pageApi === 'function') {
        this.pageApi(R, rr, page, this.index, this.pages.length);
        return rr;
      }
      if (typeof fn === 'function') { fn(R, rr); return rr; }
      /* Legacy single-page behaviour (kept for earlier milestones): when no page
         callback is supplied, render the page label + "i / n" indicator. */
      if (typeof R.text === 'function' && this.pages.length) {
        R.text(String(this.pages[this.index]), rr.x + rr.w / 2, rr.y + rr.h / 2 - 20,
          { align: 'center', baseline: 'middle' });
        R.text((this.index + 1) + ' / ' + this.pages.length, rr.x + rr.w / 2, rr.y + rr.h - 40,
          { align: 'center', baseline: 'middle' });
      }
      return rr;
    }
    /* draw(R, leftFunc, rightFunc, withTransition)
       Chrome parity with game_init.py RealisticBook.draw (line 4345):
         outer cover (80,50,20) r=15 · inner cover (101,67,33) r=12 ·
         spine (150,150,150) r=5 · pages (253,246,227) r=10.
       Page callbacks are called as fn(Renderer, pageRect) — the same
       (surface, rect) contract the Desktop uses. Passing no callbacks keeps the
       legacy single-page text behaviour, so earlier milestone tests stay valid.
       Uniform corner radius is used because the Renderer API has no per-corner
       radius; the Desktop uses square outer corners on the page rects. */
    draw(R, leftFunc, rightFunc, withTransition) {
      if (!R || typeof R.fillRoundRect !== 'function') return null;
      var animate = !!withTransition && this.flipping;
      var lr = this.leftRect, rr = this.rightRect, sp = this.spineRect;
      var co = this.coverRect, ci = this.coverInnerRect;
      R.fillRoundRect(co.x, co.y, co.w, co.h, 15, '#503214');
      R.fillRoundRect(ci.x, ci.y, ci.w, ci.h, 12, '#654321');
      R.fillRoundRect(sp.x, sp.y, sp.w, sp.h, 5, '#969696');
      R.fillRoundRect(lr.x, lr.y, lr.w, lr.h, 10, '#fdf6e3');
      R.fillRoundRect(rr.x, rr.y, rr.w, rr.h, 10, '#fdf6e3');
      var out;
      if (!animate) {
        this._drawPage(R, lr, leftFunc, 0, false, false);
        out = this._drawPage(R, rr, rightFunc, 1, false, false);
        return out;
      }
      var leftOld = this.flipDir >= 0; // slide_left: left page is the outgoing one
      var a = this._drawPage(R, lr, leftFunc, this.flipProgress, leftOld, true);
      var b = this._drawPage(R, rr, rightFunc, this.flipProgress, !leftOld, true);
      if (typeof R.fillRect === 'function') {
        var alpha = Math.round(100 * (1 - this.flipProgress));
        if (alpha > 0) {
          var sw = 8 + Math.round(this.flipProgress * 4);
          var sx = leftOld ? a.x + a.w : b.x - sw;
          R.fillRect(sx, a.y, sw, a.h);
        }
      }
      return b;
    }
  }
  /* DailyRewardPopup: 7-day display model (visual + claim state). */
  class DailyRewardPopup extends Popup {
    constructor(opts) {
      var o = opts || {};
      o.w = o.w || 640; o.h = o.h || 360; o.title = o.title || 'Diem danh hang ngay';
      o.buttons = o.buttons || ['Nhan', 'Dong'];
      super(o);
      this.days = [];
      var rewards = o.rewards || [50, 60, 70, 80, 100, 150, 300];
      for (var i = 0; i < 7; i++) {
        this.days.push({ day: i + 1, reward: rewards[i], claimed: false, today: false });
      }
      this.claimedToday = false;
      if (typeof o.today === 'number') this.setToday(o.today);
      else this.setToday(1);
    }
    setToday(dayNum) {
      var n = Math.floor(Number(dayNum));
      if (!isFinite(n)) n = 1;
      n = Math.max(1, Math.min(7, n));
      for (var i = 0; i < 7; i++) this.days[i].today = (this.days[i].day === n);
      this.today = n;
      return this.today;
    }
    markClaimed(dayNum) {
      var n = Math.floor(Number(dayNum));
      for (var i = 0; i < 7; i++) if (this.days[i].day === n) { this.days[i].claimed = true; return true; }
      return false;
    }
    claimToday() {
      if (this.claimedToday) return null;
      var d = this.days[this.today - 1];
      if (!d || d.claimed) return null;
      d.claimed = true; this.claimedToday = true;
      return { day: d.day, reward: d.reward };
    }
    get todayClaimed() { return this.claimedToday; }
  }
  /* TheoryBookUtils: Wires desktop theory_data (from data_manager.py) into
     RealisticBook.pageApi. theory_pages.js exports a factory that returns the
     grade→pages map parsed from desktop's theory_data. The returned pageApi
     callback paints the current page's title + content inside the page rect,
     matching the Desktop parity contract (surface, rect, pageObj, idx, n). */
  function makeTheoryPageApi(grade) {
    var pages = _loadTheoryPages();
    var gradePages = (pages && pages[grade]) ? pages[grade] : null;
    if (!gradePages || !gradePages.length) return null;
    return function theoryPageApi(R, rect, pageObj, idx, n) {
      if (!R || typeof R.fillRoundRect !== 'function') return;
      var x = rect.x, y = rect.y, w = rect.w, h = rect.h;
      if (typeof R.fillRoundRect === 'function') {
        R.fillRoundRect(x + 14, y + 14, w - 28, h - 28, 8, '#fffdf5');
      }
      if (typeof R.text === 'function') {
        var title = (pageObj && pageObj.t) ? pageObj.t : '';
        var content = (pageObj && pageObj.c) ? pageObj.c : '';
        R.text(title, x + w / 2, y + 40, { align: 'center', baseline: 'middle' });
        if (typeof R.font === 'function' || true) {
          try { R.font && R.font('bold', 15); } catch (_) {}
        }
        var lines = (content || '').split('\n');
        var lh = 22, startY = y + 72;
        for (var i = 0; i < lines.length; i++) {
          var ly = startY + i * lh;
          if (ly > y + h - 18) break;
          R.text(String(lines[i]), x + 34, ly, { align: 'left', baseline: 'middle' });
        }
      }
    };
  }

  var UI = {
    Button: Button, CardButton: CardButton, ProgressBar: ProgressBar,
    Popup: Popup, AchievementPopup: AchievementPopup, AchievementQueue: AchievementQueue,
    RealisticBook: RealisticBook, DailyRewardPopup: DailyRewardPopup,
    UI_LISTENERS: UI_LISTENERS, addTracked: addTracked, removeTracked: removeTracked,
    hitRect: hitRect, clamp: clamp,
    makeTheoryPageApi: makeTheoryPageApi
  };
  global.UI = UI;
  if (typeof module !== 'undefined' && module.exports) { module.exports = UI; }
})(typeof window !== 'undefined' ? window : globalThis);
