# UI_PARITY_REPORT.md — MathDrill Desktop → Web Visual Parity

> Date: 2026-09-14 · Scope: M10-B UI parity audit + high-confidence P1 fixes.
> NOT a full visual-PASS claim — browser screenshot comparison unavailable. See "Browser validation".

---

## 1. Summary

The Web already carried a recognizable subset of MathDrill's visual identity (light-green `#a5d6a7` screens, dark menu, victory/defeat panels, Quicksand font, 1300×800 letterbox). The audit found the biggest gap in **color-token fidelity**: the effective Python button palette (`game_init.py:1985-1991`) had been re-mapped to muted, invented colors in `states_real.js`. That made *every* screen (all states, cards, buttons) use the wrong hue.

## 2. Fixes made (this pass — all P1, minimal, no logic change)

| File | Change |
|------|--------|
| `web/js/states_real.js` | Aligned 7 color constants to the Python **effective** palette: BLUE=(0,188,212), GREEN=(76,175,80), PURPLE=(138,43,176), ORANGE=(255,152,0), YELLOW=(255,215,0), RED=(244,67,54), SHADOW=(100,100,100). |
| `web/js/states_real.js` | Removed dev/version captions not in the original: Menu "M4 — Real Game States" subtitle + "M5: PlayerData…" footer; Login "M5 · PlayerData + Save + Auth (PBKDF2)…" footer. |
| `web/js/states_real.js` | Loading background → `#141e37` = Python `(20,30,55)`. |
| `web/tests/ui_parity.test.js` | **NEW** 20-check structural parity suite. |

No gameplay, M6/M7/M9 logic, backend, or layout coordinates were changed.

## 3. What changed visually (result)

- Every Button/card on every screen now renders in the correct MathDrill palette (cyan primary, green success, red danger, gold accent, purple secondary, orange warning).
- No more dev-mile marker / auth-technology captions embedded in shipped screens.
- Loading screen sits on the original dark-navy base.

## 4. Remaining mismatches (not fixed — need follow-up)

| Sev | Gap | Where |
|-----|-----|-------|
| P1 | **RealisticBook identity**: Desktop draws a big realistic book (50,50,1200,700) on Menu, LessonSelect, Shop, Daily, Skill; Web uses flat translucent panels. `web/js/ui.js` already has a `RealisticBook` class — needs to be wired into these states' `draw()`. | MenuState, LessonSelectState draw |
| P1 | **Login background asset** `backround1.jpg` not copied into `web/assets` (Web falls back to white + `nen_game.png` overlay). | web/assets |
| P2 | Register is a LoginState toggle, not a standalone state (original has dedicated RegisterState + clover). | register flow |
| P2 | Pet/Skin/Gacha/Achievement dark backgrounds need a per-screen visual compare against `main.py` fills. | M9 states |
| P3 | Font-size deltas, flat-vs-gradient backgrounds. | various |

## 5. Assets & fonts

- Fonts: `Quicksand-Bold.ttf` + `Segoe UI Emoji.TTF` copied → ✓
- `pixel_clover.png`, `nen_game.png`, `favicon.png` → ✓
- `backround1.jpg` (login bg) → **MISSING** from web/assets

## 6. Tests

- `web/tests/ui_parity.test.js`: **20/20 PASS** (4 consecutive runs, exit=0 each).
- Regression (one full pass, all exit=0): ui_parity 20 · phase1 10 · m4 15 · m5 10 · m6 11 · m6b_mt19937 12 · m6b_safety_guard 9 · m7a 25 · m7b 16 · m7c 11 · m7d 14 · m8a 20 · m8b 14 · m8c 18 · m8d 10 · perf_stress 16 · m9a 18 · m9b 23 · m9c 14 · m9d 18 · m9e 23 · m9f 28 · m9_final 10 · m10a 16 · m10b_states_menu all · m10c 22 · m10d_admin 11 · admin_rbac(server) 16.
- Governance: no gameplay/auth/M6/M7/M9/perf regression.

## 7. Browser validation

**VISUAL BROWSER VALIDATION UNAVAILABLE** — no browser/screenshot automation in this environment. ui_parity.test.js asserts structural/source contracts only (per Phase 15), NOT pixels. Do NOT treat this pass as proof of pixel-perfect parity.

## 8. Next task

Wire `RealisticBook` (ui.js) into `MenuState` and `LessonSelectState` draws to restore the book-page identity (P1), and copy `backround1.jpg` into `web/assets` for the login background.