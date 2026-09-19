/* POLISH M2 (MathDrill Web) - additive UI polish only.
 * Does NOT change gameplay logic. Mirrors Desktop layout intent:
 *  - Menu dashboard left page: difficulty badge, streak badge, pet evolution progress,
 *    achievement count (compact strip so it cannot overlap the book pages).
 *  - Theory page: scroll offset + scrollbar indicator + wheel binding (once).
 */
(function (root) {
  'use strict';

  var PAD = 8;

  function clamp(v, lo, hi) {
    if (typeof v !== 'number' || v !== v) return lo;
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
  }

  function difficultyLabel(d) {
    var n = parseInt(d, 10);
    if (n === 3) return 'Kho';
    if (n === 2) return 'Trung Binh';
    return 'De';
  }

  function formatStreak(n) {
    var v = parseInt(n, 10);
    if (!(v > 0)) v = 0;
    return 'Chuoi: ' + v + ' ngay';
  }

  function petEvolutionText(stage, maxStage) {
    var s = parseInt(stage, 10); if (!(s >= 0)) s = 0;
    var m = parseInt(maxStage, 10); if (!(m > 0)) m = 3;
    return 'Tien hoa: ' + s + '/' + m;
  }

  function formatAchievements(d) {
    var n = 0;
    if (d) {
      if (Array.isArray(d.achievements_unlocked)) n = d.achievements_unlocked.length;
      else if (Array.isArray(d.achievements)) n = d.achievements.length;
      else if (typeof d.achievements_count === 'number') n = d.achievements_count;
    }
    return 'Thanh tich: ' + n;
  }

  function playerOf(state) {
    if (!state) return null;
    var g = state.game || root.Game || null;
    var p = (g && g.player) ? g.player : (state.player || null);
    return p || null;
  }

  function dataOf(player) {
    if (!player) return null;
    return player.data || player.d || null;
  }

  function drawMenuLeft(state, ctx) {
    if (!ctx || typeof ctx.fillRect !== 'function') return false;
    var canvas = ctx.canvas || {};
    var W = canvas.width || 0, H = canvas.height || 0;
    if (!(W >= 200 && H >= 150)) return false;
    var d = dataOf(playerOf(state));
    var x = W * 0.03, y = H * 0.70, w = W * 0.44, h = H * 0.24;
    var lines = [
      'Do kho: ' + difficultyLabel(d && d.difficulty),
      formatStreak(d && d.daily_streak),
      petEvolutionText(d && d.pet_stage, d && d.pet_max_stage),
      formatAchievements(d)
    ];
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = '#0b1e3a';
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#00bcd4';
    if (typeof ctx.lineWidth === 'number') ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.font = Math.max(11, Math.round(H * 0.024)) + 'px sans-serif';
    ctx.textBaseline = 'top';
    var step = h / (lines.length + 1);
    for (var i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x + PAD, y + step * (i + 0.5));
    }
    ctx.restore();
    return true;
  }

  function theoryMetrics(state, ctx, viewH) {
    var content = (state && Number(state._theoryContentHeight)) || 0;
    var view = (state && Number(state._theoryViewHeight)) || viewH || 0;
    var max = Math.max(0, content - view);
    var scroll = clamp(state ? state._theoryScroll : 0, 0, max);
    return { scroll: scroll, max: max, ratio: content > view && content > 0 ? view / content : 1 };
  }

  function drawTheory(state, ctx) {
    if (!ctx || typeof ctx.fillRect !== 'function') return false;
    var canvas = ctx.canvas || {};
    var W = canvas.width || 0, H = canvas.height || 0;
    if (!(W >= 200 && H >= 150)) return false;
    var m = theoryMetrics(state, ctx, H);
    if (state) state._theoryScroll = m.scroll;
    if (m.max <= 0) return false;
    var barW = 6, x = W - barW - 6;
    var trackH = H * 0.7, trackY = H * 0.15;
    var thumbH = Math.max(24, trackH * m.ratio);
    var t = m.max > 0 ? m.scroll / m.max : 0;
    var thumbY = trackY + (trackH - thumbH) * t;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#1b3a5c';
    ctx.fillRect(x, trackY, barW, trackH);
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = '#00bcd4';
    ctx.fillRect(x, thumbY, barW, thumbH);
    ctx.restore();
    return true;
  }

  function attachTheoryScroll(state, canvas) {
    if (!state || !canvas || typeof canvas.addEventListener !== 'function') return false;
    if (state._theoryScrollBound) return true;
    state._theoryScrollBound = true;
    canvas.addEventListener('wheel', function (ev) {
      var d = ev && Number(ev.deltaY) || 0;
      var content = Number(state._theoryContentHeight) || 0;
      var view = Number(state._theoryViewHeight) || 0;
      var max = Math.max(0, content - view);
      if (max <= 0) max = Number(state._theoryMaxScroll) || 0;
      var next = clamp((Number(state._theoryScroll) || 0) + d, 0, max);
      state._theoryScroll = next;
      if (next !== 0 && ev && typeof ev.preventDefault === 'function') ev.preventDefault();
    }, { passive: false });
    return true;
  }

  var api = {
    clamp: clamp,
    difficultyLabel: difficultyLabel,
    formatStreak: formatStreak,
    petEvolutionText: petEvolutionText,
    formatAchievements: formatAchievements,
    drawMenuLeft: drawMenuLeft,
    drawTheory: drawTheory,
    theoryMetrics: theoryMetrics,
    attachTheoryScroll: attachTheoryScroll
  };

  root.MenuDashboardExtras = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
