# M17 — Startup Performance & Loading UX

**Rollback commit (M16.1 production baseline):** `59ed808ee1e84ebf9d8ad2f2a03099682abd3a69`
**Scope:** startup latency to the Login screen only. No gameplay, economy, unlock, auth or
Desktop-Python changes. No visual redesign.

---

## 1. Measured baseline (production, commit `59ed808`)

Real Chromium against `https://math-drill-iwys.onrender.com`:

| Metric | Run 1 | Run 2 | Run 3 |
|---|---:|---:|---:|
| HTML response (`time_starttransfer`) | 3022 ms | 669 ms | 905 ms |
| DOMContentLoaded | 3563 ms | 1747 ms | 1591 ms |
| **First canvas paint** | 3568 ms | 1750 ms | 1598 ms |
| **Time to `LoginState`** | **46998 ms** | **42042 ms** | **54736 ms** |
| `load` event | 46606 ms | 41316 ms | 54262 ms |

Server is **not** the bottleneck: `GET /` answers in 0.38–1.55 s over six consecutive
requests. Startup requests: 43 resources, **2,982,641 bytes**.

Per-resource breakdown (all art started within the first 3.5 s):

| Resource | Bytes | Duration |
|---|---:|---:|
| `victory_text.png` | 505,877 | 43,041 ms |
| `defeat.png` | 431,349 | 42,337 ms |
| `main_character.png` | 417,744 | 41,762 ms |
| `nen_game.png` | 251,701 | 33,017 ms |
| `favicon.png` | 60,940 | 21,865 ms |

## 3. Files and functions changed

| File | Change |
|---|---|
| `web/js/states_real.js` | `LoadingState.preloadAssets()` — critical path is now fonts + `nen_game` only; remaining art is **deferred** until after Login is usable. `loadOne()` made defensive with a `preload()` fallback so a missing `AssetManager` API can never hang startup. `LoadingState.draw()` — bar shows the real loaded-asset count, no fabricated percentage. |
| `web/js/assets.js` | `AssetManager.loadFonts()` — Quicksand stays blocking; the 2 MB emoji face is fire-and-forget. `document.fonts.ready` removed from the awaited path. |
| `web/tests/ui_parity_p1.test.js` | T11/T12 re-pointed at the new contract; **`check()` fixed to await async tests**. |
| `web/tests/ui_parity.test.js` | T19 corrected to the Desktop palette value (pre-existing failure, see §7). |

Nothing else. `theme.js` remains deleted; no gradient/plate/SaaS styling reintroduced.

## 4. Before / after measurements

Controlled A/B, real Chromium, CDP throttled to **1200 KB/s**, old build (`:39892`,
served from `git show 59ed808:`) vs new build (`:39890`). 3 runs each:

| Build | Time to Login (3 runs) | Median | Art bytes at Login |
|---|---|---:|---:|
| **OLD `59ed808`** | 31300 / 31397 / 31247 ms | **31247 ms** | **1,701,100** |
| **NEW M17** | 8836 / 8845 / 8843 ms | **8843 ms** | **251,701** |

**Speedup 3.53x · 22,404 ms saved · 6.8x fewer blocking bytes.**

Unthrottled local: **31247 ms -> 1760 ms**; mobile 1613 ms.

## 5. Regression

| Suite | Result |
|---|---|
| Web regression | **49 suites, 676 pass, 0 fail, 15 skip, 0 harness errors** |
| Server suites | **11 suites, 136 pass, 0 fail**, all exit 0 |
| M15/M16.1 guards | `m15_python_guard` 5/5, `m15_mobile_touch` 8/8, `m15_ux_consistency` 12/12, `m12_clover_book`, `m13_settings` all pass |

Real Chromium (local build), **20/20 checks, 0 failures**:

- reaches Login — desktop 1690 ms, mobile 1613 ms
- `MathDrillTheme` absent (no M16 regression)
- **all 6 original art assets still load** (`nen_game`, `pixel_clover`, `favicon`,
  `main_character`, `victory_text`, `defeat` — all `real`, none placeholder) despite deferral
- draws: menu, lesson_select, theory, lesson, victory, defeat, review, settings, login
- gameplay correct + wrong: 9 questions, 6 correct, 3 wrong, 0 invariant failures
- mobile keypad: 4 keys, answers, no overlap (keypad y=660 > answers bottom y=640)
- **0 console errors · 0 page errors · 0 request failures · 0 unexpected 4xx/5xx**

## 6. Guard verification (mutation)

The rewritten T11/T12 were proven non-vacuous by breaking the source and re-running:

