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
  const BLUE_BTN   = [0, 188, 212];
  const GREEN_BTN  = [76, 175, 80];
  const PURPLE_BTN = [138, 43, 176];
  const ORANGE_BTN = [255, 152, 0];
  const YELLOW_BTN = [255, 215, 0];
  const RED_BTN    = [244, 67, 54];
  const SHADOW     = [100, 100, 100];

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
      const jobs = [];
      if (G.assets && G.assets.loadFonts) jobs.push(G.assets.loadFonts());
      else jobs.push(Promise.resolve({}));
      if (G.assets && G.assets.preload) {
        jobs.push(G.assets.preload([
          { name: 'nen_game', url: 'assets/nen_game.png' },
          { name: 'pixel_clover', url: 'assets/pixel_clover.png' },
          { name: 'favicon', url: 'assets/favicon.png' },
          // Desktop parity game_init.py:292 — DEFAULT_CHARACTER_IMG = main_character.png (600x600),
          // dùng bởi TheoryState character panel (main.py:997-1004).
          { name: 'main_character', url: 'assets/main_character.png' },
          { name: 'victory_text', url: 'assets/victory_text.png' },
          { name: 'defeat', url: 'assets/defeat.png' }
        ]));
      } else {
        jobs.push(Promise.resolve({ total: 0, loaded: 0, failed: 0 }));
      }
      if (G.audio && G.audio.loadSfx) jobs.push(G.audio.loadSfx('correct', 'tra_loi_dung.ogg'));
      else jobs.push(Promise.resolve(null));
      const self = this;
      return Promise.all(jobs).then(function (results) {
        self.report = results[1] || { total: 0, loaded: 0, failed: 0 };
        self.ready = true;
        L.info('[Loading] Assets ready', self.report);
      }).catch(function (err) {
        L.error('[Loading] Preload failed', err);
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
      R.clear('#141e37'); // main.py:162 s.fill((20,30,55)) + gradient (70,120,190)
      const bg = global.Game.assets && global.Game.assets.get('nen_game');
      if (bg && !bg.placeholder) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        R.image(bg, 0, 0, W2, H2);
        ctx.restore();
      }
      R.text('MATHDRILL', W2 / 2, H2 / 2 - 170, {
        font: 'bold 54px Quicksand, Segoe UI, sans-serif',
        fill: '#e0ecff', align: 'center', baseline: 'middle'
      });
      const barW = 520, barH = 28, bx = (W2 - barW) / 2, by = H2 / 2 - 20;
      const p = this.ready ? 1 : Math.min(1, this.elapsed / this.minTime);
      R.fillRoundRect(bx, by, barW, barH, 14, 'rgba(40,40,60,0.9)', null, 0);
      if (p > 0) R.fillRoundRect(bx, by, barW * p, barH, 14, 'rgb(100,200,255)', null, 0);
      R.fillRoundRect(bx, by, barW, barH, 14, 'rgba(0,0,0,0)', 'rgba(255,255,255,0.9)', 2);
      R.text('Đang tải... ' + Math.round(p * 100) + '%', W2 / 2, by - 36, {
        font: '18px Quicksand, sans-serif', fill: '#e6e6f5', align: 'center', baseline: 'middle'
      });
      R.text(this.tip, W2 / 2, by + barH + 60, {
        font: '18px Quicksand, sans-serif', fill: '#e6e6f5', align: 'center', baseline: 'middle'
      });
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
      R.clear('#1e2840');
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
        R.text(this.msg, 650, 690, {
          font: '20px Quicksand, sans-serif',
          fill: this.msgOk ? '#4ade80' : '#ff8a8a',
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
  class LoginState extends BaseState {
    constructor() {
      super('login');
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
    }

    exit() {}

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

    update(dt) {
      if (this.errorTimer > 0) this.errorTimer = Math.max(0, this.errorTimer - dt);
      if (this.infoTimer > 0) this.infoTimer = Math.max(0, this.infoTimer - dt);
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
        { id: 'time', x: x + card_w + gap, y: card_y1, w: card_w, h: card_h, icon: '⏱️', label: 'Time Attack', sub: 'Chơi nhanh ghi điểm', bg: ORANGE_BTN, locked: 'M7' },
        { id: 'daily', x: x, y: card_y2, w: card_w, h: card_h, icon: '🔥', label: 'Thử Thách', sub: 'Bài tập hằng ngày', bg: YELLOW_BTN },
        { id: 'exam', x: x + card_w + gap, y: card_y2, w: card_w, h: card_h, icon: '📝', label: 'Thi Chuyển Lớp', sub: 'Kiểm tra tổng hợp', bg: [180, 130, 200], locked: 'M10' },
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
          this.examMsg = c.label + ' sẽ mở ở ' + c.locked + ' 🔒';
          this.examMsgTimer = 2.5;
          L.info('[Menu] locked card:', c.id, '→', c.locked);
          return;
        }
        if (c.id === 'lesson') {
          global.Game.states.change('lesson_select', { grade: getPlayer().grade }, 'fade');
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
          global.Game.states.change('gacha', null, 'fade');
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
      R.clear('#192341');
      R.fillRoundRect(0, 0, W2, H2, 0, 'rgba(25,35,65,1)', null, 0);
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
        this.currentPage += 1;
        L.info('[LessonSelect] page', this.currentPage + 1, '/', this.totalPages);
        return;
      }
      if (hit(click, this.prevBtn.x, this.prevBtn.y, this.prevBtn.w, this.prevBtn.h)
          && this.currentPage > 0) {
        this.currentPage -= 1;
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
          if (label.length > 29) label = label.slice(0, 26) + '...';
          if (!unlocked) label = '🔒 ' + label;
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
    }

    // Grid 2x2 như Python main.py:1484-1488 (btn_w=220, gap 240/110)
    _buildOptionButtons() {
      const self = this;
      const w = 220, h = 90, gapX = 240, gapY = 110;
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
        this.gm.onWrong();
        this.comboStreak = 0;
        this.wrongAnswers.push({
          question: this.q,
          userAnswer: String(opt.value),
          correctAnswer: String(this.ans),
          operation: this.op || 'unknown',
          lesson: this.title
        });
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
      }
    }

    update(dt) {
      this.time += dt;
      if (this.cardScale < 1) this.cardScale = Math.min(1, this.cardScale + dt * 5);
    }

    draw(ctx, W2, H2) {
      const R = global.Game.renderer;
      R.clear('#1e2840');
      // Top bar (Python draw_top_bar + title)
      R.text('MathDrill 5.0', W2 / 2, 40, {
        font: 'bold 30px Quicksand, sans-serif', fill: '#dbe6ff', align: 'center', baseline: 'middle'
      });
      R.text(this.title, 100, 40, {
        font: '18px Quicksand, sans-serif', fill: '#9ab6ff', baseline: 'middle'
      });
      // Progress "Câu X/15" (Python draw_progress_bar main.py:1642)
      this._progress(R, W2 / 2 - 250, 150, 500, 24, this.cc, this.tc,
        'Câu ' + Math.min(this.cc + 1, this.tc) + '/' + this.tc);
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
        const cw = 800, ch = 200;
        const sc = Math.max(0.2, this.cardScale);
        const dw = cw * sc, dh = ch * sc;
        const qx = W2 / 2 - dw / 2, qy = 270 + (ch - dh) / 2;
        R.fillRoundRect(qx + 5, qy + 8, dw, dh, 24, 'rgba(0,0,0,0.25)', null, 0);
        R.fillRoundRect(qx, qy, dw, dh, 24, '#ffffff', 'rgb(80,150,255)', 5);
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
      const page = pages.find(p => p.t === this.title);
      this.content = page ? page.c : 'Nội dung đang được cập nhật...';
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
      if (this._rbBook) this._rbBook.draw(R);
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
        L.info('[Victory] Xem lỗi — ReviewState sẽ port ở M8');
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
      R.clear('#1e5030');
      R.fillRoundRect(0, 0, W2, H2, 0, 'rgba(30,80,45,1)', null, 0);
      // Desktop main.py:1163 — clover layer is drawn before the victory UI.
      drawClover(R, this.cloverEffect);
      R.text('🏆 HOÀN THÀNH BÀI HỌC 🏆', W2 / 2, 140, {
        font: 'bold 48px Quicksand, sans-serif', fill: '#d7f7df', align: 'center', baseline: 'middle'
      });
      if (!this.showUi) return;
      const pw = 600, ph = 340, px = W2 / 2 - pw / 2, py = H2 / 2 - 80;
      R.fillRoundRect(px, py, pw, ph, 26, 'rgba(255,255,255,0.93)', 'rgb(200,170,80)', 5);
      R.text(this.rank, px + pw - 110, py + 50, {
        font: 'bold 90px Quicksand, sans-serif',
        fill: this.rank === 'S' ? 'rgb(200,170,80)' : '#c7ccd4',
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
        // Python main.py:1028-1030: retry → LessonState(lesson_title)
        global.Game.states.change('lesson', {
          grade: getPlayer().grade,
          title: this.lessonTitle || 'Bài 1',
          lessonId: this.lessonId || undefined
        }, 'fade');
      } else if (hit(click, this.homeBtn.x, this.homeBtn.y, this.homeBtn.w, this.homeBtn.h)) {
        global.Game.states.change('menu', null, 'fade');
      } else if (hit(click, this.reviewBtn.x, this.reviewBtn.y, this.reviewBtn.w, this.reviewBtn.h)) {
        L.info('[Defeat] Xem lỗi — ReviewState sẽ port ở M8');
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
      R.clear('#1e2337');
      R.fillRoundRect(0, 0, W2, H2, 0, 'rgba(30,35,55,1)', null, 0);
      // Desktop main.py:1051 — clover layer sits after the dark overlay and
      // before the panel/UI.
      drawClover(R, this.cloverEffect);
      R.text('CỐ LÊN NÀO! 💪', W2 / 2, 140, {
        font: 'bold 40px Quicksand, sans-serif', fill: '#ffd9a0', align: 'center', baseline: 'middle'
      });
      if (!this.showUi) return;
      const pw = 600, ph = 380, px = W2 / 2 - pw / 2, py = H2 / 2 - 150;
      R.fillRoundRect(px, py, pw, ph, 24, 'rgba(45,48,68,0.95)', 'rgb(255,180,90)', 4);
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
      this.backBtn = { x: 40, y: 700, w: 180, h: 55 };
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
      R.text('CỬA HÀNG SIÊU CẤP', W2 / 2, 60, {
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
    constructor() {
      super('achievement');
      this.backBtn = { x: 40, y: 700, w: 180, h: 55 };
      this.dataMissing = true;
      this.rows = [];
    }
    enter(params) {
      this.dataMissing = true;
      this.rows = [];
      const d = m9AccountData();
      if (!d) { this.dataMissing = true; return; }
      m9EnsureDst(d);
      const self = this;
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
    _buildRows() {
      this.rows = [];
      const keys = Object.keys(this.definitions || {});
      const cols = 2, bw = 480, bh = 80, gap = 22, x0 = 120, y0 = 160;
      for (let i = 0; i < keys.length && i < 24; i++) {
        const row = Math.floor(i / cols), col = i % cols;
        this.rows.push({ id: keys[i], def: this.definitions[keys[i]],
          x: x0 + col * (bw + gap), y: y0 + row * (bh + gap), w: bw, h: bh });
      }
    }
    exit() { this.rows = []; }
    handleInput(input, dt) {
      const click = input.consumeClick ? input.consumeClick() : null;
      if (!click) return;
      if (hit(click, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h)) {
        global.Game.states.change('menu', null, 'fade');
      }
    }
    update(dt) {}
    draw(ctx, W2, H2) {
      const R = global.Game.renderer;
      R.clear('#a5d6a7');
      R.text('🏆 THÀNH TÍCH', W2 / 2, 60, {
        font: 'bold 38px Quicksand, sans-serif', fill: '#c9a227', align: 'center', baseline: 'middle'
      });
      const got = this.unlocked ? this.unlocked.length : 0;
      const total = this.definitions ? Object.keys(this.definitions).length : 0;
      R.text('Đã đạt: ' + got + '/' + total, W2 / 2, 110, {
        font: '22px Quicksand, sans-serif', fill: '#20242e', align: 'center', baseline: 'middle'
      });
      if (this.dataMissing) {
        R.text('Đang tải thành tích...', W2 / 2, H2 / 2, {
          font: 'bold 24px Quicksand, sans-serif', fill: '#6b4f00', align: 'center', baseline: 'middle'
        });
      }
      for (let i = 0; i < this.rows.length && i < 12; i++) {
        const r = this.rows[i];
        const isUn = (this.unlocked || []).indexOf(r.id) >= 0;
        const color = isUn ? GREEN_BTN : SHADOW;
        R.fillRoundRect(r.x, r.y, r.w, r.h, 12, css(color), isUn ? 'rgb(255,215,0)' : '#ffffff', isUn ? 3 : 2);
        R.text(r.def.icon || '🏆', r.x + 36, r.y + r.h / 2, {
          font: '26px Quicksand, sans-serif', fill: '#ffffff', align: 'center', baseline: 'middle'
        });
        R.text((isUn ? '✓ ' : '🔒 ') + String(r.def.name || r.id).slice(0, 22), r.x + 72, r.y + 24, {
          font: 'bold 17px Quicksand, sans-serif', fill: '#ffffff', baseline: 'middle'
        });
        R.text(String(r.def.desc || '').slice(0, 44), r.x + 72, r.y + 46, {
          font: '13px Quicksand, sans-serif', fill: 'rgba(255,255,255,0.85)', baseline: 'middle'
        });
        if (r.def.xp) R.text('+' + r.def.xp + ' XP', r.x + r.w - 16, r.y + r.h - 18, {
          font: 'bold 14px Quicksand, sans-serif', fill: '#ffe9a0', align: 'right', baseline: 'middle'
        });
      }
      drawBtn(R, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h, '⬅️ QUAY LẠI', RED_BTN, { fontSize: 16 });
    }
  }

  /* M10-B STATE: DAILY (game_init.py:3637-3668 claim_daily_reward) */
  class DailyState extends BaseState {
    constructor() {
      super('daily');
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
      this.backBtn = { x: 40, y: 700, w: 180, h: 55 };
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
      R.text('🌳 CÂY KỸ NĂNG', W2 / 2, 60, {
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
  class BagState extends BaseState {
    constructor() {
      super('bag');
      this.backBtn = { x: 40, y: 700, w: 180, h: 55 };
      this.dataMissing = true;
      this.cards = [];
    }
    enter(params) {
      this.cards = [];
      const d = m9AccountData();
      if (!d) { this.dataMissing = true; return; }
      m9EnsureDst(d);
      this.inventory = d.inventory || [];
      this.bag = d.bag || {};
      this.dataMissing = false;
    }
    exit() { this.cards = []; }
    handleInput(input, dt) {
      const click = input.consumeClick ? input.consumeClick() : null;
      if (!click) return;
      if (hit(click, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h)) {
        global.Game.states.change('menu', null, 'fade');
      }
    }
    update(dt) {}
    draw(ctx, W2, H2) {
      const R = global.Game.renderer;
      R.clear('#a5d6a7');
      R.text('🎒 TÚI ĐỒ ・ BAG', W2 / 2, 60, {
        font: 'bold 38px Quicksand, sans-serif', fill: '#20242e', align: 'center', baseline: 'middle'
      });
      const inv = this.inventory || [];
      R.text('Thẻ thu thập: ' + inv.length, W2 / 2, 120, {
        font: '22px Quicksand, sans-serif', fill: '#20242e', align: 'center', baseline: 'middle'
      });
      for (let i = 0; i < inv.length && i < 42; i++) {
        const row = Math.floor(i / 6), col = i % 6;
        drawBtn(R, 90 + col * 200, 160 + row * 78, 180, 64, String(inv[i]).slice(0, 18), PURPLE_BTN, { fontSize: 12 });
      }
      if (!inv.length) {
        R.text('(Trống — kéo thẻ gacha để thu thập thẻ)', W2 / 2, H2 / 2 + 40, {
          font: '20px Quicksand, sans-serif', fill: '#6b4f00', align: 'center', baseline: 'middle'
        });
      }
      drawBtn(R, this.backBtn.x, this.backBtn.y, this.backBtn.w, this.backBtn.h, '⬅️ QUAY LẠI', RED_BTN, { fontSize: 16 });
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
        ['💰 Gold', String(d.gold !== undefined ? d.gold : (P.gold !== undefined ? P.gold : 0))],
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
  global.SkillTreeState = SkillTreeState;
  global.BagState = BagState;
  global.ProfileState = ProfileState;
  global.SkillMapState = SkillMapState;
  global.AdminPanelState = AdminPanelState;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      LoadingState: LoadingState,
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
  function _bookDrawBase(state, drawFn) {
    var book = state._rbBook;
    var R = _renderer();
    if (!book || typeof book.draw !== 'function' || !R || typeof R.clear !== 'function') {
      if (drawFn) drawFn();
      return;
    }
    var origClear = R.clear;
    var painted = false;
    var paint = function () {
      if (painted) return;
      painted = true;
      try { book.draw(R); } catch (e) { /* never break draw */ }
    };
    R.clear = function () {
      var out = origClear.apply(R, arguments);
      paint();
      return out;
    };
    try {
      if (drawFn) drawFn();
      else paint();
    } finally {
      R.clear = origClear;
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
      /* The state's own draw must run INSIDE _bookDrawBase so the Renderer.clear
         hook is still installed while it runs. Calling _bookDrawBase(this) with no
         callback painted the chrome first and restored R.clear before the state
         drew, so the state's own clear erased it again — the P1 book chrome was
         invisible on every screen that used this wrapper. */
      var self = this, args = arguments;
      _bookDrawBase(this, function () { if (mDraw) mDraw.apply(self, args); });
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
    var lUpdate = LessonSelectState.prototype.update;
    LessonSelectState.prototype.update = function (dt) {
      if (this._rbBook && typeof this._rbBook.update === 'function') {
        try { this._rbBook.update(dt); } catch (e) { /* no-op */ }
      }
      if (lUpdate) lUpdate.apply(this, arguments);
    };
  }

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
