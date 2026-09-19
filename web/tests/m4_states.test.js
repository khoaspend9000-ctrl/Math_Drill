'use strict';

// =========================================================
// M4 Real Game States â€” test harness (Node thuáº§n, khĂ´ng framework)
// Cháº¡y: node web/tests/m4_states.test.js  â†’ exit 0 = pass, 1 = fail
// =========================================================

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const webRoot = path.join(__dirname, '..');
const webJs = path.join(webRoot, 'js');

let failed = 0;
let registered = 0;
let completed = 0;
let phaseComplete = false; // true khi má»i check() Ä‘Ă£ Ä‘Äƒng kĂ½ xong (cuá»‘i file)
let summarized = false;

function pass(name) { console.log('PASS  ' + name); }
function fail(name, err) {
  failed += 1;
  console.error('FAIL  ' + name);
  console.error('      ' + (err && err.stack ? err.stack : err));
}
function summarize() {
  if (summarized) return;
  summarized = true;
  if (failed) {
    console.error('\n' + failed + ' test(s) failed');
    process.exit(1);
  }
  console.log('\nAll M4 real game states tests passed. (' + completed + '/' + registered + ' checks)');
}

function done() {
  completed += 1;
  if (phaseComplete && completed === registered) summarize();
}

// check() há»— trá»£ cáº£ fn Ä‘á»“ng bá»™ láº«n fn tráº£ Promise (async test).
// LÆ°u Ă½: cĂ¡c test async tiáº¿p tá»¥c cháº¡y SAU khi má»i test Ä‘á»“ng bá»™ Ä‘Ă£ xong,
// nĂªn pháº£i tá»± re-point global.Game trÆ°á»›c khi mĂ´ phá»ng frame.
function check(name, fn) {
  registered += 1;
  let result;
  try {
    result = fn();
  } catch (err) {
    fail(name, err);
    return done();
  }
  if (result && typeof result.then === 'function') {
    result.then(function () { pass(name); done(); },
      function (err) { fail(name, err); done(); });
  } else {
    pass(name);
    done();
  }
}

// ---------- stubs ----------
function makeContextStub() {
  return {
    save() {}, restore() {}, setTransform() {}, getTransform() { return 1; },
    fillRect() {}, beginPath() {}, moveTo() {}, arcTo() {}, closePath() {},
    arc() {}, fill() {}, stroke() {}, fillText() {}, drawImage() {},
    imageSmoothingEnabled: true, globalAlpha: 1,
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '',
    textAlign: '', textBaseline: '', shadowColor: '', shadowBlur: 0,
    canvas: { width: 1300, height: 800 }
  };
}

class FakeInput {
  constructor() { this.clicks = []; this.keys = []; }
  click(x, y) { this.clicks.push({ x: x, y: y, button: 0, time: Date.now() }); }
  key(key) { this.keys.push({ key: key, code: key, time: Date.now(), repeat: false }); }
  consumeClick() { return this.clicks.length ? this.clicks.shift() : null; }
  consumePressedKey() { return this.keys.length ? this.keys.shift() : null; }
  getPointerPosition() { return { x: 0, y: 0, down: false, inside: true, buttons: 0 }; }
  isDown() { return false; }
  get keyFlash() { return 0; }
  set keyFlash(v) {}
}

function makeGame() {
  const Renderer = require('../js/renderer.js');
  global.Game = {
    engine: { WIDTH: 1300, HEIGHT: 800, fps: 60, dpr: 1 },
    renderer: new Renderer(makeContextStub(), 1300, 800),
    assets: {
      loadFonts: function () { return Promise.resolve({ quicksand: false, emoji: false }); },
      preload: function () { return Promise.resolve({ total: 0, loaded: 0, failed: 0 }); },
      get: function () { return null; },
      failed: new Map(),
      fonts: {}
    },
    audio: {
      loadSfx: function () { return Promise.resolve(null); },
      playSfx: function () { return false; },
      playBgm: function () { return false; },
      unlock: function () { return Promise.resolve(true); },
      attachUnlock: function () {}
    },
    questionGen: null, // M6
    dataLoader: null,  // Phase 2/M7
    profile: null,
    states: null
  };
  return global.Game;
}

// ---------- setup ----------
require('../js/effects.js');        // TransitionEffect cho StateManager
require('../js/save.js');           // M5: Save (memory store trong Node)
require('../js/player.js');         // M5: PlayerData tháº­t
const sm = require('../js/state_manager.js');
const statesReal = require('../js/states_real.js');
const LoadingState = statesReal.LoadingState;
const LoginState = statesReal.LoginState;
const MenuState = statesReal.MenuState;
const TheoryState = statesReal.TheoryState;
const LessonSelectState = statesReal.LessonSelectState;
const LessonState = statesReal.LessonState;
const VictoryState = statesReal.VictoryState;
const DefeatState = statesReal.DefeatState;

