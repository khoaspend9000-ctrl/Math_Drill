/* M9-C: GACHA — exact port of Python pity engine (game_init.py:5117-5244).
   GACHA_POOL/common/rare/legendary titles, BASE_RATES, SOFT_PITY_START=74,
   HARD_PITY=90, rare pity 10, 10-pull rare guarantee, gold-banner 50% reroll,
   count=1 returns single (card,is_new). Deterministic injected RNG in tests. */
(function (global) {
  'use strict';
  var BASE_RATES = { common: 0.943, rare: 0.051, legendary: 0.006 };
  var SOFT_PITY_START = 74;
  var HARD_PITY = 90;
  var POOL = {
    common: [
      { title: 'Cong Than Toc', icon: '+', category: 'Thuong', content: 'Tang toc do tinh nham phep cong.' },
      { title: 'Tru Chop Nhoang', icon: '-', category: 'Thuong', content: 'Giam thoi gian suy nghi phep tru.' },
      { title: 'Nhan Vu Bao', icon: 'x', category: 'Thuong', content: 'Tang nhe diem phep nhan.' },
      { title: 'Chia Cat Gio', icon: '/', category: 'Thuong', content: 'Cau hoi phep chia xuat hien nhieu hon.' },
      { title: 'Ghi Nho Nhanh', icon: 'note', category: 'Thuong', content: 'Tang toc do ghi nho cong thuc.' }
    ],
    rare: [
      { title: 'Bao Ho Thales', icon: 'T', category: 'Hiem', content: 'Tang ti le chinh xac hinh hoc.' },
      { title: 'La Ban Euler', icon: 'E', category: 'Hiem', content: 'Mo khoa goi y duong thang Euler.' },
      { title: 'Dinh Ly Pythago', icon: 'P', category: 'Hiem', content: 'Tam giac vuong hien them goi y.' },
      { title: 'Bo Nho Sieu Cap', icon: 'B', category: 'Hiem', content: 'Tang EXP 15% trong phien.' },
      { title: 'Dong Ho Cat', icon: 'H', category: 'Hiem', content: 'Cong 3 giay moi cau dung.' }
    ],
    legendary: [
      { title: 'Nha Thong Thai Lao Hac', icon: 'L', category: 'Huyen Thoai', content: 'Nhan 2 diem thuong Van hoc.' },
      { title: 'Tia Sang Pygame', icon: 'S', category: 'Huyen Thoai', content: 'Dong bang dem nguoc 5 giay.' },
      { title: 'Than Toan Archimedes', icon: 'A', category: 'Huyen Thoai', content: 'Nhan doi Vang 1 phien.' },
      { title: 'Rong So Hoc', icon: 'R', category: 'Huyen Thoai', content: 'x3 diem 10 cau tiep theo.' }
    ]
  };
  function _defState() { return { pull_count: 0, total_pulls: 0, guaranteed_legendary: false, rare_pity: 0 }; }
  function GachaSystem(opts) {
    opts = opts || {};
    this.data = opts.data || { inventory: [], gacha_state: null };
    if (!this.data.gacha_state) this.data.gacha_state = _defState();
    if (!this.data.inventory) this.data.inventory = [];
    this._rng = opts.rng || null;
    this.pool = opts.pool || POOL;
    this.cardTypes = opts.cardTypes || null;
  }
  GachaSystem.BASE_RATES = BASE_RATES;
  GachaSystem.SOFT_PITY_START = SOFT_PITY_START;
  GachaSystem.HARD_PITY = HARD_PITY;
  GachaSystem.prototype._randFloat = function () {
    if (this._rng) {
      if (typeof this._rng.random === 'function') return this._rng.random();
      if (typeof this._rng.nextFloat === 'function') return this._rng.nextFloat();
    }
    return Math.random();
  };
  GachaSystem.prototype._randint = function (a, b) {
    if (this._rng && typeof this._rng.randint === 'function') return this._rng.randint(a, b);
    return a + Math.floor(this._randFloat() * (b - a + 1));
  };
  GachaSystem.prototype._pick = function (arr) {
    if (!arr || !arr.length) return null;
    if (this._rng && typeof this._rng.choice === 'function') return this._rng.choice(arr);
    return arr[Math.floor(this._randFloat() * arr.length)];
  };
  GachaSystem.prototype._choice = GachaSystem.prototype._pick;
  // Port of roll_gacha(count, banner='standard') — game_init.py:5180-5244.
  GachaSystem.prototype.roll = function (count, banner) {
    count = (count === 10) ? 10 : 1;
    banner = (banner === 'gold') ? 'gold' : 'standard';
    var st = this.data.gacha_state;
    var results = [];
    var hasRareOrHigher = false;
    for (var i = 0; i < count; i++) {
      var r = this._singleRoll(st, banner);
      if (r.rarity === 'rare' || r.rarity === 'legendary') hasRareOrHigher = true;
      results.push(r);
    }
    // 10-pull guarantee: no rare+ -> force last pull to rare.
    if (count === 10 && !hasRareOrHigher) {
      var forced = this._pick(this.pool.rare.slice());
      forced = { title: forced.title, icon: forced.icon, category: forced.category, content: forced.content, rarity: 'rare' };
      var isNewF = this.data.inventory.indexOf(forced.title) < 0;
      if (isNewF) this.data.inventory.push(forced.title);
      results[results.length - 1] = { card: forced, rarity: 'rare', isNew: isNewF };
    }
    if (typeof this.save === 'function') { try { this.save(); } catch (_) {} }
    if (count === 1) return results[0];
    return results;
  };
  // Roll rates with soft/hard/rare pity — game_init.py:5190-5227.
  GachaSystem.prototype._rollRarity = function (st) {
    var legendaryRate = BASE_RATES.legendary;
    // Soft pity from pull 74: +6% per pull beyond 73.
    if (st.pull_count >= SOFT_PITY_START - 1) {
      legendaryRate += 0.06 * (st.pull_count - (SOFT_PITY_START - 2));
    }
    legendaryRate = Math.min(legendaryRate, 1.0);
    var roll = this._randFloat();
    if (st.pull_count >= HARD_PITY - 1) return 'legendary'; // hard pity pull 90
    if (roll < legendaryRate) return 'legendary';
    if (st.rare_pity >= 9) return 'rare'; // rare pity every 10
    if (roll < legendaryRate + BASE_RATES.rare) return 'rare';
    return 'common';
  };
  GachaSystem.prototype._singleRoll = function (st, banner) {
    var rarity = this._rollRarity(st);
    var card, isNew;
    var inv = this.data.inventory;
    if (rarity === 'legendary') {
      var leg = this._pick(this.pool.legendary.slice());
      card = { title: leg.title, icon: leg.icon, category: leg.category, content: leg.content, rarity: 'legendary' };
      st.pull_count = 0;
      st.rare_pity = (st.rare_pity || 0) + 1;
    } else if (rarity === 'rare') {
      // Gold banner: 50% chance reroll rare into a second rare (forced fresh pick).
      if (banner === 'gold' && this._randFloat() < 0.5) {
        var r2 = this._pick(this.pool.rare.slice());
        card = { title: r2.title, icon: r2.icon, category: r2.category, content: r2.content, rarity: 'rare' };
      } else {
        var r1 = this._pick(this.pool.rare.slice());
        card = { title: r1.title, icon: r1.icon, category: r1.category, content: r1.content, rarity: 'rare' };
      }
      st.pull_count = (st.pull_count || 0) + 1;
      st.rare_pity = 0;
    } else {
      var c = this._pick(this.pool.common.slice());
      card = { title: c.title, icon: c.icon, category: c.category, content: c.content, rarity: 'common' };
      st.pull_count = (st.pull_count || 0) + 1;
      st.rare_pity = (st.rare_pity || 0) + 1;
    }
    st.total_pulls = (st.total_pulls || 0) + 1;
    isNew = inv.indexOf(card.title) < 0;
    if (isNew) inv.push(card.title);
    return { card: card, rarity: rarity, isNew: isNew };
  };
  GachaSystem.prototype.getPityInfo = function () {
    var st = this.data.gacha_state || _defState();
    var count = st.pull_count || 0;
    return {
      pull_count: count,
      total_pulls: st.total_pulls || 0,
      hard_pity: HARD_PITY,
      soft_pity_start: SOFT_PITY_START,
      soft_pity_active: count >= SOFT_PITY_START,
      guaranteed: !!st.guaranteed_legendary,
      pulls_to_hard: Math.max(0, HARD_PITY - count)
    };
  };
  // Legacy data-driven helpers (web/data cardTypes: math_facts/history/tips/achievements).
  GachaSystem.prototype.getRandomCard = function () {
    var cardTypes = this.cardTypes;
    if (!cardTypes) return null;
    var rand = this._randint(1, 100);
    var cumulative = 0, selectedRarity = 'common';
    var rarityRates = { common: 80, rare: 18, legendary: 2 };
    var keys = Object.keys(rarityRates);
    var i;
    for (i = 0; i < keys.length; i++) {
      cumulative += rarityRates[keys[i]];
      if (rand <= cumulative) { selectedRarity = keys[i]; break; }
    }
    var cardsInRarity = [], cats = Object.keys(cardTypes), c, k;
    for (c = 0; c < cats.length; c++) {
      var data = cardTypes[cats[c]];
      if (data && data.rarity === selectedRarity) {
        var items = data.items || [];
        for (k = 0; k < items.length; k++) cardsInRarity.push(items[k]);
      }
    }
    if (cardsInRarity.length) return this._choice(cardsInRarity);
    var fb = cardTypes.math_facts ? cardTypes.math_facts.items : null;
    if (fb && fb.length) return this._choice(fb);
    return null;
  };
  GachaSystem.prototype.getCardById = function (cardId) {
    var cats = Object.keys(this.cardTypes), c, k;
    for (c = 0; c < cats.length; c++) {
      var items = (this.cardTypes[cats[c]] || {}).items || [];
      for (k = 0; k < items.length; k++) if (items[k].id === cardId) return items[k];
    }
    return null;
  };
  GachaSystem.prototype.getAllCards = function () {
    var all = [], cats = Object.keys(this.cardTypes), c, k;
    for (c = 0; c < cats.length; c++) {
      var data = this.cardTypes[cats[c]], items = (data || {}).items || [];
      for (k = 0; k < items.length; k++) all.push({ id: items[k].id, title: items[k].title, content: items[k].content, icon: items[k].icon, category: data.name, rarity: data.rarity });
    }
    return all;
  };
  global.GachaSystem = GachaSystem;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GachaSystem;
  }
})(typeof window !== 'undefined' ? window : globalThis);
