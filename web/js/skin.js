'use strict';
(function (global) {
  'use strict';
  const L = global.GameLogger || { info: function () {}, warn: function () {}, error: function () {} };
  function _fetchJson(url) {
    if (typeof fetch === 'function') { return fetch(url).then(function (r) { return r.json(); }); }
    if (typeof require === 'function') {
      const fs = require('fs'); const path = require('path');
      const filePath = path.join(__dirname, '..', url);
      return new Promise(function (resolve, reject) {
        fs.readFile(filePath, 'utf8', function (err, data) {
          if (err) return reject(err);
          try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        });
      });
    }
    return Promise.reject(new Error('No fetch or fs available'));
  }
  function _normalizeSkin(obj) {
    if (obj && typeof obj === 'object') {
      if (Array.isArray(obj)) { return obj.map(_normalizeSkin); }
      var out = {};
      Object.keys(obj).forEach(function (k) {
        if ((k === 'color' || k === 'bg_color' || k === 'border_color') && Array.isArray(obj[k]) && obj[k].length >= 3) {
          out[k] = obj[k].slice(0, 3);
        } else { out[k] = _normalizeSkin(obj[k]); }
      });
      return out;
    }
    return obj;
  }
  function SkinSystem(skinTypes) { this.skinTypes = skinTypes || {}; this._ready = !!skinTypes; }
  SkinSystem.prototype = {
    load: function () { var self = this; return _fetchJson('data/skins.json').then(function (d) { self.skinTypes = _normalizeSkin(d); self._ready = true; return self.skinTypes; }); },
    normalize: function (skinsObj) { this.skinTypes = _normalizeSkin(skinsObj || {}); this._ready = true; return this.skinTypes; },
    getSkinInfo: function (skinKey) { return (this.skinTypes ? this.skinTypes[skinKey] : null) || {}; },
    getPrice: function (skinKey) { var s = this.skinTypes ? this.skinTypes[skinKey] : null; return s ? Math.floor(s.price || 0) : 0; },
    getSkinsByType: function (skinType) { var out = {}; if (!this.skinTypes) return out; Object.keys(this.skinTypes).forEach(function (k) { if (this.skinTypes[k].type === skinType) out[k] = this.skinTypes[k]; }, this); return out; },
    getEffect: function (skinKey) { var s = this.getSkinInfo(skinKey); return s.effect || null; },
    getColor: function (skinKey) { var s = this.getSkinInfo(skinKey); return Array.isArray(s.color) ? s.color.slice(0, 3) : [50, 50, 50]; },
    getBgColor: function (skinKey) { var s = this.getSkinInfo(skinKey); return Array.isArray(s.bg_color) ? s.bg_color.slice(0, 3) : null; },
    getBorderColor: function (skinKey) { var s = this.getSkinInfo(skinKey); return Array.isArray(s.border_color) ? s.border_color.slice(0, 3) : null; },
    getType: function (skinKey) { return this.getSkinInfo(skinKey).type || 'pen'; },
    isReady: function () { return this._ready; }
  };
  global.SkinSystem = SkinSystem;

  function SkinManager(opts) {
    this.skinSystem = opts && opts.skinSystem ? opts.skinSystem : new SkinSystem();
    this.data = opts && opts.data ? opts.data : {};
    this.isAdmin = !!(opts && opts.isAdmin);
    this._save = (opts && typeof opts.save === 'function') ? opts.save : function () {};
    this._normalize = (opts && typeof opts.normalize === 'function') ? opts.normalize : _normalizeSkin;
  }
  SkinManager.DEFAULT_UNLOCKED_SKINS = ['pen_basic', 'board_wood'];
  SkinManager.prototype = {
    getUnlockedSkins: function () { this._needData(); return this.data.unlocked_skins || SkinManager.DEFAULT_UNLOCKED_SKINS.slice(); },
    getEquippedSkins: function () { return { pen: this.data.equipped_pen || 'pen_basic', board: this.data.equipped_board || 'board_wood' }; },
    purchaseSkin: function (skinKey) {
      if (!this.skinSystem || Object.keys(this.skinSystem.skinTypes || {}).indexOf(skinKey) < 0) {
        return { ok: false, msg: 'Skin không tồn tại.' };
      }
      var unlocked = this.getUnlockedSkins();
      if (unlocked.indexOf(skinKey) >= 0) return { ok: false, msg: 'Đã sở hữu skin này.' };
      var price = this.skinSystem.getPrice(skinKey);
      var gold = Math.floor((this.data.gold !== undefined ? this.data.gold : 0));
      if (!this.isAdmin) { if (gold < price) return { ok: false, msg: 'Không đủ vàng để mua.' }; this.data.gold = gold - price; }
      if (!this.data.unlocked_skins) this.data.unlocked_skins = SkinManager.DEFAULT_UNLOCKED_SKINS.slice();
      this.data.unlocked_skins.push(skinKey);
      this._save();
      return { ok: true, msg: 'Mua skin thành công (' + price + ' vàng).', spent: price };
    },
    equipSkin: function (skinKey) {
      if (!this.skinSystem || Object.keys(this.skinSystem.skinTypes || {}).indexOf(skinKey) < 0) {
        return { ok: false, msg: 'Skin không tồn tại.' };
      }
      var unlocked = this.getUnlockedSkins();
      if (unlocked.indexOf(skinKey) < 0) return { ok: false, msg: 'Chưa sở hữu skin này.' };
      var stype = this.skinSystem.getType(skinKey);
      this._needData();
      if (stype === 'pen') this.data.equipped_pen = skinKey; else if (stype === 'board') this.data.equipped_board = skinKey;
      this._save();
      return { ok: true, msg: 'Trang bị skin thành công.' };
    },
    _needData: function () { if (!this.data) this.data = {}; }
  };
  global.SkinManager = SkinManager;
  if (typeof module !== 'undefined' && module.exports) { module.exports = { SkinSystem: SkinSystem, SkinManager: SkinManager, normalizeSkin: _normalizeSkin }; }
})(typeof window !== 'undefined' ? window : globalThis);
