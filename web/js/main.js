(function () {
  'use strict';

  const L = window.GameLogger;
  const Engine = window.GameEngine;
  const Input = window.InputManager;
  const Renderer = window.GameRenderer;
  const Assets = window.AssetManager;
  const Audio = window.SoundManager;
  const States = window.StateManager;
  const Errors = window.GameErrors;
  // M5 — Player + Save + Auth
  const Save = window.Save;
  const PlayerData = window.PlayerData;
  const AccountSystem = window.AccountSystem;
  // M10-A — M6/M7 services are browser-loaded (index.html script tags)
  const DataLoader = window.DataLoader;
  const QuestionGenerator = window.QuestionGenerator;
  // M4 — real game states (states_real.js)
  const LoadingState = window.LoadingState;
  const LoginState = window.LoginState;
  const RegisterState = window.RegisterState; // M11 Desktop parity
  const MenuState = window.MenuState;
  const LessonSelectState = window.LessonSelectState;
  const LessonState = window.LessonState;
  const VictoryState = window.VictoryState;
  const DefeatState = window.DefeatState;
  // M10-B — real M9 states (states_real.js)
  const ShopState = window.ShopState;
  const PetState = window.PetState;
  const SkinState = window.SkinState;
  const GachaState = window.GachaState;
  const AchievementState = window.AchievementState;
  const DailyState = window.DailyState;
  const SkillTreeState = window.SkillTreeState;
  const BagState = window.BagState;
  const AdminPanelState = window.AdminPanelState; // M10-D
  const SettingsState = window.SettingsState; // M13 Desktop-parity settings
  const PasswordChangeState = window.PasswordChangeState; // M13

  window.Game = window.Game || {};

  function boot() {
    if (Errors) Errors.install();

    const canvas = document.getElementById('game');
    if (!canvas) {
      const err = new Error('[Main] Canvas #game not found');
      if (Errors) Errors.showFatal(err);
      else if (L) L.error(err.message);
      return;
    }

    try {
      const game = window.Game;
      game.input = new Input(canvas);
      game.engine = new Engine(canvas);
      game.input.setLogicalSize(game.engine.WIDTH, game.engine.HEIGHT);
      game.renderer = new Renderer(game.engine.ctx, game.engine.WIDTH, game.engine.HEIGHT);
      game.assets = new Assets();
      game.audio = new Audio('audio/');
      game.audio.attachUnlock(canvas);
      game.states = new States();

      // M10-A: M6 question stack + M7 data loader are now browser-loaded —
      // wire the real services (previously null placeholders).
      game.dataLoader = (DataLoader && typeof DataLoader.getLessonsForGrade === 'function')
        ? DataLoader : null;
      if (typeof QuestionGenerator === 'function') {
        const qg = new QuestionGenerator();
        // Adapter: LessonState contract {question, answer, options, op}
        // wraps verified M6 QuestionGenerator.generate_question() output
        // {question_text, correct_answer, options, hint, ...}.
        game.questionGen = {
          generate: function (grade, lessonId, diff, user) {
            try {
              /* P0 GUARD: `lesson_id` must be NUMERIC. It used to receive a lesson
                 TITLE string ("Bài 1"), which made the generators fall through to
                 their generic branch and emit `"Tính nhanh: Bài 1 - 1 = ?"` with
                 correct_answer "NaN" — one repeated, unanswerable question. Reject
                 non-numeric ids loudly instead of generating a broken question. */
              var lid = parseInt(lessonId, 10);
              if (!isFinite(lid) || lid <= 0) {
                if (L) L.error('[Main] questionGen: invalid numeric lesson_id:', JSON.stringify(lessonId));
                return null;
              }
              const q = qg.generate_question(grade, lid, diff, user);
              if (!q) return null;
              /* P0 GUARD: the generated answer must be one of the rendered options,
                 otherwise the player can never answer the question. */
              var opts = (q.options || []).map(String);
              var ans = String(q.correct_answer);
              if (!opts.length || opts.indexOf(ans) < 0) {
                if (L) L.error('[Main] questionGen: correct_answer not in options', {
                  q: q.question_text, ans: q.correct_answer, options: q.options
                });
                return null;
              }
              return {
                question: q.question_text,
                answer: q.correct_answer,
                options: q.options,
                op: null,
                hint: q.hint,
                difficulty: q.difficulty,
                question_type: q.question_type
              };
            } catch (err) {
              if (L) L.error('[Main] questionGen adapter error', err);
              return null;
            }
          }
        };
      } else {
        game.questionGen = null; // M6 stack missing — LessonState shows waiting panel
      }

      // M5: Save + PlayerData thật + AccountSystem (PBKDF2 localStorage)
      game.save = Save;
      game.auth = new AccountSystem();
      // Player snapshot: nếu có bản lưu từ phiên trước thì load (plan T12:
      // reload trang giữ nguyên dữ liệu); login thành công sẽ loadSaveData
      // từ account data (sync_player_stats).
      const savedPlayer = Save.load(Save.KEYS.PLAYER, null);
      const pd = new PlayerData();
      if (savedPlayer) {
        pd.loadSaveData(savedPlayer);
        L.info('[Main] M5 loaded saved player — level', pd.level, '| gold', pd.gold);
      }
      game.player = pd;

      game.states.register('loading', new LoadingState());
      game.states.register('login', new LoginState());
      if (typeof RegisterState === 'function') {
        game.states.register('register', new RegisterState());
      }
      game.states.register('menu', new MenuState());
      game.states.register('lesson_select', new LessonSelectState());
      game.states.register('theory', new TheoryState());
      game.states.register('lesson', new LessonState());
      game.states.register('victory', new VictoryState());
      game.states.register('defeat', new DefeatState());
      // M10-B — M9 systems accessible from Menu
      game.states.register('shop', new ShopState());
      game.states.register('pet', new PetState());
      game.states.register('skin', new SkinState());
      game.states.register('gacha', new GachaState());
      game.states.register('achievement', new AchievementState());
      game.states.register('daily', new DailyState());
      game.states.register('skill_tree', new SkillTreeState());
      game.states.register('bag', new BagState());
      game.states.register('profile', new ProfileState()); // POLISH M3
      game.states.register('skill_map', new SkillMapState()); // POLISH M3
      game.states.register('adminPanel', new AdminPanelState()); // M10-D
      game.states.register('settings', new SettingsState()); // M13
      game.states.register('passwordChange', new PasswordChangeState()); // M13
      game.states.change('loading');

      game.engine.setTick(function (dt, ctx, W, H) {
        game.renderer.setContext(ctx);
        game.renderer.setSize(W, H);
        game.states.handleInput(game.input, dt);
        game.states.update(dt);
        game.states.draw(ctx, W, H);
      });

      game.engine.start();

      if (L) {
        L.info('[Main] M5 boot OK. logical', game.engine.WIDTH, 'x', game.engine.HEIGHT, 'DPR', game.engine.dpr,
          '| states: loading, login, menu, lesson_select, lesson, victory, defeat',
          '| auth accounts:', Object.keys(game.auth.accounts).length);
      }
    } catch (err) {
      if (Errors) Errors.showFatal(err);
      else if (L) L.error('[Main] Boot failed', err);
      throw err;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
