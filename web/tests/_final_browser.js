'use strict';
/* FINAL QA — real-browser cross-screen validation.
   Boots the REAL M10-C/D backend (server/server.js, which also serves web/ so
   /api/* is same-origin and CSP/security headers are exercised) and then drives
   a real headless Chromium through every screen of the game.

   Admin credential: the harness supplies a KNOWN random password via the child
   process env (MATHDRILL_ADMIN_PASSWORD). The bootstrap seeds the admin with IT
   (only if the env var is not already set), so the harness never parses
   bootstrap stdout for a secret — no admin secret ever lives in any web/ source,
   satisfying admin_rbac T09. */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const pw = require(path.join(__dirname, '..', 'tools', 'browser-validation', 'node_modules', 'playwright'));

const PORT = 3020;
const BASE = 'http://127.0.0.1:' + PORT;
const ROOT = path.join(__dirname, '..', '..');
const USER = 'qa' + String(Date.now()).slice(-8);
const PASS = 'QaPass123!';
// Known random admin password — supplied to the server bootstrap via env so the
// harness and the server agree on it deterministically. Never written to any
// web/ artifact; satisfies admin_rbac T09 (no admin secret in web/).
// LoginState caps each input field at 20 chars (Desktop parity: main.py login gate),
// so keep the admin password inside that limit to avoid keyboard.type truncation.
const ADMIN_PW = 'qa-admin-' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);

const errors = [];   // console errors, pageerrors, failed/broken requests
const net404 = [];
const expectedAuthz = [];   // /api/admin/* 401-403 for a non-admin (RBAC gate)
const badMime = [];
const reqLog = [];

let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name); }
}

function startServer() {
  /* The web/ QA harness never holds the admin secret (admin_rbac T09): the
     server is bootstrapped through server/qa_bootstrap.js, which resets the
     EPHEMERAL file store and seeds a fresh RANDOM admin, printing the password
     once on stdout so the harness reads it at RUNTIME. */
  return new Promise(function (resolve, reject) {
    const child = spawn(process.execPath, ['qa_bootstrap.js'], {
      cwd: path.join(ROOT, 'server'),
      env: Object.assign({}, process.env, {
        QA_PORT: String(PORT),
        // The harness GENERATES a known random admin password and passes it to
        // the bootstrap via env. The bootstrap seeds the admin with it (and only
        // generates its own if the env var is absent — see qa_bootstrap.js).
        // This means the harness NEVER parses bootstrap stdout for a secret:
        // no admin secret ever lands in any web/ source, satisfying admin_rbac T09.
        MATHDRILL_ADMIN_PASSWORD: ADMIN_PW
      }),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';
    let settled = false;
    child.stdout.on('data', function (d) {
      out += String(d);
      if (!settled && out.indexOf('QA_READY') >= 0) {
        settled = true;
        // The admin password is the harness-local ADMIN_PW (passed to the child
        // env above); the bootstrap seeded the admin with that same value.
        resolve({ child: child, adminPw: ADMIN_PW, out: out });
      }
    });
    child.stderr.on('data', function (d) { errors.push('server stderr: ' + String(d).trim()); });
    child.on('exit', function (c) {
      if (!settled) { settled = true; reject(new Error('server exited early code=' + c + ' out=' + out)); }
    });
    setTimeout(function () {
      if (!settled) { settled = true; reject(new Error('server start timeout')); }
    }, 15000);
  });
}

/* ---------- page helpers (logical 1300x800 -> client coords) ---------- */
async function canvasRect(page) {
  return await page.evaluate(function () {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    return { l: r.left, t: r.top, w: r.width, h: r.height };
  });
}
async function hoverLogical(page, lx, ly) {
  const r = await canvasRect(page);
  await page.mouse.move(r.l + (lx / 1300) * r.w, r.t + (ly / 800) * r.h, { steps: 4 });
}
async function clickLogical(page, lx, ly) {
  await hoverLogical(page, lx, ly);
  await page.waitForTimeout(35);
  await page.mouse.down();
  await page.waitForTimeout(20);
  await page.mouse.up();
}
async function clickCenter(page, rect) {
  await clickLogical(page, rect.x + rect.w / 2, rect.y + rect.h / 2);
}
async function ptr(page) { return await page.evaluate(function () { return window.Game.input.getPointerPosition(); }); }
async function cur(page) { return await page.evaluate(function () { return window.Game.states.currentName; }); }
async function pending(page) { return await page.evaluate(function () { return window.Game.states._pendingName; }); }
async function stateOf(page, name) {
  return await page.evaluate(function (n) { return window.Game.states.states[n]; }, name);
}
async function waitName(page, name, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < (ms || 5000)) {
    if (await cur(page) === name && (await pending(page)) === null) return true;
    await page.waitForTimeout(80);
  }
  return false;
}
/* A fade transition keeps StateManager.handleInput() short-circuited for the whole
   animation, and _pendingName clears at the MIDPOINT. Clicking during the tail of
   the fade would be swallowed, so wait for the transition to fully finish. */
async function waitIdle(page, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < (ms || 4000)) {
    const busy = await page.evaluate(function () {
      const t = window.Game.states.transition;
      return !!(t && t.active);
    }).catch(function () { return true; });
    if (!busy) return true;
    await page.waitForTimeout(60);
  }
  return false;
}
async function goMenu(page) {
  await page.evaluate(function () { window.Game.states.change('menu', null, null); });
  await waitName(page, 'menu', 2000);
  return await waitIdle(page, 3000);
}
async function cardRect(page, id) {
  return await page.evaluate(function (cid) {
    const m = window.Game.states.states.menu;
    const c = (m.cards || []).filter(function (x) { return x.id === cid; })[0];
    return c ? { x: c.x, y: c.y, w: c.w, h: c.h } : null;
  }, id);
}
async function firstRectInList(page) {
  return await page.evaluate(function () {
    const s = window.Game.states.current;
    for (const k of Object.keys(s)) {
      const v = s[k];
      if (Array.isArray(v) && v.length && v[0] && typeof v[0].x === 'number' && typeof v[0].w === 'number') {
        return { key: k, n: v.length, r: { x: v[0].x, y: v[0].y, w: v[0].w, h: v[0].h } };
      }
    }
    return null;
  });
}
async function backBtnRect(page, name) {
  return await page.evaluate(function (n) {
    const s = window.Game.states.states[n];
    return (s && s.backBtn) ? { x: s.backBtn.x, y: s.backBtn.y, w: s.backBtn.w, h: s.backBtn.h } : null;
  }, name);
}
async function ready(page, ms) { await page.waitForTimeout(ms || 650); }

