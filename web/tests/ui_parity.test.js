/* =========================================================
   UI_PARITY.test.js — visual/UI parity (structural contracts).
   Compares the ORIGINAL Python/Pygame MathDrill design tokens
   and layout contracts against the Web (states_real.js / ui.js
   / index.html / style.css). Node unit tests validate structure,
   NOT pixel-perfect screenshots (that is browser-domain).
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const src = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const STATES = src('js/states_real.js');
const UIJS = src('js/ui.js');
const INDEX = src('index.html');
const CSS = src('style.css');

let pass = 0, fail = 0;
const failures = [];
function check(name, fn) {
  try { fn(); pass++; console.log('PASS  ' + name); }
  catch (e) { fail++; failures.push(name); console.log('FAIL  ' + name + ' :: ' + (e && e.message)); }
}
function has(hay, needle, label) {
  const h = String(hay).normalize('NFC');
  const n = String(needle).normalize('NFC');
  if (h.indexOf(n) < 0) throw new Error('missing "' + needle + '"' + (label ? ' (' + label + ')' : ''));
}

// ---- T01 logical resolution ----
check('T01 logical resolution = 1300x800 (Engine + states + canvas)', function () {
  const Engine = require('../js/engine.js');
  if (Engine.LOGICAL_WIDTH !== 1300) throw new Error('LOGICAL_WIDTH=' + Engine.LOGICAL_WIDTH);
  if (Engine.LOGICAL_HEIGHT !== 800) throw new Error('LOGICAL_HEIGHT=' + Engine.LOGICAL_HEIGHT);
  has(INDEX, 'id="game" width="1300" height="800"', 'canvas 1300x800');
});

// ---- T02 Login layout contract ----
check('T02 Login layout (MATHDRILL LOGIN + user/pass + Dang Nhap + no debug footer)', function () {
  has(STATES, "class LoginState", 'LoginState');
  has(STATES, "'MATHDRILL LOGIN'", 'title');
  has(STATES, "R.clear('#ffffff')", 'white background (Python background_img/white fallback)');
  has(STATES, "'🔑 Đăng Nhập'", 'login button');
  has(STATES, 'GREEN_BTN', 'login uses original green');
  has(STATES, "'Tên đăng nhập'", 'username placeholder');
  has(STATES, "'Password'", 'password placeholder');
  if (STATES.indexOf('M5 · PlayerData + Save + Auth') >= 0) throw new Error('login debug footer still present');
});

// ---- T03 Register (LoginState toggle) ----
check('T03 Register entry (Dang Ky Moi button)', function () {
  has(STATES, "'📝 Đăng Ký Mới'", 'register button');
});

// ---- T04 Menu layout contract ----
check('T04 Menu layout (2-panel 60/680 + cards + no debug captions)', function () {
  has(STATES, "class MenuState", 'MenuState');
  has(STATES, 'R.fillRoundRect(60, 120, 560, 640', 'left (player) panel');
  has(STATES, 'R.fillRoundRect(680, 120, 560, 640', 'right (mode) panel');
  has(STATES, "'Chọn chế độ chơi:'", 'right panel title');
  if (STATES.indexOf('M4 — Real Game States') >= 0) throw new Error('menu milestone caption still present');
  if (STATES.indexOf('M5: PlayerData + Save (localStorage) + Auth PBKDF2') >= 0) throw new Error('menu debug footer still present');
});

// ---- T05 XP/gold/player header ----
check('T05 Player header (greeting, level, grade, XP bar, gold)', function () {
  has(STATES, "'Level ' + p.level", 'level badge');
  has(STATES, "'Lớp ' + p.grade", 'grade badge');
  has(STATES, 'this._xpBar(R, 100, 310, 470, 24', 'XP bar');
  has(STATES, "'Vàng: ' + p.gold", 'gold display');
});

// ---- T06 Lesson Select layout ----
check('T06 Lesson select (light-green bg + KHOI LOP + lesson grid + back)', function () {
  has(STATES, "class LessonSelectState", 'LessonSelectState');
  has(STATES, "R.clear('#a5d6a7')", 'original light green (165,214,167)');
  has(STATES, "'KHỐI LỚP ' + this.grade", 'grade title');
  has(STATES, "drawBtn(R, bx, by, 480, 80", 'lesson button grid cells');
  has(STATES, "'⬅️ QUAY LẠI'", 'back button');
});
// ---- T07 Lesson answer layout ----
check('T07 Lesson state (question + options, no hard-coded stub)', function () {
  has(STATES, "class LessonState", 'LessonState');
  has(STATES, 'questionGen', 'uses questionGen (no hard-coded questions)');
  has(STATES, 'answer', 'answer options rendered');
});

// ---- T08 Victory ----
check('T08 Victory (dark-green + rank + XP + continue/review)', function () {
  has(STATES, "class VictoryState", 'VictoryState');
  has(STATES, "R.clear('#1e5030')", 'victory background');
  has(STATES, 'this.rank', 'rank letter');
  has(STATES, 'continueBtn', 'continue button');
  has(STATES, 'reviewBtn', 'review button');
});

// ---- T09 Defeat ----
check('T09 Defeat (warm panel + retry/home/review)', function () {
  has(STATES, "class DefeatState", 'DefeatState');
  has(STATES, "'🔄 LÀM LẠI'", 'retry button');
  has(STATES, "'🏠 VỀ MENU'", 'home button');
  has(STATES, "'🧐 XEM LỖI'", 'review button');
  has(STATES, 'Cần đạt 60% để vượt qua', 'original 60% message');
});

// ---- T10-T16 M9 screens exist ----
check('T10 Shop layout present', function () { has(STATES, "class ShopState", 'ShopState'); });
check('T11 Pet layout present', function () { has(STATES, "class PetState", 'PetState'); });
check('T12 Skin layout present', function () { has(STATES, "class SkinState", 'SkinState'); });
check('T13 Gacha layout present', function () { has(STATES, "class GachaState", 'GachaState'); });
check('T14 Achievement layout present', function () { has(STATES, "class AchievementState", 'AchievementState'); });
check('T15 Daily layout present', function () { has(STATES, "class DailyState", 'DailyState'); });
check('T16 Skill layout present', function () { has(STATES, "class SkillTreeState", 'SkillTreeState'); });

// ---- T17 Button dimensions ----
check('T17 button components (ui.js Button/CardButton + drawBtn radius 12)', function () {
  has(UIJS, 'class Button', 'ui.js Button');
  has(UIJS, 'class CardButton', 'ui.js CardButton');
  has(UIJS, 'class ProgressBar', 'ui.js ProgressBar');
  has(STATES, 'o.radius || 12', 'drawBtn radius 12 (original BUTTON_RADIUS)');
});

// ---- T18 Font contract ----
check('T18 Font = original Quicksand + Segoe UI Emoji', function () {
  has(CSS, "@font-face", 'font-face present');
  has(CSS, "'Quicksand'", 'Quicksand family');
  has(CSS, "'Segoe UI Emoji'", 'Segoe UI Emoji family');
});

// ---- T19 Color/token contract (Python game_init.py:1985-1991) ----
check('T19 Color tokens == Python effective palette', function () {
  has(STATES, 'const BLUE_BTN   = [0, 188, 212]', 'primary cyan');
  has(STATES, 'const GREEN_BTN  = [76, 175, 80]', 'success');
  has(STATES, 'const PURPLE_BTN = [138, 43, 176]', 'secondary');
  has(STATES, 'const ORANGE_BTN = [255, 152, 0]', 'warning');
  has(STATES, 'const YELLOW_BTN = [255, 215, 0]', 'accent');
  has(STATES, 'const RED_BTN    = [244, 67, 54]', 'danger');
  has(STATES, 'const SHADOW     = [100, 100, 100]', 'shadow');
});

// ---- T20 no legacy UI override ----
check('T20 No legacy states.js override in index.html', function () {
  has(INDEX, 'states_real.js', 'loads real states');
  if (INDEX.indexOf('js/states.js"') >= 0) throw new Error('legacy states.js still loaded');
});

console.log('\nUI_PARITY: pass=' + pass + ' fail=' + fail);
if (fail > 0) {
  console.log('FAILED: ' + failures.join(', '));
  process.exit(1);
}