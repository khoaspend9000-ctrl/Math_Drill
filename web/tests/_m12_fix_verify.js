'use strict';
/* M12 — REAL-BROWSER verification of the clover-rain / book-chrome fixes.
 *
 * Reproduction targets (all confirmed no-ops before the fix):
 *   A) MenuState clover layer        -> empty FallingClover pool, 0 pixels
 *   B) LessonSelectState book chrome -> chrome built with UI.RealisticBook's
 *      default rect (150,100,1000,600) instead of the Desktop (50,50,1200,700)
 *   C) VictoryState clover layer
 *   D) DefeatState  clover layer
 *
 * Evidence is taken from the REAL canvas of a REAL Chromium session (pixel
 * probes on the 1300x800 logical surface), never from source inspection alone.
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const pw = require(path.join(__dirname, '..', 'tools', 'browser-validation', 'node_modules', 'playwright'));

const PORT = 3024;
const BASE = 'http://127.0.0.1:' + PORT;
const ROOT = path.join(__dirname, '..', '..');
const USER = 'qam12' + String(Date.now()).slice(-7);
const PASS = 'M12FixQa123!';
const ADMIN_PW = 'qa-adm-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-5);

const M = {
  probes: 0, fails: [],
  cloverPixels: {}, poolCounts: {}, bookPixels: {},
  consoleErrors: [], pageErrors: [], net4xx: [], requestFailed: []
};
function ok(cond, msg) { M.probes++; if (!cond) M.fails.push(msg); return cond; }
function startServer() {
  return new Promise(function (resolve, reject) {
    const childEnv = Object.assign({}, process.env, { QA_PORT: String(PORT) });
    childEnv['MATHDRILL_' + 'ADMIN_' + 'PASSWORD'] = ADMIN_PW;
    const child = spawn(process.execPath, ['qa_bootstrap.js'], {
      cwd: path.join(ROOT, 'server'), env: childEnv, stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = ''; let settled = false;
    child.stdout.on('data', function (d) {
      out += String(d);
      if (!settled && out.indexOf('QA_READY') >= 0) { settled = true; resolve({ child: child }); }
    });
    child.stderr.on('data', function (d) { M.consoleErrors.push('server stderr: ' + String(d).trim()); });
    child.on('exit', function (c) { if (!settled) { settled = true; reject(new Error('server exited code=' + c + ' out=' + out)); } });
    setTimeout(function () { if (!settled) { settled = true; reject(new Error('server not ready: ' + out)); } }, 30000);
  });
}
async function canvasRect(page) {
  return await page.evaluate(function () {
    const r = document.getElementById('game').getBoundingClientRect();
    return { l: r.left, t: r.top, w: r.width, h: r.height };
  });
}
async function clickLogical(page, lx, ly) {
  const r = await canvasRect(page);
  await page.mouse.move(r.l + (lx / 1300) * r.w, r.t + (ly / 800) * r.h, { steps: 3 });
  await page.waitForTimeout(25);
  await page.mouse.down(); await page.waitForTimeout(18); await page.mouse.up();
}
async function clickCenter(page, rect) { await clickLogical(page, rect.x + rect.w / 2, rect.y + rect.h / 2); }
async function cur(page) { return await page.evaluate(function () { return window.Game.states.currentName; }); }
async function waitName(page, name, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < (ms || 8000)) {
    if (await cur(page) === name) return true;
    await page.waitForTimeout(60);
  }
  return false;
}
/* pixel probe on the 1300x800 logical surface -> [r,g,b] */
async function probe(page, lx, ly) {
  return await page.evaluate(function (p) {
    const c = document.getElementById('game');
    const ctx = c.getContext('2d');
    const sx = c.width / window.Game.engine.WIDTH;
    const sy = c.height / window.Game.engine.HEIGHT;
    const d = ctx.getImageData(Math.round(p[0] * sx), Math.round(p[1] * sy), 1, 1).data;
    return [d[0], d[1], d[2]];
  }, [lx, ly]);
}
/* Count clover-coloured pixels (clover filler is rgb(80,180,80), drawn with
   globalAlpha .6-1 so it blends towards the dark state background).
   A region is passed because some screens reuse the same green for buttons
   (GREEN_BTN = 76,175,80); the bands below contain no button chrome. */
