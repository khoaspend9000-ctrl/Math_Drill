# M12 RELEASE CHECKPOINT — RC

## Commit
- **M12_COMMIT**: `b8f4a1c` — built on release baseline `9f8b9b4`
  + `web/js/states_real.js` — M12 UI fidelity overlay
  + `web/M12RC_RELEASE_CHECKPOINT.md` — this record

- Parent: `9f8b9b4f6537f828e4c57ebd0252b5621a93cd96` (M11 verified production baseline)
- **NOT** a descendant of the broken master-lineage `6a79ecc` (which touched 238 files incl. deleted test/data/dist artifacts).
- `6a79ecc` is **NOT pushed** to GitHub. Only the clean RC `b8f4a1c` (release + M12 overlay) is released.

## Baseline provenance (why this is the real release)
- `E:\MathDrill` @ 9f8b9b4 (GitHub clone, `khoaspend9000-ctrl`): complete 264-file release tree incl. secondary modules (polish.js, shop.js, pet.js, gacha.js, etc.), auth backend in `auth.js` (USE_BACKEND=11 refs), all data_*.json + tests intact.
- `E:\lam_game_2026` @ 6a79ecc: broken local master lineage (238-file diff vs release) — **not used as the source of truth**.

## Change scope — `web/js/states_real.js` only
Diffed 9f8b9b4 → 6a79ecc states_real.js (3347→3380 lines). Applied verbatim on top of release baseline.

### Added (Desktop parity):
1. **MenuState.draw** — RealisticBook-style book frame drawn before `R.clear('/bg')` (#a5d6a7 page panel), plus `FallingClover` effect instantiated in constructor/`enter`, `update`/`draw` calls. (Desktop: MenuState uses book surface + clover particles.)
2. **LessonSelectState.draw** — same book frame + page-panel parity before `R.clear`.
3. **VictoryState** — `FallingClover` effect (Desktop `VictoryState.clover_effect` parity).
4. **DefeatState** — `FallingClover` effect (Desktop `DefeatState.clover_effect` parity).
5. **MenuState daily card terminology** — corrected to Desktop strings:
   - label: `"Thử Thách"` (was `"Điểm Danh"`)
   - sublabel: `"Bài tập hằng ngày"` (was `"Phần thưởng hằng ngày"`)

All other states_real.js lines preserved from release. No auth/main/ui/question_generator change.

## Verification (real Chromium against LIVE Render at b8f4a1c)
- Boot: HTTP 200, page title `MathDrill Web — M5 Player & Save`, 31 JS resources, 0 missing.
- Public file SHA-256 (actual HTTP bytes vs repo blob):
  - index.html, main.js, states_real.js (M12), question_generator.js, ui.js, state_manager.js, style.css — all MATCH.
- `/api/player/data` anonymous → 401 (not 404).
- **Gameplay: 482 browser questions (123 correct / 4 wrong per lesson mix), 5,111 render invariants PASS, 0 dup-score, 0 dup-Xp, 0 double-transition.**
- Grade 3 lessons 79 / 80 / 81 verified live. Victory verified; Defeat verified; XP+gold reward verified.
- Menu realistic book frame + FallingClover live verified; Victory/Defeat clover live verified; Daily terminology matches Desktop.
- Persistence: reload + logout/login + 5 accounts → 0 cross-user leakage.
- Auth: register/duplicate/login/wrong-pw/logout/session-restore — PASS.
- RBAC: non-admin → 401/403 (expected); admin → allowed.
- Network: console 0, page errors 0, request failures 0, 404 0, unexpected 4xx/5xx 0, wrong MIME 0.

## Regressed local suites (on release baseline + M12)
- 38 suites, 562 pass, 0 fail, 15 skip (regression clean).
- M11 long-run re-run post-overlay: 1006 questions, 22893 invariants, 0 fail.

## Python
- `PYTHON_CHANGED: NO` — no `*.py` modified (PYTHON_SOURCE_GUARD recomputes to frozen baseline `e6024127fe8f1dc5e68c3b91f7cb64d1ebd225b5bf6fb17cc534fb7e1566fe93`).

## Rollforward note
- `6a79ecc` (broken) is superseded. `9f8b9b4` remains the M11 release baseline; `b8f4a1c` is the M12 RC.
