(function (global) {
  'use strict';

  class Renderer {
    constructor(ctx, width, height) {
      this.ctx = ctx;
      this.width = width;
      this.height = height;
    }

    setContext(ctx) {
      this.ctx = ctx;
    }

    setSize(width, height) {
      this.width = width;
      this.height = height;
    }

    clear(color) {
      const ctx = this.ctx;
      ctx.save();
      ctx.setTransform(ctx.getTransform());
      ctx.fillStyle = color || '#0b1020';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    }

    // M18 restoration: port of Desktop game_init.py:3528 draw_gradient(surface,
    // color1, color2) - a full-height vertical lerp from color1 at the top row to
    // color2 at the bottom row. Desktop draws one scanline per y; canvas does it with
    // a single linear gradient, which is the same interpolation with less overdraw.
    // Accepts [r,g,b] arrays (Desktop tuples) or css strings.
    gradient(c1, c2) {
      const ctx = this.ctx;
      if (!ctx) return;
      const toCss = function (c) {
        if (typeof c === 'string') return c;
        return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
      };
      const h = this.height, w = this.width;
      if (h <= 1) { this.clear(toCss(c1)); return; }
      // Headless Node harnesses stub the 2D context without createLinearGradient.
      // Degrade to the top colour instead of throwing, so a state draw can never
      // hard-fail in a test or in a browser lacking the 2D gradient API.
      if (typeof ctx.createLinearGradient !== 'function') {
        this.clear(toCss(c1));
        return;
      }
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, toCss(c1));
      g.addColorStop(1, toCss(c2));
      ctx.save();
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    roundRectPath(x, y, w, h, r) {
      const ctx = this.ctx;
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    }

    fillRoundRect(x, y, w, h, r, fill, stroke, lineWidth) {
      const ctx = this.ctx;
      this.roundRectPath(x, y, w, h, r);
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth || 2;
        ctx.stroke();
      }
    }

    text(str, x, y, opts) {
      const ctx = this.ctx;
      const o = opts || {};
      ctx.save();
      ctx.font = o.font || '24px Quicksand, Segoe UI, sans-serif';
      ctx.fillStyle = o.fill || '#ffffff';
      ctx.textAlign = o.align || 'left';
      ctx.textBaseline = o.baseline || 'alphabetic';
      if (o.shadowColor) {
        ctx.shadowColor = o.shadowColor;
        ctx.shadowBlur = o.shadowBlur || 0;
      }
      ctx.fillText(str, x, y);
      ctx.restore();
    }

    image(img, x, y, w, h) {
      if (!img) return;
      const ctx = this.ctx;
      if (typeof w === 'number' && typeof h === 'number') ctx.drawImage(img, x, y, w, h);
      else ctx.drawImage(img, x, y);
    }
  }

  global.GameRenderer = Renderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = Renderer;
})(typeof window !== 'undefined' ? window : globalThis);