const ALL_STATES = [LoadingState, LoginState, MenuState, LessonSelectState, TheoryState,
  LessonState, VictoryState, DefeatState];

function registerAll(manager) {
  manager.register('loading', new LoadingState());
  manager.register('login', new LoginState());
  manager.register('menu', new MenuState());
  manager.register('lesson_select', new LessonSelectState());
 manager.register('theory', new TheoryState());
  manager.register('lesson', new LessonState());
  manager.register('victory', new VictoryState());
  manager.register('defeat', new DefeatState());
}

function tick(manager, times, dt) {
  dt = dt || 0.033;
  for (let i = 0; i < times; i++) manager.update(dt);
}

// ---------- tests ----------

check('M4: states_real.js syntax há»£p lá»‡ + export Ä‘á»§ 7 class', function () {
  const src = fs.readFileSync(path.join(webJs, 'states_real.js'), 'utf8');
  new vm.Script(src, { filename: 'states_real.js' });
  ALL_STATES.forEach(function (C) {
    assert.strictEqual(typeof C, 'function', C && C.name);
  });
});

check('M4: 7 state káº¿ thá»«a BaseState + Ä‘á»§ enter/exit/handleInput/update/draw', function () {
  const BaseState = sm.BaseState;
  ALL_STATES.forEach(function (C) {
    assert.ok(C.prototype instanceof BaseState, C.name + ' pháº£i extends BaseState');
    ['enter', 'exit', 'handleInput', 'update', 'draw'].forEach(function (m) {
      assert.strictEqual(typeof C.prototype[m], 'function', C.name + '#' + m);
    });
  });
});

check('M4 flow: loading -> login (assets ready + minTime)', async function () {
  makeGame();
  const manager = new sm.StateManager();
  registerAll(manager);
  global.Game.states = manager;
  manager.change('loading');
  assert.strictEqual(manager.currentName, 'loading');
  // Yield event-loop: preload lĂ  Promise (browser cháº¡y frame async, Node
  // tick Ä‘á»“ng bá»™ nĂªn pháº£i flush microtask trÆ°á»›c khi mĂ´ phá»ng cĂ¡c frame)
  await new Promise(function (resolve) { setImmediate(resolve); });
  // CĂ¡c test Ä‘á»“ng bá»™ khĂ¡c Ä‘Ă£ cháº¡y xong vĂ  ghi Ä‘Ă¨ global.Game â€” re-point
  // vá» manager cá»§a test nĂ y (báº¯t chÆ°á»›c viá»‡c browser chá»‰ cĂ³ 1 Game duy nháº¥t)
  global.Game.states = manager;
  global.Game.player = null;
  tick(manager, 140, 0.033); // ~4.6s > minTime 1.2s + fade 0.5s
  assert.strictEqual(manager.currentName, 'login');
});

check('M4 flow: login (stub auth) -> menu + táº¡o profile', function () {
  makeGame();
  const manager = new sm.StateManager();
  registerAll(manager);
  global.Game.states = manager;
  manager.change('login');
  const input = new FakeInput();
  input.key('a'); input.key('b'); input.key('c'); // gĂµ username "abc"
  manager.current.handleInput(input, 0.016);
  manager.current.handleInput(input, 0.016);
  manager.current.handleInput(input, 0.016);
  input.key('Tab'); // chuyá»ƒn sang field password
  manager.current.handleInput(input, 0.016);
  input.key('x'); input.key('y');
  manager.current.handleInput(input, 0.016);
  manager.current.handleInput(input, 0.016);
  // click nĂºt ÄÄƒng Nháº­p (450,580,400,60) â†’ tĂ¢m (650,610)
  input.click(650, 610);
  manager.current.handleInput(input, 0.016);
  tick(manager, 20, 0.03);
  assert.strictEqual(manager.currentName, 'menu');
  assert.ok(global.Game.player, 'player (PlayerData tháº­t) pháº£i Ä‘Æ°á»£c táº¡o');
  assert.strictEqual(global.Game.player.username, 'abc');
  assert.strictEqual(global.Game.player.grade, 1);
  assert.strictEqual(global.Game.player.level, 1);
  assert.strictEqual(typeof global.Game.player.addExp, 'function', 'pháº£i lĂ  PlayerData tháº­t');
});

