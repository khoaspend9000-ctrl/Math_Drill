/* =========================================================
   MathDrill Web — M5: SAVE (localStorage wrapper)
   ---------------------------------------------------------
   Port từ: AccountSystem.save/load (game_init.py:4441-4481,
   SQLite → localStorage theo quyết định [REPLACE] của plan M1)
   + session.json → mathdrill_session (game_init.py:5275-5299).

   Keys (plan mục 3.2):
   - mathdrill_player         : snapshot PlayerData hiện tại
   - mathdrill_settings       : cài đặt (volume/brightness/...) — M10 dùng
   - mathdrill_session        : { last_user } — tương đương session.json
   - mathdrill_accounts_local : { username: {password, status, data,...} }
   ========================================================= */
(function (global) {
  'use strict';

  const L = global.GameLogger || {
    info: function () {}, warn: function () {}, error: function () {}
  };

  const KEYS = {
    PLAYER: 'mathdrill_player',
    SETTINGS: 'mathdrill_settings',
    SESSION: 'mathdrill_session',
    ACCOUNTS: 'mathdrill_accounts_local'
  };

  // Fallback in-memory cho môi trường không có localStorage (Node test,
  // iframe bị chặn storage). Browser thật luôn dùng localStorage.
  let memoryStore = null;
  let warned = false;

  function backend() {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
    if (!memoryStore) {
      memoryStore = {
        _map: new Map(),
        setItem: function (k, v) { this._map.set(String(k), String(v)); },
        getItem: function (k) { return this._map.has(String(k)) ? this._map.get(String(k)) : null; },
        removeItem: function (k) { this._map.delete(String(k)); }
      };
      if (!warned) {
        warned = true;
        L.warn('[Save] localStorage không khả dụng — dùng memory store (không bền vững)');
      }
    }
    return memoryStore;
  }

  const Save = {
    KEYS: KEYS,

    isPersistent: function () {
      return typeof localStorage !== 'undefined' && !!localStorage;
    },

    // JSON.stringify → setItem. Trả true/false (không ném lỗi ra ngoài).
    save: function (key, obj) {
      try {
        backend().setItem(key, JSON.stringify(obj));
        return true;
      } catch (err) {
        // QuotaExceeded v.v. — log và báo false, không làm crash game
        L.error('[Save] save failed for', key, err);
        return false;
      }
    },

    // getItem → JSON.parse. Không có key hoặc parse lỗi → trả defaultValue.
    load: function (key, defaultValue) {
      try {
        const raw = backend().getItem(key);
        if (raw === null || raw === undefined) return defaultValue;
        return JSON.parse(raw);
      } catch (err) {
        L.error('[Save] load failed for', key, err);
        return defaultValue;
      }
    },

    remove: function (key) {
      try {
        backend().removeItem(key);
      } catch (err) {
        L.error('[Save] remove failed for', key, err);
      }
    },

    // Xoá dữ liệu game của web (dùng cho "reset dữ liệu" ở M10)
    clearAll: function () {
      Object.keys(KEYS).forEach(function (k) {
        Save.remove(KEYS[k]);
      });
    }
  };

  global.Save = Save;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Save;
  }
})(typeof window !== 'undefined' ? window : globalThis);
