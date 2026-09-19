'use strict';
/* M9-E DAILY REWARD / STREAK — port game_init.py claim_daily_reward (3637-3668)
   + game_content_loader.py load_daily_rewards / get_daily_reward_for_streak.
   Simulated date qua nowISO injection — KHÔNG phụ thuộc ngày hệ thống thật. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { PlayerData } = require('../js/player.js');
const Daily = require('../js/daily.js');

let pass = 0, failed = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('PASS  ' + name); }
  catch (e) { failed++; console.error('FAIL  ' + name + ' :: ' + (e && e.message)); }
}

const SRC = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'daily_rewards.json'), 'utf8'));
const DST = JSON.parse(fs.readFileSync(path.join(ROOT, 'web', 'data', 'daily_rewards.json'), 'utf8'));

function mkAccount(d) {
  const acct = {
    currentUser: 'tester',
    _data: d,
    data() { return acct._data; },
    saveCount: 0,
    save() { acct.saveCount++; }
  };
  return acct;
}
function mkPlayer() { return new PlayerData(); }
function mkSys(d, opts) {
  const o = opts || {};
  return new Daily.DailyRewardSystem({
    player: o.player !== undefined ? o.player : mkPlayer(),
    accountSystem: mkAccount(d),
    cfg: SRC,
    nowISO: o.nowISO || null,
    save: o.save || null
  });
}
const D = (m, day) => '2026-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);

check('T01 data exact mirror data/ vs web/data/daily_rewards.json', function () {
  assert.deepStrictEqual(DST, SRC);
});

check('T02 cfg structure: cycle 7, 7 rewards, days 1..7', function () {
  assert.strictEqual(SRC.cycle_days, 7);
  assert.strictEqual(SRC.rewards.length, 7);
  SRC.rewards.forEach(function (r, i) {
    assert.strictEqual(r.day, i + 1);
    assert.strictEqual(typeof r.xp, 'number');
    assert.strictEqual(typeof r.gold, 'number');
    assert.strictEqual(typeof r.icon, 'string');
  });
  assert.strictEqual(SRC.rewards[0].xp, 50);
  assert.strictEqual(SRC.rewards[0].gold, 20);
  assert.strictEqual(SRC.rewards[6].xp, 200);
  assert.strictEqual(SRC.rewards[6].gold, 150);
});

check('T03 getDailyRewardForStreak day1/day4/day7 (real cfg)', function () {
  const r1 = Daily.getDailyRewardForStreak(1, SRC);
  assert.strictEqual(r1.xp, 50); assert.strictEqual(r1.gold, 20); assert.strictEqual(r1.day, 1);
  const r4 = Daily.getDailyRewardForStreak(4, SRC);
  assert.strictEqual(r4.xp, 90); assert.strictEqual(r4.gold, 50);
  const r7 = Daily.getDailyRewardForStreak(7, SRC);
  assert.strictEqual(r7.xp, 200); assert.strictEqual(r7.gold, 150); assert.strictEqual(r7.day, 7);
});

check('T04 day 1 claim: fresh user, reward 50xp/20gold', function () {
  const d = { gold: 0 };
  const p = mkPlayer();
  const sys = mkSys(d, { player: p, nowISO: function () { return D(9, 1); } });
  const r = sys.claim();
  assert.strictEqual(r.xp, 50);
  assert.strictEqual(r.gold, 20);
  assert.strictEqual(r.day, 1);
  assert.strictEqual(r.streak, 1);
  assert.strictEqual(r.icon, SRC.rewards[0].icon);
  assert.strictEqual(p.exp, 50);
  assert.strictEqual(p.gold, 20);
  assert.strictEqual(d.gold, 20);
  assert.strictEqual(d.daily_streak, 1);
  assert.strictEqual(d.last_claim, D(9, 1));
});

check('T05 consecutive day claim: streak 2, day2 rewards 60/30', function () {
  const d = { gold: 100, daily_streak: 1, last_claim: D(9, 1) };
  const p = mkPlayer();
  p.gold = 100; // player state loaded từ account (Python add_gold cộng vào gold hiện có)
  const sys = mkSys(d, { player: p, nowISO: function () { return D(9, 2); } });
  const r = sys.claim();
  assert.strictEqual(r.streak, 2);
  assert.strictEqual(r.day, 2);
  assert.strictEqual(r.xp, 60);
  assert.strictEqual(r.gold, 30);
  assert.strictEqual(p.gold, 130);
  assert.strictEqual(d.gold, 130);
});

check('T06 full week D1..D7: exact reward sequence', function () {
  let d = { gold: 0 };
  for (let day = 1; day <= 7; day++) {
    const sys = mkSys(d, { player: null, nowISO: function () { return D(9, day); } });
    const r = sys.claim();
    const exp = SRC.rewards[day - 1];
    assert.strictEqual(r.xp, exp.xp, 'xp day ' + day);
    assert.strictEqual(r.gold, exp.gold, 'gold day ' + day);
    assert.strictEqual(r.streak, day);
    d = { gold: d.gold, daily_streak: day, last_claim: D(9, day) };
  }
});

check('T07 day 8 cycle wraps to day1 rewards (streak 8)', function () {
  const d = { gold: 0, daily_streak: 7, last_claim: D(9, 7) };
  const sys = mkSys(d, { player: null, nowISO: function () { return D(9, 8); } });
  const r = sys.claim();
  assert.strictEqual(r.streak, 8);
  assert.strictEqual(r.day, 1);
  assert.strictEqual(r.xp, 50);
  assert.strictEqual(r.gold, 20);
});

check('T08 duplicate claim same day returns null, no reward applied', function () {
  const d = { gold: 10, daily_streak: 3, last_claim: D(9, 3) };
  const p = mkPlayer();
  const sys = mkSys(d, { player: p, nowISO: function () { return D(9, 3); } });
  const r = sys.claim();
  assert.strictEqual(r, null);
  assert.strictEqual(d.daily_streak, 3);
  assert.strictEqual(d.gold, 10);
  assert.strictEqual(p.exp, 0);
  assert.strictEqual(p.gold, 0);
});

check('T09 gap > 1 day resets streak to day1', function () {
  const d = { gold: 0, daily_streak: 5, last_claim: D(9, 1) };
  const sys = mkSys(d, { player: null, nowISO: function () { return D(9, 3); } });
  const r = sys.claim();
  assert.strictEqual(r.streak, 1);
  assert.strictEqual(r.day, 1);
  assert.strictEqual(r.xp, 50);
  assert.strictEqual(d.daily_streak, 1);
  assert.strictEqual(d.last_claim, D(9, 3));
});

check('T10 invalid last_claim string resets streak (no crash)', function () {
  const d = { gold: 0, daily_streak: 4, last_claim: 'not-a-date' };
  const sys = mkSys(d, { player: null, nowISO: function () { return D(9, 1); } });
  const r = sys.claim();
  assert.strictEqual(r.streak, 1);
  assert.strictEqual(r.day, 1);
  assert.strictEqual(d.daily_streak, 1);
  assert.strictEqual(d.last_claim, D(9, 1));
});

check('T11 no current user returns null', function () {
  const sys = new Daily.DailyRewardSystem({
    player: mkPlayer(),
    accountSystem: { currentUser: null, data: function () { return {}; }, save: function () {} },
    cfg: SRC
  });
  assert.strictEqual(sys.claim(), null);
});

check('T12 reward application via player.addExp/addGold + no premature level-up', function () {
  const d = { gold: 0 };
  const p = mkPlayer();
  const sys = mkSys(d, { player: p, nowISO: function () { return D(9, 1); } });
  sys.claim();
  assert.strictEqual(p.level, 1);
  assert.strictEqual(p.exp, 50);
  assert.strictEqual(p.gold, 20);
});

check('T13 persistence fields + save called', function () {
  const d = { gold: 0 };
  let saves = 0;
  const sys = mkSys(d, { player: null, save: function () { saves++; }, nowISO: function () { return D(9, 5); } });
  const r = sys.claim();
  assert.strictEqual(saves, 1);
  assert.strictEqual(d.daily_streak, r.streak);
  assert.strictEqual(d.last_claim, D(9, 5));
});

check('T14 date boundary: cross-month/year/leap diffs = 1 day', function () {
  assert.strictEqual(Daily.diffCalendarDays('2026-01-31', '2026-02-01'), 1);
  assert.strictEqual(Daily.diffCalendarDays('2026-12-31', '2027-01-01'), 1);
  assert.strictEqual(Daily.diffCalendarDays('2028-02-28', '2028-02-29'), 1); // leap
  assert.strictEqual(Daily.diffCalendarDays('2026-09-01', '2026-09-01'), 0);
  assert.strictEqual(Daily.diffCalendarDays('2026-09-01', '2026-09-03'), 2);
  assert.ok(isNaN(Daily.diffCalendarDays('bad', '2026-09-01')));
});

check('T15 local-date semantics (KHÔNG UTC): localTodayISO từ thành phần local', function () {
  // Tìm timestamp mà UTC-date khác local-date (bất kỳ tz nào khác UTC đều có).
  let found = false;
  for (let h = -30; h <= 30 && !found; h += 6) {
    const ts = Date.UTC(2026, 0, 1, 0, 0, 0) + h * 3600000;
    const d = new Date(ts);
    const utcDate = d.toISOString().slice(0, 10);
    const localDate = Daily.localTodayISO(ts);
    assert.strictEqual(localDate, d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'));
    if (d.getTimezoneOffset() !== 0 && utcDate !== localDate) {
      // local-date phải khác UTC-date → chứng minh KHÔNG dùng toISOString
      assert.notStrictEqual(localDate, utcDate);
      found = true;
    }
  }
  // tz UTC: local == UTC date — vẫn đúng semantics
  if (!found && new Date().getTimezoneOffset() === 0) {
    assert.strictEqual(Daily.localTodayISO(Date.UTC(2026, 0, 1, 5, 0, 0)), '2026-01-01');
  }
});

check('T16 same local-day boundary 23:59 vs 00:01 next day → duplicate blocked', function () {
  // Giả định local tz +7: 23:59 local 09-03 == 16:59 UTC 09-03; 00:01 local 09-04 là ngày khác.
  // Ở đây test qua nowISO injection: same ISO → null; ISO+1 → claim OK.
  const d = { gold: 0, daily_streak: 1, last_claim: D(9, 3) };
  const sys = mkSys(d, { player: null, nowISO: function () { return D(9, 3); } });
  assert.strictEqual(sys.claim(), null);
  const sys2 = mkSys(d, { player: null, nowISO: function () { return D(9, 4); } });
  const r = sys2.claim();
  assert.strictEqual(r.streak, 2);
});

check('T17 JSON thiếu rewards → default cfg (50+i*15) như Python load_daily_rewards', function () {
  // Python: load_daily_rewards() áp default rewards khi JSON thiếu →
  // get_daily_reward_for_streak(1) → rewards[0] = {xp: 50+1*15=65, gold: 1*10=10}
  const d = { gold: 5 };
  const p = mkPlayer();
  p.gold = 5;
  const sys = new Daily.DailyRewardSystem({
    player: p,
    accountSystem: mkAccount(d),
    cfg: { cycle_days: 7, rewards: [] },
    nowISO: function () { return D(9, 2); },
    save: function () {}
  });
  const r = sys.claim();
  assert.strictEqual(r.xp, 65);
  assert.strictEqual(r.gold, 10);
  assert.strictEqual(p.gold, 15);
  assert.strictEqual(d.gold, 15); // gold > 0 → addGold(10) qua player
});

check('T17b getDailyRewardForStreak với rewards rỗng hoàn toàn → synthetic {day:1, xp:50+streak*10, gold:0}', function () {
  // Python get_daily_reward_for_streak: if not rewards → synthetic (unreachable qua
  // load_daily_rewards vì default luôn có rewards, nhưng port giữ đúng branch)
  const r = Daily.getDailyRewardForStreak(2, { cycle_days: 7, rewards: [] }, true);
  assert.strictEqual(r.xp, 70); // 50 + 2*10
  assert.strictEqual(r.gold, 0);
  assert.strictEqual(r.day, 1);
});

check('T18 invalid state (garbage streak/gold) does not crash, no NaN', function () {
  const d = { gold: 'garbage', daily_streak: 'xyz', last_claim: null };
  const p = mkPlayer();
  const sys = mkSys(d, { player: p, nowISO: function () { return D(9, 1); } });
  const r = sys.claim();
  assert.ok(r && isFinite(r.xp) && isFinite(r.gold));
  assert.strictEqual(r.streak, 1);
  assert.strictEqual(d.daily_streak, 1);
  assert.ok(isFinite(p.gold));
});

check('T19 getDailyRewardForStreak clamps streak < 1 → max(1, streak)', function () {
  const r0 = Daily.getDailyRewardForStreak(0, SRC);
  const rn = Daily.getDailyRewardForStreak(-3, SRC);
  assert.strictEqual(r0.day, 1);
  assert.strictEqual(rn.day, 1);
});

check('T20 status() helper reflects claimedToday + streak', function () {
  const d = { gold: 0, daily_streak: 2, last_claim: D(9, 2) };
  const sys = mkSys(d, { player: null, nowISO: function () { return D(9, 2); } });
  let s = sys.status();
  assert.strictEqual(s.claimedToday, true);
  assert.strictEqual(s.streak, 2);
  const d2 = { gold: 0 };
  const sys2 = mkSys(d2, { player: null, nowISO: function () { return D(9, 2); } });
  s = sys2.status();
  assert.strictEqual(s.claimedToday, false);
  assert.strictEqual(s.streak, 0);
});

check('T21 repeated claims across 10 simulated days: monotonic streak, no dup reward', function () {
  const d = { gold: 0 };
  let totalXp = 0, totalGold = 0;
  for (let day = 1; day <= 10; day++) {
    const sys = mkSys(d, { player: null, nowISO: function () { return D(9, day); } });
    const r = sys.claim();
    assert.ok(r, 'day ' + day + ' must claim');
    totalXp += r.xp; totalGold += r.gold;
    assert.strictEqual(d.last_claim, D(9, day));
  }
  assert.strictEqual(totalXp, 50 + 60 + 75 + 90 + 110 + 140 + 200 + 50 + 60 + 75);
  assert.strictEqual(totalGold, 20 + 30 + 40 + 50 + 70 + 90 + 150 + 20 + 30 + 40);
});

check('T22 save() not called on duplicate/no-user paths', function () {
  const d = { gold: 0, daily_streak: 1, last_claim: D(9, 1) };
  let saves = 0;
  const sys = mkSys(d, { player: null, save: function () { saves++; }, nowISO: function () { return D(9, 1); } });
  sys.claim();
  assert.strictEqual(saves, 0);
});

console.log('\nM9-E Daily: pass=' + pass + ' fail=' + failed);
process.exit(failed ? 1 : 0);
