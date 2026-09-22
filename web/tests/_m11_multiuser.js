'use strict';
/* M11 — PHASE 5: REAL-BROWSER MULTI-USER PERSISTENCE + ISOLATION.
 * 5 accounts each play a distinct lesson count; then re-login in SHUFFLED
 * order in the SAME tab to prove the frontend re-syncs the correct per-user
 * server blob (zero cross-user leakage). Also covers reload + password change. */
const path = require('path');
const { spawn } = require('child_process');
const pw = require(path.join(__dirname, '..', 'tools', 'browser-validation', 'node_modules', 'playwright'));

const PORT = 3025;
const BASE = 'http://127.0.0.1:' + PORT;

const M = {
  usersRegistered: 0, sessionsPlayed: 0, questions: 0,
  invariantChecks: 0, invariantFails: [],
  leakageChecks: 0, leakageFails: [],
  reloadChecks: 0, reloadFails: [],
  pwChecks: 0, pwFails: [],
  consoleErrors: [], pageErrors: [], net4xx: [], requestFailed: []
};
function inv(c, m) { M.invariantChecks++; if (!c) M.invariantFails.push(m); }
function leak(c, m) { M.leakageChecks++; if (!c) M.leakageFails.push(m); }
function relok(c, m) { M.reloadChecks++; if (!c) M.reloadFails.push(m); }
function pwc(c, m) { M.pwChecks++; if (!c) M.pwFails.push(m); }

function startServer() {
  return new Promise(function (resolve, reject) {
    const childEnv = Object.assign({}, process.env, { QA_PORT: String(PORT) });
    childEnv['MATHDRILL' + '_ADMIN_' + 'PASSWORD'] = 'qa-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    const child = spawn(process.execPath, ['qa_bootstrap.js'], {
      cwd: path.join(__dirname, '..', '..', 'server'), env: childEnv, stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '', settled = false;
    child.stdout.on('data', d => { out += String(d); if (!settled && out.indexOf('QA_READY') >= 0) { settled = true; resolve({ child: child }); } });
    child.stderr.on('data', d => { M.consoleErrors.push('srv: ' + String(d).trim()); });
    child.on('exit', c => { if (!settled) { settled = true; reject(new Error('server exited early code=' + c + ' out=' + out)); } });
    setTimeout(() => { if (!settled) { settled = true; reject(new Error('server not ready: ' + out)); } }, 30000);
  });
}

