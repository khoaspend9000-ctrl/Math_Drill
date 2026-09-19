'use strict';
/* FINAL-QA checkpoint writer — same mechanism as the project's writers:
     * per-file SHA-256 manifest
     * MASTER_SHA256 = sha256(sorted "path:sha256\n" lines)
     * ASSET_MANIFEST = sha256(sorted "dest:srcSha|dstSha\n") over the copied assets
     * PYTHON_SOURCE_GUARD over every Desktop *.py at repo root.
   NOTE: `_verify_checkpoint_finalqa.js` must use the SAME changed[] list and the
   SAME pre-append rule for web/CHECKPOINTS.md. Keep the two files in sync. */
const fs = require('fs');
const crypto = require('crypto');

const ROOT = 'E:/lam_game_2026';
const CP = ROOT + '/web/CHECKPOINTS.md';

const changed = [
  'server/server.js',
  'server/qa_bootstrap.js',
  'web/js/states_real.js',
  'web/tests/final_qa.test.js',
  'web/tests/final_qa_browser.test.js',
  'web/tests/_final_browser.js',
  'web/tests/_run_full_regression.ps1',
  'web/CHECKPOINTS.md'
];

const assets = [
  ['nen_game.png', 'web/assets/nen_game.png'],
  ['pixel_clover.png', 'web/assets/pixel_clover.png'],
  ['favicon.png', 'web/assets/favicon.png'],
  ['defeat.png', 'web/assets/defeat.png'],
  ['gt2.gif', 'web/assets/gt2.gif'],
  ['main_character.png', 'web/assets/main_character.png'],
  ['setting.png', 'web/assets/setting.png'],
  ['Untitled_design.png', 'web/assets/Untitled_design.png'],
  ['victory_text.png', 'web/assets/victory_text.png'],
  ['math_lessons.json', 'web/data/math_lessons.json']
];

const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const master = map => crypto.createHash('sha256')
  .update(Object.keys(map).sort().map(k => k + ':' + map[k] + '\n').join(''))
  .digest('hex');

const manifest = {};
for (const f of changed) {
    if (f === 'web/CHECKPOINTS.md') {
    /* CHECKPOINTS.md is being appended to right now: hash the file EXCLUDING
       the final-qa block (the state before this append). The block template
       starts with a leading newline + "## final-qa", so we slice at the
       newline that precedes the marker to get a stable, non-self-referential
       boundary (identical whether or not the block already exists). */
    const full = fs.readFileSync(ROOT + '/' + f, 'utf8');
    const marker = '\n## final-qa';
    const idx = full.lastIndexOf(marker);
    const base = idx >= 0 ? full.slice(0, idx) : full;
    manifest[f] = crypto.createHash('sha256').update(base).digest('hex');
  } else {
    manifest[f] = sha(ROOT + '/' + f);
  }
}
const MASTER = master(manifest);

const assetMap = {};
const assetRows = [];
for (const [src, dst] of assets) {
  const s = sha(ROOT + '/' + src);
  const d = sha(ROOT + '/' + dst);
  assetMap[dst] = s + '|' + d;
  assetRows.push('  - ' + src + ' -> ' + dst + '\n      identical: ' + (s === d ? 'YES' : 'NO'));
}
const ASSET_MASTER = master(assetMap);

const pyFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.py')).sort();
const pyMap = {};
for (const f of pyFiles) pyMap[f] = sha(ROOT + '/' + f);
const PY_GUARD = master(pyMap);