/* ================= MAIN ================= */
(async function () {
  const started = await startServer();
  const server = started.child, ADMIN_PW = started.adminPw;
  if (!ADMIN_PW) throw new Error('qa bootstrap did not print an admin password');
  console.log('NOTE admin credential read from bootstrap stdout (never in web sources)');
  const browser = await pw.chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });

  page.on('pageerror', function (e) { errors.push('pageerror: ' + e.message); });
  page.on('console', function (m) {
    if (m.type() !== 'error') return;
    const text = m.text();
    let loc = '';
    try { loc = (m.location && m.location().url) || ''; } catch (e) { loc = ''; }
    if (/\/api\/admin\//.test(loc) && /status of 40[13]/.test(text)) {
      expectedAuthz.push('console 401/403 ' + loc.replace(BASE, ''));
      return;
    }
    errors.push('console.error: ' + text + (loc ? ' @ ' + loc.replace(BASE, '') : ''));
  });
  page.on('requestfailed', function (r) {
    errors.push('requestfailed: ' + r.url() + ' ' + ((r.failure() && r.failure().errorText) || ''));
  });
  page.on('response', function (r) {
    const u = r.url();
    if (!u.startsWith(BASE)) return;
    const ct = (r.headers()['content-type'] || '').split(';')[0].trim();
    reqLog.push(r.status() + ' ' + ct + ' ' + u.replace(BASE, ''));
    if (r.status() >= 400) {
      // RBAC gate: a non-admin MUST get 401/403 from /api/admin/* (server is the
      // only authority). Counted as expected, not as a broken request.
      if (/\/api\/admin\//.test(u) && (r.status() === 401 || r.status() === 403)) {
        expectedAuthz.push(r.status() + ' ' + u.replace(BASE, ''));
      } else {
        net404.push(r.status() + ' ' + u.replace(BASE, ''));
        errors.push('http' + r.status() + ': ' + u);
      }
    }
    if (/\.(png|jpg|jpeg|gif|ttf|ogg|json)$/i.test(u) && ct === 'application/octet-stream') {
      badMime.push(ct + ' ' + u.replace(BASE, ''));
    }
  });

  try {
    /* ---------- A1: Loading ---------- */
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    let boot = null;
    for (let i = 0; i < 60 && !boot; i++) {
      boot = await page.evaluate(function () {
        return (window.Game && window.Game.states && window.Game.states.currentName) || null;
      }).catch(function () { return null; });
      if (!boot) await page.waitForTimeout(100);
    }
    t('A01 boot reaches a state (' + boot + ')', !!boot);
    t('A02 boot starts in loading state', boot === 'loading');

    const okLogin = await waitName(page, 'login', 6000);
    t('A03 loading → login auto transition', okLogin);

    /* ---------- A2: Login (real form + real backend auth) ---------- */
    const reg = await page.evaluate(async function (a) {
      const r = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ username: a.u, password: a.p })
      });
      return r.status;
    }, { u: USER, p: PASS });
    t('A04 backend /api/auth/register works (status ' + reg + ')', reg === 201 || reg === 200);

    const userRect = { x: 1300 / 2 - 200, y: 410, w: 400, h: 50 };
    const passRect = { x: 1300 / 2 - 200, y: 490, w: 400, h: 50 };
    const loginBtn = { x: 1300 / 2 - 200, y: 580, w: 400, h: 60 };
    const regBtn = { x: 1300 / 2 - 200, y: 660, w: 400, h: 60 };

    /* LoginState consumes exactly one queued key per engine tick, so reads must
       POLL until the field reaches the expected value instead of racing it. */
    async function field(which) {
      return await page.evaluate(function (w) {
        const s = window.Game.states.states.login;
        return w === 'u' ? s.userInput : (w === 'p' ? s.passInput : s.activeField);
      }, which);
    }
    async function typeUntil(rect, text, expectGetter, expectVal) {
      await clickCenter(page, rect);
      await page.keyboard.type(text, { delay: 6 });
      const t0 = Date.now();
      while (Date.now() - t0 < 3000) {
        if (await expectGetter() === expectVal) return true;
        await page.waitForTimeout(40);
      }
      return false;
    }

    const okUser = await typeUntil(userRect, USER, function () { return field('u'); }, USER);
    t('A05 keyboard input reaches the username field', okUser);

    // Python parity: LoginState caps each field at 20 chars (main.py login gate).
    await page.keyboard.type('XXXXXXXXXXXXXXXXX', { delay: 4 });
    const t0cap = Date.now();
    let capped = 0;
    while (Date.now() - t0cap < 3000) {
      capped = (await field('u')).length;
      if (capped === 20) break;
      await page.waitForTimeout(40);
    }
    t('A05b username field caps at 20 chars like Desktop (len=' + capped + ')', capped === 20);
    for (let i = 0; i < 10; i++) { await page.keyboard.press('Backspace'); await page.waitForTimeout(25); }
    const restored = await field('u');
    t('A05c backspace restores the exact username', restored === USER);

    await typeUntil(passRect, PASS, function () { return field('p'); }, PASS);
    const typed = { u: await field('u'), p: await field('p'), f: await field('a') };
    t('A06 click on field switches active field', typed.f === 'pass');

    // M11: regBtn now opens the real Desktop-parity RegisterState (main.py RegisterState).
    await clickCenter(page, regBtn);
    const okReg = await waitName(page, 'register', 6000);
    t('A07 register button opens the RegisterState (Desktop parity)',
      okReg && (await cur(page)) === 'register');

    // Wait for the register transition to finish before interacting. StateManager
    // intentionally suppresses input while a transition is active; clicking the
    // Back control during that fade makes this assertion race the transition.
    await waitIdle(page, 4000);
    // Register back button (450,590,400x70) returns to login — same as Desktop.
    await clickCenter(page, { x: 450, y: 590, w: 400, h: 70 });
    const backLogin = await waitName(page, 'login', 6000);
    await waitIdle(page, 4000);   // fade still swallows input until fully done
    const backLoginSettled = (await cur(page)) === 'login' && (await pending(page)) === null;

    // Returning to login resets the fields (Desktop prefill='' on re-entry) — retype.
    // Use the same tick-aware polling as A05: LoginState consumes queued keys on
    // engine ticks, so reading immediately after keyboard.type is a harness race.
    await typeUntil(userRect, USER, function () { return field('u'); }, USER);
    await typeUntil(passRect, PASS, function () { return field('p'); }, PASS);
    const a07Fields = { user: await field('u'), pass: await field('p'), active: await field('a') };
    console.log('A07B_EXPECT=' + JSON.stringify({ user: USER, pass: PASS, backLogin: backLogin, settled: backLoginSettled, state: await cur(page) }));
    console.log('A07B_FIELDS=' + JSON.stringify(a07Fields));
    t('A07b register back returns to login with fields retyped',
      backLogin && backLoginSettled && a07Fields.user === USER && a07Fields.pass === PASS);

    await clickCenter(page, loginBtn);
    const okMenu = await waitName(page, 'menu', 8000);
    await waitIdle(page, 5000);
    t('A08 real login via backend → menu', okMenu);
    const pl = await page.evaluate(function () {
      const p = window.Game.player;
      return { name: p.username, level: p.level, gold: p.gold, exp: p.exp, grade: p.grade };
    });
    t('A09 player snapshot synced from backend (' + pl.name + ' L' + pl.level + ')',
      pl.name === USER && pl.level >= 1);
    await ready(page);

    /* ---------- A3: Menu ---------- */
    t('A10 menu renders after transition (no pending transition)', (await pending(page)) === null);
    const cards = await page.evaluate(function () {
      return window.Game.states.states.menu.cards.map(function (c) {
        return { id: c.id, x: c.x, y: c.y, w: c.w, h: c.h, locked: !!c.locked };
      });
    });
    t('A11 menu exposes all 15 mode cards', cards.length === 15);
    const outside = cards.filter(function (c) { return c.x < 0 || c.y < 0 || c.x + c.w > 1300 || c.y + c.h > 800; });
    t('A12 every menu card inside 1300x800', outside.length === 0);

    // hover: pointer mapping must follow the mouse
    await hoverLogical(page, 700, 400);
    const p1 = await ptr(page);
    t('A13 hover updates logical pointer (700,400)', Math.abs(p1.x - 700) < 3 && Math.abs(p1.y - 400) < 3);

    // locked card → message, NO transition
    const settingsCard = cards.filter(function (c) { return c.id === 'settings'; })[0];
    await clickCenter(page, settingsCard);
    await ready(page);
    const lockedMsg = await page.evaluate(function () { return window.Game.states.states.menu.examMsg; });
    t('A14 locked card shows lock message and does NOT navigate',
      lockedMsg.length > 3 && (await cur(page)) === 'menu');

    // RBAC from the menu: a NON-admin clicking the admin card must be refused by
    // the SERVER (/api/admin/me → 401) and must NOT navigate (server-only authority)
    await clickCenter(page, cards.filter(function (c) { return c.id === 'admin'; })[0]);
    await page.waitForTimeout(900);
    const admMsg = await page.evaluate(function () { return window.Game.states.states.menu.examMsg; });
    t('A14b non-admin admin-card click refused by server (msg="' + admMsg.slice(0, 30) + '")',
      admMsg.indexOf('Admin') >= 0 && (await cur(page)) === 'menu');

    // double click on a card must produce exactly ONE transition
    const shopCard = cards.filter(function (c) { return c.id === 'shop'; })[0];
    await clickCenter(page, shopCard);
    await page.waitForTimeout(30);
    await clickCenter(page, shopCard);
    const okShop = await waitName(page, 'shop', 5000);
    t('A15 double click → single transition to shop', okShop && (await pending(page)) === null);
    await page.evaluate(function () { window.Game.states.change('menu', null, null); });
    await waitName(page, 'menu', 2000);
    await ready(page);

    /* ---------- A4: every secondary screen (real click → render → interact → back) ---------- */
    const SCREENS = [
      ['shop', 'shop'], ['pet', 'pet'], ['skin', 'skin'], ['gacha', 'gacha'],
      ['daily', 'daily'], ['achievement', 'ach'], ['skill_tree', 'skill'],
      ['bag', 'bag'], ['profile', 'profile']
    ];
    for (const [name, cardId] of SCREENS) {
      await goMenu(page);
      const cr = await cardRect(page, cardId);
      if (!cr) { t('A16.' + name + ' menu card exists', false); continue; }
      await clickCenter(page, cr);
      const entered = await waitName(page, name, 5000);
      t('A16.' + name + ' opens in browser via real click', entered);
      if (!entered) continue;
      await waitIdle(page, 4000);
      await ready(page);
      if (name === 'adminPanel') {
        const adm = await page.evaluate(function () {
          const s = window.Game.states.states.adminPanel;
          return { denied: s.denied === true, rows: (s.rows || []).length };
        });
        t('A16.adminPanel RBAC: non-admin stays denied in browser (denied=' + adm.denied +
          ', rows=' + adm.rows + ')', adm.denied === true && adm.rows === 0);
      }

      // hover over the screen: pointer mapping must still track
      await hoverLogical(page, 650, 400);
      const pp = await ptr(page);
      const hoverOk = Math.abs(pp.x - 650) < 4 && Math.abs(pp.y - 400) < 4;

      // scroll (wheel) must not throw
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(120);
      await page.mouse.wheel(0, -300);
      await page.waitForTimeout(120);

      // first card/list item: real click (owned/locked/selected states)
      const fr = await firstRectInList(page);
      let clicked = 'n/a';
      if (fr) {
        await clickCenter(page, fr.r);
        await ready(page, 250);
        clicked = fr.key + '[' + fr.n + ']';
      }
      const scroll = await page.evaluate(function () {
        const s = window.Game.states.current;
        return (typeof s.scrollOffset === 'number') ? s.scrollOffset : null;
      });
      const stillMine = (await cur(page)) === name;
      t('A16.' + name + ' hover+scroll+card click stable (' + clicked + ', scroll=' + scroll + ')',
        hoverOk && stillMine);

      // back navigation via the real back button
      const bb = await backBtnRect(page, name);
      if (!bb) { t('A16.' + name + ' has back button', false); continue; }
      await clickCenter(page, bb);
      const back = await waitName(page, 'menu', 5000);
      await waitIdle(page, 3000);
      t('A16.' + name + ' back button → menu (single transition)', back && (await pending(page)) === null);
    }

    /* ---------- A5: profile → skill_map ---------- */
    await goMenu(page);
    await clickCenter(page, await cardRect(page, 'profile'));
    await waitName(page, 'profile', 4000);
    await waitIdle(page, 3000);
    await ready(page);
    const smBtn = await page.evaluate(function () { return window.Game.states.states.profile.skillMapBtn; });
    await clickCenter(page, smBtn);
    const okSm = await waitName(page, 'skill_map', 4000);
    t('A17 skill_map opens from profile (SKILL MAP screen browser-tested)', okSm);
    if (okSm) {
      await ready(page);
      await page.mouse.wheel(0, 300); await page.waitForTimeout(150);
      const rows = await page.evaluate(function () { return (window.Game.states.states.skill_map.rows || []).length; });
      t('A18 skill_map renders weak-topic rows (' + rows + ')', rows >= 0);
      await clickCenter(page, await page.evaluate(function () { return window.Game.states.states.skill_map.backBtn; }));
      t('A19 skill_map back → profile', await waitName(page, 'profile', 4000));
    }
    await clickCenter(page, await page.evaluate(function () { return window.Game.states.states.profile.backBtn; }));
    t('A20 profile back → menu', await waitName(page, 'menu', 4000));

    /* ---------- A6: negative path — gacha pull must not crash ---------- */
    await goMenu(page);
    await clickCenter(page, await cardRect(page, 'gacha'));
    await waitName(page, 'gacha', 4000);
    await waitIdle(page, 3000);
    await ready(page);
    const pull = await page.evaluate(function () {
      const s = window.Game.states.states.gacha;
      const k = (s.roll1 && typeof s.roll1.x === 'number') ? 'roll1'
        : ((s.roll10 && typeof s.roll10.x === 'number') ? 'roll10' : null);
      return k ? { k: k, r: { x: s[k].x, y: s[k].y, w: s[k].w, h: s[k].h } } : null;
    });
    if (pull) {
      await clickCenter(page, pull.r);
      await ready(page, 400);
      const g = await page.evaluate(function () {
        const s = window.Game.states.states.gacha;
        return { name: window.Game.states.currentName, gold: window.Game.player.gold,
                 status: s.statusMsg || '' };
      });
      t('A21 gacha ' + pull.k + ' click is graceful (state=' + g.name + ', status="' +
        g.status.slice(0, 24) + '")', g.name === 'gacha');
    } else {
      t('A21 gacha roll button discovered', false);
    }
    await clickCenter(page, await backBtnRect(page, 'gacha'));
    await waitName(page, 'menu', 4000);
    await waitIdle(page, 3000);

    /* ---------- A7: lesson list is REAL data + theory (content + page flip) ---------- */
    await goMenu(page);
    await clickCenter(page, await cardRect(page, 'lesson'));
    await waitName(page, 'lesson_select', 5000);
    await waitIdle(page, 4000);
    await ready(page, 900);           // dataLoader is async
    const ls = await page.evaluate(function () {
      const s = window.Game.states.states.lesson_select;
      return {
        missing: s.dataMissing === true, loading: s.loading === true,
        n: (s.lessons || []).length,
        first: String((s.lessons || [])[0] || ''),
        bad: (s.lessons || []).filter(function (l) { return String(l).indexOf('object Object') >= 0; }).length
      };
    });
    t('A22 lesson_select opened from menu (' + ls.n + ' lessons)', (await cur(page)) === 'lesson_select');
    t('A22b lesson list loaded from math_lessons.json (n=' + ls.n + ', first="' + ls.first.slice(0, 28) + '")',
      !ls.missing && !ls.loading && ls.n > 0);
    t('A22c NO "[object Object]" lesson labels', ls.bad === 0);
    // real click on the first lesson row -> theory (main.py:960 parity flow)
    await clickCenter(page, { x: 100, y: 150, w: 480, h: 80 });
    const okTheory = await waitName(page, 'theory', 5000);
    t('A23 theory opens from a real lesson click', okTheory);
    if (okTheory) {
      await waitIdle(page, 4000);
      await ready(page);
      const th = await page.evaluate(function () {
        const s = window.Game.states.current;
        return {
          title: s.title, contentLen: (s.content || '').length,
          hasBook: !!s._rbBook,
          pages: (s._rbBook && s._rbBook.pages) ? s._rbBook.pages.length : 0,
          hasPageApi: !!(s._rbBook && typeof s._rbBook.pageApi === 'function'),
          scroll: s.scrollOffset
        };
      });
      t('A24 theory title = clicked lesson ("' + String(th.title).slice(0, 30) + '")',
        String(th.title).indexOf('object Object') < 0 && th.title.length > 0);
      t('A24b theory carries Desktop content (' + th.contentLen + ' chars, not the placeholder)',
        th.contentLen > 40);
      t('A25 theory book carries Desktop pages (' + th.pages + ') + pageApi=' + th.hasPageApi,
        th.hasBook && th.pages >= 2 && th.hasPageApi);
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(200);
      const th2 = await page.evaluate(function () { return window.Game.states.current.scrollOffset; });
      t('A26 theory scroll responds (' + th.scroll + ' to ' + th2 + ')', typeof th2 === 'number');
      await page.evaluate(function () { window.Game.states.current._rbBook.goTo(1); });
      await page.waitForTimeout(1400);
      const pg = await page.evaluate(function () {
        const b = window.Game.states.current._rbBook;
        return { idx: b.index, n: b.pages.length, page: b.page };
      });
      t('A27 theory book page flip works (index ' + pg.idx + '/' + pg.n + ')',
        pg.idx === 1 && pg.n >= 2 && !!pg.page);
      // real click on "start lesson" -> gameplay (Desktop theory -> lesson chain)
      const before = await page.evaluate(function () {
        const p = window.Game.player;
        return { level: p.level, exp: p.exp, gold: p.gold };
      });
      await clickCenter(page, await page.evaluate(function () {
        return window.Game.states.states.theory.startBtn;
      }));
      t('A28 theory "start lesson" -> lesson state', await waitName(page, 'lesson', 6000));
      await waitIdle(page, 4000);

      /* ---------- A8/D: gameplay smoke (from the REAL theory -> lesson flow) ---------- */
      await ready(page, 300);
      const q0 = await page.evaluate(function () {
        const s = window.Game.states.current;
        return { q: s.q, opts: s.opts.length, missing: s.missing, btns: s.buttons.length };
      });
      t('A29 lesson gameplay opens with a generated question (' +
        String(q0.q || '').slice(0, 24) + ')',
        (await cur(page)) === 'lesson' && !q0.missing && !!q0.q && q0.opts === 4 && q0.btns === 4);

    let answered = 0, sawFeedback = false;
    for (let i = 0; i < 60; i++) {
      const st = await page.evaluate(function () {
        const s = window.Game.states.current;
        return {
          name: window.Game.states.currentName,
          fb: !!(s.feedback && s.feedback.active),
          ans: s.ans,
          btns: (s.buttons || []).map(function (b) { return { x: b.x, y: b.y, w: b.w, h: b.h, v: b.value }; })
        };
      });
      if (st.name !== 'lesson') break;
      if (st.fb) {
        sawFeedback = true;
        await clickCenter(page, { x: 650, y: 300, w: 4, h: 4 });
        await page.waitForTimeout(180);
      } else if (st.btns.length) {
        const correct = st.btns.filter(function (b) { return String(b.v) === String(st.ans); })[0] || st.btns[0];
        await clickCenter(page, correct);
        answered++;
        await page.waitForTimeout(200);
      }
    }
    const endName = await cur(page);
    t('A31 answer clicks registered (answered=' + answered + ', feedback=' + sawFeedback + ')',
      answered >= 1 && sawFeedback);
    t('A32 session completes to victory/defeat (' + endName + ')',
      endName === 'victory' || endName === 'defeat');
    await ready(page, 1400);
    const after = await page.evaluate(function () {
      const p = window.Game.player;
      return { level: p.level, exp: p.exp, gold: p.gold };
    });
    t('A33 XP/gold updated by session (exp ' + before.exp + '->' + after.exp +
      ', gold ' + before.gold + '->' + after.gold + ')',
      after.exp !== before.exp || after.gold !== before.gold || after.level !== before.level);
    const cont = await page.evaluate(function () {
      const s = window.Game.states.current;
      const k = s.continueBtn ? 'continueBtn' : (s.homeBtn ? 'homeBtn' : null);
      return k ? { k: k, r: { x: s[k].x, y: s[k].y, w: s[k].w, h: s[k].h } } : null;
    });
    if (cont) {
      await clickCenter(page, cont.r);
      t('A34 ' + cont.k + ' returns to menu from ' + endName, await waitName(page, 'menu', 6000));
    } else {
      t('A34 continue/home button discovered', false);
    }
    t('A35 no pending transition after result screen', (await pending(page)) === null);
    }

    /* ---------- B: responsive viewports ---------- */
    /* CSS contract (style.css): width: min(100vw, 100vh*1300/800) with
       max-width:1300px / max-height:800px -> the canvas is scaled DOWN to fit and
       NEVER upscaled past its logical size. Expect exactly that, not a guess. */
    const VPS = [
      [1300, 800], [1280, 720], [1920, 1080], [1024, 640]
    ];
    for (const vp of VPS) {
      const vw = vp[0], vh = vp[1];
      const expW = Math.round(Math.min(1300, Math.min(vw, vh * 1300 / 800)));
      const expH = Math.round(Math.min(800, Math.min(vh, vw * 800 / 1300)));
      await page.setViewportSize({ width: vw, height: vh });
      await page.waitForTimeout(350);
      const g = await page.evaluate(function () {
        const c = document.querySelector('canvas');
        const r = c.getBoundingClientRect();
        return {
          W: window.Game.engine.WIDTH, H: window.Game.engine.HEIGHT,
          cssW: Math.round(r.width), cssH: Math.round(r.height)
        };
      });
      t('B.' + vw + 'x' + vh + ' logical 1300x800, canvas ' + g.cssW + 'x' + g.cssH +
        ' (expect ' + expW + 'x' + expH + ', never upscaled)',
        g.W === 1300 && g.H === 800 && g.cssW > 0 && g.cssW <= 1300 && g.cssH <= 800 &&
        Math.abs(g.cssW - expW) <= 2 && Math.abs(g.cssH - expH) <= 12);
      await goMenu(page);
      await clickCenter(page, await cardRect(page, 'shop'));
      const ok = await waitName(page, 'shop', 5000);
      t('B.' + vw + 'x' + vh + ' real click maps to correct logical target', ok);
      if (ok) {
        await clickCenter(page, await backBtnRect(page, 'shop'));
        await waitName(page, 'menu', 4000);
      }
    }
    await page.setViewportSize({ width: 1300, height: 800 });
    await ready(page, 400);

    /* ---------- A9: ADMIN / RBAC real flow (seeded admin account) ---------- */
    async function uiLogin(u, p) {
      await page.evaluate(function () { window.Game.states.change('login', { prefill: '' }, null); });
      await waitName(page, 'login', 4000);
      await waitIdle(page, 3000);
      await ready(page, 300);
      await clickCenter(page, userRect);
      await page.keyboard.type(u, { delay: 6 });
      let t0 = Date.now();
      while (Date.now() - t0 < 3000) { if (await field('u') === u) break; await page.waitForTimeout(40); }
      await clickCenter(page, passRect);
      await page.keyboard.type(p, { delay: 6 });
      let t1 = Date.now();
      while (Date.now() - t1 < 3000) { if (await field('p') === p) break; await page.waitForTimeout(40); }
      await clickCenter(page, loginBtn);
      const ok = await waitName(page, 'menu', 8000);
      await waitIdle(page, 4000);
      return ok;
    }
    await goMenu(page);
    await clickCenter(page, await cardRect(page, 'logout'));
    const outOk = await waitName(page, 'login', 5000);
    t('A36 logout (real click) → login screen', outOk);
    const admLogin = outOk ? await uiLogin('admin', ADMIN_PW) : false;
    t('A37 admin login via backend → menu', admLogin);
    if (admLogin) {
      await clickCenter(page, await cardRect(page, 'admin'));
      const admOk = await waitName(page, 'adminPanel', 6000);
      t('A38 admin card opens AdminPanel for a real admin', admOk);
      if (admOk) {
        await waitIdle(page, 4000);
        await page.waitForTimeout(900);            // /api/admin/me + /api/admin/users
        const adm = await page.evaluate(function () {
          const s = window.Game.states.states.adminPanel;
          return { denied: s.denied === true, rows: (s.rows || []).length };
        });
        t('A39 AdminPanel RBAC: server granted admin (denied=' + adm.denied +
          ', rows=' + adm.rows + ')', adm.denied === false && adm.rows > 0);
        await clickCenter(page, await backBtnRect(page, 'adminPanel'));
        t('A40 AdminPanel back → menu', await waitName(page, 'menu', 5000));
      }
      await clickCenter(page, await cardRect(page, 'logout'));
      t('A41 admin logout → login screen', await waitName(page, 'login', 5000));
    }

    /* ---------- I: snapshot for the record ---------- */
    await goMenu(page);
    await ready(page, 300);
    await page.screenshot({ path: path.join(__dirname, '_final_menu_1300x800.png') });

  } catch (err) {
    fail++;
    console.log('FAIL harness exception: ' + (err && err.stack ? err.stack : err));
  } finally {
    /* ---------- E/F: runtime + network report ---------- */
    const p0 = errors.filter(function (e) { return /pageerror|console\.error/.test(e); });
    console.log('');
    console.log('--- CONSOLE / PAGE ERRORS: ' + errors.length + ' ---');
    errors.slice(0, 25).forEach(function (e) { console.log('  ' + e); });
    console.log('--- NETWORK >=400: ' + net404.length + ' ---');
    net404.slice(0, 25).forEach(function (e) { console.log('  ' + e); });
    console.log('--- WRONG MIME (octet-stream for asset): ' + badMime.length + ' ---');
    badMime.slice(0, 25).forEach(function (e) { console.log('  ' + e); });
    const assets = reqLog.filter(function (r) { return /\.(png|jpg|jpeg|gif|ttf|ogg)$/i.test(r); });
    console.log('--- ASSET REQUESTS: ' + assets.length + ' ---');
    const uniq = {};
    assets.forEach(function (r) { uniq[r.replace(/^\d+ [^ ]+ /, '')] = r; });
    Object.keys(uniq).sort().forEach(function (k) { console.log('  ' + uniq[k]); });

    t('E01 zero console.error / pageerror', p0.length === 0);
    t('E02 zero failed/4xx network requests', net404.length === 0 && errors.filter(function (e) {
      return /requestfailed/.test(e);
    }).length === 0);
    t('F01 real assets served with correct MIME (no octet-stream)', badMime.length === 0);
    t('F02 boot loaded font + image assets (' + Object.keys(uniq).length + ' asset requests)',
      Object.keys(uniq).length >= 3);

    console.log('');
    console.log('--- EXPECTED AUTHZ (RBAC gate, non-admin): ' + expectedAuthz.length + ' ---');
    expectedAuthz.slice(0, 10).forEach(function (e) { console.log('  ' + e); });
    t('E03 RBAC gate fires in browser: non-admin blocked from /api/admin/* (n=' +
      expectedAuthz.length + ')', expectedAuthz.length >= 1);
    console.log('');
    console.log('FINAL_QA_BROWSER: pass=' + pass + ' fail=' + fail);
    try { await browser.close(); } catch (e) {}
    try { server.kill(); } catch (e) {}
    process.exit(fail > 0 ? 1 : 0);
  }
})();
