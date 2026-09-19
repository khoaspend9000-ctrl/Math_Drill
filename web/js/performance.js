/* =========================================================
   MathDrill Web — M8-A: PERFORMANCE (port từ performance_utils.py)
   --------------------------------------------------------
   - GLOBAL_MAX_PARTICLES = 200 (performance_utils.py:5)
   - ParticleBudget: global cap cho confetti + effects
   - SurfaceCache: cache surfaces tránh rebuild mỗi frame
   ========================================================= */
(function (global) {
  'use strict';

  const GLOBAL_MAX_PARTICLES = 200;

  class ParticleBudget {
    constructor() {
      this._count = 0;
    }

    available() {
      return Math.max(0, GLOBAL_MAX_PARTICLES - this._count);
    }

    request(wanted) {
      const granted = Math.min(wanted, this.available());
      this._count += granted;
      return granted;
    }

    release(n) {
      this._count = Math.max(0, this._count - (n || 1));
    }

    reset() {
      this._count = 0;
    }

    get count() {
      return this._count;
    }

    get cap() {
      return GLOBAL_MAX_PARTICLES;
    }
  }

  class SurfaceCache {
    constructor(maxEntries) {
      this._cache = {};
      this._max = maxEntries || 128;
    }

    get(key, factory) {
      if (this._cache[key] !== undefined) {
        return this._cache[key];
      }
      const surf = factory();
      if (Object.keys(this._cache).length >= this._max) {
        const firstKey = Object.keys(this._cache)[0];
        delete this._cache[firstKey];
      }
      this._cache[key] = surf;
      return surf;
    }

    clear() {
      this._cache = {};
    }

    get size() {
      return Object.keys(this._cache).length;
    }
  }

  const particleBudget = new ParticleBudget();

  global.GLOBAL_MAX_PARTICLES = GLOBAL_MAX_PARTICLES;
  global.ParticleBudget = ParticleBudget;
  global.SurfaceCache = SurfaceCache;
  global.particleBudget = particleBudget;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      GLOBAL_MAX_PARTICLES: GLOBAL_MAX_PARTICLES,
      ParticleBudget: ParticleBudget,
      SurfaceCache: SurfaceCache,
      particleBudget: particleBudget
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
