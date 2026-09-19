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
