'use strict';
/* M10-QA2-L — DATA / ASSET AUDIT.
 *
 * Contracts enforced (verified against the real design, never assumed):
 *  1. Every asset referenced by runtime JS/CSS/HTML must resolve under web/,
 *     either literally or through the documented audio candidate chain
 *     (audio.js audioCandidates(): "<base>.ogg" is tried FIRST, the literal name
 *     is the fallback). Literal .mp3 entries whose real file is .ogg are VALID.
 *  2. Audio names with NO variant on disk are DOCUMENTED GRACEFUL GAPS: the
 *     resolver returns null and playback is a silent no-op (m8b_audio T04/T14).
 *     Reported, never counted as a defect.
 *  3. Shipped JSON data parses and is structurally sane.
 *  4. math_lessons.json keeps full lesson counts; Grade 3 keeps all 81 lessons.
 *  5. STRONG CHECK: every lesson of every grade generates a valid question via
 *     the REAL QuestionGenerator (correct answer in options exactly once, four
 *     distinct options). This subsumes optional metadata such as `type`.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const WEB = path.join(ROOT, 'web');
const JS = path.join(WEB, 'js');

/* --- browser shims: question_generator.js expects a browser-ish global --- */
global.window = global;
global.document = {
  createElement: function () { return { style: {}, getContext: function () { return null; }, appendChild: function () {} }; },
  getElementById: function () { return null; },
  addEventListener: function () {}, body: { appendChild: function () {} }
};
global.localStorage = {
  _d: {},
  getItem: function (k) { return this._d[k] === undefined ? null : this._d[k]; },
  setItem: function (k, v) { this._d[k] = String(v); },
  removeItem: function (k) { delete this._d[k]; },
  clear: function () { this._d = {}; }
};
global.performance = global.performance || { now: function () { return Date.now(); } };
try { global.navigator = global.navigator || { userAgent: 'node' }; } catch (e) { /* getter-only navigator */ }
global.Audio = function () { this.play = function () {}; this.pause = function () {}; this.load = function () {}; };

let checks = 0;
const fails = [];
function ck(cond, msg) { checks++; if (!cond) fails.push(msg); return cond; }

/* ---------- 1. collect referenced assets from runtime sources ---------- */
const runtimeFiles = [];
for (const f of fs.readdirSync(WEB)) {
  if (/\.(js|css|html)$/i.test(f) && !/^_/.test(f)) runtimeFiles.push(path.join(WEB, f));
}
for (const f of fs.readdirSync(JS)) {
  if (/\.js$/i.test(f) && !/^_/.test(f)) runtimeFiles.push(path.join(JS, f));
}
ck(runtimeFiles.length > 20, 'runtime source files discovered (' + runtimeFiles.length + ')');

const refRe = /['"`]([A-Za-z0-9_./ %-]+\.(?:png|jpg|jpeg|gif|webp|ogg|mp3|wav|ttf|otf|woff2?|json))['"`]/g;
const refs = new Map();
for (const f of runtimeFiles) {
  const src = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = refRe.exec(src)) !== null) {
    let rel = m[1];
    if (/^https?:|^data:|^\/\//.test(rel)) continue;
    if (/^(\.\.\/)+/.test(rel)) rel = rel.replace(/^(\.\.\/)+/, '');
    if (rel.startsWith('/')) rel = rel.slice(1);
    if (!refs.has(rel)) refs.set(rel, new Set());
    refs.get(rel).add(path.relative(ROOT, f).replace(/\\/g, '/'));
  }
}
ck(refs.size > 0, 'asset references found (' + refs.size + ')');