async function countCloverPixels(page, region) {
  return await page.evaluate(function (rg) {
    const c = document.getElementById('game');
    const ctx = c.getContext('2d');
    const sx = c.width / window.Game.engine.WIDTH;
    const sy = c.height / window.Game.engine.HEIGHT;
    const x0 = Math.round(rg.x0 * sx), y0 = Math.round(rg.y0 * sy);
    const w = Math.round((rg.x1 - rg.x0) * sx), h = Math.round((rg.y1 - rg.y0) * sy);
    const img = ctx.getImageData(x0, y0, w, h).data;
    let n = 0;
    for (let i = 0; i < img.length; i += 4) {
      const r = img[i], g = img[i + 1], b = img[i + 2];
      if (r >= 50 && r <= 110 && g >= 110 && g <= 200 && b >= 55 && b <= 100 && g > r + 40 && g > b + 40) n++;
    }
    return n;
  }, region);
}
/* bands free of green button chrome (GREEN_BTN shares the clover hue) */
const BAND_MENU = { x0: 0, y0: 560, x1: 1300, y1: 800 };
const BAND_TOP = { x0: 0, y0: 0, x1: 1300, y1: 560 };
async function poolCount(page, name) {
  return await page.evaluate(function (n) {
    const s = window.Game.states.states[n];
    const e = s && s.cloverEffect;
    return e ? e.count : -1;
  }, name);
}
/* advance the state's own update(dt) so the rain reaches steady state quickly,
   then let the game loop paint one frame */
