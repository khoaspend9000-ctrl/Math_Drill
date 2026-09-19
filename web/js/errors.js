(function (global) {
  'use strict';

  const L = global.GameLogger || { error: function () { console.error.apply(console, arguments); } };

  function getOverlay() {
    return document.getElementById('fatal-error');
  }

  function showFatal(err) {
    const message = err && err.stack ? String(err.stack) : String(err);
    L.error('[Fatal]', message);
    const el = getOverlay();
    if (!el) return;
    const body = el.querySelector('.fatal-error-body');
    if (body) body.textContent = message;
    el.classList.add('visible');
    el.setAttribute('aria-hidden', 'false');
  }

  function hideFatal() {
    const el = getOverlay();
    if (!el) return;
    el.classList.remove('visible');
    el.setAttribute('aria-hidden', 'true');
  }

  function install() {
    if (global.__mathdrillErrorsInstalled) return;
    global.__mathdrillErrorsInstalled = true;

    global.addEventListener('error', function (ev) {
      showFatal(ev.error || ev.message || 'Unknown error');
    });

    global.addEventListener('unhandledrejection', function (ev) {
      showFatal(ev.reason || 'Unhandled promise rejection');
    });

    const retry = document.getElementById('fatal-error-retry');
    if (retry) {
      retry.addEventListener('click', function () {
        hideFatal();
        global.location.reload();
      });
    }
  }

  const api = { showFatal: showFatal, hideFatal: hideFatal, install: install };
  global.GameErrors = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
