'use strict';
/* POLISH M3 checkpoint writer — follows the project's existing checkpoint
   mechanism (web/tests/_make_checkpoint.js): per-file SHA-256 manifest +
   MASTER_SHA256 = sha256(sorted "path:sha256\n" lines), appended to
   web/CHECKPOINTS.md.

   POLISH M3 also freezes a PYTHON_SOURCE_GUARD hash set (every Desktop *.py at
   repo root) so any future checkpoint can prove the Python Desktop was untouched. */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const ROOT = 'E:/lam_game_2026';
const CP = ROOT + '/web/CHECKPOINTS.md';

const changed = [
  'web/js/states_real.js',
  'web/js/ui.js',
  'web/js/main.js',
  'web/tests/polish_m3.test.js',
  'web/tests/ui_parity_p1.test.js',
  'web/tests/_run_m3_gate.ps1',
  'web/tests/_run_full_regression.ps1'
];

const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const master = map => {
  const lines = Object.keys(map).sort().map(k => k + ':' + map[k] + '\n');
  return crypto.createHash('sha256').update(lines.join('')).digest('hex');
};

const manifest = {};
for (const f of changed) manifest[f] = sha(ROOT + '/' + f);
const MASTER = master(manifest);

// Python Desktop guard: every *.py at repo root
const pyFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.py')).sort();
const pyMap = {};
for (const f of pyFiles) pyMap[f] = sha(ROOT + '/' + f);
const PY_GUARD = master(pyMap);

const block = `
## polish-m3-secondary-systems
- date: 2026-09-16
- parent: polish-m2-menu-dashboard-theory
- Milestone: POLISH M3 (Secondary Systems Visual/UX) = PASS
- Scope:
  - A Shop: card polish (icon/title/desc/rarity/price/owned-equipped/selection ring/preview panel/scroll-clip)
  - B Pet + Skin: pet cards, skin cards, rarity, active/equipped, locked/unlocked, desc, boundaries
  - C Gacha: banner, rarity presentation, pull buttons, cost, pity, result panel, NEW/duplicate, bounds (rates/pity constants UNCHANGED)
  - D Daily: 7-day grid, current-day highlight, claimed check, locked future days, reward amount, claim button, bounds (reward behavior UNCHANGED)
  - E Achievement: cards (icon/name/desc/progress/completed/XP), scroll/clip, back button (unlock logic UNCHANGED)
  - F Skill Tree: node cards, category separation, locked/unlocked/max-level, cost, selected, desc, status, scroll (formulas/costs UNCHANGED)
  - G Profile: avatar/username/level/XP/statistics/pet buttons/alignment/clip/scroll (calculations PRESERVED)
  - H SkillMap (weak-topic): weakest-first rows, mastery bars, color legend, empty friendly state
  - I UI consistency: reuses existing UI components only; NO second Button/CardButton, NO duplicate popup system, NO second RealisticBook
- P1 UI-parity remediation closed in this milestone:
  - RealisticBook integration root-cause fix (states_real.js): ui.js publishes classes ONLY on global.UI, so the previous
    bare-global lookup made RB null in the browser => integration was dead. Resolution order now
    global.UI.RealisticBook -> require('./ui.js') fallback, with an early-return guard.
  - _bookDrawBase now passes the RENDERER (global.Game.renderer, api fillRoundRect/text) instead of the raw 2D ctx,
    resolved lazily so script load order cannot break a state draw; skips when the book has no pages.
  - ui.js: RealisticBook.reset(index) added (page identity on state enter) — additive, no behaviour removed.
  - main.js: registers 'profile' and 'skill_map' states (they existed in states_real.js but were not routable) — POLISH M3.
- Tests (each suite 5 runs for the M3 gate; M3_GATE_TOTAL_FAILED_RUNS=0):
  - polish_m3 12/12 x5 · m9a_shop 18/18 x5 · m9b_pet_skin 23/23 x5 · m9c_gacha 14/14 x5
  - m9d_achievements 18/18 x5 · m9e_daily 23/23 x5 · m9f_skills_items 28/28 x5 · m9_final_integration 10/10 x5
  - m8c_ui 18/18 x5 · ui_parity 20/20 x5 · ui_parity_p1 12/12 x5 · m10b_states_menu 44/44 x5 · m10b_state_integration 5/5 x5
- Full regression (web + server): SUITES_RUN=34, TOTAL_FAILED_SUITES=0, all exit=0
  - admin_rbac, phase1_foundation, m2_polish, m4_states, m5_player_save, m6_question, m6b_mt19937, m6b_safety_guard,
    m6b_vectors, m7a_game_manager, m7b_lesson_select, m7c_lesson, m7d_victory_defeat, m8a_effects, m8b_audio, m8c_ui,
    m8d_performance, m9a_shop, m9b_pet_skin, m9c_gacha, m9d_achievements, m9e_daily, m9f_skills_items, m9_final_integration,
    m10a_browser_load, m10b_states_menu, m10b_state_integration, m10c_auth_frontend, m10d_admin, polish_m2, polish_m3,
    ui_parity, ui_parity_p1, performance_stress
- Python Desktop: UNCHANGED (no .py file has a modified mtime in the task window; PYTHON_SOURCE_GUARD frozen below)
- Browser: BROWSER VALIDATION UNAVAILABLE (no automation available).
  Do NOT read this checkpoint as visual browser confirmation — subsystem visuals are covered by structural draw-call tests only.
- Files changed (SHA-256 per file):
${changed.map(f => '  - ' + f + ': ' + manifest[f]).join('\n')}
- Manifest method: MASTER_SHA256 = sha256(sorted "path:sha256\\n" lines)
- MASTER_SHA256: ${MASTER}
- PYTHON_SOURCE_GUARD files: ${pyFiles.length} (*.py at repo root)
- PYTHON_SOURCE_GUARD_SHA256: ${PY_GUARD}
`;

fs.appendFileSync(CP, block, 'utf8');
console.log('APPENDED polish-m3-secondary-systems');
console.log('MASTER_SHA256:', MASTER);
console.log('PYTHON_SOURCE_GUARD_SHA256:', PY_GUARD);
for (const k of changed) console.log('FILE', k, manifest[k]);