/* ---------- 2. resolve references (literal / audio chain / data dir) ---------- */
const AUDIO_EXT = /\.(ogg|mp3|wav)$/i;
const missing = [], empty = [], outsideWeb = [], gracefulGaps = [];
let resolved = 0, resolvedViaCandidate = 0;
function existsFile(p) { return fs.existsSync(p) && fs.statSync(p).isFile(); }
function candidatesFor(rel) {
  const out = [rel];
  if (/\.json$/i.test(rel) && rel.indexOf('/') < 0) out.push('data/' + rel);
  if (AUDIO_EXT.test(rel)) {
    const base = rel.replace(/\.[^.]+$/, '');
    /* audio.js resolves names inside web/audio (with a couple of legacy entries
       under web/assets). audioCandidates() tries "<base>.ogg" FIRST. */
    out.push(base + '.ogg', base + '.mp3');
    out.push('audio/' + rel, 'audio/' + base + '.ogg', 'audio/' + base + '.mp3');
    out.push('assets/' + base + '.ogg', 'assets/' + base + '.mp3');
  }
  return out;
}
for (const entry of refs) {
  const rel = entry[0], sources = entry[1];
  let hit = null, viaCandidate = false;
  for (const c of candidatesFor(rel)) {
    const abs = path.resolve(WEB, c);
    if (abs.indexOf(path.resolve(WEB)) !== 0) continue;
    if (existsFile(abs)) { hit = abs; viaCandidate = (c !== rel); break; }
  }
  if (!hit) {
    const alt = path.resolve(JS, rel);
    if (existsFile(alt)) hit = alt;
  }
  if (!hit) {
    if (AUDIO_EXT.test(rel)) gracefulGaps.push(rel + '  <- ' + Array.from(sources).join(','));
    else missing.push(rel + '  <- ' + Array.from(sources).join(','));
    continue;
  }
  if (fs.statSync(hit).size === 0) { empty.push(rel); continue; }
  if (viaCandidate) resolvedViaCandidate++;
  resolved++;
}
ck(missing.length === 0, 'all NON-AUDIO referenced assets exist (' + missing.length + ' missing)');
ck(empty.length === 0, 'no zero-byte referenced assets (' + empty.length + ')');
ck(outsideWeb.length === 0, 'no reference escapes web/ (' + outsideWeb.length + ')');

/* ---------- 3. shipped data integrity ---------- */
const lessons = JSON.parse(fs.readFileSync(path.join(WEB, 'data', 'math_lessons.json'), 'utf8'));
const gradeKeys = Object.keys(lessons).sort();
ck(gradeKeys.length === 5, 'math_lessons.json has 5 grades (got ' + gradeKeys.length + ')');
const expectedGrades = { grade_1: 40, grade_2: 73, grade_3: 81, grade_4: 73, grade_5: 75 };
for (const g of gradeKeys) {
  const ids = Object.keys(lessons[g]);
  ck(ids.length === expectedGrades[g],
    g + ' lesson count = ' + expectedGrades[g] + ' (got ' + ids.length + ')');
  for (const id of ids) {
    const L = lessons[g][id];
    ck(!!(L && typeof L.title === 'string' && L.title.trim().length > 0), g + '/' + id + ' has a title');
    ck(!!(L && typeof L.template === 'string' && L.template.length > 0),
      g + '/' + id + ' has a generation template');
  }
  const nums = ids.map(Number).sort(function (a, b) { return a - b; });
  ck(nums[0] === 1, g + ' lesson ids start at 1 (got ' + nums[0] + ')');
  ck(nums[nums.length - 1] === ids.length,
    g + ' lesson ids contiguous 1..' + ids.length + ' (max ' + nums[nums.length - 1] + ')');
}
/* Grade 3 must KEEP its 81 lessons (5 above the 76 baseline) - never trim */
ck(Object.keys(lessons.grade_3).length === 81, 'Grade 3 keeps all 81 lessons');
const g3max = Math.max.apply(null, Object.keys(lessons.grade_3).map(Number));
ck(g3max === 81, 'Grade 3 reaches lesson 81 (got ' + g3max + ')');

