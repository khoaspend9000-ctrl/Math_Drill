/* M10-A — Browser load integration (static Node verification).
 * Verifies index.html loads exactly the runtime JS modules (32), in correct
 * dependency order, no duplicates, no non-runtime modules
 * (states.js, effects_part1.js, polish.js).
 * Node cannot execute browser globals; browser smoke must be separate (documented).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const WEB = path.join(ROOT, 'web');
const JS = path.join(WEB, 'js');

let pass = 0, fail = 0;
const assert = require('assert');
function check(name, fn) {
  try { fn(); pass++; console.log('PASS ' + name); }
  catch (e) { fail++; console.log('FAIL ' + name + ' :: ' + e.message); }
}

/* ---------- data extraction from REAL project ---------- */
const jsFiles = fs.readdirSync(JS).filter(f => f.endsWith('.js')).sort();
/* Modules deliberately NOT loaded by the browser runtime (documented, not silent).
 *  - effects_part1.js / states.js : superseded legacy (replaced by
 *    effects.js + effects2.js and by states_real.js).
 *  - polish.js : superseded duplicate dashboard/theory draft. The runtime module is
 *    polish_m2.js, which index.html loads and states_real.js hooks (POLISH_M2_HOOK).
 *    Kept on disk as reference; must never be loaded, or the two modules would
 *    double-hook the same prototypes.
 */
const NOT_LOADED = ['effects_part1.js', 'states.js', 'polish.js'];
const production = jsFiles.filter(f => !NOT_LOADED.includes(f));

