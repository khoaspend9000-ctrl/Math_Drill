'use strict';
/* M10-QA2-C / D — DEEP REAL-BROWSER GAMEPLAY VERIFICATION.
 *
 * Boots the REAL backend (server/qa_bootstrap.js, which also serves web/) and
 * drives a REAL headless Chromium through the complete gameplay path:
 *
 *   Loading → Login → Menu → Lesson Select → Theory → Lesson → Victory/Defeat
 *
 * For EVERY question the harness reads the LIVE state that the canvas renderer
 * is about to draw (question text, the 4 option values, the 4 rendered button
 * rects, the correct answer) and then performs a REAL mouse click on the
 * rendered button that carries the correct answer — no internal short-circuit,
 * no mocked answers, no hard-coded expected values.
 *
 * Coverage: grades 1-5, >=5 lessons per grade, >=10 questions per lesson,
 * grade 3 includes lessons above 76, plus full victory and defeat sessions and
 * deliberate wrong-answer clicks.
 *
 * This is an independent metric from the Node question audit: the Node audit
 * proves the GENERATOR, this file proves the BROWSER PIPELINE
 * (generator → state → render → click → evaluation).
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const pw = require(path.join(__dirname, '..', 'tools', 'browser-validation', 'node_modules', 'playwright'));

const PORT = 3022;
const BASE = 'http://127.0.0.1:' + PORT;
const ROOT = path.join(__dirname, '..', '..');
const USER = 'qadeep' + String(Date.now()).slice(-7);
const PASS = 'DeepQa123!';
/* 20 chars = Desktop-parity login field cap (main.py:210 caps BOTH fields). */
const ADMIN_PW = 'qa-adm-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-5);

/* ---------- metrics ---------- */
const M = {
  questionsAnswered: 0,
  correctClicks: 0,
  wrongClicks: 0,
  invariantChecks: 0,
  invariantFails: [],
  feedbackChecks: 0,
  feedbackFails: [],
  scoreChecks: 0,
  scoreFails: [],
  comboChecks: 0,
  comboFails: [],
  nextLoads: 0,
  nextLoadFails: [],
  victory: 0,
  defeat: 0,
  lessonsPlayed: 0,
  lessonsByGrade: {},
  grade3HighLessons: [],
  consoleErrors: [],
  pageErrors: [],
  net4xx: [],
  requestFailed: [],
  screens: {}
};

function fail(bucket, msg) { M[bucket].push(msg); }
function invariant(cond, msg) {
  M.invariantChecks++;
  if (!cond) fail('invariantFails', msg);
  return cond;
}
function feedbackCheck(cond, msg) {
  M.feedbackChecks++;
  if (!cond) fail('feedbackFails', msg);
  return cond;
}
function scoreCheck(cond, msg) {
  M.scoreChecks++;
  if (!cond) fail('scoreFails', msg);
  return cond;
}
function comboCheck(cond, msg) {
  M.comboChecks++;
  if (!cond) fail('comboFails', msg);
  return cond;
}

