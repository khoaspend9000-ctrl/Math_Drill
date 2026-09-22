'use strict';
/* =========================================================
   P0 — QUESTION PIPELINE REGRESSION  (MathDrill Web)
   ---------------------------------------------------------
   Locks the invariant chain the P0 bug broke:

     LessonSelect (numeric id) -> TheoryState -> LessonState
       -> main.js questionGen adapter
       -> QuestionGenerator.generate_question(grade, lesson_id, ...)
       -> options -> click handler -> answer evaluation -> rewards

   Bug: LessonSelect forwarded only the lesson TITLE STRING, so
   generate_question() got a non-numeric `lesson_id` and every question
   degraded to "Tính nhanh: <title> - 1 = ?" with correct_answer "NaN"
   (1/10 variety) — unplayable. This drives the REAL runtime scripts
   (states_real.js + the REAL main.js adapter) in a browser-ish vm realm.
   ========================================================= */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var WEB = path.join(__dirname, '..');
var JS = path.join(WEB, 'js');

var pass = 0, failed = 0, pending = [];
function check(name, fn) {
  try {
    var r = fn();
    if (r && typeof r.then === 'function') {
      pending.push(r.then(function () { pass++; console.log('PASS  ' + name); },
                           function (e) { failed++; console.log('FAIL  ' + name + ' :: ' + (e && e.message)); }));
    } else { pass++; console.log('PASS  ' + name); }
  }
  catch (e) { failed++; console.log('FAIL  ' + name + ' :: ' + (e && e.message)); }
}
function settleAll() { return Promise.all(pending.map(function (p) { return p.catch(function () {}); })); }

/* fake DOM node: truthy canvas + no-op listeners */
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
  ctx.Promise = Promise;              // data_loader.js returns real promises
  ctx.fetch = function (url) {        // browser-equivalent JSON fetch from disk
    return new Promise(function (res, rej) {
      try {
        var raw = require('fs').readFileSync(path.join(WEB, url), 'utf8');
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

  /* ---- lightweight stand-ins ONLY for subsystems outside the chain ---- */
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
    load: function () { return null; }, persist: function () { return Promise.resolve(); },
    KEYS: { PLAYER: 'p', ACCOUNTS: 'a', SESSION: 's' }
  });
    stub('AccountSystem', function () { this.currentUser = 'p0u'; this.accounts = {}; });
  ctx.AccountSystem.prototype.data = function () { return { xp: 0, gold: 500 }; };
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
    // data_loader.js reads web/data/math_lessons.json via fs+path; everything
    // else is already pre-loaded in-realm, so keep that path closed.
    if (p === 'fs') return require('fs');
    if (p === 'path') return require('path');
    return {};
  };
  ctx.__dirname = JS;   // data_loader.js resolves web/data/math_lessons.json via __dirname
  ctx.__filename = path.join(JS, 'index.html');


  /* ---- REAL scripts, in index.html dependency order ---- */
  ['logger.js', 'data_loader.js', 'mt19937.js', 'question_generator.js',
   'adaptive_ai.js', 'player.js', 'game_manager.js', 'theory_pages.js',
   'state_manager.js', 'states_real.js', 'main.js'].forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(JS, f), 'utf8'), ctx,
      { filename: path.join(JS, f) });
  });
  return ctx;
}

/* ---------- realm + transition recorder ---------- */
var Realm = makeRealm();
var transitions = [];
var origChange = Realm.Game.states.change;
Realm.Game.states.change = function (name, params, eff) {
  transitions.push({ name: name, params: params });
  return origChange ? origChange.call(Realm.Game.states, name, params, eff) : undefined;
};
Realm.Game.player = new Realm.PlayerData();
Realm.Game.player.username = 'p0u';
Realm.Game.player.grade = 1;
Realm.Game.player.level = 31;   // unlocks first ~6 lessons like a real mid player
Realm.Game.dataLoader = Realm.DataLoader;

var ADAPTER = Realm.Game.questionGen;
check('P0-T01 real main.js adapter is constructed', function () {
  assert.ok(ADAPTER && typeof ADAPTER.generate === 'function', 'Game.questionGen.generate missing');
});

/* ---------- adapter guards (REAL main.js code) ---------- */
check('P0-T02 adapter rejects the old title-string lesson_id (returns null)', function () {
  assert.strictEqual(ADAPTER.generate(1, 'Bài 1', 3, 'p0u'), null);
  assert.strictEqual(ADAPTER.generate(1, 'Bài 1: Cac so 0, 1, 2', 3, 'p0u'), null);
  assert.strictEqual(ADAPTER.generate(1, 0, 3, 'p0u'), null);
  assert.strictEqual(ADAPTER.generate(1, -2, 3, 'p0u'), null);
  assert.strictEqual(ADAPTER.generate(1, null, 3, 'p0u'), null);
});

