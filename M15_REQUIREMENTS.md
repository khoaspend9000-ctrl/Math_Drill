# MathDrill M15 Requirements (evidence baseline — NOT started)

Derived strictly from measured M13/M14 behaviour, the committed source at
`ad764a5`, and gaps found while executing M14. No item is implemented.
Python Desktop source is read-only throughout.

## A. Learning experience quality (highest value)

- **A1. 99 of 342 lessons emit one identical question forever.**
  Measured: 8 samples per lesson produced a single distinct `question_text`
  for 99 lessons. Grade 3 is worst at 45/81 (56%).
  `G3 L77..L81` all return `Tính: 77 + 1 = ?` … `Tính: 81 + 1 = ?` — the same
  trivial arithmetic pattern, unrelated to the lesson.
  Impact: a child drilling Lesson 79 gets the same question 15 times, and 15
  identical correct answers still grant XP and combo. Practice is worthless.
  Type: **defect**. Priority: **P0**.
  Evidence: `E:\m13_temp\m15_survey_out.txt`; `question_generator.js`
  `_generate_grade_*_question` fallthrough for out-of-range `lesson_id`.
- **A2. Degenerate fallback for any lesson beyond the generator's table.**
  The generator's fallback path synthesises `N + 1` / `N - 1` from the lesson
  number. Any `lesson_id` outside the implemented table lands there.
  Impact: identical cause to A1; fixing A1 without A2 leaves the trap.
  Type: **defect**. Priority: **P0**. Dep: A1.
- **A3. Generated question does not match the lesson topic.**
  `lesson_structure` is only populated for grade 1, so `get_lesson_info()`
  returns `null` for grades 2–5. Grade 3 L79 is titled
  "Ôn tập hình học và đo lường" yet yields arithmetic.
  Impact: the curriculum is decorative; topic is never used to pick a generator.
  Type: **enhancement** (needs a design decision on generator coverage).

## B. Review and weak-topic feedback

- **B1. The "Xem lỗi" (review mistakes) button is a no-op.**
  `VictoryState` (states_real.js:1615) and `DefeatState` (states_real.js:1746)
  both draw a real, tappable `Xem lỗi` button whose only effect is
  `L.info('... ReviewState sẽ port ở M8')`. Nothing happens for the player.
  Impact: the app promises error review — the core learning loop after a
  failure — and delivers nothing.
  Type: **defect**. Priority: **P0**.
  Evidence: `states_real.js:1614-1616, 1745-1747`; `wrongAnswers` is already
  collected at `states_real.js:1218` but never read.
- **B2. Wrong answers are collected, then discarded.**
  `LessonState.wrongAnswers` accumulates `{question, userAnswer, correctAnswer,
  operation, lesson}` but is never passed to Victory/Defeat nor persisted.
  Type: **defect**. Priority: **P0**. Dep: B1.
- **B3. No spaced repetition or weak-topic surfacing.**
  `question_generator.js` tracks `stats.lesson_performance` per lesson
  (lines 132-146) but nothing ever reads it to recommend what to practise.
  Impact: the app has the data to guide a child and does not.
  Type: **enhancement**. Priority: **P1**. Dep: B2.
- **B4. Theory content repeats verbatim across lessons.**
  Grade 3 has 14 lessons whose theory body is the identical "Luyện tập chung"
  string; average theory length is 44 characters.
  Type: **content gap**. Priority: **P2**.

## C. Progression clarity

- **C1. End-of-grade lessons need level 469/475/481.**
  `maxUnlocked = (level-1)//6 + 1`, confirmed Desktop parity. Grade 3 L79/80/81
  are therefore unreachable in practice.
  M14 added the visible `Lv469` label (D2), which explains the gate but does
  not make the content reachable.
  Type: **design decision required**. Priority: **P1**.
  Note: changing the formula breaks Desktop parity (`main.py:690,941`).
  Requires explicit human sign-off.

## D. UX consistency

- **D1. Two locked menu cards are permanently unavailable.**
  `Time Attack` and `Thi Chuyển Lớp` carry `locked: 'M7'` / `locked: 'M10'`
  and only log to the console when clicked.
  Type: **defect** (promises features the build cannot deliver).
  Priority: **P2**.
- **D2. No keyboard play on the lesson screen.**
  `LoginState` handles `consumePressedKey`; `LessonState` answers are
  click/tap only. A desktop user must use the mouse.
  Type: **enhancement**. Priority: **P2**.

## E. Mobile / touch

- **E1. Portrait rotate hint shipped in M14 (`494d8f7`).** Guarded.
- **E2. On-screen numeric keyboard absent.**
  Answers are four large canvas buttons, so this is mitigated; keyboard
  entry is not possible on any device.
  Type: **enhancement**. Priority: **P3**.

## F. Reliability / operations

- **F1. Render auto-deploy has not propagated five consecutive pushes.**
  Commits `3a925a4`, `494d8f7`, `f44119c`, `b7e9335`, `ad764a5` are all on
  `Math_Drill@main` (verified by `git ls-remote`) and none is live;
  `/api/meta/version` still returns 404 after 240+ polls.
  M14 added `/api/meta/version` so this is now *observable*, but the deploy
  itself is externally controlled and no dashboard/API/deploy-hook is
  reachable from this workspace.
  Type: **operational blocker**. Priority: **P0**.
  Required human action: Render dashboard → `math-drill-iwys` → confirm the
  repo/branch binding → Manual Deploy.
- **F2. No CI.** No `.github/workflows`, no `render.yaml`, no `Procfile`.
  Every gate is run by hand.
  Type: **enhancement**. Priority: **P2**. Dep: F1.

## G. Guarded (do not regress)

- **G1. Auth/RBAC** — 18/18 live; `H1`/`H2` verified in M13.
- **G2. Grade persistence** — `auth.test.js` T02b.
- **G3. Settings + Password Change** — `m13_settings.test.js`.
- **G4. 342-lesson data integrity** — `m7b` T12, T26.
- **G5. Desktop unlock parity** — `(level-1)//6 + 1` must stay byte-identical.
- **G6. Python source unchanged** — 36 files, `PY_DIFF=0`.

## Priority summary

```text
P0  A1  A2  B1  B2  F1
P1  A3  A4  B3  C1
P2  B4  C2  D1  D2  F2
P3  E1(guard)  E2
```

Five P0 items, two of which (`A1`/`A2`) are the single largest quality
problem found in the whole project: a child can complete a 15-question
lesson and see the same question 15 times.

Count: 22 items (5 P0, 4 P1, 5 P2, 2 P3, 6 guards).

- **C2. No progress indication toward the next unlock.**
  The player sees `Lv469` but not "you are 12 lessons away" or XP remaining.
  Type: **enhancement**. Priority: **P2**. Dep: C1, M14-D2.

  Priority: **P1**. Dep: A1, A2.
- **A4. Template metadata in `math_lessons.json` is never consumed.**
  Each lesson carries a `template` (`logic`, `arithmetic`, `geometry`,
  `measure`, `clock`, `compare`, `fraction`, `decimal`, `percentage`,
  `physics`) that no generator reads. Grade 5 has 21 `decimal` and 7
  `percentage` lessons with no generator at all.
  Type: **enhancement**. Priority: **P1**. Dep: A3.