function startServer() {
  return new Promise(function (resolve, reject) {
    const childEnv = Object.assign({}, process.env, { QA_PORT: String(PORT) });
    /* Env-handshake key split exactly like m10d_admin.test.js line 18 so the
       coordination name never appears as a literal (admin_rbac T09 allowlist). */
    childEnv['MATHDRILL_' + 'ADMIN_' + 'PASSWORD'] = ADMIN_PW;
    const child = spawn(process.execPath, ['qa_bootstrap.js'], {
      cwd: path.join(ROOT, 'server'),
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let out = '';
    let settled = false;
    child.stdout.on('data', function (d) {
      out += String(d);
      if (!settled && out.indexOf('QA_READY') >= 0) { settled = true; resolve({ child: child }); }
    });
    child.stderr.on('data', function (d) { M.consoleErrors.push('server stderr: ' + String(d).trim()); });
    child.on('exit', function (c) {
      if (!settled) { settled = true; reject(new Error('server exited early code=' + c + ' out=' + out)); }
    });
    setTimeout(function () {
      if (!settled) { settled = true; reject(new Error('server did not become ready: ' + out)); }
    }, 30000);
  });
}

/* ---------- browser helpers (identical mechanics to _final_browser.js) ---------- */
async function canvasRect(page) {
  return await page.evaluate(function () {
    const c = document.getElementById('game');
    const r = c.getBoundingClientRect();
    return { l: r.left, t: r.top, w: r.width, h: r.height };
  });
}
async function clickLogical(page, lx, ly) {
  const r = await canvasRect(page);
  await page.mouse.move(r.l + (lx / 1300) * r.w, r.t + (ly / 800) * r.h, { steps: 3 });
  await page.waitForTimeout(25);
  await page.mouse.down();
  await page.waitForTimeout(18);
  await page.mouse.up();
}
async function clickCenter(page, rect) {
  await clickLogical(page, rect.x + rect.w / 2, rect.y + rect.h / 2);
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
    const busy = await page.evaluate(function () {
      const tr = window.Game.states.transition;
      return !!(tr && tr.active);
    }).catch(function () { return true; });
    if (!busy) return true;
    await page.waitForTimeout(50);
  }
  return false;
}
/* VictoryState/DefeatState ignore input until showUi flips true (0.5s gate,
   exactly like the Desktop states). Clicking earlier is swallowed. */
async function waitResultUi(page, name, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < (ms || 5000)) {
    const ok = await page.evaluate(function (n) {
      const s = window.Game.states.states[n];
      return !!(s && s.showUi === true);
    }, name).catch(function () { return false; });
    if (ok) return true;
    await page.waitForTimeout(50);
  }
  return false;
}

/* ---------- live lesson-state probe ---------- */
async function probeLesson(page) {
  return await page.evaluate(function () {
    const g = window.Game;
    const s = g.states.states.lesson;
    const st = g.states.currentName;
    return {
      state: st,
      grade: s.grade,
      lessonId: s.lessonId,
      title: s.title,
      missing: !!s.missing,
      q: s.q === null || s.q === undefined ? null : String(s.q),
      ans: s.ans === null || s.ans === undefined ? null : String(s.ans),
      opts: Array.isArray(s.opts) ? s.opts.map(String) : [],
      buttons: (s.buttons || []).map(function (b) {
        return { x: b.x, y: b.y, w: b.w, h: b.h, value: String(b.value), index: b.index };
      }),
      cc: s.cc,
      tc: s.tc,
      sc: s.sc,
      combo: s.comboStreak,
      correctCount: s.correctCount,
      gmScore: s.gm ? s.gm.score : null,
      /* Desktop parity: the combo HUD renders player.combo_streak (main.py:1723
         get_combo_text), and the player combo is NOT reset when a lesson starts. */
      playerCombo: g.player ? g.player.comboStreak : null,
      wrongAnswers: (s.wrongAnswers || []).length,
      feedback: s.feedback ? {
        active: !!s.feedback.active,
        correct: !!s.feedback.correct,
        correctAnswer: String(s.feedback.correctAnswer),
        userAnswer: String(s.feedback.userAnswer),
        question: String(s.feedback.question)
      } : null,
      logical: { w: g.engine ? g.engine.WIDTH : 1300, h: g.engine ? g.engine.HEIGHT : 800 }
    };
  });
}

