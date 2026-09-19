(function (global) {
  'use strict';

  const L = global.GameLogger || { info: function () {}, warn: function () {}, error: function () {} };
  const BaseState = global.BaseState;

  const PRELOAD_IMAGES = [
    { name: 'nen_game', url: 'assets/nen_game.png' },
    { name: 'pixel_clover', url: 'assets/pixel_clover.png' },
    { name: 'favicon', url: 'assets/favicon.png' }
  ];

  class LoadingState extends BaseState {
    constructor() {
      super('loading');
      this.elapsed = 0;
      this.minTime = 1.2;
      this.ready = false;
      this.leaving = false;
      this.report = { total: 0, loaded: 0, failed: 0 };
      this.status = 'Đang tải nền tảng Web…';
      this._started = false;
    }

    enter() {
      this.elapsed = 0;
      this.ready = false;
      this.leaving = false;
      this.status = 'Đang tải font, ảnh và âm thanh…';
      this._started = true;
      const G = global.Game;
      const self = this;
      const assets = G.assets;
      const audio = G.audio;

      Promise.all([
        assets.loadFonts(),
        assets.preload(PRELOAD_IMAGES),
        audio.loadSfx('correct', 'tra_loi_dung.ogg')
      ]).then(function (results) {
        self.report = results[1] || self.report;
        self.ready = true;
        self.status = 'Tải xong — chuẩn bị vào màn hình nền tảng';
        L.info('[Loading] Assets ready', self.report, 'fonts', assets.fonts);
      }).catch(function (err) {
        L.error('[Loading] Preload failed', err);
        self.ready = true;
        self.status = 'Một phần tài nguyên lỗi — vẫn tiếp tục';
      });
    }

    update(dt) {
      this.elapsed += dt;
      if (this.ready && this.elapsed >= this.minTime && !this.leaving) {
        this.leaving = true;
        global.Game.states.change('menu', { report: this.report }, 'fade');
      }
    }

    draw(ctx, W, H) {
      const R = global.Game.renderer;
      R.clear('#0b1020');
      const bg = global.Game.assets.get('nen_game');
      if (bg && !bg.placeholder) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        R.image(bg, 0, 0, W, H);
        ctx.restore();
      }

      R.text('MATHDRILL', W / 2, 220, {
        font: 'bold 72px Quicksand, Segoe UI, sans-serif',
        fill: '#e0ecff',
        align: 'center',
        baseline: 'middle',
        shadowColor: 'rgba(96, 165, 250, 0.55)',
        shadowBlur: 18
      });
      R.text('Phase 1 — Web Foundation', W / 2, 290, {
        font: '22px Quicksand, sans-serif',
        fill: '#8aa5d9',
        align: 'center',
        baseline: 'middle'
      });
      R.text(this.status, W / 2, 420, {
        font: '24px Quicksand, sans-serif',
        fill: '#c8d8ff',
        align: 'center',
        baseline: 'middle'
      });

      const barW = 480;
      const barH = 14;
      const bx = (W - barW) / 2;
      const by = 470;
      const p = this.ready ? 1 : Math.min(0.95, this.elapsed / this.minTime);
      R.fillRoundRect(bx, by, barW, barH, 7, 'rgba(30, 40, 80, 0.9)', 'rgba(120,150,220,0.4)', 1);
      R.fillRoundRect(bx, by, barW * p, barH, 7, '#60a5fa', null, 0);
    }
  }

  class MenuState extends BaseState {
    constructor() {
      super('menu');
      this.time = 0;
      this.lastClick = '—';
      this.audioNote = 'Click hoặc nhấn phím để mở khóa audio';
    }

    enter() {
      this.time = 0;
    }

    handleInput(input, dt) {
      const click = input.consumeClick();
      if (click) {
        this.lastClick = click.x.toFixed(0) + ', ' + click.y.toFixed(0);
        const audio = global.Game.audio;
        audio.unlock();
        const played = audio.playSfx('correct');
        this.audioNote = played ? 'SFX đúng câu trả lời đã phát' : (audio.unlocked ? 'Audio đã unlock (chưa có buffer SFX)' : 'Audio chưa unlock');
      }
      const key = input.consumePressedKey();
      if (key) {
        global.Game.audio.unlock();
      }
    }

    update(dt) {
      this.time += dt;
      if (global.Game.input && global.Game.input.keyFlash > 0) {
        global.Game.input.keyFlash = Math.max(0, global.Game.input.keyFlash - dt);
      }
    }

    draw(ctx, W, H) {
      const R = global.Game.renderer;
      const engine = global.Game.engine;
      const input = global.Game.input;
      const assets = global.Game.assets;
      const audio = global.Game.audio;

      R.clear('#0b1020');
      const bg = assets.get('nen_game');
      if (bg) {
        ctx.save();
        ctx.globalAlpha = bg.placeholder ? 0 : 0.28;
        if (!bg.placeholder) R.image(bg, 0, 0, W, H);
        ctx.restore();
      }

      R.text('MATHDRILL', W / 2, 90, {
        font: 'bold 70px Quicksand, Segoe UI, sans-serif',
        fill: '#e0ecff',
        align: 'center',
        baseline: 'middle',
        shadowColor: 'rgba(96, 165, 250, 0.5)',
        shadowBlur: 16
      });
      R.text('Web Foundation sẵn sàng  ·  chưa vào gameplay', W / 2, 148, {
        font: '20px Quicksand, sans-serif',
        fill: '#8aa5d9',
        align: 'center',
        baseline: 'middle'
      });

      const clover = assets.get('pixel_clover');
      if (clover) R.image(clover, W / 2 - 40, 180, 80, 80);

      R.text('🍀 font emoji', W / 2 + 90, 220, {
        font: '22px "Segoe UI Emoji", "Apple Color Emoji", sans-serif',
        fill: '#dbe6ff',
        align: 'left',
        baseline: 'middle'
      });

      const mp = input.getPointerPosition();
      const fpsColor = engine.fps >= 55 ? '#4ade80' : engine.fps >= 45 ? '#facc15' : '#f87171';

      R.fillRoundRect(60, 290, 560, 430, 16, 'rgba(18, 26, 58, 0.78)', 'rgba(120,150,220,0.35)', 2);
      R.text('Foundation checklist', 88, 328, { font: 'bold 26px Quicksand, sans-serif', fill: '#e2eaff' });

      const rows = [
        ['Canvas', '1300 × 800 letterbox + DPR'],
        ['Loop', '~' + String(engine.fps) + ' FPS  ·  dt capped'],
        ['Input', 'Mouse ' + mp.x.toFixed(0) + ',' + mp.y.toFixed(0) + (mp.down ? ' DOWN' : '')],
        ['Keyboard', input.keyFlash > 0 ? ('OK — ' + input.lastKeyDisplay) : 'OK (nhấn phím)'],
        ['Click', this.lastClick],
        ['Assets', assets.failed.size === 0 ? '3/3 ảnh OK' : ('placeholder: ' + assets.failed.size)],
        ['Fonts', (assets.fonts.quicksand ? 'Quicksand' : 'fallback') + ' / ' + (assets.fonts.emoji ? 'Emoji' : 'system')],
        ['Audio', audio.unlocked ? 'unlocked' : 'locked until gesture']
      ];
      for (let i = 0; i < rows.length; i++) {
        R.text(rows[i][0], 88, 372 + i * 38, { font: '20px Quicksand, sans-serif', fill: '#8ea4d6' });
        R.text(rows[i][1], 240, 372 + i * 38, { font: '20px Quicksand, sans-serif', fill: i === 1 ? fpsColor : '#dbe6ff' });
      }

      R.fillRoundRect(680, 290, 560, 430, 16, 'rgba(22, 34, 70, 0.72)', 'rgba(150,120,255,0.35)', 2);
      R.text('Phase 1 scope', 708, 328, { font: 'bold 26px Quicksand, sans-serif', fill: '#e9e2ff' });
      const notes = [
        'Entry point + game container',
        'requestAnimationFrame + delta time',
        'Mouse / keyboard / pointer',
        'State: Loading → Menu (fade 0.5s)',
        'Renderer + asset + font + audio',
        'Lỗi runtime hiện overlay, không nuốt',
        'Chưa load 81 bài / question generator',
        'Click canvas để thử SFX (sau unlock)'
      ];
      for (let i = 0; i < notes.length; i++) {
        R.text('•  ' + notes[i], 708, 378 + i * 36, { font: '18px Quicksand, sans-serif', fill: '#c8d8ff' });
      }

      R.text(this.audioNote, W / 2, 760, {
        font: '18px Quicksand, sans-serif',
        fill: '#9ab6ff',
        align: 'center',
        baseline: 'middle'
      });
    }
  }

  global.LoadingState = LoadingState;
  global.MenuState = MenuState;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LoadingState: LoadingState, MenuState: MenuState };
  }
})(typeof window !== 'undefined' ? window : globalThis);