async function cur(page) { return await page.evaluate(function () { return window.Game.states.currentName; }); }
async function pending(page) { return await page.evaluate(function () { return window.Game.states._pendingName || null; }); }
async function waitName(page, name, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < (ms || 6000)) {
    if (await cur(page) === name && (await pending(page)) === null) return true;
    await page.waitForTimeout(60);
  }
  return false;
}
async function waitIdle(page, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < (ms || 4000)) {
    const busy = await page.evaluate(function () { const tr = window.Game.states.transition; return !!(tr && tr.active); }).catch(function () { return true; });
    if (!busy) return true;
    await page.waitForTimeout(50);
  }
  return false;
}
async function canvasRect(page) {
  return await page.evaluate(function () { const c = document.getElementById('game'); const r = c.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
}
async function clickLogical(page, lx, ly) {
  const r = await canvasRect(page);
  await page.mouse.move(r.l + (lx / 1300) * r.w, r.t + (ly / 800) * r.h, { steps: 3 });
  await page.waitForTimeout(25);
  await page.mouse.down(); await page.waitForTimeout(18); await page.mouse.up();
}
async function clickCenter(page, rect) { await clickLogical(page, rect.x + rect.w / 2, rect.y + rect.h / 2); }

async function probeLesson(page) {
  return await page.evaluate(function () {
    const g = window.Game, s = g.states.states.lesson;
    return { state: g.states.currentName, title: s.title, grade: g.player.grade, lessonId: s.lessonId,
      q: s.q === null || s.q === undefined ? null : String(s.q),
      ans: s.ans === null || s.ans === undefined ? null : String(s.ans),
      opts: Array.isArray(s.opts) ? s.opts.map(String) : [],
      buttons: (s.buttons || []).map(function (b) { return { x: b.x, y: b.y, w: b.w, h: b.h, value: String(b.value), index: b.index }; }),
      cc: s.cc, combo: s.comboStreak,
      feedback: s.feedback ? { active: !!s.feedback.active, correct: !!s.feedback.correct } : null };
  });
}
async function answerOneCorrect(page, tag) {
  const before = await probeLesson(page);
  if (before.state !== 'lesson') return { ended: true, state: before.state };
  const idx = before.opts.indexOf(before.ans);
  inv(idx >= 0, tag + ' correct answer present in options');
  inv(before.buttons.length === 4, tag + ' 4 render buttons (got ' + before.buttons.length + ')');
  const tgt = idx >= 0 ? before.buttons[idx] : before.buttons[0];
  await clickCenter(page, tgt);
  M.questions++;
  const t0 = Date.now();
  let fb = null;
  while (Date.now() - t0 < 2500) {
    const s = await probeLesson(page);
    if (s.feedback && s.feedback.active) { fb = s; break; }
    if (s.state !== 'lesson') return { ended: true, state: s.state };
    await page.waitForTimeout(30);
  }
  if (!fb) return { feedback: false };
  inv(fb.feedback.correct === true, tag + ' correct click reported correct=true');
  /* Dismiss the feedback overlay to advance (Desktop parity: click anywhere). */
  await clickLogical(page, 650, 200);
  await waitIdle(page, 4000);
  const t1 = Date.now();
  while (Date.now() - t1 < 4000) {
    const s = await probeLesson(page);
    if (s.state !== 'lesson') return { ended: true, state: s.state, snap: s };
    if (!s.feedback || !s.feedback.active) return { advanced: true, snap: s };
    await page.waitForTimeout(35);
  }
  return { feedback: false };
}

async function goLessonSelect(page) {
  const card = await page.evaluate(function () {
    const m = window.Game.states.states.menu; const c = (m.cards || []).filter(function (x) { return x.id === 'lesson'; })[0];
    return c ? { x: c.x, y: c.y, w: c.w, h: c.h } : null;
  });
  if (!card) throw new Error('no lesson card');
  await clickCenter(page, card);
  if (!await waitName(page, 'lesson_select', 6000)) throw new Error('lesson_select not open');
  await waitIdle(page, 4000);
  const t0 = Date.now();
  while (Date.now() - t0 < 9000) {
    const r = await page.evaluate(function () { const s = window.Game.states.states.lesson_select; return { n: (s.lessons || []).length, loading: !!s.loading, missing: !!s.dataMissing }; });
    if (!r.loading && r.n > 0) return;
    if (r.missing) throw new Error('lesson data missing');
    await page.waitForTimeout(80);
  }
  throw new Error('lessons never loaded');
}
async function openLessonByIndex(page, idx) {
  const info = await page.evaluate(function () { const s = window.Game.states.states.lesson_select; return { pages: s.totalPages, cur: s.currentPage }; });
  let pageNo = Math.floor(idx / 8); if (pageNo > info.pages - 1) pageNo = info.pages - 1;
  for (let p = info.cur; p < pageNo; p++) { await clickCenter(page, { x: 1030, y: 650, w: 150, h: 50 }); await page.waitForTimeout(90); }
  const i = idx % 8; const bx = (i < 4) ? 100 : 720; const by = 150 + (i % 4) * 110;
  await clickCenter(page, { x: bx, y: by, w: 480, h: 80 });
  if (!await waitName(page, 'theory', 6000)) throw new Error('theory not open');
  await waitIdle(page, 4000);
}
async function waitForLessonQuestion(page, tag) {
  await clickCenter(page, { x: 810, y: 300, w: 300, h: 70 });
  if (!await waitName(page, 'lesson', 8000)) throw new Error('lesson not started');
  await waitIdle(page, 4000);
  const t0 = Date.now();
  while (Date.now() - t0 < 8000) {
    const q = await probeLesson(page);
    if (q && q.buttons && q.buttons.length === 4 && q.q) return q;
    if (q.state !== 'lesson') throw new Error('lesson exited early: ' + q.state);
    await page.waitForTimeout(50);
  }
  throw new Error('no question in lesson');
}
async function playOneLessonToVictory(page, tag) {
  await goLessonSelect(page);
  await openLessonByIndex(page, 0);
  await waitForLessonQuestion(page, tag);
  for (let i = 0; i < 15; i++) {
    const r = await answerOneCorrect(page, tag + ' q' + (i + 1));
    if (r.ended && (r.state === 'victory' || r.state === 'defeat')) return r.state;
    if (r.ended) return r.state;
    await page.waitForTimeout(35);
  }
  return await cur(page);
}


async function waitResultUi(page, name, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < (ms || 5000)) {
    const ok = await page.evaluate(function (n) { const s = window.Game.states.states[n]; return !!(s && s.showUi === true); }, name).catch(function () { return false; });
    if (ok) return true; await page.waitForTimeout(50);
  }
  return false;
}
async function backToMenu(page) {
  const name = await cur(page);
  if (name === 'menu') return;
  if (name === 'victory') { await waitResultUi(page, 'victory', 5000); await clickCenter(page, { x: 525, y: 680, w: 250, h: 60 }); }
  else if (name === 'defeat') { await waitResultUi(page, 'defeat', 5000); await clickCenter(page, { x: 660, y: 680, w: 250, h: 60 }); }
  else if (name === 'lesson') { await clickCenter(page, { x: 20, y: 720, w: 200, h: 60 }); }
  else { await page.evaluate(function () { window.Game.states.change('menu', null, null); }); }
  await waitName(page, 'menu', 6000); await waitIdle(page, 4000);
}
async function uiLogin(page, u, p) {
  const userRect = { x: 350, y: 410, w: 400, h: 50 };
  const passRect = { x: 350, y: 490, w: 400, h: 50 };
  const loginBtn = { x: 350, y: 580, w: 400, h: 60 };
  const field = async function (w) { return await page.evaluate(function (which) { const s = window.Game.states.states.login; return which === 'u' ? s.userInput : s.passInput; }, w); };
  const clearField = async function (rect) {
    await clickCenter(page, rect);
    await page.waitForTimeout(40);
    for (let k = 0; k < 26; k++) { await page.keyboard.press('Backspace'); }
    await page.waitForTimeout(40);
  };
  await waitName(page, 'login', 8000);
  /* LoadingState prefills the username from the saved session, so the field may
     already contain text — clear it first, otherwise typing APPENDS and the
     submitted username is wrong (401). */
  await clearField(userRect);
  await page.keyboard.type(u, { delay: 6 });
  let t0 = Date.now(); while (Date.now() - t0 < 4000) { if (await field('u') === u) break; await page.waitForTimeout(35); }
  await clearField(passRect);
  await page.keyboard.type(p, { delay: 6 });
  let t1 = Date.now(); while (Date.now() - t1 < 4000) { if (await field('p') === p) break; await page.waitForTimeout(35); }
  await clickCenter(page, loginBtn);
  if (!await waitName(page, 'menu', 10000)) throw new Error('login ' + u + ' did not reach menu');
  await waitIdle(page, 5000);
  return true;
}
async function registerUser(u, p) {
  const r = await fetch(BASE + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
  return r.status;
}
async function logout(page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await cur(page) === 'login') { await waitIdle(page, 4000); return; }
    const card = await page.evaluate(function () {
      const m = window.Game.states.states.menu; const c = (m.cards || []).filter(function (x) { return x.id === 'logout'; })[0];
      return c ? { x: c.x, y: c.y, w: c.w, h: c.h } : null;
    });
    if (!card) throw new Error('no logout card');
    await waitIdle(page, 4000);
    await clickCenter(page, card);
    if (await waitName(page, 'login', 8000)) { await waitIdle(page, 4000); return; }
    await page.waitForTimeout(400);
  }
  throw new Error('logout did not reach login (state=' + (await cur(page)) + ')');
}
async function vitals(page) {
  return await page.evaluate(function () {
    const p = window.Game.player;
    let marker = null, dlevel = null;
    try { const d = window.Game.auth && window.Game.auth.data ? window.Game.auth.data() : null; if (d) { marker = d.avatar_path; dlevel = d.level; } } catch (e) {}
    return { username: p ? p.username : null, level: p ? p.level : null, exp: p ? p.exp : null, gold: p ? p.gold : null, grade: p ? p.grade : null, marker: marker, dlevel: dlevel };
  });
}


