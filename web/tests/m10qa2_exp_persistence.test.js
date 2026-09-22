'use strict';
/* M10-QA2 REGRESSION — XP SURVIVES LOGIN / RELOAD.

   Defect found by the M10-QA2 deep browser run (25 lessons / 250 real clicks):
     FAIL[scoreFails] XP persisted across reload (4020 -> 0)

   Root cause (web layer only — Python untouched):
     auth.data() (account blob) stores experience under `xp`
       - defaultUserData(): { grade, xp, level, gold, ... }
       - menu/victory/defeat persist: d.xp = G.player.exp
       - server user_store.js + database.js normalise { grade, level, xp }
     PlayerData (player.py port) reads/writes `exp`
       - getSaveData(): { level, exp, gold, ... }
       - loadSaveData(): if (d.exp !== undefined) this.exp = d.exp
     LoginState._onLogin() fed the ACCOUNT blob straight into
     pd.loadSaveData(), so `d.exp` was undefined and every login reset
     experience to 0 (gold survived because that key matches).

   Fix: states_real.js accountToPlayerSave() maps account `xp` -> `exp`.
   These tests drive the REAL LoginState._onLogin() in a browser-ish vm
   realm, so they fail if the mapping or the pull-before-build ordering
   regresses. */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var WEB = path.join(__dirname, '..');
var JS = path.join(WEB, 'js');

var pass = 0, failed = 0;
/* checks are QUEUED and run strictly one at a time: each login temporarily
   overrides Game.states.change, so concurrent logins would clobber each
   other's capture. */
var queue = [];
function check(name, fn) { queue.push({ name: name, fn: fn }); }
async function runAll() {
  for (var i = 0; i < queue.length; i++) {
    try {
      await queue[i].fn();
      pass++;
      console.log('PASS  ' + queue[i].name);
    } catch (e) {
      failed++;
      console.log('FAIL  ' + queue[i].name + ' :: ' + (e && e.message));
    }
  }
  console.log('');
  console.log('M10QA2_EXP_PERSISTENCE: pass=' + pass + ' fail=' + failed);
  process.exit(failed ? 1 : 0);
}

function fakeEl() {
  return {
    style: {}, width: 1300, height: 800, nodeType: 1, className: '', id: 'game',
    addEventListener: function () {}, removeEventListener: function () {},
    getContext: function () { return {}; },
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 1300, height: 800 }; },
    setAttribute: function () {}, appendChild: function () {}, focus: function () {}
  };
}
function makeDocument() {
  return {
    readyState: 'complete',
    addEventListener: function () {}, removeEventListener: function () {},
    getElementById: function () { return fakeEl(); },
    createElement: function () { return fakeEl(); },
    querySelector: function () { return null; },
    body: { appendChild: function () {} }
  };
}