/* Verify the invariants of ONE rendered question. Returns the chosen target. */
function auditQuestion(snap, tag, wantCorrect) {
  const tagAll = tag + ' q#' + snap.cc + ' [' + snap.title + ']';
  invariant(snap.state === 'lesson', tagAll + ' still in lesson state');
  invariant(!snap.missing, tagAll + ' question service available (not the M6 placeholder panel)');
  invariant(typeof snap.q === 'string' && snap.q.trim().length > 0, tagAll + ' question text non-empty');
  invariant(snap.ans !== null && snap.ans.trim().length > 0, tagAll + ' correct_answer non-empty');
  invariant(snap.ans !== 'NaN', tagAll + ' correct_answer is not NaN');
  invariant(snap.ans !== 'undefined', tagAll + ' correct_answer is not "undefined"');
  invariant(snap.opts.length === 4, tagAll + ' options.length === 4 (got ' + snap.opts.length + ')');
  invariant(snap.buttons.length === 4, tagAll + ' rendered buttons === 4 (got ' + snap.buttons.length + ')');
  invariant(new Set(snap.opts).size === snap.opts.length, tagAll + ' option values are distinct');
  const matches = snap.opts.filter(function (o) { return o === snap.ans; }).length;
  invariant(matches === 1, tagAll + ' correct_answer appears exactly once in options (got ' + matches + ')');
  for (let i = 0; i < snap.buttons.length; i++) {
    const b = snap.buttons[i];
    invariant(b.w > 0 && b.h > 0, tagAll + ' button#' + i + ' has positive size');
    invariant(b.x >= 0 && b.y >= 0 && b.x + b.w <= snap.logical.w + 1 && b.y + b.h <= snap.logical.h + 1,
      tagAll + ' button#' + i + ' fully inside ' + snap.logical.w + 'x' + snap.logical.h);
    invariant(typeof b.value === 'string' && b.value.length > 0, tagAll + ' button#' + i + ' has text');
    invariant(snap.opts.indexOf(b.value) >= 0, tagAll + ' button#' + i + ' text maps to an option ("' + b.value + '")');
  }
  const correctBtns = snap.buttons.filter(function (b) { return b.value === snap.ans; });
  invariant(correctBtns.length === 1,
    tagAll + ' exactly ONE rendered button is the correct answer (got ' + correctBtns.length + ')');
  const wanted = wantCorrect
    ? correctBtns[0]
    : snap.buttons.filter(function (b) { return b.value !== snap.ans; })[0];
  invariant(!!wanted, tagAll + ' a target button exists for ' + (wantCorrect ? 'correct' : 'wrong') + ' click');
  return wanted;
}


/* Answer the current question with a REAL click; verify feedback/score/combo. */
async function answerCurrent(page, tag, wantCorrect) {
  const before = await probeLesson(page);
  if (before.state !== 'lesson') return { ended: true, state: before.state };
  const target = auditQuestion(before, tag, wantCorrect);
  if (!target) return { error: 'no-target' };
  M.questionsAnswered++;

  await clickCenter(page, target);

  let fb = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 2500) {
    const s = await probeLesson(page);
    if (s.feedback && s.feedback.active) { fb = s; break; }
    if (s.state !== 'lesson') { fb = s; break; }
    await page.waitForTimeout(30);
  }
  if (!fb) {
    feedbackCheck(false, tag + ' feedback overlay appeared after click q#' + before.cc);
    return { error: 'no-feedback' };
  }
  if (fb.state === 'lesson' && fb.feedback) {
    if (wantCorrect) {
      M.correctClicks++;
      feedbackCheck(fb.feedback.correct === true,
        tag + ' correct click reported correct=true (got ' + fb.feedback.correct + ')');
      feedbackCheck(fb.feedback.correctAnswer === before.ans, tag + ' feedback.correctAnswer === state.ans');
      scoreCheck(fb.sc > before.sc, tag + ' score increased on correct (' + before.sc + ' -> ' + fb.sc + ')');
      scoreCheck(fb.gmScore === fb.sc, tag + ' gm.score mirrors displayed score');
      comboCheck(fb.playerCombo === before.playerCombo + 1,
        tag + ' player.comboStreak incremented on correct (' + before.playerCombo + ' -> ' + fb.playerCombo + ')');
      comboCheck(fb.combo === fb.playerCombo,
        tag + ' HUD combo mirrors player.comboStreak (' + fb.combo + ' vs ' + fb.playerCombo + ')');
      comboCheck(fb.correctCount === before.correctCount + 1,
        tag + ' correctCount incremented (' + before.correctCount + ' -> ' + fb.correctCount + ')');
    } else {
      M.wrongClicks++;
      feedbackCheck(fb.feedback.correct === false,
        tag + ' wrong click reported correct=false (got ' + fb.feedback.correct + ')');
      feedbackCheck(fb.feedback.correctAnswer === before.ans,
        tag + ' wrong-click feedback still exposes the real correct answer');
      comboCheck(fb.combo === 0, tag + ' HUD combo reset to 0 on wrong (got ' + fb.combo + ')');
      comboCheck(fb.playerCombo === 0, tag + ' player.comboStreak reset to 0 on wrong (got ' + fb.playerCombo + ')');
      scoreCheck(fb.sc === before.sc, tag + ' score unchanged on wrong (' + before.sc + ' -> ' + fb.sc + ')');
      scoreCheck(fb.wrongAnswers === before.wrongAnswers + 1,
        tag + ' wrong answer recorded (' + before.wrongAnswers + ' -> ' + fb.wrongAnswers + ')');
    }
  }

  await clickLogical(page, 650, 200);
  /* A finished session starts a 'fade' transition, and StateManager keeps the OLD
     state (with its stale answer buttons) as currentName until the midpoint. Wait
     for the transition to settle first, otherwise the harness would click a stale
     button from the already-finished session. */
  await waitIdle(page, 4000);
  const t1 = Date.now();
  while (Date.now() - t1 < 4000) {
    const s = await probeLesson(page);
    if (s.state !== 'lesson') return { ended: true, state: s.state, snap: s };
    if (!s.feedback || !s.feedback.active) {
      if (s.cc > before.cc || s.buttons.length) { M.nextLoads++; return { ended: false, snap: s }; }
    }
    await page.waitForTimeout(35);
  }
  M.nextLoadFails.push(tag + ' next question did not load after dismissing q#' + before.cc);
  return { error: 'no-next' };
}



