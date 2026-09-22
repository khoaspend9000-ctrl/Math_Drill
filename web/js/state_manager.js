(function (global) {
  'use strict';

  const L = global.GameLogger || { info: function () {}, warn: function () {}, error: function () {} };
  const TransitionEffect = global.TransitionEffect;

  class BaseState {
    constructor(name) {
      this.name = name || 'state';
    }
    enter(params) {}
    exit() {}
    handleInput(input, dt) {}
    update(dt) {}
    draw(ctx, width, height) {}
  }

  class StateManager {
    constructor() {
      this.states = Object.create(null);
      this.current = null;
      this.currentName = null;
      this.transition = TransitionEffect ? new TransitionEffect('fade') : null;
      this._pendingName = null;
      this._pendingParams = null;
    }

    register(name, state) {
      if (!name || !state) throw new Error('[StateManager] register requires name and state');
      this.states[name] = state;
    }

    change(name, params, transitionType) {
      if (!this.states[name]) {
        /* synchronous throw (callers/tests rely on it — an async function would
           turn this into a rejected promise instead). */
        throw new Error('[StateManager] Unknown state: ' + name);
      }

      const useTransition = transitionType !== null && this.current && this.transition;
      if (!useTransition) {
        /* M10-QA2: the swap itself is SYNCHRONOUS again (current/currentName are
           updated before change() returns) — only an async enter() promise is
           handed back so callers that care can await the side-effects. Making
           _swap fully async deferred the swap by a microtask, which broke rapid
           change() calls and every "assert right after change()" test. */
        return this._swap(name, params);
      }

      this._pendingName = name;
      this._pendingParams = params;
      this.transition.effect_type = transitionType || 'fade';
      const self = this;
      this.transition.onMidpoint = function () {
        const pending = self._swap(self._pendingName, self._pendingParams);
        self._pendingName = null;
        self._pendingParams = null;
        return pending;
      };
      this.transition.start();
      L.info('[StateManager] Transition to', name);
      return Promise.resolve();
    }

    _swap(name, params) {
      if (this.current && typeof this.current.exit === 'function') {
        try { this.current.exit(); }
        catch (err) { L.error('[StateManager] exit error', err); }
      }
      this.current = this.states[name];
      let pendingEnter = null;
      if (this.current && typeof this.current.enter === 'function') {
        let result;
        try { result = this.current.enter(params || null); }
        catch (err) { L.error('[StateManager] enter error', err); }
        if (result && typeof result.then === 'function') {
          /* async enter() (e.g. syncPlayerToServer) — never block the swap and
             never leak an unhandled rejection. */
          pendingEnter = result.catch(function (err) {
            L.error('[StateManager] async enter error', err);
          });
        }
      }
      this.currentName = name;
      L.info('[StateManager] Now in', name);
      return pendingEnter || Promise.resolve();
    }

    handleInput(input, dt) {
      if (this.transition && this.transition.active) return;
      if (this.current && this.current.handleInput) this.current.handleInput(input, dt);
    }

    update(dt) {
      if (this.transition && this.transition.active) this.transition.update(dt);
      if (this.current && this.current.update) this.current.update(dt);
    }

    draw(ctx, width, height) {
      if (this.current && this.current.draw) this.current.draw(ctx, width, height);
      if (this.transition) this.transition.draw(ctx, width, height);
    }
  }

  global.BaseState = BaseState;
  global.StateManager = StateManager;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BaseState: BaseState, StateManager: StateManager };
  }
})(typeof window !== 'undefined' ? window : globalThis);