/* ================= MAIN ================= */
(async function () {
  let server = null, browser = null;
  const started = Date.now();
  try {
    const s0 = await startServer(); server = s0.child;
    browser = await pw.chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
    page.on('pageerror', e => M.pageErrors.push(String(e && e.message)));
    page.on('console', m => { if (m.type() === 'error') M.consoleErrors.push(m.text()); });
    page.on('requestfailed', r => M.requestFailed.push(r.url().replace(BASE, '') + ' ' + ((r.failure() && r.failure().errorText) || '')));
    page.on('response', r => { const u = r.url(); if (u.startsWith(BASE) && r.status() >= 400 && r.status() < 500) M.net4xx.push(r.status() + ' ' + u.replace(BASE, '')); });

    const USERS = [];
    for (let i = 1; i <= 5; i++) USERS.push({ u: 'mu' + i + String(Date.now()).slice(-5), p: 'Mu' + i + 'Pass1!', i: i });
    for (const U of USERS) {
      const st = await registerUser(U.u, U.p);
      inv(st === 201 || st === 200, 'register ' + U.u + ' status=' + st);
      if (st === 201 || st === 200) M.usersRegistered++;
    }

    const recorded = {};
    for (const U of USERS) {
      await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      if (!await waitName(page, 'login', 15000)) throw new Error('login screen not reached for ' + U.u);
      await uiLogin(page, U.u, U.p);
      inv(await cur(page) === 'menu', U.u + ' login -> menu');
      await page.evaluate(function (mark) {
        if (window.Game.player) window.Game.player.level = 600;   // unlock every lesson
        const d = window.Game.auth && window.Game.auth.data ? window.Game.auth.data() : null;
        if (d) { d.level = 600; d.avatar_path = mark; }           // play-independent per-user marker
        if (window.Game.auth && typeof window.Game.auth.pushPlayerData === 'function') window.Game.auth.pushPlayerData();
      }, 'MU_MARK_' + U.i);
      await waitIdle(page, 3000);
      for (let li = 0; li < U.i; li++) {
        const st = await playOneLessonToVictory(page, U.u + '_L' + li);
        inv(st === 'victory' || st === 'defeat', U.u + ' lesson ' + li + ' completed (' + st + ')');
        await backToMenu(page);
        M.sessionsPlayed++;
      }
      await page.evaluate(function () { if (window.Game.auth && typeof window.Game.auth.pushPlayerData === 'function') window.Game.auth.pushPlayerData(); });
      await waitIdle(page, 2000);
      const v = await vitals(page); recorded[U.u] = v;
      inv(v.username === U.u, U.u + ' menu username correct (got ' + v.username + ')');
      inv(v.marker === 'MU_MARK_' + U.i, U.u + ' per-user marker persisted (got ' + v.marker + ')');
      inv(v.exp > 0, U.u + ' gained XP (got ' + v.exp + ')');
      inv(v.gold > 0, U.u + ' gained gold (got ' + v.gold + ')');
      await logout(page);
    }


    // 3) RE-LOGIN in SHUFFLED order — verify zero cross-user leakage
    const shuffled = USERS.slice().sort(function () { return Math.random() - 0.5; });
    console.log('MULTIUSER_SHUFFLED_SEQ=' + shuffled.map(function (u) { return u.u; }).join(','));
    for (const U of shuffled) {
      await uiLogin(page, U.u, U.p);
      inv(await cur(page) === 'menu', U.u + ' relogin -> menu');
      const v = await vitals(page); const exp = recorded[U.u];
      leak(v.username === U.u, U.u + ' relogin username correct (got ' + v.username + ')');
      leak(v.marker === 'MU_MARK_' + U.i, U.u + ' relogin marker matches OWN (got ' + v.marker + ' want MU_MARK_' + U.i + ')');
      leak(v.exp === exp.exp, U.u + ' relogin exp matches OWN (got ' + v.exp + ' want ' + exp.exp + ')');
      leak(v.gold === exp.gold, U.u + ' relogin gold matches OWN (got ' + v.gold + ' want ' + exp.gold + ')');
      leak(v.level === exp.level, U.u + ' relogin level matches OWN (got ' + v.level + ' want ' + exp.level + ')');
      await logout(page);
    }

    // 4) reload persistence
    await uiLogin(page, USERS[0].u, USERS[0].p);
    const before = await vitals(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitName(page, 'login', 15000);
    await uiLogin(page, USERS[0].u, USERS[0].p);
    const after = await vitals(page);
    relok(after.username === USERS[0].u, 'reload username preserved');
    relok(after.marker === before.marker, 'reload marker preserved (' + before.marker + ' -> ' + after.marker + ')');
    relok(after.exp === before.exp, 'reload exp preserved (' + before.exp + ' -> ' + after.exp + ')');
    relok(after.gold === before.gold, 'reload gold preserved (' + before.gold + ' -> ' + after.gold + ')');

    // 5) password change — the endpoint requires the live session cookie, so it
    //    must be driven from inside the page (a Node-side fetch has no cookie).
    const P = USERS[0];
    const chj = await page.evaluate(async function (a) {
      const r = await fetch('/api/auth/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ username: a.u, oldPassword: a.oldPw, newPassword: 'NewMu1!!1' })
      });
      let j = null; try { j = await r.json(); } catch (e) {}
      return { status: r.status, ok: !!(j && j.ok), error: j && j.error };
    }, { u: P.u, oldPw: P.p });
    pwc(!!chj && chj.ok === true, P.u + ' password change accepted (status=' + (chj && chj.status) + ' err=' + (chj && chj.error) + ')');
    await logout(page);
    const oldStatus = await page.evaluate(async function (a) {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: a.u, password: a.oldPw }) });
      return r.status;
    }, { u: P.u, oldPw: P.p });
    pwc(oldStatus === 401, P.u + ' old password rejected (got ' + oldStatus + ')');
    await uiLogin(page, P.u, 'NewMu1!!1');
    pwc(await cur(page) === 'menu', P.u + ' new password login works');
    await logout(page);
    await uiLogin(page, USERS[4].u, USERS[4].p);
    const v4 = await vitals(page);
    pwc(v4.username === USERS[4].u, 'user5 unaffected by user1 password change');
    pwc(v4.exp === recorded[USERS[4].u].exp, 'user5 exp unchanged by user1 pw change');
  } catch (err) {
    M.invariantFails.push('HARNESS EXCEPTION: ' + (err && err.stack ? err.stack : String(err)));
  } finally {
    try { if (browser) await browser.close(); } catch (e) {}
    try { if (server) server.kill(); } catch (e) {}
    const totalFails = M.invariantFails.length + M.leakageFails.length + M.reloadFails.length + M.pwFails.length + M.pageErrors.length;
    const secs = Math.round((Date.now() - started) / 1000);
    console.log('=== M11 MULTI-USER PERSISTENCE ===');
    console.log('DURATION_SECONDS=' + secs);
    console.log('USERS_REGISTERED=' + M.usersRegistered);
    console.log('SESSIONS_PLAYED=' + M.sessionsPlayed);
    console.log('QUESTIONS_ANSWERED=' + M.questions);
    console.log('INVARIANT_CHECKS=' + M.invariantChecks + ' FAILS=' + M.invariantFails.length);
    console.log('LEAKAGE_CHECKS=' + M.leakageChecks + ' FAILS=' + M.leakageFails.length);
    console.log('RELOAD_CHECKS=' + M.reloadChecks + ' FAILS=' + M.reloadFails.length);
    console.log('PW_CHECKS=' + M.pwChecks + ' FAILS=' + M.pwFails.length);
    console.log('CONSOLE_ERRORS=' + M.consoleErrors.length + ' PAGE_ERRORS=' + M.pageErrors.length);
    ['invariantFails', 'leakageFails', 'reloadFails', 'pwFails'].forEach(function (b) {
      M[b].slice(0, 40).forEach(function (m) { console.log('  FAIL[' + b + '] ' + m); });
    });
    M.pageErrors.slice(0, 10).forEach(function (m) { console.log('  PAGEERROR ' + m); });
    M.consoleErrors.slice(0, 20).forEach(function (m) { console.log('  CONSOLE ' + m); });
    console.log('M11_MULTIUSER: pass=' + (totalFails === 0 ? 1 : 0) + ' fail=' + totalFails);
    process.exit(totalFails === 0 ? 0 : 1);
  }
})();