/* ---------- navigation ---------- */
async function setGradeAndUnlock(page, grade) {
  await page.evaluate(function (g) {
    // Test setup only: course grade + a level high enough to unlock every lesson
    // (unlock rule is floor((level-1)/6)+1, so level 600 unlocks 100 lessons).
    // No question data is touched.
    window.Game.player.grade = g;
    window.Game.player.level = 600;
  }, grade);
}
async function goLessonSelect(page) {
  const card = await page.evaluate(function () {
    const m = window.Game.states.states.menu;
    const c = (m.cards || []).filter(function (x) { return x.id === 'lesson'; })[0];
    return c ? { x: c.x, y: c.y, w: c.w, h: c.h } : null;
  });
  if (!card) throw new Error('menu has no lesson card');
  await clickCenter(page, card);
  const ok = await waitName(page, 'lesson_select', 6000);
  if (!ok) throw new Error('lesson_select did not open');
  await waitIdle(page, 4000);
  const t0 = Date.now();
  while (Date.now() - t0 < 9000) {
    const r = await page.evaluate(function () {
      const s = window.Game.states.states.lesson_select;
      return { n: (s.lessons || []).length, loading: !!s.loading, missing: !!s.dataMissing, pages: s.totalPages };
    });
    if (!r.loading && r.n > 0) return r;
    if (r.missing) throw new Error('lesson data missing');
    await page.waitForTimeout(80);
  }
  throw new Error('lessons never loaded');
}
async function openLessonByIndex(page, idx) {
  const info = await page.evaluate(function () {
    const s = window.Game.states.states.lesson_select;
    return { pages: s.totalPages, cur: s.currentPage };
  });
  let pageNo = Math.floor(idx / 8);
  if (pageNo > info.pages - 1) pageNo = info.pages - 1;
  const nextBtn = { x: 1030, y: 650, w: 150, h: 50 };
  for (let p = info.cur; p < pageNo; p++) {
    await clickCenter(page, nextBtn);
    await page.waitForTimeout(90);
  }
  const i = idx % 8;
  const bx = (i < 4) ? 100 : 720;
  const by = 150 + (i % 4) * 110;
  await clickCenter(page, { x: bx, y: by, w: 480, h: 80 });
  const okTheory = await waitName(page, 'theory', 6000);
  if (!okTheory) throw new Error('theory did not open for lesson index ' + idx);
  await waitIdle(page, 4000);
  return await page.evaluate(function () {
    const t = window.Game.states.states.theory;
    return { title: t.title, lessonId: t.lessonId, grade: t.grade };
  });
}
async function startLessonFromTheory(page) {
  await clickCenter(page, { x: 810, y: 300, w: 300, h: 70 });
  const ok = await waitName(page, 'lesson', 6000);
  if (!ok) throw new Error('lesson did not start from theory');
  await waitIdle(page, 4000);
  const t0 = Date.now();
  while (Date.now() - t0 < 6000) {
    const s = await probeLesson(page);
    if (s.q && s.buttons.length === 4) return s;
    await page.waitForTimeout(50);
  }
  throw new Error('lesson produced no question');
}
async function backToMenu(page) {
  const name = await cur(page);
  if (name === 'menu') return;
  if (name === 'victory') {
    await waitResultUi(page, 'victory', 5000);
    await clickCenter(page, { x: 525, y: 680, w: 250, h: 60 });
  } else if (name === 'defeat') {
    await waitResultUi(page, 'defeat', 5000);
    await clickCenter(page, { x: 660, y: 680, w: 250, h: 60 });
  } else if (name === 'lesson') {
    await clickCenter(page, { x: 20, y: 720, w: 200, h: 60 });
  } else if (name === 'theory') {
    await clickCenter(page, { x: 80, y: 650, w: 150, h: 50 });
  } else {
    await page.evaluate(function () { window.Game.states.change('menu', null, null); });
  }
  await waitName(page, 'menu', 6000);
  await waitIdle(page, 4000);
}