function makeRealm() {
  var ctx = {};
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.console = console;
  ctx.setTimeout = setTimeout;
  ctx.clearTimeout = clearTimeout;
  ctx.Promise = Promise;
  ctx.fetch = function (url) {
    return new Promise(function (res, rej) {
      try {
        var raw = fs.readFileSync(path.join(WEB, url), 'utf8');
        res({ json: function () { return Promise.resolve(JSON.parse(raw)); } });
      } catch (e) { rej(e); }
    });
  };
  ctx.document = makeDocument();
  ctx.performance = { now: function () { return Date.now(); } };
  ctx.localStorage = {
    _d: {},
    getItem: function (k) { return this._d[k] === undefined ? null : this._d[k]; },
    setItem: function (k, v) { this._d[k] = String(v); },
    removeItem: function (k) { delete this._d[k]; }
  };
  vm.createContext(ctx);
  function stub(n, o) { ctx[n] = o; }

  stub('GameErrors', { install: function () {}, showFatal: function () {} });
  stub('BaseState', function (n) { this.name = n; });
  ['enter', 'exit', 'handleInput', 'update', 'draw'].forEach(function (m) {
    ctx.BaseState.prototype[m] = function () {};
  });
  stub('TransitionEffect', function () { this.active = false; });
  ctx.TransitionEffect.prototype.start = function () {};
  stub('UI', {
    RealisticBook: function (pages) { this.pages = pages || []; this.animating = false; },
    makeTheoryPageApi: function () { return {}; }
  });
  stub('ShopSystem', function () {});
  ctx.ShopSystem.prototype.filter = function () { return []; };
  ['isOwned', 'ownsPet', 'ownsSkin'].forEach(function (m) { ctx.ShopSystem.prototype[m] = function () { return false; }; });
  ['purchasePet', 'purchaseSkin', 'equipSkin'].forEach(function (m) { ctx.ShopSystem.prototype[m] = function () { return { ok: true }; }; });
  ctx.ShopSystem.prototype.changePetType = function () { return true; };
  ctx.ShopSystem.prototype.getCurrentPet = function () { return { type: '' }; };
  stub('PetSystem', function () { this.petTypes = {}; });
  stub('SkinSystem', function () { this.skinTypes = {}; });
  stub('GachaSystem', function () { this.data = { inventory: [], gacha_state: {} }; });
  ctx.GachaSystem.prototype.roll = function () { return { card: {}, rarity: 'common', isNew: true }; };
  ctx.GachaSystem.prototype.getPityInfo = function () { return {}; };
  stub('AchievementSystem', function () {});
  ctx.AchievementSystem.prototype.getDefinitions = function () { return {}; };
  stub('DailyRewardSystem', function () {});
  ctx.DailyRewardSystem.prototype.getStatus = function () { return { streak: 0, today: 1, claimedToday: false }; };
  stub('SkillTreeSystem', function () {});
  ctx.SkillTreeSystem.prototype.getSkillsByCategory = function () { return {}; };
  stub('SkillManager', function () {});
  ctx.SkillManager.prototype.getSkillLevels = function () { return {}; };
  stub('ShopApi', { loadPetTypes: function () { return Promise.resolve({}); } });
  stub('AchievementSys', { getAchievementSystem: function () { return null; } });
  stub('Save', {
    load: function () { return null; },
    save: function () { return true; },
    persist: function () { return Promise.resolve(); },
    KEYS: { PLAYER: 'p', ACCOUNTS: 'a', SESSION: 's' }
  });
  stub('AccountSystem', function () { this.currentUser = null; this.accounts = {}; });
  ctx.AccountSystem.prototype.data = function () { return {}; };
  ctx.AccountSystem.prototype.save = function () {};
  ctx.AccountSystem.prototype.pushPlayerData = function () { return Promise.resolve(false); };
  stub('SoundManager', function () { this.attachUnlock = function () {}; });
  stub('AssetManager', function () {});
  stub('InputManager', function () { this.setLogicalSize = function () {}; });
  stub('GameRenderer', function () {});
  stub('GameEngine', function () { this.WIDTH = 1300; this.HEIGHT = 800; this.dpr = 1; this.ctx = {}; });
  ctx.GameEngine.prototype.setTick = function () {};
  ctx.GameEngine.prototype.start = function () {};
  ctx.require = function (p) {
    if (p === 'fs') return require('fs');
    if (p === 'path') return require('path');
    return {};
  };
  ctx.__dirname = JS;
  ctx.__filename = path.join(JS, 'index.html');

  ['logger.js', 'data_loader.js', 'mt19937.js', 'question_generator.js',
   'adaptive_ai.js', 'player.js', 'game_manager.js', 'theory_pages.js',
   'state_manager.js', 'states_real.js', 'main.js'].forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(JS, f), 'utf8'), ctx,
      { filename: path.join(JS, f) });
  });
  return ctx;
}

var Realm = makeRealm();

/* fake AccountSystem exposing EXACTLY the M10-B backend-mode surface */
function fakeAuth(blob) {
  return {
    currentUser: null,
    pullCalls: 0,
    login: function (u) { this.currentUser = String(u).trim(); return Promise.resolve({ ok: true }); },
    pullPlayerData: function () { this.pullCalls++; return Promise.resolve(blob); },
    data: function () { return blob; },
    save: function () {},
    logout: function () {}
  };
}

function loginWith(blob) {
  /* fresh player so a leftover snapshot cannot mask a regression */
  Realm.Game.player = new Realm.PlayerData();
  var auth = fakeAuth(blob);
  Realm.Game.auth = auth;
  var target = null;
  var origChange = Realm.Game.states.change;
  Realm.Game.states.change = function (n) { target = n; };
  var st = new Realm.LoginState();
  st.enter(null);
  st.userInput = 'qaexp';
  st.passInput = 'DeepQa123!';
  st._onLogin();
  return new Promise(function (resolve, reject) {
    var t0 = Date.now();
    var tick = setInterval(function () {
      if (target !== null || Date.now() - t0 > 3000) {
        clearInterval(tick);
        Realm.Game.states.change = origChange;
        try {
          assert.strictEqual(target, 'menu', 'login must reach menu (got ' + target + ')');
          resolve({ player: Realm.Game.player, auth: auth });
        } catch (e) { reject(e); }
      }
    }, 10);
  });
}