check('M4 flow: login thiáº¿u thĂ´ng tin -> hiá»‡n lá»—i, KHĂ”NG chuyá»ƒn state', function () {
  makeGame();
  const manager = new sm.StateManager();
  registerAll(manager);
  global.Game.states = manager;
  manager.change('login');
  const input = new FakeInput();
  input.click(650, 610); // Ä‘Äƒng nháº­p khi chÆ°a nháº­p gĂ¬
  manager.current.handleInput(input, 0.016);
  tick(manager, 20, 0.03);
  assert.strictEqual(manager.currentName, 'login');
  assert.ok(manager.current.errorTimer > 0, 'errorTimer > 0');
});

check('M4 flow: menu card "BĂ i Há»c" -> lesson_select; card khĂ³a -> thĂ´ng bĂ¡o', function () {
  makeGame();
  const manager = new sm.StateManager();
  registerAll(manager);
  global.Game.states = manager;
  manager.change('menu');
  const input = new FakeInput();
  // card Time Attack bá»‹ khĂ³a (M7) â†’ msg, váº«n á»Ÿ menu
  input.click(680 + 240 + 25 + 120, 155 + 45);
  manager.current.handleInput(input, 0.016);
  assert.strictEqual(manager.currentName, 'menu');
  assert.ok(manager.current.examMsgTimer > 0, 'hiá»‡n thĂ´ng bĂ¡o khĂ³a');
  // card BĂ i Há»c (680,155,240,90) â†’ lesson_select
  input.click(680 + 120, 155 + 45);
  manager.current.handleInput(input, 0.016);
  tick(manager, 20, 0.03);
  assert.strictEqual(manager.currentName, 'lesson_select');
});

check('M4: lesson_select khĂ´ng cĂ³ dataLoader -> panel chá» + back vá» menu', function () {
  makeGame();
  const manager = new sm.StateManager();
  registerAll(manager);
  global.Game.states = manager;
  manager.change('lesson_select', { grade: 3 });
  const ls = manager.current;
  assert.strictEqual(ls.dataMissing, true, 'dataMissing khi chÆ°a cĂ³ dataLoader');
  assert.strictEqual(ls.lessons.length, 0, 'KHĂ”NG hard-code lesson');
  ls.draw(global.Game.renderer.ctx, 1300, 800); // khĂ´ng crash
  const input = new FakeInput();
  input.click(80 + 75, 650 + 25); // nĂºt back
  manager.current.handleInput(input, 0.016);
  tick(manager, 20, 0.03);
  assert.strictEqual(manager.currentName, 'menu');
});

check('M4: lesson_select CĂ“ dataLoader -> grid + click bĂ i unlock -> lesson', function () {
  makeGame();
  global.Game.dataLoader = {
    getLessonsForGrade: function () {
      const out = [];
      for (let i = 1; i <= 10; i++) out.push('BĂ i ' + i);
      return out;
    }
  };
  const manager = new sm.StateManager();
  registerAll(manager);
  global.Game.states = manager;
  manager.change('lesson_select', { grade: 1 });
  const ls = manager.current;
  assert.strictEqual(ls.dataMissing, false);
  assert.strictEqual(ls.lessons.length, 10);
  assert.strictEqual(ls.totalPages, 2);
  ls.draw(global.Game.renderer.ctx, 1300, 800); // khĂ´ng crash
  const input = new FakeInput();
  // BĂ i 1 (100,150,480,80) â€” level 1 â†’ unlocked (max = (1-1)//6+1 = 1)
  input.click(100 + 240, 150 + 40);
  manager.current.handleInput(input, 0.016);
  tick(manager, 20, 0.03);
  // Desktop parity (main.py:960): LessonSelect -> TheoryState -> LessonState
  assert.strictEqual(manager.currentName, 'theory');
  assert.strictEqual(manager.current.grade, 1);
  assert.ok(String(manager.current.title).length > 0, 'theory receives lesson title');
  // Theory 'BAT DAU HOC' button (810,300,300,70) -> lesson
  const tin = new FakeInput();
  tin.click(810 + 150, 300 + 35);
  manager.current.handleInput(tin, 0.016);
  tick(manager, 20, 0.03);
  assert.strictEqual(manager.currentName, 'lesson');
  // BĂ i 2 khĂ³a á»Ÿ level 1 â†’ hoĂ n táº¥t fade vá» lesson_select rá»“i má»›i click
  manager.change('lesson_select', { grade: 1 });
  tick(manager, 20, 0.03);
  assert.strictEqual(manager.currentName, 'lesson_select');
  input.click(100 + 240, 150 + 110 + 40); // BĂ i 2 (y=260)
  manager.current.handleInput(input, 0.016);
  tick(manager, 20, 0.03);
  assert.strictEqual(manager.currentName, 'lesson_select', 'bĂ i khĂ³a khĂ´ng má»Ÿ Ä‘Æ°á»£c');
});

