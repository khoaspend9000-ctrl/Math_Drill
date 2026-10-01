# M32 — FINAL DESKTOP <-> WEB PARITY RE-AUDIT

Method: derive the Desktop inventory from source (`^class \w+\(GameState\)` across every
`.py`), not from any prior milestone document. Then map each to the Web implementation.
Adversarial posture assumed throughout: M31 proved the M28 audit wrong, so every
"verified" state was re-derived rather than trusted.

# 1. Desktop state inventory

`grep -h '^class \w*(GameState)'` over `*.py ui/*.py systems/*.py` → **26 subclasses,
all in `main.py`**. Non-`GameState` classes that are still states:
`admin_panel.py:131 AdminPanelState` (used by `main.py:731`).

| # | Desktop state | Source |
|---|---|---|
| 1 | LoadingState | main.py:125 |
| 2 | LoginState | main.py:183 |
| 3 | IdleGifState | main.py:252 |
| 4 | RegisterState | main.py:366 |
| 5 | MenuState | main.py:414 |
| 6 | SettingsState | main.py:751 |
| 7 | PasswordChangeState | main.py:874 |
| 8 | LessonSelectState | main.py:922 |
| 9 | TheoryState | main.py:977 |
| 10 | DefeatState | main.py:1005 |
| 11 | VictoryState | main.py:1081 |
| 12 | PracticeState | main.py:1220 |
| 13 | ReviewState | main.py:1324 |
| 14 | LessonState | main.py:1418 |
| 15 | TimeAttackState | main.py:1745 |
| 16 | AchievementViewState | main.py:1927 |
| 17 | DailyState | main.py:2002 |
| 18 | ProfileState | main.py:2130 |
| 19 | SkillMapState | main.py:2191 |
| 20 | ShopState | main.py:2273 |
| 21 | SkillTreeState | main.py:2477 |
| 22 | BagState | main.py:2670 |
| 23 | CardShopState | main.py:2947 |
| 24 | ExamTransitionState | main.py:3091 |
| 25 | FinalExamState | main.py:3140 |
| 26 | ExamResultState | main.py:3234 |

# 2. Web state inventory

`main.js` registers **30** states. `states_real.js` defines 28 classes;
`settings_states.js` supplies ReviewState, PracticeState, SettingsState,
PasswordChangeState. `states.js` also defines `LoadingState` and `MenuState`
but is **not loaded by `index.html`** (only `states_real.js` + `settings_states.js`
are) while `main.js:28` and 10 test files still `require` it — a parallel
implementation that can drift without ever running in the browser.

# 3. State parity matrix

| Desktop | Web | Player-facing | Reachable | Status | Note |
|---|---|---|---|---|---|
| LoadingState | loading | yes | yes | PASS | |
| LoginState | login | yes | yes | PASS | M24 session restore verified |
| IdleGifState | idleGif | yes | conditional | PASS | M29.1; gt2.gif loaded on entry, not at boot |
| RegisterState | register | yes | yes | PARTIAL | draw layer not re-diffed this milestone |
| MenuState | menu | yes | yes | PASS | 12-card grid matches main.py:455-467 |
| SettingsState | settings | yes | yes | PASS | M13 |
| PasswordChangeState | passwordChange | yes | yes | PASS | M13 |
| LessonSelectState | lesson_select | yes | yes | PASS | geometry + book flip verified |
| TheoryState | theory | yes | yes | PASS | |
| DefeatState | defeat | yes | yes | **MISMATCH** | **P1 — see §16.1** |
| VictoryState | victory | yes | yes | PASS | |
| PracticeState | practice | yes | conditional | PASS | M15-B |
| ReviewState | review | yes | conditional | PASS | M15-B |
| LessonState | lesson | yes | yes | PASS | M25.1 page flip preserved |
| TimeAttackState | time_attack | yes | yes | PASS | M29.2 |
| AchievementViewState | achievement | yes | yes | PARTIAL | name differs; semantics not re-diffed |
| DailyState | daily | yes | yes | PASS | |
| ProfileState | profile | yes | yes | PARTIAL | admin gold override missing (P3) |
| SkillMapState | skill_map | yes | conditional | PASS | |
| ShopState | shop | yes | yes | PARTIAL | Web splits pen/board/pet (see §16.2) |
| SkillTreeState | skill_tree | yes | conditional | PASS | grade gate matches |
| BagState | bag | yes | yes | PASS | |
| CardShopState | cardShop | yes | conditional | PASS | M31 |
| ExamTransitionState | exam_transition | yes | conditional | PASS | M30.1 |
| FinalExamState | final_exam | yes | conditional | PASS | M30.2 |
| ExamResultState | exam_result | yes | conditional | PASS | M30.2 |
| — (admin_panel.py:131) | adminPanel | admin-only | conditional | PASS | server-gated |

Web-only, no Desktop equivalent: **PetState, SkinState, GachaState**.

# 4. Transition matrix

Full Desktop transition list extracted from `trigger_transition(` / `manager.change(`.
Notable rows:

| From | Trigger | Desktop | Type | Web | Match |
|---|---|---|---|---|---|
| DefeatState | retry | `DailyState()` if `lesson_title == "Thử Thách"` else `LessonState(title)` (main.py:1029-1030) | none | always `lesson` | **NO** |
| Menu | card 2 | `TimeAttackState()` main.py:676 | none | `time_attack` | YES |
| Menu | card 3 | `ExamTransitionState()` main.py:693 | PAGE | `exam_transition` | YES |
| Menu | 🏪 | `CardShopState()` main.py:724 | none | `cardShop` | YES (M31) |
| Menu | skill | `SkillTreeState()` main.py:718 | none | `skill_tree` | YES |
| Profile | back | `MenuState()` main.py:2139 | PAGE | `menu` | YES (target) |
| Profile | skill map | `SkillMapState()` main.py:2141 | PAGE | `skill_map` | YES (target) |
| CardShop | back | `MenuState()` main.py:3010 | PAGE | `menu` | YES (target) |
| FinalExam | submit | `ExamResultState(score)` main.py:3161 | none | `exam_result` | YES |
| ExamResult | back | `MenuState()` main.py:3271 | none | `menu` | YES |
| IdleGif | click | `LoginState()` main.py:349 | none | `login` | YES |