check('P0-T03 adapter returns real questions with answer in options (grades 1-5)', function () {
  var lessons = { 1: 40, 2: 73, 3: 81, 4: 73, 5: 75 };
  for (var grade = 1; grade <= 5; grade++) {
    var n = lessons[grade];
    [1, Math.floor(n / 2), n].forEach(function (lid) {
      [1, 2, 3].forEach(function (diff) {
        var res = ADAPTER.generate(grade, lid, diff, 'p0u');
        assert.ok(res && res.question, 'null for g=' + grade + ' lid=' + lid);
        assert.ok(Array.isArray(res.options), 'options array g=' + grade + ' lid=' + lid);
        assert.strictEqual(res.options.length, 4, 'option count g=' + grade + ' lid=' + lid);
        assert.ok(res.options.map(String).indexOf(String(res.answer)) >= 0,
          'answer not in options g=' + grade + ' lid=' + lid + ' q=' + res.question);
        assert.ok(String(res.answer).length > 0 && String(res.answer) !== 'NaN' && String(res.answer) !== 'undefined',
          'degenerate answer g=' + grade + ' lid=' + lid);
        assert.ok(!/^Tính nhanh: Bài /.test(String(res.question)),
          'title-string degradation leaked g=' + grade + ' lid=' + lid);
      });
    });
  }
});

/* =========================================================
   REAL state chain: LessonSelect -> Theory -> Lesson
   ========================================================= */
check('P0-T04 LessonSelect loads REAL lessons with parallel numeric ids', function () {
  var LS = new Realm.LessonSelectState();
  LS.enter({ grade: 1 });
  return new Promise(function (resolve, reject) {
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      if (!LS.loading || tries > 200) {
        clearInterval(t);
        try {
          assert.ok(!LS.dataMissing, 'dataMissing (real math_lessons.json failed to load)');
          assert.strictEqual(LS.lessons.length, 40, '40 grade-1 lessons');
          assert.ok(Array.isArray(LS.lessonIds) && LS.lessonIds.length === 40, 'parallel ids');
          for (var i = 0; i < 40; i++) {
            assert.strictEqual(typeof LS.lessonIds[i], 'number', 'id is number at ' + i);
            assert.strictEqual(LS.lessonIds[i], i + 1, 'id matches position at ' + i);
          }
          resolve();
        } catch (e) { reject(e); }
      }
    }, 25);
  });
});
/* click helper: builds one-shot input objects understood by the states */
function p0Input(x, y) {
  var c = { x: x, y: y };
  return {
    consumeClick: function () { var r = c; c = null; return r; },
    consumeWheel: function () { return null; }
  };
}

check('P0-T05 LessonSelect click forwards title AND numeric lessonId to Theory', function () {
  transitions.length = 0;
  var LS = new Realm.LessonSelectState();
  LS.enter({ grade: 1 });
  return new Promise(function (resolve, reject) {
    var t = setInterval(function () {
      if (LS.loading) return;
      clearInterval(t);
      try {
        assert.ok(LS.lessons.length > 0, 'lessons loaded');
        LS.handleInput(p0Input(100 + 240, 150 + 55), 0);   // first lesson button (bx=100,by=150,w=480,h=80)
        var mine = transitions.filter(function (tr) { return tr.name === 'theory' && tr.params && tr.params.lessonId === 1; });
        assert.strictEqual(mine.length, 1, 'exactly one ->theory{lessonId:1}, got ' + JSON.stringify(mine));
        var p = mine[0].params;
        assert.ok(p.title && String(p.title).length > 0, 'title forwarded');
        resolve();
      } catch (e) { reject(e); }
    }, 25);
    setTimeout(function () { clearInterval(t); reject(new Error('T05 timeout')); }, 8000);
  });
});

check('P0-T06 Theory forwards lessonId to Lesson on start', function () {
  transitions.length = 0;
  var TH = new Realm.TheoryState();
  TH.enter({ grade: 1, title: 'Luyen tap Test', lessonId: 3 });
  assert.strictEqual(TH.lessonId, 3, 'theory keeps lessonId');
  TH.handleInput(p0Input(TH.startBtn.x + 10, TH.startBtn.y + 10), 0);
  assert.strictEqual(transitions.length, 1, 'one transition');
  assert.strictEqual(transitions[0].name, 'lesson', '-> lesson');
  assert.strictEqual(transitions[0].params.lessonId, 3,
    'lessonId carried, got ' + JSON.stringify(transitions[0].params.lessonId));
});

