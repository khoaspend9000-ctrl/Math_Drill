# MathDrill — M15 Release Candidate Checkpoint

**Status: `M15_RELEASE_CANDIDATE_READY`** (not `M15_COMPLETE`, not deployed)

| Field | Value |
|---|---|
| M15 candidate commit | `8f593602bd1e1c2b225bb191546c4465474a819d` |
| Baseline (M15 line start) | `ae6b34bf0325cd90642b714f74bafaf88b28da45` |
| Current production | `77e18fb482f3685a226ff4a1d3f38067d3f8b62b` (**M14 — M15 NOT deployed**) |
| origin/main | `8f593602bd1e1c2b225bb191546c4465474a819d` |
| Render-linked remote main | `8f593602bd1e1c2b225bb191546c4465474a819d` |
| Worktree | CLEAN |
| Python | **UNCHANGED** — 36 files, `PY_DIFF=0` |
| AHEAD/BEHIND | 0 / 0 on both remotes |

## 1. Requirement status

**`M15_REQUIREMENTS_COMPLETED = 21/22`**

| ID | Requirement | Status | Commit |
|---|---|---|---|
| A1 | No lesson repeats one question forever | FIXED | `db9383a` |
| A2 | Degenerate lesson-number fallthrough | FIXED | `db9383a` |
| A3 | Question matches the lesson topic | FIXED | `db9383a` |
| A4 | `template` metadata consumed | FIXED | `db9383a` |
| B1 | "Xem lỗi" was a no-op | FIXED | `db9383a` |
| B2 | Wrong answers were discarded | FIXED | `db9383a` |
| B3 | Weak-topic surfacing | FIXED | `569dc98` |
| B4 | Theory bodies too thin | FIXED | `1d56c44` |
| C2 | Progress toward next unlock | FIXED | `569dc98` |
| D1 | Locked cards promise milestones | FIXED | `3f1ef2f` |
| D2 | No keyboard play on lessons | FIXED | `3f1ef2f` |
| E2 | No on-screen numeric keypad | FIXED | `ae6b34b` |
| F1 | Deploy identity unobservable | IN-REPO DONE | `ae6b34b` |
| F2 | No CI / no test entrypoint | FIXED | `ae6b34b` |
| **C1** | **Grade 3 L79/80/81 need Lv469/475/481** | **`BLOCKED_PENDING_HUMAN_SIGNOFF`** | — |
| G1–G6 | Guards | 6/6 MUTATION-VERIFIED | `8f59360` |

### C1 — explicitly blocked, deliberately untouched

The unlock formula `(level-1)//6 + 1` matches Desktop exactly (`main.py:690,941`).
Changing it would break Desktop parity, so **it was not modified**.

### F1 — in-repo complete, external action pending

`web/tests/m15_deploy_status.js` answers "which release is live?" in one
command (exit 0 CURRENT / 1 STALE / 2 UNREACHABLE).
**`F1_EXTERNAL = PENDING_HUMAN_ACTION`** — the Render Manual Deploy has not
been performed, so it is NOT counted complete.

---

## 2. Bugs found and fixed this milestone

| # | Area | Defect | Evidence |
|---|---|---|---|
| 1 | A1 | 106/342 lessons emitted ≤3 distinct questions in a 15-question lesson | 8 samples × 342 lessons |
| 2 | A2 | Grade 1/3 `else` fallthrough built a question from the lesson number | `Tính: 79 + 1 = ?` |
| 3 | B1 | "Xem lỗi" only logged "sẽ port ở M8" | Victory/Defeat click |
| 4 | D1 | Locked cards said "sẽ mở ở M7/M10" (developer milestones) | real Chromium |
| 5 | D2 | Lesson screen had no keyboard answering | source + Chromium |
| 6 | E2 | No on-screen keypad for touch | source scan |
| 7 | F2 | `npm test` was a stub that always exited 1 | `package.json` |
| 8 | **G4** | **m7b guard was a false positive** | deleting G3 L79 still gave `pass=29 fail=0` |
| 9 | **G4** | **Node ≥18 global `fetch` rejects relative URLs → `getLessonsForGrade` returned 0 lessons** | `loadAll()` returned `{}` |
| 10 | **G6** | **Python guard had no automated test at all** | only a manual command existed |

**B4 factual correction:** the requirement claimed 14 Grade 3 theory bodies were
identical "Luyện tập chung". Measurement found **0 duplicates** across 345 pages.
The real defect was thin content (avg 44 chars). Do not go looking for a
duplicate-body bug.

---

## 3. Test results (fresh, this gate)

```text
Web regression      49 suites, 676 pass, 0 fail, 15 skip, 0 harness errors
Server suites       11 suites, 136 pass, 0 fail
Chromium gate       16/16 flows PASS
  console errors    0
  page errors       0
  request failures  0
  unexpected 4xx/5xx 0
```

**Guards — each proven by deliberately breaking the behaviour:**

| Guard | Mutation | Result |
|---|---|---|
| G1 | disabled 3 `requireAuth` gates | server module crashed, suite failed |
| G2 | `register()` always stores grade 1 | `T02b` failed |
| G3 | `SettingsState.persist` → no-op | "volume control persists" failed |
| G4 | deleted `grade_3` lesson 79 | `m7b` now fails (was silently passing) |
| G5 | `(level-1)//6+1` → `//5` | 6 assertions failed across 2 suites |
| G6 | appended a line to `main.py` | `T02` + `T03` failed |

**Browser flows covered:** boot, register+login, session credential survives
reload, re-login, menu, lesson select, theory, lesson, correct answer (score 30 /
combo 1), wrong answer (combo reset to 0, 1 record captured), victory, defeat,
B3 weak-topic, C2 progression header, E2 touch keypad.

---

## 4. Known observations (not defects)

- The app boots to the **Login** screen after a reload even with a valid
  24-hour session cookie. Desktop behaves the same way (gated on
  `account_system.current_user`), so this is parity, not a regression. The
  credential survives (`GET /api/auth/me` → 200) and re-login works.
- C1's unreachable end-of-grade lessons are a product-design question.

---

## 5. Files changed vs the M15 baseline

```text
render.yaml                                NEW
package.json
web/js/data_loader.js
web/js/question_generator.js
web/js/settings_states.js
web/js/states_real.js
web/js/theory_pages.js
web/tests/_run_regression.py
web/tests/final_qa.test.js
web/tests/m7b_lesson_select.test.js
web/tests/m7d_victory_defeat.test.js
web/tests/m15_question_variety.test.js    NEW
web/tests/m15_weak_topics.test.js         NEW
web/tests/m15_progress_clarity.test.js    NEW
web/tests/m15_theory_quality.test.js      NEW
web/tests/m15_ux_consistency.test.js      NEW
web/tests/m15_mobile_touch.test.js        NEW
web/tests/m15_python_guard.test.js        NEW
web/tests/m15_deploy_status.js            NEW
```

**Python: ZERO changes.** 36 files, byte-identical, enforced by `m15_python_guard`.

---

## 6. Deployment instructions (NOT yet performed)

1. Render dashboard → service `math-drill-iwys`
2. Confirm the repository is `khoaspend9000-ctrl/Math_Drill`, branch `main`
3. Manual Deploy for exact commit `8f593602bd1e1c2b225bb191546c4465474a819d`
4. Verify: `node web/tests/m15_deploy_status.js` must print `MATCH=YES`,
   `DEPLOY_STATUS=CURRENT`, exit 0
5. Only then is M15 production-verified

**M15 is NOT production-verified. Production remains on M14 `77e18fb`.**