# 5. Gameplay parity

Scoring, combo, XP, gold and the unlock formula were re-derived from source this
milestone and match: `(level-1)//6+1` ≡ `main.py:690,941,947`. Question generation
was verified by executing Desktop `generate_hard_exam` directly and comparing
counts (11/11/10/13/11) — PASS.

# 6. Curriculum / progression parity

342 lessons, 40/73/81/73/75, unchanged. Grade 3 79/80/81 reachable only at
levels 469/475/481 by Desktop rule — parity preserved, not a defect.

# 7. Input parity

Digit-row answering and the mobile keypad are **Web extensions** (Desktop is
mouse-only). They resolve to the same option the mouse path clicks and are
suppressed during feedback, so gameplay semantics are unchanged — classified
**EXTENDED (documented)**, not a defect.

# 8. Render parity

Book/button/page-flip verified live on M25.1. `states_real.js` is now ~270 KB and
holds 28 state classes; several older draws were not re-diffed line-by-line in this
milestone and are marked PARTIAL rather than PASS.

# 9. Audio / effects parity

`set_bgm` is a documented no-op in Web (`L.info` only) — an acknowledged platform
gap, **P3**, unchanged since M4.

# 10. Asset parity

`gt2.gif` is present, not in the boot preload list, and fetched only when
IdleGifState opens — M29.1 behaviour intact. `nen_game`, `victory_text`, `defeat`,
`main_character`, `pixel_clover` all loaded in production.

# 11. Persistence semantics

Desktop mutates `account_system.data()` then `save()`; Web does the same through
`auth.data()` / `auth.save()`. `accountToPlayerSave` maps `xp`→`exp` (M10-QA2),
which Desktop does implicitly because it has one object. Semantically equivalent.
**Durability is explicitly out of scope for M32** per §14 and remains an open
M33 item.

# 12. Account / session parity

M24 behaviour unchanged: login → session → reload → restore → logout. Verified
earlier with 5 accounts, 0 cross-user leakage.

# 13. Mobile parity

390x844 verified across every reachable state in M29–M31 runs.

# 14. Scope exclusions

Production storage durability, deployment automation, privacy/legal and analytics
are **explicitly excluded** by §14. Not addressed here.

# 16. Remaining verified gaps

## 16.1 P1 — Defeat retry never returns to the Daily Challenge

**Desktop `main.py:1029-1030`**
```python
if self.btn_retry.clicked(e.pos):
    if self.lesson_title == "Thử Thách": manager.change(DailyState())
    else: manager.change(LessonState(self.lesson_title))
```

**Web `states_real.js` DefeatState.handleInput** routes retry unconditionally to
`states.change('lesson', …)`. A player who fails the Daily Challenge and presses
"LÀM LẠI" is dropped into a normal numbered lesson instead of the daily challenge
they were just attempting. Grep confirms the string `Thử Thách` appears in Web only
as the Menu card label (states_real.js:1482); no defeat branch exists.

**Impact:** real, player-facing, reachable by every player who fails a daily.
**Fix:** add the `lessonTitle` comparison and the `daily` branch.

## 16.2 STRUCTURAL — Web splits Desktop's ShopState

**Desktop `main.py:2273-2476`** is a single screen with filters
`[("all"),("pen"),("board"),("pet")]` (main.py:2288) handling pen, board **and pet**
purchase/equip. Desktop `MenuState` has **no** pet or skin button
(`main.py:460-467`: logout, shop, skill, gacha, bag, admin, user).

**Web** splits this into `ShopState` + `PetState` + `SkinState` and gives all three
their own Menu cards (states_real.js:1613, 1615). The capabilities exist, but the
navigation structure differs from Desktop.

**Not a functional regression** — nothing is unreachable. Recorded as a deliberate
**Web structural difference**, not a P1.

## 16.3 P3 — ProfileState admin gold override

`main.py:2173` shows `Vô hạn (Admin)` for the admin account. Web `ProfileState`
always prints the numeric gold. Admin-only, cosmetic → P3.

## 16.4 P3 — Parallel `states.js`

`web/js/states.js` duplicates `LoadingState` and `MenuState`; it is not loaded by
`index.html` but is still `require`d by `main.js:28` and 10 test files. Dead in the
browser, live in tests → drift risk, P3.

# 17. Unknowns

Not re-diffed line-by-line this milestone (previous PASS not treated as proof):
RegisterState.draw, AchievementViewState.draw, DailyState.draw, ShopState.draw,
SkillTreeState.draw, BagState.draw, VictoryState.draw, and the internal
`TransitionEffect` / `compute_profile_stats` helpers.

# 18. P0/P1/P2/P3 classification

| Sev | Item |
|---|---|
| P0 | none |
| P1 | 16.1 Defeat retry → DailyState |
| P2 | none |
| P3 | 16.3 admin gold text, 16.4 parallel states.js, `set_bgm` no-op |

# 19. M32 conclusion

**Decision B — VERIFIED P1 GAPS REMAIN.** One P1 (16.1) and three P3 items are
source-proven. No P0. Full parity is **not** claimed: §17 lists states whose draws
were not re-verified, and 16.1 is a real defect in a core flow.
