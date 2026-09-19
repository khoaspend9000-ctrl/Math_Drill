(function (global) {
  'use strict';
  /* =========================================================
     MathDrill Web — M9-E: DAILY REWARD / STREAK
     ---------------------------------------------------------
     Port source-of-truth:
     - game_init.py claim_daily_reward() (dòng 3637-3668)
     - game_init.py _today_iso()  → datetime.date.today().isoformat()
       = LOCAL calendar date (KHÔNG UTC — giữ nguyên semantics)
     - game_content_loader.py load_daily_rewards() + get_daily_reward_for_streak()
     - data/daily_rewards.json (cycle_days=7, 7 rewards)
     Persisted fields (account data): daily_streak, last_claim.
     ========================================================= */

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

  // game_content_loader.load_daily_rewards fallback (dùng khi JSON rỗng/thiếu rewards)
  function defaultDailyCfg() {
    var rewards = [];
    for (var i = 1; i <= 7; i++) {
      rewards.push({ day: i, xp: 50 + i * 15, gold: i * 10, icon: '🎁' });
    }
    return { cycle_days: 7, rewards: rewards };
  }

  function normalizeDailyCfg(raw) {
    var cfg = raw && typeof raw === 'object' ? raw : {};
    var rewards = Array.isArray(cfg.rewards) && cfg.rewards.length ? cfg.rewards : null;
    if (!rewards) return defaultDailyCfg();
    var cycle = parseInt(cfg.cycle_days, 10);
    if (!isFinite(cycle) || cycle <= 0) cycle = 7;
    return { cycle_days: cycle, rewards: rewards };
  }

  function loadDailyRewards() {
    return _fetchJson('data/daily_rewards.json').then(normalizeDailyCfg);
  }

  // game_init.py _today_iso(): datetime.date.today().isoformat()
  // → LOCAL calendar date. Dùng thành phần local của Date, KHÔNG toISOString (UTC).
  function localTodayISO(now) {
    var d = now instanceof Date ? now : new Date(now !== undefined ? now : Date.now());
    if (isNaN(d.getTime())) d = new Date();
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return y + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }

  // 'YYYY-MM-DD' → ngày đặt múi-giờ trung tính (epoch-day) để tính chênh lệch lịch.
  function _isoToUtcDay(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return NaN;
    var y = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return NaN;
    return Math.round(Date.UTC(y, mo - 1, d) / 86400000);
  }

  // game_init.py: (datetime.date.today() - last_dt).days
  function diffCalendarDays(fromIso, toIso) {
    var a = _isoToUtcDay(fromIso), b = _isoToUtcDay(toIso);
    if (isNaN(a) || isNaN(b)) return NaN;
    return b - a;
  }

  // game_content_loader.get_daily_reward_for_streak — port chính xác.
  // Python: hàm nhận cfg từ load_daily_rewards() (defaults đã áp ở đó) —
  // do đó raw cfg đi vào KHÔNG được tự inject default; raw=true để test
  // branch "if not rewards" (synthetic) đúng như Python.
  function getDailyRewardForStreak(streak, cfg, raw) {
    var c = raw ? (cfg || {}) : normalizeDailyCfg(cfg);
    var rewards = c.rewards || [];
    if (!rewards.length) {
      return { day: 1, xp: 50 + streak * 10, gold: 0, icon: '🎁' };
    }
    var cycle = _safeInt(c.cycle_days, 7) || 7;
    var dayIndex = (Math.max(1, streak) - 1) % cycle;
    var src = dayIndex < rewards.length ? rewards[dayIndex] : rewards[rewards.length - 1];
    return Object.assign({}, src);
  }

  function _safeInt(v, fallback) {
    var n = parseInt(v, 10);
    return isFinite(n) ? n : (fallback || 0);
  }

  /* game_init.py claim_daily_reward (3637-3668) — port chính xác.
     opts: { player, accountSystem, cfg?, nowISO?, save? }
     - nowISO injectable cho test (simulated date); mặc định local date.
     - Python int(d.get("daily_streak", 0)) với JSON hợp lệ luôn là int →
       _safeInt tương đương; defensive cho invalid state (không crash). */
  class DailyRewardSystem {
    constructor(opts) {
      var o = opts || {};
      this.player = o.player || null;
      this.accountSystem = o.accountSystem || null;
      this.cfg = o.cfg ? normalizeDailyCfg(o.cfg) : null;   // sync cfg (đã load); null → dùng default
      this.nowISO = o.nowISO || null;                        // () => 'YYYY-MM-DD' LOCAL
      this.save = o.save || null;                            // custom save hook (test)
    }

    _cfg() {
      return this.cfg ? normalizeDailyCfg(this.cfg) : defaultDailyCfg();
    }

    _today() {
      if (this.nowISO) {
        var s = String(this.nowISO());
        return /^(\d{4})-(\d{2})-(\d{2})$/.test(s) ? s : localTodayISO();
      }
      return localTodayISO();
    }

    claim() {
      // if not account_system.current_user: return None
      if (!this.accountSystem || !this.accountSystem.currentUser) return null;
      var d = this.accountSystem.data();
      var last = d.last_claim || '';
      var today = this._today();
      // if last == today: return None
      if (last === today) return null;

      var streak = _safeInt(d.daily_streak, 0);
      if (last) {
        // Python: date.fromisoformat(last) — ValueError → streak = 0
        var diff = diffCalendarDays(last, today);
        if (isNaN(diff) || diff !== 1) streak = 0;
      }
      streak += 1;

      var rewardCfg = getDailyRewardForStreak(streak, this._cfg());
      var xpReward = _safeInt(rewardCfg.xp, 50 + streak * 10);
      var goldReward = _safeInt(rewardCfg.gold, 0);

      d.daily_streak = streak;
      d.last_claim = today;

      // Python: add_xp(xp_reward); if gold > 0: add_gold(gold); account_system.save()
      if (this.player) {
        this.player.addExp(xpReward, this.accountSystem);
        if (goldReward > 0) this.player.addGold(goldReward, this.accountSystem);
      }
      if (this.save) this.save();
      else if (this.accountSystem && typeof this.accountSystem.save === 'function') this.accountSystem.save();

      // Python: "day": int(reward_cfg.get("day", ((streak - 1) % 7) + 1)) — fallback literal 7
      return {
        xp: xpReward,
        gold: goldReward,
        day: rewardCfg.day !== undefined ? _safeInt(rewardCfg.day, 1) : ((streak - 1) % 7) + 1,
        streak: streak,
        icon: rewardCfg.icon !== undefined ? rewardCfg.icon : '🎁'
      };
    }

    // Tiện ích cho UI: ngày hiện tại đã nhận chưa + streak hiện tại (không thay đổi state)
    status() {
      if (!this.accountSystem || !this.accountSystem.currentUser) return { claimedToday: false, streak: 0, today: this._today() };
      var d = this.accountSystem.data();
      var today = this._today();
      return {
        claimedToday: d.last_claim === today,
        streak: _safeInt(d.daily_streak, 0),
        lastClaim: d.last_claim || '',
        today: today
      };
    }
  }

  var Daily = {
    loadDailyRewards: loadDailyRewards,
    normalizeDailyCfg: normalizeDailyCfg,
    defaultDailyCfg: defaultDailyCfg,
    localTodayISO: localTodayISO,
    diffCalendarDays: diffCalendarDays,
    getDailyRewardForStreak: getDailyRewardForStreak,
    DailyRewardSystem: DailyRewardSystem
  };

  global.Daily = Daily;
  if (typeof module !== 'undefined' && module.exports) { module.exports = Daily; }
})(typeof window !== 'undefined' ? window : globalThis);
