# FINAL RELEASE CHECKPOINT

MathDrill Web - production closeout for the currently verified build.

## 1. Identity

| Field | Value |
|---|---|
| **Production commit** | `2a8d42068f3bae643510b8dfd27d5afe2f593fd1` |
| **Source commit** | `2a8d42068f3bae643510b8dfd27d5afe2f593fd1` (identical; no source-only delta) |
| Milestone | M24 - session restore on reload |
| Service | `https://math-drill-iwys.onrender.com` (name `math-drill`, branch `main`) |
| Deploy status | `MATCH=YES`, `DEPLOY_STATUS=CURRENT`, gate exit 0 |
| Release tag | `m24-final-verified` (on the commit above) |
| **Rollback commit** | `404f46a798d599333edd2c97046163fe8f5735c3` (M21 - the previously live-verified build) |

## 2. Regression

| Suite | Suites | Pass | Fail | Skip | Harness errors |
|---|---|---|---|---|---|
| Web | 51 | **720** | 0 | 15 | **0** |
| Server | 11 | **136** | 0 | 0 | **0** |

`PROBLEM SUITES: NONE` / `HARNESS_ERRORS: NONE`.

## 3. Long run - live production, real Chromium

Single persistent session; real `page.mouse.click()` through the real DOM event
path (canvas `pointerdown` -> `InputManager` -> engine rAF tick -> state machine).
No state mutation, no forced level/XP, no bypassed generation or transitions.

```
QUESTIONS_EXECUTED        = 1000   (CORRECT 500 + WRONG 500 = 1000 exactly)
CORRECT                   = 500
WRONG                     = 500
INVARIANTS                = 1211
INVARIANT_FAILURES        = 0
STATE_TRANSITION_FAILURES = 0
PAGE_ERRORS               = 0
UNEXPECTED_CONSOLE_ERRORS = 0
REQUEST_FAILURES          = 0
STUCK_STATES              = 0
RACE_CLICKS (excluded)    = 211   clicks during lesson-end transitions
LESSONS_COMPLETED         = 72    (defeat 71, victory 0)
```

Invariants asserted on every question: exactly 4 options, all distinct, the
correct answer present among them, 4 button rects present.

Disclosures:
- All 72 lessons ended in **defeat**, because alternating correct/wrong pins
  accuracy at 50%, below the victory threshold. Victory is covered by the
  production gate in section 4. Not a defect.
- An earlier run reported `QUESTIONS_EXECUTED=1000` with only 826 verifiable
  results. The counter was corrected to increment only on a verified
  correct/wrong outcome and the run repeated. The 1000 above are all real.

## 4. Browser checks - live production

| Check | Result |
|---|---|
| Boot -> ready, leaves `loading` -> `login` | PASS |
| Register 201, login via the REAL `LoginState` UI -> Menu | PASS |
| Reload -> Menu, username + grade preserved, no password re-entry | PASS |
| Negative path: logout -> reload -> Login; `/api/auth/me` 401 | PASS |
| Gameplay 96 questions, 48 correct / 48 wrong, 0 invariant failures | PASS |
| Book surface: brown cover 155 px, cream pages 10641 px on Menu | PASS |
| Button: `strokeRoundRectAlpha` + `fillRoundRectAlpha` shipped, rest border 80/255 width 2 | PASS |
| Page flip: `startFlip` present, duration 0.3333 s, page width 580 | PASS |

Console output: only HTTP 401 lines from the anonymous-session probe on the
negative auth path - correct enforcement, the app stays on Login. No admin
probe was generated.

Local (same commit) additionally: **22 screens** drawn, **5 viewports**
(1300x800, 1280x720, 1920x1080, 1024x640, 390x844), all clean.

## 5. Python integrity

```
PY_TOTAL = 36
PY_DIFF  = 0
```
Desktop `main.py` / `game_init.py` and the whole Python tree are byte-identical
between `E:\lam_game_2026` and `E:\MathDrill`. **No Python file was modified.**

## 6. Git state

```
HEAD          = 2a8d42068f3bae643510b8dfd27d5afe2f593fd1
origin/main   = 2a8d42068f3bae643510b8dfd27d5afe2f593fd1
render/main   = 2a8d42068f3bae643510b8dfd27d5afe2f593fd1
WORKTREE      = CLEAN
AHEAD_BEHIND  = 0 / 0
```
No force-push, no history rewrite, no amend, no reset. Rollback anchor
`404f46a` remains an ancestor and is intact.

## 7. Scope status

| Item | Status | Note |
|---|---|---|
| **C1** | **`CLOSED_BY_HUMAN_DECISION` / `KEEP_PARITY`** | Human decision: **Option A - keep Desktop parity.** The unlock formula `(level-1)//6 + 1` is unchanged. Grade 3 L79/80/81 stay at levels 469/475/481. No code was modified. |
| **TimeAttack** | `OUT_OF_SCOPE` | `M15_REQUIREMENTS.md:70` marks it `locked: 'M7'` - a scheduled future mode, not a release requirement. Absent from `main.js` registrations and `states_real.js`. Not implemented. |
| **Exam** | `OUT_OF_SCOPE` | `locked: 'M10'`, same reasoning. Not implemented. |

## 8. C1 decision - CLOSED

**Decision: Option A - KEEP DESKTOP PARITY** (human decision, recorded here).

> Should MathDrill break Desktop parity by changing the unlock formula so the
> three Grade 3 year-end review lessons become reachable, or keep parity and
> leave that content permanently locked?

**Chosen: keep parity.** The unlock formula is unchanged and Grade 3 lessons
79/80/81 remain at levels 469 / 475 / 481. The content ships; no player reaches
it. That is the accepted outcome, not an open defect.

Parity verified, not asserted:

| Where | Expression |
|---|---|
| `web/js/data_loader.js` (Web, shipped) | `Math.floor((playerLevel - 1) / 6) + 1` |
| `main.py:690` and `main.py:941` (Desktop) | `max_unlocked_lesson = (user_level - 1) // 6 + 1` |
| `game_init.py:900` (Desktop) | `required_level = (max_lesson_num - 1) * 6 + 1` |

All three are the same rule. `PY_DIFF = 0` across 36 Python files. No product
code was modified for this decision, in either the Web or Desktop tree.

## 9. Final status

```
FINAL_RELEASE_READY = YES
C1                   = CLOSED_BY_HUMAN_DECISION (KEEP_PARITY)
FINAL_RELEASE_CLOSED = YES
```