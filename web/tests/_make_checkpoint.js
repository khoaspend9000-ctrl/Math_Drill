const fs = require('fs');
const crypto = require('crypto');

const CP = 'E:/lam_game_2026/web/CHECKPOINTS.md';
const files = [
  'web/js/states_real.js',
  'web/tests/m10b_state_integration.test.js',
  'web/tests/m10a_browser_load.test.js',
  'web/assets/backround1.jpg'
];
const ROOT = 'E:/lam_game_2026';

function sha(f) {
  return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
}

const manifest = {};
for (const f of files) manifest[f] = sha(ROOT + '/' + f);

// master = sha256 of "path:hash\n" lines (sorted)
const lines = Object.keys(manifest).sort().map(k => k + ':' + manifest[k] + '\n');
const master = crypto.createHash('sha256').update(lines.join('')).digest('hex');

const block = `
## polish-m2-menu-dashboard-theory
- date: 2026-09-16
- parent: polish-m1-ui-fixes
- Milestone: POLISH M2 (Menu Dashboard + Theory) FINAL GATE = PASS
- Scope đóng gate:
  - backround1.jpg: copy byte-identical từ root sang web/assets (SHA trùng khớp source, không rename/convert)
  - TheoryState: class hoàn chỉnh trong states_real.js (title/book 50,50,1200,700 khớp RealisticBook Python, page bounds, prev/next, scroll clamp, buttons conditional)
  - Menu dashboard: avatar/greeting/level/grade/XP/gold/pet/achievement/difficulty/streak/daily tasks; layout trái/phải RealisticBook không overlap/overflow (kiểm qua m10b_states_menu + polish suites)
- Fixes trong gate này:
  - T02 m10b_state_integration: test-harness bug — clickCard(states,…) tham chiếu bare 'states' undefined → đổi param thành managerObj (fix harness, KHÔNG nới assertion)
  - T03 m10b_state_integration: production bug — ShopState._actItem pet purchase không chọn pet mới → thêm d.pet.type = key sau purchase ok (đúng parity Python: mua pet xong được chọn)
  - T05 m10b_state_integration: test data bug — 'pen_wood' không tồn tại trong data/skins.json → dùng 'pen_magic' (key thực tế)
  - m10a_browser_load T06: pre-existing harness bug LEGACY undefined → NOT_LOADED
- Tests (mỗi suite tối thiểu 5 lần chạy, tất cả PASS/exit=0):
  - polish_m2 12/12 ×5 · m2_polish 14/14 ×5 · ui_parity 20/20 ×5 · m8c_ui 18/18 ×5
  - m10a_browser_load 16/16 ×5 · m10b_states_menu 44/44 ×5 · m10b_state_integration 5/5 ×5 (đã fix T02–T05)
  - m10c_auth_frontend 22/22 ×5 · m10d_admin 11/11 ×5 · phase1_foundation 10/10 ×5 · m7c_lesson 11/11 ×5
- Full regression (web + server, 21 suites, TOTAL_FAILED_SUITES=0):
  - admin_rbac 16/16 · m4 15/15 · m5 10/10 · m6 11/11 · m6b_mt19937 12/12 · m6b_safety_guard 9/9 ·
    m6b_vectors 1/1 · m7a 25/25 · m7b 16/16 · m7d 14/14 · m8a 20/20 · m8b 14/14 · m8d 10/10 ·
    m9a 18/18 · m9b 23/23 · m9c 14/14 · m9d 18/18 · m9e 23/23 · m9f 28/28 · m9_final 10/10 · perf_stress 16/16
- Python Desktop: KHÔNG thay đổi (verified qua mtime — .py mới nhất chỉ là audit helper có từ trước task)
- Browser: BROWSER VALIDATION UNAVAILABLE (no automation) — visual parity menu/theory chỉ được xác nhận bằng structural test, KHÔNG suy ra visual PASS
- Files changed: {
  "web/js/states_real.js": "${manifest['web/js/states_real.js']}",
  "web/tests/m10b_state_integration.test.js": "${manifest['web/tests/m10b_state_integration.test.js']}",
  "web/tests/m10a_browser_load.test.js": "${manifest['web/tests/m10a_browser_load.test.js']}",
  "web/assets/backround1.jpg": "${manifest['web/assets/backround1.jpg']}"
}
- Manifest method: MASTER_SHA256 = sha256 của các dòng "path:sha256\\n" sort theo path
- MASTER_SHA256: ${master}
`;

fs.appendFileSync(CP, block, 'utf8');
console.log('APPENDED');
console.log('MASTER_SHA256:', master);
for (const k of Object.keys(manifest)) console.log(k, manifest[k]);