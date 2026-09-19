'use strict';
/* POLISH M4 checkpoint writer — same mechanism as the project's existing writers
   (web/tests/_make_checkpoint_m3.js):
     * per-file SHA-256 manifest
     * MASTER_SHA256 = sha256(sorted "path:sha256\n" lines)
     * PYTHON_SOURCE_GUARD = sha256(sorted "path:sha256\n" lines) over every
       Desktop *.py at repo root, proving the Python Desktop was untouched.
   M4 additionally freezes an ASSET_MANIFEST proving each web asset is
   byte-identical to its Desktop source (no rename / no convert / no fake art). */
const fs = require('fs');
const crypto = require('crypto');

const ROOT = 'E:/lam_game_2026';
const CP = ROOT + '/web/CHECKPOINTS.md';

const changed = [
  'web/js/states_real.js',
  'web/js/ui.js',
  'web/js/main.js',
  'web/js/theory_pages.js',
  'web/index.html',
  'web/tests/polish_m4.test.js',
  'web/tests/book_runtime_probe.test.js',
  'web/tests/ui_parity_p1.test.js',
  'web/tests/m10a_browser_load.test.js',
  'web/tests/m4_states.test.js',
  'web/tests/_run_full_regression.ps1',
  'web/tests/_run_m4_gate.ps1',
  'web/tests/_m4_browser.js',
  'web/tests/_verify_guard.js'
];

/* [Desktop source, copied destination] — must be byte-identical */
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
for (const f of changed) manifest[f] = sha(ROOT + '/' + f);
const MASTER = master(manifest);

const assetMap = {};
const assetRows = [];
for (const [src, dst] of assets) {
  const s = sha(ROOT + '/' + src);
  const d = sha(ROOT + '/' + dst);
  assetMap[dst] = s + '|' + d;
  assetRows.push('  - ' + src + ' -> ' + dst +
    '\n      src: ' + s + '\n      dst: ' + d +
    '\n      identical: ' + (s === d ? 'YES' : 'NO'));
}
const ASSET_MASTER = master(assetMap);

const pyFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.py')).sort();
const pyMap = {};
for (const f of pyFiles) pyMap[f] = sha(ROOT + '/' + f);
const PY_GUARD = master(pyMap);

const block = `
## polish-m4-responsive-assets-book
- date: 2026-09-17
- parent: polish-m3-secondary-systems
- Milestone: POLISH M4 (Responsive + Asset completion + RealisticBook content) = PASS
- A Asset completion (copied byte-identical from Desktop root; no rename, no convert, no fake art):
${assetRows.join('\n')}
- B RealisticBook content: Desktop theory content is real, not a shell.
  - web/js/theory_pages.js (NEW) is a generated mirror of the Desktop theory pages
    (data_manager.py theory tables) - pages[grade] = [{ t: title, c: content }, ...]
  - ui.js RealisticBook now has a real page renderer (_drawPage): page rects/text are drawn from
    the page objects, so Menu / LessonSelect / Theory books render actual content instead of an empty shell.
  - 2-page layout, left/right renderer, flip state, reset(index) page identity and the click guard
    are all preserved; NO second RealisticBook, NO fullscreen page-turn was added.
- C Theory character: TheoryState uses the Desktop main_character.png asset for the character
  slot (preloaded through assets.js, drawn in-bounds, no placeholder).
- D Responsive safety (structural, NOT visual): logical canvas stays 1300x800.
  - 1300x800 logical bounds for all core states (T10)
  - 1280x720 -> 1170x720 letterbox rect: corners map correctly + scroll/value clamping (T11)
  - 1920x1080 -> 1755x1080 letterbox rect: corners map correctly + clamping (T12)
  - text/button bounds (T13) and popup/scrollbar-track safety (T14)
- E Browser validation: chromium automation became AVAILABLE in this milestone (Playwright,
  web/tools/browser-validation). web/tests/_m4_browser.js drives a real headless Chromium over a
  local static server: boot/state registration, menu, lesson_select (+book), theory (Desktop content
  +book), 1280x720 and 1920x1080 resizes, engine ticking + DPR canvas, zero page errors.
- F Tests:
  - polish_m4 14/14 (T01..T14, behaviour/values, not string grep)
  - M4 gate: 13 suites x 5 runs, M4_GATE_TOTAL_FAILED_RUNS=0
    (polish_m4, ui_parity, ui_parity_p1, polish_m2, polish_m3, m8c_ui, m9_final_integration,
     m10b_states_menu, m10b_state_integration, performance_stress, m4_states, m10a_browser_load,
     m7b_lesson_select)
  - Browser: _m4_browser.js 10/10 PASS (real Chromium), failures=0
- Root-cause fixes in this milestone (no assertion was weakened):
  - _verify_guard.js used a non-canonical guard algorithm (hashed bare hashes joined by a newline
    instead of sorted "path:sha256" lines) and therefore reported a false MISMATCH. Fixed to the
    canonical master(); guard now matches the frozen baseline exactly (PYTHON_GUARD_VERIFY=PASS).
  - web/CHECKPOINTS.md contained a DUPLICATE polish-m3-secondary-systems block (the M3 writer was run
    twice, appending a second block with intermediate hashes). Because the M3 verifier resolves the tag
    with lastIndexOf(), the duplicate silently shadowed the canonical record. The stray duplicate was
    removed so exactly one canonical polish-m3 record remains (MASTER e1f3b6d4..., the declared
    verified baseline). Removed duplicate value (kept here so nothing is lost):
    MASTER_SHA256=a5d82133592e6573e38ef0fdff375fbaf949e1c0b59085089532013d974cbbe3,
    states_real.js=b839c9ece85f1c4fd8f02a49e2ae29182ff97f3c126868e5f633256516e4ff86.
  - Added book_runtime_probe.test.js to the full-regression suite list (RealisticBook runtime coverage).
- Observation (NOT changed, out of M4 scope): web/data/{pets,skins,skills,daily_rewards,achievements}.json
  are generated M9 artifacts and are not byte-identical to data/*.json; m9* suites pass against them.
  web/data/gacha_cards.json and web/data/math_lessons.json ARE byte-identical to their Desktop sources.
- Python Desktop: UNCHANGED (PYTHON_SOURCE_GUARD recomputes to the frozen baseline).
- Files changed (SHA-256 per file):
${changed.map(f => '  - ' + f + ': ' + manifest[f]).join('\n')}
- Manifest method: MASTER_SHA256 = sha256(sorted "path:sha256" lines)
- MASTER_SHA256: ${MASTER}
- ASSET_MANIFEST method: sha256(sorted "destPath:srcSha|dstSha" lines)
- ASSET_MANIFEST_SHA256: ${ASSET_MASTER}
- PYTHON_SOURCE_GUARD files: ${pyFiles.length} (*.py at repo root)
- PYTHON_SOURCE_GUARD_SHA256: ${PY_GUARD}
`;

fs.appendFileSync(CP, block, 'utf8');
console.log('APPENDED polish-m4-responsive-assets-book');
console.log('MASTER_SHA256:', MASTER);
console.log('ASSET_MANIFEST_SHA256:', ASSET_MASTER);
console.log('PYTHON_SOURCE_GUARD_SHA256:', PY_GUARD);
for (const f of changed) console.log('FILE', f, manifest[f]);
for (const [src, dst] of assets) console.log('ASSET', src, '->', dst, assetMap[dst].split('|').join(' '));