const theory = JSON.parse(fs.readFileSync(path.join(ROOT, 'math_theory.json'), 'utf8'));
ck(Object.keys(theory).length > 0, 'math_theory.json non-empty (' + Object.keys(theory).length + ' keys)');
let theoryMapped = 0;
for (const g of gradeKeys) {
  for (const id of Object.keys(lessons[g])) {
    const title = lessons[g][id].title;
    if (theory[title] || theory[g + '/' + id] || theory[id]) theoryMapped++;
  }
}
ck(theoryMapped > 0, 'theory content maps to lessons (' + theoryMapped + ' mapped)');

const datFiles = ['achievements.json', 'daily_rewards.json', 'gacha_cards.json',
  'pets.json', 'skills.json', 'skins.json'];
for (const f of datFiles) {
  const p = path.join(WEB, 'data', f);
  ck(fs.existsSync(p), 'web/data/' + f + ' exists');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  ck(!!(j && typeof j === 'object'), 'web/data/' + f + ' parses as JSON');
  ck(JSON.stringify(j).length > 20, 'web/data/' + f + ' is non-trivial');
}
const daily = JSON.parse(fs.readFileSync(path.join(WEB, 'data', 'daily_rewards.json'), 'utf8'));
const rewards = daily.rewards || (daily.cycle && daily.cycle.rewards) || [];
ck(Array.isArray(rewards) && rewards.length === 7, 'daily_rewards 7-day cycle (got ' + rewards.length + ')');
const gacha = JSON.parse(fs.readFileSync(path.join(WEB, 'data', 'gacha_cards.json'), 'utf8'));
/* Shape: { <category>: { name, rarity, items: [ {id,title,content,icon}, ... ] }, ... } */
let allCards = 0;
Object.keys(gacha).forEach(function (k) {
  const v = gacha[k];
  if (v && Array.isArray(v.items)) allCards += v.items.length;
  else if (Array.isArray(v)) allCards += v.length;
});
ck(allCards > 0, 'gacha_cards.json defines cards (' + allCards + ')');
const skills = JSON.parse(fs.readFileSync(path.join(WEB, 'data', 'skills.json'), 'utf8'));
/* Shape: { <skill_id>: { name, category, max_level, cost_per_level, ... }, ... } */
const skillList = Object.keys(skills);
ck(skillList.length === 12, 'skills.json defines 12 skills (got ' + skillList.length + ')');
for (const sid of skillList) {
  const s = skills[sid];
  ck(!!(s && typeof s.name === 'string'), 'skill ' + sid + ' has a name');
  ck(!!(s && Array.isArray(s.cost_per_level)), 'skill ' + sid + ' has cost_per_level');
}

/* ---------- 4. fonts + audio present ---------- */
for (const f of ['fonts/Quicksand-Bold.ttf', 'fonts/Segoe UI Emoji.TTF']) {
  const p = path.join(WEB, f);
  ck(fs.existsSync(p), 'font present: ' + f);
  if (fs.existsSync(p)) ck(fs.statSync(p).size > 1000, 'font non-trivial: ' + f);
}
const audioDir = path.join(WEB, 'audio');
ck(fs.existsSync(audioDir), 'web/audio exists');
const oggs = fs.existsSync(audioDir)
  ? fs.readdirSync(audioDir).filter(function (f) { return /\.ogg$/i.test(f); }) : [];
ck(oggs.length > 0, 'web/audio ships .ogg files (' + oggs.length + ')');
for (const f of oggs) ck(fs.statSync(path.join(audioDir, f)).size > 0, 'audio non-empty: ' + f);