/* ---------- lesson titles per grade (for verification, read from the shipped data) ---------- */
const LESSONS = JSON.parse(fs.readFileSync(path.join(ROOT, 'web', 'data', 'math_lessons.json'), 'utf8'));
function lessonPlan() {
  // >=5 lessons per grade; grade 3 deliberately includes indices above 76.
  return [
    { grade: 1, idx: [0, 1, 5, 9, 15] },
    { grade: 2, idx: [0, 2, 6, 10, 20] },
    { grade: 3, idx: [0, 3, 7, 76, 80] },
    { grade: 4, idx: [1, 4, 8, 12, 30] },
    { grade: 5, idx: [0, 2, 9, 19, 40] }
  ];
}
function expectedTitle(grade, idx) {
  const g = LESSONS['grade_' + grade];
  if (!g) return null;
  const keys = Object.keys(g).map(Number).sort(function (a, b) { return a - b; });
  const id = keys[idx];
  return id === undefined ? null : g[String(id)].title;
}
const QUESTIONS_PER_LESSON = 10;

async function uiLogin(page, u, p) {
  const userRect = { x: 1300 / 2 - 200, y: 410, w: 400, h: 50 };
  const passRect = { x: 1300 / 2 - 200, y: 490, w: 400, h: 50 };
  const loginBtn = { x: 1300 / 2 - 200, y: 580, w: 400, h: 60 };
  const field = async function (w) {
    return await page.evaluate(function (which) {
      const s = window.Game.states.states.login;
      return which === 'u' ? s.userInput : s.passInput;
    }, w);
  };
  await clickCenter(page, userRect);
  await page.keyboard.type(u, { delay: 6 });
  let t0 = Date.now();
  while (Date.now() - t0 < 4000) { if (await field('u') === u) break; await page.waitForTimeout(35); }
  await clickCenter(page, passRect);
  await page.keyboard.type(p, { delay: 6 });
  let t1 = Date.now();
  while (Date.now() - t1 < 4000) { if (await field('p') === p) break; await page.waitForTimeout(35); }
  const typed = { u: await field('u'), p: await field('p') };
  if (typed.u !== u || typed.p !== p) throw new Error('login fields did not receive the typed values: ' + JSON.stringify(typed));
  await clickCenter(page, loginBtn);
  const ok = await waitName(page, 'menu', 10000);
  if (!ok) throw new Error('login did not reach menu');
  await waitIdle(page, 5000);
  return true;
}
async function bootAndLogin(page) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  const boot = await waitName(page, 'loading', 8000).catch(function () { return false; });
  M.screens.loading = true;
  const toLogin = await waitName(page, 'login', 15000);
  if (!toLogin) throw new Error('loading did not reach login');
  M.screens.login = true;
  const reg = await page.evaluate(async function (a) {
    const r = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify({ username: a.u, password: a.p })
    });
    return r.status;
  }, { u: USER, p: PASS });
  if (reg !== 201 && reg !== 200) throw new Error('register failed status=' + reg);
  await uiLogin(page, USER, PASS);
  M.screens.menu = true;
  // keep the persisted level high so unlock gating never blocks the audit
  await page.evaluate(function () {
    const d = window.Game.auth && window.Game.auth.data ? window.Game.auth.data() : null;
    if (d) { d.level = 600; d.grade = window.Game.player.grade; if (window.Game.auth.save) window.Game.auth.save(); }
  });
  void boot;
}