check('M4: lesson chÆ°a cĂ³ questionGen -> panel chá», khĂ´ng hard-code cĂ¢u há»i', function () {
  makeGame();
  const manager = new sm.StateManager();
  registerAll(manager);
  global.Game.states = manager;
  manager.change('lesson', { grade: 1, title: 'BĂ i 1' });
  const lesson = manager.current;
  assert.strictEqual(lesson.missing, true);
  assert.strictEqual(lesson.q, null, 'khĂ´ng cĂ³ cĂ¢u há»i nĂ o Ä‘Æ°á»£c hard-code');
  lesson.draw(global.Game.renderer.ctx, 1300, 800); // khĂ´ng crash
  const input = new FakeInput();
  input.click(20 + 100, 720 + 30); // nĂºt back (20,720,200,60)
  manager.current.handleInput(input, 0.016);
  tick(manager, 20, 0.03);
  assert.strictEqual(manager.currentName, 'menu');
});

// Fake question service â€” mĂ´ phá»ng interface M6 (chá»‰ trong TEST)
function makeFakeQuestionGen(seedStart) {
  let seed = seedStart;
  return {
    generate: function (grade, title, difficulty, user) {
      const a = seed % 8 + 1;
      const b = seed % 6 + 1;
      seed += 1;
      const ans = a + b;
      return {
        question: a + ' + ' + b + ' = ?',
        answer: String(ans),
        options: [String(ans), String(ans + 1), String(ans + 2), String(ans + 3)],
        op: '+'
      };
    }
  };
}

function answerRounds(manager, input, correctRounds) {
  for (let round = 0; round < 15; round++) {
    const lesson = manager.current;
    assert.strictEqual(manager.currentName, 'lesson', 'váº«n á»Ÿ lesson trong lĂºc chÆ¡i');
    const correctIdx = lesson.opts.indexOf(lesson.ans);
    assert.ok(correctIdx >= 0, 'Ä‘Ă¡p Ă¡n Ä‘Ăºng pháº£i náº±m trong options');
    const pickIdx = round < correctRounds ? correctIdx : (correctIdx === 0 ? 1 : 0);
    const b = lesson.buttons[pickIdx];
    input.click(b.x + b.w / 2, b.y + b.h / 2);
    lesson.handleInput(input, 0.016);
    assert.ok(lesson.feedback && lesson.feedback.active, 'feedback sau khi tráº£ lá»i');
    input.click(650, 300); // báº¥m Ä‘á»ƒ Ä‘Ă³ng feedback â†’ advance
    lesson.handleInput(input, 0.016);
  }
}

check('M4 gameplay flow: 15 cĂ¢u Ä‘Ăºng -> victory (rank S, stats Ä‘Ăºng)', function () {
  makeGame();
  global.Game.questionGen = makeFakeQuestionGen(1);
  const manager = new sm.StateManager();
  registerAll(manager);
  global.Game.states = manager;
  manager.change('lesson', { grade: 1, title: 'BĂ i 1' });
  answerRounds(manager, new FakeInput(), 15);
  tick(manager, 20, 0.03); // hoĂ n táº¥t fade transition
  assert.strictEqual(manager.currentName, 'victory');
  const vic = manager.current;
  assert.strictEqual(vic.stats.correct, 15);
  assert.strictEqual(vic.stats.total, 15);
  assert.strictEqual(vic.rank, 'S');
  assert.strictEqual(vic.xpEarned, 300); // 15 * 20 nhÆ° Python main.py:1096
  vic.update(0.6);
  vic.draw(global.Game.renderer.ctx, 1300, 800); // khĂ´ng crash
});

check('M4 gameplay flow: 4/15 Ä‘Ăºng (26%) -> defeat + wrong_answers ghi nháº­n', function () {
  makeGame();
  global.Game.questionGen = makeFakeQuestionGen(1000);
  const manager = new sm.StateManager();
  registerAll(manager);
  global.Game.states = manager;
  manager.change('lesson', { grade: 2, title: 'BĂ i 3' });
  answerRounds(manager, new FakeInput(), 4);
  tick(manager, 20, 0.03);
  assert.strictEqual(manager.currentName, 'defeat');
  const def = manager.current;
  assert.strictEqual(def.correct, 4);
  assert.strictEqual(def.total, 15);
  assert.strictEqual(def.lessonTitle, 'BĂ i 3');
  def.update(0.6);
  def.draw(global.Game.renderer.ctx, 1300, 800); // khĂ´ng crash
});

