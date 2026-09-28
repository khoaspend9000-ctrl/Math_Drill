/* =========================================================
   MathDrill Web — M16 VISUAL DESIGN SYSTEM
   ---------------------------------------------------------
   The game is drawn on a 1300x800 canvas in immediate mode, so
   every screen used to hand-roll flat rounded rectangles with a
   white border. That read as a Pygame port rather than a game.

   This module is the single visual language for the whole product:
   one palette, one type scale, one set of radii and elevations, and
   a small set of primitives (backdrop / card / button / badge /
   bar / heading) that every screen composes.

   RULES OBSERVED BY THIS MODULE
   - Purely visual. It never changes layout coordinates, never
     changes label text, and never touches gameplay, scoring,
     unlock rules, auth or the question generator.
   - Uses only the existing Renderer API (clear, fillRoundRect,
     text, image) plus the raw 2D context for gradients and
     shadows, so it works unchanged in the browser and in Node.
   ========================================================= */
(function (global) {
  'use strict';

  /* ---- Palette -------------------------------------------------
     Deeper and richer than the old flat Material-500 set, with a
     single clear accent (cyan) for primary actions so the eye
     always knows where to go next. */
  const C = {
    bgTop: '#131c3a',
    bgMid: '#1b2a52',
    bgBottom: '#0d1426',
    panel: 'rgba(24, 33, 61, 0.94)',
    panelSoft: 'rgba(31, 43, 78, 0.88)',
    card: 'rgb(38, 52, 94)',
    cardHi: 'rgb(52, 70, 124)',

    stroke: 'rgba(148, 176, 255, 0.30)',
    strokeSoft: 'rgba(148, 176, 255, 0.16)',
    strokeHi: 'rgba(180, 205, 255, 0.55)',

    text: '#eef3ff',
    textDim: '#a9b8dd',
    textFaint: '#7486ad',
    textInk: '#101832',

    accent: '#35c9e8',
    accentDeep: '#1894b8',
    primary: '#4f7cf0',
    primaryDeep: '#3559c4',
    success: '#37c76a',
    successDeep: '#219a4c',
    danger: '#f2536b',
    dangerDeep: '#c32f47',
    warn: '#ffb020',
    warnDeep: '#d98600',
    violet: '#9a6bf0',
    violetDeep: '#7245c9',
    gold: '#ffc93c',
    goldDeep: '#d9a017',

    shade: '#3d4a6b',
    shadeDeep: '#2a3450',
    white: '#ffffff'
  };

  /* ---- Type scale (one scale for the whole product) ------------ */
  const F = {
    family: 'Quicksand, Segoe UI, system-ui, sans-serif',
    display: 54, h1: 40, h2: 30, h3: 24,
    body: 20, small: 16, tiny: 14
  };
  function font(size, weight) { return (weight || 'normal') + ' ' + size + 'px ' + F.family; }

  /* ---- Radii & elevation -------------------------------------- */
  const RAD = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };
  const ELEV = { sm: 4, md: 8, lg: 16 };

  /* ---- helpers ------------------------------------------------- */
  function ctxOf(R) { return R && R.ctx ? R.ctx : null; }

  function hex(c) {
    if (Array.isArray(c)) c = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
    if (typeof c !== 'string' || c.charAt(0) !== '#') return [90, 110, 160];
    const h = c.slice(1);
    return h.length === 3
      ? [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)]
      : [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgba(c, a) {
    if (Array.isArray(c)) return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
    if (typeof c === 'string' && c.charAt(0) === '#') {
      const n = hex(c);
      return 'rgba(' + n[0] + ',' + n[1] + ',' + n[2] + ',' + a + ')';
    }
    return c;
  }
  function darker(c, amt) {
    const n = hex(c).map(function (v) { return Math.max(0, Math.min(255, Math.round(v * (1 - amt)))); });
    return 'rgb(' + n[0] + ',' + n[1] + ',' + n[2] + ')';
  }
  function lighten(c, amt) {
    const n = hex(c).map(function (v) { return Math.max(0, Math.min(255, Math.round(v + (255 - v) * amt))); });
    return 'rgb(' + n[0] + ',' + n[1] + ',' + n[2] + ')';
  }
  // Accepts either a palette key ('primary') or a raw colour.
  function col(c) {
    if (typeof c === 'string' && Object.prototype.hasOwnProperty.call(C, c)) return C[c];
    return c;
  }

  function gradientV(R, x, y, w, h, top, bottom, r) {
    const rad = r === undefined ? RAD.md : r;
    // Node test harnesses stub renderer.ctx with a plain object. If the
    // gradient API is unavailable we fall back to a flat fill of the bottom
    // colour instead of throwing, so every screen still draws.
    const g = ctxOf(R);
    if (!g || typeof g.createLinearGradient !== 'function' ||
        typeof g.fill !== 'function' || typeof R.roundRectPath !== 'function') {
      R.fillRoundRect(x, y, w, h, rad, bottom, null, 0);
      return;
    }
    g.save();
    R.roundRectPath(x, y, w, h, rad);
    const grd = g.createLinearGradient(0, y, 0, y + h);
    grd.addColorStop(0, top);
    grd.addColorStop(1, bottom);
    g.fillStyle = grd;
    g.fill();
    g.restore();
  }

  /* ---- Backdrop ------------------------------------------------
     A soft vertical gradient with two colour glows, so every screen
     sits on a consistent, game-like stage instead of a flat fill. */
  function backdrop(R, W, H, o) {
    const opt = o || {};
    const g = ctxOf(R);
    if (!g || typeof g.createLinearGradient !== 'function' || typeof g.fillRect !== 'function') { R.clear(col(opt.bottom || C.bgBottom)); return; }
    g.save();
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, col(opt.top || C.bgTop));
    grd.addColorStop(0.55, col(opt.mid || C.bgMid));
    grd.addColorStop(1, col(opt.bottom || C.bgBottom));
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    [[W * 0.18, H * 0.12, opt.glowA || rgba(C.accent, 0.16)],
     [W * 0.85, H * 0.78, opt.glowB || rgba(C.violet, 0.14)]].forEach(function (gl) {
      const rg = g.createRadialGradient(gl[0], gl[1], 0, gl[0], gl[1], Math.max(W, H) * 0.55);
      rg.addColorStop(0, gl[2]);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, W, H);
    });
    g.restore();
  }

  /* ---- Card ----------------------------------------------------
     Elevated surface: shadow beneath, gradient face, 1px top
     highlight. Purely decorative; the rect is unchanged. */
  function card(R, x, y, w, h, o) {
    const opt = o || {};
    const r = opt.radius === undefined ? RAD.lg : opt.radius;
    const g = ctxOf(R);
    if (g) { g.save(); if ('shadowColor' in g) { g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = ELEV.md; g.shadowOffsetY = 4; } }
    gradientV(R, x, y, w, h, col(opt.top || C.cardHi), col(opt.bottom || C.card), r);
    if (g) g.restore();
    R.fillRoundRect(x, y, w, h, r, null, col(opt.stroke || C.stroke), opt.strokeW || 1.5);
    R.fillRoundRect(x + r * 0.6, y + 1.5, w - r * 1.2, 1.5, 1, rgba(C.white, 0.14), null, 0);
  }

  /* ---- Button --------------------------------------------------
     The upgrade of the old flat drawBtn. Same rect, same label.
     Gradient face, a darker lip underneath for 3D depth, a coloured
     outer glow for accent colours, and a bolder label. */
  function button(R, x, y, w, h, label, color, o) {
    const opt = o || {};
    const r = opt.radius === undefined ? RAD.md : opt.radius;
    const c = col(color) || C.primary;
    const disabled = !!opt.disabled;
    const face = disabled ? C.shade : c;
    const deep = disabled ? C.shadeDeep : (opt.deep || darker(c, 0.26));
    const size = opt.fontSize || F.body;

    const g = ctxOf(R);
    if (!disabled && opt.glow !== false) {
      if (g) { g.save(); if ('shadowColor' in g) { g.shadowColor = rgba(face, 0.45); g.shadowBlur = opt.glowSize || 14; g.shadowOffsetY = 0; } }
      gradientV(R, x, y, w, h, face, face, r);
      if (g) g.restore();
    }
    // depth lip
    R.fillRoundRect(x, y + h * 0.6, w, h * 0.4, r, rgba(deep, disabled ? 0.6 : 0.95), null, 0);
    // face on top so the lip reads as an edge
    gradientV(R, x, y, w, h * 0.7, lighten(face, disabled ? 0 : 0.16), face, r);
    R.fillRoundRect(x, y, w, h, r, null, rgba(disabled ? C.strokeSoft : C.strokeHi, 0.9), opt.borderW || 2);

    if (label !== null && label !== undefined) {
      R.text(label, x + w / 2, y + h / 2, {
        font: 'bold ' + size + 'px ' + F.family,
        fill: opt.textColor || C.text,
        align: 'center', baseline: 'middle',
        shadowColor: 'rgba(0,0,0,0.35)', shadowBlur: 4
      });
    }
  }

  /* ---- Badge / chip -------------------------------------------- */
  function badge(R, x, y, text, o) {
    const opt = o || {};
    const size = opt.fontSize || F.tiny;
    const padX = opt.padX === undefined ? 12 : opt.padX;
    const h = opt.h || 26;
    const w = opt.w || (String(text).length * (size * 0.62) + padX * 2);
    const c = col(opt.color) || C.accent;
    R.fillRoundRect(x, y, w, h, h / 2, rgba(c, 0.18), rgba(c, 0.75), 1.5);
    R.text(text, x + w / 2, y + h / 2, {
      font: 'bold ' + size + 'px ' + F.family,
      fill: opt.textColor || c, align: 'center', baseline: 'middle'
    });
    return w;
  }

  /* ---- Progress / stat bar -------------------------------------- */
  function bar(R, x, y, w, h, pct, o) {
    const opt = o || {};
    const r = h / 2;
    const p = Math.max(0, Math.min(1, pct || 0));
    R.fillRoundRect(x, y, w, h, r, col(opt.track || 'rgba(10,16,34,0.85)'), null, 0);
    R.fillRoundRect(x, y, w, h, r, col(opt.trackStroke || C.strokeSoft), 1);
    if (p > 0) {
      const c = col(opt.color) || C.accent;
      gradientV(R, x, y, Math.max(h, w * p), h, lighten(c, 0.2), c, r);
      R.fillRoundRect(x + 2, y + 2, Math.max(0, w * p - 4), Math.max(1, h * 0.28), r * 0.5,
        'rgba(255,255,255,0.28)', null, 0);
    }
  }

  /* ---- Typography helpers --------------------------------------- */
  function heading(R, text, x, y, o) {
    const opt = o || {};
    R.text(text, x, y, {
      font: 'bold ' + (opt.size || F.h1) + 'px ' + F.family,
      fill: col(opt.color) || C.text,
      align: opt.align || 'center', baseline: opt.baseline || 'middle',
      shadowColor: opt.shadow || 'rgba(0,0,0,0.4)', shadowBlur: opt.shadowBlur || 8
    });
  }

  function body(R, text, x, y, o) {
    const opt = o || {};
    R.text(text, x, y, {
      font: (opt.size || F.small) + 'px ' + F.family,
      fill: col(opt.color) || C.textDim,
      align: opt.align || 'center', baseline: opt.baseline || 'middle'
    });
  }

  function divider(R, x, y, w) {
    R.fillRoundRect(x, y, w, 1.5, 1, C.strokeSoft, null, 0);
  }

  const Theme = {
    C: C, F: F, RAD: RAD, ELEV: ELEV,
    font: font, col: col, rgba: rgba, lighter: lighten, darker: darker,
    backdrop: backdrop, card: card, button: button,
    badge: badge, bar: bar,
    heading: heading, body: body, divider: divider
  };

  global.MathDrillTheme = Theme;
  if (typeof module !== 'undefined' && module.exports) module.exports = Theme;
})(typeof window !== 'undefined' ? window : globalThis);