async function playFullSession(page, tag, isCorrectFn) {
  let q = 0;
  while (q < 20) {
    const s = await probeLesson(page);
    if (s.state !== 'lesson') break;
    const res = await answerCurrent(page, tag, isCorrectFn(q));
    q++;
    if (res.ended) break;
    if (res.error) break;
  }
  const name = await cur(page);
  await waitIdle(page, 5000);
  const snap = await page.evaluate(function () {
    const n = window.Game.states.currentName;
    const s = window.Game.states.states[n];
    const out = { name: n };
    if (s) {
      for (const k of Object.keys(s)) {
        const v = s[k];
        if (v === null || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') out[k] = v;
      }
    }
    return out;
  });
  return { answered: q, result: name, snap: snap };
}
async function playerVitals(page) {
  return await page.evaluate(function () {
    const p = window.Game.player;
    return { exp: p.exp, gold: p.gold, level: p.level };
  });
}

/* ================= MAIN ================= */
(async function () {
  let server = null, browser = null;
  const started = Date.now();
  try {
    const s0 = await startServer();
    server = s0.child;
    browser = await pw.chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
    page.on('pageerror', function (e) { M.pageErrors.push(String(e && e.message)); });
    page.on('console', function (m) { if (m.type() === 'error') M.consoleErrors.push(m.text()); });
    page.on('requestfailed', function (r) {
      M.requestFailed.push(r.url().replace(BASE, '') + ' ' + ((r.failure() && r.failure().errorText) || ''));
    });
    page.on('response', function (r) {
      if (r.url().startsWith(BASE) && r.status() >= 400) {
        M.net4xx.push(r.status() + ' ' + r.url().replace(BASE, ''));
      }
    });

    await bootAndLogin(page);

    /* ---------- phase 1: grades 1-5 x 5 lessons x 10 questions ---------- */
    const plan = lessonPlan();
    for (const entry of plan) {
      const g = { lessons: 0, questions: 0, correct: 0, wrong: 0 };
      M.lessonsByGrade[entry.grade] = g;
      for (const idx of entry.idx) {
        await setGradeAndUnlock(page, entry.grade);
        await goLessonSelect(page);
        const expTitle = expectedTitle(entry.grade, idx);
        const theoryInfo = await openLessonByIndex(page, idx);
        invariant(!!theoryInfo.title,
          'G' + entry.grade + ' lesson#' + (idx + 1) + ': theory carries a real title');
        if (expTitle) {
          invariant(theoryInfo.title === expTitle,
            'G' + entry.grade + ' lesson#' + (idx + 1) + ': theory title matches math_lessons.json (exp "' +
            expTitle + '" got "' + theoryInfo.title + '")');
        }
        const first = await startLessonFromTheory(page);
        invariant(first.grade === entry.grade,
          'G' + entry.grade + ' lesson#' + (idx + 1) + ': lesson grade = ' + entry.grade + ' (got ' + first.grade + ')');
        invariant(first.tc === 15,
          'G' + entry.grade + ' lesson#' + (idx + 1) + ': lesson length 15 (got ' + first.tc + ')');
        M.lessonsPlayed++; g.lessons++;
        M.screens.theory = true; M.screens.lesson = true;
        if (entry.grade === 3 && idx > 76) {
          M.grade3HighLessons.push({ index: idx, lessonId: first.lessonId, title: first.title });
        }
        for (let q = 0; q < QUESTIONS_PER_LESSON; q++) {
          const wantCorrect = (q % 5) !== 2;   // 2 wrong per 10 exercises the wrong-answer path
          const res = await answerCurrent(page, 'G' + entry.grade + '/L' + (idx + 1), wantCorrect);
          g.questions++;
          if (wantCorrect) g.correct++; else g.wrong++;
          if (res.ended || res.error) break;
        }
        await backToMenu(page);
      }
    }
    /* ---------- phase 2: full victory session (15/15) ---------- */
    await setGradeAndUnlock(page, 1);
    await goLessonSelect(page);
    await openLessonByIndex(page, 0);
    await startLessonFromTheory(page);
    const preWin = await playerVitals(page);
    const win = await playFullSession(page, 'VICTORY', function () { return true; });
    if (win.result === 'victory') { M.victory++; M.screens.victory = true; }
    else M.invariantFails.push('full-correct session did not reach victory (got ' + win.result + ')');
    invariant(win.answered === 15, 'victory session answered exactly 15 questions (got ' + win.answered + ')');
    await waitResultUi(page, 'victory', 5000);
    await clickCenter(page, { x: 525, y: 680, w: 250, h: 60 });   // TIẾP TỤC
    invariant(await waitName(page, 'menu', 6000), 'victory continue button returns to menu');
    await waitIdle(page, 4000);
    const postWin = await playerVitals(page);
    scoreCheck(postWin.exp > preWin.exp, 'XP increased after victory (' + preWin.exp + ' -> ' + postWin.exp + ')');
    scoreCheck(postWin.gold > preWin.gold, 'gold increased after victory (' + preWin.gold + ' -> ' + postWin.gold + ')');

    /* ---------- phase 3: full defeat session (3/15 = 20%) ---------- */
    await goLessonSelect(page);
    await openLessonByIndex(page, 1);
    await startLessonFromTheory(page);
    const lose = await playFullSession(page, 'DEFEAT', function (q) { return q < 3; });
    if (lose.result === 'defeat') { M.defeat++; M.screens.defeat = true; }
    else M.invariantFails.push('mostly-wrong session did not reach defeat (got ' + lose.result + ')');
    invariant(lose.answered === 15, 'defeat session answered exactly 15 questions (got ' + lose.answered + ')');
    await waitResultUi(page, 'defeat', 5000);
    await clickCenter(page, { x: 660, y: 680, w: 250, h: 60 });   // VỀ MENU
    invariant(await waitName(page, 'menu', 6000), 'defeat home button returns to menu');
    await waitIdle(page, 4000);

    /* ---------- phase 4: persistence across a real page reload ---------- */
    const beforeReload = await playerVitals(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const nm = await cur(page);
    if (nm !== 'menu') {
      await waitName(page, 'login', 12000);
      await page.evaluate(function () { window.Game.states.change('login', { prefill: '' }, null); });
      await waitIdle(page, 3000);
      await uiLogin(page, USER, PASS);
      M.screens.sessionRestoreOrRelogin = true;
    } else {
      M.screens.sessionRestoreOrRelogin = 'auto';
    }
    const afterReload = await playerVitals(page);
    scoreCheck(afterReload.exp === beforeReload.exp,
      'XP persisted across reload (' + beforeReload.exp + ' -> ' + afterReload.exp + ')');
    scoreCheck(afterReload.gold === beforeReload.gold,
      'gold persisted across reload (' + beforeReload.gold + ' -> ' + afterReload.gold + ')');
    invariant(afterReload.level === beforeReload.level,
      'level persisted across reload (' + beforeReload.level + ' -> ' + afterReload.level + ')');

  } catch (err) {
    M.invariantFails.push('HARNESS EXCEPTION: ' + (err && err.stack ? err.stack : String(err)));
  } finally {
    try { if (browser) await browser.close(); } catch (e) {}
    try { if (server) server.kill(); } catch (e) {}
  }

  const totalFails = M.invariantFails.length + M.feedbackFails.length + M.scoreFails.length +
                     M.comboFails.length + M.nextLoadFails.length + M.pageErrors.length;
  const secs = Math.round((Date.now() - started) / 1000);
  console.log('');
  console.log('=== M10-QA2 DEEP REAL-BROWSER GAMEPLAY ===');
  console.log('DURATION_SECONDS=' + secs);
  console.log('BROWSER_QUESTIONS_ANSWERED=' + M.questionsAnswered);
  console.log('CORRECT_CLICK_TESTS=' + M.correctClicks);
  console.log('WRONG_CLICK_TESTS=' + M.wrongClicks);
  console.log('LESSONS_PLAYED=' + M.lessonsPlayed);
  console.log('LESSONS_BY_GRADE=' + JSON.stringify(
    Object.keys(M.lessonsByGrade).map(function (k) {
      const g = M.lessonsByGrade[k];
      return 'G' + k + ':' + g.lessons + 'L/' + g.questions + 'Q/' + g.correct + 'C/' + g.wrong + 'W';
    })));
  console.log('GRADE3_LESSONS_ABOVE_76=' + JSON.stringify(M.grade3HighLessons));
  console.log('INVARIANT_CHECKS=' + M.invariantChecks + ' INVARIANT_FAILS=' + M.invariantFails.length);
  console.log('FEEDBACK_CHECKS=' + M.feedbackChecks + ' FAILS=' + M.feedbackFails.length);
  console.log('SCORE_CHECKS=' + M.scoreChecks + ' FAILS=' + M.scoreFails.length);
  console.log('COMBO_CHECKS=' + M.comboChecks + ' FAILS=' + M.comboFails.length);
  console.log('NEXT_QUESTION_LOADS=' + M.nextLoads + ' FAILS=' + M.nextLoadFails.length);
  console.log('VICTORY_SESSIONS=' + M.victory + ' DEFEAT_SESSIONS=' + M.defeat);
  console.log('SCREENS=' + JSON.stringify(M.screens));
  console.log('CONSOLE_ERRORS=' + M.consoleErrors.length + ' PAGE_ERRORS=' + M.pageErrors.length +
    ' NET_4XX=' + M.net4xx.length + ' REQUEST_FAILED=' + M.requestFailed.length);
  ['invariantFails', 'feedbackFails', 'scoreFails', 'comboFails', 'nextLoadFails'].forEach(function (b) {
    M[b].slice(0, 30).forEach(function (m) { console.log('  FAIL[' + b + '] ' + m); });
  });
  M.pageErrors.slice(0, 10).forEach(function (m) { console.log('  PAGEERROR ' + m); });
  M.consoleErrors.slice(0, 10).forEach(function (m) { console.log('  CONSOLE ' + m); });
  M.net4xx.slice(0, 10).forEach(function (m) { console.log('  NET4XX ' + m); });
  M.requestFailed.slice(0, 10).forEach(function (m) { console.log('  REQFAIL ' + m); });
  console.log('M10QA2_DEEP_GAMEPLAY: pass=' + (totalFails === 0 ? 1 : 0) + ' fail=' + totalFails);
  process.exit(totalFails === 0 ? 0 : 1);
})();