| Mutation | Expected | Actual |
|---|---|---|
| Restore the fake `Math.round(p*100)%` text | FAIL | **T11 FAILED**, `pass=11 fail=1`, exit 1 |
| Never request the deferred art | FAIL | **T12 FAILED**, `pass=11 fail=1`, exit 1 |
| Unmutated | PASS | `pass=12 fail=0`, exit 0 |

## 7. Defects found and fixed


## 8. Remaining external limitations

- **Render static-asset throughput is the floor.** The server answers HTML in ~0.4 s but
  served ~1.7 MB of art at roughly 34 KB/s. That is an infrastructure characteristic, not
  something the repository can change. M17 removes it from the Login path; it does not
  make the art itself download faster.
- **Cold start of the Render instance** is separate from per-request latency and remains
  outside repo control.
- **Not deployed.** No authenticated Render deployment mechanism exists in this workspace
  (root-caused in M14: zero GitHub Deployments API records, no `render.yaml` auto-deploy,
  no deploy hook, no Render API credential). Production therefore still runs `59ed808`
  and still exhibits the 42-55 s boot. **No production improvement is claimed** — the
  3.53x figure is a controlled local A/B, not a live measurement.
- A further gain is available but not taken: `states_real.js` (163 KB),
  `question_generator.js` (110 KB) and `theory_pages.js` (70 KB) are still render-blocking
  scripts. Deferring them needs care around the question generator, which is required as
  soon as a lesson starts, so it was left out of this milestone.

## 9. Integrity

- `PY_DIFF = 0` across all 36 Python files (source vs repository byte-identical).
- Unlock formula untouched: `Math.floor((level - 1) / 6) + 1`.
- `web/js/theme.js` still absent; original palette, art and composition unchanged
  (menu card pixel sampled `[70,130,180]` = Desktop `BLUE_BTN` in the M16.1 gate).
- Diff limited to 4 intended files plus this report: `+190 / -59` code.

**Final status: `M17_COMPLETE`**

1. **Startup blocked on 1.7 MB of non-Login art** — the 42-55 s wait. Fixed by gating Login
   on `nen_game` alone and deferring the rest.
2. **2 MB decorative emoji font on the critical path** (15.8 s) — the single largest cost.
   Moved off the critical path; Quicksand still blocks.
3. **Fabricated loading progress** — bar reported 100% after 1.2 s regardless of real
   state. Now shows the real loaded count; T11 asserts `100%` is *absent*.
4. **Harness silently swallowed async test failures** — `check()` incremented `pass++`
   immediately for any `fn()`, so an `async` check that later rejected still reported
   `fail=0` while printing a stack trace to stderr. Same class as M15-G4, live in
   `ui_parity_p1`. Fixed; verified by mutation (§6).
5. **Pre-existing stale test (not caused by M17)** — `ui_parity` T19 asserted
   `BLUE_BTN = [0, 188, 212]` while its own header cites `game_init.py:1985-1991`, where
   Desktop defines `BLUE_BTN = COLORS['primary'] = (70, 130, 180)`. M16.1 had already
   corrected the token; the assertion was left behind and had been failing since. Confirmed
   failing at the untouched baseline via `git stash`, then corrected to enforce Desktop parity.


Intermediate step, measured to justify the font change: after deferring the art but before
fixing fonts, Login was 20,768 ms with `Segoe UI Emoji.TTF` (2,024 KB) dominating at
15,766 ms. Fixing the font took it to 8,843 ms — the **font was the single largest cost**,
larger than all six images combined.


`time to LoginState` tracked `loadEventEnd` almost exactly — the app was waiting on images.

## 2. Root cause

`LoadingState.preloadAssets()` resolved `ready = true` only after `Promise.all` over
**all six startup images**, and `update()` refuses to switch to Login until `ready`.
Login could not appear until 1.7 MB of art had finished streaming — including
`victory_text.png` and `defeat.png`, which are only drawn on the Victory/Defeat screens a
player reaches minutes later.

`LoginState.draw` uses exactly **one** image: `nen_game` (Login background). The other
five are not on the Login path at all.

A second, larger cost surfaced during Phase 1 breakdown: `assets.loadFonts()` blocked on
`document.fonts.load('24px "Segoe UI Emoji"')` — **2,024 KB, 15,766 ms** — a decorative
emoji face Login text never uses. It also awaited `document.fonts.ready`, which re-waits
on *every* pending font load, so it could never be partially satisfied.

The progress bar was also dishonest: `p = this.ready ? 1 : Math.min(1, this.elapsed / this.minTime)`
with `minTime = 1.2 s` meant the bar read **"Đang tải... 100%"** while 1.7 MB was still
downloading and the player waited 40 s+.
