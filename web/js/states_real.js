/* =========================================================
   MathDrill Web — M4: REAL GAME STATES
   ---------------------------------------------------------
const { ParticleBudget } = require('../js/effects.js');
const { GLOBAL_MAX_PARTICLES } = require('../js/effects.js');
const { AnswerEffectSystem } = require('../js/effects2.js');
const { ShopSystem } = require('../js/shop.js');
const { PetSystem } = require('../js/pet.js');
const { SkinSystem } = require('../js/skin.js');
const { GachaSystem, GachaBannerSystem } = require('../js/gacha.js');
const { AchievementSystem } = require('../js/achievements.js');
const { DailyRewardSystem } = require('../js/daily.js');
const { SkillTreeSystem } = require('../js/skill_tree.js');
   Port kiến trúc state/flow từ main.py (LoadingState,
   LoginState, MenuState, LessonSelectState, LessonState,
   VictoryState, DefeatState).

   Phạm vi M4 (đã chốt với owner):
   - CHỈ port state architecture + flow, CHƯA port data/question.
   - M5 cập nhật: Game.player giờ là PlayerData thật (player.js),
     Game.auth là AccountSystem localStorage + PBKDF2 (auth.js),
     Game.save là Save (save.js). Stub profile M4 đã bỏ.
   - Game.questionGen : interface sinh câu hỏi (chưa có → M6).
   - Game.dataLoader  : interface load lesson (chưa có → Phase 2/M7).
   - Reward/XP/gold   : chỉ hiển thị, logic thật ở M5/M7.
   - Tái sử dụng foundation M2/M3: Engine, InputManager, Renderer,
     AssetManager, SoundManager, StateManager, BaseState.
   ========================================================= */
(function (global) {
  'use strict';

  const L = global.GameLogger || {
    info: function () {}, warn: function () {}, error: function () {}
  };
  const BaseState = global.BaseState;

  // Logical canvas 1300x800 (khớp Engine.LOGICAL_WIDTH/HEIGHT)
  const W = 1300;
  const H = 800;

  // Màu theo main.py / game_init.py (BV «record» effective palette:
  // game_init.py:1985-1991 gán lại từ COLORS — primary(0,188,212) success(76,175,80)
  // danger(244,67,54) accent(255,215,0) secondary(138,43,176) warning(255,152,0) shadow(100,100,100))
  // M18 restoration: BLUE_BTN = COLORS['primary'] = (0, 188, 212) cyan.
  // game_init.py:1986 assigns `BLUE_BTN = COLORS['primary']` and game_init.py:1973
  // defines `COLORS['primary'] = (0, 188, 212)`. The inline comment on line 1986
  // ("# (70, 130, 180)") is STALE. A binding takes the value, not the comment.
  // M16.1 read that comment and moved the web to (70,130,180), which is wrong.
  // main.py imports this later binding, not the pastel set at game_init.py:309.
  const BLUE_BTN   = [0, 188, 212];
  const GREEN_BTN  = [76, 175, 80];
  const PURPLE_BTN = [138, 43, 176];
  const ORANGE_BTN = [255, 152, 0];
  const YELLOW_BTN = [255, 215, 0];
  const RED_BTN    = [244, 67, 54];
  const SHADOW     = [100, 100, 100];

  /* game_init.py:145-152 is_young_learner(grade) -> grade <= 2.
     Grades 1-2 keep practice/simple modes; the advanced modes (gacha,
     Skill Tree...) are explicitly held back. */
  function isYoungLearnerGrade(grade) {
    try { return parseInt(grade || 1, 10) <= 2; }
    catch (e) { return true; }
  }
  // main.py:1029 the exact Desktop discriminator string.
  const DAILY_CHALLENGE_TITLE = 'Thử Thách';

  function css(c) {
    return Array.isArray(c) ? 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')' : c;
  }

  // Helper vẽ button Canvas (M8 sẽ thay bằng ui.js Button theo plan)
  function drawBtn(R, x, y, w, h, label, bg, opts) {
    const o = opts || {};
    R.fillRoundRect(x, y, w, h, o.radius || 12, css(bg), o.border || '#ffffff', o.borderW || 2);
    R.text(label, x + w / 2, y + h / 2, {
      font: 'bold ' + (o.fontSize || 20) + 'px Quicksand, Segoe UI, sans-serif',
      fill: o.textColor || '#ffffff',
      align: 'center',
      baseline: 'middle'
    });
  }

  function hit(click, x, y, w, h) {
    if (!click) return false;
    return click.x >= x && click.x <= x + w && click.y >= y && click.y <= y + h;
  }

  /* ---- Desktop parity: continuous clover rain (M12) ----------------------
     game_init.py FallingCloverEffect.__init__ pre-allocates `num_clovers`
     CloverParticle instances and every CloverParticle.reset() scatters itself
     across [0, WIDTH] x [-HEIGHT, 0]; CloverParticle.update() calls reset()
     again once the clover falls past HEIGHT. The Desktop effect is therefore a
     *continuous* rain that never needs an explicit spawn.
     The Web port (effects2.js FallingClover) is instead a burst pool: its
     particles array starts empty and nothing is rendered until spawn() seeds
     it, so a state must drive the seeding itself. Seeding up to the Desktop
     cap each frame reproduces the Desktop behaviour (and stays inside the pool
     cap the effect was constructed with). */
  function cloverRain(effect, cap) {
    if (!effect || typeof effect.spawn !== 'function') return 0;
    const have = (typeof effect.count === 'number')
      ? effect.count
      : (Array.isArray(effect.particles) ? effect.particles.length : 0);
    let seeded = 0;
    for (let i = have; i < cap; i++) {
      effect.spawn(Math.random() * W, -Math.random() * H);
      seeded++;
    }
    return seeded;
  }

  /* Paint the clover pool (Desktop FallingCloverEffect.draw(surface)).
     The Web pool draws straight to the 2D context, so resolve it from the
     Renderer and never let a draw failure break the state. */
  function drawClover(R, effect) {
    if (!effect || typeof effect.draw !== 'function') return;
    const c = (R && R.ctx) ? R.ctx : R;
    if (!c || typeof c.save !== 'function') return;
    try { effect.draw(c); } catch (e) { /* never break a state draw */ }
  }

  /* Word-wrap cho question card — parity draw_multiline_text (game_init.py).
     Dùng ctx.measureText với font hiện hành; trả về tối đa maxLines dòng. */
  function wrapText(R, text, maxWidth, font, maxLines) {
    const ctx = R && R.ctx;
    if (!ctx || typeof ctx.measureText !== 'function') return [String(text)];
    ctx.save();
    ctx.font = font;
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    for (let i = 0; i < words.length; i++) {
      const test = cur ? cur + ' ' + words[i] : words[i];
      if (!cur || ctx.measureText(test).width <= maxWidth) cur = test;
      else { lines.push(cur); cur = words[i]; }
    }
    if (cur) lines.push(cur);
    ctx.restore();
    if (maxLines && lines.length > maxLines) {
      // Hợp nhất phần thừa vào dòng cuối để không mất nội dung
      const head = lines.slice(0, maxLines - 1);
      head.push(lines.slice(maxLines - 1).join(' '));
      return head;
    }
    return lines;
  }

  /* Combo HUD — port nguyên văn get_combo_text/get_combo_color
     (game_init.py:429-444). Trả "" khi combo < 3 (Python KHÔNG vẽ combo). */
  function comboText(streak) {
    const n = Number(streak) || 0;
    if (n >= 20) return '🔥🔥🔥 INSANE COMBO! 🔥🔥🔥';
    if (n >= 15) return '⚡⚡ MEGA COMBO! ⚡⚡';
    if (n >= 10) return '💥💥 SUPER COMBO! 💥💥';
    if (n >= 7) return '🔥🔥 HIGH COMBO! 🔥🔥';
    if (n >= 5) return '⚡ GREAT COMBO! ⚡';
    if (n >= 3) return '✨ COMBO! ✨';
    return '';
  }
  function comboColor(streak) {
    const n = Number(streak) || 0;
    if (n >= 10) return [255, 50, 50];
    if (n >= 7) return [255, 150, 50];
    if (n >= 5) return [255, 200, 50];
    if (n >= 3) return [100, 200, 255];
    return [200, 200, 200];
  }

  /* M10-B: đẩy snapshot tiến trình lên server. Đảm bảo dữ liệu được
     lưu sebelum页面 tiếp tục — tiên trình phải tồn tại qua reload. */
  async function syncPlayerToServer() {
    const a = global.Game && global.Game.auth;
    if (a && typeof a.pushPlayerData === 'function') {
      try { await a.pushPlayerData(); }
      catch (e) { L.warn('[Sync] pushPlayerData error', e && e.message); }
    }
  }

  /* M10-QA2 FIX — XP lost across reload.
     The account blob (auth.data()) stores experience under `xp` (Desktop
     AccountSystem key, mirrored server-side by user_store.js/database.js),
     while PlayerData (player.py) reads/writes `exp`. Feeding the account blob
     straight into loadSaveData() therefore silently dropped XP on every login
     (deep-run repro: 4020 -> 0). Translate the key explicitly; the account
     value wins because it is the one victory/defeat/menu persist. */
  function accountToPlayerSave(data) {
    const d = data || {};
    const out = Object.assign({}, d);
    if (d.xp !== undefined) out.exp = d.xp;
    else if (out.exp === undefined) out.exp = 0;
    return out;
  }

  // ---- Người chơi M5: PlayerData thật (player.js) thay stub M4 ----
  function createPlayer(username, grade) {
    const pd = new global.PlayerData();
    pd.username = (username || '').trim() || 'BẠN';
    if (grade) pd.grade = grade;
    return pd;
  }

  function getPlayer() {
    if (!global.Game) global.Game = {};
    if (!global.Game.player) global.Game.player = createPlayer('BẠN', 1);
    return global.Game.player;
  }

  /* M19: port of Desktop game_init.py:3549 draw_top_bar - the in-lesson HUD the
     web was missing entirely. Source constants:
       TOP_BAR_H = 70, MARGIN = 20, FONT_SIZES.button = 18
       bar gradient scanlines (30,35,60, alpha 220 -> 110 top to bottom)
       inner border (255,255,255,40) w2
       "👤 {USER}"      20px (240,240,255) at (20,12)
       "LEVEL n | Lớp g" 16px (180,200,255) at (20,40)
       "Vàng: g"        16px (255,225,120) at (220,40)
     Desktop returns early when there is no signed-in user; the web mirrors that
     so a guest lesson screen is not decorated with a default player. */
  const TOP_BAR_H = 70;
  function drawTopBar(R, ctx, W2, comboStreak) {
    // main.js:124 stores the AccountSystem instance on Game.auth, and its
    // signed-in name on the currentUser PROPERTY (auth.js:229, null when signed
    // out). The username the rest of the web renders from is the player record
    // (createPlayer -> pd.username), which the Menu already displays, so read
    // both and prefer the live session.
    const acct = global.Game && global.Game.auth;
    const p = getPlayer();
    const name = (acct && acct.currentUser) || p.username;
    if (!name) return false;
    // Gradient bar (30,35,60) fading 220 -> 110 alpha, then a translucent edge.
    if (ctx && typeof ctx.createLinearGradient === 'function') {
      const g = ctx.createLinearGradient(0, 0, 0, TOP_BAR_H);
      g.addColorStop(0, 'rgba(30,35,60,0.863)');   // 220/255
      g.addColorStop(1, 'rgba(30,35,60,0.431)');   // 110/255
      ctx.save();
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W2, TOP_BAR_H);
      ctx.restore();
    } else {
      R.fillRoundRect(0, 0, W2, TOP_BAR_H, 0, 'rgba(30,35,60,0.7)', null, 0);
    }
    R.fillRoundRect(0, 0, W2, TOP_BAR_H, 0, null, 'rgba(255,255,255,0.157)', 2);
    R.text('👤 ' + String(name).toUpperCase(), 20, 12, {
      font: '20px Quicksand, Segoe UI Emoji, sans-serif', fill: 'rgb(240,240,255)', baseline: 'top'
    });
    R.text('LEVEL ' + p.level + ' | Lớp ' + (p.grade || 1), 20, 40, {
      font: '16px Quicksand, sans-serif', fill: 'rgb(180,200,255)', baseline: 'top'
    });
    R.text('Vàng: ' + p.gold, 220, 40, {
      font: '16px Quicksand, sans-serif', fill: 'rgb(255,225,120)', baseline: 'top'
    });
    // Centre combo streak, only when Desktop would show one (streak >= 3).
    const label = comboText(comboStreak);
    if (label) {
      R.text(label, W2 / 2, TOP_BAR_H / 2, {
        font: 'bold 20px Quicksand, Segoe UI Emoji, sans-serif',
        fill: css(comboColor(comboStreak)), align: 'center', baseline: 'middle'
      });
    }
    return true;
  }
  // M7-C: ensure GameManager ctor is available in both browser (script tags)
  // and Node (require). states_real has no hard require to keep index.html
  // script-tag loading order independent.
  function getGameManagerCtor() {
    if (global.GameManager && typeof global.GameManager === 'function') return global.GameManager;
    try {
      if (typeof require === 'function') {
        var gm = require('./game_manager.js');
        var Ctor = (gm && gm.GameManager) || (global.GameManager) || null;
        if (typeof Ctor === 'function') { global.GameManager = Ctor; return Ctor; }
      }
    } catch (_) { /* ignore — fall through to lazy init at enter() */ }
    return null;
  }
  function makeGameManager(player) {
    var Ctor = getGameManagerCtor();
    if (typeof Ctor === 'function') return new Ctor(player);
    return null; // question-flow tests inject via enter(); M4 flow tolerates null until M7 modules load
  }

  // =========================================================
  // LOADING STATE  (main.py:125-182)
  // =========================================================
  class LoadingState extends BaseState {
    constructor() {
      super('loading');
      this.minTime = 1.2;
      this.elapsed = 0;
      this.ready = false;
      this.leaving = false;
      this.report = { total: 0, loaded: 0, failed: 0 };
      this.tips = [
        'Mẹo: Học mỗi ngày để tăng XP nhanh!',
        'Mẹo: Combo cao giúp điểm nhiều hơn!',
        'Mẹo: Time Attack sẽ tăng độ khó theo bạn.',
        'Mẹo: Trả lời đúng, hãy tính cẩn thận!'
      ];
      this.tip = this.tips[0];
    }

    preloadAssets() {
      const G = global.Game;
      const self = this;
      /* M17 startup: the ONLY image LoginState draws is nen_game (states_real.js
         LoginState.draw). The other five belong to screens the player only reaches
         minutes later - main_character (Theory), victory_text (Victory), defeat
         (Defeat), pixel_clover / favicon. Gating the Login transition on all six
         made cold boot 42-55s on Render, because 1.7MB of Victory/Defeat art had to
         finish streaming before anyone could type a username.
         All six still start immediately and load in parallel; only the *gate*
         changes. AssetManager.loadImage always resolves (a labelled placeholder on
         error), and states re-read assets.get() every draw, so late art simply
         appears on the next frame of the screen that needs it. */
      const LIST = [
        { name: 'nen_game', url: 'assets/nen_game.png' },
        { name: 'pixel_clover', url: 'assets/pixel_clover.png' },
        { name: 'favicon', url: 'assets/favicon.png' },
        // Desktop parity game_init.py:292 — DEFAULT_CHARACTER_IMG = main_character.png (600x600),
        // dùng bởi TheoryState character panel (main.py:997-1004).
        { name: 'main_character', url: 'assets/main_character.png' },
        { name: 'victory_text', url: 'assets/victory_text.png' },
        { name: 'defeat', url: 'assets/defeat.png' }
        /* M29 parity: Desktop main.py:290 IdleGifState loads gt2.gif. It is
           DELIBERATELY not in this boot LIST. Desktop only reaches IdleGifState
           after 15s of login idle (main.py:230-232), so gt2.gif must not be on the
           startup path - adding it here would pull 10.7MB during boot and undo the
           M17 startup work (cold boot was cut 42-55s -> ~8.8s by gating on
           nen_game only). IdleGifState.enter() loads it on demand, mirroring
           Desktop's enter() -> load_gif(). */
      ];
      this.assetTotal = LIST.length;
      this.assetDone = 0;
      this.assetFailed = 0;
      const bump = function (img) {
        self.assetDone++;
        if (img && img.placeholder) self.assetFailed++;
        return img;
      };
      /* Only the Login background is on the critical path. The other five are
         NOT requested during startup: on a constrained link the six parallel
         downloads divide the same bandwidth, so even nen_game alone finished
         23-44s into a 42-55s wait. Fetching it alone lets the one image the
         player is actually looking at use the whole pipe. The remaining art
         starts the moment Login is usable and is never awaited - by the time a
         player can reach Theory/Victory/Defeat it has long since landed. */
      const CRITICAL = 'nen_game';
      const jobs = [];
      /* Defensive: never let a missing AssetManager API hang the loading
         screen. If loadImage is unavailable, fall back to preload(), and if
         neither exists treat the item as instantly satisfied. */
      const loadOne = function (item) {
        try {
          let j;
          if (G.assets && typeof G.assets.loadImage === 'function') {
            j = G.assets.loadImage(item.name, item.url);
          } else if (G.assets && typeof G.assets.preload === 'function') {
            j = G.assets.preload([item]);
          } else {
            j = Promise.resolve(null);
          }
          j = Promise.resolve(j).then(bump);
          jobs.push(j);
          return j;
        } catch (err) {
          L.error('[Loading] loadImage unavailable for', item.name, err);
          return Promise.resolve(null);
        }
      };
      let criticalItem = null;
      for (let i = 0; i < LIST.length; i++) {
        if (LIST[i].name === CRITICAL) { criticalItem = LIST[i]; break; }
      }
      const fonts = (G.assets && G.assets.loadFonts) ? G.assets.loadFonts() : Promise.resolve({});
      // Audio must not gate Login either.
      if (G.audio && G.audio.loadSfx) G.audio.loadSfx('correct', 'tra_loi_dung.ogg');
      // Critical gate = fonts + the single image Login draws.
      const critical = Promise.all([
        fonts,
        criticalItem ? loadOne(criticalItem) : Promise.resolve(null)
      ]).then(function () {
        self.ready = true;
        L.info('[Loading] Login-critical ready at', Math.round(performance.now()));
      });
      // Deferred art: starts AFTER Login is usable, purely in the background.
      const everything = critical.then(function () {
        const rest = [];
        for (let i = 0; i < LIST.length; i++) {
          if (LIST[i].name !== CRITICAL) rest.push(loadOne(LIST[i]));
        }
        return Promise.all(rest);
      }).then(function () {
        self.report = {
          total: self.assetTotal,
          loaded: self.assetDone - self.assetFailed,
          failed: self.assetFailed
        };
        L.info('[Loading] All art ready', self.report);
        return self.report;
      });
      everything.catch(function (err) { L.error('[Loading] Preload failed', err); });
      return critical.catch(function (err) {
        L.error('[Loading] Critical preload failed', err);
        self.ready = true;
      });
    }

    enter() {
      this.elapsed = 0;
      this.ready = false;
      this.leaving = false;
      this.tip = this.tips[Math.floor(Math.random() * this.tips.length)];
      this.preloadAssets();
    }

    exit() {}

    handleInput(input, dt) {} // Loading không nhận input (giống Python)

    update(dt) {
      this.elapsed += dt;
      if (this.ready && this.elapsed >= this.minTime && !this.leaving) {
        this.leaving = true;
        // Python: default_next đọc session → prefill username (main.py:135-142)
        // Web: session.json → mathdrill_session { last_user }
        let prefill = '';
        const Save = global.Save;
        if (Save && Save.load) {
          const session = Save.load(Save.KEYS.SESSION, null);
          if (session && typeof session.last_user === 'string') prefill = session.last_user;
        }
        // Python: manager.change(next, "HERTA") → web dùng fade
        global.Game.states.change('login', { prefill: prefill }, 'fade');
      }
    }

    draw(ctx, W2, H2) {
      const R = global.Game.renderer;
      // Desktop main.py:160-166 LoadingState.draw background stack:
      //   s.fill((20,30,55)) -> draw_gradient((20,30,55)->(70,120,190))
      //   -> background_img scaled 1300x800 at alpha 45.
      R.clear('rgb(20,30,55)');
      R.gradient([20, 30, 55], [70, 120, 190]);
      const bg = global.Game.assets && global.Game.assets.get('nen_game');
      if (bg && !bg.placeholder) {
        ctx.save();
        ctx.globalAlpha = 0.176;   // 45/255 to match Desktop's alpha=45
        R.image(bg, 0, 0, W2, H2);
        ctx.restore();
      }
      R.text('MATHDRILL', W2 / 2, H2 / 2 - 170, {
        font: 'bold 54px Quicksand, Segoe UI, sans-serif',
        fill: '#e0ecff', align: 'center', baseline: 'middle'
      });
      const barW = 520, barH = 28, bx = (W2 - barW) / 2, by = H2 / 2 - 20;
      /* M17: the old bar was fake — p = elapsed/minTime with minTime 1.2s, so it
         sat at 100% while 1.7MB of art was still streaming and the player waited
         40s+ staring at a "complete" bar. Now it tracks the real number of
         downloaded assets and shows a plain count, not a fabricated percentage. */
      const done = this.assetDone || 0;
      const total = this.assetTotal || 1;
      const p = this.ready ? 1 : Math.min(1, done / total);
      R.fillRoundRect(bx, by, barW, barH, 14, 'rgba(40,40,60,0.9)', null, 0);
      if (p > 0) R.fillRoundRect(bx, by, barW * p, barH, 14, 'rgb(100,200,255)', null, 0);
      R.fillRoundRect(bx, by, barW, barH, 14, 'rgba(0,0,0,0)', 'rgba(255,255,255,0.9)', 2);
      R.text(this.ready ? 'Sẵn sàng!' : 'Đang tải hình ảnh ' + done + '/' + total,
        W2 / 2, by - 36, {
        font: '18px Quicksand, sans-serif', fill: '#e6e6f5', align: 'center', baseline: 'middle'
      });
      R.text(this.tip, W2 / 2, by + barH + 60, {
        font: '18px Quicksand, sans-serif', fill: '#e6e6f5', align: 'center', baseline: 'middle'
      });
      /* M16.1: kept from M16 - the only loading change judged to still fit the
         original game. Production cold boot measures 40-63s, and with no
         explanation a child reads the wait as a hang. Plain text on the
         original background art; no plate, no gradient, no new elements.
         M17: Login no longer waits for the remaining art, so this honest
         first-load warning is only shown while the app is genuinely not ready. */
      if (!this.ready) {
        R.text('Lần đầu tải có thể mất vài giây...', W2 / 2, by + barH + 96, {
          font: '15px Quicksand, sans-serif', fill: '#9aa8c8', align: 'center', baseline: 'middle'
        });
      }
    }
  }

  // REGISTER STATE (main.py:RegisterState) — M11 Desktop parity port.
  class RegisterState extends BaseState {
    constructor() {
      super('register');
      this.userInput = '';
      this.passInput = '';
      this.activeField = 'user';
      this.selectedGrade = 1;
      this.msg = '';
      this.msgTimer = 0;
      this.msgOk = false;
      this.userRect = { x: 450, y: 280, w: 400, h: 50 };
      this.passRect = { x: 450, y: 350, w: 400, h: 50 };
      this.gradeBtns = [];
      for (let i = 1; i <= 5; i++) {
        this.gradeBtns.push({ grade: i, x: 450 + (i - 1) * 90, y: 420, w: 80, h: 50 });
      }
      this.createBtn = { x: 450, y: 500, w: 400, h: 70 };
      this.backBtn = { x: 450, y: 590, w: 400, h: 70 };
      // Desktop main.py:368 RegisterState uses FallingCloverEffect(25).
      this.cloverEffect = global.FallingClover ? new global.FallingClover(25) : null;
    }
    enter() {
      this.userInput = '';
      this.passInput = '';
      this.activeField = 'user';
      this.selectedGrade = 1;
      this.msg = '';
      this.msgTimer = 0;
      this.msgOk = false;
      L.info('[Register] enter');
    }
    exit() {}
    _onCreate() {
      const username = this.userInput.trim();
      const password = this.passInput.trim();
      const self = this;
      if (!username || !password) {
        this.msg = 'Vui lòng nhập đầy đủ thông tin!';
        this.msgTimer = 3.0;
        this.msgOk = false;
        return;
      }
      const auth = global.Game && global.Game.auth;
      if (auth && typeof auth.register === 'function') {
        auth.register(username, password, this.selectedGrade).then(function (res) {
          if (res.ok) {
            L.info('[Register] OK → login');
            global.Game.states.change('login', { prefill: username }, 'fade');
          } else {
            self.msg = res.msg || 'Đăng ký thất bại';
            self.msgTimer = 3.0;
            self.msgOk = false;
          }
        }).catch(function (err) {
          L.error('[Register] error', err);
          self.msg = 'Lỗi đăng ký — thử lại';
          self.msgTimer = 3.0;
          self.msgOk = false;
        });
      } else {
        this.msg = 'Hệ thống tài khoản chưa sẵn sàng';
        this.msgTimer = 3.0;
        this.msgOk = false;
      }
    }
    handleInput(input, dt) {
      const click = input.consumeClick ? input.consumeClick() : null;
      /* M29 Desktop parity: main.py:227-232 only advances idle_timer while the
         player does nothing, so any real input resets it. */
      const idleKey = input.consumePressedKey ? input.consumePressedKey() : null;
      if (click || idleKey) this.idleTimer = 0;
      if (click) {
        if (hit(click, this.userRect.x, this.userRect.y, this.userRect.w, this.userRect.h)) {
          this.activeField = 'user';
        } else if (hit(click, this.passRect.x, this.passRect.y, this.passRect.w, this.passRect.h)) {
          this.activeField = 'pass';
        } else {
          let gHit = false;
          for (let i = 0; i < this.gradeBtns.length; i++) {
            const g = this.gradeBtns[i];
            if (hit(click, g.x, g.y, g.w, g.h)) { this.selectedGrade = g.grade; gHit = true; break; }
          }
          if (!gHit) {
            if (hit(click, this.createBtn.x, this.createBtn.y, this.createBtn.w, this.createBtn.h)) {
              this._onCreate();
            } else if (hit(click, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h)) {
              global.Game.states.change('login', { prefill: '' }, 'fade');
            }
          }
        }
      }
      const key = input.consumePressedKey ? input.consumePressedKey() : null;
      if (key) this.idleTimer = 0;
      if (key) {
        const k = key.key;
        if (k === 'Backspace') {
          if (this.activeField === 'user') this.userInput = this.userInput.slice(0, -1);
          else this.passInput = this.passInput.slice(0, -1);
        } else if (k === 'Tab') {
          this.activeField = (this.activeField === 'user') ? 'pass' : 'user';
        } else if (k === 'Enter' || k === 'NumpadEnter') {
          this._onCreate();
        } else if (k && k.length === 1) {
          const cur = (this.activeField === 'user') ? this.userInput : this.passInput;
          if (cur.length < 20) {
            if (this.activeField === 'user') this.userInput += k;
            else this.passInput += k;
          }
        }
      }
    }
    update(dt) {
      if (this.msgTimer > 0) this.msgTimer = Math.max(0, this.msgTimer - dt);
    }
    draw(ctx, W2, H2) {
      const R = global.Game.renderer;
      // Desktop main.py:397-398 RegisterState.draw:
      //   s.blit(background_img,(0,0)) if background_img else s.fill((30,40,60))
      //   then self.clover_effect.draw(s)  (FallingCloverEffect(25), main.py:368)
      // The web used a flat #1e2840 and drew no clover, so this screen did not
      // look like the original at all.
      const _regBg = global.Game.assets && global.Game.assets.get('nen_game');
      if (_regBg && !_regBg.placeholder) {
        R.image(_regBg, 0, 0, W2, H2);
      } else {
        R.clear('rgb(30,40,60)');   // Desktop main.py:397 fallback fill
      }
      drawClover(R, this.cloverEffect);
      const ch = global.Game.assets && global.Game.assets.get('main_character');
      if (ch && !ch.placeholder) R.image(ch, 50, 250, 400, 400);
      R.text('Đăng Ký', 450, 200, {
        font: 'bold 40px Quicksand, sans-serif', fill: '#ffffff', baseline: 'middle'
      });
      this._regField(R, this.userRect, this.userInput, 'user', 'Tên đăng nhập', false);
      this._regField(R, this.passRect, this.passInput, 'pass', 'Mật khẩu', true);
      R.text('Chọn lớp:', 450, 390, {
        font: '20px Quicksand, sans-serif', fill: '#ffffff', baseline: 'middle'
      });
      for (let i = 0; i < this.gradeBtns.length; i++) {
        const g = this.gradeBtns[i];
        drawBtn(R, g.x, g.y, g.w, g.h, 'Lớp ' + g.grade,
          g.grade === this.selectedGrade ? PURPLE_BTN : ORANGE_BTN, { fontSize: 14 });
      }
      drawBtn(R, this.createBtn.x, this.createBtn.y, this.createBtn.w, this.createBtn.h,
        'TẠO TÀI KHOẢN', GREEN_BTN);
      drawBtn(R, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h,
        'QUAY LẠI', RED_BTN);
      if (this.msgTimer > 0 && this.msg) {
        // Desktop main.py:412-413 GREEN_BTN on success else RED_BTN, centred at
        // WIDTH//2+50 = 700, y = 680.
        R.text(this.msg, 700, 680, {
          font: '20px Quicksand, sans-serif',
          fill: this.msgOk ? 'rgb(76,175,80)' : 'rgb(244,67,54)',
          align: 'center', baseline: 'middle'
        });
      }
    }
    _regField(R, rect, value, fieldKey, placeholder, isPassword) {
      R.fillRoundRect(rect.x, rect.y, rect.w, rect.h, 10, 'rgb(220,220,220)', null, 0);
      if (this.activeField === fieldKey) {
        R.fillRoundRect(rect.x, rect.y, rect.w, rect.h, 10, 'rgba(0,0,0,0)', 'rgb(150,150,150)', 2);
      }
      const display = isPassword ? new Array(value.length + 1).join('*') : value;
      const empty = value.length === 0;
      R.text(display || placeholder, rect.x + 15, rect.y + rect.h / 2, {
        font: '20px Quicksand, sans-serif',
        fill: empty ? '#aaaaaa' : '#505050',
        baseline: 'middle'
      });
    }
  }
  // LOGIN STATE below (main.py:183-251)
  // M4: chưa có AccountSystem (M5) — login tạo profile stub.
  // =========================================================
  /* M29 Desktop parity: IdleGifState (main.py:252-365).
     Desktop behaviour, ported 1:1:
       - LoginState goes idle for 15.0s (main.py:230-232) and enters this state.
       - gt2.gif is the ORIGINAL asset (main.py:290). Desktop decodes at most
         MAX_GIF_FRAMES=45 frames at 30fps (frame_duration 0.033, main.py:259,264);
         the browser animates a GIF natively, so Web keeps the same fullscreen
         1300x800 presentation and the same visible cadence without decoding
         frames into RAM.
       - draw: blit the current frame at (0,0) fullscreen (main.py:358).
       - while loading: fill (30,40,60) + centered "Dang tai GIF..." (main.py:360-363).
       - ALWAYS: white centered hint at y = HEIGHT-100 (main.py:364-365).
       - ANY mouse-down or key-down returns to LoginState (main.py:347-349). */
  class IdleGifState extends BaseState {
    constructor() {
      super('idleGif');
      this.loaded = false;
      this.loading = false;
    }

    enter() {
      if (this.loaded || this.loading) return;
      this.loading = true;
      const G = global.Game;
      const A = G && G.assets;
      // Desktop main.py:268-286 loads the GIF on enter (threaded on desktop,
      // synchronously in the web build). Web loads it on demand for the same
      // reason Desktop does not load it at boot.
      try {
        if (A && typeof A.get === 'function') {
          const img = A.get('gt2');
          if (img && !img.placeholder) { this.loaded = true; }
        }
      } catch (e) { /* fall through to the loading indicator */ }
      if (A && typeof A.loadImage === 'function' && !this.loaded) {
        try {
          const self = this;
          const r = A.loadImage('gt2', 'assets/gt2.gif');
          if (r && typeof r.then === 'function') {
            r.then(function (img) { if (img && !img.placeholder) self.loaded = true; self.loading = false; },
                   function () { self.loading = false; });
          } else if (r && !r.placeholder) { this.loaded = true; this.loading = false; }
          else { this.loading = false; }
        } catch (e) { this.loading = false; }
      } else {
        this.loading = false;
      }
    }

    exit() {}

    update() {}

    handleInput(input) {
      // main.py:347-349 - ANY click or key returns to the login screen.
      const click = input && input.consumeClick ? input.consumeClick() : null;
      const key = input && input.consumePressedKey ? input.consumePressedKey() : null;
      if (click || key) {
        global.Game.states.change('login', null, null);
        return true;
      }
      return false;
    }

    draw(ctx, W2, H2) {
      const R = global.Game.renderer;
      const img = global.Game.assets && global.Game.assets.get('gt2');
      const ready = this.loaded && img && !img.placeholder;
      if (ready) {
        // main.py:358 - s.blit(self.frames[self.current_frame], (0, 0))
        R.image(img, 0, 0, W2, H2);
      } else {
        // main.py:360-363
        R.clear('rgb(30,40,60)');
        R.text('Đang tải GIF...', W2 / 2, H2 / 2,
          { font: '24px Quicksand, sans-serif', fill: '#ffffff', align: 'center', baseline: 'middle' });
      }
      // main.py:364-365 - always drawn, WHITE, centred, y = HEIGHT-100
      R.text('Click để quay lại đăng nhập', W2 / 2, H2 - 100,
        { font: '24px Quicksand, sans-serif', fill: '#ffffff', align: 'center', baseline: 'middle' });
    }
  }

  class LoginState extends BaseState {
    constructor() {
      super('login');
      /* M29 Desktop parity: main.py:227-232 accumulates idle_timer and enters
         IdleGifState at >= 15.0s. Web had no idle tracking at all. */
      this.IDLE_GIF_DELAY = 15.0;   // main.py:231
      this.idleTimer = 0;
      this.userInput = '';
      this.passInput = '';
      this.activeField = 'user';
      this.errorMsg = '';
      this.errorTimer = 0;
      this.infoMsg = '';
      this.infoTimer = 0;
      this.cx = W / 2;
      this.userRect = { x: this.cx - 200, y: 410, w: 400, h: 50 };
      this.passRect = { x: this.cx - 200, y: 490, w: 400, h: 50 };
      this.loginBtn = { x: this.cx - 200, y: 580, w: 400, h: 60 };
      this.regBtn   = { x: this.cx - 200, y: 660, w: 400, h: 60 };
    }

    enter(params) {
      const prefill = params && params.prefill ? String(params.prefill) : '';
      this.userInput = prefill;
      this.passInput = '';
      this.activeField = this.userInput ? 'pass' : 'user';
      this.errorMsg = '';
      this.errorTimer = 0;
      this.infoMsg = '';
      this.infoTimer = 0;
      L.info('[Login] enter (M4 stub — auth thật ở M5/M10)');
      this._restoreSession();
    }

    /* M24-P1: session restore on reload.
       REPRODUCED DEFECT (real Chromium, local server): with a VALID
       `mathdrill_session` cookie the app still booted to the Login screen and
       forced the player to retype their password after every refresh.
       Root cause: AccountSystem.me() (auth.js:401, wrapping GET /api/auth/me)
       existed but had NO CALLER anywhere in web/js, so boot never asked the
       backend whether the session was still valid. Desktop does check:
       game_init.py:5287 load_session_user().

       Reuses ONLY already-written, already-shipped code: me() validates the
       cookie, pullPlayerData() issues the SAME GET /api/player/data the
       successful _onLogin path makes, and data()/createPlayer()/
       accountToPlayerSave() are the byte-identical chain _onLogin uses.
       No auth rule is weakened: an absent, invalid or expired cookie yields
       null and the player simply stays on Login exactly as before. */
    _restoreSession() {
      const auth = global.Game && global.Game.auth;
      if (!auth || typeof auth.me !== 'function') return;
      /* Only probe when this browser has logged in before. A successful login
         writes Save.KEYS.SESSION {last_user} (the same localStorage that sits
         alongside the HttpOnly session cookie), so the hint and the cookie live
         and die together. Without the hint we skip the request entirely, which
         keeps a first-time visitor at zero extra HTTP calls: an unauthenticated
         GET /api/auth/me answers 401 and Chrome logs every 4xx fetch to the
         console, which would otherwise be permanent console noise on the Login
         screen. With no hint we simply stay on Login, exactly as before. */
      const S = global.Save;
      const hint = (S && S.load) ? S.load(S.KEYS.SESSION, null) : null;
      if (!hint || !hint.last_user) {
        L.info('[Login] no prior session hint - skipping restore probe');
        return;
      }
      Promise.resolve()
        .then(function () { return auth.me(); })
        .then(function (user) {
          // backendMe() returns the user OBJECT; legacy local mode returns a bare
          // username string. Only a real backend session auto-restores.
          if (!user || typeof user !== 'object' || !user.username) return;
          const username = String(user.username);
          L.info('[Login] live session restored for', username);
          const pull = (typeof auth.pullPlayerData === 'function')
            ? auth.pullPlayerData() : Promise.resolve(null);
          return Promise.resolve(pull).then(function () {
            const d = auth.data();
            const p = createPlayer(username, d.grade || 1);
            p.loadSaveData(accountToPlayerSave(d)); // sync_player_stats
            p.username = username;
            global.Game.player = p;
            const Save = global.Save;
            if (Save && Save.save) Save.save(Save.KEYS.SESSION, { last_user: username });
            global.Game.states.change('menu', null, 'fade');
          });
        })
        .catch(function (e) {
          // A failed restore must never block the login screen.
          if (L) L.warn('[Login] session restore skipped:', e && e.message);
        });
    }

    exit() {}

    /* M29 Desktop parity: main.py:227-232
         self.idle_timer += dt
         if self.idle_timer >= 15.0: manager.change(IdleGifState())
       Any real input resets the timer, exactly as Desktop's main loop only
       advances idle_timer while the player does nothing. */
    _onLogin() {
      const username = this.userInput.trim();
      const password = this.passInput.trim();
      if (!username || !password) {
        this.errorMsg = 'Vui lòng nhập đầy đủ thông tin!';
        this.errorTimer = 3.0;
        return;
      }
      const self = this;
      const auth = global.Game && global.Game.auth;
      if (auth && typeof auth.login === 'function') {
        // M5: AccountSystem thật (PBKDF2 WebCrypto, async) — main.py login_action
        auth.login(username, password).then(function (res) {
          if (res.ok) {
            /* M10-B FIX: pull the server-side progress blob FIRST, then build the
               player from it. Before this, backend data() returned {} and every
               login reset XP/gold/level to defaults (progress lost on reload). */
            const pull = (typeof auth.pullPlayerData === 'function')
              ? auth.pullPlayerData() : Promise.resolve(null);
            return Promise.resolve(pull).then(function () {
              const d = auth.data();
              const pd = createPlayer(username, d.grade || 1);
              /* M10-QA2 FIX: map the account key `xp` -> PlayerData `exp`
                 (see accountToPlayerSave) — otherwise XP resets on login. */
              pd.loadSaveData(accountToPlayerSave(d)); // sync_player_stats (game_init.py:445-449)
              pd.username = username;
              global.Game.player = pd;
              const Save = global.Save;
              if (Save && Save.save) Save.save(Save.KEYS.SESSION, { last_user: username });
              L.info('[Login] M5 login OK →', username, '| level', pd.level, '| grade', pd.grade);
              global.Game.states.change('menu', null, 'fade');
            });
          } else {
            self.errorMsg = res.msg || 'Sai tài khoản/mật khẩu';
            self.errorTimer = 3.0;
          }
        }).catch(function (err) {
          L.error('[Login] auth error', err);
          self.errorMsg = 'Lỗi đăng nhập — thử lại';
          self.errorTimer = 3.0;
        });
        return;
      }
      // Fallback khi chưa có AccountSystem (môi trường test/offline):
      // vẫn dùng PlayerData thật + lưu snapshot player + session.
      const pd = createPlayer(username, 1);
      global.Game.player = pd;
      const Save = global.Save;
      if (Save && Save.save) {
        Save.save(Save.KEYS.PLAYER, pd.getSaveData());
        Save.save(Save.KEYS.SESSION, { last_user: username });
      }
      L.info('[Login] fallback login (chưa có auth) →', username);
      global.Game.states.change('menu', null, 'fade');
    }

    handleInput(input, dt) {
      const click = input.consumeClick ? input.consumeClick() : null;
      /* M29.1 Desktop main.py:227-232 - idle_timer only advances while the player
         does nothing. Any interaction restarts the countdown, so a child typing a
         username/password is NEVER yanked into the attract screen mid-entry. */
      if (click) this.idleTimer = 0;
      if (click) {
        if (hit(click, this.userRect.x, this.userRect.y, this.userRect.w, this.userRect.h)) {
          this.activeField = 'user';
        } else if (hit(click, this.passRect.x, this.passRect.y, this.passRect.w, this.passRect.h)) {
          this.activeField = 'pass';
        } else if (hit(click, this.loginBtn.x, this.loginBtn.y, this.loginBtn.w, this.loginBtn.h)) {
          this._onLogin();
        } else if (hit(click, this.regBtn.x, this.regBtn.y, this.regBtn.w, this.regBtn.h)) {
          // M11: Desktop RegisterState ported — open the real register screen.
          global.Game.states.change('register', null, 'fade');
        }
      }
      const key = input.consumePressedKey ? input.consumePressedKey() : null;
      /* M29.1 Desktop main.py:227-232 - any key activity (typing, Backspace, Tab,
         Enter) restarts the attract countdown, exactly like a click. */
      if (key) this.idleTimer = 0;
      if (key) {
        const k = key.key;
        if (k === 'Backspace') {
          if (this.activeField === 'user') this.userInput = this.userInput.slice(0, -1);
          else this.passInput = this.passInput.slice(0, -1);
        } else if (k === 'Tab') {
          this.activeField = (this.activeField === 'user') ? 'pass' : 'user';
        } else if (k === 'Enter' || k === 'NumpadEnter') {
          this._onLogin();
        } else if (k && k.length === 1) {
          const cur = (this.activeField === 'user') ? this.userInput : this.passInput;
          if (cur.length < 20) {
            if (this.activeField === 'user') this.userInput += k;
            else this.passInput += k;
          }
        }
      }
    }

    /* M29 Desktop parity main.py:227-232 - idle_timer accumulates only while
       the player does nothing, then enters IdleGifState at >= 15.0s.
       This MUST live in the single existing update(): an earlier duplicate was
       shadowed by this one (last definition wins in a class body), so the attract
       screen never fired. */
    update(dt) {
      const d = dt || 0;
      if (this.errorTimer > 0) this.errorTimer = Math.max(0, this.errorTimer - d);
      if (this.infoTimer > 0) this.infoTimer = Math.max(0, this.infoTimer - d);
      this.idleTimer += d;
      if (this.idleTimer >= this.IDLE_GIF_DELAY) {
        this.idleTimer = 0;
        global.Game.states.change('idleGif', null, null);
      }
    }

    _drawField(R, rect, value, fieldKey, placeholder, isPassword) {
      R.fillRoundRect(rect.x, rect.y, rect.w, rect.h, 10, 'rgb(220,220,220)', null, 0);
      if (this.activeField === fieldKey) {
        R.fillRoundRect(rect.x, rect.y, rect.w, rect.h, 10, 'rgba(0,0,0,0)', 'rgb(150,150,150)', 2);
      }
      const display = isPassword ? new Array(value.length + 1).join('*') : value;
      const empty = value.length === 0;
      R.text(display || placeholder, rect.x + 15, rect.y + rect.h / 2, {
        font: '20px Quicksand, sans-serif',
        fill: empty ? '#aaaaaa' : '#505050',
        baseline: 'middle'
      });
    }

    draw(ctx, W2, H2) {
      const R = global.Game.renderer;
      R.clear('#ffffff');
      const bg = global.Game.assets && global.Game.assets.get('nen_game');
      if (bg && !bg.placeholder) {
        ctx.save();
        ctx.globalAlpha = 0.25;
        R.image(bg, 0, 0, W2, H2);
        ctx.restore();
      }
      R.text('MATHDRILL LOGIN', W2 / 2, 250, {
        font: 'bold 40px Quicksand, sans-serif', fill: '#788a9c', align: 'center', baseline: 'middle'
      });
      this._drawField(R, this.userRect, this.userInput, 'user', 'Tên đăng nhập', false);
      this._drawField(R, this.passRect, this.passInput, 'pass', 'Password', true);
      drawBtn(R, this.loginBtn.x, this.loginBtn.y, this.loginBtn.w, this.loginBtn.h,
        '🔑 Đăng Nhập', GREEN_BTN);
      drawBtn(R, this.regBtn.x, this.regBtn.y, this.regBtn.w, this.regBtn.h,
        '📝 Đăng Ký Mới', [158, 198, 229]);
      if (this.errorTimer > 0 && this.errorMsg) {
        R.text(this.errorMsg, W2 / 2, 750, {
          font: 'italic 22px Segoe UI, sans-serif', fill: '#c80000', align: 'center', baseline: 'middle'
        });
      } else if (this.infoTimer > 0 && this.infoMsg) {
        R.text(this.infoMsg, W2 / 2, 750, {
          font: '22px Quicksand, sans-serif', fill: '#2e6bd8', align: 'center', baseline: 'middle'
        });
      }
    }
  }

  // =========================================================
  // MENU STATE  (main.py:414-751) — dashboard 2 panel + mode cards
  // M4: chỉ Bài Học + Logout hoạt động; card khác hiển thị khóa
  // theo milestone port (M7/M9/M10).
  // M5: dashboard đọc PlayerData thật (level/exp/expToNextLevel/gold).
  // =========================================================
  /* ===================================================================
     M29.2 — TimeAttackState
     Faithful port of Desktop main.py:1745-1926 (class TimeAttackState).
     Entry: main.py:674-676, Menu card index 1, NO lock/level gate.
     Every numeric value carries its main.py line reference; the full
     rule table is in M29_2_TIMEATTACK_PARITY.md.
     =================================================================== */
  class TimeAttackState extends BaseState {
    constructor() {
      super('time_attack');
      const pl = getPlayer();
      this.grade = pl.grade || 1;                       // main.py:1747
      this.title = 'Time Attack';                       // main.py:1748
      this.score = 0;                                   // main.py:1749
      this.timeLeft = 60.0;                             // main.py:1750 TIME_LIMIT
      this.totalCorrect = 0;                            // main.py:1751
      this.totalAnswered = 0;                           // main.py:1752
      this.gameOver = false;                            // main.py:1753
      this.feedback = null;                             // main.py:1754
      this.pendingAdvance = false;                      // main.py:1755
      this.cardScale = 0.0;                             // main.py:1756
      // main.py:1757 FallingCloverEffect(15)
      this.cloverEffect = global.FallingClover ? new global.FallingClover(15) : null;
      // main.py:1758 adaptive_ai.reset()
      if (global.adaptiveAI && typeof global.adaptiveAI.reset === 'function') {
        global.adaptiveAI.reset();
      }
      // main.py:1759 update_combo(False) — reset the global combo streak
      pl.resetCombo();
      this.missing = false;
      this.buttons = [];
      this.nextQ();                                     // main.py:1761
      // main.py:1762 Button(20, HEIGHT-75, 200, 60, "THOÁT", RED_BTN)
      // NOTE: Desktop uses HEIGHT, not WIDTH. Using W put the button at y=1225,
      // off the bottom of the 800-tall logical canvas.
      this.backBtn = { x: 20, y: H - 75, w: 200, h: 60 };
    }

    // item_fx may not be instantiated in the Web build yet; use a neutral
    // null-object so Desktop's guards still run instead of throwing.
    _fx() {
      const fx = global.Game && global.Game.itemFx;
      if (fx && typeof fx.getTimeBonus === 'function') return fx;
      return {
        getScoreMultiplier: function () { return 1; },
        getTimeBonus: function () { return 0; },
        consumeQuestionCount: function () {},
        hasFreezeTimer: function () { return false; },
        tickTimers: function () {}
      };
    }

    /* Desktop constructs a NEW TimeAttackState on every entry
       (main.py:676 `trigger_transition(TimeAttackState())`), so every __init__
       value at main.py:1746-1762 is re-applied each time. The Web StateManager
       keeps ONE instance and calls enter(), so without this the second run would
       inherit the first run's timer, score and counters. */
    enter() {
      const pl = getPlayer();
      this.grade = pl.grade || 1;                       // main.py:1747
      this.score = 0;                                   // main.py:1749
      this.timeLeft = 60.0;                             // main.py:1750
      this.totalCorrect = 0;                            // main.py:1751
      this.totalAnswered = 0;                           // main.py:1752
      this.gameOver = false;                            // main.py:1753
      this.feedback = null;                             // main.py:1754
      this.pendingAdvance = false;                      // main.py:1755
      this.cardScale = 0.0;                             // main.py:1756
      // main.py:1757 a fresh effect per entry
      this.cloverEffect = global.FallingClover ? new global.FallingClover(15) : null;
      // main.py:1758 adaptive_ai.reset()
      if (global.adaptiveAI && typeof global.adaptiveAI.reset === 'function') {
        global.adaptiveAI.reset();
      }
      // main.py:1759 update_combo(False)
      pl.resetCombo();
      this.missing = false;
      this.buttons = [];
      this.nextQ();                                     // main.py:1761
    }

    // main.py:1763-1791 next_q()
    nextQ() {
      // main.py:1765 rid = randint(1,40) if grade == 1 else randint(1,60)
      const maxRid = this.grade === 1 ? 40 : 60;
      const rid = 1 + Math.floor(Math.random() * maxRid);
      const pl = getPlayer();
      // main.py:1766-1768 safe_generate_question(grade, rid, difficulty, user_id)
      const diff = (global.adaptiveAI && global.adaptiveAI.getCurrentDifficulty) ?
        global.adaptiveAI.getCurrentDifficulty() : 3;
      let res = null;
      try {
        res = global.Game.questionGen.generate(this.grade, rid, diff, pl.username);
      } catch (err) { L.error('[TimeAttack] generate error', err); }
      if (!res || !res.question) {
        L.warn('[TimeAttack] không nhận được câu hỏi — dừng vòng chơi');
        this.missing = true;
        return;
      }
      this.missing = false;
      this.q = String(res.question);
      this.ans = String(res.answer);
      this.opts = (res.options || []).map(String);
      this.op = res.op || null;
      // main.py:1770 btn_col = (220,150,50) if combo_multiplier > 1.5 else PURPLE_BTN
      const btnCol = pl.comboMultiplier > 1.5 ? [220, 150, 50] : PURPLE_BTN;
      // main.py:1772-1779 dynamic width: btn_w = max(240, max_tw + 80)
      let maxTw = 0;
      for (let i = 0; i < this.opts.length; i++) {
        maxTw = Math.max(maxTw, this.opts[i].length * 16);
      }
      const btnW = Math.max(240, maxTw + 80);
      const spacingX = 40, spacingY = 110;              // main.py:1780-1781
      // main.py:1782 start_x = WIDTH//2 - (btn_w*2 + spacing_x)//2
      const startX = W / 2 - Math.floor((btnW * 2 + spacingX) / 2);
      // main.py:1784-1788 two-column grid, y = 420 + (i//2)*110, h = 90
      this.buttons = this.opts.map(function (o, i) {
        return {
          x: startX + (i % 2) * (btnW + spacingX),
          y: 420 + Math.floor(i / 2) * spacingY,
          w: btnW, h: 90, value: o, index: i
        };
      });
      this.cardScale = 0.0;                             // main.py:1790
      // main.py:1791 adaptive_ai.start_question()
      if (global.adaptiveAI && typeof global.adaptiveAI.startQuestion === 'function') {
        global.adaptiveAI.startQuestion();
      }
      L.info('[TimeAttack] next question', rid, 'diff', diff);
    }

    // main.py:1792-1842 handle_event(e)
    handleInput(input, dt) {
      const click = input.consumeClick ? input.consumeClick() : null;
      const key = input.consumePressedKey ? input.consumePressedKey() : null;
      // main.py:1793-1795 after the result screen is entered, input is ignored.
      if (this.gameOver) return;
      // main.py:1796-1801 while feedback is up the ONLY accepted input is
      // MOUSEDOWN or SPACE, which dismisses and pulls the next question.
      // Everything else is swallowed, so a second answer can never be scored
      // for the same question (no duplicate scoring).
      if (this.feedback && this.feedback.active) {
        const isSpace = key && (key.key === ' ' || key.key === 'Space' ||
          key.key === 'Spacebar');
        if (click || isSpace) {
          this.feedback.active = false;                // main.py:1798
          this.pendingAdvance = false;                 // main.py:1799
          this.nextQ();                                // main.py:1800
        }
        return;
      }
      if (this.missing) return;
      if (click) {
        // main.py:1835-1842 back button restores menu music then MenuState()
        if (hit(click, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h)) {
          this._backToMenu();
          return;
        }
        // main.py:1803-1834 option click (first match wins -> main.py:1834 break)
        for (let i = 0; i < this.buttons.length; i++) {
          const b = this.buttons[i];
          if (!hit(click, b.x, b.y, b.w, b.h)) continue;
          this._answer(b.value);
          break;
        }
        return;
      }
      // M15-D2 parity convenience: Desktop is mouse-only, so the digit row is a
      // Web-only affordance resolving to the SAME option the mouse path clicks.
      // It never bypasses the feedback lock above.
      if (key && key.key && key.key.indexOf('Digit') === 0) {
        const n = parseInt(key.key.slice(5), 10);
        if (n >= 1 && n <= this.buttons.length) this._answer(this.buttons[n - 1].value);
      }
    }

    // main.py:1804-1834 — the scoring body of one answer click
    _answer(value) {
      const isCorrect = String(value) === String(this.ans);
      const pl = getPlayer();
      const fx = this._fx();
      this.totalAnswered += 1;                          // main.py:1806
      if (isCorrect) {
        this.totalCorrect += 1;                         // main.py:1808
        // main.py:1809 points = int(20 * combo_multiplier)
        let points = Math.trunc(20 * pl.comboMultiplier);
        // main.py:1811 points = int(points * item_fx.get_score_multiplier())
        points = Math.trunc(points * fx.getScoreMultiplier());
        // main.py:1812 consume_question_count("score_x3_10q")
        fx.consumeQuestionCount('score_x3_10q');
        this.score += points;                           // main.py:1813
        // main.py:1815-1816 time_add = 1.0 + time_bonus; time_left = min(60, +)
        const timeAdd = 1.0 + fx.getTimeBonus();
        this.timeLeft = Math.min(60, this.timeLeft + timeAdd);
        pl.updateCombo(true);
      } else {
        // main.py:1807-1816 the wrong branch scores nothing and grants no time
        pl.updateCombo(false);
      }
      // main.py:1821-1823 adaptive_ai.record_answer(is_correct, topic_id, type)
      if (global.adaptiveAI && typeof global.adaptiveAI.recordAnswer === 'function') {
        global.adaptiveAI.recordAnswer(isCorrect, this.grade + '_' + this.title, 'lesson');
      }
      // main.py:1832 FeedbackOverlay(..., is_ta=True)
      this.feedback = { active: true, correct: isCorrect };
      this.pendingAdvance = true;                       // main.py:1833
      L.info('[TimeAttack] answer', String(value), 'correct=' + isCorrect, 'score=' + this.score);
    }

    // main.py:1835-1842 back button
    _backToMenu() {
      // main.py:1837-1841 resume menu music (silent no-op if unavailable)
      try {
        const A = global.Game && global.Game.audio;
        if (A && typeof A.setBgm === 'function') A.setBgm('menu');
      } catch (e) { /* audio optional */ }
      global.Game.states.change('menu', null, null);
    }

    // main.py:1843-1864 update(dt)
    update(dt) {
      if (this.cloverEffect && typeof this.cloverEffect.update === 'function') {
        this.cloverEffect.update(dt);                   // main.py:1844
      }
      const fx = this._fx();
      fx.tickTimers(dt);                                // main.py:1845
      // main.py:1846-1859 the timer runs only when not game over AND no
      // feedback is showing, so reading the question never costs time.
      if (!this.gameOver && !(this.feedback && this.feedback.active)) {
        if (!fx.hasFreezeTimer()) {                    // main.py:1848
          this.timeLeft -= dt;                         // main.py:1849
        }
        // main.py:1850-1859 timeout. gameOver is set BEFORE the transition so
        // a later frame cannot transition a second time (no double result).
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;                           // main.py:1851
          this.gameOver = true;                        // main.py:1852
          const stats = {                             // main.py:1853-1858
            correct: this.totalCorrect,
            total: this.totalAnswered,
            accuracy: (this.totalCorrect / Math.max(1, this.totalAnswered)) * 100,
            avgTime: (global.adaptiveAI && global.adaptiveAI.getAvgTime) ?
              global.adaptiveAI.getAvgTime() : 0
          };
          // main.py:1859 VictoryState("HẾT GIỜ!", score, "Time Attack", stats)
          global.Game.states.change('victory', {
            title: 'HẾT GIỜ!', score: this.score,
            lessonTitle: 'Time Attack', stats: stats
          }, null);
          return;   // nothing else this frame once the state has changed
        }
      }
      // main.py:1860-1861 card_scale = min(1.0, card_scale + dt*6)
      if (this.cardScale < 1.0) this.cardScale = Math.min(1.0, this.cardScale + dt * 6);
    }

    // main.py:1865-1923 draw(s)
    draw(ctx, W2, H2) {
      const R = global.Game.renderer;
      // main.py:1866 clover layer is drawn BEFORE the temp surface. Seed the pool
      // through the same helper Menu/Victory/Defeat use so the 15 particles
      // actually spawn (Desktop main.py:1757 creates the effect; draw seeds it).
      cloverRain(this.cloverEffect, 15);
      drawClover(R, this.cloverEffect);
      // main.py:1869 background_img else fill (30,40,60)
      const bg = global.Game.assets && global.Game.assets.get('nen_game');
      if (bg && !bg.placeholder) R.image(bg, 0, 0, W2, H2);
      else R.clear('rgb(30,40,60)');
      // main.py:1870 draw_top_bar(temp)
      drawTopBar(R, ctx, W2, getPlayer().comboStreak);

      // main.py:1872-1874 timer: (200,80,80) under 10s else WHITE, centred y=80
      const timerCol = this.timeLeft < 10 ? 'rgb(200,80,80)' : '#ffffff';
      R.text('⏱ ' + Math.trunc(this.timeLeft) + 's', W2 / 2, 80, {
        font: 'bold 40px Quicksand, Segoe UI Emoji, sans-serif',
        fill: timerCol, align: 'center', baseline: 'middle'
      });

      // main.py:1876-1884 question card 800x200, scale-animated
      if (!this.missing) {
        const cardW = 800, cardH = 200;                // main.py:1876
        const sc = this.cardScale;
        const dw = Math.trunc(cardW * sc), dh = Math.trunc(cardH * sc);
        const qx = W2 / 2 - Math.floor(dw / 2);
        const qy = 220 + Math.floor((cardH - dh) / 2); // main.py:1879
        // main.py:1881 shadow (0,0,0,60) at (+5,+8) radius 30
        R.fillRoundRect(qx + 5, qy + 8, dw, dh, 30, 'rgba(0,0,0,0.235)', null, 0);
        // main.py:1883 white body radius 30
        R.fillRoundRect(qx, qy, dw, dh, 30, '#ffffff', null, 0);
        // main.py:1884 border (255,150,50) width 5 radius 30
        R.fillRoundRect(qx, qy, dw, dh, 30, null, 'rgb(255,150,50)', 5);
        // main.py:1885-1910 the question text only once sc > 0.5
        if (sc > 0.5) {
          R.text(this.q, qx + dw / 2, qy + dh / 2, {
            font: 'bold 32px Quicksand, sans-serif', fill: 'rgb(40,40,40)',
            align: 'center', baseline: 'middle', maxWidth: cardW - 60
          });
        }
      }

      // main.py:1912-1913 current score, (255,225,100), centred y=390
      R.text('ĐIỂM HIỆN TẠI: ' + this.score, W2 / 2, 390, {
        font: 'bold 28px Quicksand, sans-serif', fill: 'rgb(255,225,100)',
        align: 'center', baseline: 'middle'
      });

      // main.py:1914-1917 buttons + back button (main.py:1762)
      const pl = getPlayer();
      const btnCol = pl.comboMultiplier > 1.5 ? [220, 150, 50] : PURPLE_BTN;
      for (let i = 0; i < this.buttons.length; i++) {
        const b = this.buttons[i];
        drawBtn(R, b.x, b.y, b.w, b.h, b.value, btnCol, { fontSize: 24 });
        R.text(String(i + 1), b.x + 22, b.y + b.h / 2, {
          font: 'bold 22px Quicksand, sans-serif', fill: 'rgba(255,255,255,0.85)',
          align: 'center', baseline: 'middle'
        });
      }
      drawBtn(R, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h,
        '🚪 THOÁT', RED_BTN, { fontSize: 16 });

      // main.py:1919 confetti / :1921-1922 feedback overlay
      if (this.feedback && this.feedback.active) {
        const fcol = this.feedback.correct ? '#16a34a' : '#dc2626';
        R.fillRoundRect(W2 / 2 - 300, 300, 600, 120, 18, 'rgba(10,14,28,0.92)', fcol, 3);
        R.text(this.feedback.correct ? '✔ Đúng rồi! (bấm để tiếp tục)'
          : '✘ Sai rồi — bấm để tiếp tục', W2 / 2, 340, {
          font: 'bold 24px Quicksand, sans-serif', fill: '#ffffff',
          align: 'center', baseline: 'middle'
        });
        if (!this.feedback.correct) {
          R.text('Đáp án Đúng: ' + this.ans, W2 / 2, 388, {
            font: '18px Quicksand, sans-serif', fill: '#ffe9a8',
            align: 'center', baseline: 'middle'
          });
        }
      }
    }
  }

  /* ===================================================================
     M30.1 — ExamTransitionState
     Faithful port of Desktop main.py:3091-3138 (class ExamTransitionState).
     Entry + lock: main.py:682-698 (Menu card 3).
     Hands off to FinalExamState() at main.py:3118 with NO arguments.
     GameState.handle_event is a no-op (game_init.py:2430), so Desktop's
     ExamTransitionState accepts NO input at all — it is fully automatic.
     =================================================================== */
  class ExamTransitionState extends BaseState {
    constructor() {
      super('exam_transition');
      this._init();
    }

    /* M29.2 lesson: StateManager reuses ONE instance, so every Desktop __init__
       value (main.py:3092-3101) must be re-applied in enter() or a second run
       would inherit the first run's timer and animation position. */
    _init() {
      this.timer = 0;                     // main.py:3093
      this.duration = 2.5;                 // main.py:3094
      this.bookW = 1200;                   // main.py:3095
      this.bookH = 700;                    // main.py:3096
      this.bookX = Math.floor(W / 2);      // main.py:3097 WIDTH // 2 = 650
      this.bookY = Math.floor(H / 2);      // main.py:3098 HEIGHT // 2 = 400
      this.paperY = H + 100;               // main.py:3099
      this.paperAlpha = 0;                 // main.py:3100
      this.paperRotation = 15.0;           // main.py:3101
      this.completed = false;              // guards against a second handoff
    }

    // Desktop main.py:2429 enter() is `pass`; all setup is in __init__.
    enter() { this._init(); }

    // Desktop GameState.handle_event is a no-op (game_init.py:2430), and
    // ExamTransitionState does not override it -> NO input is accepted.
    handleInput() { /* intentionally inert: Desktop accepts none */ }

    // main.py:3102-3118 update(dt)
    update(dt) {
      if (this.completed) return;
      this.timer += dt;                                            // :3103
      const prog = Math.min(this.timer / this.duration, 1.0);      // :3104
      if (prog <= 0.4) {                                           // :3105
        const p1 = prog / 0.4;
        this.bookW = Math.trunc(Math.max(40, 1200 * (1 - p1)));    // :3107
      } else if (prog <= 0.65) {                                   // :3108
        const p2 = (prog - 0.4) / 0.25;
        this.bookX = Math.trunc(Math.floor(W / 2) - (W * p2));     // :3110
      }
      if (prog > 0.6) {                                            // :3111
        const p3 = (prog - 0.6) / 0.4;
        const targetY = Math.floor(H / 2);                         // :3113
        this.paperY = Math.trunc(H - (H - targetY) * p3);          // :3114
        this.paperAlpha = Math.trunc(255 * p3);                    // :3115
        this.paperRotation = 15.0 * (1 - p3);                      // :3116
      }
      if (prog >= 1.0) {                                           // :3117
        // main.py:3118 manager.change(FinalExamState()) - no arguments.
        // FinalExamState is not ported yet (M30.2); the guard keeps the
        // automatic handoff from throwing on an unregistered state instead of
        // silently pretending the exam ran.
        this.completed = true;
        // StateManager stores registered states on .states (state_manager.js:30)
        // and there is no has() helper, so check the registry directly.
        const SM = global.Game.states;
        if (SM && SM.states && SM.states.final_exam) {
          SM.change('final_exam', null, null);
        } else {
          L.warn('[ExamTransition] FinalExamState not registered yet (M30.2)');
        }
      }
    }

    // main.py:3119-3137 draw(s)
    draw(ctx, W2, H2) {
      const R = global.Game.renderer;
      R.clear('rgb(165,214,167)');                                 // :3120
      // :3121-3126 the book shrinks then slides off to the left
      if (this.bookX > -300) {
        const bw = this.bookW, bh = this.bookH;
        const bx = this.bookX - Math.floor(bw / 2);
        const by = this.bookY - Math.floor(bh / 2);
        R.fillRoundRect(bx, by, bw, bh, 10, 'rgb(101,67,33)', null, 0);   // :3124
        // :3125-3126 spine: width max(15, book_w//10), colour (60,40,20)
        const spineW = Math.max(15, Math.floor(this.bookW / 10));
        R.fillRoundRect(this.bookX - Math.floor(spineW / 2), by,
          spineW, bh, 5, 'rgb(60,40,20)', null, 0);
      }
      // :3127-3137 the exam paper rises, un-rotates and fades in
      if (this.paperAlpha > 0) {
        const pw = 850, ph = 700;                                   // :3128
        const px = Math.floor(W2 / 2 - pw / 2);
        const py = Math.floor(this.paperY - ph / 2);
        const a = this.paperAlpha / 255;
        R.fillRoundRectAlpha(px, py, pw, ph, 5, '#ffffff', a);      // :3130
        // :3131 2px border, same alpha, colour (0,0,0)
        const gc = R.ctx;
        if (gc && typeof gc.save === 'function') {
          gc.save(); gc.globalAlpha = a;
          R.fillRoundRect(px, py, pw, ph, 5, null, 'rgb(0,0,0)', 2);
          gc.restore();
        }
        // :3132-3134 fourteen ruled lines from y=100+i*40, colour (220,230,255)
        const lc = R.ctx;
        if (lc && typeof lc.save === 'function') {
          lc.save();
          lc.globalAlpha = (this.paperAlpha / 2) / 255;
          lc.strokeStyle = 'rgb(220,230,255)';
          lc.lineWidth = 1;
          for (let i = 1; i < 15; i++) {
            const lineY = 100 + i * 40;
            lc.beginPath();
            lc.moveTo(px + 50, py + lineY);
            lc.lineTo(px + pw - 50, py + lineY);
            lc.stroke();
          }
          lc.restore();
        }
      }
    }
  }

  class MenuState extends BaseState {
    constructor() {
      super('menu');
      this.time = 0;
      this.fadeIn = 0;
      // Desktop main.py:422 — MenuState clover layer is FallingCloverEffect(20).
      this.cloverEffect = global.FallingClover ? new global.FallingClover(20) : null;
      this.examMsg = '';
      this.examMsgTimer = 0;
      const card_y1 = 155, card_w = 240, card_h = 90, gap = 25, x = 680;
      const card_y2 = card_y1 + card_h + 20;
      const card_y3 = card_y2 + card_h + 20;
      const card_y4 = card_y3 + 65 + 20;
      const card_y5 = card_y4 + 55 + 20;
      const row4_x = x - 50;
      this.cards = [
        { id: 'lesson', x: x, y: card_y1, w: card_w, h: card_h, icon: '🎓', label: 'Bài Học', sub: 'Luyện tập theo chương', bg: BLUE_BTN },
        { id: 'time', x: x + card_w + gap, y: card_y1, w: card_w, h: card_h, icon: '⏱️', label: 'Time Attack', sub: 'Chơi nhanh ghi điểm', bg: ORANGE_BTN },
        { id: 'daily', x: x, y: card_y2, w: card_w, h: card_h, icon: '🔥', label: 'Thử Thách', sub: 'Bài tập hằng ngày', bg: YELLOW_BTN },
        { id: 'exam', x: x + card_w + gap, y: card_y2, w: card_w, h: card_h, icon: '📝', label: 'Thi Chuyển Lớp', sub: 'Kiểm tra tổng hợp', bg: [180, 130, 200], },
        { id: 'ach', x: x, y: card_y3, w: 140, h: 65, icon: '🏆', label: 'Thành Tích', bg: GREEN_BTN },
        { id: 'profile', x: x + 155, y: card_y3, w: 140, h: 65, icon: '👤', label: 'Hồ Sơ', bg: PURPLE_BTN },
        { id: 'settings', x: x + 310, y: card_y3, w: 140, h: 65, icon: '⚙️', label: 'Cài Đặt', bg: SHADOW },
        { id: 'logout', x: row4_x, y: card_y4, w: 110, h: 55, icon: '🚪', label: 'Thoát', bg: RED_BTN },
        { id: 'shop', x: row4_x + 120, y: card_y4, w: 110, h: 55, icon: '🛒', label: 'Shop', bg: GREEN_BTN },
        { id: 'skill', x: row4_x + 240, y: card_y4, w: 110, h: 55, icon: '🌳', label: 'K.Năng', bg: PURPLE_BTN },
        { id: 'gacha', x: row4_x + 360, y: card_y4, w: 140, h: 55, icon: '🏪', label: 'Đổi Thẻ', bg: [130, 80, 220] },
        { id: 'bag', x: row4_x + 510, y: card_y4, w: 110, h: 55, icon: '🎒', label: 'Túi Đồ', bg: [80, 140, 200] },
        { id: 'pet', x: row4_x + 120, y: card_y5, w: 110, h: 55, icon: '🐾', label: 'Pet', bg: ORANGE_BTN },
        { id: 'skin', x: row4_x + 240, y: card_y5, w: 110, h: 55, icon: '🎨', label: 'Bút&Bảng', bg: [120, 160, 220] },
        { id: 'admin', x: row4_x + 360, y: card_y5, w: 110, h: 55, icon: '🛡️', label: 'Admin', bg: [110, 95, 150] }
      ];
    }

    async enter() {
      this.time = 0;
      this.fadeIn = 0;
      this.examMsg = '';
      this.examMsgTimer = 0;
      // M10-B: sync progress to the server whenever the player returns to the
      // menu (covers victory/defeat continue and the lesson back button).
      const G = global.Game;
      if (G.auth && typeof G.auth.save === 'function' && G.auth.currentUser && G.player) {
        const d = G.auth.data();
        d.xp = G.player.exp;
        d.level = G.player.level;
        d.gold = G.player.gold;
        G.auth.save();
      }
      await syncPlayerToServer();
      // Python: sound_manager.set_bgm("menu") — M4 chưa bật BGM
      // (web/audio/ mới có 1 file, tránh 404 console; bật ở M8).
      L.info('[Menu] enter — user:', getPlayer().username, '| grade', getPlayer().grade);
    }

    exit() {}

    handleInput(input, dt) {
      const click = input.consumeClick ? input.consumeClick() : null;
      if (!click) return;
      for (let i = 0; i < this.cards.length; i++) {
        const c = this.cards[i];
        if (!hit(click, c.x, c.y, c.w, c.h)) continue;
        if (c.locked) {
          /* M15-D1 REPRODUCED: the card said "sẽ mở ở M7" / "M10", which are
             developer milestone labels, not milestones a child can act on. The
             build genuinely cannot deliver either mode, so the honest fix is
             player-meaningful wording that promises no date and no version.
             Desktop (main.py:1743) does implement TimeAttackState, so this is a
             port gap, not a design decision — see M15_REQUIREMENTS D1. */
          this.examMsg = c.label + ' đang được xây dựng. Hãy chơi các bài bình thường nhé!';
          this.examMsgTimer = 2.5;
          L.info('[Menu] locked card:', c.id, '→', c.locked);
          return;
        }
        if (c.id === 'lesson') {
          /* M25.1: turn the book page instead of fading the whole viewport. The
             destination is committed only when the curl finishes. */
          var goLesson = function () {
            global.Game.states.change('lesson_select', { grade: getPlayer().grade }, null);
          };
          if (this._rbNav && typeof this._rbNav.next === 'function') this._rbNav.next(goLesson);
          else goLesson();
        } else if (c.id === 'exam') {
          /* M30.1 Desktop parity: main.py:682-698. The exam unlocks when EVERY
             lesson for the player's grade is unlocked -- NOT at a milestone:
               max_unlocked_lesson = (user_level - 1) // 6 + 1
               if max_unlocked_lesson >= len(all_lessons): start the exam
               else: "Can mo khoa them {remaining} bai hoc" for 3.0s (main.py:696-698) */
          var exGrade = getPlayer().grade || 1;
          // Desktop main.py:687 len(all_lessons); the Web loader is async, so
          // use the synchronous curriculum count (M30.1 DataLoader).
          var exTotal = (global.DataLoader && global.DataLoader.lessonCountForGrade)
            ? global.DataLoader.lessonCountForGrade(exGrade) : 0;
          var exLevel = getPlayer().level || 1;
          var exMaxUnlocked = Math.floor((exLevel - 1) / 6) + 1;   // main.py:690
          if (exTotal > 0 && exMaxUnlocked >= exTotal) {
            var goExam = function () {
              global.Game.states.change('exam_transition', null, null);
            };
            // Desktop main.py:693 uses transition_type="PAGE" (the book flip).
            if (this._rbNav && typeof this._rbNav.next === 'function') this._rbNav.next(goExam);
            else goExam();
          } else {
            var exRemaining = Math.max(0, exTotal - exMaxUnlocked);        // main.py:696
            this.examMsg = 'Can mo khoa them ' + exRemaining +
              ' bai hoc de thi chuyen lop!';                            // main.py:697
            this.examMsgTimer = 3.0;                                       // main.py:698
            L.info('[Menu] exam locked:', exRemaining, 'lessons remaining');
          }
        } else if (c.id === 'time') {
          /* M29.2 Desktop parity: main.py:674-676 opens TimeAttackState directly,
             with the same PAGE (book-flip) transition main.py:668-670 gives card 0.
             Desktop has no lock/level gate on this card, so the invented M7 lock
             is removed here. */
          var goTimeAttack = function () {
            global.Game.states.change('time_attack', null, null);
          };
          if (this._rbNav && typeof this._rbNav.next === 'function') this._rbNav.next(goTimeAttack);
          else goTimeAttack();
        } else if (c.id === 'daily') {
          global.Game.states.change('daily', null, 'fade');
        } else if (c.id === 'ach') {
          global.Game.states.change('achievement', null, 'fade');
        } else if (c.id === 'profile') {
          global.Game.states.change('profile', null, 'fade');
        } else if (c.id === 'shop') {
          global.Game.states.change('shop', null, 'fade');
        } else if (c.id === 'skill') {
          global.Game.states.change('skill_tree', null, 'fade');
        } else if (c.id === 'gacha') {
          /* M31 Desktop parity: main.py:463 declares this control as
             gacha_normal_btn = CardButton(row4_x+360, card_y4, 140, 55,
             "🏪", "ĐốI Thẻ", "", (130,80,220), ...)
             and main.py:719-724 routes it to CardShopState() -- the gold
             card-exchange shop, NOT a random gacha. The Web routed it to
             GachaState, which is not a Desktop screen at all. Grades 1-2 are
             blocked by is_young_learner (game_init.py:145-152). */
          var csGrade = getPlayer().grade || 1;
          if (isYoungLearnerGrade(csGrade)) {
            this.examMsg = 'Tinh nang nay se mo khoa khi con len lop 3 nhe! 🌱';
            this.examMsgTimer = 2.5;
            L.info('[Menu] card shop blocked for young learner, grade', csGrade);
          } else {
            global.Game.states.change('cardShop', null, 'fade');
          }
        } else if (c.id === 'bag') {
          global.Game.states.change('bag', null, 'fade');
        } else if (c.id === 'pet') {
          global.Game.states.change('pet', null, 'fade');
        } else if (c.id === 'skin') {
          global.Game.states.change('skin', null, 'fade');
        } else if (c.id === 'settings') {
          global.Game.states.change('settings', null, 'fade');
        } else if (c.id === 'admin') {
          // M10-D: server là authority — client chỉ hỏi /api/admin/me.
          // 200 → mở AdminPanel; 401/403 → thông báo, KHÔNG change state,
          // KHÔNG tự quyết quyền ở client.
          const self = this;
          fetch('/api/admin/me', { credentials: 'include' }).then(function (r) {
            if (r.status === 200) {
              global.Game.states.change('adminPanel', null, 'fade');
            } else {
              self.examMsg = 'Chỉ Admin mới vào được mục này! (' + r.status + ')';
              self.examMsgTimer = 3;
              L.warn('[Menu] admin access denied by server:', r.status);
            }
          }).catch(function (err) {
            self.examMsg = 'Không thể kết nối máy chủ';
            self.examMsgTimer = 3;
            L.warn('[Menu] admin check error:', err && err.message);
          });
        } else if (c.id === 'logout') {
          // Python LogoutState (main.py:706-710): current_user = None.
          // M5: sync player → account data, persist, xoá session, player=null.
          const G = global.Game;
          if (G.auth && typeof G.auth.save === 'function' && G.auth.currentUser && G.player) {
            const d = G.auth.data();
            d.xp = G.player.exp;
            d.level = G.player.level;
            d.gold = G.player.gold;
            G.auth.save();
            /* M10-B: persist BEFORE the session is destroyed (after logout the
               player endpoint is no longer reachable with this cookie). */
            syncPlayerToServer();
            G.auth.logout();
          }
          const Save = global.Save;
          if (Save && Save.save && G.player) {
            Save.save(Save.KEYS.PLAYER, G.player.getSaveData());
          }
          if (Save && Save.remove) Save.remove(Save.KEYS.SESSION);
          G.player = null;
          global.Game.states.change('login', { prefill: '' }, 'fade');
        }
        return;
      }
    }

    update(dt) {
      this.time += dt;
      this.fadeIn = Math.min(1, this.fadeIn + dt * 2.5);
      if (this.examMsgTimer > 0) this.examMsgTimer = Math.max(0, this.examMsgTimer - dt);
      // Desktop main.py:228 — clover_effect.update(dt) drives the rain layer.
      if (this.cloverEffect) {
        cloverRain(this.cloverEffect, 20);
        if (typeof this.cloverEffect.update === 'function') this.cloverEffect.update(dt);
      }
    }

    draw(ctx, W2, H2) {
      const R = global.Game.renderer;
      const p = getPlayer();
      /* Desktop main.py:732-739 MenuState.draw background stack:
           1. s.fill((25,35,65))
           2. draw_gradient((25,35,65) -> (95,155,220))   game_init.py:3528
           3. background_img scaled to (1300,800) at alpha 60
         M18 restores the gradient and the background image at the source alpha. */
      R.clear('rgb(25,35,65)');
      R.gradient([25, 35, 65], [95, 155, 220]);
      const _menuBg = global.Game.assets && global.Game.assets.get('nen_game');
      if (_menuBg && !_menuBg.placeholder) {
        ctx.save();
        ctx.globalAlpha = 0.235;   // 60/255 to match Desktop's alpha=60
        R.image(_menuBg, 0, 0, W2, H2);
        ctx.restore();
      }
      R.fillRoundRect(0, 0, W2, H2, 0, 'rgba(25,35,65,0.18)', null, 0);
      /* M21: Desktop main.py:734-745 draw order is
           s.fill -> draw_gradient -> background_img -> math_particles -> clover
           -> self.book.draw(...) -> content
         so the book belongs AFTER the background art. The _bookDrawBase hook fires
         on R.clear/R.gradient, which is too early here — the art painted afterwards
         covered the book, leaving the menu on a bare gradient. The fix is to suppress
         the hook for Menu and paint here, at the Desktop position, exactly once.
         T05 (ui_parity_p1) asserts book.draw is called exactly once per frame; drawing
         it here AND letting the hook fire produced a double paint and failed T05. */
      if (this._rbBook && typeof this._rbBook.draw === 'function') {
        /* M25.1: withTransition so the M22 curl actually renders on Menu. The
           book is still painted exactly once per frame (ui_parity_p1 T05). */
        try { this._rbBook.draw(R, null, null, !!this._rbBook.flipping); } catch (e) { /* never break draw */ }
      }
      /* Book chrome (Desktop main.py:745 RealisticBook(50,50,1200,700)) is painted
         by the REALISTICBOOK_P1 integration, which hooks Renderer.clear() and emits
         the chrome right after this clear. NOTE: the dashboard backdrop above is an
         opaque dark wash (Desktop main.py draws its Menu content *inside* the cream
         pages instead), so the chrome stays behind the panels on purpose — forcing
         the cream pages forward here would put near-white text at ~2:1 contrast. */
      // Clover layer — Desktop main.py:743 draws it before the book (background layer).
      drawClover(R, this.cloverEffect);
      R.text('MATHDRILL', W2 / 2, 46, {
        font: 'bold 34px Quicksand, sans-serif', fill: '#e0ecff', align: 'center', baseline: 'middle'
      });
      // LEFT panel — dashboard (Python draw_left)
      R.fillRoundRect(60, 120, 560, 640, 18, 'rgba(255,255,255,0.06)', 'rgba(120,150,220,0.35)', 2);
      const hour = new Date().getHours();
      const g = hour < 12 ? 'Chào buổi sáng,' : (hour < 18 ? 'Chào buổi chiều,' : 'Chào buổi tối,');
      R.text(g, 100, 180, { font: '20px Quicksand, sans-serif', fill: '#b9c4de', baseline: 'middle' });
      R.text(String(p.username).toUpperCase(), 100, 215, {
        font: 'bold 30px Quicksand, sans-serif', fill: '#f2f5fb', baseline: 'middle'
      });
      this._badge(R, 100, 255, 'Level ' + p.level, [230, 245, 230], [45, 120, 45]);
      this._badge(R, 260, 255, 'Lớp ' + p.grade, [230, 235, 250], [45, 80, 160]);
      this._xpBar(R, 100, 310, 470, 24, p.exp, p.expToNextLevel);
      R.text('Vàng: ' + p.gold, 100, 365, { font: '18px Quicksand, sans-serif', fill: '#f3e2b0', baseline: 'middle' });
      R.fillRoundRect(680, 120, 560, 640, 18, 'rgba(255,255,255,0.06)', 'rgba(150,120,255,0.35)', 2);
      R.text('Chọn chế độ chơi:', 730, 150, {
        font: 'bold 24px Quicksand, sans-serif', fill: '#e9e2ff', baseline: 'middle'
      });
      for (let i = 0; i < this.cards.length; i++) this._drawCard(R, this.cards[i]);
      if (this.examMsgTimer > 0 && this.examMsg) {
        R.text(this.examMsg, W2 / 2, 745, {
          font: '20px Quicksand, sans-serif', fill: '#c85050', align: 'center', baseline: 'middle'
        });
      }
    }

    _badge(R, x, y, label, bgCol, textCol) {
      const w = 24 + label.length * 9;
      R.fillRoundRect(x, y, w, 28, 8, css(bgCol), null, 0);
      R.text(label, x + w / 2, y + 14, {
        font: 'bold 15px Quicksand, sans-serif', fill: css(textCol), align: 'center', baseline: 'middle'
      });
      return w;
    }

    _xpBar(R, x, y, w, h, cur, need) {
      const pct = need > 0 ? Math.min(1, cur / need) : 0;
      R.fillRoundRect(x, y, w, h, 11, 'rgba(255,255,255,0.15)', null, 0);
      if (pct > 0) R.fillRoundRect(x, y, w * pct, h, 11, '#5eead4', null, 0);
      R.fillRoundRect(x, y, w, h, 11, 'rgba(0,0,0,0)', 'rgba(255,255,255,0.6)', 1);
      R.text('EXP ' + cur + '/' + need, x + w / 2, y + h / 2, {
        font: 'bold 14px Quicksand, sans-serif', fill: '#ffffff', align: 'center', baseline: 'middle'
      });
    }

    _drawCard(R, c) {
      R.fillRoundRect(c.x, c.y, c.w, c.h, 16, css(c.bg), '#ffffff', 2);
      R.text(c.icon, c.x + 16, c.y + c.h / 2, {
        font: (c.h > 70 ? 30 : 22) + 'px "Segoe UI Emoji", sans-serif', baseline: 'middle'
      });
      R.text(c.label, c.x + 54, c.y + (c.h > 70 ? c.h / 2 - 8 : c.h / 2), {
        font: 'bold ' + (c.h > 70 ? 18 : 15) + 'px Quicksand, sans-serif',
        fill: '#ffffff', baseline: 'middle'
      });
      if (c.sub && c.h > 70) {
        R.text(c.sub, c.x + 54, c.y + c.h / 2 + 18, {
          font: '13px Quicksand, sans-serif', fill: 'rgba(255,255,255,0.75)', baseline: 'middle'
        });
      }
      if (c.locked) {
        R.text('🔒', c.x + c.w - 24, c.y + c.h / 2, {
          font: '18px "Segoe UI Emoji", sans-serif', baseline: 'middle'
        });
      }
    }

  }

  // =========================================================
  // LESSON SELECT STATE  (main.py:922-976)
  // M4: danh sách bài lấy từ Game.dataLoader (chưa có → panel chờ,
  // KHÔNG hard-code lesson). Luật mở khóa giữ nguyên Python:
  // max_unlocked_lesson = (level-1)//6 + 1.
  // =========================================================
  /* FINAL QA fix — data_loader.getLessonsForGrade() resolves to OBJECTS
     ({id,title,template,type,range}), while this state (and the states it
     forwards to: TheoryState/LessonState, matching main.py where `lesson` is a
     title string) needs the lesson TITLE. Without this normalization every
     lesson button rendered "[object Object]" and the theory lookup always
     missed. Accepts legacy string lists unchanged. */
  function _lessonTitles(list) {
    return (list || []).map(function (l) {
      if (l && typeof l === 'object') {
        return String(l.title !== undefined && l.title !== null ? l.title : l.id);
      }
      return String(l);
    });
  }

  /* P0 FIX (question pipeline): the lesson state needs the NUMERIC lesson id,
     not the display title, because QuestionGenerator.generate_question() routes
     on `lesson_id` numerically. Forwarding the title string (e.g. "Bài 1") made
     `lesson_id` non-numeric, so every grade-1 lesson fell through to the generic
     branch and produced `"Tính nhanh: Bài 1 - 1 = ?"` with correct_answer "NaN"
     (1/10 variety — the same nonsense question forever). Titles are still used
     for display + theory lookup; ids travel alongside them. Accepts legacy
     string lists (falls back to the 1-based position). */
  function _lessonIds(list) {
    return (list || []).map(function (l, i) {
      if (l && typeof l === 'object') {
        var n = parseInt(l.id, 10);
        if (isFinite(n) && n > 0) return n;
        var m = /(\d+)/.exec(String(l.title || ''));
        if (m) return parseInt(m[1], 10);
      }
      var s = /(\d+)/.exec(String(l));
      if (s) return parseInt(s[1], 10);
      return i + 1;
    });
  }

  class LessonSelectState extends BaseState {
    constructor() {
      super('lesson_select');
      this.grade = 1;
      this.lessons = [];
      this.dataMissing = false;
      this.loading = false;
      this.itemsPerPage = 8;
      this.currentPage = 0;
      this.totalPages = 1;
      this.lessonIds = [];       // P0: numeric ids parallel to this.lessons
      this.backBtn = { x: 80, y: 650, w: 150, h: 50 };
      this.prevBtn = { x: 720, y: 650, w: 150, h: 50 };
      this.nextBtn = { x: 1030, y: 650, w: 150, h: 50 };
    }

    enter(params) {
      this.grade = (params && params.grade) || getPlayer().grade || 1;
      this.currentPage = 0;
      this.lessons = [];
      this.lessonIds = [];
      this.dataMissing = false;
      this.loading = true;
      const loader = global.Game && global.Game.dataLoader;
      if (loader && typeof loader.getLessonsForGrade === 'function') {
        const self = this;
        const ret = loader.getLessonsForGrade(this.grade);
        // Support BOTH sync array (M4 test mock / Python sync semantics)
        // and Promise (M7-B real data_loader.js async).
        if (ret && typeof ret.then === 'function') {
          ret.then(function (lessons) {
            self.lessons = _lessonTitles(lessons);
            self.lessonIds = _lessonIds(lessons);
            self.loading = false;
            self.totalPages = Math.max(1, Math.ceil(self.lessons.length / self.itemsPerPage));
            L.info('[LessonSelect] lessons:', self.lessons.length, '| grade', self.grade);
          }).catch(function (err) {
            self.lessons = [];
            self.lessonIds = [];
            self.loading = false;
            self.dataMissing = true;
            L.error('[LessonSelect] failed to load lessons:', err);
          });
          this.totalPages = 1;
        } else {
          self.lessons = _lessonTitles(ret);
          self.lessonIds = _lessonIds(ret);
          self.loading = false;
          self.dataMissing = false;
          self.totalPages = Math.max(1, Math.ceil(self.lessons.length / self.itemsPerPage));
        }
      } else {
        this.dataMissing = true;
        this.loading = false;
        this.totalPages = 1;
        L.warn('[LessonSelect] dataLoader chưa có — hiển thị panel chờ');
      }
    }

    exit() {}

    handleInput(input, dt) {
      const click = input.consumeClick ? input.consumeClick() : null;
      if (!click) return;
      if (hit(click, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h)) {
        global.Game.states.change('menu', null, 'fade');
        return;
      }
      if (this.dataMissing || this.loading) return;
      if (hit(click, this.nextBtn.x, this.nextBtn.y, this.nextBtn.w, this.nextBtn.h)
          && this.currentPage < this.totalPages - 1) {
        /* M25.1: M22 advanced currentPage IMMEDIATELY, so the destination page was
           already drawn on the page that was still turning. The index now changes
           only once the curl has completed. "SAU" moves forward, so the left page
           contracts toward the spine -> slide_left. */
        var selfN = this;
        var goN = function () { selfN.currentPage += 1;
          L.info('[LessonSelect] page', selfN.currentPage + 1, '/', selfN.totalPages); };
        if (this._rbNav && typeof this._rbNav.next === 'function') this._rbNav.next(goN);
        else goN();
        return;
      }
      if (hit(click, this.prevBtn.x, this.prevBtn.y, this.prevBtn.w, this.prevBtn.h)
          && this.currentPage > 0) {
        /* "TRUOC" goes back: the right page contracts toward the spine. */
        var selfP = this;
        var goP = function () { selfP.currentPage -= 1; };
        if (this._rbNav && typeof this._rbNav.prev === 'function') this._rbNav.prev(goP);
        else goP();
        return;
      }
      const startIdx = this.currentPage * this.itemsPerPage;
      for (let i = 0; i < this.itemsPerPage; i++) {
        const idx = startIdx + i;
        if (idx >= this.lessons.length) break;
        const bx = (i < 4) ? 100 : 720;
        const by = 150 + (i % 4) * 110;
        if (hit(click, bx, by, 480, 80)) {
          const lesson = this.lessons[idx];
          const lessonId = this.lessonIds[idx] !== undefined ? this.lessonIds[idx] : (idx + 1);
          const maxUnlocked = Math.floor((getPlayer().level - 1) / 6) + 1;
          if (idx + 1 <= maxUnlocked) {
            L.info('[LessonSelect] mở bài:', lesson, '| id', lessonId);
            // Parity main.py:960 — LessonSelect → TheoryState → LessonState
            global.Game.states.change('theory', { grade: this.grade, title: lesson, lessonId: lessonId }, 'fade');
          } else {
            L.info('[LessonSelect] bài khóa — cần level', (idx + 1 - 1) * 6 + 1);
          }
          return;
        }
      }
    }

    update(dt) {}

    draw(ctx, W2, H2) {
      const R = global.Game.renderer;
      R.clear('#a5d6a7');
      /* Book chrome: Desktop main.py:2084 (LessonSelectState) fills the green
         background and *then* draws RealisticBook(50,50,1200,700) — the same order
         the REALISTICBOOK_P1 integration reproduces by hooking this clear. The raw
         frame that used to sit here was painted before the clear, so Renderer.clear()
         (a full-canvas fillRect) erased it every frame; the chrome now comes from
         UI.RealisticBook, which also carries the Desktop page geometry. */
      R.text('KHỐI LỚP ' + this.grade, W2 / 2, 80, {
        font: 'bold 40px Quicksand, sans-serif', fill: '#20242e', align: 'center', baseline: 'middle'
      });
      // M15-C2 — progress toward the next unlock. M14-D2 showed the gate
      // level on the tile; this tells the child how far away it is, and how
      // many XP still separate them from it. Display only — the unlock
      // formula itself is unchanged (Desktop parity main.py:690/941).
      try {
        var _pd = getPlayer();
        var _total = (this.lessons && this.lessons.length) || null;
        var _pg = DataLoader.nextUnlockProgress(_pd.level, _total);
        var _line = _pg.all_unlocked
          ? ("Da mo het " + _pg.unlocked + "/" + _total + " bai")
          : ("Da mo " + _pg.unlocked + (
              _total ? ("/" + _total) : "") + " bai  |  Bai " + _pg.next_lesson
              + " mo o Lv" + _pg.required_level
              + " (con " + _pg.levels_needed + " level)");
        R.text(_line, W2 / 2, 112, {
          font: '18px Quicksand, sans-serif', fill: '#2b4a2b', align: 'center', baseline: 'middle'
        });
      } catch (e) { /* progress is additive; never block the screen */ }
      R.fillRoundRect(60, 120, W2 - 120, H2 - 210, 18, 'rgba(255,255,255,0.55)', null, 0);
      if (this.dataMissing) {
        R.text('Dữ liệu bài học chưa được tải.', W2 / 2, H2 / 2 - 30, {
          font: 'bold 26px Quicksand, sans-serif', fill: '#6b4f00', align: 'center', baseline: 'middle'
        });
        R.text('Phase 2 (data): copy math_lessons.json vào web/data/ + data_loader.js để hiển thị.', W2 / 2, H2 / 2 + 20, {
          font: '17px Quicksand, sans-serif', fill: '#806020', align: 'center', baseline: 'middle'
        });
      } else if (this.loading) {
        R.text('Đang tải dữ liệu bài học...', W2 / 2, H2 / 2, {
          font: 'bold 26px Quicksand, sans-serif', fill: '#6b4f00', align: 'center', baseline: 'middle'
        });
      } else {
        const startIdx = this.currentPage * this.itemsPerPage;
        const maxUnlocked = Math.floor((getPlayer().level - 1) / 6) + 1;
        for (let i = 0; i < this.itemsPerPage; i++) {
          const idx = startIdx + i;
          if (idx >= this.lessons.length) break;
          const bx = (i < 4) ? 100 : 720;
          const by = 150 + (i % 4) * 110;
          const unlocked = idx + 1 <= maxUnlocked;
          let label = String(this.lessons[idx]);
          if (!unlocked) {
            // M14-D2: show the exact required level on locked lessons so the gate
            // is self-explanatory instead of an unexplained padlock. Display-only
            // — the gating formula above is unchanged (Desktop parity main.py:690/941).
            const need = idx * 6 + 1;
            const title = label.length > 22 ? label.slice(0, 19) + '...' : label;
            label = '🔒 Lv' + need + ' ' + title;
          } else if (label.length > 29) {
            label = label.slice(0, 26) + '...';
          }
          drawBtn(R, bx, by, 480, 80, label,
            unlocked ? (i % 2 === 0 ? PURPLE_BTN : ORANGE_BTN) : SHADOW,
            { fontSize: 18 });
        }
      }
      drawBtn(R, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h,
        '⬅️ QUAY LẠI', RED_BTN, { fontSize: 16 });
      if (!this.dataMissing && this.currentPage > 0) {
        drawBtn(R, this.prevBtn.x, this.prevBtn.y, this.prevBtn.w, this.prevBtn.h,
          '⬅️ TRƯỚC', BLUE_BTN, { fontSize: 16 });
      }
      if (!this.dataMissing && this.currentPage < this.totalPages - 1) {
        drawBtn(R, this.nextBtn.x, this.nextBtn.y, this.nextBtn.w, this.nextBtn.h,
          'SAU ➡️', BLUE_BTN, { fontSize: 16 });
      }
    }
  }

  // =========================================================
  // LESSON STATE  (main.py:1418-1741) — skeleton flow M4
  // - Progress 15 câu, score, combo (threshold 3/5/10 như Python).
  // - Câu hỏi lấy từ Game.questionGen (interface M6). CHƯA có →
  //   hiển thị panel chờ, KHÔNG hard-code câu hỏi.
  // - accuracy >= 60% → VictoryState; ngược lại → DefeatState
  //   (giữ nguyên điều kiện main.py:1501-1504).
  // =========================================================
  class LessonState extends BaseState {
    constructor() {
      super('lesson');
      this.tc = 15;              // tổng câu (Python main.py:1422)
      this.title = 'Bài 1';
      this.grade = 1;
      this.lessonId = 1;         // P0: numeric lesson id for QuestionGenerator
      // main.py:1433-1434 sound_manager.set_bgm('lesson')
      try { var AL = global.Game && global.Game.audio; if (AL) AL.setBgm('lesson'); } catch (e) {}
      this.cc = 0;               // câu hiện tại (0-based)
      this.sc = 0;               // điểm bài tập
      this.correctCount = 0;
      this.comboStreak = 0;      // combo HIỂN THỊ — sync từ player khi enter (Python đọc player.combo_streak)
      this.time = 0;             // pulse animation cho combo (main.py:1728 dùng time.time())
      this.wrongAnswers = [];
      this.feedback = null;
      this.pendingAdvance = false;
      this.cardScale = 0;
      this.q = null;
      this.ans = null;
      this.opts = [];
      this.op = null;
      this.buttons = [];
      this.missing = false;
      this.backBtn = { x: 20, y: H - 80, w: 200, h: 60 };
      /* M15-E2 REPRODUCED: there was no on-screen numeric keypad, so a
         phone (which has no physical keyboard) could only answer by
         tapping the four big answer buttons. M15-D2 added the physical
         digit row; this adds the touch equivalent. Placed in the band
         below the 2x2 answer grid and beside the back button, so it
         never overlaps an answer and stays inside the 1300x800 logical
         design. Drawn only when a touch device is detected. */
      this.keypad = null;
      this._initKeypad();
    }

    enter(params) {
      this.grade = (params && params.grade) || getPlayer().grade || 1;
      this.title = (params && params.title) || 'Bài 1';
      /* P0 FIX: resolve the NUMERIC lesson id. Previously only the title string
         was forwarded, so generate_question() received a non-numeric lesson_id
         and every question degraded to "Tính nhanh: <title> - 1 = ?" with
         correct_answer "NaN" (single repeated question per lesson). */
      var _lid = params && parseInt(params.lessonId, 10);
      if (!isFinite(_lid) || _lid <= 0) {
        var _lm = /(\d+)/.exec(String(this.title));
        _lid = _lm ? parseInt(_lm[1], 10) : 1;
      }
      this.lessonId = _lid;
      this.cc = 0;
      this.sc = 0;
      this.correctCount = 0;
      /* Desktop parity: HUD combo đọc player.combo_streak (main.py:1723
         get_combo_text). Combo của player KHÔNG bị reset khi vào bài mới —
         Python LessonState.__init__ chỉ reset adaptive_ai, không reset combo.
         Trước đây web khởi tạo 0 nên câu trả lời đúng đầu tiên làm HUD nhảy 0→N. */
      this.comboStreak = (getPlayer() && getPlayer().comboStreak) || 0;
      this.time = 0;
      this.wrongAnswers = [];
      this.feedback = null;
      this.pendingAdvance = false;
      this.missing = false;
      this.q = null;
      this.ans = null;
      this.opts = [];
      this.buttons = [];
      // M7-C: fresh GameManager session per lesson entry (no double-count).
      this.gm = makeGameManager(getPlayer());
      if (this.gm) this.gm.totalQuestions = this.tc;
      const qg = global.Game && global.Game.questionGen;
      if (qg && typeof qg.generate === 'function') {
        L.info('[Lesson] question service sẵn sàng (M6) —', this.title);
        this._nextQuestion();
      } else {
        this.missing = true;
        L.warn('[Lesson] questionGen chưa có (M6) — hiển thị panel chờ');
      }
    }

    exit() {}

    _nextQuestion() {
      const qg = global.Game.questionGen;
      let res = null;
      try {
        res = qg.generate(this.grade, this.lessonId, 3, getPlayer().username);
      } catch (err) {
        L.error('[Lesson] generate error', err);
      }
      if (!res || !res.question) {
        L.warn('[Lesson] không nhận được câu hỏi — dừng vòng chơi');
        this.missing = true;
        return;
      }
      this.q = String(res.question);
      this.ans = String(res.answer);
      this.opts = (res.options || []).map(String);
      this.op = res.op || null;
      this.cardScale = 0;
      this.buttons = this._buildOptionButtons();
      // M18: the keypad must be re-laid out whenever the answer grid changes,
      // otherwise it is positioned from the previous (often empty) grid. This
      // matters now that grades 1-2 use a taller 260x110 grid (main.py:1484-1488).
      this._initKeypad();
    }

    // Grid 2x2 như Python main.py:1484-1488 (btn_w=220, gap 240/110)
    // M15-E2: touch-only numeric keypad. Returns the 4 key rects, or null
    // when the device has no touch input (desktop keeps the physical keys
    // from M15-D2 and does not need an on-screen pad).
    _isTouchDevice() {
      try {
        if (global.Game && global.Game.engine && global.Game.engine.isTouch) return true;
        if (typeof navigator !== 'undefined') {
          if (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) return true;
          if ('ontouchstart' in global) return true;
        }
      } catch (e) { /* never block the lesson screen */ }
      return false;
    }

    _initKeypad() {
      if (!this._isTouchDevice()) { this.keypad = null; return; }
      // M18: derive the keypad Y from the ACTUAL answer grid instead of a hard-coded
      // 660. Desktop main.py:1484-1488 makes grades 1-2 use taller buttons
      // (260x110, gapY 130), so that grid ends at 440+130+110 = 680 — the old fixed
      // 660 would have overlapped it. Clamp to stay clear of the back button
      // (main.py:1440 back button is at x 20..220; the keypad is centred at x>=437).
      const kw = 96, kh = 60, gap = 14;
      const totalW = kw * 4 + gap * 3;
      const startX = W / 2 - totalW / 2;
      const btns = this._buildOptionButtons();
      const answersBottom = btns.length
        ? Math.max.apply(null, btns.map(function (b) { return b.y + b.h; }))
        : 640;
      const y = Math.max(660, answersBottom + 20);
      this.keypad = [1, 2, 3, 4].map((n, i) => ({
        digit: n, x: startX + i * (kw + gap), y: y, w: kw, h: kh
      }));
      this.keypadRect = { x: startX, y: y, w: totalW, h: kh };
    }

    // Desktop main.py:1484-1488 sizes the 2x2 answer grid by grade:
    //   is_young_learner(grade) -> btn 260x110, gap 280/130   (grades 1-2)
    //   otherwise                -> btn 220x90,  gap 240/110   (grades 3-5)
    // is_young_learner is game_init.py:145 - a cognitive-load accommodation for
    // grades 1-2, not a styling choice, so it must be reproduced.
    _buildOptionButtons() {
      const grade = (this.grade || 1);
      const young = grade <= 2;
      const w = young ? 260 : 220, h = young ? 110 : 90;
      const gapX = young ? 280 : 240, gapY = young ? 130 : 110;
      const startX = W / 2 - gapX / 2 - w / 2;
      const startY = 440;
      return this.opts.map(function (o, i) {
        return {
          x: startX + (i % 2) * gapX,
          y: startY + Math.floor(i / 2) * gapY,
          w: w, h: h, value: o, index: i
        };
      });
    }

    _onOptionClick(opt) {
      if (this.feedback && this.feedback.active) return;
      const isCorrect = String(opt.value) === String(this.ans);
      if (isCorrect) {
        // M7-C: Use GameManager for reward calculation (M7-A)
        const result = this.gm.onCorrect();
        this.comboStreak = result.comboStreak;
        this.sc = this.gm.score;
        this.correctCount = this.gm.correctCount;
      } else {
        // M7-C: Use GameManager for combo reset
        // M15-B1: also carry the full record so stats.wrongAnswers carries the
        // lesson's own transcript (game_manager.py 107 + LessonState 1218-1224).
        var _rec = {
          question: this.q,
          userAnswer: String(opt.value),
          correctAnswer: String(this.ans),
          operation: this.op || 'unknown',
          lesson: this.title
        };
        this.gm.onWrong(_rec);
        this.comboStreak = 0;
        this.wrongAnswers.push(_rec);
      }
      this.feedback = {
        question: this.q,
        correctAnswer: String(this.ans),
        userAnswer: String(opt.value),
        correct: isCorrect,
        active: true,
        dismissed: false
      };
      this.pendingAdvance = true;
      L.info('[Lesson]', isCorrect ? 'ĐÚNG' : 'SAI',
        '| combo', this.comboStreak, '| điểm', this.sc);
    }

    _dismissFeedback() {
      if (this.feedback) {
        this.feedback.active = false;
        this.feedback.dismissed = true;
      }
      this.pendingAdvance = false;
      this._advance();
    }

    // Python main.py:1491-1506 _advance_question
    _advance() {
      const result = this.gm.advanceQuestion();
      if (result.finished) {
        const stats = result.stats;
        stats.goldEarned = this.gm.calculateEndGold('lesson');
        L.info('[Lesson] kết thúc — accuracy', stats.accuracy.toFixed(1) + '%');
        if (result.victory) {
          global.Game.states.change('victory', {
            title: 'HOÀN THÀNH BÀI HỌC!',
            score: this.gm.score,
            lessonTitle: this.title,
            lessonId: this.lessonId,
            stats: stats
          }, 'fade');
        } else {
          global.Game.states.change('defeat', {
            title: 'CỐ LÊN NÀO! LÀM LẠI NHÉ 💪',
            correct: stats.correct,
            total: this.tc,
            lessonTitle: this.title,
            lessonId: this.lessonId,
            stats: stats
          }, 'fade');
        }
        return;
      }
      this._nextQuestion();
    }

    handleInput(input, dt) {
      const click = input.consumeClick ? input.consumeClick() : null;
      if (click) {
        // Feedback overlay active: click anywhere để dismiss → advance
        // (giống Python main.py:1508-1513)
        if (this.feedback && this.feedback.active) {
          this._dismissFeedback();
          return;
        }
        if (hit(click, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h)) {
          global.Game.states.change('menu', null, 'fade');
          return;
        }
        // M15-E2: on-screen keypad tap (touch devices).
        if (this.keypad) {
          for (let k = 0; k < this.keypad.length; k++) {
            const kk = this.keypad[k];
            if (hit(click, kk.x, kk.y, kk.w, kk.h)) {
              if (!(this.feedback && this.feedback.active)
                  && this.buttons && kk.digit - 1 < this.buttons.length) {
                this._onOptionClick(this.buttons[kk.digit - 1]);
              }
              return;
            }
          }
        }
        for (let i = 0; i < this.buttons.length; i++) {
          const b = this.buttons[i];
          if (hit(click, b.x, b.y, b.w, b.h)) {
            this._onOptionClick(b);
            return;
          }
        }
        return;
      }
      const key = input.consumePressedKey ? input.consumePressedKey() : null;
      if (key && this.feedback && this.feedback.active
          && (key.key === ' ' || key.key === 'Spacebar' || key.key === 'Enter' || key.key === 'NumpadEnter')) {
        this._dismissFeedback();
        return;
      }
      /* M15-D2 REPRODUCED: the lesson screen could not be played with the
         keyboard. The only key handling was Space/Enter to dismiss the
         feedback overlay, so a desktop player had to reach for the mouse
         for every answer while LoginState already used consumePressedKey.
         FIX: the digit row answers the matching option button (1-4, numpad
         included), in the same top-to-bottom order the buttons are drawn. */
      if (key) {
        const k = String(key.key);
        const digit = /^Digit([1-4])$/.test(k) ? k.slice(5)
          : /^Numpad([1-4])$/.test(k) ? k.slice(6)
            : /^[1-4]$/.test(k) ? k : null;
        if (digit) {
          const idx = parseInt(digit, 10) - 1;
          // Ignore digits while feedback is up: that answer is already given.
          if (!(this.feedback && this.feedback.active)
              && this.buttons && idx < this.buttons.length) {
            this._onOptionClick(this.buttons[idx]);
          }
          return;
        }
      }
    }

    update(dt) {
      this.time += dt;
      if (this.cardScale < 1) this.cardScale = Math.min(1, this.cardScale + dt * 5);
    }

    draw(ctx, W2, H2) {
      const R = global.Game.renderer;
      // Desktop main.py:1634: `temp.blit(background_img,(0,0)) if background_img else
      // temp.fill((30,40,60))` - the flat #1e2840 is only the NO-IMAGE fallback.
      const _lessonBg = global.Game.assets && global.Game.assets.get('nen_game');
      if (_lessonBg && !_lessonBg.placeholder) {
        R.image(_lessonBg, 0, 0, W2, H2);
      } else {
        R.clear('#1e2840');   // Desktop fallback main.py:1634
      }
      // Desktop main.py:1636 draw_top_bar(temp) - in-lesson HUD (level/XP/gold/
      // combo). M19 port; previously the web had no top bar here at all.
      drawTopBar(R, ctx, W2, this.comboStreak);
      R.text('MathDrill 5.0', W2 / 2, 40, {
        font: 'bold 30px Quicksand, sans-serif', fill: '#dbe6ff', align: 'center', baseline: 'middle'
      });
      R.text(this.title, 100, 40, {
        font: '18px Quicksand, sans-serif', fill: '#9ab6ff', baseline: 'middle'
      });
      // Progress "Câu X/15" (Python draw_progress_bar main.py:1642)
      this._progress(R, W2 / 2 - 250, 150, 500, 24, this.cc, this.tc,
        'Câu ' + Math.min(this.cc + 1, this.tc) + '/' + this.tc);
      /* Desktop main.py:1643-1660 knowledge-energy bar: 400x16 at
         (WIDTH/2-200, 185), track (50,50,70) r8, fill energy_color
         (80,180,230) - or (200,80,80) in fever mode - and the label
         "⚡ {energy}%" at (bar_x + bar_w + 10, bar_y). M19 port. */
      const energy = Math.max(0, Math.min(100, Number(this.energy) || 0));
      const feverMode = !!this.feverMode;
      const eX = W2 / 2 - 200, eY = 185, eW = 400, eH = 16;
      const eCol = feverMode ? 'rgb(200,80,80)' : 'rgb(80,180,230)';
      R.fillRoundRect(eX, eY, eW, eH, 8, 'rgb(50,50,70)', null, 0);
      const eFill = Math.round(eW * (energy / 100));
      if (eFill > 0) R.fillRoundRect(eX, eY, eFill, eH, 8, eCol, null, 0);
      R.text('⚡ ' + energy + '%', eX + eW + 10, eY, {
        font: '12px Quicksand, Segoe UI Emoji, sans-serif', fill: eCol, baseline: 'top'
      });
      // Difficulty + score (Python main.py:1706-1712)
      R.text('Độ khó: ' + (this.missing ? '—' : '3/10'), W2 / 2 - 280, 240, {
        font: '16px Quicksand, sans-serif', fill: '#9ab6ff', baseline: 'middle'
      });
      R.text('Điểm bài tập: ' + this.sc, W2 / 2 + 100, 240, {
        font: '16px Quicksand, sans-serif', fill: '#ffe164', baseline: 'middle'
      });

      if (this.missing) {
        // Panel chờ M6 — không hard-code câu hỏi
        R.fillRoundRect(W2 / 2 - 400, 280, 800, 220, 24, 'rgba(255,255,255,0.92)', 'rgb(80,150,255)', 5);
        R.text('Hệ thống sinh câu hỏi chưa được port (M6)', W2 / 2, 350, {
          font: 'bold 26px Quicksand, sans-serif', fill: '#2b3450', align: 'center', baseline: 'middle'
        });
        R.text(this.title + ' — vào được bài học; câu hỏi thật sẽ có ở M6 (question_generator.js).', W2 / 2, 400, {
          font: '18px Quicksand, sans-serif', fill: '#5a6490', align: 'center', baseline: 'middle'
        });
      } else if (this.q) {
        // Question card 800x200 elastic scale (Python main.py:1664-1705)
        /* M19: Desktop main.py:1869-1883 question card. Source:
             card_w, card_h = 800, 200
             qr.y = 200 + (card_h - draw_h)//2     <-- the web had 270
             shadow (0,0,0,60) at (qr.x+5, qr.y+8) r30
             body WHITE r30, border (80,150,255) w5 r30
           The web used y=270 and radius 24, neither of which appears in source. */
        const cw = 800, ch = 200;
        const sc = Math.max(0.2, this.cardScale);
        const dw = cw * sc, dh = ch * sc;
        const qx = W2 / 2 - dw / 2, qy = 200 + (ch - dh) / 2;
        R.fillRoundRect(qx + 5, qy + 8, dw, dh, 30, 'rgba(0,0,0,0.235)', null, 0);  // 60/255
        R.fillRoundRect(qx, qy, dw, dh, 30, '#ffffff', 'rgb(80,150,255)', 5);
        if (sc > 0.5) {
          /* Parity draw_multiline_text: question nhiều dòng, không tràn card. */
          const qMaxW = dw - 60;
          let qLines = wrapText(R, this.q, qMaxW, 'bold 26px Quicksand, sans-serif', 3);
          const qFont = (qLines.length > 2 ? 'bold 20px' : 'bold 26px') + ' Quicksand, sans-serif';
          if (qLines.length > 2) qLines = wrapText(R, this.q, qMaxW, qFont, 3);
          const qLh = qLines.length > 2 ? 26 : 34;
          const qY0 = qy + dh / 2 - (Math.min(qLines.length, 3) - 1) * qLh / 2;
          for (let li = 0; li < qLines.length && li < 3; li++) {
            R.text(qLines[li], W2 / 2, qY0 + li * qLh, {
              font: qFont, fill: '#28303f', align: 'center', baseline: 'middle'
            });
          }
        }
        /* Combo display — port trực tiếp get_combo_text/get_combo_color
           (game_init.py:429-444) + luật vẽ main.py:1722-1736: chỉ hiện khi
           player.combo_streak >= 3, font lớn dần, có pulse. */
        const comboLabel = comboText(this.comboStreak);
        if (comboLabel) {
          const cfs = 28 + Math.min(Math.floor(this.comboStreak / 3), 12);
          const pulse = Math.sin(this.time * (6 + Math.floor(this.comboStreak / 3))) *
                        (3 + Math.floor(this.comboStreak / 5));
          R.text(comboLabel, W2 / 2, 450 + pulse, {
            font: 'bold ' + cfs + 'px Quicksand, Segoe UI Emoji, sans-serif',
            fill: css(comboColor(this.comboStreak)), align: 'center', baseline: 'middle'
          });
        }
        // Option buttons
        for (let i = 0; i < this.buttons.length; i++) {
          const b = this.buttons[i];
          drawBtn(R, b.x, b.y, b.w, b.h, b.value, PURPLE_BTN, { fontSize: 24 });
        // M15-D2: number the answers so the keyboard shortcut is visible.
        R.text(String(i + 1), b.x + 22, b.y + b.h / 2, {
          font: 'bold 22px Quicksand, sans-serif', fill: 'rgba(255,255,255,0.85)',
          align: 'center', baseline: 'middle'
        });
        }
        // M15-E2: on-screen numeric keypad for touch devices.
        if (this.keypad) {
          this.keypad.forEach((kk) => {
            drawBtn(R, kk.x, kk.y, kk.w, kk.h, String(kk.digit), BLUE_BTN, { fontSize: 24 });
          });
          R.text('PHIM SO', this.keypadRect.x, this.keypadRect.y - 16, {
            font: 'bold 14px Quicksand, sans-serif', fill: '#8ea6d8', align: 'center', baseline: 'middle'
          });
        }
        // Feedback overlay (rút gọn FeedbackOverlay — polish ở M8)
        if (this.feedback && this.feedback.active) {
          const fcol = this.feedback.correct ? '#16a34a' : '#dc2626';
          R.fillRoundRect(W2 / 2 - 300, 300, 600, 120, 18, 'rgba(10,14,28,0.92)', fcol, 3);
          R.text(this.feedback.correct ? '✅ Đúng rồi! (bấm để tiếp tục)' : '❌ Sai rồi — bấm để tiếp tục',
            W2 / 2, 340, {
              font: 'bold 24px Quicksand, sans-serif', fill: '#ffffff', align: 'center', baseline: 'middle'
            });
          if (!this.feedback.correct) {
            R.text('Đáp án đúng: ' + this.feedback.correctAnswer, W2 / 2, 388, {
              font: '18px Quicksand, sans-serif', fill: '#ffe9a8', align: 'center', baseline: 'middle'
            });
          }
        }
      }
      drawBtn(R, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h,
        '⬅️ QUAY LẠI', RED_BTN, { fontSize: 16 });
    }

    _progress(R, x, y, w, h, cur, total, label) {
      const pct = total > 0 ? Math.min(1, cur / total) : 0;
      R.fillRoundRect(x, y, w, h, 12, 'rgba(255,255,255,0.15)', null, 0);
      if (pct > 0) R.fillRoundRect(x, y, w * pct, h, 12, '#60a5fa', null, 0);
      R.fillRoundRect(x, y, w, h, 12, 'rgba(0,0,0,0)', 'rgba(255,255,255,0.7)', 1);
      R.text(label, x + w / 2, y + h / 2, {
        font: 'bold 16px Quicksand, sans-serif', fill: '#ffffff', align: 'center', baseline: 'middle'
      });
    }

  }

  // =========================================================
  // THEORY STATE  (main.py:977-1039)
  // M4: khung theory — scroll clamp, page bounds, prev/next buttons.
  // M7/M8: RealisticBook content + character sẽ port ở milestone sau.
  // =========================================================
  class TheoryState extends BaseState {
    constructor(title) {
      super('theory');
      this.title = (title && String(title).length > 0) ? String(title) : 'Lý thuyết';
      this.currentPage = 0;
      this.totalPages = 1;
      this.scrollOffset = 0;
      this.maxScroll = 0;
      this.contentHeight = 0;
      this.viewHeight = 480;
      this.contentRect = { x: 80, y: 180, w: 520, h: 480 };
      this.characterRect = { x: 860, y: 80, w: 200, h: 200 };
      this.startBtn = { x: 810, y: 300, w: 300, h: 70 };
      this.openBookBtn = { x: 810, y: 400, w: 300, h: 70 };
      this.backBtn = { x: 810, y: 500, w: 300, h: 70 };
      this.bookX = 50;
      this.bookY = 50;
      this.bookW = 1200;
      this.bookH = 700;
    }

    enter(params) {
      this.title = (params && params.title) ? String(params.title) : this.title;
      this.grade = (params && params.grade) || getPlayer().grade || 1;
      /* P0: carry the numeric lesson id through Theory → Lesson so the question
         generator can route on `lesson_id`. Fallback: derive from the title. */
      var _pid = params && parseInt(params.lessonId, 10);
      if (!isFinite(_pid) || _pid <= 0) {
        var _m = /(\d+)/.exec(this.title);
        _pid = _m ? parseInt(_m[1], 10) : 1;
      }
      this.lessonId = _pid;
      const factory = global.TheoryPages || (typeof require === 'function' ? require('./theory_pages.js') : null);
      const pages = factory ? (factory()[this.grade] || []) : [];
      /* M14-C1: exact title match only rescued 69/342 lessons. theory_pages.js is
         written from math_theory.json and its titles are frequently more specific
         than the lesson titles in math_lessons.json (e.g. lesson "Bài 2. Ôn tập
         phép cộng, phép trừ" vs theory "Bài 2. Ôn tập phép cộng, phép trừ trong
         phạm vi 1000"). The remaining 273 lessons silently fell back to
         "Nội dung đang được cập nhật...". Fall back to the lesson NUMBER, which
         is the stable key both files share, before giving up. */
      let page = pages.find(p => p.t === this.title);
      if (!page && this.lessonId) {
        const want = 'Bài ' + this.lessonId + '.';
        page = pages.find(p => String(p.t || '').indexOf(want) === 0);
      }
      this.content = page ? page.c : 'Nội dung đang được cập nhật...';
      this.theoryFound = !!page;
      this.currentPage = 0;
      this.scrollOffset = 0;
      const UI = global.UI || (typeof require === 'function' ? require('./ui.js') : null);
      /* FINAL QA fix: this book used to be constructed with ZERO pages
         (`new UI.RealisticBook([], ...)`), so the RealisticBook only ever painted
         its chrome and goTo()/page-flip was a no-op. Feed it the real Desktop
         theory pages (same source as this.content) and wire the theory page
         renderer that ui.js exports for exactly this contract. Lessons without a
         theory page keep a single-page book (Desktop fallback). */
      const bookPages = pages.length ? pages.slice() : [{ t: this.title, c: this.content }];
      this._rbBook = (UI && typeof UI.RealisticBook === 'function')
        ? new UI.RealisticBook(bookPages, { x: 50, y: 50, w: 1200, h: 700 })
        : null;
      if (this._rbBook) {
        if (typeof UI.makeTheoryPageApi === 'function') {
          const api = UI.makeTheoryPageApi(this.grade);
          if (api && typeof this._rbBook.setPageApi === 'function') this._rbBook.setPageApi(api);
        }
        if (typeof this._rbBook.reset === 'function') this._rbBook.reset();
      }
      this._clampScroll();
    }

    exit() {}

    _clampScroll() {
      this.maxScroll = Math.max(0, this.contentHeight - this.viewHeight);
      if (this.scrollOffset < 0) this.scrollOffset = 0;
      if (this.scrollOffset > this.maxScroll) this.scrollOffset = this.maxScroll;
    }

    handleInput(input, dt) {
      if (this._rbBook && this._rbBook.animating) return;
      const wheel = input.consumeWheel ? input.consumeWheel() : null;
      if (wheel) { this.scrollOffset += wheel.deltaY || 0; this._clampScroll(); }
      const click = input.consumeClick ? input.consumeClick() : null;
      if (!click) return;
      if (hit(click, this.startBtn.x, this.startBtn.y, this.startBtn.w, this.startBtn.h)) {
        global.Game.states.change('lesson', { grade: this.grade, title: this.title, lessonId: this.lessonId }, 'fade');
      } else if (hit(click, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h)) {
        global.Game.states.change('lesson_select', { grade: this.grade }, 'fade');
      } else if (hit(click, this.openBookBtn.x, this.openBookBtn.y, this.openBookBtn.w, this.openBookBtn.h)
          && typeof global.open === 'function') {
        global.open('https://hanhtrangso.nxbgd.vn/', '_blank', 'noopener,noreferrer');
      }
    }

    update(dt) {
      if (this._rbBook) this._rbBook.update(dt);
      this._clampScroll();
    }

    draw(ctx, W2, H2) {
      const R = global.Game.renderer;
      R.clear('#a5d6a7');
      if (this._rbBook) this._rbBook.draw(R, null, null, !!this._rbBook.flipping);
      const font = '20px Quicksand, sans-serif';
      const lines = String(this.content || '').split('\n').flatMap(line => wrapText(R, line, 500, font));
      this.contentHeight = lines.length * 28;
      this._clampScroll();
      const c = R.ctx;
      const clip = c && typeof c.save === 'function' && typeof c.clip === 'function';
      if (clip) { c.save(); c.beginPath(); c.rect(70, 80, 540, 90); c.clip(); }
      wrapText(R, this.title, 520, 'bold 26px Quicksand, sans-serif').forEach((line, i) => {
        R.text(line, 80, 90 + i * 32, { font: 'bold 26px Quicksand, sans-serif', fill: '#20242e', baseline: 'top' });
      });
      if (clip) { c.restore(); c.save(); c.beginPath(); c.rect(80, 180, 520, 480); c.clip(); }
      lines.forEach((line, i) => {
        const y = 180 + i * 28 - this.scrollOffset;
        if (y >= 180 && y + 28 <= 660) R.text(line, 80, y, { font: font, fill: '#323232', baseline: 'top' });
      });
      if (clip) c.restore();
      if (this.maxScroll > 0) {
        const h = Math.max(24, 480 * 480 / this.contentHeight);
        R.fillRoundRect(604, 180, 6, 480, 3, '#c9c0ac');
        R.fillRoundRect(604, 180 + (480 - h) * this.scrollOffset / this.maxScroll, 6, h, 3, '#4caf50');
      }
      const assets = global.Game.assets;
      const img = assets && assets.get('main_character');
      if (img && R.image) R.image(img, 860, 80, 200, 200);
      drawBtn(R, 810, 300, 300, 70, '📖 BẮT ĐẦU HỌC', GREEN_BTN);
      drawBtn(R, 810, 400, 300, 70, '🌐 Mở SGK', BLUE_BTN);
      drawBtn(R, 810, 500, 300, 70, '⬅️ QUAY LẠI', RED_BTN);
    }
  }

  // =========================================================
  // VICTORY STATE  (main.py:1081-1219)
  // M4: hiển thị stats + rank + XP anim (công thức correct*20 như
  // Python main.py:1096). Reward thật (add_xp/add_gold) ở M5/M7.
  // =========================================================
  class VictoryState extends BaseState {
    constructor() {
      super('victory');
      this.timer = 0;
      this.showUi = false;
      this.title = 'HOÀN THÀNH BÀI HỌC!';
      // main.py:1093-1094 sound_manager.set_bgm('victory') + play_sfx('victory')
      try { var AV = global.Game && global.Game.audio; if (AV) { AV.setBgm('victory'); AV.playSfx('victory'); } } catch (e) {}
      this.score = 0;
      this.lessonTitle = '';
      this.stats = {};
      this.rank = 'C';
      this.xpEarned = 0;
      this.xpCurrent = 0;
      this.xpAnimDone = false;
      this.goldEarned = 0;
      this.continueBtn = { x: W / 2 - 125, y: H - 120, w: 250, h: 60 };
      this.reviewBtn = { x: W / 2 - 125, y: H - 200, w: 250, h: 60 };
      // Desktop main.py:1091 — VictoryState clover layer is FallingCloverEffect(15).
      this.cloverEffect = global.FallingClover ? new global.FallingClover(15) : null;
    }

        async enter(params) {
      this.timer = 0;
      this.showUi = false;
      this.title = (params && params.title) || this.title;
      this.score = (params && typeof params.score === 'number') ? params.score : 0;
      this.lessonTitle = (params && params.lessonTitle) || '';
      this.lessonId = (params && parseInt(params.lessonId, 10)) || 0;
      this.stats = (params && params.stats) || {};
      const acc = this.stats.accuracy || 0;
      // Rank logic giữ nguyên Python main.py:1101-1105
      this.rank = acc >= 100 ? 'S' : acc >= 90 ? 'A' : acc >= 80 ? 'B' : 'C';
      // Python main.py:1096: xp_earned = correct * 20
      this.xpEarned = (this.stats.correct || 0) * 20;
      this.xpCurrent = 0;
      this.xpAnimDone = false;
      this.goldEarned = 0; // reward thật: reward_gold_for_result ở M7
      L.info('[Victory] enter — rank', this.rank, '| xp', this.xpEarned,
        '(M4: chưa cộng vào player, M5/M7 sẽ port)');
      // M10-B: persist progress immediately, even if the tab is closed here.
      const G = global.Game;
      if (G.auth && typeof G.auth.save === 'function' && G.auth.currentUser && G.player) {
        const d = G.auth.data();
        d.xp = G.player.exp;
        d.level = G.player.level;
        d.gold = G.player.gold;
        G.auth.save();
      }
      await syncPlayerToServer();
    }

    exit() {}

    handleInput(input, dt) {
      const click = input.consumeClick ? input.consumeClick() : null;
      if (!click || !this.showUi) return;
      if (hit(click, this.continueBtn.x, this.continueBtn.y, this.continueBtn.w, this.continueBtn.h)) {
        // Python main.py:1143 → MenuState
        global.Game.states.change('menu', null, 'fade');
      } else if (hit(click, this.reviewBtn.x, this.reviewBtn.y, this.reviewBtn.w, this.reviewBtn.h)) {
        // M15-B1: Desktop parity main.py:1144-1149 — Xem lỗi opens
        // ReviewState(wrong_answers, lesson_title, on_continue) instead of the
        // old console-only stub. main.py:1147-1148 routes continue back to menu.
        global.Game.states.change('review', {
          wrongAnswers: (this.stats && this.stats.wrongAnswers) || [],
          lessonTitle: this.lessonTitle || '',
          next: 'menu'
        }, 'fade');
      }
    }

    update(dt) {
      this.timer += dt;
      if (this.timer > 0.5) this.showUi = true;
      // XP animation (Python main.py:1165-1169)
      if (this.timer > 1.0 && !this.xpAnimDone) {
        this.xpCurrent = Math.min(this.xpEarned, this.xpCurrent + dt * 50);
        if (this.xpCurrent >= this.xpEarned) this.xpAnimDone = true;
      }
      // Desktop main.py:1150 — VictoryState.update drives clover_effect.update(dt).
      if (this.cloverEffect) {
        cloverRain(this.cloverEffect, 15);
        if (typeof this.cloverEffect.update === 'function') this.cloverEffect.update(dt);
      }
    }

    draw(ctx, W2, H2) {
      const R = global.Game.renderer;
      // Desktop main.py:1173-1175 VictoryState.draw:
      //   s.fill((30,80,40)) -> draw_gradient((30,80,40) -> (80,180,100))
      R.clear('rgb(30,80,40)');
      R.gradient([30, 80, 40], [80, 180, 100]);
      /* M18: restore the original Victory artwork. Desktop main.py:1080-1084
         + 1180-1184 loads victory_text.png, scales it x2.0 (shrinking to 1.0 at
         4/s in update), fades alpha 0 -> 255 at 200/s, and blits it centred at
         (WIDTH/2, HEIGHT/2-180) = (650, 220) - ABOVE the panel. */
      const _vicArt = global.Game.assets && global.Game.assets.get('victory_text');
      if (_vicArt && !_vicArt.placeholder) {
        // Desktop update(): vic_scale 2.0 -> 1.0 at 4/s, vic_alpha 0 -> 255 at 200/s.
        // `this.timer` is the same accumulator the Desktop `self.timer` is.
        const t = this.timer || 0;
        const vs = Math.max(1.0, 2.0 - 4 * t);
        const va = Math.min(255, 200 * t) / 255;
        const iw = _vicArt.naturalWidth || _vicArt.width || 0;
        const ih = _vicArt.naturalHeight || _vicArt.height || 0;
        const vw = iw ? Math.round(iw * vs) : Math.round(0.62 * W2 * vs);
        const vh = ih ? Math.round(ih * vs) : Math.round(0.20 * H2 * vs);
        ctx.save();
        ctx.globalAlpha = va;
        R.image(_vicArt, W2 / 2 - vw / 2, H2 / 2 - 180 - vh / 2, vw, vh);
        ctx.restore();
      }
      // Desktop main.py:1163 — clover layer is drawn before the victory UI.
      drawClover(R, this.cloverEffect);
      R.text('🏆 HOÀN THÀNH BÀI HỌC 🏆', W2 / 2, 140, {
        font: 'bold 48px Quicksand, sans-serif', fill: '#d7f7df', align: 'center', baseline: 'middle'
      });
      if (!this.showUi) return;
      // M19: Desktop main.py:1534-1542 VictoryState panel + rank.
      //   panel 600x350 at (WIDTH/2-300, HEIGHT/2-80), fill (255,255,255,230),
      //   border (200,170,80) w5 r30; rank font 100 at (panel_x+panel_w-120,
      //   panel_y+30), colour (200,170,80) for S else (200,200,200).
      const pw = 600, ph = 350, px = W2 / 2 - pw / 2, py = H2 / 2 - 80;
      R.fillRoundRect(px, py, pw, ph, 30, 'rgba(255,255,255,0.902)', 'rgb(200,170,80)', 5);
      R.text(this.rank, px + pw - 120, py + 30, {
        font: 'bold 100px Quicksand, sans-serif',
        fill: this.rank === 'S' ? 'rgb(200,170,80)' : 'rgb(200,200,200)',
        align: 'center', baseline: 'middle'
      });
      R.text(this.title, W2 / 2, py + 52, {
        font: 'bold 26px Quicksand, sans-serif', fill: '#28303f', align: 'center', baseline: 'middle'
      });
      R.text('Điểm số: ' + this.score, W2 / 2, py + 98, {
        font: '22px Quicksand, sans-serif', fill: '#3a4255', align: 'center', baseline: 'middle'
      });
      this._xpBar(R, px + 100, py + 145, 400, 30, this.xpCurrent, this.xpEarned,
        '+ ' + Math.floor(this.xpCurrent) + ' XP');
      R.text('+ ' + this.goldEarned + ' vàng', W2 / 2, py + 198, {
        font: '20px Quicksand, sans-serif', fill: '#b08c28', align: 'center', baseline: 'middle'
      });
      const acc = Math.round(this.stats.accuracy || 0);
      const avg = this.stats.avgTime || 0;
      R.text('Độ chính xác: ' + acc + '%   ·   Số câu đúng: '
        + (this.stats.correct || 0) + '/' + (this.stats.total || 0), W2 / 2, py + 240, {
          font: '19px Quicksand, sans-serif', fill: '#284a28', align: 'center', baseline: 'middle'
        });
      R.text('Tốc độ trung bình: ' + avg.toFixed(1) + 's/câu', W2 / 2, py + 270, {
        font: '19px Quicksand, sans-serif', fill: '#3c3c64', align: 'center', baseline: 'middle'
      });
      drawBtn(R, this.reviewBtn.x, this.reviewBtn.y, this.reviewBtn.w, this.reviewBtn.h,
        '🧐 XEM LỖI', ORANGE_BTN, { fontSize: 18 });
      drawBtn(R, this.continueBtn.x, this.continueBtn.y, this.continueBtn.w, this.continueBtn.h,
        '➡️ TIẾP TỤC', GREEN_BTN, { fontSize: 18 });
    }

    _xpBar(R, x, y, w, h, cur, need, label) {
      const pct = need > 0 ? Math.min(1, cur / need) : 0;
      R.fillRoundRect(x, y, w, h, 15, 'rgba(0,0,0,0.12)', null, 0);
      if (pct > 0) R.fillRoundRect(x, y, w * pct, h, 15, '#4ade80', null, 0);
      R.fillRoundRect(x, y, w, h, 15, 'rgba(0,0,0,0)', 'rgba(0,0,0,0.25)', 1);
      R.text(label, x + w / 2, y + h / 2, {
        font: 'bold 16px Quicksand, sans-serif', fill: '#1c2c20', align: 'center', baseline: 'middle'
      });
    }
  }

  // =========================================================
  // DEFEAT STATE  (main.py:1005-1080) — tông động viên, không trừng phạt
  // =========================================================
  class DefeatState extends BaseState {
    constructor() {
      super('defeat');
      this.timer = 0;
      this.showUi = false;
      this.title = 'CỐ LÊN NÀO! LÀM LẠI NHÉ 💪';
      // main.py:1021-1022 sound_manager.set_bgm('defeat')
      try { var AD = global.Game && global.Game.audio; if (AD) AD.setBgm('defeat'); } catch (e) {}
      this.correct = 0;
      this.total = 1;
      this.lessonTitle = '';
      this.stats = {};
      this.retryBtn  = { x: W / 2 - 260, y: H - 120, w: 250, h: 60 };
      this.homeBtn   = { x: W / 2 + 10, y: H - 120, w: 250, h: 60 };
      this.reviewBtn = { x: W / 2 - 125, y: H - 200, w: 250, h: 60 };
      // Desktop main.py:1020 — DefeatState clover layer is FallingCloverEffect(15).
      this.cloverEffect = global.FallingClover ? new global.FallingClover(15) : null;
    }

        async enter(params) {
      this.timer = 0;
      this.showUi = false;
      this.title = (params && params.title) || this.title;
      this.correct = (params && typeof params.correct === 'number') ? params.correct : 0;
      this.total = (params && typeof params.total === 'number') ? params.total : 1;
      this.lessonTitle = (params && params.lessonTitle) || '';
      this.lessonId = (params && parseInt(params.lessonId, 10)) || 0;
      this.stats = (params && params.stats) || {};
      // Python: sound_manager.set_bgm("defeat") — M4 chưa bật BGM (M8)
      L.info('[Defeat] enter — đúng', this.correct, '/', this.total);
      // M10-B: persist progress immediately, even if the tab is closed here.
      const G = global.Game;
      if (G.auth && typeof G.auth.save === 'function' && G.auth.currentUser && G.player) {
        const d = G.auth.data();
        d.xp = G.player.exp;
        d.level = G.player.level;
        d.gold = G.player.gold;
        G.auth.save();
      }
      await syncPlayerToServer();
    }

    exit() {}

    handleInput(input, dt) {
      const click = input.consumeClick ? input.consumeClick() : null;
      if (!click || !this.showUi) return;
      if (hit(click, this.retryBtn.x, this.retryBtn.y, this.retryBtn.w, this.retryBtn.h)) {
        /* M32.1 Desktop parity main.py:1028-1030:
             if self.btn_retry.clicked(e.pos):
                 if self.lesson_title == "ThừỮD Thách": manager.change(DailyState())
                 else: manager.change(LessonState(self.lesson_title))
           The Daily branch is UNREACHABLE in live play today: the Web
           DailyState is a daily-reward CLAIM screen, not the Desktop
           10-question daily quiz (main.py:2002-2130), so no Web flow ever
           produces a Defeat whose lesson_title is "Thử Thách".
           Kept so the code matches Desktop exactly and works as soon as the
           daily challenge is ported. */
        if (this.lessonTitle === DAILY_CHALLENGE_TITLE) {
          global.Game.states.change('daily', null, 'fade');
          return;
        }
        global.Game.states.change('lesson', {
          grade: getPlayer().grade,
          title: this.lessonTitle || 'Bài 1',
          lessonId: this.lessonId || undefined
        }, 'fade');
      } else if (hit(click, this.homeBtn.x, this.homeBtn.y, this.homeBtn.w, this.homeBtn.h)) {
        global.Game.states.change('menu', null, 'fade');
      } else if (hit(click, this.reviewBtn.x, this.reviewBtn.y, this.reviewBtn.w, this.reviewBtn.h)) {
        // M15-B1: Desktop parity main.py:1033-1038 — Xem lỗi opens
        // ReviewState(wrong_answers, lesson_title, on_continue); main.py:1036-1037
        // routes continue back to menu.
        global.Game.states.change('review', {
          wrongAnswers: (this.stats && this.stats.wrongAnswers) || [],
          lessonTitle: this.lessonTitle || '',
          next: 'menu'
        }, 'fade');
      }
    }

    update(dt) {
      this.timer += dt;
      if (this.timer > 0.5) this.showUi = true;
      // Desktop main.py:1043 — DefeatState.update drives clover_effect.update(dt).
      if (this.cloverEffect) {
        cloverRain(this.cloverEffect, 15);
        if (typeof this.cloverEffect.update === 'function') this.cloverEffect.update(dt);
      }
    }

    draw(ctx, W2, H2) {
      const R = global.Game.renderer;
      // Desktop main.py:1046-1055 DefeatState.draw:
      //   s.fill((30,35,55)) -> defeat.png smoothscaled by bg_scale (grows +0.05/s,
      //   centred) -> light overlay (20,25,45,110) that does NOT black out the screen.
      R.clear('rgb(30,35,55)');
      const _defArt = global.Game.assets && global.Game.assets.get('defeat');
      if (_defArt && !_defArt.placeholder) {
        this.bgScale = (this.bgScale || 1.0) + 0.05 * 0.016;   // per-frame ~dt
        const s = Math.min(1.6, this.bgScale);
        const dw = Math.round(W2 * s), dh = Math.round(H2 * s);
        R.image(_defArt, W2 / 2 - dw / 2, H2 / 2 - dh / 2, dw, dh);
      }
      R.fillRoundRect(0, 0, W2, H2, 0, 'rgba(20,25,45,0.431)', null, 0);  // 110/255
      // Desktop main.py:1051 — clover layer sits after the dark overlay and
      // before the panel/UI.
      drawClover(R, this.cloverEffect);
      R.text('CỐ LÊN NÀO! 💪', W2 / 2, 140, {
        font: 'bold 40px Quicksand, sans-serif', fill: '#ffd9a0', align: 'center', baseline: 'middle'
      });
      if (!this.showUi) return;
      // M19: Desktop main.py:1437-1440 DefeatState panel -
      //   600x400 at (WIDTH/2-300, HEIGHT/2-150), fill (45,48,68,210),
      //   border (255,180,90) w4 r30. (Desktop alpha 210/255 = 0.824.)
      const pw = 600, ph = 400, px = W2 / 2 - pw / 2, py = H2 / 2 - 150;
      R.fillRoundRect(px, py, pw, ph, 30, 'rgba(45,48,68,0.824)', 'rgb(255,180,90)', 4);
      R.text(this.title, W2 / 2, py + 60, {
        font: 'bold 26px Quicksand, sans-serif', fill: '#ffc86e', align: 'center', baseline: 'middle'
      });
      const acc = this.total > 0 ? Math.round((this.correct / this.total) * 100) : 0;
      R.text('Đúng: ' + this.correct + '/' + this.total + ' câu (' + acc + '%)', W2 / 2, py + 130, {
        font: '24px Quicksand, sans-serif', fill: '#ffffff', align: 'center', baseline: 'middle'
      });
      R.text('Cần đạt 60% để vượt qua — làm lại để tiến bộ hơn nhé!', W2 / 2, py + 180, {
        font: '17px Quicksand, sans-serif', fill: '#d2d6e6', align: 'center', baseline: 'middle'
      });
      const avg = this.stats.avgTime || 0;
      R.text('Số câu cần xem lại: ' + (this.total - this.correct), W2 / 2, py + 230, {
        font: '20px Quicksand, sans-serif', fill: '#ffc396', align: 'center', baseline: 'middle'
      });
      R.text('Tốc độ trung bình: ' + avg.toFixed(1) + 's/câu', W2 / 2, py + 270, {
        font: '20px Quicksand, sans-serif', fill: '#b4c8ff', align: 'center', baseline: 'middle'
      });
      drawBtn(R, this.reviewBtn.x, this.reviewBtn.y, this.reviewBtn.w, this.reviewBtn.h,
        '🧐 XEM LỖI', PURPLE_BTN, { fontSize: 16 });
      drawBtn(R, this.retryBtn.x, this.retryBtn.y, this.retryBtn.w, this.retryBtn.h,
        '🔄 LÀM LẠI', ORANGE_BTN, { fontSize: 16 });
      drawBtn(R, this.homeBtn.x, this.homeBtn.y, this.homeBtn.w, this.homeBtn.h,
        '🏠 VỀ MENU', RED_BTN, { fontSize: 16 });
    }
  }

  /* ========== M10-B: M9 REAL STATES ========== */

  // --- shared M9 accessors ---
  function m9GetAuth() {
    const G = global.Game;
    return (G && G.auth && typeof G.auth.data === 'function') ? G.auth : null;
  }
  function m9AccountData() {
    const auth = m9GetAuth();
    if (auth && auth.currentUser) return auth.data();
    return null;
  }
  function m9SaveHook() {
    const auth = m9GetAuth();
    return function () { if (auth) auth.save(); };
  }
  function m9Player() {
    const G = global.Game;
    if (!G) global.Game = {};
    if (!global.Game.player) global.Game.player = global.PlayerData ? new global.PlayerData() : null;
    return global.Game.player;
  }
  function m9SyncPlayer() {
    const d = m9AccountData();
    if (!d) return;
    const p = m9Player();
    if (!p) return;
    if (typeof d.gold === 'number') p.gold = d.gold;
    if (typeof d.xp === 'number') p.exp = d.xp;
    if (typeof d.level === 'number') p.level = d.level;
    if (d.pet && typeof d.pet.type === 'string') {
      if (!p.pet) p.pet = {};
      p.pet.type = d.pet.type;
    }
  }
  function m9EnsureDst(d) {
    if (!d) return d;
    if (!d.unlocked_skins) d.unlocked_skins = ['pen_basic', 'board_wood'];
    if (!d.equipped_pen) d.equipped_pen = 'pen_basic';
    if (!d.equipped_board) d.equipped_board = 'board_wood';
    if (!d.pet) d.pet = { type: 'clover', stage: 0, name: 'Cỏ Non' };
    if (!d.skill_levels) d.skill_levels = {};
    if (!d.gacha_state) d.gacha_state = { pull_count: 0, total_pulls: 0, guaranteed_legendary: false, rare_pity: 0 };
    if (!d.inventory) d.inventory = [];
    if (typeof d.daily_streak !== 'number') d.daily_streak = 0;
    if (!d.last_claim) d.last_claim = '';
    if (!d.claimed_days) d.claimed_days = {};
    return d;
  }

  /* M10-B STATE: SHOP (main.py:2273-2476) */
  class ShopState extends BaseState {
    constructor() {
      super('shop');
      this.backBtn = { x: 810, y: 600, w: 300, h: 60 };  // Desktop main.py:2276
      this.filter = 'all';
      this.statusMsg = '';
      this.statusTimer = 0;
      this.itemButtons = [];
      this.filterButtons = [];
      this.items = [];
      this.dataMissing = true;
    }
    enter(params) {
      this.dataMissing = true;
      this.items = [];
      this.itemButtons = [];
      this.statusMsg = '';
      this.statusTimer = 0;
      this.filter = (params && params.filter) || 'all';
      const d = m9AccountData();
      if (!d) { this.dataMissing = true; return; }
      m9EnsureDst(d);
      const api = global.ShopApi;
      const Ctor = global.ShopSystem;
      if (params && params.petTypes && params.skinTypes) {
        this.shop = new Ctor({ petTypes: params.petTypes, skinTypes: params.skinTypes,
          data: d, adapter: { save: m9SaveHook() } });
        this.dataMissing = false;
        this._rebuild();
      } else if (api && Ctor && typeof api.loadPetTypes === 'function') {
        const self = this;
        Promise.all([api.loadPetTypes(), api.loadSkinTypes()]).then(function (res) {
          self.shop = new Ctor({ petTypes: res[0], skinTypes: res[1], data: d,
            adapter: { save: m9SaveHook() } });
          self.dataMissing = false;
          self._rebuild();
        }).catch(function (err) {
          L.error('[Shop] load pet/skin types failed:', err);
          self.dataMissing = true;
        });
      }
    }
    _rebuild() {
      this.items = this.shop ? this.shop.filter(this.filter, '') : [];
      this.itemButtons = [];
      const cols = 2, bw = 300, bh = 84, gap = 20, x0 = 350, y0 = 170;
      for (let i = 0; i < this.items.length && i < 16; i++) {
        const row = Math.floor(i / cols), col = i % cols;
        this.itemButtons.push({ item: this.items[i],
          x: Math.floor(x0 + col * (bw + gap)), y: Math.floor(y0 + row * (bh + gap)), w: bw, h: bh });
      }
    }
    exit() { this.itemButtons = []; this.shop = null; }
    _filterButtons(R) {
      const filters = [['all', 'Tất cả'], ['pen', 'Bút'], ['board', 'Bảng'], ['pet', 'Pet']];
      this.filterButtons = [];
      let fx = 350;
      for (let i = 0; i < filters.length; i++) {
        this.filterButtons.push({ key: filters[i][0], label: filters[i][1], x: fx, y: 120, w: 130, h: 40 });
        fx += 140;
      }
      for (let i = 0; i < this.filterButtons.length; i++) {
        const f = this.filterButtons[i];
        drawBtn(R, f.x, f.y, f.w, f.h, f.label, f.key === this.filter ? PURPLE_BTN : SHADOW, { fontSize: 15 });
      }
    }
    handleInput(input, dt) {
      const click = input.consumeClick ? input.consumeClick() : null;
      if (!click) return;
      if (hit(click, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h)) {
        global.Game.states.change('menu', null, 'fade'); return;
      }
      if (!this.shop) return;
      for (let i = 0; i < this.filterButtons.length; i++) {
        const f = this.filterButtons[i];
        if (hit(click, f.x, f.y, f.w, f.h)) { this.filter = f.key; this._rebuild(); return; }
      }
      for (let i = 0; i < this.itemButtons.length; i++) {
        const b = this.itemButtons[i];
        if (hit(click, b.x, b.y, b.w, b.h)) {
          const it = b.item;
          const res = this._actItem(it);
          this.statusMsg = res ? res.msg : 'Error';
          this.statusTimer = 3.0;
          m9SyncPlayer();
          this._rebuild();
          L.info('[Shop]', it.category, it.key, '→', res && res.msg);
          return;
        }
      }
    }
    _actItem(it) {
      const cat = it.category, key = it.key;
      if (!this.shop) return { ok: false, msg: 'Shop chưa tải' };
      if (cat === 'pet') {
        if (this.shop.ownsPet(key)) return { ok: false, msg: 'Đã sở hữu' };
        const r = this.shop.purchasePet(key);
        if (r && r.ok) {
          const d = m9AccountData();
          if (d) { d.pet = d.pet || {}; d.pet.type = key; }
        }
        return r;
      }
      if (this.shop.ownsSkin(key)) return this.shop.equipSkin(key);
      return this.shop.purchaseSkin(key);
    }
    update(dt) { if (this.statusTimer > 0) this.statusTimer = Math.max(0, this.statusTimer - dt); }
    draw(ctx, W2, H2) {
      const R = global.Game.renderer;
      R.clear('#a5d6a7');
      R.text('CỬA HÀNG SIÊU CẤP', W2 / 2, 80, {   // Desktop main.py:2465 y=80
        font: 'bold 40px Quicksand, sans-serif', fill: '#20242e', align: 'center', baseline: 'middle'
      });
      const d = m9AccountData() || {};
      R.text('💰 ' + (d.gold !== undefined ? d.gold : 0), W2 - 220, 60, {
        font: '26px Quicksand, sans-serif', fill: '#c8a43a', align: 'right', baseline: 'middle'
      });
      this._filterButtons(R);
      if (this.dataMissing || !this.shop) {
        R.text('Đang tải cửa hàng...', W2 / 2, H2 / 2, {
          font: 'bold 26px Quicksand, sans-serif', fill: '#6b4f00', align: 'center', baseline: 'middle'
        });
      }
      for (let i = 0; i < this.itemButtons.length && i < 12; i++) {
        const b = this.itemButtons[i], it = b.item;
        const owned = this.shop.isOwned(it.category, it.key);
        const price = it.price !== undefined ? it.price : 0;
        const color = owned ? GREEN_BTN : (it.category === 'pet' ? ORANGE_BTN : BLUE_BTN);
        /* Parity main.py ShopState: item đang dùng được viền vàng (255,215,0). */
        const equipped = (it.category === 'pet' && d.pet && d.pet.type === it.key) ||
          (it.category === 'skin' && (d.equipped_pen === it.key || d.equipped_board === it.key));
        const border = equipped ? 'rgb(255,215,0)' : '#ffffff';
        const borderW = equipped ? 3 : 2;
        R.fillRoundRect(b.x, b.y, b.w, b.h, 12, css(color) + '', border, borderW);
        R.text(it.icon || (it.category === 'pet' ? '🐾' : '✏️'), b.x + 34, b.y + b.h / 2, {
          font: '26px Quicksand, sans-serif', fill: '#ffffff', align: 'center', baseline: 'middle'
        });
        R.text(String(it.name || it.key).slice(0, 16), b.x + 68, b.y + 24, {
          font: 'bold 17px Quicksand, sans-serif', fill: '#ffffff', baseline: 'middle'
        });
        R.text(String(it.description || '').slice(0, 30), b.x + 68, b.y + 48, {
          font: '13px Quicksand, sans-serif', fill: 'rgba(255,255,255,0.85)', baseline: 'middle'
        });
        const state = equipped ? '★ ĐANG DÙNG' : owned ? '✓ Đã sở hữu' : price + ' 💰';
        R.text(state, b.x + 68, b.y + 70, {
          font: 'bold 14px Quicksand, sans-serif', fill: equipped ? 'rgb(255,215,0)' : owned ? 'rgba(255,255,255,0.95)' : '#ffe9a0', baseline: 'middle'
        });
      }
      if (this.statusTimer > 0 && this.statusMsg) {
        R.text(this.statusMsg, W2 / 2, H2 - 40, {
          font: '20px Quicksand, sans-serif', fill: '#20242e', align: 'center', baseline: 'middle'
        });
      }
      drawBtn(R, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h, '⬅️ QUAY LẠI', RED_BTN, { fontSize: 16 });
    }
  }

  /* M10-D STATE: ADMIN PANEL (admin_panel.py:131-231, AdminAccountMixin:101-128)
     Server là authority duy nhất: client chỉ request/render/command.
     KHÔNG có admin password/role/is_admin quyết định ở client. */
  class AdminPanelState extends BaseState {
    constructor() {
      super('adminPanel');
      this.backBtn = { x: 40, y: 700, w: 180, h: 55 };
      this.rows = [];
      this.denied = true; // chỉ server mở khoá qua /api/admin/me 200
      this.statusMsg = '';
      this.statusTimer = 0;
    }
    enter() {
      this.rows = [];
      this.denied = true;
      this.statusMsg = '';
      this.statusTimer = 0;
      const self = this;
      this._api('/api/admin/me').then(function (r) {
        if (r && r.status === 200 && r.data && r.data.ok && r.data.role === 'admin') {
          self._loadUsers();
        } else {
          self.denied = true; // 401/403 từ server — client không tự cấp quyền
          L.warn('[Admin] access denied by server, status', r && r.status);
        }
      });
    }
    _api(path, body, method) {
      const opt = {
        method: method || (body ? 'POST' : 'GET'),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      };
      if (body) opt.body = JSON.stringify(body);
      return fetch(path, opt).then(function (r) {
        return r.json().then(function (data) {
          return { status: r.status, data: data };
        });
      }).catch(function (err) {
        L.warn('[Admin] api error', err && err.message);
        return { status: 0, data: { ok: false, error: 'NETWORK_ERROR' } };
      });
    }
    _loadUsers() {
      const self = this;
      this._api('/api/admin/users').then(function (r) {
        if (r && r.status === 200 && r.data && r.data.ok) {
          self.rows = self._buildRows(r.data.users || []);
          self.denied = false;
        } else {
          self.denied = true;
        }
      });
    }
    // admin_panel.py:209-231 — skip admin row, buttons MAX/LOCK/RESET
    _buildRows(users) {
      const rows = [];
      let y = 170;
      for (let i = 0; i < users.length; i++) {
        const u = users[i];
        if (u.username === 'admin') continue; // admin_panel.py:212-213
        if (y > 630) break;
        rows.push({ username: u.username, grade: u.grade, level: u.level, xp: u.xp,
          status: u.status, y: y,
          btns: [
            { op: 'set-max', label: 'MAX', x: 760, y: y, w: 80, h: 36 },
            { op: 'lock-user', label: 'KHÓA', x: 850, y: y, w: 80, h: 36 },
            { op: 'reset-user', label: 'RESET', x: 940, y: y, w: 80, h: 36 }
          ] });
        y += 60;
      }
      return rows;
    }
    exit() { this.rows = []; }
    handleInput(input, dt) {
      const click = input.consumeClick ? input.consumeClick() : null;
      if (!click) return;
      if (hit(click, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h)) {
        global.Game.states.change('menu', null, 'fade'); return;
      }
      if (this.denied) return;
      for (let i = 0; i < this.rows.length; i++) {
        const row = this.rows[i];
        for (let j = 0; j < row.btns.length; j++) {
          const b = row.btns[j];
          if (hit(click, b.x, b.y, b.w, b.h)) { this._act(b.op, row.username); return; }
        }
      }
    }
    _act(op, username) {
      const self = this;
      this._api('/api/admin/' + op, { username: username }, 'POST').then(function (r) {
        if (r && r.status === 200 && r.data && r.data.ok) {
          self.statusMsg = 'OK: ' + op + ' ' + username;
          self._loadUsers();
        } else {
          self.statusMsg = 'L\u1ED7i ' + (r && r.status) + ' ' + op;
        }
        self.statusTimer = 3;
        L.info('[Admin]', op, username, '\u2192', r && r.status);
      });
    }
    update(dt) { if (this.statusTimer > 0) this.statusTimer = Math.max(0, this.statusTimer - dt); }
    draw(ctx, W2, H2) {
      const R = global.Game.renderer;
      R.clear('#1e1e32');
      R.text('QU\u1EA2N L\u00DD NG\u01AF\u1EDCI CH\u01A0I', W2 / 2, 50, {
        font: 'bold 34px Quicksand, sans-serif', fill: '#f6d67a', align: 'center', baseline: 'middle'
      });
      drawBtn(R, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h,
        '\u2B05\uFE0F QUAY L\u1EA0I', RED_BTN, { fontSize: 16 });
      if (this.denied) {
        R.text('Kh\u00F4ng c\u00F3 quy\u1EC1n admin (server t\u1EEB ch\u1ED1i)', W2 / 2, H2 / 2, {
          font: 'bold 24px Quicksand, sans-serif', fill: '#c85050', align: 'center', baseline: 'middle'
        });
        return;
      }
      // Headers (admin_panel.py:198-203)
      R.text('Ng\u01B0\u1EDDi ch\u01A1i', 130, 128, { font: 'bold 20px Quicksand, sans-serif', fill: '#f6d67a', baseline: 'middle' });
      R.text('L\u1EDBp', 400, 128, { font: 'bold 20px Quicksand, sans-serif', fill: '#f6d67a', baseline: 'middle' });
      R.text('C\u1EA5p', 490, 128, { font: 'bold 20px Quicksand, sans-serif', fill: '#f6d67a', baseline: 'middle' });
      R.text('XP', 590, 128, { font: 'bold 20px Quicksand, sans-serif', fill: '#f6d67a', baseline: 'middle' });
      for (let i = 0; i < this.rows.length; i++) {
        const row = this.rows[i];
        const yy = row.y + 18;
        R.text(row.username + (row.status === 'locked' ? ' \uD83D\uDD12' : ''), 130, yy,
          { font: '18px Quicksand, sans-serif', fill: '#ffffff', baseline: 'middle' });
        R.text(String(row.grade), 400, yy, { font: '18px Quicksand, sans-serif', fill: '#ffffff', baseline: 'middle' });
        R.text(String(row.level), 490, yy, { font: '18px Quicksand, sans-serif', fill: '#7ee2a8', baseline: 'middle' });
        R.text(String(row.xp), 590, yy, { font: '18px Quicksand, sans-serif', fill: '#f6d67a', baseline: 'middle' });
        for (let j = 0; j < row.btns.length; j++) {
          const b = row.btns[j];
          drawBtn(R, b.x, b.y, b.w, b.h, b.label,
            b.op === 'lock-user' ? RED_BTN : (b.op === 'set-max' ? ORANGE_BTN : SHADOW), { fontSize: 13 });
        }
      }
      if (this.statusTimer > 0 && this.statusMsg) {
        R.text(this.statusMsg, W2 / 2, H2 - 30, {
          font: '18px Quicksand, sans-serif', fill: '#9fe0ff', align: 'center', baseline: 'middle'
        });
      }
    }
  }

  /* M10-B STATE: PET (main.py:2273 shop pet category; PetSystem M9-B) */
  class PetState extends BaseState {
    constructor() {
      super('pet');
      this.backBtn = { x: 40, y: 700, w: 180, h: 55 };
      this.statusMsg = '';
      this.statusTimer = 0;
      this.itemButtons = [];
      this.items = [];
      this.dataMissing = true;
    }
    enter(params) {
      this.dataMissing = true;
      this.items = [];
      this.itemButtons = [];
      this.statusMsg = '';
      this.statusTimer = 0;
      const d = m9AccountData();
      if (!d) { this.dataMissing = true; return; }
      m9EnsureDst(d);
      const Ctor = global.ShopSystem;
      if (params && params.petTypes && params.skinTypes) {
        this.shop = new Ctor({ petTypes: params.petTypes, skinTypes: params.skinTypes,
          data: d, adapter: { save: m9SaveHook() } });
        this.dataMissing = false;
        this._rebuild();
      } else if (global.ShopApi && Ctor && typeof global.ShopApi.loadPetTypes === 'function') {
        const self = this;
        Promise.all([global.ShopApi.loadPetTypes(), global.ShopApi.loadSkinTypes()]).then(function (res) {
          self.shop = new Ctor({ petTypes: res[0], skinTypes: res[1], data: d,
            adapter: { save: m9SaveHook() } });
          self.dataMissing = false;
          self._rebuild();
        }).catch(function (err) {
          L.error('[Pet] load types failed:', err);
          self.dataMissing = true;
        });
      }
    }
    _petList() {
      const all = this.shop ? this.shop.filter('pet', '') : [];
      return all.filter(function (it) { return it.category === 'pet'; });
    }
    _rebuild() {
      this.items = this._petList();
      this.itemButtons = [];
      const cols = 3, bw = 240, bh = 120, gap = 24, x0 = 120, y0 = 170;
      for (let i = 0; i < this.items.length && i < 24; i++) {
        const row = Math.floor(i / cols), col = i % cols;
        this.itemButtons.push({ item: this.items[i],
          x: Math.floor(x0 + col * (bw + gap)), y: Math.floor(y0 + row * (bh + gap)), w: bw, h: bh });
      }
    }
    exit() { this.itemButtons = []; this.shop = null; }
    handleInput(input, dt) {
      const click = input.consumeClick ? input.consumeClick() : null;
      if (!click) return;
      if (hit(click, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h)) {
        global.Game.states.change('menu', null, 'fade'); return;
      }
      if (!this.shop) return;
      for (let i = 0; i < this.itemButtons.length; i++) {
        const b = this.itemButtons[i];
        if (hit(click, b.x, b.y, b.w, b.h)) {
          const key = b.item.key;
          const res = this.shop.ownsPet(key)
            ? (this.shop.changePetType(key)
              ? { ok: true, msg: 'Đổi thú cưng thành công!' }
              : { ok: false, msg: 'Không thể đổi thú cưng.' })
            : this.shop.purchasePet(key);
          this.statusMsg = res ? res.msg : 'Error';
          this.statusTimer = 3.0;
          m9SyncPlayer();
          this._rebuild();
          return;
        }
      }
    }
    update(dt) { if (this.statusTimer > 0) this.statusTimer = Math.max(0, this.statusTimer - dt); }
    draw(ctx, W2, H2) {
      const R = global.Game.renderer;
      R.clear('#a5d6a7');
      R.text('THÚ CỔNG ・ PET', W2 / 2, 60, {
        font: 'bold 38px Quicksand, sans-serif', fill: '#20242e', align: 'center', baseline: 'middle'
      });
      if (this.dataMissing || !this.shop) {
        R.text('Đang tải thú cưng...', W2 / 2, H2 / 2, {
          font: 'bold 26px Quicksand, sans-serif', fill: '#6b4f00', align: 'center', baseline: 'middle'
        });
      }
      for (let i = 0; i < this.itemButtons.length && i < 12; i++) {
        const b = this.itemButtons[i], it = b.item;
        const owned = this.shop.isOwned('pet', it.key);
        const cur = (this.shop.getCurrentPet && this.shop.getCurrentPet().type) || '';
        const price = it.price !== undefined ? it.price : 0;
        const color = (cur === it.key) ? GREEN_BTN : (owned ? ORANGE_BTN : SHADOW);
        drawBtn(R, b.x, b.y, b.w, b.h, (it.name || it.key) + (cur === it.key ? '  ★' : owned ? '' : '  ' + price + '💰'), color, { fontSize: 15 });
      }
      if (this.statusTimer > 0 && this.statusMsg) {
        R.text(this.statusMsg, W2 / 2, H2 - 40, {
          font: '20px Quicksand, sans-serif', fill: '#20242e', align: 'center', baseline: 'middle'
        });
      }
      drawBtn(R, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h, '⬅️ QUAY LẠI', RED_BTN, { fontSize: 16 });
    }
  }

  /* M10-B STATE: SKIN (main.py:2273 shop pen/board; SkinSystem M9-B) */
  class SkinState extends BaseState {
    constructor() {
      super('skin');
      this.backBtn = { x: 40, y: 700, w: 180, h: 55 };
      this.filter = 'pen';
      this.statusMsg = '';
      this.statusTimer = 0;
      this.itemButtons = [];
      this.items = [];
      this.dataMissing = true;
    }
    enter(params) {
      this.dataMissing = true;
      this.items = [];
      this.itemButtons = [];
      this.statusMsg = '';
      this.statusTimer = 0;
      this.filter = (params && params.filter) || 'pen';
      const d = m9AccountData();
      if (!d) { this.dataMissing = true; return; }
      m9EnsureDst(d);
      const Ctor = global.ShopSystem;
      if (params && params.petTypes && params.skinTypes) {
        this.shop = new Ctor({ petTypes: params.petTypes, skinTypes: params.skinTypes,
          data: d, adapter: { save: m9SaveHook() } });
        this.dataMissing = false;
        this._rebuild();
      } else if (global.ShopApi && Ctor && typeof global.ShopApi.loadSkinTypes === 'function') {
        const self = this;
        Promise.all([global.ShopApi.loadPetTypes(), global.ShopApi.loadSkinTypes()]).then(function (res) {
          self.shop = new Ctor({ petTypes: res[0], skinTypes: res[1], data: d,
            adapter: { save: m9SaveHook() } });
          self.dataMissing = false;
          self._rebuild();
        }).catch(function (err) {
          L.error('[Skin] load types failed:', err);
          self.dataMissing = true;
        });
      }
    }
    _skinList() {
      const all = this.shop ? this.shop.filter(this.filter, '') : [];
      const self = this;
      return all.filter(function (it) { return it.category === self.filter; });
    }
    _rebuild() {
      this.items = this._skinList();
      this.itemButtons = [];
      const cols = 2, bw = 300, bh = 90, gap = 20, x0 = 350, y0 = 170;
      for (let i = 0; i < this.items.length && i < 16; i++) {
        const row = Math.floor(i / cols), col = i % cols;
        this.itemButtons.push({ item: this.items[i],
          x: Math.floor(x0 + col * (bw + gap)), y: Math.floor(y0 + row * (bh + gap)), w: bw, h: bh });
      }
    }
    exit() { this.itemButtons = []; this.shop = null; }
    handleInput(input, dt) {
      const click = input.consumeClick ? input.consumeClick() : null;
      if (!click) return;
      if (hit(click, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h)) {
        global.Game.states.change('menu', null, 'fade'); return;
      }
      if (!this.shop) return;
      if (hit(click, 350, 120, 130, 40)) { this.filter = 'pen'; this._rebuild(); return; }
      if (hit(click, 490, 120, 130, 40)) { this.filter = 'board'; this._rebuild(); return; }
      for (let i = 0; i < this.itemButtons.length; i++) {
        const b = this.itemButtons[i];
        if (hit(click, b.x, b.y, b.w, b.h)) {
          const key = b.item.key;
          const res = this.shop.ownsSkin(key) ? this.shop.equipSkin(key) : this.shop.purchaseSkin(key);
          this.statusMsg = res ? res.msg : 'Error';
          this.statusTimer = 3.0;
          m9SyncPlayer();
          this._rebuild();
          return;
        }
      }
    }
    _filterRow(R) {
      drawBtn(R, 350, 120, 130, 40, 'BÚT', this.filter === 'pen' ? PURPLE_BTN : SHADOW, { fontSize: 15 });
      drawBtn(R, 490, 120, 130, 40, 'BẢNG', this.filter === 'board' ? PURPLE_BTN : SHADOW, { fontSize: 15 });
    }
    update(dt) { if (this.statusTimer > 0) this.statusTimer = Math.max(0, this.statusTimer - dt); }
    draw(ctx, W2, H2) {
      const R = global.Game.renderer;
      R.clear('#a5d6a7');
      R.text('BÚT & BẢNG ・ SKIN', W2 / 2, 60, {
        font: 'bold 38px Quicksand, sans-serif', fill: '#20242e', align: 'center', baseline: 'middle'
      });
      this._filterRow(R);
      if (this.dataMissing || !this.shop) {
        R.text('Đang tải skin...', W2 / 2, H2 / 2, {
          font: 'bold 26px Quicksand, sans-serif', fill: '#6b4f00', align: 'center', baseline: 'middle'
        });
      }
      for (let i = 0; i < this.itemButtons.length && i < 12; i++) {
        const b = this.itemButtons[i], it = b.item;
        const owned = this.shop.isOwned(it.category, it.key);
        const eq = this.shop.getEquippedSkins();
        const cur = this.filter === 'pen' ? eq.pen : eq.board;
        const price = it.price !== undefined ? it.price : 0;
        const color = (cur === it.key) ? GREEN_BTN : (owned ? ORANGE_BTN : SHADOW);
        R.fillRoundRect(b.x, b.y, b.w, b.h, 12, css(color), cur === it.key ? 'rgb(255,215,0)' : '#ffffff', cur === it.key ? 3 : 2);
        R.text(it.icon || (this.filter === 'pen' ? '✏️' : '🪵'), b.x + 30, b.y + b.h / 2, {
          font: '24px Quicksand, sans-serif', fill: '#ffffff', align: 'center', baseline: 'middle'
        });
        R.text(String(it.name || it.key).slice(0, 14), b.x + 60, b.y + 22, {
          font: 'bold 16px Quicksand, sans-serif', fill: '#ffffff', baseline: 'middle'
        });
        R.text(String(it.description || '').slice(0, 30), b.x + 60, b.y + 46, {
          font: '12px Quicksand, sans-serif', fill: 'rgba(255,255,255,0.85)', baseline: 'middle'
        });
        const state = cur === it.key ? '★ ĐANG DÙNG' : owned ? '✓ Đã sở hữu' : price + ' 💰';
        R.text(state, b.x + 60, b.y + 72, {
          font: 'bold 13px Quicksand, sans-serif', fill: cur === it.key ? 'rgb(255,215,0)' : owned ? 'rgba(255,255,255,0.95)' : '#ffe9a0', baseline: 'middle'
        });
      }
      if (this.statusTimer > 0 && this.statusMsg) {
        R.text(this.statusMsg, W2 / 2, H2 - 40, {
          font: '20px Quicksand, sans-serif', fill: '#20242e', align: 'center', baseline: 'middle'
        });
      }
      drawBtn(R, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h, '⬅️ QUAY LẠI', RED_BTN, { fontSize: 16 });
    }
  }

  /* M10-B STATE: GACHA (main.py:2947-3090 CardShopState + gacha.js M9-C) */
  class GachaState extends BaseState {
    constructor() {
      super('gacha');
      this.backBtn = { x: 40, y: 700, w: 180, h: 55 };
      this.banner = 'standard';
      this.statusMsg = '';
      this.statusTimer = 0;
      this.lastResult = null;
      this.dataMissing = true;
      this.roll1 = { x: 420, y: 480, w: 250, h: 60 };
      this.roll10 = { x: 700, y: 480, w: 250, h: 60 };
    }
    enter(params) {
      this.lastResult = null;
      this.statusMsg = '';
      this.statusTimer = 0;
      const d = m9AccountData();
      if (!d) { this.dataMissing = true; return; }
      m9EnsureDst(d);
      const Ctor = global.GachaSystem;
      if (params && params.gacha) { this.gacha = params.gacha; this.dataMissing = false; return; }
      if (Ctor) {
        this.gacha = new Ctor({ data: d, rng: (params && params.rng) || null });
        if (this.gacha) { this.dataMissing = false; this.gacha.save = m9SaveHook(); }
      } else { this.dataMissing = true; }
    }
    exit() { this.gacha = null; this.lastResult = null; }
    handleInput(input, dt) {
      const click = input.consumeClick ? input.consumeClick() : null;
      if (!click) return;
      if (hit(click, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h)) {
        global.Game.states.change('menu', null, 'fade'); return;
      }
      if (this.dataMissing || !this.gacha) return;
      if (hit(click, this.roll1.x, this.roll1.y, this.roll1.w, this.roll1.h)) {
        this.lastResult = this.gacha.roll(1, this.banner);
        this.statusMsg = 'KÉO THẺ: ' + (this.lastResult && this.lastResult.card ? this.lastResult.card.title : '?');
        this.statusTimer = 3.0;
        return;
      }
      if (hit(click, this.roll10.x, this.roll10.y, this.roll10.w, this.roll10.h)) {
        this.lastResult = this.gacha.roll(10, this.banner);
        this.statusMsg = 'KÉO THẺ ×10!';
        this.statusTimer = 3.0;
        return;
      }
      // banner toggle
      if (hit(click, 420, 380, 250, 50)) { this.banner = 'standard'; return; }
      if (hit(click, 700, 380, 250, 50)) { this.banner = 'gold'; return; }
    }
    update(dt) { if (this.statusTimer > 0) this.statusTimer = Math.max(0, this.statusTimer - dt); }
    draw(ctx, W2, H2) {
      const R = global.Game.renderer;
      R.clear('#a5d6a7');
      R.text('ĐỎI THẺ ・ GACHA', W2 / 2, 60, {
        font: 'bold 38px Quicksand, sans-serif', fill: '#20242e', align: 'center', baseline: 'middle'
      });
      if (this.dataMissing || !this.gacha) {
        R.text('Đang tải gacha...', W2 / 2, H2 / 2, {
          font: 'bold 26px Quicksand, sans-serif', fill: '#6b4f00', align: 'center', baseline: 'middle'
        });
        drawBtn(R, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h, '⬅️ QUAY LẠI', RED_BTN, { fontSize: 16 });
        return;
      }
      drawBtn(R, 420, 380, 250, 50, 'Tiêu Chuẩn', this.banner === 'standard' ? PURPLE_BTN : SHADOW, { fontSize: 16 });
      drawBtn(R, 700, 380, 250, 50, 'Vàng', this.banner === 'gold' ? ORANGE_BTN : SHADOW, { fontSize: 16 });
      drawBtn(R, this.roll1.x, this.roll1.y, this.roll1.w, this.roll1.h, 'KÉO THẺ ×1', BLUE_BTN, { fontSize: 17 });
      drawBtn(R, this.roll10.x, this.roll10.y, this.roll10.w, this.roll10.h, 'KÉO THẺ ×10', GREEN_BTN, { fontSize: 17 });
      const info = this.gacha.getPityInfo ? this.gacha.getPityInfo() : null;
      if (info) {
        R.text('Pity: ' + info.pull_count + '/' + info.hard_pity + ' (soft @' + info.soft_pity_start + ') · tổng ' + info.total_pulls, W2 / 2, 580, {
          font: '20px Quicksand, sans-serif', fill: '#20242e', align: 'center', baseline: 'middle'
        });
      }
      if (this.lastResult) {
        // Result panel — rarity color + NEW/duplicate indicator (parity is_new Python)
        const lr = this.lastResult;
        const rar = lr.rarity || (lr.card && lr.card.rarity) || 'common';
        const rarBg = rar === 'legendary' ? 'rgba(255,215,0,0.22)'
          : rar === 'rare' ? 'rgba(170,120,255,0.22)' : 'rgba(255,255,255,0.12)';
        const rarBorder = rar === 'legendary' ? 'rgb(255,215,0)'
          : rar === 'rare' ? 'rgb(170,120,255)' : 'rgb(255,255,255,0.4)';
        R.fillRoundRect(450, 130, 400, 210, 14, rarBg, rarBorder, 2);
        R.text('KẾT QUẢ', W2 / 2, 160, {
          font: 'bold 18px Quicksand, sans-serif', fill: '#20242e', align: 'center', baseline: 'middle'
        });
        R.text(String((lr.card && lr.card.title) || '?').slice(0, 28), W2 / 2, 205, {
          font: 'bold 22px Quicksand, sans-serif', fill: '#20242e', align: 'center', baseline: 'middle'
        });
        const rarLabel = rar === 'legendary' ? '★ LEGENDARY' : rar === 'rare' ? '★ RARE' : 'Common';
        R.text(rarLabel, W2 / 2, 245, {
          font: 'bold 18px Quicksand, sans-serif',
          fill: rar === 'legendary' ? '#b8860b' : rar === 'rare' ? '#6a3db8' : '#556',
          align: 'center', baseline: 'middle'
        });
        const isNew = lr.isNew === true;
        R.text(isNew ? '✨ MỚI!' : 'Đã có (trùng)', W2 / 2, 290, {
          font: 'bold 20px Quicksand, sans-serif', fill: isNew ? '#2e8b57' : '#778',
          align: 'center', baseline: 'middle'
        });
      }
      drawBtn(R, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h, '⬅️ QUAY LẠI', RED_BTN, { fontSize: 16 });
    }
  }

  /* M10-B STATE: ACHIEVEMENT (main.py:1927-2002 AchievementViewState) */
  class AchievementState extends BaseState {
    /* M32.5 exact re-port of Desktop main.py:1927-2001 (AchievementViewState).
       M32.3/M32.4 fixed only the back button; the card internals, the summary
       line and the wheel scroll still did not match Desktop. Every constant
       below cites the Desktop line it came from. The book itself already
       matches: _wireBookState('AchievementState') calls book.draw(R, null, null)
       which is the exact equivalent of Desktop's
       book.draw(s, lambda s, r: None, lambda s, r: None) (main.py:1942). */
    constructor() {
      super('achievement');
      this.backBtn = { x: 810, y: 600, w: 300, h: 60 };  // Desktop main.py:1930
      this.dataMissing = true;
      this.rows = [];
      this.scrollY = 0;                                  // Desktop main.py:1931
    }
    enter(params) {
      this.dataMissing = true;
      this.rows = [];
      this.scrollY = 0;                                  // Desktop main.py:1931
      const d = m9AccountData();
      if (!d) { this.dataMissing = true; return; }
      m9EnsureDst(d);
      const unlocked = d.achievements_unlocked || [];
      this.unlocked = unlocked;
      if (params && params.definitions) {
        this.definitions = params.definitions;
        this.dataMissing = false;
        this._buildRows();
      } else if (global.AchievementSys && typeof global.AchievementSys.getAchievementSystem === 'function') {
        const sys = global.AchievementSys.getAchievementSystem();
        try { this.definitions = sys.getDefinitions ? sys.getDefinitions() : null; }
        catch (e) { this.definitions = null; }
        if (this.definitions) { this.dataMissing = false; this._buildRows(); }
      }
    }
    /* Desktop lays the cards out inside draw() (main.py:1960-1969), not in a
       separate build pass, because the row y depends on self.scroll_y. Keep the
       item list here and compute the geometry per frame so the scroll is real. */
    _buildRows() {
      this.rows = [];
      const defs = this.definitions || {};
      const keys = Object.keys(defs);
      for (let i = 0; i < keys.length; i++) {
        this.rows.push({ id: keys[i], def: defs[keys[i]] });
      }
    }
    exit() { this.rows = []; }
    handleInput(input, dt) {
      /* Desktop main.py:1936-1937 MOUSEWHEEL -> scroll_y = min(0, scroll_y + e.y*30).
         Only ever scrolls upward (negative), clamped at 0. */
      const wheel = (input && input.consumeWheel) ? input.consumeWheel() : null;
      if (wheel) {
        this.scrollY = Math.min(0, this.scrollY + (wheel.deltaY || 0) * 30);
      }
      const click = input.consumeClick ? input.consumeClick() : null;
      if (!click) return;
      if (hit(click, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h)) {
        global.Game.states.change('menu', null, 'PAGE');
      }
    }
    update() {}
    draw(ctx, W2, H2) {
      const R = global.Game.renderer;
      R.clear('#a5d6a7');                               // Desktop main.py:1941 s.fill((165,214,167))
      /* Title: Desktop main.py:1944-1951 render_text_with_leading_icon(
         "🏆 THÀNH TÍCH", font_big, color=(255,215,0), gap=8) blitted at
         y = 90 - height//2. font_big is 48px, so the centre lands at 90-24 = 66. */
      R.text('🏆 THÀNH TÍCH', W2 / 2, 66, {
        font: 'bold 48px Quicksand, sans-serif', fill: 'rgb(255,215,0)',
        align: 'center', baseline: 'middle'
      });
      /* Summary: Desktop main.py:1958 draw_text_center(..., WHITE, WIDTH//2, 130) */
      const got = this.unlocked ? this.unlocked.length : 0;
      const total = this.definitions ? Object.keys(this.definitions).length : 0;
      R.text('Đã đạt: ' + got + '/' + total, W2 / 2, 130, {
        font: '24px Quicksand, sans-serif', fill: '#ffffff',
        align: 'center', baseline: 'middle'
      });
      if (this.dataMissing) {
        R.text('Đang tải thành tích...', W2 / 2, H2 / 2, {
          font: 'bold 24px Quicksand, sans-serif', fill: '#6b4f00', align: 'center', baseline: 'middle'
        });
      }
      const yStart = 170 + this.scrollY;                 // Desktop main.py:1960
      const colW = 540;                                 // Desktop main.py:1961
      for (let i = 0; i < this.rows.length; i++) {
        const r = this.rows[i];
        const isUn = (this.unlocked || []).indexOf(r.id) >= 0;
        const col = i % 2;                              // Desktop main.py:1964
        const row = Math.floor(i / 2);                  // Desktop main.py:1965
        const x = 100 + col * (colW + 30);              // Desktop main.py:1966
        const y = yStart + row * 90;                     // Desktop main.py:1967
        if (y < 150 || y > H2 - 100) continue;           // Desktop main.py:1968-1969 cull
        /* Card surface: Desktop main.py:1972-1974 draws an SRCALPHA rect
           (60,60,80) unlocked / (40,40,50) locked at alpha 200, radius 12. */
        const cardFill = isUn ? 'rgb(60,60,80)' : 'rgb(40,40,50)';
        /* Desktop draws the card on a pygame SRCALPHA surface, so the Web needs a
           translucent fill. Guard both alpha helpers: a state draw must never
           throw, and some harnesses (polish_m3) stub a partial Renderer. The
           opaque fillRoundRect fallback keeps the card visible either way. */
        if (typeof R.fillRoundRectAlpha === 'function') {
          R.fillRoundRectAlpha(x, y, colW, 80, 12, cardFill, 200 / 255);
        } else {
          R.fillRoundRect(x, y, colW, 80, 12, cardFill, 'rgba(0,0,0,0)', 0);
        }
        /* Border: Desktop main.py:1975-1979 — unlocked (200,170,80) alpha 200
           width 2; locked (100,100,100) alpha 150 width 2. */
        const bStroke = isUn ? 'rgb(200,170,80)' : 'rgb(100,100,100)';
        if (typeof R.strokeRoundRectAlpha === 'function') {
          R.strokeRoundRectAlpha(x, y, colW, 80, 12, bStroke, (isUn ? 200 : 150) / 255, 2);
        } else {
          R.fillRoundRect(x, y, colW, 80, 12, 'rgba(0,0,0,0)', bStroke, 2);
        }
        /* Icon: Desktop main.py:1982-1985 — the achievement icon when unlocked,
           the padlock glyph when locked; load_icon_font(30), WHITE, at (x+15, y+25). */
        R.text(isUn ? (r.def.icon || '🏆') : '🔒', x + 15, y + 25, {
          font: '30px Quicksand, sans-serif', fill: '#ffffff', baseline: 'middle'
        });
        /* Name: Desktop main.py:1987-1989 — (200,170,80) unlocked,
           (120,120,120) locked, at (x+60, y+10). No tick/lock prefix. */
        R.text(String(r.def.name || r.id), x + 60, y + 10, {
          font: 'bold 24px Quicksand, sans-serif',
          fill: isUn ? 'rgb(200,170,80)' : 'rgb(120,120,120)', baseline: 'middle'
        });
        /* Description: Desktop main.py:1991-1994 — (180,180,180) unlocked,
           (90,90,90) locked, load_font(16), at (x+60, y+45). */
        R.text(String(r.def.desc || ''), x + 60, y + 45, {
          font: '16px Quicksand, sans-serif',
          fill: isUn ? 'rgb(180,180,180)' : 'rgb(90,90,90)', baseline: 'middle'
        });
        /* XP: Desktop main.py:1996-2000 — "+{xp} XP ✓" (100,255,100) when
           unlocked, "+{xp} XP" (100,100,100) when locked, at (x+col_w-100, y+45). */
        if (r.def.xp) {
          R.text('+' + r.def.xp + ' XP' + (isUn ? ' ✓' : ''), x + colW - 100, y + 45, {
            font: '16px Quicksand, sans-serif',
            fill: isUn ? 'rgb(100,255,100)' : 'rgb(100,100,100)', baseline: 'middle'
          });
        }
      }
      drawBtn(R, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h, '⬅️ QUAY LẠI', RED_BTN, { fontSize: 16 });
    }
  }

  /* M10-B STATE: DAILY (game_init.py:3637-3668 claim_daily_reward) */
﻿  // ===================================================================
  // DailyState -- faithful port of Desktop main.py:2002-2099
  // The Desktop DAILY CHALLENGE QUIZ. There is NO timer and NO timeout:
  // update() (main.py:2076-2082) only ticks the book and the feedback overlay.
  // Desktop's daily REWARD is a Menu POPUP (main.py:475-476, drawn 746-747),
  // not a screen; the Web now exposes it as DailyRewardState.
  // ===================================================================
  class DailyState extends BaseState {
    constructor() { super('daily'); this._init(); }

    // main.py:2003-2014 enter()
    _init() {
      this.gr = getPlayer().grade || 1;                 // main.py:2005
      this.title = DAILY_CHALLENGE_TITLE;               // main.py:2006
      this.sc = 0;                                      // main.py:2007
      this.cc = 0;                                      // main.py:2007
      this.tc = 10;                                     // main.py:2007  10 questions
      this.feedback = null;                             // main.py:2008
      this.pendingAdvance = false;                      // main.py:2009
      this.answerTimes = [];                            // main.py:2010
      // main.py:2011 adaptive_ai.reset()
      if (global.adaptiveAI && typeof global.adaptiveAI.reset === 'function') {
        global.adaptiveAI.reset();
      }
      // main.py:2012 back button
      this.backBtn = { x: 810, y: 600, w: 300, h: 60, label: 'THOAT', bg: RED_BTN };
      this.btns = [];                                   // main.py:2019
      this.q = ''; this.ans = ''; this.op = null;       // set by next_q
      this.nextQ();                                     // main.py:2014
    }

    // Desktop builds a fresh DailyState on every visit (main.py:680), so the
    // StateManager-reused instance must re-apply everything.
    enter() { this._init(); }

    // main.py:2015-2020 next_q()
    nextQ() {
      // main.py:2016 rid = randint(1,40) if grade==1 else randint(1,60)
      const maxRid = this.gr === 1 ? 40 : 60;
      const rid = 1 + Math.floor(Math.random() * maxRid);
      const pl = getPlayer();
      const diff = (global.adaptiveAI && global.adaptiveAI.getCurrentDifficulty) ?
        global.adaptiveAI.getCurrentDifficulty() : 3;
      let res = null;
      try {
        // main.py:2018 safe_generate_question(gr, rid, difficulty, user_id)
        res = global.Game.questionGen.generate(this.gr, rid, diff, pl.username);
      } catch (e) { L.error('[Daily] generate error', e); }
      if (!res || !res.question) {
        this.q = ''; this.ans = ''; this.op = null; this.btns = [];
        return;
      }
      this.q = res.question;
      this.ans = String(res.answer);
      this.op = res.op || null;
      const opts = (res.options || []).map(String);
      // main.py:2019 Button(810, 200 + i*85, 300, 65, str(o), ORANGE_BTN)
      this.btns = opts.map(function (o, i) {
        return { x: 810, y: 200 + i * 85, w: 300, h: 65, value: o, index: i };
      });
      // main.py:2020 adaptive_ai.start_question()
      if (global.adaptiveAI && typeof global.adaptiveAI.startQuestion === 'function') {
        global.adaptiveAI.startQuestion();
      }
    }

    // main.py:2021-2037 _advance_question()
    _advanceQuestion() {
      this.cc += 1;                                              // main.py:2022
      if (this.cc >= this.tc) {                                  // main.py:2023
        const correctAnswers = Math.floor(this.sc / 10);         // main.py:2024
        const accuracy = (correctAnswers / this.tc) * 100;        // main.py:2025
        const stats = {                                           // main.py:2026-2030
          correct: correctAnswers, total: this.tc,
          accuracy: accuracy,
          avg_time: (global.adaptiveAI && global.adaptiveAI.avgTime) ? global.adaptiveAI.avgTime() : 0,
          answer_times: this.answerTimes
        };
        if (accuracy >= 60) {                                     // main.py:2031
          // main.py:2032-2033 xp_earned = correct * 20, then add_xp(xp)
          // Desktop add_xp (game_init.py:370-374) passes the account system so
          // PlayerData.add_exp syncs d["xp"]/d["level"], and THEN calls
          // account_system.save(). Omitting either loses the level-up sync or
          // the persistence, so mirror both.
          const xpEarned = correctAnswers * 20;
          const pl = getPlayer();
          const auth = global.Game && global.Game.auth;
          if (typeof pl.addExp === 'function') pl.addExp(xpEarned, auth);
          if (auth && typeof auth.save === 'function') auth.save();
          // main.py:2034
          global.Game.states.change('victory', {
            title: 'HOAN THANH THU THACH!', score: this.sc,
            lessonTitle: this.title, stats: stats
          }, 'fade');
        } else {                                                 // main.py:2035-2036
          global.Game.states.change('defeat', {
            title: 'CO LEN NAO! LAM LAI NHE',
            correct: correctAnswers, total: this.tc,
            lessonTitle: this.title, stats: stats
          }, 'fade');
        }
      } else { this.nextQ(); }                                   // main.py:2037
    }

    // main.py:2038-2075 handle_event(e)
    handleInput(input, dt) {
      const click = input.consumeClick ? input.consumeClick() : null;
      const key = input.consumePressedKey ? input.consumePressedKey() : null;
      // main.py:2040-2045 while feedback is up the ONLY input is a click,
      // which dismisses it and advances. Nothing else is processed.
      if (this.feedback && this.feedback.active) {
        if (click) {
          this.feedback.active = false;
          this.feedback.dismissed = true;
          this.pendingAdvance = false;                           // main.py:2043
          this._advanceQuestion();                               // main.py:2044
        }
        return;
      }
      if (click) {
        // main.py:2047 back -> MenuState()
        if (hit(click, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h)) {
          global.Game.states.change('menu', null, 'fade');
          return;
        }
        // main.py:2051-2075 answer buttons, first match wins (main.py:2075 break)
        for (let i = 0; i < this.btns.length; i++) {
          const b = this.btns[i];
          if (!hit(click, b.x, b.y, b.w, b.h)) continue;
          this._answer(b.value);
          break;
        }
        return;
      }
      // M15-D2 parity convenience: the same option the mouse path clicks.
      if (key && key.key && key.key.indexOf('Digit') === 0) {
        const n = parseInt(key.key.slice(5), 10);
        if (n >= 1 && n <= this.btns.length) this._answer(this.btns[n - 1].value);
      }
    }

    // main.py:2052-2074 the answer body
    _answer(v) {
      const isCorrect = String(v) === String(this.ans);           // main.py:2053
      // main.py:2054 answer_times.append(now - question_start_time)
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
      const started = (global.adaptiveAI && global.adaptiveAI.questionStartTime) ? global.adaptiveAI.questionStartTime : now;
      this.answerTimes.push((now - started) / 1000);
      if (isCorrect) {
        this.sc += 10;                                           // main.py:2057
      } else {
        // main.py:2059 snd_wrong.play()
        const A = global.Game && global.Game.audio;
        if (A && typeof A.playSfx === 'function') { try { A.playSfx('wrong'); } catch (e) { /* audio optional */ } }
      }
      // main.py:2062-2063 adaptive_ai.record_answer(is_correct, topic_id, "lesson")
      if (global.adaptiveAI && typeof global.adaptiveAI.recordAnswer === 'function') {
        global.adaptiveAI.recordAnswer(isCorrect, this.gr + '_' + this.title, 'lesson');
      }
      // main.py:2073 FeedbackOverlay(q, ans, str(v), op, is_correct)
      this.feedback = {
        question: this.q, correctAnswer: this.ans, userAnswer: String(v),
        op: this.op, correct: isCorrect, active: true, dismissed: false
      };
      this.pendingAdvance = true;                                // main.py:2074
    }

    // main.py:2076-2082 update(dt) -- NO timer, NO timeout
    update(dt) {
      const d = dt || 0;
      if (this.feedback && this.feedback.active) {               // main.py:2078
        // main.py:2080-2082
        if (this.feedback.dismissed && this.pendingAdvance) {
          this.pendingAdvance = false;
          this._advanceQuestion();
        }
      }
    }

    // main.py:2083-2099 draw(s)
    draw(ctx, W2, H2) {
      const R = global.Game.renderer;
      R.clear('rgb(165,214,167)');                              // main.py:2084
      // main.py:2085-2087 the blackboard panel
      const bx = 80, by = 120, bw = 520, bh = 480;              // main.py:2085
      R.fillRoundRect(bx - 10, by - 10, bw + 20, bh + 20, 15, 'rgb(101,67,33)', null, 0); // :2086
      R.fillRoundRect(bx, by, bw, bh, 10, 'rgb(20,50,20)', null, 0);                    // :2087
      R.text('THU THACH', 340, 180, { font: 'bold 24px Quicksand, Segoe UI, sans-serif', fill: 'rgb(255,152,0)', align: 'center', baseline: 'middle' }); // :2088
      R.text('HANG NGAY', 340, 220, { font: 'bold 24px Quicksand, Segoe UI, sans-serif', fill: 'rgb(255,152,0)', align: 'center', baseline: 'middle' }); // :2089
      // main.py:2091 progress bar Câu cc/tc at (110, 270, 460, 20)
      const pw = 460, px = 110, py = 270, ph = 20;              // main.py:2091
      R.fillRoundRect(px, py, pw, ph, 6, 'rgb(255,255,255)', null, 0);
      const frac = this.tc > 0 ? Math.min(1, this.cc / this.tc) : 0;
      if (frac > 0) R.fillRoundRect(px, py, Math.max(6, Math.round(pw * frac)), ph, 6, 'rgb(255,152,0)', null, 0);
      R.text('Cau', px - 14, py + ph / 2, { font: '14px Quicksand, Segoe UI, sans-serif', fill: 'rgb(255,255,255)', align: 'right', baseline: 'middle' });
      // main.py:2092 score + difficulty label
      const diffLabel = (global.adaptiveAI && global.adaptiveAI.getDifficultyLabel) ? global.adaptiveAI.getDifficultyLabel() : '';
      R.text('Diem: ' + this.sc + '  |  Do kho: ' + diffLabel, 340, 300, // :2092
        { font: '14px Quicksand, Segoe UI, sans-serif', fill: 'rgb(255,255,255)', align: 'center', baseline: 'middle' });
      // main.py:2093 question, multiline inside (110, 330, 460, 200)
      const lines = wrapText(R, String(this.q), 460, 'bold 22px Quicksand, Segoe UI, sans-serif', 5);
      lines.forEach((ln, i) => {
        R.text(ln, 110, 330 + i * 30, { font: 'bold 22px Quicksand, Segoe UI, sans-serif', fill: 'rgb(255,255,255)', align: 'left', baseline: 'top' });
      });
      // main.py:2094 answer buttons (right page, vertical stack)
      for (let i = 0; i < this.btns.length; i++) {
        const b = this.btns[i];
        drawBtn(R, b.x, b.y, b.w, b.h, b.value, ORANGE_BTN, { fontSize: 18, radius: 10 });
      }
      drawBtn(R, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h, this.backBtn.label, this.backBtn.bg, { fontSize: 18, radius: 10 }); // :2095
      // main.py:2096-2099 speak button (TTS) and the feedback overlay
      if (this.feedback && this.feedback.active && typeof drawFeedbackOverlay === 'function') {
        drawFeedbackOverlay(R, this.feedback, W2, H2);
      }
    }
  }

  class DailyRewardState extends BaseState {
    constructor() {
      super('daily_reward');
      this.backBtn = { x: 40, y: 700, w: 180, h: 55 };
      this.claimBtn = { x: 520, y: 620, w: 260, h: 60 };
      this.statusMsg = '';
      this.statusTimer = 0;
      this.dataMissing = true;
    }
    enter(params) {
      this.statusMsg = '';
      this.statusTimer = 0;
      const d = m9AccountData();
      const auth = m9GetAuth();
      if (!d || !auth || !auth.currentUser) { this.dataMissing = true; return; }
      m9EnsureDst(d);
      const DailyApi = global.Daily;
      if (DailyApi && DailyApi.DailyRewardSystem) {
        this.daily = new DailyApi.DailyRewardSystem({
          player: m9Player(),
          accountSystem: auth,
          cfg: (params && params.cfg) || null,
          nowISO: (params && params.nowISO) || null
        });
        this.dataMissing = false;
        this.refreshStatus();
      } else { this.dataMissing = true; }
    }
    refreshStatus() {
      const s = this.daily ? this.daily.status() : null;
      this.status = s || { claimedToday: false, streak: 0, today: '' };
    }
    exit() { this.daily = null; }
    handleInput(input, dt) {
      const click = input.consumeClick ? input.consumeClick() : null;
      if (!click) return;
      if (hit(click, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h)) {
        global.Game.states.change('menu', null, 'fade'); return;
      }
      if (this.dataMissing || !this.daily) return;
      if (hit(click, this.claimBtn.x, this.claimBtn.y, this.claimBtn.w, this.claimBtn.h)) {
        const res = this.daily.claim();
        if (res) {
          this.statusMsg = '+ ' + res.xp + ' XP, + ' + res.gold + ' 💰 (ngày ' + res.day + ')';
          this.refreshStatus();
        } else {
          this.statusMsg = 'Đã nhận phần thưởng hôm nay!';
        }
        this.statusTimer = 3.0;
        m9SyncPlayer();
      }
    }
    update(dt) { if (this.statusTimer > 0) this.statusTimer = Math.max(0, this.statusTimer - dt); }
    draw(ctx, W2, H2) {
      const R = global.Game.renderer;
      R.clear('#a5d6a7');
      R.text('🎁 ĐIỂM DANH HẰNG NGÀY', W2 / 2, 60, {
        font: 'bold 38px Quicksand, sans-serif', fill: '#20242e', align: 'center', baseline: 'middle'
      });
      if (this.dataMissing || !this.status) {
        R.text('Đang tải... (đăng nhập để nhận)', W2 / 2, H2 / 2, {
          font: 'bold 24px Quicksand, sans-serif', fill: '#6b4f00', align: 'center', baseline: 'middle'
        });
        drawBtn(R, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h, '⬅️ QUAY LẠI', RED_BTN, { fontSize: 16 });
        return;
      }
      R.text('Streak: ' + this.status.streak + ' ・ Ngày: ' + this.status.today, W2 / 2, 130, {
        font: '26px Quicksand, sans-serif', fill: '#20242e', align: 'center', baseline: 'middle'
      });
      R.text(this.status.claimedToday ? '✔ Đã nhận hôm nay' : 'Sẵn sàng nhận hôm nay!', W2 / 2, 170, {
        font: '22px Quicksand, sans-serif', fill: this.status.claimedToday ? '#2e8b57' : '#c9a227', align: 'center', baseline: 'middle'
      });
      // 7-day reward grid (data/daily_rewards.json — cycle_days 7)
      let rewards = null;
      try { const c = this.daily._cfg ? this.daily._cfg() : null; if (c) rewards = c.rewards; } catch (e) { rewards = null; }
      if (!rewards || !rewards.length) {
        rewards = [];
        for (let i = 1; i <= 7; i++) rewards.push({ day: i, xp: 50 + i * 15, gold: i * 10, icon: '🎁' });
      }
      const cw = 150, ch = 150, cgap = 14, totalW = rewards.length * cw + (rewards.length - 1) * cgap;
      const gx = Math.floor((W2 - totalW) / 2), gy = 230;
      const curDay = ((Math.max(1, this.status.streak) - 1) % 7) + 1;
      for (let i = 0; i < rewards.length && i < 7; i++) {
        const rw = rewards[i];
        const day = rw.day || (i + 1);
        const isCur = day === curDay;
        const claimed = isCur && this.status.claimedToday;
        const future = day > curDay;
        const cellX = gx + i * (cw + cgap);
        const bg = claimed ? 'rgba(46,139,87,0.35)' : isCur ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.18)';
        const border = isCur ? 'rgb(200,140,20)' : 'rgba(255,255,255,0.5)';
        R.fillRoundRect(cellX, gy, cw, ch, 12, bg, border, isCur ? 3 : 2);
        R.text('Ngày ' + day, cellX + cw / 2, gy + 24, {
          font: 'bold 17px Quicksand, sans-serif', fill: future ? '#88906a' : '#20242e', align: 'center', baseline: 'middle'
        });
        R.text(rw.icon || '🎁', cellX + cw / 2, gy + 62, {
          font: '30px Quicksand, sans-serif', fill: '#20242e', align: 'center', baseline: 'middle'
        });
        R.text('+' + (rw.xp || 0) + ' XP  +' + (rw.gold || 0) + ' 💰', cellX + cw / 2, gy + 112, {
          font: '15px Quicksand, sans-serif', fill: future ? '#88906a' : '#31402c', align: 'center', baseline: 'middle'
        });
        if (claimed) R.text('✔', cellX + cw - 22, gy + 20, {
          font: 'bold 20px Quicksand, sans-serif', fill: '#1d5c38', align: 'center', baseline: 'middle'
        });
        if (future) R.text('🔒', cellX + cw - 22, gy + ch - 22, {
          font: '16px Quicksand, sans-serif', fill: '#556', align: 'center', baseline: 'middle'
        });
      }
      drawBtn(R, this.claimBtn.x, this.claimBtn.y, this.claimBtn.w, this.claimBtn.h, '🎁 NHẬN THƯỞNG', this.status.claimedToday ? SHADOW : ORANGE_BTN, { fontSize: 17 });
      if (this.statusTimer > 0 && this.statusMsg) {
        R.text(this.statusMsg, W2 / 2, 560, {
          font: '22px Quicksand, sans-serif', fill: '#20242e', align: 'center', baseline: 'middle'
        });
      }
      drawBtn(R, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h, '⬅️ QUAY LẠI', RED_BTN, { fontSize: 16 });
    }
  }

  /* M10-B STATE: SKILL TREE (main.py:2477-2666 SkillTreeState) */
  class SkillTreeState extends BaseState {
    constructor() {
      super('skill_tree');
      this.backBtn = { x: 810, y: 600, w: 300, h: 60 };  // Desktop main.py:2480
      this.statusMsg = '';
      this.statusTimer = 0;
      this.skillButtons = [];
      this.items = [];
      this.dataMissing = true;
    }
    enter(params) {
      this.dataMissing = true;
      this.skillButtons = [];
      this.items = [];
      this.statusMsg = '';
      this.statusTimer = 0;
      const d = m9AccountData();
      const auth = m9GetAuth();
      if (!d || !auth) { this.dataMissing = true; return; }
      m9EnsureDst(d);
      const TreeCtor = global.SkillTreeSystem;
      const MgrCtor = global.SkillManager;
      if (TreeCtor && MgrCtor) {
        if (params && params.skills) {
          this.tree = new TreeCtor(params.skills, {});
          this.manager = new MgrCtor({ skillTree: this.tree, accountSystem: auth });
          this.dataMissing = false;
          this._rebuild();
        } else if (global.ShopApi && typeof global.ShopApi.loadSkillTypes === 'function') {
          const self = this;
          global.ShopApi.loadSkillTypes().then(function (skills) {
            self.tree = new TreeCtor(skills, {});
            self.manager = new MgrCtor({ skillTree: self.tree, accountSystem: auth });
            self.dataMissing = false;
            self._rebuild();
          }).catch(function (err) {
            L.error('[Skill] load skills failed:', err);
            self.dataMissing = true;
          });
        }
      }
    }
    _rebuild() {
      this.items = [];
      this.skillButtons = [];
      const cats = ['gold', 'xp', 'time', 'protection', 'combo', 'special'];
      let y = 170;
      for (let c = 0; c < cats.length && y < 620; c++) {
        let catItems = [];
        const allKeys = Object.keys(this.tree ? this.tree.getSkillsByCategory ? this.tree.getSkillsByCategory(cats[c]) : {} : {});
        for (let i = 0; i < allKeys.length && i < 8; i++) catItems.push(allKeys[i]);
        if (!catItems.length) continue;
        // 4 cols max — 120 + 3*(250) + 220 = 1090 ≤ 1300 (tránh overflow)
        for (let i = 0; i < catItems.length && y < 620; i++) {
          const col = i % 4, wrapRow = Math.floor(i / 4);
          this.items.push({ id: catItems[i], category: cats[c],
            x: 120 + col * 250, y: y + wrapRow * 74, w: 220, h: 64 });
        }
        y += 74 * Math.ceil(catItems.length / 4) + 14;
      }
    }
    exit() { this.items = []; this.skillButtons = []; this.tree = null; this.manager = null; }
    handleInput(input, dt) {
      const click = input.consumeClick ? input.consumeClick() : null;
      if (!click) return;
      if (hit(click, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h)) {
        global.Game.states.change('menu', null, 'fade'); return;
      }
      if (this.dataMissing || !this.manager) return;
      for (let i = 0; i < this.items.length; i++) {
        const it = this.items[i];
        if (hit(click, it.x, it.y, it.w, it.h)) {
          const levels = this.manager.getSkillLevels ? this.manager.getSkillLevels() : {};
          const currentLevel = levels[it.id] || 0;
          let res;
          if (currentLevel === 0) res = this.manager.unlockSkill(it.id);
          else {
            const info = this.tree.getSkillInfo ? this.tree.getSkillInfo(it.id) : {};
            const maxLevel = info.max_level || 1;
            if (currentLevel < maxLevel) res = this.manager.upgradeSkill(it.id);
            else if (info.effect_type === 'duration') res = this.manager.activateSkill(it.id);
            else res = [false, 'Kỹ năng đã đạt cấp tối đa!'];
          }
          this.statusMsg = res ? res[1] : 'Error';
          this.statusTimer = 3.0;
          m9SyncPlayer();
          return;
        }
      }
    }
    update(dt) { if (this.statusTimer > 0) this.statusTimer = Math.max(0, this.statusTimer - dt); }
    draw(ctx, W2, H2) {
      const R = global.Game.renderer;
      R.clear('#a5d6a7');
      R.text('🌳 CÂY KỸ NĂNG', W2 / 2, 80, {   // Desktop main.py:2562 y=80
        font: 'bold 38px Quicksand, sans-serif', fill: '#20242e', align: 'center', baseline: 'middle'
      });
      if (this.dataMissing || !this.manager) {
        R.text('Đang tải kỹ năng...', W2 / 2, H2 / 2, {
          font: 'bold 26px Quicksand, sans-serif', fill: '#6b4f00', align: 'center', baseline: 'middle'
        });
      }
      for (let i = 0; i < this.items.length && i < 24; i++) {
        const it = this.items[i];
        const levels = this.manager && this.manager.getSkillLevels ? this.manager.getSkillLevels() : {};
        const currentLevel = levels[it.id] || 0;
        const info = (this.tree && this.tree.getSkillInfo) ? (this.tree.getSkillInfo(it.id) || {}) : {};
        const catColor = it.category === 'gold' ? ORANGE_BTN
          : it.category === 'xp' ? PURPLE_BTN
          : it.category === 'time' ? BLUE_BTN
          : it.category === 'protection' ? GREEN_BTN
          : it.category === 'combo' ? [255, 100, 50] : [255, 50, 150];
        const maxLevel = info.max_level || 1;
        const isMax = currentLevel >= maxLevel;
        const label = (info.icon || '⭐') + ' ' +
          String(info.name || it.id).slice(0, 12) +
          (isMax ? '  Lv.MAX' : '  Lv.' + currentLevel + '/' + maxLevel);
        drawBtn(R, it.x, it.y, it.w, it.h, label, isMax ? GREEN_BTN : currentLevel > 0 ? catColor : SHADOW, { fontSize: 12 });
      }
      if (this.statusTimer > 0 && this.statusMsg) {
        R.text(this.statusMsg, W2 / 2, H2 - 40, {
          font: '22px Quicksand, sans-serif', fill: '#20242e', align: 'center', baseline: 'middle'
        });
      }
      drawBtn(R, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h, '⬅️ QUAY LẠI', RED_BTN, { fontSize: 16 });
    }
  }

  /* M10-B STATE: BAG (main.py:2670-2947 BagState — gacha inventory viewer) */
﻿  // M32.4: BagState -- full port of Desktop main.py:2670-2942.
  // Desktop docstring (:2671-2677): left panel (item grid) | right panel
  // (detail + active buffs). One entry = one card type, quantity bottom-right.
  class BagState extends BaseState {
    // main.py:2679-2688
    static RARITY_COLORS = { '5star': [255, 215, 0], '4star': [200, 130, 255], '3star': [130, 190, 255] };
    static RARITY_BG     = { '5star': [50, 40, 15],   '4star': [40, 25, 60],   '3star': [20, 35, 55] };
    static STAR_LABEL    = { '5star': '*****', '4star': '****', '3star': '***' };

    constructor() { super('bag'); this._init(); }

    // main.py:2690-2705 __init__
    _init() {
      this.backBtn = { x: 30, y: H - 65, w: 160, h: 50, label: 'Quay lai', bg: RED_BTN }; // :2691
      this.useBtn  = { x: 0, y: 0, w: 200, h: 52, label: 'Su Dung', bg: [80, 180, 80] };   // :2692
      this.selected   = null;   // :2693
      this.msg        = '';     // :2694
      this.msgTimer   = 0;      // :2695
      this.msgOk      = true;   // :2696
      this.animTimer  = 0;      // :2697
      this.scrollY    = 0;      // :2698
      this.itemRects  = [];     // :2699
      this.dataMissing = true;
      // main.py:2701-2705 _all_cards from the three pools
      this._allCards = {};
      const all = (typeof cardShopAllCards === 'function') ? cardShopAllCards() : [];
      for (let i = 0; i < all.length; i++) this._allCards[all[i].title] = all[i];
      this.fx = this._fx();
    }

    /* Desktop item_fx is a module-level singleton built over account_system
       (game_init.py ItemEffectSystem). In the Web nothing ever constructed
       global.Game.itemFx, so the bag always rendered empty and the use-item
       mechanic was unreachable. Build the same singleton lazily, reusing the
       existing module and the live auth object. */
    _fx() {
      const fx = global.Game && global.Game.itemFx;
      if (fx) return fx;
      const IES = global.ItemEffectSystem;
      if (IES) {
        const auth = (typeof m9GetAuth === 'function') ? m9GetAuth()
          : (global.Game && global.Game.auth);
        const acc = (typeof m9AccountData === 'function') ? m9AccountData() : null;
        if (auth && acc) {
          if (typeof m9EnsureDst === 'function') m9EnsureDst(acc);
          try {
            const inst = new IES({ accountSystem: auth, data: acc, player: m9Player() });
            global.Game.itemFx = inst;
            return inst;
          } catch (e) { L.warn('[Bag] ItemEffectSystem init failed', e && e.message); }
        }
      }
      return {
        getBag: function () { return {}; },
        activate: function () { return [false, 'Item effects unavailable']; },
        getActiveSummary: function () { return []; },
        tickTimers: function () {}
      };
    }

    enter() { this._init(); }
    exit() { this.itemRects = []; }

    // main.py:2707-2717 _get_bag_sorted(): 5* first, then 4*, then 3*,
    // alphabetical within a rarity.
    _getBagSorted() {
      const bag = this.fx.getBag() || {};
      const order = { '5star': 0, '4star': 1, '3star': 2 };            // :2710
      const items = [];
      const self = this;
      Object.keys(bag).forEach(function (title) {
        const qty = bag[title];
        const def = self._allCards[title] || {};                        // :2713
        items.push({ title: title, qty: qty, rarity: def.rarity || '3star', def: def });
      });
      items.sort(function (a, b) {                                      // :2716
        const oa = order[a.rarity] !== undefined ? order[a.rarity] : 3;
        const ob = order[b.rarity] !== undefined ? order[b.rarity] : 3;
        if (oa !== ob) return oa - ob;
        return a.title < b.title ? -1 : (a.title > b.title ? 1 : 0);
      });
      return items;
    }

    // main.py:2719-2741 handle_event(e)
    handleInput(input, dt) {
      const click = input.consumeClick ? input.consumeClick() : null;
      const wheel = input.consumeWheel ? input.consumeWheel() : null;
      // main.py:2720-2721 wheel clamps to [-600, 0]
      if (wheel) this.scrollY = Math.max(-600, Math.min(0, this.scrollY + wheel * 30));
      if (!click) return;
      if (hit(click, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h)) {
        global.Game.states.change('menu', null, null);   // :2726 transition_type="PAGE"
        return;
      }
      // main.py:2729-2732 grid click -> select
      for (let i = 0; i < this.itemRects.length; i++) {
        const it = this.itemRects[i];
        if (hit(click, it.x, it.y, it.w, it.h)) { this.selected = it.title; return; } // :2731
      }
      // main.py:2734-2741 use button
      if (this.selected && hit(click, this.useBtn.x, this.useBtn.y, this.useBtn.w, this.useBtn.h)) {
        const res = this.fx.activate(this.selected);                      // :2735
        let ok = false, msg = '';
        if (Array.isArray(res)) { ok = res[0]; msg = res[1]; }
        else if (res && typeof res === 'object') { ok = !!res.ok; msg = res.msg || ''; }
        this.msg = msg; this.msgOk = ok; this.msgTimer = 3.0;            // :2736-2738
        const bag = this.fx.getBag() || {};
        if (!bag[this.selected]) this.selected = null;                   // :2740-2741
      }
    }

    // main.py:2743-2747 update(dt)
    update(dt) {
      const d = dt || 0;
      this.animTimer += d;                                               // :2744
      if (this.msgTimer > 0) this.msgTimer = Math.max(0, this.msgTimer - d); // :2745-2746
      this.fx.tickTimers(d);                                            // :2747
    }

    // main.py:2749-2791 _draw_item_card()
    _drawItemCard(R, title, qty, rarity, def, rect, selected) {
      const color = BagState.RARITY_COLORS[rarity] || [180, 180, 180];   // :2750
      const bg    = BagState.RARITY_BG[rarity] || [25, 30, 50];         // :2751
      const t = this.animTimer;
      if (selected) {                                                    // :2755-2760 rainbow glow, rect inflated 14,14, r18
        const c = [Math.round(127 + 127 * Math.sin(t * 3)),
                   Math.round(127 + 127 * Math.sin(t * 3 + 2.1)),
                   Math.round(127 + 127 * Math.sin(t * 3 + 4.2))];
        R.fillRoundRectAlpha(rect.x - 7, rect.y - 7, rect.w + 14, rect.h + 14, 18,
          'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')', 160 / 255);
      }
      R.fillRoundRect(rect.x, rect.y, rect.w, rect.h, 14, css(bg), null, 0);      // :2762
      R.fillRoundRect(rect.x, rect.y, rect.w, rect.h, 14, null, css(color), selected ? 3 : 1); // :2763
      R.text(String(def.icon || '\uD83D\uDC78'), rect.x + rect.w / 2, rect.y + 10, { // :2766-2769
        font: '44px Segoe UI Emoji, sans-serif', fill: css(color), align: 'center', baseline: 'top' });
      R.text(String(title).slice(0, 12), rect.x + rect.w / 2, rect.y + 62, {       // :2772-2779
        font: '12px Quicksand, sans-serif', fill: 'rgb(220,220,220)', align: 'center', baseline: 'top', maxWidth: rect.w - 8 });
      if (qty > 1) {                                                     // :2782-2786 qty badge
        R.fillRoundRect(rect.x + rect.w - 24, rect.y + 2, 22, 20, 6, 'rgb(220,60,60)', null, 0);
        R.text(String(qty), rect.x + rect.w - 13, rect.y + 5, {
          font: '12px Quicksand, sans-serif', fill: '#ffffff', align: 'center', baseline: 'top' });
      }
      R.text(BagState.STAR_LABEL[rarity] || '***', rect.x + rect.w / 2, rect.y + 76, { // :2789-2791
        font: '10px Quicksand, sans-serif', fill: css(color), align: 'center', baseline: 'top' });
    }

    // main.py:2793-2942 draw(s)
    draw(ctx, W2, H2) {
      const R = global.Game.renderer;
      R.clear('rgb(8,12,24)');                                          // :2794
      // :2796-2799 background grid, step 60, colour (18,22,38)
      const gc0 = R.ctx;
      const _grid = !!(gc0 && typeof gc0.moveTo === 'function');
      if (_grid) { gc0.save(); gc0.strokeStyle = 'rgb(18,22,38)'; gc0.lineWidth = 1; gc0.beginPath(); }
      for (let gx = 0; gx < W; gx += 60) {
        if (_grid) { gc0.moveTo(gx + 0.5, 0); gc0.lineTo(gx + 0.5, H); }
      }
      for (let gy = 0; gy < H; gy += 60) {
        if (_grid) { gc0.moveTo(0, gy + 0.5); gc0.lineTo(W, gy + 0.5); }
      }
      if (_grid) { gc0.stroke(); gc0.restore(); }
      const panelW = 760;                                                // :2802
      R.fillRoundRect(0, 0, panelW, H, 0, 'rgb(12,16,30)', null, 0);   // :2803
      if (_grid) {                                             // :2804 divider
        gc0.save(); gc0.strokeStyle = 'rgb(60,80,120)'; gc0.lineWidth = 2;
        gc0.beginPath(); gc0.moveTo(panelW, 0); gc0.lineTo(panelW, H);
        gc0.stroke(); gc0.restore();
      }
      R.text('\uD83C\uDF92', 30, 18, { font: '28px Segoe UI Emoji, sans-serif', fill: 'rgb(210,220,255)', align: 'left', baseline: 'top' }); // :2808
      R.text('Tui Do', 78, 20, { font: '28px Quicksand, sans-serif', fill: 'rgb(210,220,255)', align: 'left', baseline: 'top' });          // :2810-2811

      const items = this._getBagSorted();                                // :2813
      const total = items.length;
      this.itemRects = [];
      if (total === 0) {                                                // :2816-2818
        R.text('Tui Do trong - hay ghe Cua Hang Doi The!', panelW / 2, H / 2 - 20, {
          font: '22px Quicksand, sans-serif', fill: 'rgb(120,130,160)', align: 'center', baseline: 'middle' });
      } else {
        // :2820-2827 grid constants
        const cols = 6, iw = 110, ih = 95, gapX = 14, gapY = 16, startX = 28, startY = 70 + this.scrollY;
        for (let idx = 0; idx < items.length; idx++) {                   // :2830-2841
          const it = items[idx];
          const col = idx % cols, row = Math.floor(idx / cols);
          const rx = startX + col * (iw + gapX);
          const ry = startY + row * (ih + gapY);
          this.itemRects.push({ title: it.title, x: rx, y: ry, w: iw, h: ih });
          if (ry + ih < 55 || ry > H - 10) continue;                   // :2837 cull
          this._drawItemCard(R, it.title, it.qty, it.rarity, it.def,
            { x: rx, y: ry, w: iw, h: ih }, it.title === this.selected);
        }
      }
      R.text('Tong: ' + total + ' loai vat pham', 30, H - 62, {       // :2844-2845
        font: '14px Quicksand, sans-serif', fill: 'rgb(140,150,180)', align: 'left', baseline: 'top' });

      const rx0 = panelW + 10;                                          // :2848
      const rw  = W - panelW - 10;                                      // :2849
      const detailR = { x: rx0, y: 10, w: rw, h: 350 };                // :2852-2853
      R.fillRoundRect(detailR.x, detailR.y, detailR.w, detailR.h, 16, 'rgb(16,20,38)', null, 0); // :2854
      R.fillRoundRect(detailR.x, detailR.y, detailR.w, detailR.h, 16, null, 'rgb(80,100,160)', 2); // :2855

      if (this.selected && this._allCards[this.selected]) {              // :2857
        const def = this._allCards[this.selected];
        const rarity = def.rarity || '3star';
        const color = BagState.RARITY_COLORS[rarity] || [180, 180, 180];
        const t = this.animTimer;
        if (rarity === '5star') {                                       // :2866-2868 rainbow border
          const rc = [Math.round(127 + 127 * Math.sin(t * 2)),
                      Math.round(127 + 127 * Math.sin(t * 2 + 2.1)),
                      Math.round(127 + 127 * Math.sin(t * 2 + 4.2))];
          R.fillRoundRect(detailR.x, detailR.y, detailR.w, detailR.h, 16, null,
            'rgb(' + rc[0] + ',' + rc[1] + ',' + rc[2] + ')', 3);
        }
        R.text(String(def.icon || '\uD83D\uDC78'), detailR.x + detailR.w / 2, detailR.y + 14, { // :2871-2872
          font: '72px Segoe UI Emoji, sans-serif', fill: css(color), align: 'center', baseline: 'top' });
        R.text(String(def.title || '').slice(0, 20), detailR.x + detailR.w / 2, detailR.y + 100, { // :2882
          font: '22px Quicksand, sans-serif', fill: css(color), align: 'center', baseline: 'top' });
        R.text(BagState.STAR_LABEL[rarity] + ' ' + ({ '5star': 'HUYEN THOAI', '4star': 'HIEM', '3star': 'THUONG' })[rarity],
          detailR.x + detailR.w / 2, detailR.y + 130, {                // :2886
            font: '14px Quicksand, sans-serif', fill: 'rgb(200,200,210)', align: 'center', baseline: 'top' });
        const defs = global.ITEM_DEFS || {};
        const d2 = defs[def.effect_id] || {};
        R.text('Hieu ung: ' + (d2.label || '?'), detailR.x + 16, detailR.y + 158, { // :2883-2884
          font: '15px Quicksand, sans-serif', fill: 'rgb(150,220,150)', align: 'left', baseline: 'top' });
        R.text(String(d2.desc || def.content || '').slice(0, 60), detailR.x + 16, detailR.y + 182, { // :2887-2889
          font: '14px Quicksand, sans-serif', fill: 'rgb(200,200,220)', align: 'left', baseline: 'top', maxWidth: rw - 32 });
        const bag = this.fx.getBag() || {};
        R.text('So luong trong tui: ' + (bag[this.selected] || 0), detailR.x + 16, detailR.y + 270, { // :2893-2894
          font: '17px Quicksand, sans-serif', fill: 'rgb(220,220,120)', align: 'left', baseline: 'top' });
        // main.py:2897 use button is repositioned every frame to the detail panel
        this.useBtn.x = detailR.x + detailR.w / 2 - 100; this.useBtn.y = detailR.y + 298;
        this.useBtn.w = 200; this.useBtn.h = 42;
        drawBtn(R, this.useBtn.x, this.useBtn.y, this.useBtn.w, this.useBtn.h, this.useBtn.label, this.useBtn.bg, { fontSize: 16, radius: 8 });
      } else {
        R.text('Chon vat pham de xem chi tiet', detailR.x + detailR.w / 2, detailR.y + detailR.h / 2 - 10, { // :2900-2901
          font: '17px Quicksand, sans-serif', fill: 'rgb(130,140,170)', align: 'center', baseline: 'middle' });
      }

      // main.py:2903-2931 Active Buffs panel
      const bufY0 = detailR.y + detailR.h + 14;                        // :2904
      const bufR = { x: rx0, y: bufY0, w: rw, h: H - bufY0 - 70 };    // :2905
      R.fillRoundRect(bufR.x, bufR.y, bufR.w, bufR.h, 16, 'rgb(16,20,38)', null, 0);  // :2906
      R.fillRoundRect(bufR.x, bufR.y, bufR.w, bufR.h, 16, null, 'rgb(80,160,100)', 2); // :2907
      R.text('\uD83D\uDCA1', bufR.x + 14, bufR.y + 12, { font: '18px Segoe UI Emoji, sans-serif', fill: 'rgb(160,255,180)', align: 'left', baseline: 'top' }); // :2909
      R.text('Buffs Dang hoat Dong', bufR.x + 40, bufR.y + 14, {      // :2911-2912
        font: '18px Quicksand, sans-serif', fill: 'rgb(160,255,180)', align: 'left', baseline: 'top' });
      const active = this.fx.getActiveSummary() || [];                  // :2914
      if (!active.length) {
        R.text('Khong co buff nao dang hoat dong.', bufR.x + bufR.w / 2, bufR.y + 50, { // :2916-2917
          font: '14px Quicksand, sans-serif', fill: 'rgb(120,130,150)', align: 'center', baseline: 'top' });
      } else {
        let by = bufR.y + 44;                                          // :2919
        for (let i = 0; i < active.length; i++) {
          const a = active[i] || {};
          R.text(String(a.icon || ''), bufR.x + 14, by, {              // :2923
            font: '22px Segoe UI Emoji, sans-serif', fill: 'rgb(200,255,200)', align: 'left', baseline: 'top' });
          R.text(String(a.label || ''), bufR.x + 44, by + 2, {        // :2926
            font: '15px Quicksand, sans-serif', fill: 'rgb(200,255,200)', align: 'left', baseline: 'top' });
          R.text(String(a.info || ''), bufR.x + 44, by + 20, {        // :2928
            font: '13px Quicksand, sans-serif', fill: 'rgb(160,200,160)', align: 'left', baseline: 'top' });
          by += 44;                                                     // :2929
          if (by > bufR.y + bufR.h - 20) break;                        // :2930-2931
        }
      }
      // main.py:2933-2937 message
      if (this.msgTimer > 0 && this.msg) {
        R.text(this.msg, W / 2, H - 100, {                             // :2937
          font: '18px Quicksand, sans-serif',
          fill: this.msgOk ? 'rgb(80,220,100)' : 'rgb(220,80,80)',
          align: 'center', baseline: 'middle' });
      }
      drawBtn(R, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h, this.backBtn.label, this.backBtn.bg, { fontSize: 16, radius: 8 }); // :2940
      R.text('Dung vat pham truoc khi vao choi de kich hoat buff', W / 2, H - 40, { // :2941-2942
        font: '13px Quicksand, sans-serif', fill: 'rgb(140,150,170)', align: 'center', baseline: 'middle' });
    }
  }

  /* M10-B STATE: PROFILE (main.py:2100-2190 compute_profile_stats + ProfileState) */
  function computeProfileStats(d) {
    // Port compute_profile_stats (main.py:2100-2127) — không đổi công thức
    const dd = d || {};
    const history = dd.history || [];
    let totalQ = parseInt(dd.total_answered || 0, 10) || 0;
    let totalOk = parseInt(dd.total_correct || 0, 10) || 0;
    if (totalQ <= 0 && history.length) {
      totalQ = history.length * 10;
      totalOk = history.reduce(function (n, h) { return n + ((parseInt(h.score || 0, 10) || 0) >= 50 ? 1 : 0); }, 0);
    }
    let accuracy = totalQ > 0 ? (totalOk / totalQ) * 100 : 0.0;
    accuracy = Math.round(accuracy * 10) / 10;
    const playSec = parseInt(dd.play_time_seconds || 0, 10) || 0;
    const hours = Math.floor(playSec / 3600), rem = playSec % 3600;
    const minutes = Math.floor(rem / 60), seconds = rem % 60;
    const playStr = hours ? (hours + 'g ' + minutes + 'p')
      : minutes ? (minutes + 'p ' + seconds + 's') : (seconds + 's');
    const achTotal = (global.AchievementSys && typeof global.AchievementSys.getAchievementSystem === 'function')
      ? (function () { try { return Object.keys(global.AchievementSys.getAchievementSystem().getDefinitions() || {}).length; } catch (e) { return 0; } })()
      : 0;
    return {
      accuracy: accuracy,
      bestCombo: parseInt(dd.best_combo || 0, 10) || 0,
      playTime: playStr,
      achievements: (dd.achievements_unlocked || []).length,
      achTotal: achTotal
    };
  }
  class ProfileState extends BaseState {
    constructor() {
      super('profile');
      this.backBtn = { x: 810, y: 600, w: 300, h: 60 };
      this.skillMapBtn = { x: 810, y: 520, w: 300, h: 60 };
    }
    enter() {
      const d = m9AccountData();
      this.data = d ? m9EnsureDst(d) : null;
    }
    exit() { this.data = null; }
    handleInput(input, dt) {
      const click = input.consumeClick ? input.consumeClick() : null;
      if (!click) return;
      if (hit(click, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h)) {
        global.Game.states.change('menu', null, 'fade'); return;
      }
      if (hit(click, this.skillMapBtn.x, this.skillMapBtn.y, this.skillMapBtn.w, this.skillMapBtn.h)) {
        global.Game.states.change('skill_map', null, 'fade');
      }
    }

    update(dt) {}
    draw(ctx, W2, H2) {
      const R = global.Game.renderer;
      R.clear('#a5d6a7');
      R.text('👤 HỒ SƠ NGƯỜI CHƠI', W2 / 2, 95, {
        font: 'bold 38px Quicksand, sans-serif', fill: '#20242e', align: 'center', baseline: 'middle'
      });
      const d = this.data || {};
      const pet = d.pet || { type: 'clover', stage: 0 };
      let petIcon = '👤';
      try {
        const petSys = global.PetSystem ? new global.PetSystem({ data: d }) : null;
        const info = petSys && petSys.getPetInfo ? petSys.getPetInfo(pet.type || 'clover', pet.stage || 0) : null;
        if (info && info.icon) petIcon = info.icon;
      } catch (e) { petIcon = '👤'; }
      // Avatar box (main.py:2157-2165)
      R.fillRoundRect(120, 160, 200, 200, 20, '#ffffff', css(PURPLE_BTN), 4);
      R.text(petIcon, 220, 250, {
        font: '72px Quicksand, sans-serif', fill: '#505050', align: 'center', baseline: 'middle'
      });
      R.text(String(d.username || (global.Game.player && global.Game.player.username) || 'Player'), 220, 375, {
        font: 'bold 22px Quicksand, sans-serif', fill: '#20242e', align: 'center', baseline: 'middle'
      });
      // Stats card (main.py:2169-2188)
      R.fillRoundRect(380, 150, 820, 480, 20, '#ffffff', css(PURPLE_BTN), 5);
      const stats = computeProfileStats(d);
      const P = global.Game.player || {};
      const rows = [
        ['⭐ Level', String(d.level !== undefined ? d.level : (P.level !== undefined ? P.level : 1))],
        ['✨ XP', String(d.xp !== undefined ? d.xp : (P.exp !== undefined ? P.exp : 0))],
        /* Desktop main.py:2173: gold_value = "Vô hạn (Admin)" if
           account_system.current_user == ADMIN_USER else str(user_data.get("gold", 0)).
           game_init.py:311 defines ADMIN_USER = "admin", and auth.js sets
           this.currentUser on login, so the Web equivalent of
           account_system.current_user is auth.currentUser. */
        ['💰 Gold', (function () {
          try {
            var au = global.Game && global.Game.auth ? global.Game.auth : null;
            var cu = au ? au.currentUser : null;
            if (cu === 'admin') return 'Vô hạn (Admin)';   // main.py:2173
          } catch (e) { /* fall through to the numeric value */ }
          return String(d.gold !== undefined ? d.gold : (P.gold !== undefined ? P.gold : 0));
        })()],
        ['🎯 Độ chính xác', stats.accuracy + '%'],
        ['🔥 Best Combo', String(stats.bestCombo)],
        ['⏱ Thời gian chơi', stats.playTime],
        ['📚 Lớp', String(d.grade !== undefined ? d.grade : 1)],
        ['🏆 Thành tích', stats.achTotal ? stats.achievements + '/' + stats.achTotal : String(stats.achievements)]
      ];
      let y = 185;
      for (let i = 0; i < rows.length; i++) {
        R.text(rows[i][0], 408, y, { font: 'bold 20px Quicksand, sans-serif', fill: '#5a5a6e', baseline: 'middle' });
        R.text(rows[i][1], 660, y, { font: 'bold 22px Quicksand, sans-serif', fill: '#28283c', baseline: 'middle' });
        y += 52;
      }
      drawBtn(R, this.skillMapBtn.x, this.skillMapBtn.y, this.skillMapBtn.w, this.skillMapBtn.h, '📊 Bản Đồ Điểm Yếu', [90, 150, 170], { fontSize: 17 });
      drawBtn(R, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h, '⬅️ QUAY LẠI', RED_BTN, { fontSize: 17 });
    }
  }

  /* M10-B STATE: SKILL MAP — Bản Đồ Điểm Yếu (main.py:2191-2272) */
  const SKILL_TAG_LABELS = {
    phep_cong: 'Phép cộng', phep_tru: 'Phép trừ', phep_nhan: 'Phép nhân',
    phep_chia: 'Phép chia', co_nho: 'Cộng có nhớ', khong_nho: 'Cộng không nhớ',
    muon: 'Trừ có mượn', khong_muon: 'Trừ không mượn', bang_cuu_chuong: 'Bảng cửu chương',
    phep_nhan_2_chu_so: 'Nhân số có 2 chữ số', mot_chu_so: 'Số có 1 chữ số',
    hai_chu_so: 'Số có 2 chữ số', ba_chu_so_tro_len: 'Số có 3 chữ số trở lên',
    so_sanh: 'So sánh số', hinh_hoc: 'Hình học', do_luong: 'Đo lường',
    xem_gio: 'Xem giờ', toan_co_loi_van: 'Toán có lời văn',
    cau_tao_so: 'Cấu tạo số', ngay_thang: 'Ngày tháng'
  };
  class SkillMapState extends BaseState {
    constructor() {
      super('skill_map');
      this.backBtn = { x: 30, y: 730, w: 160, h: 50 };
      this.rows = [];
    }
    enter() {
      const d = m9AccountData();
      const mastery = (d && d.skill_mastery) || {};
      // Yếu nhất hiển thị trước (main.py:2226)
      this.rows = Object.keys(mastery).map(function (k) { return [k, mastery[k]]; })
        .sort(function (a, b) { return a[1] - b[1]; });
    }
    exit() { this.rows = []; }
    handleInput(input, dt) {
      const click = input.consumeClick ? input.consumeClick() : null;
      if (!click) return;
      if (hit(click, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h)) {
        global.Game.states.change('profile', null, 'fade');
      }
    }
    update(dt) {}
    _barColor(m) {
      if (m < 0.4) return [220, 90, 90];
      if (m < 0.7) return [230, 180, 70];
      return [90, 190, 120];
    }

    draw(ctx, W2, H2) {
      const R = global.Game.renderer;
      R.clear('rgb(28,32,48)');
      R.text('📊 BẢN ĐỒ ĐIỂM YẾU', W2 / 2, 55, {
        font: 'bold 38px Quicksand, sans-serif', fill: 'rgb(255,230,150)', align: 'center', baseline: 'middle'
      });
      R.text('Dành cho phụ huynh/giáo viên — mức độ thông thạo theo từng kỹ năng nhỏ', W2 / 2, 95, {
        font: '16px Quicksand, sans-serif', fill: 'rgb(180,185,205)', align: 'center', baseline: 'middle'
      });
      if (!this.rows.length) {
        R.text('Học sinh chưa làm đủ bài để có dữ liệu.', W2 / 2, H2 / 2 - 20, {
          font: 'bold 24px Quicksand, sans-serif', fill: 'rgb(170,175,195)', align: 'center', baseline: 'middle'
        });
        R.text('Hãy làm vài bài luyện tập rồi quay lại xem nhé!', W2 / 2, H2 / 2 + 25, {
          font: '18px Quicksand, sans-serif', fill: 'rgb(150,155,175)', align: 'center', baseline: 'middle'
        });
      } else {
        const barX = 340, barW = 560, legendY = H2 - 130;
        let y = 150;
        for (let i = 0; i < this.rows.length; i++) {
          if (y > legendY - 20) break;
          const tag = this.rows[i][0], m = this.rows[i][1];
          const label = SKILL_TAG_LABELS[tag] || tag;
          const pct = Math.max(0.0, Math.min(1.0, m));
          R.text(label, 60, y + 14, { font: 'bold 18px Quicksand, sans-serif', fill: '#ffffff', baseline: 'middle' });
          R.fillRoundRect(barX, y, barW, 28, 8, 'rgb(55,58,78)', null, 0);
          R.fillRoundRect(barX, y, Math.round(barW * pct), 28, 8, css(this._barColor(m)), null, 0);
          R.text(Math.round(pct * 100) + '%', barX + barW + 15, y + 14, {
            font: '16px Quicksand, sans-serif', fill: '#ffffff', baseline: 'middle'
          });
          y += 56;
        }
        // Chú thích màu sắc (main.py:2265-2271)
        const legend = [
          [[220, 90, 90], 'Cần hỗ trợ thêm (<40%)'],
          [[230, 180, 70], 'Đang tiến bộ (40–70%)'],
          [[90, 190, 120], 'Đã thành thạo (>70%)']
        ];
        let lx = 60;
        for (let i = 0; i < legend.length; i++) {
          R.fillRoundRect(lx, legendY, 22, 22, 5, css(legend[i][0]), null, 0);
          const txt = legend[i][1];
          R.text(txt, lx + 30, legendY + 11, { font: '15px Quicksand, sans-serif', fill: 'rgb(200,205,220)', baseline: 'middle' });
          lx += 30 + txt.length * 9 + 40;
        }
      }
      drawBtn(R, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h, '⬅️ Quay lại', RED_BTN, { fontSize: 16 });
    }
  }

  /* ========== M10-B MENU WIRING ========== */

  // ---- Exports (global cho browser, module.exports cho Node test) ----
  global.LoadingState = LoadingState;

  // ---- Exports (global cho browser, module.exports cho Node test) ----
  global.LoadingState = LoadingState;
  /* M29 parity export */
  global.IdleGifState = IdleGifState;
global.TimeAttackState = TimeAttackState;
global.ExamTransitionState = ExamTransitionState;

  const RI = (a, b) => a + Math.floor(Math.random() * (b - a + 1));   // random.randint
  const RF = (a, b) => a + Math.random() * (b - a);                  // random.uniform
  const RS = (arr) => arr[Math.floor(Math.random() * arr.length)];   // random.choice
  const RSHUF = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  const RSAMPLE = (lo, hi, k) => {                       // random.sample(range(lo,hi),k)
    const pool = []; for (let v = lo; v < hi; v++) pool.push(v);
    const out = []; while (out.length < k && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return out;
  };
  const RND1 = (a, b) => Math.round(RF(a, b) * 10) / 10;  // round(uniform(..),1)
  const RNDn = (a, b, n) => { const f = Math.pow(10, n); return Math.round(RF(a, b) * f) / f; };

  function generateHardExam(grade) {
    const questions = [];
    const mcq = (q, opts, correct) => questions.push({ type: 'mcq', q: q, opts: opts, correct: correct, user_ans: null });
    const inp = (q, correct) => questions.push({ type: 'input', q: q, correct: correct, user_ans: '' });

    if (grade === 1) {
      // :2924-2938 Bai 1: 2 cong + 2 tru
      for (let i = 0; i < 4; i++) {
        let a, b, ans;
        if (i < 2) { a = RI(20, 50); b = RI(20, 50); ans = a + b; }
        else { a = RI(40, 100); b = RI(10, 40); ans = a - b; }
        inp('Bai 1.' + (i + 1) + ': Dat tinh roi tinh: ' + a + (i < 2 ? ' + ' : ' - ') + b, String(ans));
      }
      // :2940-2952 Bai 2: sap xep so
      const nums = RSAMPLE(10, 100, 4);
      mcq('Bai 2: Sap xep cac so ' + nums.join(', ') + ' theo thu tu tang dan:',
        [nums.slice().sort().join(','), nums.slice().sort().reverse().join(','), [nums[2], nums[0], nums[3], nums[1]].join(','), [nums[1], nums[3], nums[0], nums[2]].join(',')],
        nums.slice().sort().join(','));
      // :2954-2961 Bai 3: so be nhat
      const nc = RSAMPLE(20, 100, 4);
      mcq('Bai 3: Khoanh tron vao so be nhat trong cac so: ' + nc.join(', '),
        [String(Math.min.apply(null, nc)), String(Math.max.apply(null, nc)), String(nc[1]), String(nc[2])], String(Math.min.apply(null, nc)));
      // :2963-2970 Bai 4
      const a4 = RI(40, 90), b4 = RI(10, 40);
      inp('Bai 4: Dien so thich hop vao cho cham: ' + a4 + ' - ...... = ' + (a4 - b4), String(b4));
      // :2972-2980 Bai 5
      const a5 = RI(10, 40), b5 = RI(10, 40), c5 = RI(5, 20);
      inp('Bai 5: Tinh: ' + a5 + ' + ' + b5 + ' - ' + c5 + ' = ', String(a5 + b5 - c5));
      // :2982-2988 Bai 6
      mcq('Bai 6: Hinh duoi day co bao nhieu doan thang?\n(Tham khao hinh co 3-5 doan thang)', ['3', '4', '5', '6'], RS(['3', '4', '5']));
      // :2990-2997 Bai 7
      const t7 = RI(40, 80), p7 = RI(10, 30);
      inp('Bai 7: An co ' + t7 + ' qua tao, An cho em ' + p7 + ' qua. Hoi An con bao nhieu qua tao?', String(t7 - p7));
      // :2999-3006 Bai 8
      const ch = RS([40, 50, 60]), du = RI(10, 30);
      inp('Bai 8: Nha Lan nuoi ' + (ch + du) + ' con ga va vit, trong do co ' + Math.floor(ch / 10) + ' chuc con ga. Hoi nha Lan nuoi bao nhieu con vit?', String(du));
    } else if (grade === 2) {
      // :3011-3026 Cau 1
      const h = RI(1, 9), t = RI(0, 9), o = RI(0, 9);
      const cn = h * 100 + t * 10 + o;
      mcq('Cau 1: So gom ' + h + ' tram, ' + t + ' chuc va ' + o + ' don vi la:',
        RSHUF([String(cn), String(h * 100 + o * 10 + t), String(t * 100 + h * 10 + o), String(o * 100 + t * 10 + h)]), String(cn));
      // :3028-3042 Cau 2
      const h2 = RI(1, 5), o2 = RI(1, 9);
      const cn2 = h2 * 100 + o2;
      // :3040 `if tens == 0` reads the PREVIOUS loop's `tens`; reproduce exactly.
      const prevTens = t;
      mcq('Cau 2: So ' + cn2 + ' duoc doc la:',
        [h2 + ' tram linh ' + o2, h2 + ' khong ' + o2, h2 + ' muoi ' + o2, h2 + ' tram khong ' + o2],
        prevTens === 0 ? (h2 + ' tram linh ' + o2) : (h2 + ' tram khong ' + o2));
      // :3044-3053 Cau 3
      const d3 = RI(10, 30), e3 = RI(2, 5), f3 = Math.floor(d3 / e3);
      mcq('Cau 3: Trong phep nhan ' + d3 + ' : ' + e3 + ' = ' + f3 + ', so ' + f3 + ' duoc goi la:',
        ['Thuong', 'Tong', 'Tich', 'So hang'], 'Thuong');
      // :3055-3062 Cau 4
      const n4 = RSAMPLE(100, 999, 4);
      mcq('Cau 4: So be nhat trong cac so ' + n4.join(', ') + ' la:',
        [String(Math.min.apply(null, n4)), String(Math.max.apply(null, n4)), String(n4[1]), String(n4[2])], String(Math.min.apply(null, n4)));
      // :3064-3074 Cau 5
      const a5 = RI(10, 30), b5 = RI(20, 40), c5 = RI(10, 30);
      const tt5 = a5 + b5 + c5;
      mcq('Cau 5: Tinh ' + a5 + 'kg + ' + b5 + 'kg + ' + c5 + 'kg = .....kg',
        [String(tt5), String(tt5 + 10), String(tt5 - 5), String(tt5 + 7)], String(tt5));
      // :3076-3084 Cau 6
      const shapes = ['khoi tru', 'khoi lap phuong', 'khoi cau', 'khoi hop chu nhat'];
      RS(shapes);
      mcq('Cau 6: Qua bong co hinh:', shapes, 'khoi cau');
      // :3086-3099 Cau 7
      const stmts = [
        [RI(100, 500) + ' + ' + RI(100, 500) + ' = ' + RI(200, 1000), 'D'],
        [RI(500, 900) + ' - ' + RI(100, 400) + ' = ' + RI(100, 800), 'S'],
        [RI(10, 50) + ' : ' + RI(2, 5) + ' + ' + RI(60, 80) + ' = ' + RI(70, 90), 'S'],
        [RI(100, 500) + ' < ' + RI(600, 999), 'D']
      ];
      const pick = RS(stmts);
      mcq('Cau 7: Phep tinh ' + pick[0] + ' la:', ['Dung', 'Sai'], pick[1]);
      // :3102-3116 Bai 8
      for (let i = 0; i < 2; i++) {
        const a = RI(200, 500), b = RI(100, 300);
        inp('Bai 8.' + (i + 1) + ': Dat tinh roi tinh: ' + a + ' - ' + b, String(a - b));
      }
      // :3118-3125 Bai 9
      const mo = RI(200, 400), more = RI(10, 50);
      inp('Bai 9: Mot cua hang buoi sang ban duoc ' + mo + ' kg gao, buoi chieu ban nhieu hon buoi sang ' + more + ' kg gao. Hoi buoi chieu ban duoc bao nhieu ki-lo-gam gao?', String(mo + more));
      // :3127-3133 Bai 10
      const w = [RI(1, 5) * 100, RI(1, 3) * 100, RI(50, 200)];
      inp('Bai 10: Quan sat hinh anh va ghi so ki-lo-gram tuong ung: ' + w[0] + 'g, ' + w[1] + 'g, ' + w[2] + 'g. Chuyen doi sang kg?',
        w[0] / 100 + ', ' + w[1] / 100 + ', ' + w[2] / 1000);
    } else if (grade === 3) {
      // :3138-3145 Cau 1
      const n1 = RSAMPLE(8000, 9000, 4);
      mcq('Cau 1: So lon nhat trong cac so ' + n1.join(', ') + ' la:',
        [String(Math.max.apply(null, n1)), String(n1[0]), String(n1[1]), String(n1[2])], String(Math.max.apply(null, n1)));
      // :3147-3158 Cau 2
      mcq('Cau 2: Chon khang dinh SAI trong cac khang dinh sau:',
        ['Do dai ban kinh bang mot nua do dai duong kinh', 'Do dai duong kinh gap doi ban kinh', 'Do dai cac ban kinh khong bang nhau', 'Tam cua hinh tron la trung diem cua duong kinh'],
        'Do dai cac ban kinh khong bang nhau');
      // :3160-3166 Cau 3
      mcq('Cau 3: Ngay 27 thang 2 la ngay chu nhat. Hoi ngay 01 thang 3 cung nam la ngay:',
        ['Thu sau', 'Thu ba', 'Thu tu', 'Thu nam'], 'Thu tu');
      // :3168-3177 Cau 4
      const tot = RI(60, 100), fr = RS([2, 3, 4]);
      const rem = tot - Math.floor(tot / fr);
      mcq('Cau 4: Mot cuon vai dai ' + tot + ' m, da ban 1/' + fr + ' cuon vai. Hoi cuon vai con lai bao nhieu m?',
        [String(rem), String(Math.floor(tot / fr)), String(tot - fr), String(tot + fr)], String(rem));
      // :3179-3186 Cau 5
      const st = RI(1000, 5000);
      mcq('Cau 5: Viet so thich hop vao cho cham: ' + st + ', ' + (st + 1) + ', ..., ' + (st + 3),
        [String(st - 1), String(st - 2), String(st + 2), String(st + 4)], String(st + 2));
      // :3188-3194 Cau 6
      mcq('Cau 6: So be nhat co 3 chu so khac nhau la:', ['100', '101', '102', '103'], '102');
      // :3197-3205 Cau 7
      const m1 = RI(1000, 5000), m2 = m1 + RI(1, 10);
      mcq('Cau 7: Dien dau thich hop: ' + m1 + ' ... ' + m2, ['>', '<', '='], '<');
      // :3207-3214 Cau 8
      const xv = RI(3000, 6000), sv = RI(1000, 2000);
      inp('Cau 8: Tim x biet: x - ' + sv + ' = ' + (xv - sv), String(xv));
      // :3216-3223 Cau 9
      const xv2 = RI(2000, 3000), mv = RI(2, 5);
      inp('Cau 9: Tim x biet: x * ' + mv + ' = ' + (xv2 * mv), String(xv2));
      // :3225-3235 Cau 10
      const km = RI(50, 150), lit = RI(5, 15), nl = RI(3, 8);
      inp('Cau 10: Mot o to chay quang duong dai ' + km + ' km het ' + lit + ' lit xang. Hoi voi cach chay nhu the, khi chay het ' + nl + ' lit xang thi o to do chay duoc quang duong bao nhieu km?',
        String(Math.floor(km / lit) * nl));
    } else if (grade === 4) {
      // :3240-3255 Cau 1
      const mi = RI(100, 999), th = RI(10, 99), un = RI(100, 999);
      const pad3 = (n) => ('00' + n).slice(-3);
      mcq('Cau 1: So ' + mi + ' ' + pad3(th) + ' ' + pad3(un) + ' doc la:',
        [mi + ' trieu ' + th + ' nghin ' + un, mi + ' trieu khong tram ' + th + ' nghin ' + un, mi + ' trieu ' + th + ' tram ' + un, mi + ' trieu khong ' + th + ' nghin ' + un],
        mi + ' trieu ' + th + ' nghin ' + un);
      // :3257-3266 Cau 2
      const g2a = RI(400000, 600000), g2b = RI(400000, 500000), tot2 = g2a + g2b;
      mcq('Cau 2: Tong cua hai so ' + g2a + ' va ' + g2b + ' la:',
        [String(tot2), String(tot2 - 100), String(tot2 + 100), String(tot2 + 200)], String(tot2));
      // :3268-3276 Cau 3
      const n1 = RI(2, 9), n2 = RI(100, 500);
      mcq('Cau 3: ' + n1 + ' x ' + n2 + ' = ' + n2 + ' x ... So thich hop dien vao cho cham la:',
        [String(n1), String(n2), String(n1 + 1), String(n2 + 1)], String(n1));
      // :3278-3284 Cau 4
      mcq('Cau 4: Thoi gian di may bay tu Ha Noi den TP.HCM khoang bao lau:',
        ['30 phut', '1 ngay', '1 tuan', '2 gio'], '2 gio');
      // :3286-3294 Cau 5
      RS([[1, 2], [3, 4], [2, 3], [5, 6]]);
      mcq('Cau 5: Trong cac phan so 1/2, 3/4, 2/3, 5/6, phan so nao la lon nhat:',
        ['1/2', '3/4', '2/3', '5/6'], '5/6');
      // :3296-3304 Cau 6
      const av = [RI(140, 160), RI(140, 160), RI(140, 160)];
      const avg = Math.floor(av.reduce(function (a, b) { return a + b; }, 0) / av.length);
      const sv6 = av.reduce(function (a, b) { return a + b; }, 0);
      mcq('Cau 6: Trung binh cong cua cac so ' + av.join(', ') + ' la:',
        [String(avg), String(avg - 1), String(avg + 1), String(sv6)], String(avg));
      // :3306-3314 Cau 7
      const red = RI(2, 5), blue = RI(1, 3);
      mcq('Cau 7: Tui co ' + red + ' vien bi do, ' + blue + ' vien bi xanh. Lay ngau nhien 2 vien. Khong dinh \'Khong the lay duoc 2 vien bi xanh\' la:',
        ['Dung', 'Sai'], blue >= 2 ? 'Sai' : 'Dung');
      // :3316-3324 Cau 8
      const av8 = RI(2, 5);
      const res8 = 2514 * av8 + 2458;
      mcq('Cau 8: Gia tri cua bieu thuc 2514 x a + 2458 voi a = ' + av8 + ' la:',
        [String(res8), String(res8 + 1000), String(res8 - 1000), String(res8 + 100)], String(res8));
      // :3327-3342 Cau 9,10
      for (let i = 0; i < 2; i++) {
        let a = RI(10000, 50000), b = RI(10000, 50000), ans, op;
        if (i === 0) { ans = a + b; op = '+'; }
        else { a = Math.max(a, b) + RI(1000, 5000); ans = a - b; op = '-'; }
        inp('Cau ' + (9 + i) + ': Dat tinh roi tinh: ' + a + ' ' + op + ' ' + b, String(ans));
      }
      // :3344-3352 Cau 11
      const met = RI(1, 9), cm2 = RI(10, 99);
      inp('Cau 11: Dien so thich hop: ' + met + 'm' + cm2 + 'cm2 = ..... cm2', String(met * 10000 + cm2));
      // :3353-3359 Cau 12
      const cen = RI(1, 10);
      inp('Cau 12: ' + cen + ' the ky = ..... nam', String(cen * 100));
      // :3362-3372 Cau 13
      const per = RI(100, 200), dif = RI(10, 30);
      const half = Math.floor(per / 2);
      const len = Math.floor((half + dif) / 2);
      const wid = half - len;
      inp('Cau 13: Chu vi san cong nho nhat la ' + per + ' m. Chieu dai hon chieu rong ' + dif + ' m. Tinh dien tich san?', String(len * wid));
    } else if (grade === 5) {
      // :3377-3388 Cau 1
      mcq('Cau 1: Phat bieu nao sau day dung?',
        ['Duong kinh bang ban kinh', 'Duong kinh hon ban kinh 2 don vi', 'Duong kinh gap 2 lan ban kinh', 'Ban kinh gap 2 lan duong kinh'], 'Duong kinh gap 2 lan ban kinh');
      // :3390-3398 Cau 2
      const pct = RS([157, 25, 50, 75, 125]);
      const dv = pct / 100;
      mcq('Cau 2: ' + pct + '% = .........', [String(dv), String(pct), String(dv * 10), String(dv / 10)], String(dv));
      // :3400-3409 Cau 3
      const a3 = RNDn(100, 500, RI(1, 2));
      const fac = RS([0.01, 0.1, 10, 100]);
      const r3 = RNDn(a3 * fac, a3 * fac, 4);
      mcq('Cau 3: ' + a3 + ' x ....... = ' + r3 + '. So dien vao cho cham la:',
        [String(fac), String(fac * 10), String(fac / 10), String(fac * 100)], String(fac));
      // :3411-3420 Cau 4
      const a4 = RND1(2, 5), lim4 = RND1(15, 20);
      const maxy = Math.floor(lim4 / a4);
      mcq('Cau 4: Co bao nhieu so tu nhien y thoa man ' + a4 + ' x y < ' + lim4 + '?',
        [String(maxy), String(maxy + 1), String(maxy - 1), String(maxy + 2)], String(maxy));
      // :3422-3431 Cau 5
      const down = RND1(12, 15), up = RND1(6, 9);
      const wsp = RND1((down - up) / 2, (down - up) / 2);
      mcq('Cau 5: Thuyen xuoi dong ' + down + ' km/gi, nguoc dong ' + up + ' km/gi. Van toc dong nuoc la:',
        [String(wsp), String(wsp * 2), String(wsp + 1), String(wsp - 1)], String(wsp));
      // :3433-3442 Cau 6
      const m3 = RI(1, 9), cm3 = RI(10, 999);
      const tot3 = m3 * 1000000 + cm3;
      mcq('Cau 6: So thich hop de ' + m3 + 'm3 ' + cm3 + 'cm3 = ..... cm3 la:',
        [String(tot3), String(m3 * 1000 + cm3), String(m3 * 10000 + cm3), String(m3 * 100 + cm3)], String(tot3));
      // :3444-3452 Cau 7
      const rr = RS([5, 7, 10]);
      const ar = RND1(3.14 * rr * rr, 3.14 * rr * rr);
      mcq('Cau 7: Hinh tron co duong kinh ' + (rr * 2) + ' cm. Dien tich la:',
        [String(ar), String(ar / 2), String(ar * 2), String(ar + 10)], String(ar));
      // :3455-3462 Cau 8
      const mins = RS([135, 150, 180, 225]);
      inp('Cau 8: ' + mins + ' phut = ..... gio', String(mins / 60));
      // :3463-3471 Cau 9
      const kg = RI(1, 100), g = RI(1, 99);
      inp('Cau 9: ' + kg + 'kg ' + g + 'g = ..... kg', String(kg + g / 1000));
      // :3473-3481 Cau 10
      const a10 = RND1(10, 100), b10 = RND1(2, 10);
      inp('Cau 10: Dat tinh roi tinh: ' + a10 + ' x ' + b10, String(RNDn(a10 * b10, a10 * b10, 2)));
      // :3483-3495 Cau 11
      const dist = RS([100, 120, 150]);
      const sh = RI(6, 8), eh = sh + RI(2, 3);
      const rest = RS([15, 20, 30]);
      const actual = (eh - sh) * 60 - rest;
      inp('Cau 11: Quang duong AB dai ' + dist + ' km. O to di tu A luc ' + sh + ' gio den B luc ' + eh + ' gio, nghi ' + rest + ' phut. Xe may di voi van toc bang 60% van toc o to. Tinh van toc xe may?',
        String(Math.trunc((dist / (actual / 60)) * 0.6)));
    } else {
      // :3498-3516
      for (let i = 0; i < 7; i++) {
        const a = RI(20 * grade, 100 * grade), b = RI(10, 50);
        const op = RS(['+', '-']);
        const ans = op === '+' ? a + b : a - b;
        mcq('Cau ' + (i + 1) + ': Tinh gia tri bieu thuc: ' + a + ' ' + op + ' ' + b,
          RSHUF([String(ans), String(ans + 2), String(ans - 5), String(ans + 10)]), String(ans));
      }
      for (let i = 0; i < 3; i++) {
        const n1 = RI(50, 150), n2 = RI(20, 40);
        inp('Cau ' + (i + 8) + ': Mot cua hang co ' + n1 + ' met vai, da ban ' + n2 + ' met. Hoi con lai bao nhieu met vai?', String(n1 - n2));
      }
    }
    return questions;
  }

﻿  // ---- Desktop game_init.py:380-395 reward_gold_for_result(mode_key,score,accuracy) ----
  // main.py:3244: reward_gold_for_result("mock_exam", self.score * 10, self.score * 10)
  //   mode_bonus["mock_exam"] = 30            (game_init.py:386)
  //   score_part = max(0, int(score)) // 2    (game_init.py:391)
  //   acc_part   = int(max(0, accuracy) // 10)(game_init.py:392)
  //   total      = base + score_part + acc_part, then add_gold(total)
  // With score*10 passed for both: score_part = score*5, acc_part = score,
  // so total = 30 + 6*score. Reproduced as arithmetic, not a magic number.
  function examGoldForScore(score) {
    const s = Math.max(0, Math.trunc(Number(score) || 0));
    const scaled = s * 10;                       // main.py:3244 passes score*10 twice
    const base = 30;                             // game_init.py:386 mock_exam
    const scorePart = Math.trunc(scaled) / 2 | 0;// game_init.py:391 (// in py = floor for non-negative)
    const accPart = Math.trunc(Math.max(0, scaled) / 10);
    return base + scorePart + accPart;
  }
  global.examGoldForScore = examGoldForScore;

  // ===================================================================
  // FinalExamState -- faithful port of Desktop main.py:3140-3233
  // ===================================================================
  class FinalExamState extends BaseState {
    constructor() {
      super('final_exam');
      this._init();
    }

    // main.py:3141-3151 __init__
    _init() {
      const auth = global.Game && global.Game.auth;
      const d = (auth && typeof auth.data === 'function') ? (auth.data() || {}) : {};
      this.grade = d.grade || 1;                        // main.py:3142
      this.questions = global.generateHardExam(this.grade); // main.py:3143
      this.current_q = 0;                                // main.py:3144
      this.score = 0;                                    // main.py:3145
      this.finished = false;                             // main.py:3146
      this.input_text = '';                              // main.py:3147
      // main.py:3148-3151 four Buttons
      this.backBtn   = { x: 20,          y: H - 75,  w: 200, h: 60, label: 'THOAT',       bg: RED_BTN };
      this.submitBtn = { x: W / 2 - 125, y: H - 120, w: 250, h: 60, label: 'NOP BAI',     bg: GREEN_BTN };
      this.nextBtn   = { x: W - 250,     y: H - 120, w: 200, h: 60, label: 'CAU SAU',    bg: BLUE_BTN };
      this.prevBtn   = { x: 50,          y: H - 120, w: 200, h: 60, label: 'CAU TRUOC',  bg: BLUE_BTN };
      this.optionRects = [];                             // main.py:3178 geometry
    }

    // Desktop constructs a NEW FinalExamState per run (main.py:3118), so every
    // __init__ value is re-applied. The Web StateManager keeps ONE instance, so
    // without this the second exam would inherit the first exam's questions,
    // index, score and typed text (the M29.2 state-reuse class of bug).
    enter() { this._init(); }

    // main.py:3210-3216 option grid: 2 columns x 2 rows, 240x60, gap 260/80
    _buildOptionRects(q) {
      this.optionRects = [];
      if (q.type !== 'mcq') return;
      for (let i = 0; i < q.opts.length; i++) {
        this.optionRects.push({
          x: W / 2 - 250 + (i % 2) * 260,               // main.py:3178
          y: 350 + Math.floor(i / 2) * 80,               // main.py:3178
          w: 240, h: 60, index: i, value: q.opts[i]
        });
      }
    }

    // main.py:3152-3189 handle_event(e)
    handleInput(input, dt) {
      const click = input.consumeClick ? input.consumeClick() : null;
      const key = input.consumePressedKey ? input.consumePressedKey() : null;
      // main.py:3153 once finished, all input is ignored
      if (this.finished) return;
      if (!this.questions.length) return;
      const q = this.questions[this.current_q];
      if (!q) return;
      if (click) {
        // main.py:3156-3158 back -> MenuState()
        if (hit(click, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h)) { this._toMenu(); return; }
        // main.py:3159-3162 submit -> score then ExamResultState(score)
        if (hit(click, this.submitBtn.x, this.submitBtn.y, this.submitBtn.w, this.submitBtn.h)) {
          this._calculateScore();
          this._toResult();
          return;
        }
        // main.py:3163-3168 next (bounded by the last question)
        if (hit(click, this.nextBtn.x, this.nextBtn.y, this.nextBtn.w, this.nextBtn.h) && this.current_q < this.questions.length - 1) {
          if (q.type === 'input') q.user_ans = this.input_text;      // main.py:3164-3165
          this.current_q += 1;                                        // main.py:3166
          const nq = this.questions[this.current_q];
          this.input_text = (nq && nq.type === 'input') ? (nq.user_ans || '') : ''; // :3167
          this._buildOptionRects(nq);
          return;
        }
        // main.py:3169-3174 prev (bounded by the first question)
        if (hit(click, this.prevBtn.x, this.prevBtn.y, this.prevBtn.w, this.prevBtn.h) && this.current_q > 0) {
          if (q.type === 'input') q.user_ans = this.input_text;      // main.py:3170-3171
          this.current_q -= 1;                                        // main.py:3172
          const pq = this.questions[this.current_q];
          this.input_text = (pq && pq.type === 'input') ? (pq.user_ans || '') : ''; // :3173
          this._buildOptionRects(pq);
          return;
        }
        // main.py:3176-3181 MCQ option click; first match wins (main.py:3181 break)
        if (q.type === 'mcq') {
          for (let i = 0; i < this.optionRects.length; i++) {
            const r = this.optionRects[i];
            if (click.x >= r.x && click.x <= r.x + r.w && click.y >= r.y && click.y <= r.y + r.h) {
              q.user_ans = r.value;                                   // main.py:3180
              break;                                                  // main.py:3181
            }
          }
        }
      }
      // main.py:3182-3189 KEYDOWN, and only for "input" questions
      if (key && q.type === 'input') {
        const k = key.key;
        if (k === 'Backspace') {
          this.input_text = this.input_text.slice(0, -1);             // main.py:3184
        } else if (k === 'Enter' || k === 'NumpadEnter') {
          q.user_ans = this.input_text;                               // main.py:3186
        } else if (k && k.length === 1) {
          // main.py:3187-3189 digits or '-', capped at 10 characters
          if ((k >= '0' && k <= '9') || k === '-') {
            if (this.input_text.length < 10) this.input_text += k;
          }
        }
      }
    }

    // main.py:3190-3199 _calculate_score()
    _calculateScore() {
      let score = 0;                                                   // main.py:3191
      for (let i = 0; i < this.questions.length; i++) {                // main.py:3192
        const q = this.questions[i];
        if (q.type === 'mcq') {
          if (String(q.user_ans) === String(q.correct)) score += 1;     // main.py:3193-3195
        } else {
          // main.py:3196-3198 input: str(user_ans).strip() == correct
          if (String(q.user_ans === null || q.user_ans === undefined ? '' : q.user_ans).trim() === String(q.correct)) score += 1;
        }
      }
      this.score = score;                                              // main.py:3199
      this.finished = true;                                            // main.py:3199
      return score;
    }

    // main.py:3200 update(dt): pass -- the exam has NO timer at all
    update(dt) { /* Desktop: `def update(self, dt): pass` (main.py:3200) */ }

    // main.py:3201-3233 draw(s)
    draw(ctx, WW, HH) {
      const R = global.Game.renderer;
      R.clear('rgb(253,246,227)');                                    // main.py:3202
      // main.py:3203-3206 paper card, WHITE with a 3px BLACK border
      R.fillRoundRect(100, 50, W - 200, H - 200, 0, 'rgb(255,255,255)', 'rgb(0,0,0)', 3);
      const q = this.questions[this.current_q];
      if (!q) return;
      // main.py:3208 header
      R.text('BAI THI CHUYEN LOP - LOP ' + this.grade, W / 2, 100,
        { font: 'bold 30px Quicksand, Segoe UI, sans-serif', fill: 'rgb(139,69,19)', align: 'center', baseline: 'middle' });
      // main.py:3209 progress
      R.text('Cau ' + (this.current_q + 1) + '/' + this.questions.length, W / 2, 160,
        { font: 'bold 22px Quicksand, Segoe UI, sans-serif', fill: 'rgb(0,0,0)', align: 'center', baseline: 'middle' });
      // main.py:3212-3213 question text in q_rect(150,200,W-300,120)
      R.text(String(q.q), W / 2, 260,
        { font: 'bold 22px Quicksand, Segoe UI, sans-serif', fill: 'rgb(0,0,0)', align: 'center', baseline: 'middle', maxWidth: W - 300 });
      if (q.type === 'mcq') {
        this._buildOptionRects(q);
        // main.py:3214-3221 selected option is GREEN, others BLUE, r12 + 2px black
        for (let i = 0; i < this.optionRects.length; i++) {
          const r = this.optionRects[i];
          const sel = String(q.user_ans) === String(r.value);          // main.py:3217
          const col = sel ? GREEN_BTN : BLUE_BTN;                     // main.py:3218
          R.fillRoundRect(r.x, r.y, r.w, r.h, 12, css(col), 'rgb(0,0,0)', 2); // :3219-3220
          R.text(String(r.value), r.x + r.w / 2, r.y + r.h / 2,
            { font: 'bold 22px Quicksand, Segoe UI, sans-serif', fill: 'rgb(255,255,255)', align: 'center', baseline: 'middle', maxWidth: r.w - 16 });
        }
      } else {
        // main.py:3222-3229 input box + hint
        const ir = { x: W / 2 - 200, y: 400, w: 400, h: 60 };        // main.py:3224
        R.fillRoundRect(ir.x, ir.y, ir.w, ir.h, 0, 'rgb(255,255,255)', 'rgb(0,0,0)', 3); // :3225-3226
        R.text(this.input_text, ir.x + 20, ir.y + 10,                 // main.py:3227-3228
          { font: 'bold 30px Quicksand, Segoe UI, sans-serif', fill: 'rgb(0,0,0)', align: 'left', baseline: 'top', maxWidth: ir.w - 30 });
        R.text('Nhap dap an cua ban vao o tren', W / 2, 480,           // main.py:3229
          { font: 'bold 16px Quicksand, Segoe UI, sans-serif', fill: 'rgb(100,100,100)', align: 'center', baseline: 'middle' });
      }
      drawBtn(R, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h, this.backBtn.label, this.backBtn.bg, { fontSize: 18 });
      drawBtn(R, this.submitBtn.x, this.submitBtn.y, this.submitBtn.w, this.submitBtn.h, this.submitBtn.label, this.submitBtn.bg, { fontSize: 18 });
      // main.py:3232-3233 next only when not on the last question, prev only when > 0
      if (this.current_q < this.questions.length - 1) {
        drawBtn(R, this.nextBtn.x, this.nextBtn.y, this.nextBtn.w, this.nextBtn.h, this.nextBtn.label, this.nextBtn.bg, { fontSize: 18 });
      }
      if (this.current_q > 0) {
        drawBtn(R, this.prevBtn.x, this.prevBtn.y, this.prevBtn.w, this.prevBtn.h, this.prevBtn.label, this.prevBtn.bg, { fontSize: 18 });
      }
    }

    // main.py:3157 manager.change(MenuState())
    _toMenu() { global.Game.states.change('menu', null, 'fade'); }
    // main.py:3161 manager.change(ExamResultState(self.score))
    _toResult() { global.Game.states.change('exam_result', { score: this.score }, 'fade'); }
  }
﻿  // ===================================================================
  // ExamResultState -- faithful port of Desktop main.py:3234-3271
  // ===================================================================
  class ExamResultState extends BaseState {
    // main.py:3235-3239 __init__(score)
    constructor(score) {
      super('exam_result');
      this.score = (typeof score === 'number' && isFinite(score)) ? score : 0; // main.py:3236
      this.backBtn = { x: W / 2 - 150, y: H - 100, w: 300, h: 60, label: 'VE MENU', bg: GREEN_BTN }; // :3237
      this._processed_result = false;                                      // main.py:3238
      this.exam_gold = 0;                                                  // main.py:3239
      this.userName = '';
    }

    // main.py:3240-3250 enter()
    enter(params) {
      // The Web StateManager reuses one instance, so the score arrives via
      // change('exam_result', {score}); Desktop gets it as a ctor arg (main.py:3161).
      if (params && typeof params.score === 'number' && isFinite(params.score)) {
        this.score = params.score;
      }
      const auth = global.Game && global.Game.auth;
      const user = auth && auth.currentUser ? auth.currentUser : '';
      if (user) this.userName = String(user);
      const pl = (global.Game && typeof getPlayer === 'function') ? getPlayer() : null;
      if (pl && pl.username && !this.userName) this.userName = String(pl.username);
      // main.py:3241-3243 the processed guard makes the reward fire EXACTLY once
      if (this._processed_result) return;
      this._processed_result = true;
      // main.py:3244 reward_gold_for_result("mock_exam", score*10, score*10)
      this.exam_gold = global.examGoldForScore(this.score);
      if (pl && typeof pl.addGold === 'function') pl.addGold(this.exam_gold, auth);
      L.info('[ExamResult] processed. score', this.score, 'gold', this.exam_gold);
      // main.py:3245-3250 pass (score >= 6): grade up, reset lessons and xp, save
      if (this.score >= 6) {
        if (auth && typeof auth.data === 'function' && typeof auth.save === 'function') {
          const d = auth.data();
          d.grade = Math.min(3, (d.grade || 1) + 1);        // main.py:3247
          d.completed_lessons = [];                          // main.py:3248
          d.xp = 0;                                          // main.py:3249
          auth.save();                                       // main.py:3250
        }
        if (pl) {
          pl.grade = Math.min(3, (pl.grade || 1) + 1);
          pl.exp = 0;
        }
        L.info('[ExamResult] PASS -> grade', (pl && pl.grade));
      } else {
        L.info('[ExamResult] FAIL -> score', this.score);
      }
    }

    // main.py has no update() override for ExamResultState
    update(dt) {}

    // main.py:3251-3269 draw(s)
    draw(ctx, WW, HH) {
      const R = global.Game.renderer;
      R.clear('rgb(44,62,80)');                                        // main.py:3252
      // main.py:3253-3255 certificate, cream fill with a 15px gold border
      const cert = { x: W / 2 - 500, y: 100, w: 1000, h: 500 };         // main.py:3253
      R.fillRoundRect(cert.x, cert.y, cert.w, cert.h, 0, 'rgb(253,245,230)', 'rgb(212,175,55)', 15);
      if (this.score >= 6) {
        // main.py:3257-3263 the pass certificate
        R.text('GIAY CHUNG NHAN', W / 2, 180,                           // main.py:3257
          { font: 'bold 34px Quicksand, Segoe UI, sans-serif', fill: 'rgb(139,69,19)', align: 'center', baseline: 'middle' });
        R.text('Chuc mung: ' + this.userName, W / 2, 280,              // main.py:3258
          { font: 'bold 22px Quicksand, Segoe UI, sans-serif', fill: 'rgb(0,0,0)', align: 'center', baseline: 'middle' });
        R.text('Hoan thanh xuat sac chuong trinh! Diem: ' + this.score + '/10', W / 2, 380, // :3259
          { font: 'bold 16px Quicksand, Segoe UI, sans-serif', fill: 'rgb(0,0,0)', align: 'center', baseline: 'middle' });
        // main.py:3262-3263 the red approval seal
        const gcx = 850, gcy = 500, gr = 60;                            // main.py:3262
        const gc = R.ctx;
        if (gc && typeof gc.beginPath === 'function') {
          gc.save();
          gc.strokeStyle = 'rgb(180,0,0)'; gc.lineWidth = 4;             // main.py:3262
          gc.beginPath(); gc.arc(gcx, gcy, gr, 0, Math.PI * 2); gc.stroke();
          gc.restore();
        }
        R.text('DA DUYET', 800, 485,                                     // main.py:3263
          { font: 'bold 16px Quicksand, Segoe UI, sans-serif', fill: 'rgb(180,0,0)', align: 'left', baseline: 'middle' });
      } else {
        // main.py:3264-3266 the fail message
        R.text('Ban can co gang hon! Diem cua ban: ' + this.score + '/10', W / 2, 300, // :3265
          { font: 'bold 22px Quicksand, Segoe UI, sans-serif', fill: 'rgb(180,0,0)', align: 'center', baseline: 'middle' });
      }
      // main.py:3267-3268 the gold reward line
      R.text('Thuong: +' + this.exam_gold + ' vang', W / 2, 560,       // main.py:3267
        { font: 'bold 26px Quicksand, Segoe UI, sans-serif', fill: 'rgb(170,130,30)', align: 'center', baseline: 'middle' });
      drawBtn(R, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h, this.backBtn.label, this.backBtn.bg, { fontSize: 20 });
    }

    // main.py:3270-3271 handle_event(e) -- back button only
    handleInput(input, dt) {
      const click = input.consumeClick ? input.consumeClick() : null;
      if (!click) return;
      if (hit(click, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h)) {
        global.Game.states.change('menu', null, 'fade');                 // main.py:3271
      }
    }
  }


﻿  // ===================================================================
  // CardShopState -- faithful port of Desktop main.py:2947-3089
  // Entry main.py:719-724 (Menu gacha button, grade >= 3 only).
  // Card data: game_init.py:1241-1265 (GachaBannerSystem.POOL_*).
  // Grant:     game_init.py:1420-1436 (grant_card_direct).
  // ===================================================================
  const CARD_SHOP_RARITY = {                       // main.py:2956-2960
    '3star': { label: 'Thuong',    color: [130, 190, 255], price: 80  },
    '4star': { label: 'Hiem',      color: [200, 130, 255], price: 250 },
    '5star': { label: 'Dac Biet',  color: [255, 215, 0],   price: 600 }
  };
  // game_init.py:1241-1248 POOL_5STAR
  const CARD_SHOP_POOL_5STAR = [
    { title: 'Than Toan Archimedes',  icon: '\uD83E\uDDED', category: '5star Huyen Thoai', content: 'Nhan doi Vang trong 5 phien choi!', effect_id: 'gold_double' },
    { title: 'Rong So Hoc',            icon: '\uD83D\uDC09', category: '5star Huyen Thoai', content: 'Kich hoat x3 diem trong 50 cau tiep theo.', effect_id: 'score_x3_10q' },
    { title: 'Nha Thong Thai Lao Hac', icon: '\uD83C\uDF34', category: '5star Huyen Thoai', content: 'Nhan 2 diem tuat tat cau hoi trong 5 phien.', effect_id: 'score_x2_session' },
    { title: 'Tia Sang Pygame',       icon: '\u2728', category: '5star Huyen Thoai', content: 'Dong bang thoi gian dem nguoc 25 giay.', effect_id: 'freeze_timer_5s' },
    { title: 'Phuong Hoang Dai Sau',   icon: '\uD83E\uDD86', category: '5star Huyen Thoai', content: 'Hoi sinh toi da 5 mang khi thua trong phien.', effect_id: 'revive_1life' },
    { title: 'Thien Tai Einstein Jr.', icon: '\uD83E\uDDE0', category: '5star Huyen Thoai', content: 'Tang combo bonus gia tang doi trong 5 phien.', effect_id: 'combo_x2_session' }
  ];
  // game_init.py:1249-1257 POOL_4STAR
  const CARD_SHOP_POOL_4STAR = [
    { title: 'Bao Ho Thales',   icon: '\uD83E\uDDE0', category: '4star Hiem', content: 'Hien thi goi y hinh hoc trong phien.', effect_id: 'geometry_boost' },
    { title: 'La Ban Euler',     icon: '\uD83E\uDDEE', category: '4star Hiem', content: 'Goi y dac biet cho 5 cau khac tiep theo.', effect_id: 'euler_hint' },
    { title: 'Dinh Ly Pythago', icon: '\uD83E\uDDE0', category: '4star Hiem', content: 'Hien thi goi y tam giac vuong trong phien.', effect_id: 'pythagoras_hint' },
    { title: 'Bo Nho Sieu Cap', icon: '\uD83E\uDDE0', category: '4star Hiem', content: 'Tang 15% EXP nhan duoc trong phien.', effect_id: 'xp_boost_15' },
    { title: 'Dong Ho Cat',     icon: '\u23F0', category: '4star Hiem', content: '+3 giay moi cau tra loi dung (Time Attack).', effect_id: 'time_bonus_3s' },
    { title: 'Cung Tho Logic',  icon: '\uD83E\uDD49', category: '4star Hiem', content: '10% co hoi mo cau hoi thuong sau khi dung.', effect_id: 'bonus_question_chance' },
    { title: 'Kien Tri The',    icon: '\uD83E\uDDE1', category: '4star Hiem', content: 'Chan 1 lan mat mang trong phien nay.', effect_id: 'shield_1life' }
  ];
  // game_init.py:1258-1265 POOL_3STAR
  const CARD_SHOP_POOL_3STAR = [
    { title: 'Cong Than Toc',   icon: '\u25CF', category: '3star Thuong', content: '+10% diem cau hoi phep cong.', effect_id: 'speed_add_10' },
    { title: 'Tru Chop Nhoang', icon: '\u25AC', category: '3star Thuong', content: 'Giam 5% thoi gian suy nghi phep tru.', effect_id: 'speed_sub_5' },
    { title: 'Nhan Vu Bao',     icon: '\u00D7', category: '3star Thuong', content: '+8% diem cau hoi phep nhan.', effect_id: 'mul_bonus' },
    { title: 'Chia Cat Gio',    icon: '\u00F7', category: '3star Thuong', content: 'Cau chia xuat hien tham 10%.', effect_id: 'div_more' },
    { title: 'Ghi Nho Nhanh',   icon: '\uD83D\uDCDD', category: '3star Thuong', content: '+5% toc do ghi nho cong thuc.', effect_id: 'memory_5' },
    { title: 'Tap Trung Cao',   icon: '\uD83C\uDFAF', category: '3star Thuong', content: 'Giam 5% xac suat mat combo.', effect_id: 'focus_combo' }
  ];

  function cardShopAllCards() {                 // main.py:2979-2988 _all_cards
    const out = [];
    [['3star', CARD_SHOP_POOL_3STAR], ['4star', CARD_SHOP_POOL_4STAR], ['5star', CARD_SHOP_POOL_5STAR]]
      .forEach(function (pair) {
        pair[1].forEach(function (c) { const card = {}; for (const k in c) card[k] = c[k]; card.rarity = pair[0]; out.push(card); });
      });
    return out;
  }

  // game_init.py:1420-1436 grant_card_direct
  function grantCardDirect(title) {
    const auth = global.Game && global.Game.auth;
    if (!auth || typeof auth.data !== 'function') return false;
    const d = auth.data();
    if (!Array.isArray(d.inventory)) d.inventory = [];
    const isNew = d.inventory.indexOf(title) < 0;
    if (isNew) d.inventory.push(title);
    if (!d.bag) d.bag = {};
    d.bag[title] = (d.bag[title] || 0) + 1;
    if (typeof auth.save === 'function') auth.save();
    return isNew;
  }

  class CardShopState extends BaseState {
    constructor() {
      super('cardShop');
      this._init();
    }

    // main.py:2962-2977 __init__
    _init() {
      this.backBtn = { x: 30, y: H - 70, w: 160, h: 50, label: 'Quay lai', bg: RED_BTN }; // :2963
      this.filter = 'all';                        // :2964
      this.filterButtons = [];                     // :2965
      const filters = [['all', 'Tat ca', PURPLE_BTN], ['3star', 'Thuong', BLUE_BTN],
                       ['4star', 'Hiem', PURPLE_BTN], ['5star', 'Dac Biet', ORANGE_BTN]]; // :2966-2967
      let fx = 210;                               // :2968
      for (let i = 0; i < filters.length; i++) {   // :2969-2971
        this.filterButtons.push({ key: filters[i][0], x: fx, y: H - 70, w: 140, h: 50, label: filters[i][1], bg: filters[i][2] });
        fx += 150;
      }
      this.msg = '';                              // :2972
      this.msgTimer = 0;                          // :2973
      this.msgOk = true;                          // :2974
      this.scrollY = 0;                           // :2975
      this.cardButtons = [];                      // :2976
      this.shake = 0;                             // main.py:3040 trigger_shake
      this.confettiAt = -1;                       // main.py:3041-3042
      this._rebuild();                            // :2977
    }

    // Desktop builds a NEW CardShopState per visit (main.py:724), so every
    // __init__ value is re-applied; the Web StateManager reuses one instance.
    enter() { this._init(); }

    // main.py:2990-3001 _rebuild()
    _rebuild() {
      let cards = cardShopAllCards();              // main.py:2991
      if (this.filter !== 'all') cards = cards.filter(c => c.rarity === this.filter); // :2992-2993
      this.cardButtons = [];                      // :2994
      const cols = 3, w = 320, h = 130, gap = 16; // :2995
      const x0 = 40, y0 = 130;                    // :2996
      for (let idx = 0; idx < cards.length; idx++) { // :2997
        const row = Math.floor(idx / cols), col = idx % cols; // :2998
        const x = x0 + col * (w + gap);           // :2999
        const y = y0 + row * (h + gap) + this.scrollY; // :3000
        this.cardButtons.push({ card: cards[idx], x: x, y: y, w: w, h: h });
      }
    }

    _authData() {
      const auth = global.Game && global.Game.auth;
      return (auth && typeof auth.data === 'function') ? (auth.data() || {}) : null;
    }
    _isAdmin() {                                  // main.py:3028
      const auth = global.Game && global.Game.auth;
      return !!(auth && auth.currentUser === 'admin');
    }

    // main.py:3003-3021 handle_event(e)
    handleInput(input, dt) {
      const click = input.consumeClick ? input.consumeClick() : null;
      const wheel = input.consumeWheel ? input.consumeWheel() : null;
      // main.py:3004-3006 MOUSEWHEEL -> scroll (clamped at 0) then rebuild
      if (wheel) {
        this.scrollY = Math.min(0, this.scrollY + wheel * 30);
        this._rebuild();
      }
      // main.py:3007-3008 only MOUSEBUTTONDOWN is handled
      if (!click) return;
      // main.py:3009-3011 back -> MenuState with a PAGE transition
      if (hit(click, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h)) {
        global.Game.states.change('menu', null, null);
        return;
      }
      // main.py:3012-3017 filter buttons
      for (let i = 0; i < this.filterButtons.length; i++) {
        const f = this.filterButtons[i];
        if (!hit(click, f.x, f.y, f.w, f.h)) continue;
        this.filter = f.key;
        this.scrollY = 0;
        this._rebuild();
        return;
      }
      // main.py:3018-3021 card click -> _buy, first match wins
      for (let i = 0; i < this.cardButtons.length; i++) {
        const cb = this.cardButtons[i];
        if (!hit(click, cb.x, cb.y, cb.w, cb.h)) continue;
        this._buy(cb.card);
        return;
      }
    }

    // main.py:3023-3043 _buy(card)
    _buy(card) {
      const info = CARD_SHOP_RARITY[card.rarity];        // main.py:3024
      const price = info.price;                           // main.py:3025
      const d = this._authData();
      if (!d) return;
      const gold = parseInt(d.gold || 0, 10) || 0;       // main.py:3027
      const isAdmin = this._isAdmin();                    // main.py:3028
      // main.py:3029-3033 not admin and not enough gold -> message only
      if (!isAdmin && gold < price) {
        this.msg = 'Chua du Vang! Can ' + price + ' Vang, ban co ' + gold + '. Con lai, hoc them de kiem Vang nhe!';
        this.msgOk = false;
        this.msgTimer = 2.8;
        return;
      }
      // main.py:3034-3035 admin pays nothing
      if (!isAdmin) d.gold = gold - price;
      // main.py:3036 grant + save (grant_card_direct calls account_system.save)
      grantCardDirect(card.title);
      this.msg = "Da doi the '" + card.title + "' thanh cong!";
      this.msgOk = true;
      this.msgTimer = 2.5;
      this.shake = 0.15;                            // main.py:3040 trigger_shake(2, 0.15)
      this.confettiAt = Date.now();                 // main.py:3041-3042 confetti burst
      // main.py:3043 sound_manager.play_sound("purchase")
      const A = global.Game && global.Game.audio;
      if (A && typeof A.playSound === 'function') { try { A.playSound('purchase'); } catch (e) { /* audio optional */ } }
    }

    // main.py:3045-3047 update(dt) -- only the message timer decays
    update(dt) {
      const d = dt || 0;
      if (this.msgTimer > 0) this.msgTimer = Math.max(0, this.msgTimer - d);
      if (this.shake > 0) this.shake = Math.max(0, this.shake - d);
    }

    // main.py:3049-3089 draw(s)
    draw(ctx, WW, HH) {
      const R = global.Game.renderer;
      R.clear('rgb(18,20,34)');                                   // main.py:3050
      R.text('CUA HANG DAI THA', W / 2, 55,                       // main.py:3051
        { font: 'bold 34px Quicksand, Segoe UI, sans-serif', fill: 'rgb(255,230,150)', align: 'center', baseline: 'middle' });
      R.text('Dung Vang hoc tap duoc de doi the manh thach - khong may rui!', W / 2 - 270, 95, // :3052-3053
        { font: 'bold 16px Quicksand, Segoe UI, sans-serif', fill: 'rgb(190,190,210)', align: 'left', baseline: 'top', maxWidth: 560 });
      const d = this._authData() || {};                          // main.py:3054-3056
      const gold = d.gold === undefined ? 0 : d.gold;
      const goldText = this._isAdmin() ? 'Vang: Vo han (Admin)' : ('Vang: ' + gold); // :3056
      R.text('\uD83E\uDDFE  ' + goldText, W - 225, 44,           // main.py:3057-3058
        { font: 'bold 20px Quicksand, Segoe UI, sans-serif', fill: 'rgb(255,215,80)', align: 'left', baseline: 'middle', maxWidth: 210 });
      // main.py:3059-3063 filter buttons, active one is WHITE with black text
      for (let i = 0; i < this.filterButtons.length; i++) {
        const f = this.filterButtons[i];
        const active = this.filter === f.key;                    // main.py:3060
        R.fillRoundRect(f.x, f.y, f.w, f.h, 8, active ? 'rgb(255,255,255)' : css(f.bg), null, 0);
        R.text(f.label, f.x + f.w / 2, f.y + f.h / 2,             // main.py:3061-3063
          { font: 'bold 14px Quicksand, Segoe UI, sans-serif', fill: active ? 'rgb(0,0,0)' : 'rgb(255,255,255)', align: 'center', baseline: 'middle', maxWidth: f.w - 8 });
      }
      const bag = d.bag || {};                                  // main.py:3064-3065
      for (let i = 0; i < this.cardButtons.length; i++) {
        const cb = this.cardButtons[i];
        // main.py:3067-3068 cull off-screen rows
        if (cb.y + cb.h < 120 || cb.y > H - 90) continue;
        const info = CARD_SHOP_RARITY[cb.card.rarity];           // main.py:3069
        const owned = bag[cb.card.title] || 0;                   // main.py:3070
        R.fillRoundRect(cb.x, cb.y, cb.w, cb.h, 14, 'rgb(35,38,58)', css(info.color), 2); // :3071-3072
        R.text(String(cb.card.icon || '?'), cb.x + 14, cb.y + 14, // main.py:3073-3074
          { font: '30px Segoe UI Emoji, sans-serif', fill: css(info.color), align: 'left', baseline: 'top' });
        R.text(String(cb.card.title).slice(0, 20), cb.x + 58, cb.y + 14, // :3075
          { font: 'bold 16px Quicksand, Segoe UI, sans-serif', fill: 'rgb(255,255,255)', align: 'left', baseline: 'top', maxWidth: cb.w - 70 });
        // main.py:3076-3078 description truncated at 44 chars
        let desc = String(cb.card.content || '');
        if (desc.length > 44) desc = desc.slice(0, 44) + '...';
        R.text(desc, cb.x + 14, cb.y + 52,                        // main.py:3079
          { font: '12px Quicksand, Segoe UI, sans-serif', fill: 'rgb(190,190,205)', align: 'left', baseline: 'top', maxWidth: cb.w - 28 });
        R.text(info.label, cb.x + 14, cb.y + 78,                  // main.py:3080
          { font: '12px Quicksand, Segoe UI, sans-serif', fill: css(info.color), align: 'left', baseline: 'top' });
        R.text(info.price + ' \uD83E\uDDFE', cb.x + cb.w - 90, cb.y + 78, // :3081-3082
          { font: 'bold 14px Quicksand, Segoe UI, sans-serif', fill: 'rgb(255,215,80)', align: 'left', baseline: 'top' });
        if (owned) R.text('Da co: ' + owned, cb.x + cb.w - 90, cb.y + 52, // :3083-3085
          { font: '12px Quicksand, Segoe UI, sans-serif', fill: 'rgb(140,220,150)', align: 'left', baseline: 'top' });
      }
      drawBtn(R, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h, this.backBtn.label, this.backBtn.bg, { fontSize: 16, radius: 8 });
      // main.py:3087-3089 message, green on success / red on failure
      if (this.msgTimer > 0 && this.msg) {
        R.text(this.msg, W / 2, H - 45,                          // main.py:3088-3089
          { font: '16px Quicksand, Segoe UI, sans-serif', fill: this.msgOk ? 'rgb(60,200,100)' : 'rgb(220,80,80)', align: 'center', baseline: 'middle', maxWidth: 900 });
      }
    }
  }

global.CardShopState = CardShopState;
global.cardShopAllCards = cardShopAllCards;
global.CARD_SHOP_RARITY = CARD_SHOP_RARITY;
global.grantCardDirect = grantCardDirect;

global.FinalExamState = FinalExamState;
global.ExamResultState = ExamResultState;
// M30.2 helper exports (game_init.py:2919 generate_hard_exam, and
// game_init.py:380 reward_gold_for_result as called by main.py:3244)
global.generateHardExam = generateHardExam;
global.examGoldForScore = examGoldForScore;

  global.LoginState = LoginState;
  global.RegisterState = RegisterState;
  global.MenuState = MenuState;
  global.LessonSelectState = LessonSelectState;
  global.TheoryState = TheoryState;
  global.LessonState = LessonState;
  global.VictoryState = VictoryState;
  global.DefeatState = DefeatState;
  global.ShopState = ShopState;
  global.PetState = PetState;
  global.SkinState = SkinState;
  global.GachaState = GachaState;
  global.AchievementState = AchievementState;
  global.DailyState = DailyState;
global.DailyRewardState = DailyRewardState;
  global.SkillTreeState = SkillTreeState;
  global.BagState = BagState;
  global.ProfileState = ProfileState;
  global.SkillMapState = SkillMapState;
  global.AdminPanelState = AdminPanelState;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      LoadingState: LoadingState,
      IdleGifState: IdleGifState,
    TimeAttackState: TimeAttackState,
    ExamTransitionState: ExamTransitionState,
    FinalExamState: FinalExamState,
    ExamResultState: ExamResultState,
    CardShopState: CardShopState,
    cardShopAllCards: cardShopAllCards,
    CARD_SHOP_RARITY: CARD_SHOP_RARITY,
    grantCardDirect: grantCardDirect,
    generateHardExam: generateHardExam,
    examGoldForScore: examGoldForScore,
    LoginState: LoginState,
      RegisterState: RegisterState,
      MenuState: MenuState,
      LessonSelectState: LessonSelectState,
      TheoryState: TheoryState,
      LessonState: LessonState,
      VictoryState: VictoryState,
      DefeatState: DefeatState,
      ShopState: ShopState,
      PetState: PetState,
      SkinState: SkinState,
      GachaState: GachaState,
      AchievementState: AchievementState,
      DailyState: DailyState,
    DailyRewardState: DailyRewardState,
      SkillTreeState: SkillTreeState,
      BagState: BagState,
      ProfileState: ProfileState,
      SkillMapState: SkillMapState,
      AdminPanelState: AdminPanelState,
      createPlayer: createPlayer
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);








// ===== REALISTICBOOK_P1_INTEGRATION =====
// P1-1: Restore book-page identity on Menu + LessonSelect (Desktop parity).
// Desktop: main.py:416/745 MenuState draws RealisticBook(50,50,1200,700) with
// draw_left/draw_right page callbacks; main.py:922/971 LessonSelectState same.
// Non-invasive: prototype patching with guards; no fullscreen page-turn.
// NOTE (resolution order): ui.js wraps its classes in an IIFE and only publishes
// them on global.UI, so `RealisticBook` is NOT a bare global in the browser.
// Resolve from global.UI first, then fall back to the CommonJS require path.
(function () {
  'use strict';
  var ROOT = (typeof globalThis !== 'undefined' && globalThis) ||
             (typeof window !== 'undefined' && window) || null;
  var RB = null;
  if (typeof RealisticBook !== 'undefined') RB = RealisticBook;
  else if (ROOT && ROOT.UI && ROOT.UI.RealisticBook) RB = ROOT.UI.RealisticBook; // browser path
  else if (typeof module !== 'undefined' && module.exports) {
    try { RB = require('./ui.js').RealisticBook; } catch (e) { RB = null; }
  }
  if (!RB) return; // guard: class unavailable, integration no-ops

  /* Desktop book geometry: every Desktop state that owns a book constructs
     RealisticBook(50, 50, 1200, 700) — Menu main.py:416, Settings :754,
     PasswordChange :876, LessonSelect :924, Theory :979, AchievementView :1929,
     Daily :2004, Profile :2132, Shop :2275, SkillTree :2479. UI.RealisticBook
     defaults to (150,100,1000,600), which silently shrank and re-centred the
     chrome for Menu/LessonSelect, so the Desktop rect is passed explicitly here.
     States that build their own book (TheoryState) are left untouched. */
  var BOOK_RECT = { x: 50, y: 50, w: 1200, h: 700 };
  function _bookEnter(state, makePageApi) {
    if (!state._rbBook) { try { state._rbBook = new RB([], BOOK_RECT); } catch (e) { state._rbBook = null; } }
    if (state._rbBook && typeof state._rbBook.reset === 'function') state._rbBook.reset();
    if (state._rbBook && typeof makePageApi === 'function') {
      try { makePageApi(state._rbBook, _renderer); } catch (e) { /* never break book init */ }
    }
  }
  // RealisticBook.draw() expects the *Renderer* (api: fillRoundRect/text), NOT the
  // raw 2D context that state.draw() receives. Resolve the renderer lazily so the
  // integration survives any script load order and never breaks a state draw.
  function _renderer() {
    var g = (typeof globalThis !== 'undefined' && globalThis) || ROOT;
    return (g && g.Game && g.Game.renderer) ? g.Game.renderer : null;
  }
  /* Desktop draw order (main.py:732-745 MenuState, 997-1004 TheoryState):
       s.fill(background)  ->  book.draw(s, left, right)  ->  state content on top
     The Web states each begin their own draw() with R.clear(background), so a book
     painted before the state's draw() is erased. To reproduce the Desktop order we
     paint the chrome immediately AFTER the state's background clear and BEFORE its
     content, by intercepting clear() for the duration of that draw() call.
     drawFn MUST be the wrapped state draw: the hook only survives while drawFn
     runs, so calling this without a callback restores R.clear() first and the
     state's own clear() erases the chrome again.
     Chrome is painted unconditionally (Desktop has no "has pages" condition): the
     `pages` array is only the legacy label list used when no page callbacks exist. */
  /* ---- M25.1: book-only page-flip navigation -------------------------
     GOAL: when a navigation button is pressed, ONLY the book's pages turn.
     The viewport, background art and browser page must not fade/slide/scale.

     REPRODUCED DEFECT (real Chromium, local server): clicking the Menu card
     "HOC BAI" ran 36 full-screen transition frames and changed viewport pixels
     outside the book on 34 of them. Root cause: the call passed 'fade' to
     states.change(), and TransitionEffect.draw (effects2.js:81) fills the whole
     canvas with rgba(11,16,32,a). The RealisticBook curl was never involved.

     M25.1 replaces that with a three-phase state machine so the destination is
     only committed once the page has physically turned:

       IDLE     - the current state draws normally, book idle
       FLIPPING - book curl runs; destination is recorded but NOT swapped in;
                  the current state keeps drawing, so the old page is the one
                  visible while it contracts. Navigation clicks are ignored.
       COMPLETE - curl finished, destination committed, book idle again

     The flip maths are unchanged from M22 (Desktop game_init.py:4376-4430):
     progress 0->1 over 1/3 s, outgoing page 1.0->0.7, incoming 0.7->1.0,
     shadow alpha 100->0, shadow width 8->12. This helper only decides WHEN a
     navigation is committed; it does not re-implement the curl. */
  function bookNav(states, book) {
    var busy = false, pending = null;
    function flip(direction, swap) {
      if (!states || !book) { return swap ? swap() : undefined; }
      /* Desktop-parity direction: slide_left turns the LEFT page, which is what
         "next" does; slide_right turns the RIGHT page, what "prev" does. */
      book.startFlip(direction);
      busy = true;
      pending = swap;
      return undefined;
    }
    return {
      /* FLIPPING: true while the page is turning. Callers use this to refuse
         duplicate navigation clicks and to keep the old content on screen. */
      get isFlipping() { return busy; },
      /* true when a navigation is pending or running - used to suppress input
         so a second click cannot queue a second swap. */
      get isBusy() { return busy || !!pending; },
      next: function (swap) { return flip('slide_left', swap); },
      prev: function (swap) { return flip('slide_right', swap); },
      /* Called once per frame. Returns true on the frame the flip completes, at
         which point the destination state is committed. */
      update: function (dt) {
        if (!book) return false;
        /* Always forward dt to the book: RealisticBook.update() is already a no-op
           when no flip is active, and ui_parity_p1 T07 asserts the book is advanced
           once per state update. Skipping the call while idle broke that contract
           without changing behaviour, so the forwarding is unconditional. */
        var done = false;
        try { done = book.update(dt) === true; } catch (e) { done = true; }
        if (!busy) return false;
        if (!done) return false;
        busy = false;
        var swap = pending;
        pending = null;
        if (swap) swap();
        return true;
      },
      reset: function () { busy = false; pending = null; }
    };
  }

  /* M25.1: exported from THIS scope (the one bookNav is defined in) so the
     focused test can drive the three-phase machine. NOTE: this IIFE has no
     `global` binding - it resolves the global object through ROOT. */
  if (ROOT) ROOT.bookNav = bookNav;
  if (typeof module !== 'undefined' && module.exports) { try { module.exports.bookNav = bookNav; } catch (e) { /* ignore */ } }
  function _states() {
    var g = (typeof globalThis !== 'undefined' && globalThis) || ROOT;
    return (g && g.Game) ? g.Game.states : null;
  }
  /* M25.1: MenuState owns a book too, so it needs the same helper. */
  function _bookDrawBase(state, drawFn) {
    var book = state._rbBook;
    var R = _renderer();
    if (!book || typeof book.draw !== 'function' || !R || typeof R.clear !== 'function') {
      if (drawFn) drawFn();
      return;
    }
    var origClear = R.clear;
    /* M21: M18 changed several states (Menu) from a flat R.clear() to the Desktop
       background stack R.gradient(...). Those states never call clear() at the top of
       their draw(), so the hook below never fired and the book was never painted — the
       menu rendered dashboard cards on a bare gradient. Hook gradient() as well, so
       the book is emitted after the background is laid down, whatever method the
       state used. Order still matches Desktop main.py:732-745:
         background fill -> gradient -> background art -> clover -> BOOK -> content */
    var origGradient = R.gradient;
    var painted = false;
    var paint = function () {
      if (painted) return;
      painted = true;
      /* M25.1: pass withTransition so the M22 curl actually renders. Before
         this the book was drawn as book.draw(R) -> withTransition undefined ->
         animate = !!withTransition && this.flipping was ALWAYS false, so a page
         turn was started but never drawn. Left/right page content stays
         undefined exactly as before, so the screen content on top is untouched. */
      try { book.draw(R, null, null, !!book.flipping); } catch (e) { /* never break draw */ }
    };
    R.clear = function () {
      var out = origClear.apply(R, arguments);
      paint();
      return out;
    };
    if (typeof origGradient === 'function') {
      R.gradient = function () {
        var out = origGradient.apply(R, arguments);
        paint();
        return out;
      };
    }
    try {
      if (drawFn) drawFn();
      else paint();
    } finally {
      R.clear = origClear;
      if (typeof origGradient === 'function') R.gradient = origGradient;
      if (!painted && !drawFn) { /* nothing to do */ }
    }
  }

  // --- MenuState: book behind dashboard content ---
  if (typeof MenuState !== 'undefined' && MenuState.prototype) {
    var mEnter = MenuState.prototype.enter;
    MenuState.prototype.enter = function () {
      if (mEnter) mEnter.apply(this, arguments);
      _bookEnter(this);
    };
    var mDraw = MenuState.prototype.draw;
    MenuState.prototype.draw = function (ctx) {
      if (!this._rbNav && this._rbBook) this._rbNav = bookNav(_states(), this._rbBook);
      /* The state's own draw must run INSIDE _bookDrawBase so the Renderer.clear
         hook is still installed while it runs. Calling _bookDrawBase(this) with no
         callback painted the chrome first and restored R.clear before the state
         drew, so the state's own clear erased it again — the P1 book chrome was
         invisible on every screen that used this wrapper.
         M21: Menu is the one state whose Desktop order puts the book AFTER the
         background art (main.py:734-745), and MenuState.draw now paints it there
         itself. The early hook would paint a second, immediately-overpainted copy and
         ui_parity_p1 T05 (book.draw called exactly once) would fail, so skip it. */
      var self = this, args = arguments;
      if (this.__m21MenuOwnsBook) { if (mDraw) mDraw.apply(self, args); return; }
      _bookDrawBase(this, function () { if (mDraw) mDraw.apply(self, args); });
    };
    MenuState.prototype.__m21MenuOwnsBook = true;
    /* M25.1: advance the page turn every frame and commit the destination when it
       completes. Without this the curl would never progress from Menu. */
    var mUpdate = MenuState.prototype.update;
    MenuState.prototype.update = function (dt) {
      if (!this._rbNav && this._rbBook) this._rbNav = bookNav(_states(), this._rbBook);
      if (this._rbNav) this._rbNav.update(dt);
      if (mUpdate) mUpdate.apply(this, arguments);
    };
    /* M25.1: duplicate-click guard. While the page is turning the Menu must not
       act on another navigation click, otherwise one press could commit two
       destination swaps. */
    var mInput = MenuState.prototype.handleInput;
    MenuState.prototype.handleInput = function (input, dt) {
      if (this._rbNav && this._rbNav.isBusy) return;
      if (mInput) mInput.apply(this, arguments);
    };
  }

  // --- LessonSelectState: book with 4 lessons left + 4 right ---
  if (typeof LessonSelectState !== 'undefined' && LessonSelectState.prototype) {
    var lEnter = LessonSelectState.prototype.enter;
    LessonSelectState.prototype.enter = function () {
      if (lEnter) lEnter.apply(this, arguments);
      _bookEnter(this);
    };
    var lDraw = LessonSelectState.prototype.draw;
    LessonSelectState.prototype.draw = function (ctx) {
      var self = this, args = arguments;
      _bookDrawBase(this, function () { if (lDraw) lDraw.apply(self, args); });
    };
    /* M25.1: refuse further page-turn clicks while a turn is running. */
    var lInput = LessonSelectState.prototype.handleInput;
    LessonSelectState.prototype.handleInput = function (input, dt) {
      if (this._rbNav && this._rbNav.isBusy) return;
      if (lInput) lInput.apply(this, arguments);
    };
    var lUpdate = LessonSelectState.prototype.update;
    LessonSelectState.prototype.update = function (dt) {
      /* M25.1: the page flip is driven through bookNav so the destination page is
         committed only on the frame the curl completes. A raw book.update() here
         would have completed the turn without ever committing the index. */
      if (!this._rbNav && this._rbBook) this._rbNav = bookNav(_states(), this._rbBook);
      if (this._rbNav) this._rbNav.update(dt);
      else if (this._rbBook && typeof this._rbBook.update === 'function') {
        try { this._rbBook.update(dt); } catch (e) { /* no-op */ }
      }
      if (lUpdate) lUpdate.apply(this, arguments);
    };
  }

  /* M21: generic book wiring for the Desktop states that own a RealisticBook but
     were never connected to the Web one. Desktop main.py builds a book in Settings
     (:754), PasswordChange (:876), Profile (:2132), Shop (:2275), SkillTree (:2479),
     Daily (:2004) and AchievementView (:1929); only Menu, LessonSelect and Theory
     were wired. The other five therefore painted their panels on a bare
     (165,214,167) field with no cover, no spine and no cream pages. This wires them
     through the SAME _bookDrawBase helper, so the Desktop order
     (background -> book -> content) is preserved and no second book implementation
     is introduced. Idempotent via proto.__bookWired. */
  function _wireBookState(name) {
    /* This IIFE is (function () { ... }) with no `global` parameter, so resolve the
       class through the module-local binding the rest of the block already uses
       (typeof XState !== 'undefined'), exactly as the Menu/LessonSelect/Theory
       wiring above does. Using `global[name]` here threw "global is not defined". */
    var Ctor = null;
    switch (name) {
      case 'ProfileState': Ctor = (typeof ProfileState !== 'undefined') ? ProfileState : null; break;
      case 'ShopState': Ctor = (typeof ShopState !== 'undefined') ? ShopState : null; break;
      case 'SkillTreeState': Ctor = (typeof SkillTreeState !== 'undefined') ? SkillTreeState : null; break;
      case 'DailyState': Ctor = (typeof DailyState !== 'undefined') ? DailyState : null; break;
      case 'AchievementState': Ctor = (typeof AchievementState !== 'undefined') ? AchievementState : null; break;
      default: return;
    }
    if (!Ctor || !Ctor.prototype) return;
    var proto = Ctor.prototype;
    if (proto.__bookWired) return;
    var enter = proto.enter;
    if (enter) {
      proto.enter = function () {
        var out = enter.apply(this, arguments);
        _bookEnter(this);
        return out;
      };
    } else {
      proto.enter = function () { _bookEnter(this); };
    }
    var draw = proto.draw;
    proto.draw = function () {
      var self = this, args = arguments;
      _bookDrawBase(this, function () { if (draw) draw.apply(self, args); });
    };
    var update = proto.update;
    proto.update = function (dt) {
      if (this._rbBook && typeof this._rbBook.update === 'function') {
        try { this._rbBook.update(dt); } catch (e) { /* no-op */ }
      }
      if (update) update.apply(this, arguments);
    };
    proto.__bookWired = true;
  }

  _wireBookState('ProfileState');
  _wireBookState('ShopState');
  _wireBookState('SkillTreeState');
  _wireBookState('DailyState');
  _wireBookState('AchievementState');

  /* SettingsState / PasswordChangeState are constructor-function states exported
     from settings_states.js, not ES classes, so they are wired inside that module
     (M21) to avoid a script load-order cycle. */

  // --- TheoryState: book drawn behind the theory panel (Desktop main.py:997-1004).
  // FINAL QA: the state now builds its book from the real Desktop theory pages,
  // so this wiring paints actual page content instead of an empty shell.
  if (typeof TheoryState !== 'undefined' && TheoryState.prototype) {
    var tDraw = TheoryState.prototype.draw;
    TheoryState.prototype.draw = function (ctx) {
      var self = this, args = arguments;
      _bookDrawBase(this, function () { if (tDraw) tDraw.apply(self, args); });
    };
    var tUpdate = TheoryState.prototype.update;
    TheoryState.prototype.update = function (dt) {
      if (this._rbBook && typeof this._rbBook.update === 'function') {
        try { this._rbBook.update(dt); } catch (e) { /* no-op */ }
      }
      if (tUpdate) tUpdate.apply(this, arguments);
    };
  }
})();

/* ===== POLISH M2 (appended): Menu dashboard detail panel + Theory scroll indicator =====
   Non-destructive visual layer. Wraps BaseState.draw() only and always calls the
   previous implementation first. Never throws: every drawing step is guarded.
   Parity target: main.py MenuState.draw_left (difficulty, streak, pet block with
   evolution progress, achievement preview) + TheoryState scroll affordance. */
(function () {
  var G = (typeof globalThis !== "undefined" && globalThis) || (typeof global !== "undefined" && global) || null;
  if (!G || G.__POLISH_M2_APPLIED__) return;
  G.__POLISH_M2_APPLIED__ = true;

  function n(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
  function s(v, d) { return (v === undefined || v === null || v === "") ? d : String(v); }
  function pick() {
    for (var i = 0; i < arguments.length; i++) { var o = arguments[i]; if (o && typeof o === "object") return o; }
    return null;
  }
  function profile(state) {
    var g = state && state.game ? state.game : null, p = state && state.player ? state.player : null;
    return pick(
      p && p.profile, p && p.data, p && p.playerData,
      g && g.player && g.player.profile, g && g.player && g.player.data,
      g && g.playerData, g && g.profile,
      state && state.profile, state && state.playerData, state && state.data
    ) || {};
  }
  function petInfo(state) {
    var g = state && state.game ? state.game : null, out = null;
    try {
      if (g && g.petSystem && typeof g.petSystem.getActivePet === "function") out = g.petSystem.getActivePet();
      if (!out && g && g.petSystem && typeof g.petSystem.getActivePetInfo === "function") out = g.petSystem.getActivePetInfo();
      if (!out && g && g.pets) out = g.pets;
      if (!out && g && g.player && g.player.pets) out = g.player.pets;
    } catch (e) { out = null; }
    return (out && typeof out === "object") ? out : null;
  }
  function achCount(state) {
    var g = state && state.game ? state.game : null, v = null;
    try {
      if (g && g.achievements) {
        var a = g.achievements;
        if (typeof a.getUnlockedCount === "function") v = a.getUnlockedCount();
        else if (Array.isArray(a.unlocked)) v = a.unlocked.length;
        else if (a.stats && typeof a.stats.unlocked === "number") v = a.stats.unlocked;
      }
    } catch (e) { v = null; }
    return (typeof v === "number" && isFinite(v)) ? v : null;
  }
  function rr(ctx, x, y, w, h, r) {
    var rad = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
  }
  function line(ctx, txt, x, y, size, col, weight, align) {
    ctx.font = (weight || "600") + " " + size + "px Segoe UI, Roboto, Arial, sans-serif";
    ctx.fillStyle = col;
    ctx.textAlign = align || "left";
    ctx.textBaseline = "middle";
    ctx.fillText(txt, x, y);
  }
  function bar(ctx, x, y, w, h, pct, bg, fg) {
    rr(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = bg; ctx.fill();
    var fw = Math.max(0, Math.min(1, pct)) * w;
    if (fw > 0) { rr(ctx, x, y, fw, h, h / 2); ctx.fillStyle = fg; ctx.fill(); }
  }

  function menuDetails(ctx, state) {
    if (!ctx || typeof ctx.fillText !== "function" || typeof ctx.fillRect !== "function") return;
    var cv = ctx.canvas || { width: 1280, height: 720 };
    var W = n(cv.width, 1280), H = n(cv.height, 720);
    var p = profile(state);
    var pet = petInfo(state);
    var un = achCount(state);

    var fs = Math.max(11, Math.round(H * 0.0215));
    var pad = Math.round(H * 0.018);
    var x = Math.round(W * 0.075);
    var y = Math.round(H * 0.60);
    var w = Math.round(W * 0.345);
    var rows = pet ? 4 : 3;
    var h = pad * 2 + fs * 1.2 + rows * fs * 1.5;

    ctx.save();
    rr(ctx, x, y, w, h, Math.round(H * 0.016));
    ctx.fillStyle = "rgba(12, 26, 48, 0.55)";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0, 188, 212, 0.35)";
    ctx.stroke();

    var cx = x + pad, cy = y + pad + fs * 0.7, lh = fs * 1.5;

    var diff = n(p.difficulty, 1);
    var diffName = s(p.difficulty_name, "");
    if (!diffName) diffName = (diff === 3) ? "Kho" : (diff === 2 ? "Trung binh" : "De");
    line(ctx, "Do kho: " + diffName, cx, cy, fs, "#FFC107");
    cy += lh;

    var streak = n(p.streak !== undefined ? p.streak : p.daily_streak, 0);
    line(ctx, "Chuoi ngay: " + streak, cx, cy, fs, "#4CAF50");
    cy += lh;

    if (pet) {
      var pname = s(pet.name || pet.pet_name || pet.type, s(p.pet_type, "Thu cung"));
      var plvl = n(pet.level !== undefined ? pet.level : pet.pet_level, 8);
      line(ctx, "Thu cung: " + pname + "  Lv" + plvl, cx, cy, fs, "#CE93D8");
      cy += lh;
      var maxLv = Math.max(1, n(pet.max_level !== undefined ? pet.max_level : pet.maxLevel, 30));
      bar(ctx, cx, cy - fs * 0.5, w - pad * 2, Math.max(6, Math.round(fs * 0.55)), plvl / maxLv,
          "rgba(255,255,255,0.16)", "#CE93D8");
      cy += lh;
    } else {
      line(ctx, "Thu cung: chua chon", cx, cy, fs, "rgba(255,255,255,0.45)");
      cy += lh;
    }

    var total = null;
    try {
      var g = state && state.game ? state.game : null;
      if (g && g.achievements && Array.isArray(g.achievements.list)) total = g.achievements.list.length;
      else if (g && g.achievementData && Array.isArray(g.achievementData)) total = g.achievementData.length;
    } catch (e) { total = null; }
    line(ctx, "Thanh tuu: " + (un === null ? "-" : (total ? (un + "/" + total) : String(un))), cx, cy, fs, "#64B5F6");
    ctx.restore();
  }

  function theoryScroll(ctx, state) {
    if (!ctx || typeof ctx.fillRect !== "function") return;
    var cv = ctx.canvas || { width: 1280, height: 720 };
    var W = n(cv.width, 1280), H = n(cv.height, 720);
    var off = null, mx = null;
    try {
      if (typeof state.scrollY === "number") off = state.scrollY;
      else if (typeof state.scrollOffset === "number") off = state.scrollOffset;
      else if (typeof state._scroll === "number") off = state._scroll;
      if (typeof state.maxScroll === "number") mx = state.maxScroll;
      else if (typeof state.maxScrollY === "number") mx = state.maxScrollY;
    } catch (e) { off = null; }
    if (off === null || !mx || mx <= 0) return;
    var xr = Math.round(W * 0.945), yt = Math.round(H * 0.22), hb = Math.round(H * 0.60);
    var bw = Math.max(6, Math.round(W * 0.006));
    ctx.save();
    rr(ctx, xr, yt, bw, hb, bw / 2);
    ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fill();
    var frac = Math.max(0, Math.min(1, off / mx));
    var th = Math.max(bw * 2, hb * Math.max(0.12, 1 - Math.min(0.85, mx / (hb * 3))));
    var ty = yt + frac * (hb - th);
    rr(ctx, xr, ty, bw, th, bw / 2);
    ctx.fillStyle = "#4CAF50"; ctx.fill();
    ctx.restore();
  }

  function wrap(cls, fn) {
    if (typeof cls !== "function" || !cls.prototype || typeof cls.prototype.draw !== "function") return false;
    if (cls.prototype.__POLISH_M2_WRAPPED__) return true;
    var prev = cls.prototype.draw;
    cls.prototype.draw = function (ctx) {
      var out = prev.apply(this, arguments);
      try { fn(ctx, this); } catch (e) { /* visual layer must never break base draw */ }
      return out;
    };
    cls.prototype.__POLISH_M2_WRAPPED__ = true;
    return true;
  }

  function attempt() {
    var done = 0, need = 0;
    if (typeof G.MenuState === "function") { need++; if (wrap(G.MenuState, menuDetails)) done++; }
    if (typeof G.TheoryState === "function") { need++; if (wrap(G.TheoryState, theoryScroll)) done++; }
    G.__POLISH_M2_WRAPPED__ = done;
    return (need > 0 && done === need);
  }

  if (!attempt() && typeof setTimeout === "function") {
    var tries = 0;
    var tick = function () {
      tries++;
      if (attempt() || tries >= 20) return;
      setTimeout(tick, 50);
    };
    setTimeout(tick, 50);
  }
})();

// POLISH_M2_HOOK (additive, no-op when module absent)
try {
  if (typeof global !== 'undefined' && global.PolishM2 && typeof global.PolishM2.install === 'function') { global.PolishM2.install(); }
} catch (e) { /* polish optional */ }
