(function (global) {
  'use strict';

  const L = global.GameLogger || { info: function () {}, warn: function () {}, error: function () {} };

  const STATE = {
    pointer: { x: 0, y: 0, down: false, buttons: 0, inside: false },
    wheel: { deltaX: 0, deltaY: 0, consumed: 0, _pending: null },
    keys: Object.create(null),
    _keyQueue: []
  };

  class InputManager {
    constructor(canvas) {
      if (InputManager._singleton) {
        L.warn('[InputManager] Singleton already constructed. Reusing existing instance.');
        return InputManager._singleton;
      }
      if (!canvas) throw new Error('[InputManager] canvas argument required');
      InputManager._singleton = this;

      this.canvas = canvas;
      const logicalW = (global.GameEngine && GameEngine.LOGICAL_WIDTH) || 1300;
      const logicalH = (global.GameEngine && GameEngine.LOGICAL_HEIGHT) || 800;
      this.logicalW = logicalW;
      this.logicalH = logicalH;

      this._boundOnPointerMove = this._onPointerMove.bind(this);
      this._boundOnPointerDown = this._onPointerDown.bind(this);
      this._boundOnPointerUp = this._onPointerUp.bind(this);
      this._boundOnPointerLeave = this._onPointerLeave.bind(this);
      this._boundOnWheel = this._onWheel.bind(this);
      this._boundOnKeyDown = this._onKeyDown.bind(this);
      this._boundOnKeyUp = this._onKeyUp.bind(this);

      canvas.addEventListener('pointermove', this._boundOnPointerMove, { passive: true });
      canvas.addEventListener('pointerdown', this._boundOnPointerDown, { passive: true });
      canvas.addEventListener('pointerleave', this._boundOnPointerLeave, { passive: true });
      canvas.addEventListener('wheel', this._boundOnWheel, { passive: false });
      if (typeof window !== 'undefined') {
        window.addEventListener('pointerup', this._boundOnPointerUp, { passive: true });
        window.addEventListener('keydown', this._boundOnKeyDown, { passive: true });
        window.addEventListener('keyup', this._boundOnKeyUp, { passive: true });
      }

      try { canvas.style.touchAction = 'none'; } catch (_) {}

      L.info('[InputManager] Attached to canvas ' + this.logicalW + 'x' + this.logicalH +
             ' (logical). clientToCanvas transform uses getBoundingClientRect().');
    }

    static get(canvas) {
      if (InputManager._singleton) return InputManager._singleton;
      if (!canvas) throw new Error('[InputManager.get] First call requires canvas argument');
      return new InputManager(canvas);
    }

    setLogicalSize(w, h) {
      if (w > 0 && h > 0) {
        this.logicalW = w;
        this.logicalH = h;
      }
    }

    clientToCanvas(ev) {
      const rect = this.canvas.getBoundingClientRect();
      const W = this.logicalW;
      const H = this.logicalH;
      const cX = (typeof ev.clientX === 'number') ? ev.clientX : (rect.left + rect.width / 2);
      const cY = (typeof ev.clientY === 'number') ? ev.clientY : (rect.top + rect.height / 2);
      const rx = rect.width > 0 ? W / rect.width : 1;
      const ry = rect.height > 0 ? H / rect.height : 1;
      let x = (cX - rect.left) * rx;
      let y = (cY - rect.top) * ry;
      if (x < 0) x = 0; else if (x > W) x = W;
      if (y < 0) y = 0; else if (y > H) y = H;
      return { x: x, y: y, rect: rect, scaleX: rx, scaleY: ry };
    }

    getPointerPosition() {
      return { x: STATE.pointer.x, y: STATE.pointer.y, down: STATE.pointer.down, inside: STATE.pointer.inside, buttons: STATE.pointer.buttons };
    }

    isDown(code) {
      if (!code) return false;
      return !!STATE.keys[code] ||
             (code.length === 1 && !!STATE.keys[code.toLowerCase()]) ||
             (code.length === 1 && !!STATE.keys[code.toUpperCase()]);
    }

    consumePressedKey() {
      return STATE._keyQueue.length > 0 ? STATE._keyQueue.shift() : null;
    }

    consumeClick() {
      const c = STATE.pointer._clickPending;
      if (c) {
        STATE.pointer._clickPending = null;
        return c;
      }
      return null;
    }

    consumeWheel() {
      const w = STATE.wheel._pending;
      if (w) {
        STATE.wheel._pending = null;
        return w;
      }
      return null;
    }

    pointerInRect(rect) {
      if (!rect) return false;
      const x0 = rect.x || rect.left || 0;
      const y0 = rect.y || rect.top || 0;
      const x1 = x0 + (typeof rect.width === 'number' ? rect.width : (rect.right - x0));
      const y1 = y0 + (typeof rect.height === 'number' ? rect.height : (rect.bottom - y0));
      const p = STATE.pointer;
      return p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
    }

    _updateFromEvent(ev) {
      const r = this.clientToCanvas(ev);
      STATE.pointer.x = r.x;
      STATE.pointer.y = r.y;
    }

    _onPointerMove(ev) {
      STATE.pointer.inside = true;
      this._updateFromEvent(ev);
      STATE.pointer.buttons = (typeof ev.buttons === 'number') ? ev.buttons : STATE.pointer.buttons;
    }

    _onPointerDown(ev) {
      STATE.pointer.inside = true;
      this._updateFromEvent(ev);
      STATE.pointer.down = true;
      STATE.pointer.buttons = (typeof ev.buttons === 'number') ? ev.buttons : 1;
      STATE.pointer._clickPending = {
        x: STATE.pointer.x,
        y: STATE.pointer.y,
        button: (typeof ev.button === 'number') ? ev.button : 0,
        buttons: STATE.pointer.buttons,
        time: performance.now()
      };
      L.info('[Input] pointerdown at (' + STATE.pointer.x.toFixed(0) + ',' + STATE.pointer.y.toFixed(0) + ') button=' + (STATE.pointer._clickPending.button));
    }

    _onPointerUp(ev) {
      STATE.pointer.down = false;
      STATE.pointer.buttons = (typeof ev.buttons === 'number') ? ev.buttons : 0;
    }

    _onPointerLeave(ev) {
      STATE.pointer.inside = false;
      STATE.pointer.down = false;
      if (ev) this._updateFromEvent(ev);
    }

    _onWheel(ev) {
      if (ev.preventDefault) { try { ev.preventDefault(); } catch (_) {} }
      const dx = ev.deltaX || 0;
      const dy = ev.deltaY || 0;
      STATE.wheel.deltaX += dx;
      STATE.wheel.deltaY += dy;
      STATE.wheel._pending = { deltaX: dx, deltaY: dy, totalDeltaX: STATE.wheel.deltaX, totalDeltaY: STATE.wheel.deltaY, time: performance.now() };
      this._updateFromEvent(ev);
    }

    _onKeyDown(ev) {
      const k = ev.key;
      const code = ev.code || k;
      STATE.keys[k] = true;
      if (code) STATE.keys['__code__:' + code] = true;
      STATE._keyQueue.push({ key: k, code: code, time: performance.now(), repeat: !!ev.repeat });
      STATE._lastKeyDisplay = k === ' ' ? 'Space' : (k && k.length === 1 ? k : (String(k).length > 12 ? k.slice(0, 12) : k));
      STATE._keyFlash = 0.6;
      L.info('[Input] keydown =', k, '(Keyboard: OK)');
    }

    _onKeyUp(ev) {
      const k = ev.key;
      const code = ev.code || k;
      STATE.keys[k] = false;
      if (code) STATE.keys['__code__:' + code] = false;
    }
  }

  Object.defineProperty(InputManager.prototype, 'lastKeyDisplay', {
    get: function () { return STATE._lastKeyDisplay || '—'; },
    configurable: true
  });
  Object.defineProperty(InputManager.prototype, 'keyFlash', {
    get: function () { return STATE._keyFlash || 0; },
    set: function (v) { STATE._keyFlash = v < 0 ? 0 : v; },
    configurable: true
  });

  global.InputManager = InputManager;

  if (typeof module !== 'undefined' && module.exports) module.exports = InputManager;
})(typeof window !== 'undefined' ? window : globalThis);
