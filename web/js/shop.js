/* =========================================================
   MathDrill Web — M9-A: SHOP SYSTEM
   ---------------------------------------------------------
   Port từ source-of-truth:
   - ui/shop_enhanced.py
       collect_shop_catalog(pet_system, skin_system)  (dòng 5-32)
       filter_shop_items(items, shop_filter, search)  (dòng 35-46)
   - game_init.py AccountSystem
       purchase_pet      (dòng 4911-4927)
       purchase_skin     (dòng 4966-4982)
       equip_skin        (dòng 4983-4997)
       change_pet_type   (dòng 4893-4910)
   - data/pets.json, data/skins.json (nguồn dữ liệu JSON)
   =========================================================
   Test: web/tests/m9a_shop.test.js
   ========================================================= */
(function (global) {
  'use strict';

  const L = global.GameLogger || {
    info: function () {}, warn: function () {}, error: function () {}
  };

  // ===== Loader: đọc JSON giống data_loader.js (web/data/...) =====
  function _fetchJson(url) {
    if (typeof fetch === 'function') {
      return fetch(url).then(function (r) { return r.json(); });
    }
    if (typeof require === 'function') {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '..', url);
      return new Promise(function (resolve, reject) {
        fs.readFile(filePath, 'utf8', function (err, data) {
          if (err) return reject(err);
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(e); }
        });
      });
    }
    return Promise.reject(new Error('No fetch or fs available'));
  }

  // ===== CHUẨN HÓA DỮ LIỆU SKIN (game_content_loader.py:22-34) =====
  // Python tupleize: color/bg_color/border_color list [r,g,b] → giữ list
  // cho JS (không cần tuple), nhưng chuẩn hóa về array 3 phần tử.
  function _normalizeSkin(obj) {
    if (Array.isArray(obj)) return obj.map(_normalizeSkin);
    if (obj && typeof obj === 'object') {
      const out = {};
      Object.keys(obj).forEach(function (k) {
        if ((k === 'color' || k === 'bg_color' || k === 'border_color') &&
            Array.isArray(obj[k]) && obj[k].length >= 3) {
          out[k] = obj[k].slice(0, 3);
        } else {
          out[k] = _normalizeSkin(obj[k]);
        }
      });
      return out;
    }
    return obj;
  }

  // =====================================================
  // collect_shop_catalog — ui/shop_enhanced.py:5-32
  // =====================================================
  function collectShopCatalog(petTypes, skinTypes) {
    const items = [];
    const pets = petTypes || {};
    Object.keys(pets).forEach(function (key) {
      const data = pets[key];
      const stages = data.stages && data.stages.length ? data.stages : [{}];
      const stage = stages[0];
      items.push({
        category: 'pet',
        key: key,
        name: data.name !== undefined ? data.name : key,
        icon: stage.icon !== undefined ? stage.icon : '\uD83D\uDC3E',
        description: 'Thú cưng đồng hành \u2014 ' + (stage.name !== undefined ? stage.name : ''),
        price: Math.floor(data.price !== undefined ? data.price : 0)
      });
    });
    const skins = skinTypes || {};
    Object.keys(skins).forEach(function (key) {
      const data = skins[key];
      const stype = data.type || 'pen';
      const cat = stype === 'pen' ? 'pen' : 'board';
      const item = {
        category: cat,
        key: key,
        name: data.name !== undefined ? data.name : key,
        icon: data.icon !== undefined ? data.icon : '\u270F\uFE0F',
        description: data.description !== undefined ? data.description : '',
        price: Math.floor(data.price !== undefined ? data.price : 0)
      };
      if (data.effect !== undefined) item.effect = data.effect;
      if (data.color !== undefined) item.color = data.color;
      if (data.bg_color !== undefined) item.bg_color = data.bg_color;
      items.push(item);
    });
    return items;
  }

  // =====================================================
  // filter_shop_items — ui/shop_enhanced.py:35-46
  // =====================================================
  function filterShopItems(items, shopFilter, searchText) {
    const q = String(searchText || '').trim().toLowerCase();
    const out = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (shopFilter !== 'all' && it.category !== shopFilter) continue;
      if (q) {
        const blob = (it.name + ' ' + (it.description || '') + ' ' + it.key).toLowerCase();
        if (blob.indexOf(q) < 0) continue;
      }
      out.push(it);
    }
    return out;
  }

  // =====================================================
  // SHOP SYSTEM — cao cấp hơn: catalog + purchase + equip
  // =====================================================
  const DEFAULT_UNLOCKED_PETS = ['clover'];
  const DEFAULT_UNLOCKED_SKINS = ['pen_basic', 'board_wood'];
  const ADMIN_USER = 'admin';

  class ShopSystem {
    constructor(opts) {
      opts = opts || {};
      this.petTypes = opts.petTypes || {};
      this.skinTypes = opts.skinTypes || {};
      this.data = opts.data || null; // account data dict (gold, unlocked_*)
      this.isAdmin = false;
      if (this.data && this.data.current_user === ADMIN_USER) this.isAdmin = true;
      this._adapter = opts.adapter || null; // { save(): void }
    }
    setData(d) { this.data = d; if (d && d.current_user === ADMIN_USER) this.isAdmin = true; }
    _needData() {
      if (!this.data) throw new Error('[Shop] data chưa được thiết lập (setData)');
    }
    // ---- catalog ----
    catalog() { return collectShopCatalog(this.petTypes, this.skinTypes); }
    filter(shopFilter, searchText) { return filterShopItems(this.catalog(), shopFilter, searchText); }
    getItem(category, key) {
      const items = this.catalog();
      for (let i = 0; i < items.length; i++) {
        if (items[i].category === category && items[i].key === key) return items[i];
      }
      return null;
    }
    // ---- ownership helpers (defaults như Python) ----
    getUnlockedPets() { this._needData(); return this.data.unlocked_pets || DEFAULT_UNLOCKED_PETS.slice(); }
    getUnlockedSkins() { this._needData(); return this.data.unlocked_skins || DEFAULT_UNLOCKED_SKINS.slice(); }
    isOwned(category, key) {
      this._needData();
      if (category === 'pet') return this.getUnlockedPets().indexOf(key) >= 0;
      return this.getUnlockedSkins().indexOf(key) >= 0;
    }
    ownsPet(key) { return this.getUnlockedPets().indexOf(key) >= 0; }
    ownsSkin(key) { return this.getUnlockedSkins().indexOf(key) >= 0; }
    // ---- prices (game_init.py:975-978, 994-997) ----
    getPetPrice(petType) {
      const p = this.petTypes[petType];
      if (!p) return 0;
      return Math.floor(p.price !== undefined ? p.price : 0);
    }
    getSkinPrice(skinKey) {
      const s = this.skinTypes[skinKey];
      if (!s) return 0;
      return Math.floor(s.price !== undefined ? s.price : 0);
    }
    // ---- purchase_pet — game_init.py:4911-4927 ----
    purchasePet(petType) {
      this._needData();
      const petTypes = this.petTypes;
      if (!petTypes[petType]) return { ok: false, msg: 'Thú cưng không tồn tại.' };
      const unlocked = this.getUnlockedPets();
      if (unlocked.indexOf(petType) >= 0) return { ok: false, msg: 'Đã sở hữu thú cưng này.' };
      const price = this.getPetPrice(petType);
      const gold = Math.floor(this.data.gold !== undefined ? this.data.gold : 0);
      if (!this.isAdmin) {
        if (gold < price) return { ok: false, msg: 'Không đủ vàng để mua.' };
        this.data.gold = gold - price;
      }
      if (!this.data.unlocked_pets) this.data.unlocked_pets = DEFAULT_UNLOCKED_PETS.slice();
      this.data.unlocked_pets.push(petType);
      this._save();
      return { ok: true, msg: 'Mua thành công (' + price + ' vàng).' };
    }
    // ---- purchase_skin — game_init.py:4966-4982 ----
    purchaseSkin(skinKey) {
      this._needData();
      const skinTypes = this.skinTypes;
      if (!skinTypes[skinKey]) return { ok: false, msg: 'Skin không tồn tại.' };
      const unlocked = this.getUnlockedSkins();
      if (unlocked.indexOf(skinKey) >= 0) return { ok: false, msg: 'Đã sở hữu skin này.' };
      const price = this.getSkinPrice(skinKey);
      const gold = Math.floor(this.data.gold !== undefined ? this.data.gold : 0);
      if (!this.isAdmin) {
        if (gold < price) return { ok: false, msg: 'Không đủ vàng để mua.' };
        this.data.gold = gold - price;
      }
      if (!this.data.unlocked_skins) this.data.unlocked_skins = DEFAULT_UNLOCKED_SKINS.slice();
      this.data.unlocked_skins.push(skinKey);
      this._save();
      return { ok: true, msg: 'Mua skin thành công (' + price + ' vàng).' };
    }
    // ---- equip_skin — game_init.py:4983-4997 ----
    equipSkin(skinKey) {
      this._needData();
      const skinTypes = this.skinTypes;
      if (!skinTypes[skinKey]) return { ok: false, msg: 'Skin không tồn tại.' };
      const unlocked = this.getUnlockedSkins();
      if (unlocked.indexOf(skinKey) < 0) return { ok: false, msg: 'Chưa sở hữu skin này.' };
      const stype = skinTypes[skinKey].type || 'pen';
      if (stype === 'pen') this.data.equipped_pen = skinKey;
      else this.data.equipped_board = skinKey;
      this._save();
      return { ok: true, msg: 'Trang bị skin thành công.' };
    }
    // ---- change_pet_type — game_init.py:4893-4910 ----
    changePetType(newPetType) {
      this._needData();
      const petTypes = this.petTypes;
      if (!petTypes[newPetType]) return false;
      const unlocked = this.getUnlockedPets();
      if (unlocked.indexOf(newPetType) < 0) return false;
      const stages = petTypes[newPetType].stages || [];
      const info = stages[0] || null;
      if (info) {
        this.data.pet = {
          type: newPetType,
          stage: 0,
          name: info.name !== undefined ? info.name : newPetType
        };
        this._save();
        return true;
      }
      return false;
    }
    getEquippedSkins() {
      this._needData();
      return {
        pen: this.data.equipped_pen || 'pen_basic',
        board: this.data.equipped_board || 'board_wood'
      };
    }
    getCurrentPet() {
      this._needData();
      return this.data.pet || { type: 'clover', stage: 0, name: 'Cỏ Non' };
    }
    _save() { if (this._adapter && typeof this._adapter.save === 'function') this._adapter.save(); }
  }

  // ===== API loader =====
  const shopApi = {
    collectShopCatalog: collectShopCatalog,
    filterShopItems: filterShopItems,
    ShopSystem: ShopSystem,
        loadPetTypes: function () { return _fetchJson('data/pets.json'); },
    loadSkinTypes: function () { return _fetchJson('data/skins.json').then(function (d) { return _normalizeSkin(d); }); },
    loadSkillTypes: function () { return _fetchJson('data/skills.json'); },
    loadAchievementTypes: function () { return _fetchJson('data/achievements.json'); },
    loadDailyRewards: function () { return _fetchJson('data/daily_rewards.json'); },
    loadGachaCards: function () { return _fetchJson('data/gacha_cards.json'); },
    createSystem: function (petTypes, skinTypes, data) {
      return new ShopSystem({ petTypes: petTypes, skinTypes: skinTypes, data: data });
            }
  };

  global.ShopApi = shopApi;
  global.ShopSystem = ShopSystem;
  global.collectShopCatalog = collectShopCatalog;
  global.filterShopItems = filterShopItems;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = shopApi;
  }
})(typeof window !== 'undefined' ? window : globalThis);