check('P0-T07 LessonState generates a REAL question (no NaN degradation)', function () {
  var ST = new Realm.LessonState();
  ST.enter({ grade: 1, title: 'Bài 1', lessonId: 1 });
  assert.ok(!ST.missing, 'service ready, not missing');
  assert.ok(ST.q && String(ST.q).length > 0, 'question text set');
  assert.ok(Array.isArray(ST.opts) && ST.opts.length === 4, '4 rendered options');
  assert.ok(ST.opts.indexOf(String(ST.ans)) >= 0, 'ans is one of opts');
  assert.ok(String(ST.ans) !== 'NaN' && String(ST.ans) !== 'undefined', 'ans degenerate: ' + ST.ans);
  assert.ok(!/^Tính nhanh: Bài /.test(String(ST.q)), 'degradation question: ' + ST.q);
  assert.ok(Array.isArray(ST.buttons) && ST.buttons.length === 4, '4 clickable buttons');
});

check('P0-T08 correct click rewards, wrong click resets combo (real evaluation)', function () {
  Realm.Game.player.resetCombo();   // isolate from prior tests (combo lives on the shared player)
  var ST = new Realm.LessonState();
  ST.enter({ grade: 1, title: 'Bài 1', lessonId: 1 });
  var right = null, wrong = null;
  for (var i = 0; i < ST.buttons.length; i++) {
    if (String(ST.buttons[i].value) === String(ST.ans)) right = ST.buttons[i];
    else if (!wrong) wrong = ST.buttons[i];
  }
  assert.ok(right, 'found correct button');
  var s0 = ST.gm.score;
  ST._onOptionClick(right);
  assert.ok(ST.gm.correctCount === 1, 'correctCount=1');
  assert.strictEqual(ST.comboStreak, 1, 'combo=1');
  assert.ok(ST.gm.score > s0, 'score increased');
  ST._dismissFeedback();
  var wans = String(ST.ans);
  var wbtn = null;
  for (var j = 0; j < ST.buttons.length; j++) {
    if (String(ST.buttons[j].value) !== wans) { wbtn = ST.buttons[j]; break; }
  }
  assert.ok(wbtn, 'found wrong button');
  ST._onOptionClick(wbtn);
  assert.strictEqual(ST.comboStreak, 0, 'combo reset');
  assert.ok(Array.isArray(ST.wrongAnswers) && ST.wrongAnswers.length === 1, 'wrong logged');
});

check('P0-T09 full 15-question session finishes with victory or defeat (no hang)', function () {
  transitions.length = 0;
  var ST = new Realm.LessonState();
  ST.enter({ grade: 1, title: 'Bài 1', lessonId: 1 });
  var guard = 0;
  while (!ST.missing && guard < 40) {
    guard++;
    var ansNow = String(ST.ans);
    var btn = null;
    for (var k = 0; k < ST.buttons.length; k++) {
      if (String(ST.buttons[k].value) === ansNow && (guard % 2 === 1)) { btn = ST.buttons[k]; break; }
      if (String(ST.buttons[k].value) !== ansNow && (guard % 2 === 0)) { btn = ST.buttons[k]; break; }
    }
    if (!btn) btn = ST.buttons[0];
    ST._onOptionClick(btn);
    ST._dismissFeedback();
    var last = transitions[transitions.length - 1];
    if (last && (last.name === 'victory' || last.name === 'defeat')) break;
  }
  var fin = transitions[transitions.length - 1];
  assert.ok(fin && (fin.name === 'victory' || fin.name === 'defeat'),
    'session ended with victory/defeat, got ' + JSON.stringify(fin && fin.name));
  assert.ok(fin.params && fin.params.lessonId === 1, 'end states carry lessonId');
});

check('P0-T10 question variety in one lesson (not one repeated question)', function () {
  var seen = {};
  for (var i = 0; i < 10; i++) {
    var r = ADAPTER.generate(1, 1, 3, 'p0u');
    seen[r.question] = 1;
  }
  var distinct = Object.keys(seen).length;
  assert.ok(distinct > 1, 'only ' + distinct + ' distinct question in 10 draws');
});

check('P0-T11 Defeat retry carries lessonId back to Lesson', function () {
  transitions.length = 0;
  var D = new Realm.DefeatState();
  D.enter({ grade: 1, title: 'x', correct: 1, total: 15, lessonTitle: 'Bài 2', lessonId: 2, stats: {} });
  D.timer = 10; D.showUi = true;
  D.handleInput(p0Input(D.retryBtn.x + 5, D.retryBtn.y + 5), 0);
  assert.strictEqual(transitions.length, 1, 'one transition');
  assert.strictEqual(transitions[0].name, 'lesson', '-> lesson');
  assert.strictEqual(transitions[0].params.lessonId, 2, 'retry keeps lessonId=2');
});

var _p0Done = 0;
function p0Summary() {
  if (_p0Done++) return;
  settleAll().then(function () {
    console.log('P0_QUESTION_PIPELINE pass=' + pass + ' fail=' + failed);
    process.exit(failed ? 1 : 0);
  }).catch(function () {
    // Swallow unhandled rejections from settleAll(); the individual
    // check FAILs are already recorded in `failed`.
    process.exit(failed ? 1 : 0);
  });
}