async function advance(page, name, steps, dt) {
  await page.evaluate(function (a) {
    const s = window.Game.states.states[a.n];
    if (s && typeof s.update === 'function') { for (let i = 0; i < a.k; i++) s.update(a.dt); }
  }, { n: name, k: steps, dt: dt });
  await page.waitForTimeout(160);
}
function near(px, rgb, tol) {
  return Math.abs(px[0] - rgb[0]) <= tol && Math.abs(px[1] - rgb[1]) <= tol && Math.abs(px[2] - rgb[2]) <= tol;
}
async function uiLogin(page, u, p) {
  const userRect = { x: 1300 / 2 - 200, y: 410, w: 400, h: 50 };
  const passRect = { x: 1300 / 2 - 200, y: 490, w: 400, h: 50 };
  const loginBtn = { x: 1300 / 2 - 200, y: 580, w: 400, h: 60 };
  await clickCenter(page, userRect);
  await page.keyboard.type(u, { delay: 6 });
  await page.waitForTimeout(120);
  await clickCenter(page, passRect);
  await page.keyboard.type(p, { delay: 6 });
  await page.waitForTimeout(120);
  await clickCenter(page, loginBtn);
  return await waitName(page, 'menu', 10000);
}
/* ================= MAIN ================= */
(async function () {
  let server = null, browser = null;
  let fatal = null;
  try {
    const s0 = await startServer();
    server = s0.child;
    browser = await pw.chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
    page.on('pageerror', function (e) { M.pageErrors.push(String(e && e.message)); });
    page.on('console', function (m) { if (m.type() === 'error') M.consoleErrors.push(m.text()); });
    page.on('requestfailed', function (r) { M.requestFailed.push(r.url().replace(BASE, '') + ' ' + ((r.failure() && r.failure().errorText) || '')); });
    page.on('response', function (r) { if (r.url().startsWith(BASE) && r.status() >= 400) M.net4xx.push(r.status() + ' ' + r.url().replace(BASE, '')); });

    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await waitName(page, 'login', 15000);
    const reg = await page.evaluate(async function (a) {
      const r = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ username: a.u, password: a.p })
      });
      return r.status;
    }, { u: USER, p: PASS });
    if (reg !== 201 && reg !== 200) throw new Error('register failed status=' + reg);
    const loggedIn = await uiLogin(page, USER, PASS);
    if (!loggedIn) throw new Error('login did not reach menu');
    await page.waitForTimeout(600);

    /* ---------- A: MenuState clover rain ---------- */
    const menuPool = await poolCount(page, 'menu');
    M.poolCounts.menu = menuPool;
    ok(menuPool === 20, 'A1 menu clover pool must hold the Desktop 20 clovers (got ' + menuPool + ')');
    const menuPx0 = await countCloverPixels(page, BAND_MENU);
    await advance(page, 'menu', 400, 0.05); // ~20s of state time
    const menuPx = await countCloverPixels(page, BAND_MENU);
    M.cloverPixels.menu = menuPx;
    ok(menuPx > 0, 'A2 menu clover pixels rendered (pixels=' + menuPx + ', before advance=' + menuPx0 + ')');

    /* ---------- B: LessonSelect book chrome geometry ---------- */
    await clickCenter(page, { x: 800, y: 200, w: 1, h: 1 }); // 'lesson' card (680..920 x 155..245)
    const toSelect = await waitName(page, 'lesson_select', 10000);
    ok(toSelect, 'B0 reached lesson_select');
    await page.waitForTimeout(600);
    /* Desktop rect (50,50,1200,700) => cover (38,40,1224,720) #503214,
       inner cover (42,42,1216,716) #654321, left page (50,50,580,700) #fdf6e3,
       spine (630,60,40,680) #969696.
       Probe points stay clear of the rounded corners (r=15/12/10) and of the
       later translucent panel (x>=60). With UI.RealisticBook's default rect
       (150,100,1000,600) every probe would instead read the flat background
       colour (165,214,167). */
    const coverEdge = await probe(page, 41, 400);  // outer cover strip  (80,50,20)
    const pageCream = await probe(page, 56, 400);  // left page          (253,246,227)
    const spine = await probe(page, 640, 720);     // spine              (150,150,150)
    M.bookPixels = { coverEdge: coverEdge, pageCream: pageCream, spine: spine };
    ok(near(coverEdge, [80, 50, 20], 12), 'B1 outer book cover at (41,400) = Desktop (80,50,20), got ' + JSON.stringify(coverEdge));
    ok(near(pageCream, [253, 246, 227], 12), 'B2 book page at (56,400) = Desktop (253,246,227), got ' + JSON.stringify(pageCream));
    ok(near(spine, [150, 150, 150], 12), 'B3 book spine at (640,720) = Desktop (150,150,150), got ' + JSON.stringify(spine));
    /* ---------- C: VictoryState clover rain ---------- */
    await page.evaluate(function () {
      window.Game.states.change('victory', {
        correct: 8, total: 10, lessonTitle: 'Bài 1',
        stats: { accuracy: 80, avgTime: 3, correct: 8, total: 10 }
      }, null);
    });
    const vicOk = await waitName(page, 'victory', 8000);
    ok(vicOk, 'C0 reached victory');
    await page.waitForTimeout(400); // let the state's own update() seed the pool
    M.poolCounts.victory = await poolCount(page, 'victory');
    ok(M.poolCounts.victory === 15, 'C1 victory clover pool must hold the Desktop 15 (got ' + M.poolCounts.victory + ')');
    const vicPx0 = await countCloverPixels(page, BAND_TOP);
    await advance(page, 'victory', 400, 0.05);
    M.cloverPixels.victory = await countCloverPixels(page, BAND_TOP);
    ok(M.cloverPixels.victory > 0, 'C2 victory clover pixels rendered (pixels=' + M.cloverPixels.victory + ', before advance=' + vicPx0 + ')');

    /* ---------- D: DefeatState clover rain ---------- */
    await page.evaluate(function () {
      window.Game.states.change('defeat', {
        correct: 4, total: 10, lessonTitle: 'Bài 1',
        stats: { accuracy: 40, avgTime: 3, correct: 4, total: 10 }
      }, null);
    });
    const defOk = await waitName(page, 'defeat', 8000);
    ok(defOk, 'D0 reached defeat');
    await page.waitForTimeout(400); // let the state's own update() seed the pool
    M.poolCounts.defeat = await poolCount(page, 'defeat');
    ok(M.poolCounts.defeat === 15, 'D1 defeat clover pool must hold the Desktop 15 (got ' + M.poolCounts.defeat + ')');
    const defPx0 = await countCloverPixels(page, BAND_TOP);
    await advance(page, 'defeat', 400, 0.05);
    M.cloverPixels.defeat = await countCloverPixels(page, BAND_TOP);
    ok(M.cloverPixels.defeat > 0, 'D2 defeat clover pixels rendered (pixels=' + M.cloverPixels.defeat + ', before advance=' + defPx0 + ')');

    /* ---------- E: network / console audit ---------- */
    ok(M.consoleErrors.length === 0, 'E1 console errors = ' + M.consoleErrors.length + ' ' + M.consoleErrors.slice(0, 3).join(' | '));
    ok(M.pageErrors.length === 0, 'E2 page errors = ' + M.pageErrors.length + ' ' + M.pageErrors.slice(0, 3).join(' | '));
    ok(M.requestFailed.length === 0, 'E3 request failures = ' + M.requestFailed.length);
    ok(M.net4xx.length === 0, 'E4 unexpected 4xx/5xx = ' + M.net4xx.length + ' ' + M.net4xx.slice(0, 3).join(' | '));
  } catch (e) {
    fatal = String((e && e.stack) || e);
  }
  try { if (browser) await browser.close(); } catch (e) {}
  try { if (server) server.kill(); } catch (e) {}

  console.log('=== M12 FIX VERIFY (real Chromium) ===');
  console.log('PROBES=' + M.probes + ' FAILS=' + M.fails.length);
  console.log('POOL_COUNTS=' + JSON.stringify(M.poolCounts));
  console.log('CLOVER_PIXELS=' + JSON.stringify(M.cloverPixels));
  console.log('BOOK_PIXELS=' + JSON.stringify(M.bookPixels));
  console.log('CONSOLE_ERRORS=' + M.consoleErrors.length + ' PAGE_ERRORS=' + M.pageErrors.length
    + ' REQUEST_FAILED=' + M.requestFailed.length + ' NET_4XX=' + M.net4xx.length);
  if (M.fails.length) M.fails.forEach(function (f) { console.log('FAIL  ' + f); });
  if (fatal) console.log('FATAL=' + fatal);
  const pass = (!fatal && M.fails.length === 0);
  console.log('M12_FIX_VERIFY: pass=' + (pass ? 1 : 0) + ' fail=' + ((fatal ? 1 : 0) + M.fails.length));
  process.exit(pass ? 0 : 1);
})();
