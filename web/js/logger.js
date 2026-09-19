(function (global) {
  'use strict';

  const PRODUCTION = false;

  const noop = function () {};

  function formatArgs(args) {
    return Array.prototype.slice.call(args);
  }

  const logger = {
    log: PRODUCTION ? noop : function () { console.log.apply(console, formatArgs(arguments)); },
    info: PRODUCTION ? noop : function () { console.info.apply(console, formatArgs(arguments)); },
    warn: function () { console.warn.apply(console, formatArgs(arguments)); },
    error: function () { console.error.apply(console, formatArgs(arguments)); },

    perf: function (label, fn) {
      if (PRODUCTION) return fn();
      const t0 = performance.now();
      try { return fn(); }
      finally {
        const dt = performance.now() - t0;
        console.log('[PERF] ' + label + ' = ' + dt.toFixed(3) + 'ms');
      }
    }
  };

  global.GameLogger = logger;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = logger;
  }
})(typeof window !== 'undefined' ? window : globalThis);
