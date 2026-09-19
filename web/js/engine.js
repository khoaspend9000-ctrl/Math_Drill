(function (global) {
  'use strict';

  const TARGET_FPS = 60;
  const FRAME_MIN_MS = 1000 / TARGET_FPS;
  const MAX_DT = 1 / 20;

  class Engine {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.WIDTH = canvas.width;
      this.HEIGHT = canvas.height;

      this.running = false;
      this.lastTimestamp = 0;
      this.accumulator = 0;

      this.fps = 0;
      this._fpsFrames = 0;
      this._fpsTimer = 0;

      this.dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
      this._applyDPR();

      this._rafId = 0;
      this._onTick = null;
      this._boundLoop = this._loop.bind(this);
      this._boundResize = this._onResize.bind(this);
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', this._boundResize);
      }
    }

    _onResize() {
      this.dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
      this._applyDPR();
    }

    _applyDPR() {
      const c = this.canvas;
      c.width = Math.round(this.WIDTH * this.dpr);
      c.height = Math.round(this.HEIGHT * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.ctx.imageSmoothingEnabled = true;
    }

    setTick(fn) {
      this._onTick = fn;
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.lastTimestamp = performance.now();
      this.accumulator = 0;
      this._fpsFrames = 0;
      this._fpsTimer = 0;
      this._rafId = requestAnimationFrame(this._boundLoop);
      if (global.GameLogger) GameLogger.info('[Engine] Started at target ' + TARGET_FPS + ' FPS (DPR=' + this.dpr + ')');
    }

    stop() {
      this.running = false;
      if (this._rafId) cancelAnimationFrame(this._rafId);
      this._rafId = 0;
      if (typeof window !== 'undefined' && this._boundResize) {
        window.removeEventListener('resize', this._boundResize);
      }
    }

    _loop(now) {
      if (!this.running) return;

      let frameMs = now - this.lastTimestamp;
      this.lastTimestamp = now;

      if (frameMs > 250) frameMs = 250;
      this.accumulator += frameMs;

      let steps = 0;
      while (this.accumulator >= FRAME_MIN_MS && steps < 5) {
        const dt = Math.min(FRAME_MIN_MS / 1000, MAX_DT);
        this._updateFps(dt);
        if (this._onTick) {
          try {
            this._onTick(dt, this.ctx, this.WIDTH, this.HEIGHT);
          } catch (e) {
            if (global.GameLogger) GameLogger.error('[Engine] Tick error', e);
            if (global.GameErrors) GameErrors.showFatal(e);
            this.stop();
            return;
          }
        }
        this.accumulator -= FRAME_MIN_MS;
        steps++;
      }

      this._rafId = requestAnimationFrame(this._boundLoop);
    }

    _updateFps(dt) {
      this._fpsFrames++;
      this._fpsTimer += dt;
      if (this._fpsTimer >= 0.5) {
        this.fps = Math.round(this._fpsFrames / this._fpsTimer);
        this._fpsFrames = 0;
        this._fpsTimer = 0;
      }
    }
  }

  Engine.TARGET_FPS = TARGET_FPS;
  Engine.MAX_DT = MAX_DT;
  Engine.LOGICAL_WIDTH = 1300;
  Engine.LOGICAL_HEIGHT = 800;

  global.GameEngine = Engine;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Engine;
  }
})(typeof window !== 'undefined' ? window : globalThis);
