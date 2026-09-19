(function (global) {
  'use strict';
  /* =========================================================
     MathDrill Web — M9-F: ITEM EFFECTS (gacha card buffs)
     ---------------------------------------------------------
     Port từ game_init.py ItemEffectSystem (1631-1856) + constants:
     - FIVE_STAR_DURATION_MULT = 5; FIVE_STAR_EFFECT_IDS (6)
     - ITEM_DEFS: 19 effects (6×5★, 7×4★, 6×3★)
     - CARD_EFFECT_MAP: 19 card titles → effect_id
     Persistence: account data `bag` {title: qty}, `active_buffs`
     {effect_id: {...param, remaining/timer_left/sessions_left/revives}}.
     Types: timed (timer_left), session (sessions_left), question_count
     (remaining); 5★ scale duration ×5.
     Integration (main.py): session-end XP/gold bonus (1125-1139),
     score multiplier + question-count consume (1584-1599, 1811-1815),
     freeze timer (1845-1848), revive/shield.
     ========================================================= */

  const FIVE_STAR_DURATION_MULT = 5;
  const FIVE_STAR_EFFECT_IDS = {
    gold_double: true, score_x3_10q: true, score_x2_session: true,
    freeze_timer_5s: true, revive_1life: true, combo_x2_session: true
  };

  const ITEM_DEFS = {
    gold_double: { label: 'Nhân đôi Vàng', icon: '💰', type: 'session', param: { multiplier: 2 } },
    score_x3_10q: { label: 'x3 Điểm (50 câu)', icon: '🔥', type: 'question_count', param: { multiplier: 3, remaining: 10 } },
    score_x2_session: { label: 'x2 Điểm phiên', icon: '⚡', type: 'session', param: { multiplier: 2 } },
    freeze_timer_5s: { label: 'Đóng băng 25 giây', icon: '❄️', type: 'timed', param: { seconds: 5 } },
    revive_1life: { label: 'Hồi sinh mạng', icon: '💖', type: 'session', param: { revives: 1 } },
    combo_x2_session: { label: 'Combo x2', icon: '✨', type: 'session', param: { combo_boost: 2 } },
    geometry_boost: { label: 'Trợ lý Hình học', icon: '📐', type: 'session', param: { hint_geometry: true } },
    euler_hint: { label: 'Gợi ý Euler', icon: '🧭', type: 'question_count', param: { hint_hard: true, remaining: 5 } },
    pythagoras_hint: { label: 'Gợi ý Pythago', icon: '📏', type: 'session', param: { hint_triangle: true } },
    xp_boost_15: { label: '+15% EXP', icon: '🧠', type: 'session', param: { xp_multiplier: 1.15 } },
    time_bonus_3s: { label: '+3s mỗi đúng', icon: '⏳', type: 'session', param: { time_bonus: 3 } },
    bonus_question_chance: { label: 'Câu thưởng 10%', icon: '🏹', type: 'session', param: { bonus_q_chance: 0.10 } },
    shield_1life: { label: 'Khiên mạng', icon: '🛡️', type: 'session', param: { shield: 1 } },
    speed_add_10: { label: '+10% tốc độ', icon: '➕', type: 'session', param: { add_bonus: 0.10 } },
    speed_sub_5: { label: 'Trừ nhanh hơn', icon: '➖', type: 'session', param: { sub_speedup: 0.05 } },
    mul_bonus: { label: 'Nhân thêm điểm', icon: '✖️', type: 'session', param: { mul_bonus: 0.08 } },
    div_more: { label: 'Phép chia +10%', icon: '➗', type: 'session', param: { div_more: 0.10 } },
    memory_5: { label: 'Ghi nhớ nhanh', icon: '📝', type: 'session', param: { mem_boost: 0.05 } },
    focus_combo: { label: 'Tập trung cao', icon: '🎯', type: 'session', param: { combo_protect: 0.05 } }
  };

  const CARD_EFFECT_MAP = {
    'Thần Toán Archimedes': 'gold_double',
    'Rồng Số Học': 'score_x3_10q',
    'Nhà Thông Thái Lão Hạc': 'score_x2_session',
    'Tia Sáng Pygame': 'freeze_timer_5s',
    'Phượng Hoàng Đại Số': 'revive_1life',
    'Thiên Tài Einstein Jr.': 'combo_x2_session',
    'Bảo Hộ Thales': 'geometry_boost',
    'La Bàn Euler': 'euler_hint',
    'Định Lý Pythago': 'pythagoras_hint',
    'Bộ Nhớ Siêu Cấp': 'xp_boost_15',
    'Đồng Hồ Cát': 'time_bonus_3s',
    'Cung Thủ Logic': 'bonus_question_chance',
    'Khiên Tri Thức': 'shield_1life',
    'Cộng Thần Tốc': 'speed_add_10',
    'Trừ Chớp Nhoáng': 'speed_sub_5',
    'Nhân Vũ Bão': 'mul_bonus',
    'Chia Cắt Gió': 'div_more',
    'Ghi Nhớ Nhanh': 'memory_5',
    'Tập Trung Cao': 'focus_combo'
  };

  class ItemEffectSystem {
    // opts: { accountSystem, save? } — d = account data (bag + active_buffs)
    constructor(opts) {
      var o = opts || {};
      this.accountSystem = o.accountSystem;
      this._save = o.save || null;
    }
    _saveNow() {
      if (this._save) this._save();
      else if (this.accountSystem && typeof this.accountSystem.save === 'function') this.accountSystem.save();
    }
    _data() { return this.accountSystem.data(); }
    _isFiveStar(effectId) { return !!FIVE_STAR_EFFECT_IDS[effectId]; }
    // game_init.py _scaled_amount
    _scaledAmount(base, effectId) {
      return this._isFiveStar(effectId) ? base * FIVE_STAR_DURATION_MULT : base;
    }
    getBag() {
      var d = this._data();
      return d.bag || {};
    }
    // game_init.py add_to_bag
    addToBag(cardTitle, quantity) {
      var d = this._data();
      var bag = d.bag = d.bag || {};
      bag[cardTitle] = (bag[cardTitle] !== undefined ? bag[cardTitle] : 0) + (quantity || 1);
      this._saveNow();
    }
    // game_init.py get_active_summary
    getActiveSummary() {
      var d = this._data();
      var out = {};
      var buffs = d.active_buffs || {};
      var ids = Object.keys(buffs);
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        var defn = ITEM_DEFS[id];
        if (!defn) continue;
        var info = { label: defn.label, icon: defn.icon, type: defn.type };
        if (defn.type === 'timed') {
          info.timer_left = buffs[id].timer_left !== undefined ? buffs[id].timer_left : 0;
        } else if (defn.type === 'session') {
          if (buffs[id].revives !== undefined) info.revives = buffs[id].revives;
          if (buffs[id].shield !== undefined) info.shield = buffs[id].shield;
        } else if (defn.type === 'question_count') {
          info.remaining = buffs[id].remaining !== undefined ? buffs[id].remaining : 0;
        }
        out[id] = info;
      }
      return out;
    }
    // game_init.py _apply_five_star_duration — scale remaining/timer/revives, sessions_left=5
    _applyFiveStarDuration(effectId, buffData, defn) {
      if (!this._isFiveStar(effectId)) return;
      if (buffData.remaining !== undefined) {
        buffData.remaining = this._scaledAmount(defn.param.remaining !== undefined ? defn.param.remaining : 1, effectId);
      }
      if (defn.type === 'timed') {
        buffData.timer_left = this._scaledAmount(defn.param.seconds, effectId);
      }
      if (defn.type === 'session') {
        buffData.sessions_left = FIVE_STAR_DURATION_MULT;
        if (buffData.revives !== undefined) {
          buffData.revives = this._scaledAmount(defn.param.revives !== undefined ? defn.param.revives : 1, effectId);
        }
      }
    }
    // game_init.py activate (1699-1724) — stack khi đang active, deepcopy param đầu
    activate(cardTitle) {
      var d = this._data();
      var bag = d.bag = d.bag || {};
      if (!(bag[cardTitle] > 0)) return [false, 'Không có thẻ này trong túi!'];
      var effectId = CARD_EFFECT_MAP[cardTitle];
      if (!effectId) return [false, 'Thẻ này chưa có hiệu ứng.'];
      var defn = ITEM_DEFS[effectId];
      if (!defn) return [false, 'Thẻ này chưa có hiệu ứng.'];
      var activeBuffs = d.active_buffs = d.active_buffs || {};
      if (effectId in activeBuffs) {
        // Python: if effect_id in buffs → stack theo key của ex
        var ex = activeBuffs[effectId];
        if (ex.remaining !== undefined) {
          ex.remaining += this._scaledAmount(defn.param.remaining !== undefined ? defn.param.remaining : 1, effectId);
        } else if (ex.revives !== undefined) {
          ex.revives += this._scaledAmount(defn.param.revives !== undefined ? defn.param.revives : 1, effectId);
        } else if (ex.sessions_left !== undefined) {
          ex.sessions_left += FIVE_STAR_DURATION_MULT;
        } else if (defn.type === 'timed') {
          ex.timer_left = (ex.timer_left || 0) + this._scaledAmount(defn.param.seconds, effectId);
        }
      } else {
        // Python: copy.deepcopy(param) rồi _apply_five_star_duration
        var buff = JSON.parse(JSON.stringify(defn.param));
        if (defn.type === 'timed' && !this._isFiveStar(effectId)) {
          buff.timer_left = defn.param.seconds;
        }
        this._applyFiveStarDuration(effectId, buff, defn);
        activeBuffs[effectId] = buff;
      }
      // Consume 1 từ bag
      bag[cardTitle] -= 1;
      if (bag[cardTitle] <= 0) delete bag[cardTitle];
      this._saveNow();
      return [true, '✅ Kích hoạt: ' + defn.label + '!'];
    }
    getBuff(effectId) {
      var d = this._data();
      var buffs = d.active_buffs || {};
      return buffs[effectId] || null;
    }
    // game_init.py consume_question_count — remaining-1, xoá khi ≤0
    consumeQuestionCount(effectId) {
      var d = this._data();
      var buffs = d.active_buffs || {};
      var b = buffs[effectId];
      if (!b || b.remaining === undefined) return;
      b.remaining -= 1;
      if (b.remaining <= 0) delete buffs[effectId];
      this._saveNow();
    }
    // game_init.py tick_timers — timer_left -= dt, xoá khi ≤0
    tickTimers(dt) {
      var d = this._data();
      var buffs = d.active_buffs || {};
      var changed = false;
      var ids = Object.keys(buffs);
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        if (buffs[id].timer_left !== undefined) {
          buffs[id].timer_left -= dt;
          if (buffs[id].timer_left <= 0) {
            delete buffs[id];
          }
          changed = true;
        }
      }
      if (changed) this._saveNow();
    }
    // game_init.py clear_session_buffs — xoá session/question_count,
    // 5★ session giảm sessions_left 5/phiên
    clearSessionBuffs() {
      var d = this._data();
      var buffs = d.active_buffs || {};
      var ids = Object.keys(buffs);
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        var defn = ITEM_DEFS[id];
        if (!defn) { delete buffs[id]; continue; }
        if (this._isFiveStar(id) && defn.type === 'session') {
          buffs[id].sessions_left = (buffs[id].sessions_left !== undefined ? buffs[id].sessions_left : 5) - 5;
          if (buffs[id].sessions_left <= 0) delete buffs[id];
        } else if (defn.type === 'session' || defn.type === 'question_count') {
          delete buffs[id];
        }
      }
      this._saveNow();
    }
    // ---- Multipliers / getters (game_init.py 1795-1848) ----
    getScoreMultiplier() {
      var mult = 1.0;
      var b2 = this.getBuff('score_x2_session');
      if (b2 && b2.multiplier) mult *= b2.multiplier;
      var b3 = this.getBuff('score_x3_10q');
      if (b3 && b3.remaining !== undefined && b3.remaining > 0 && b3.multiplier) {
        mult *= b3.multiplier;
      }
      return mult;
    }
    getGoldMultiplier() {
      var b = this.getBuff('gold_double');
      return (b && b.multiplier) ? b.multiplier : 1.0;
    }
    getXpMultiplier() {
      var b = this.getBuff('xp_boost_15');
      return (b && b.xp_multiplier) ? b.xp_multiplier : 1.0;
    }
    getTimeBonus() {
      var b = this.getBuff('time_bonus_3s');
      return (b && b.time_bonus) ? b.time_bonus : 0;
    }
    hasFreezeTimer() {
      var b = this.getBuff('freeze_timer_5s');
      return !!(b && b.timer_left !== undefined && b.timer_left > 0);
    }
    hasRevive() {
      var b = this.getBuff('revive_1life');
      return !!(b && b.revives !== undefined && b.revives > 0);
    }
    useRevive() {
      var d = this._data();
      var buffs = d.active_buffs || {};
      var b = buffs['revive_1life'];
      if (!b || !(b.revives > 0)) return false;
      b.revives -= 1;
      if (b.revives <= 0) delete buffs['revive_1life'];
      this._saveNow();
      return true;
    }
    hasShield() {
      var b = this.getBuff('shield_1life');
      return !!(b && b.shield !== undefined && b.shield > 0);
    }
    useShield() {
      var d = this._data();
      var buffs = d.active_buffs || {};
      var b = buffs['shield_1life'];
      if (!b || !(b.shield > 0)) return false;
      b.shield -= 1;
      if (b.shield <= 0) delete buffs['shield_1life'];
      this._saveNow();
      return true;
    }
    getComboBoost() {
      var b = this.getBuff('combo_x2_session');
      return (b && b.combo_boost) ? b.combo_boost : 1;
    }
  }

  global.ItemEffectSystem = ItemEffectSystem;
  global.ITEM_DEFS = ITEM_DEFS;
  global.CARD_EFFECT_MAP = CARD_EFFECT_MAP;
  global.FIVE_STAR_DURATION_MULT = FIVE_STAR_DURATION_MULT;
  global.FIVE_STAR_EFFECT_IDS = FIVE_STAR_EFFECT_IDS;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      ItemEffectSystem: ItemEffectSystem,
      ITEM_DEFS: ITEM_DEFS,
      CARD_EFFECT_MAP: CARD_EFFECT_MAP,
      FIVE_STAR_DURATION_MULT: FIVE_STAR_DURATION_MULT,
      FIVE_STAR_EFFECT_IDS: FIVE_STAR_EFFECT_IDS
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);

