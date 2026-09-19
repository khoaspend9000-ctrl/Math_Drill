/* Polish M2 — Menu dashboard left page + Theory state polish
 * ------------------------------------------------------------------
 * ADDITIVE, GUARDED module. Does NOT rewrite existing architecture and
 * does NOT change gameplay logic. It only exposes formatting / layout
 * helpers that mirror the Desktop (Python) MenuState.draw_left and
 * TheoryState behaviour, plus a prototype-hook installer that is a
 * no-op when the target classes are absent (e.g. in unit tests).
 *
 * Source of truth (read-only): main.py -> MenuState.draw_left,
 *                              main.py -> TheoryState (scroll clamp).
 * No Python source is modified by this file.
 */
(function (root) {
  'use strict';

  var VERSION = 'polish-m2-1';

  function warn(label, e) {
    if (root && root.console && root.console.warn) {
      root.console.warn('[PolishM2] ' + label + ' failed', e);
    }
  }

  /* ------------------------------------------------------------------
   * Menu dashboard left-page element checklist.
   * Mirrors the elements drawn by Desktop MenuState.draw_left so the
   * Web left page can render the same set (identity parity).
   * ------------------------------------------------------------------ */
  var MENU_DASHBOARD_FIELDS = [
    'greeting',
    'username',
    'level_badge',
    'grade_badge',
    'exp_bar',
    'gold_badge',
    'difficulty_badge',
    'streak_badge',
    'pet_block',
    'pet_evolution_progress',
    'achievement_preview',
    'avatar',
    'daily_tasks_panel'
  ];

  /* ------------------------------- formatters ----------------------- */

  function toInt(v) {
    var n = Number(v);
    return isFinite(n) ? (n | 0) : 0;
  }

  // "Lv N" badge label (Desktop style)
  function fmtLevel(v) {
    return 'Lv ' + toInt(v);
  }

  // Thousands separator using '.' (matches Desktop localized gold text)
  function fmtGold(v) {
    var n = toInt(v);
    var neg = n < 0;
    var s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '-' : '') + s;
  }

  // EXP bar text + clamped fill ratio (0..1)
  function fmtExp(cur, total) {
    var c = toInt(cur);
    var t = toInt(total);
    if (c < 0) c = 0;
    var pct = t > 0 ? Math.max(0, Math.min(1, c / t)) : 0;
    return { text: c + '/' + t, pct: pct };
  }

  function fmtStreak(n) {
    var v = toInt(n);
    return v > 0 ? ('\uD83D\uDD25 ' + v) : '0';
  }

  // Difficulty label. Index follows Desktop difficulty tiers without
  // inventing new data: unknown values fall back to the raw value.
  function fmtDifficulty(d) {
    var map = { 0: 'D\u1EC5', 1: 'Trung b\u00ECnh', 2: 'Kh\u00F3', 3: 'R\u1EA5t kh\u00F3' };
    return Object.prototype.hasOwnProperty.call(map, d) ? map[d] : String(d);
  }

  // Pet evolution progress. Uses only data passed in (never invents).
  function petEvolutionProgress(pet, info) {
    if (!pet) return { stage: 0, maxStage: 1, pct: 0 };
    var stage = toInt(pet.stage !== undefined ? pet.stage : pet.current_stage);
    var rawMax = (info && (info.max_stage !== undefined ? info.max_stage : info.stages));
    if (rawMax === undefined || rawMax === null) {
      rawMax = pet.max_stage;
    }
    var maxStage = toInt(rawMax);
    if (maxStage <= 0) maxStage = 1;
    if (stage < 0) stage = 0;
    var pct = Math.max(0, Math.min(1, stage / maxStage));
    return { stage: stage, maxStage: maxStage, pct: pct };
  }

  /* --------------------------- theory scrolling --------------------- */

  // Bounded scroll offset (Desktop clamps within content height).
  function clampScroll(offset, contentH, viewH) {
    var max = Math.max(0, toInt(contentH) - toInt(viewH));
    var o = toInt(offset);
    if (o < 0) o = 0;
    if (o > max) o = max;
    return o;
  }

  function scrollBy(offset, delta, contentH, viewH) {
    return clampScroll(toInt(offset) + toInt(delta), contentH, viewH);
  }

  /* ---------------------- additive parity helpers ------------------- */
  /* Pure formatters/geometry. No gameplay logic, no side effects. */

  // EXP bar ratio (0..1). Mirrors Desktop exp / exp_to_next_level clamp.
  function expRatio(cur, total) {
    var c = toInt(cur);
    var t = toInt(total);
    if (!(t > 0)) return 0;
    if (!(c > 0)) return 0;
    var r = c / t;
    if (!isFinite(r)) return 0;
    return r > 1 ? 1 : r;
  }

  // Difficulty tier label (Desktop tiers 1..4). Unknown -> default tier.
  function difficultyLabel(d) {
    var map = { 1: 'D\u1EC5', 2: 'Trung B\u00ECnh', 3: 'Kh\u00F3', 4: 'Th\u1EED Th\u00E1ch' };
    var n = toInt(d);
    if (!n || !Object.prototype.hasOwnProperty.call(map, n)) n = 1;
    return map[n];
  }

  // Pet evolution ratio (0..1) from explicit current/next values only.
  function petProgress(cur, next) {
    var c = toInt(cur);
    var n = toInt(next);
    if (!(n > 0)) return 0;
    if (!(c > 0)) return 0;
    var r = c / n;
    if (!isFinite(r)) return 0;
    return r > 1 ? 1 : r;
  }

  // Greedy word wrap for the theory page.
  function wrapText(text, maxChars) {
    var s = (text === undefined || text === null) ? '' : String(text);
    if (!s) return [];
    var max = toInt(maxChars);
    if (!(max > 0)) return [s];
    var words = s.split(/\s+/);
    var lines = [];
    var line = '';
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (!w) continue;
      if (!line) { line = w; continue; }
      if (line.length + 1 + w.length <= max) line = line + ' ' + w;
      else { lines.push(line); line = w; }
    }
    if (line) lines.push(line);
    return lines;
  }

  // Scrollbar geometry for a bounded scroll offset.
  function scrollbarGeometry(offset, contentH, viewH, trackY, trackH) {
    var content = toInt(contentH);
    var view = toInt(viewH);
    var ty = toInt(trackY);
    var th = toInt(trackH);
    if (th <= 0) th = 100;
    var max = Math.max(0, content - view);
    var visible = max > 0;
    var thumbH = 0;
    if (visible) {
      var ratio = Math.max(0.05, Math.min(1, view / content));
      thumbH = Math.max(24, Math.round(th * ratio));
      if (thumbH > th) thumbH = th;
    }
    var o = clampScroll(offset, content, view);
    var t = max > 0 ? o / max : 0;
    return { visible: visible, y: ty + (th - thumbH) * t, h: thumbH, trackY: ty, trackH: th };
  }

  /* Draws the compact dashboard strip. Headless-safe: never throws and
   * only touches fillRect/fillText/fillStyle/font. */
  function drawExtras(ctx, state, which) {
    try {
      if (!ctx || typeof ctx.fillRect !== 'function' || typeof ctx.fillText !== 'function') return false;
      var profile = (state && state.game) ? state.game.profile : null;
      if (!profile) return false;
      var info = fmtExp(profile.xp, profile.exp_to_next_level);
      var lines = [
        fmtLevel(profile.level),
        fmtGold(profile.gold),
        info.text,
        fmtStreak(profile.daily_streak),
        difficultyLabel(profile.difficulty)
      ];
      var canvas = ctx.canvas || {};
      var W = canvas.width || 300, H = canvas.height || 200;
      var x = (which === 'right') ? W * 0.52 : W * 0.03;
      var y = H * 0.08;
      var lh = Math.max(12, Math.round(H * 0.03));
      ctx.fillStyle = '#0b1e3a';
      ctx.fillRect(x, y, W * 0.44, lh * lines.length + 8);
      ctx.fillStyle = '#ffffff';
      ctx.font = lh + 'px sans-serif';
      for (var i = 0; i < lines.length; i++) ctx.fillText(lines[i], x + 8, y + 6 + lh * i);
      return true;
    } catch (e) {
      warn('drawExtras', e);
      return false;
    }
  }

  /* ------------------------------ API ------------------------------- */

  var api = {
    version: VERSION,
    VERSION: VERSION,
    MENU_DASHBOARD_FIELDS: MENU_DASHBOARD_FIELDS.slice(),
    expRatio: expRatio,
    difficultyLabel: difficultyLabel,
    petProgress: petProgress,
    wrapText: wrapText,
    scrollbarGeometry: scrollbarGeometry,
    drawExtras: drawExtras,
    fmtLevel: fmtLevel,
    fmtGold: fmtGold,
    fmtExp: fmtExp,
    fmtStreak: fmtStreak,
    fmtDifficulty: fmtDifficulty,
    petEvolutionProgress: petEvolutionProgress,
    clampScroll: clampScroll,
    scrollBy: scrollBy,
    installed: false,
    applied: false,

    /* Install prototype hooks (no-op if the state classes are absent).
     * Only augments: never replaces an existing method body. */
    install: function () {
      if (!api.installed) {
        try {
          var MenuState = root.MenuState;
          var TheoryState = root.TheoryState;

          if (MenuState && MenuState.prototype && !MenuState.prototype.__polishM2) {
            MenuState.prototype.__polishM2 = api;
          }
          if (TheoryState && TheoryState.prototype && !TheoryState.prototype.__polishM2) {
            TheoryState.prototype.__polishM2 = api;
          }
          api.installed = true;
        } catch (e) {
          warn('install', e);
        }
      }
      /* Contract: install() returns the module api (truthy, identity-stable),
       * never a bare boolean. Idempotent: repeated calls never throw. */
      return api;
    },

    apply: function () {
      api.install();
      api.applied = api.installed;
      return api.applied;
    }
  };

  root.PolishM2 = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof global !== 'undefined' ? global : this));