/* ---------- the defect itself ---------- */
check('M10QA2-EXP-T01 account blob {xp:4020} logs in with player.exp === 4020', function () {
  return loginWith({ xp: 4020, level: 5, gold: 490, grade: 2 }).then(function (r) {
    assert.strictEqual(r.player.exp, 4020, 'exp lost on login (xp/exp key mismatch)');
  });
});

check('M10QA2-EXP-T02 level/gold/grade survive login unchanged', function () {
  return loginWith({ xp: 4020, level: 5, gold: 490, grade: 2 }).then(function (r) {
    var p = r.player;
    assert.strictEqual(p.level, 5, 'level');
    assert.strictEqual(p.gold, 490, 'gold');
    assert.strictEqual(p.grade, 2, 'grade');
    assert.strictEqual(p.username, 'qaexp', 'username');
    assert.strictEqual(p.expToNextLevel, Realm.getRequiredExp(5), 'expToNextLevel for level 5');
  });
});

check('M10QA2-EXP-T03 account xp wins over a stale exp key (authoritative key)', function () {
  return loginWith({ xp: 3100, exp: 7, level: 4, gold: 12, grade: 1 }).then(function (r) {
    assert.strictEqual(r.player.exp, 3100, 'account xp is the persisted value');
  });
});

check('M10QA2-EXP-T04 legacy exp-only blob still honoured (backward compat)', function () {
  return loginWith({ exp: 777, level: 3, gold: 5, grade: 1 }).then(function (r) {
    assert.strictEqual(r.player.exp, 777, 'exp-only blob must not be dropped');
  });
});

check('M10QA2-EXP-T05 fresh account (xp:0) logs in at exp 0 without NaN', function () {
  return loginWith({ grade: 1, xp: 0, level: 1, gold: 0 }).then(function (r) {
    assert.strictEqual(r.player.exp, 0, 'fresh exp is 0');
    assert.ok(Number.isFinite(r.player.expToNextLevel), 'expToNextLevel must be finite');
  });
});

check('M10QA2-EXP-T06 server blob is pulled BEFORE the snapshot is built', function () {
  var blob = { xp: 0, level: 1, gold: 0, grade: 1 };
  var auth = fakeAuth(blob);
  auth.pullPlayerData = function () {
    auth.pullCalls++;
    return new Promise(function (res) {
      setTimeout(function () { blob.xp = 3100; blob.gold = 250; blob.level = 4; res(blob); }, 25);
    });
  };
  Realm.Game.player = new Realm.PlayerData();
  Realm.Game.auth = auth;
  var target = null;
  var origChange = Realm.Game.states.change;
  Realm.Game.states.change = function (n) { target = n; };
  var st = new Realm.LoginState();
  st.enter(null);
  st.userInput = 'qaexp';
  st.passInput = 'DeepQa123!';
  st._onLogin();
  return new Promise(function (resolve, reject) {
    var t0 = Date.now();
    var tick = setInterval(function () {
      if (target !== null || Date.now() - t0 > 3000) {
        clearInterval(tick);
        Realm.Game.states.change = origChange;
        try {
          assert.strictEqual(auth.pullCalls, 1, 'pullPlayerData must be awaited once');
          assert.strictEqual(Realm.Game.player.exp, 3100, 'late server blob must reach the player');
          assert.strictEqual(Realm.Game.player.gold, 250, 'late server gold must reach the player');
          resolve();
        } catch (e) { reject(e); }
      }
    }, 10);
  });
});

check('M10QA2-EXP-T07 round-trip: getSaveData() carries exp for the next login', function () {
  return loginWith({ xp: 4020, level: 5, gold: 490, grade: 2 }).then(function (r) {
    var snap = r.player.getSaveData();
    assert.strictEqual(snap.exp, 4020, 'player snapshot exposes exp');
    var p2 = new Realm.PlayerData();
    p2.loadSaveData(snap);
    assert.strictEqual(p2.exp, 4020, 'player snapshot reloads exp');
  });
});

runAll();