check('M4: victory input (TIáº¾P Tá»¤C) -> menu', function () {
  makeGame();
  const manager = new sm.StateManager();
  registerAll(manager);
  global.Game.states = manager;
  manager.change('victory', {
    title: 'HOĂ€N THĂ€NH BĂ€I Há»ŒC!', score: 200, lessonTitle: 'BĂ i 1',
    stats: { correct: 15, total: 15, accuracy: 100, avgTime: 2.4, wrongAnswers: [] }
  });
  const vic = manager.current;
  vic.update(0.6);
  const input = new FakeInput();
  input.click(650, 710); // nĂºt TIáº¾P Tá»¤C (525,680,250,60)
  vic.handleInput(input, 0.016);
  tick(manager, 20, 0.03);
  assert.strictEqual(manager.currentName, 'menu');
});

check('M4: defeat input (LĂ€M Láº I) -> lesson; (Vá»€ MENU) -> menu', function () {
  makeGame();
  global.Game.questionGen = makeFakeQuestionGen(500);
  const manager = new sm.StateManager();
  registerAll(manager);
  global.Game.states = manager;
  manager.change('defeat', {
    title: 'Cá» LĂN NĂ€O!', correct: 4, total: 15, lessonTitle: 'BĂ i 1',
    stats: { correct: 4, total: 15, accuracy: 26, avgTime: 3, wrongAnswers: [] }
  });
  const def = manager.current;
  def.update(0.6);
  const input = new FakeInput();
  input.click(515, 710); // nĂºt LĂ€M Láº I (390,680,250,60)
  def.handleInput(input, 0.016);
  tick(manager, 20, 0.03);
  assert.strictEqual(manager.currentName, 'lesson');
  assert.strictEqual(manager.current.title, 'BĂ i 1');
  // quay láº¡i defeat (hoĂ n táº¥t fade) rá»“i báº¥m Vá»€ MENU
  manager.change('defeat', { correct: 4, total: 15, lessonTitle: 'BĂ i 1', stats: {} });
  tick(manager, 20, 0.03);
  assert.strictEqual(manager.currentName, 'defeat');
  const def2 = manager.current;
  def2.update(0.6);
  input.click(785, 710); // nĂºt Vá»€ MENU (660,680,250,60)
  def2.handleInput(input, 0.016);
  tick(manager, 20, 0.03);
  assert.strictEqual(manager.currentName, 'menu');
});

check('M4: index.html náº¡p states_real.js, bá» states.js demo', function () {
  const html = fs.readFileSync(path.join(webRoot, 'index.html'), 'utf8');
  assert.ok(html.indexOf('js/states_real.js') >= 0, 'pháº£i cĂ³ states_real.js');
  assert.ok(html.indexOf('js/main.js') >= 0, 'pháº£i cĂ³ main.js');
  assert.ok(html.indexOf('js/state_manager.js') >= 0, 'foundation giá»¯ nguyĂªn');
  assert.ok(html.indexOf('"js/states.js"') < 0, 'states.js demo khĂ´ng cĂ²n Ä‘Æ°á»£c náº¡p');
});

check('M4: main.js Ä‘Äƒng kĂ½ Ä‘á»§ 7 state + khai bĂ¡o placeholder M6/M7', function () {
  const main = fs.readFileSync(path.join(webJs, 'main.js'), 'utf8');
  ['loading', 'login', 'menu', 'lesson_select', 'lesson', 'victory', 'defeat'].forEach(function (s) {
    assert.ok(main.indexOf("register('" + s + "'") >= 0, 'main.js pháº£i register ' + s);
  });
  assert.ok(main.indexOf('questionGen') >= 0, 'placeholder questionGen (M6)');
  assert.ok(main.indexOf('dataLoader') >= 0, 'placeholder dataLoader (M7)');
});

// Káº¿t thĂºc pha Ä‘Äƒng kĂ½ check â€” chá» má»i check (ká»ƒ cáº£ async) hoĂ n táº¥t rá»“i
// má»›i in summary (poll an toĂ n vá»›i async dĂ i, Ä‘á»“ng bá»™ pattern vá»›i M5).
phaseComplete = true;
if (completed === registered) {
  summarize();
} else {
  const poll = setInterval(function () {
    if (completed >= registered) {
      clearInterval(poll);
      summarize();
    }
  }, 10);
  setTimeout(function () {
    if (!summarized) {
      console.error('\nHarness timeout: chá»‰ ' + completed + '/' + registered + ' check hoĂ n táº¥t');
      process.exit(2);
    }
  }, 30000);
}