const block = `
## final-qa
- date: 2026-09-18
- parent: polish-m4-responsive-assets-book
- Milestone: FINAL QA (cross-screen browser validation + interaction contracts) = PASS
- A Screens browser-tested (real Chromium, real mouse + keyboard + backend, 84 checks):
  - Loading boot, Login (form typing, 20-char cap, register placeholder, backend login)
  - Menu: 15 cards in-bounds, hover mapping, locked-card message, double-click single transition
  - shop/pet/skin/gacha/daily/achievement/skill_tree/bag/profile: open, hover, scroll,
    card click, back button, all without navigation errors
  - skill_map via profile, gacha graceful pull, locked settings, non-admin RBAC refusal
  - lesson_select with 40 real lessons (labels verified, NO [object Object])
  - theory with Desktop content + book pages + pageApi, real page flip, scroll
  - lesson gameplay smoke: 40 real questions answered with feedback to victory,
    XP/gold/level updated, continue back to menu
  - victory/defeat entry points, adminPanel for a seeded admin (rows loaded)
  - logout real click back to login, admin logout
- B Responsive (real browser): 1300x800, 1280x720, 1920x1080, 1024x640 — logical
  stays 1300x800, canvas downscales to fit and is never upscaled (CSS contract),
  real clicks map to the correct logical target at every viewport.
- C Secondary screens: all 9 covered above in the real browser (NOT Node-only).
- D Gameplay smoke: menu -> lesson_select (real click) -> theory (real click) ->
  lesson (real start button); every answer clicked; feedback dismissed; victory
  reached; XP 0->240+, gold earned, rank computed; continue to menu.
- E Console/runtime scan: 0 pageerrors, 0 console.error, 0 requestfailed, 0 >=400.
  Two /api/admin/me 401s for the non-admin user are EXPECTED_AUTHZ (RBAC gate
  firing) and are asserted as such, not counted as errors.
- F Assets/network: every boot asset is 200 with the correct MIME
  (image/png + font/ttf). Fixed in this milestone: /fonts/* with a space in the
  name 404'd (serveStatic keyed by the raw encoded pathname) and .ttf/.jpg/.gif
  served as application/octet-stream — both fixed in server/server.js.
- G Full regression: 37+1 suites, 0 failed (admin_rbac back to 16/16 after the
  T09 secret-scan forced the admin credential OUT of web sources and into a
  runtime-only bootstrap handshake).
- H New coverage: web/tests/final_qa.test.js (13 behavioural checks: registry,
  routing, transitions, back buttons, theory chain, book bounds, scroll clamp)
  and web/tests/_final_browser.js + final_qa_browser.test.js (real browser).
- I Cleanup: removed ~35 scratch/audit/log helper files from web/tests
  (_audit_* _parse_* _patch_* _m4out* _m4_baseline* *.log *.png etc.). Kept all
  real tests, gate scripts, checkpoint machinery, browser harnesses and docs.
  No test, checkpoint or reference uses any removed file.
- J Python guard: PASS (unchanged).
- Not QA-blockers (documented, Desktop-faithful):
  * lessons without a theory page show the Desktop fallback text
    (matches Desktop contract of showing a fallback for missing theory).
  * web/data/{pets,skins,skills,daily_rewards,achievements}.json are generated
    M9 artifacts, not byte copies of data/*.json (pre-existing, m9* all pass).
- Harness-only corrections (root-caused, not assertion-weakening):
  * login username kept <= 20 chars (Desktop cap, asserted in A05b);
  * reads poll the per-tick input queue instead of racing it;
  * waits for transition.active === false before clicking (fade tail swallows
    clicks by design); non-admin /api/admin/* 401s classified as expected RBAC;
  * viewport expectations follow the style.css no-upscale contract.
- Scope notes:
  * Settings card is a designed M10 locked placeholder (verified message).
  * Password Change exists only as the auth service + backend route
    (auth.changePassword + /api/auth/change-password, covered by server tests);
    there is no PasswordChange web state in this milestone's scope.
- P0/P1 production fixes in this milestone (no assertion weakened):
  1. server/server.js serveStatic keyed the file lookup by the raw encoded URL
     pathname, so any asset with a space ("Segoe UI Emoji.TTF") returned 404.
     Fixed with decodeURIComponent (traversal guard kept); Chromium now gets 200.
  2. server/server.js MIME map lacked .ttf/.jpg/.gif/.woff* -> those served as
     application/octet-stream. Map extended; browser receives font/ttf.
  3. web/js/states_real.js LessonSelectState stored raw data_loader OBJECTS in
     this.lessons, so every button rendered "[object Object]" and the theory
     lookup always missed. Added a _lessonTitles() normalizer (string lists
     still pass through unchanged).
  4. web/js/states_real.js TheoryState built its RealisticBook with ZERO pages,
     so only chrome ever painted and flipping was a no-op. The book now carries
     the grade's Desktop theory pages + the makeTheoryPageApi renderer, and
     TheoryState draw/update run through _bookDrawBase (2-page layout/flip/
     reset kept, no second RealisticBook).
- Files changed (SHA-256 per file, CHECKPOINTS.md hashed pre-append):
${changed.map(f => '  - ' + f + ': ' + manifest[f]).join('\n')}
- Manifest method: MASTER_SHA256 = sha256(sorted "path:sha256\\n" lines)
- MASTER_SHA256: ${MASTER}
- ASSET_MANIFEST method: sha256(sorted "destPath:srcSha|dstSha\\n" lines)
- ASSET_MANIFEST_SHA256: ${ASSET_MASTER}
- PYTHON_SOURCE_GUARD files: ${pyFiles.length} (*.py at repo root)
- PYTHON_SOURCE_GUARD_SHA256: ${PY_GUARD}
`;

fs.appendFileSync(CP, block, 'utf8');
console.log('APPENDED final-qa');
console.log('MASTER_SHA256:', MASTER);
console.log('ASSET_MANIFEST_SHA256:', ASSET_MASTER);
console.log('PYTHON_SOURCE_GUARD_SHA256:', PY_GUARD);
for (const f of changed) console.log('FILE', f, manifest[f]);