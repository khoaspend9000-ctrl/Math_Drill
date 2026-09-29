(function (global) {
  'use strict';

  const L = global.GameLogger || { info: function () {}, warn: function () {}, error: function () {} };

  function makePlaceholder(label, w, h) {
    const width = w || 64;
    const height = h || 64;
    const canvas = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
    if (!canvas) return { width: width, height: height, placeholder: true, label: label };
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2a3358';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#7c9cff';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, width - 2, height - 2);
    ctx.fillStyle = '#c8d8ff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(label || '?').slice(0, 12), width / 2, height / 2);
    canvas.placeholder = true;
    canvas.label = label;
    return canvas;
  }

  class AssetManager {
    constructor() {
      this.images = new Map();
      this.failed = new Map();
      this.fonts = { quicksand: false, emoji: false };
    }

    get(name) {
      return this.images.get(name) || null;
    }

    has(name) {
      return this.images.has(name);
    }

    loadImage(name, url) {
      const self = this;
      return new Promise(function (resolve) {
        if (typeof Image === 'undefined') {
          const ph = makePlaceholder(name);
          self.images.set(name, ph);
          self.failed.set(name, url || name);
          resolve(ph);
          return;
        }
        const img = new Image();
        img.onload = function () {
          self.images.set(name, img);
          L.info('[Assets] Loaded image', name);
          resolve(img);
        };
        img.onerror = function () {
          const ph = makePlaceholder(name);
          self.images.set(name, ph);
          self.failed.set(name, url || name);
          L.warn('[Assets] Failed to load image', name, 'from', url, '— using placeholder');
          resolve(ph);
        };
        img.src = url;
      });
    }

    preload(list) {
      const self = this;
      const jobs = (list || []).map(function (item) {
        if (typeof item === 'string') return self.loadImage(item, item);
        return self.loadImage(item.name, item.url);
      });
      return Promise.all(jobs).then(function (imgs) {
        return {
          total: imgs.length,
          failed: self.failed.size,
          loaded: imgs.length - self.failed.size
        };
      });
    }

    loadFonts() {
      const self = this;
      if (typeof document === 'undefined' || !document.fonts || !document.fonts.load) {
        return Promise.resolve(self.fonts);
      }
      const jobs = [
        document.fonts.load('24px "Quicksand"').then(function () {
          self.fonts.quicksand = true;
        }).catch(function (err) {
          L.warn('[Assets] Quicksand font load failed', err);
          self.fonts.quicksand = false;
        })
      ];
      /* M17: Segoe UI Emoji measured 2,024 KB and 15.8s of transfer - by far
         the largest single startup resource - yet it is only used for
         decorative emoji glyphs. Waiting for it blocked the Login screen for
         longer than every image combined. It is a progressive enhancement:
         CSS font matching re-resolves per frame, so glyphs simply switch to
         the real face when it lands, and nothing depends on loadFonts()
         resolving it. */
      const emoji = document.fonts.load('24px "Segoe UI Emoji"').then(function () {
        self.fonts.emoji = true;
      }).catch(function (err) {
        L.warn('[Assets] Segoe UI Emoji font load failed', err);
        self.fonts.emoji = false;
      });
      if (typeof Promise !== 'undefined' && Promise.prototype.then) {
        try { emoji.catch(function () {}); } catch (e) { /* already handled */ }
      }
      /* NOTE: document.fonts.ready is deliberately NOT awaited here. It resolves
         only once *every* pending font load settles, which would re-introduce the
         2 MB emoji wait we just removed. document.fonts.load('24px "Quicksand"')
         above already resolves when the one font Login actually renders in has
         arrived, which is the signal startup needs. */
      return Promise.all(jobs).then(function () { return self.fonts; });
    }
  }

  AssetManager.makePlaceholder = makePlaceholder;

  global.AssetManager = AssetManager;
  if (typeof module !== 'undefined' && module.exports) module.exports = AssetManager;
})(typeof window !== 'undefined' ? window : globalThis);