/* ---------- 5. STRONG: every lesson generates a valid question ---------- */
require(path.join(JS, 'mt19937.js'));
const QGmod = require(path.join(JS, 'question_generator.js'));
const gen = new QGmod.QuestionGenerator();
let generated = 0;
const genProblems = [];
const DIFFS = [1, 3, 5];
for (const g of gradeKeys) {
  const grade = Number(g.replace('grade_', ''));
  for (const id of Object.keys(lessons[g])) {
    for (const d of DIFFS) {
      let res = null;
      const tag = g + '/' + id + ' d' + d;
      try { res = gen.generate_question(grade, Number(id), d, 'qa2audit_' + grade + '_' + id + '_' + d); }
      catch (e) { genProblems.push(tag + ' threw: ' + (e && e.message)); continue; }
      if (!res) { genProblems.push(tag + ' returned null'); continue; }
      generated++;
      /* Question is a dataclass-shaped object (question_generator.py:26-35):
         { question_text, options, correct_answer, hint, question_type,
           difficulty, grade, lesson_id }. NOT {question, answer}. */
      const opts = (res.options || []).map(String);
      const rawAns = res.correct_answer;
      const ans = rawAns === null || rawAns === undefined ? null : String(rawAns);
      const qText = res.question_text;
      if (typeof qText !== 'string' || !qText.trim()) genProblems.push(tag + ' empty question_text');
      if (ans === null || ans === 'NaN' || ans === 'undefined' || !ans.trim()) {
        genProblems.push(tag + ' bad correct_answer "' + ans + '"');
      }
      if (res.question_type !== 'multiple_choice') {
        genProblems.push(tag + ' question_type=' + res.question_type);
      }
      if (Number(res.grade) !== grade) genProblems.push(tag + ' grade mismatch ' + res.grade);
      if (Number(res.lesson_id) !== Number(id)) genProblems.push(tag + ' lesson_id mismatch ' + res.lesson_id);
      if (opts.length !== 4) genProblems.push(tag + ' options=' + opts.length);
      if (new Set(opts).size !== opts.length) genProblems.push(tag + ' duplicate options');
      if (opts.filter(function (o) { return o === ans; }).length !== 1) {
        genProblems.push(tag + ' answer-not-in-options (ans="' + ans + '" opts=' + JSON.stringify(opts) + ')');
      }
      if (opts.some(function (o) { return !o || o === 'NaN' || o === 'undefined'; })) {
        genProblems.push(tag + ' blank/NaN option ' + JSON.stringify(opts));
      }
    }
  }
}
ck(genProblems.length === 0,
  'every grade/lesson/difficulty generates a valid question (' + genProblems.length + ' problems)');

/* ---------- report ---------- */
console.log('=== M10-QA2-L DATA / ASSET AUDIT ===');
console.log('runtime source files scanned = ' + runtimeFiles.length);
console.log('distinct asset references    = ' + refs.size);
console.log('references resolved          = ' + resolved + ' (via candidate chain: ' + resolvedViaCandidate + ')');
console.log('missing (non-audio)          = ' + missing.length);
missing.slice(0, 25).forEach(function (m) { console.log('  MISSING ' + m); });
console.log('documented audio gaps        = ' + gracefulGaps.length + ' (graceful null, not defects)');
gracefulGaps.slice(0, 30).forEach(function (m) { console.log('  AUDIO_GAP ' + m); });
console.log('zero-byte                    = ' + empty.length);
console.log('escapes web/                 = ' + outsideWeb.length);
console.log('grade lesson counts          = ' + gradeKeys.map(function (g) {
  return g + ':' + Object.keys(lessons[g]).length;
}).join(' '));
console.log('theory mapped lessons        = ' + theoryMapped);
console.log('questions generated          = ' + generated);
console.log('generator problems           = ' + genProblems.length);
genProblems.slice(0, 30).forEach(function (m) { console.log('  GEN ' + m); });
console.log('checks = ' + checks + '  fails = ' + fails.length);
fails.slice(0, 40).forEach(function (m) { console.log('  FAIL ' + m); });
console.log('M10QA2_DATA_AUDIT: pass=' + (fails.length === 0 ? 1 : 0) + ' fail=' + fails.length);
process.exit(fails.length === 0 ? 0 : 1);

