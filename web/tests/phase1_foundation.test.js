'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const webJs = path.join(__dirname, '..', 'js');
const files = [
  'logger.js',
  'errors.js',
  'engine.js',
  'input.js',
  'renderer.js',
  'assets.js',
  'audio.js',
  'effects.js',
  'state_manager.js',
  'states.js'
];

let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log('PASS  ' + name);
  } catch (err) {
    failed += 1;
    console.error('FAIL  ' + name);
    console.error('      ' + (err && err.stack ? err.stack : err));
  }
}

check('JavaScript syntax (node --parse via Function/require files exist)', function () {
  files.forEach(function (f) {
    const full = path.join(webJs, f);
    assert.ok(fs.existsSync(full), 'missing ' + f);
    const src = fs.readFileSync(full, 'utf8');
    new vm.Script(src, { filename: f });
  });
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(html.indexOf('id="game"') >= 0);
  assert.ok(html.indexOf('js/state_manager.js') >= 0);
});

const Engine = require('../js/engine.js');
const InputManager = require('../js/input.js');
const Renderer = require('../js/renderer.js');
const AssetManager = require('../js/assets.js');
const SoundManager = require('../js/audio.js');
const TransitionEffect = require('../js/effects.js');
const sm = require('../js/state_manager.js');

check('Engine constants', function () {
  assert.strictEqual(Engine.TARGET_FPS, 60);
  assert.strictEqual(Engine.LOGICAL_WIDTH, 1300);
  assert.strictEqual(Engine.LOGICAL_HEIGHT, 800);
  assert.ok(Engine.MAX_DT <= 1 / 20 + 1e-9);
});

check('Engine uses logical size after DPR (not bitmap size)', function () {
  const ctx = {
    setTransform: function () {},
    imageSmoothingEnabled: true
  };
  const canvas = {
    width: 1300,
    height: 800,
    getContext: function () { return ctx; }
  };
  const engine = new Engine(canvas);
  assert.strictEqual(engine.WIDTH, 1300);
  assert.strictEqual(engine.HEIGHT, 800);
  assert.strictEqual(canvas.width, Math.round(1300 * engine.dpr));
  engine.stop();
});

check('Input clientToCanvas letterbox mapping', function () {
  InputManager._singleton = null;
  const canvas = {
    width: 2600,
    height: 1600,
    style: {},
    addEventListener: function () {},
    getBoundingClientRect: function () {
      return { left: 100, top: 50, width: 650, height: 400 };
    }
  };
  const input = new InputManager(canvas);
  input.setLogicalSize(1300, 800);
  const mid = input.clientToCanvas({ clientX: 100 + 325, clientY: 50 + 200 });
  assert.ok(Math.abs(mid.x - 650) < 0.51);
  assert.ok(Math.abs(mid.y - 400) < 0.51);
  const tl = input.clientToCanvas({ clientX: 100, clientY: 50 });
  assert.strictEqual(tl.x, 0);
  assert.strictEqual(tl.y, 0);
  const br = input.clientToCanvas({ clientX: 100 + 650, clientY: 50 + 400 });
  assert.strictEqual(br.x, 1300);
  assert.strictEqual(br.y, 800);
});

check('Audio ogg-first candidates match Python resolve rule', function () {
  const mp3 = SoundManager.resolveAudioCandidates('nhac_nen.mp3');
  assert.deepStrictEqual(mp3, ['nhac_nen.ogg', 'nhac_nen.mp3']);
  const ogg = SoundManager.resolveAudioCandidates('tra_loi_dung.ogg');
  assert.deepStrictEqual(ogg, ['tra_loi_dung.ogg']);
});

check('Asset placeholder when Image is unavailable', function () {
  const ph = AssetManager.makePlaceholder('clover', 32, 32);
  assert.ok(ph);
  assert.strictEqual(ph.width, 32);
  assert.strictEqual(ph.height, 32);
});

check('TransitionEffect fade midpoint + done at 0.5s', function () {
  const t = new TransitionEffect('fade');
  let mid = 0;
  t.onMidpoint = function () { mid += 1; };
  t.start();
  assert.strictEqual(t.done, false);
  t.update(0.25);
  assert.strictEqual(mid, 1);
  assert.ok(t.active);
  t.update(0.25);
  assert.strictEqual(t.done, true);
  assert.strictEqual(t.active, false);
  assert.strictEqual(t.progress, 1);
});

check('StateManager Loading -> Menu with fade swap at midpoint', function () {
  const manager = new sm.StateManager();
  const log = [];
  manager.register('loading', {
    name: 'loading',
    enter: function () { log.push('loading-enter'); },
    exit: function () { log.push('loading-exit'); },
    update: function () {},
    draw: function () {}
  });
  manager.register('menu', {
    name: 'menu',
    enter: function () { log.push('menu-enter'); },
    exit: function () { log.push('menu-exit'); },
    update: function () {},
    draw: function () {}
  });
  manager.change('loading');
  assert.strictEqual(manager.currentName, 'loading');
  manager.change('menu', null, 'fade');
  assert.strictEqual(manager.currentName, 'loading');
  manager.update(0.25);
  assert.strictEqual(manager.currentName, 'menu');
  manager.update(0.25);
  assert.strictEqual(manager.transition.done, true);
  assert.deepStrictEqual(log, ['loading-enter', 'loading-exit', 'menu-enter']);
});

check('Renderer abstraction has clear/text/round-rect', function () {
  const calls = [];
  const ctx = {
    save: function () { calls.push('save'); },
    restore: function () { calls.push('restore'); },
    getTransform: function () { return 1; },
    setTransform: function () {},
    fillRect: function () { calls.push('fillRect'); },
    beginPath: function () {},
    moveTo: function () {},
    arcTo: function () {},
    closePath: function () {},
    fill: function () { calls.push('fill'); },
    fillText: function (s) { calls.push('text:' + s); }
  };
  const r = new Renderer(ctx, 1300, 800);
  r.clear('#000');
  r.fillRoundRect(0, 0, 10, 10, 2, '#fff');
  r.text('MATHDRILL', 10, 10, { fill: '#fff' });
  assert.ok(calls.indexOf('fillRect') >= 0);
  assert.ok(calls.some(function (c) { return String(c).indexOf('MATHDRILL') >= 0; }));
});

check('Copied foundation assets exist', function () {
  const root = path.join(__dirname, '..');
  [
    'fonts/Quicksand-Bold.ttf',
    'fonts/Segoe UI Emoji.TTF',
    'assets/pixel_clover.png',
    'assets/nen_game.png',
    'audio/tra_loi_dung.ogg'
  ].forEach(function (rel) {
    assert.ok(fs.existsSync(path.join(root, rel)), rel);
  });
});

if (failed) {
  console.error('\n' + failed + ' test(s) failed');
  process.exit(1);
}
console.log('\nAll Phase 1 foundation tests passed.');