const idx = fs.readFileSync(path.join(WEB, 'index.html'), 'utf-8');
const scripts = [];
const re = /<script\s+src="([^"]+)"/g;
let m;
while ((m = re.exec(idx)) !== null) scripts.push(m[1]);
const scriptBasenames = scripts.map(s => s.replace(/^js\//, ''));

/* expected load order: dependency graph from B1 audit */
const EXPECTED_ORDER = [
  'logger.js', 'errors.js',
  'engine.js', 'input.js', 'renderer.js', 'assets.js', 'audio.js',
  'performance.js',
  'effects.js', 'effects2.js',
  'save.js', 'player.js', 'auth.js',
  'data_loader.js', 'mt19937.js', 'question_generator.js', 'smart_ai.js',
  'adaptive_ai.js',
  'game_manager.js', 'theory_pages.js', 'ui.js',
  'shop.js', 'pet.js', 'skin.js', 'gacha.js', 'achievements.js', 'daily.js',
  'skill_tree.js', 'item_effects.js',
  'state_manager.js', 'polish_m2.js', 'states_real.js', 'settings_states.js', 'main.js'
];

/* ---------- tests ---------- */
check('T01 runtime JS inventory (34 modules, no non-runtime)', () => {
  assert.strictEqual(production.length, 34,
    'expected 34 runtime modules, got ' + production.length + ': ' + production.join(','));
  for (const lg of NOT_LOADED) {
    assert.ok(!production.includes(lg), 'non-runtime ' + lg + ' must be excluded');
  }
});

check('T02 index.html script inventory (34 scripts)', () => {
  assert.strictEqual(scripts.length, 34, 'index.html must load 34 scripts, got ' + scripts.length);
  for (const s of scripts) {
    assert.ok(/^js\//.test(s), 'script src must be under js/: ' + s);
    const p = path.join(WEB, s);
    assert.ok(fs.existsSync(p), 'script file missing: ' + s);
  }
});

check('T03 no duplicate script tags', () => {
  const seen = new Set();
  for (const s of scriptBasenames) {
    assert.ok(!seen.has(s), 'duplicate script: ' + s);
    seen.add(s);
  }
});

check('T04 dependency order (exact EXPECTED_ORDER match)', () => {
  assert.deepStrictEqual(scriptBasenames, EXPECTED_ORDER,
    'load order mismatch:\n got: ' + scriptBasenames.join(',') +
    '\nwant: ' + EXPECTED_ORDER.join(','));
});

check('T05 critical ordering pairs (B1 dependency rules)', () => {
  const pos = name => scriptBasenames.indexOf(name);
  const pairs = [
    ['performance.js', 'effects.js'],       // effects.js must win global.particleBudget
    ['effects.js', 'effects2.js'],          // particleBudget singleton first
    ['save.js', 'player.js'],
    ['player.js', 'auth.js'],
    ['mt19937.js', 'question_generator.js'],
    ['question_generator.js', 'smart_ai.js'],
    ['smart_ai.js', 'adaptive_ai.js'],
    ['player.js', 'game_manager.js'],
    ['game_manager.js', 'ui.js'],
    ['player.js', 'shop.js'],
    ['player.js', 'pet.js'],
    ['player.js', 'skin.js'],
    ['mt19937.js', 'gacha.js'],
    ['player.js', 'gacha.js'],
    ['player.js', 'achievements.js'],
    ['player.js', 'daily.js'],
    ['player.js', 'skill_tree.js'],
    ['player.js', 'item_effects.js'],
    ['ui.js', 'states_real.js'],
    ['state_manager.js', 'states_real.js'],
    ['states_real.js', 'main.js'],
  ];
  for (const [before, after] of pairs) {
    assert.ok(pos(before) >= 0 && pos(after) >= 0 && pos(before) < pos(after),
      before + ' must load before ' + after);
  }
});

check('T06 no legacy module accidentally loaded', () => {
  for (const s of scriptBasenames) {
    assert.ok(!NOT_LOADED.includes(s), 'legacy module must not be loaded: ' + s);
  }
});


check('T07 every production module is loaded', () => {
  const missing = production.filter(f => !scriptBasenames.includes(f));
  assert.deepStrictEqual(missing, [], 'unloaded production modules: ' + missing.join(','));
});

check('T08 M9 systems expose browser globals (static scan)', () => {
  const expectGlobals = {
    'shop.js': 'ShopSystem', 'pet.js': 'PetSystem', 'skin.js': 'SkinSystem',
    'gacha.js': 'GachaSystem', 'achievements.js': 'AchievementSys',
    'daily.js': 'Daily', 'skill_tree.js': 'SkillTreeSystem',
    'item_effects.js': 'ItemEffectSystem', 'game_manager.js': 'GameManager',
    'data_loader.js': 'DataLoader', 'question_generator.js': 'QuestionGenerator',
    'smart_ai.js': 'SmartAI', 'adaptive_ai.js': 'AdaptiveAI',
    'performance.js': 'SurfaceCache',
  };
  for (const [file, g] of Object.entries(expectGlobals)) {
    const src = fs.readFileSync(path.join(JS, file), 'utf-8');
    const pat = new RegExp('(?:global|window)\\.' + g + '\\s*=');
    assert.ok(pat.test(src), file + ' must export global ' + g);
  }
});

check('T09 M9 modules are CommonJS-safe (no top-level fs/path crash)', () => {
  for (const f of ['shop.js', 'skill_tree.js', 'skin.js', 'gacha.js',
    'achievements.js', 'daily.js', 'pet.js', 'item_effects.js', 'data_loader.js']) {
    const src = fs.readFileSync(path.join(JS, f), 'utf-8');
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/require\(\s*['"](fs|path)['"]\s*\)/.test(line)) {
        const indent = line.match(/^\s*/)[0].length;
        assert.ok(indent > 0, f + ':' + (i + 1) + ' top-level require(fs/path) would crash browser');
      }
    }
  }
});

check('T10 effects/effects2 contract (TransitionEffect reachable in browser)', () => {
  const e2 = fs.readFileSync(path.join(JS, 'effects2.js'), 'utf-8');
  assert.ok(/global\.TransitionEffect\s*=/.test(e2), 'effects2 must set global.TransitionEffect');
  assert.ok(/global\.answerEffects\s*=/.test(e2), 'effects2 must set global.answerEffects');
  assert.ok(/global\.comboPopupManager\s*=/.test(e2), 'effects2 must set global.comboPopupManager');
  const e1 = fs.readFileSync(path.join(JS, 'effects.js'), 'utf-8');
  assert.ok(/global\.particleBudget\s*=/.test(e1), 'effects must set global.particleBudget');
});

check('T11 audio contract (SoundManager + unlock)', () => {
  const a = fs.readFileSync(path.join(JS, 'audio.js'), 'utf-8');
  assert.ok(/global\.SoundManager\s*=/.test(a) || /window\.SoundManager\s*=/.test(a),
    'audio must expose SoundManager global');
  assert.ok(/attachUnlock/.test(a), 'audio must provide attachUnlock (gesture policy)');
});

check('T12 question stack contract (QuestionGenerator + SmartAI + AdaptiveAI)', () => {
  for (const [f, g] of [['question_generator.js', 'QuestionGenerator'],
  ['smart_ai.js', 'SmartAI'], ['adaptive_ai.js', 'AdaptiveAI'], ['mt19937.js', 'MT19937']]) {
    const src = fs.readFileSync(path.join(JS, f), 'utf-8');
    assert.ok(new RegExp('(?:global|window)\\.' + g + '\\s*=').test(src),
      f + ' must export global ' + g);
  }
});

check('T13 data_loader paths (fetches web/data/*.json)', () => {
  const d = fs.readFileSync(path.join(JS, 'data_loader.js'), 'utf-8');
  assert.ok(/data\//.test(d), 'data_loader must reference data/ JSON paths');
});

check('T14 index.html references real style.css + canvas #game', () => {
  assert.ok(/href="style\.css"/.test(idx), 'style.css link');
  assert.ok(/id="game"/.test(idx), 'canvas #game present');
  assert.ok(/id="hud"/.test(idx), 'hud div present');
});

check('T15 main.js boots with all required globals available', () => {
  const src = fs.readFileSync(path.join(JS, 'main.js'), 'utf-8');
  const needed = ['GameLogger', 'GameEngine', 'InputManager', 'GameRenderer',
    'AssetManager', 'SoundManager', 'StateManager', 'GameErrors',
    'LoadingState', 'LoginState', 'MenuState', 'LessonSelectState',
    'LessonState', 'VictoryState', 'DefeatState'];
  for (const g of needed) {
    assert.ok(src.includes('window.' + g), 'main.js must reference window.' + g);
  }
});

check('T16 no console.error suppression in integration scripts', () => {
  for (const s of scriptBasenames) {
    const src = fs.readFileSync(path.join(JS, s), 'utf-8');
    assert.ok(!/console\.error\s*=\s*function/.test(src),
      s + ' must not override console.error');
  }
});

console.log('');
console.log('M10-A browser load: pass=' + pass + ' fail=' + fail);
process.exit(fail === 0 ? 0 : 1);
