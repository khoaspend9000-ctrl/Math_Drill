# M28 DESKTOP <-> WEB PARITY MATRIX

Built from **actual source inspection** of `E:\lam_game_2026\main.py` /
`game_init.py` and `E:\MathDrill\web\js\main.js`, not from milestone documents.

## State inventory (authoritative counts)

Desktop `main.py` states: **26** (+`StateManager`)
Web registered states (`main.js`): **24**

## Matrix

| Feature | Desktop source | Web state | Parity | Severity | Fix required |
|---|---|---|---|---|---|
| LoadingState | main.py:125 | `loading` | EXACT_MATCH | — | — |
| **IdleGifState** | main.py:252 (boot, main.py:232) | **ABSENT** | **REAL_PARITY_GAP** | **P1** | Implement attract screen; asset `gt2.gif` already present |
| LoginState | main.py:183 | `login` | FUNCTIONAL_MATCH | — | — |
| RegisterState | main.py:366 | `register` | FUNCTIONAL_MATCH | — | — |
| MenuState | main.py:414 | `menu` | EXACT_MATCH (M16-M25 restored) | — | — |
| SettingsState | main.py:~700 | `settings` | FUNCTIONAL_MATCH | — | — |
| PasswordChangeState | main.py:~730 | `passwordChange` | FUNCTIONAL_MATCH | — | — |
| LessonSelectState | main.py:751 | `lesson_select` | EXACT_MATCH + M25.1 flip | — | — |
| TheoryState | main.py:922 | `theory` | FUNCTIONAL_MATCH | — | — |
| DefeatState | main.py:1046 | `defeat` | EXACT_MATCH (art + zoom restored) | — | — |
| VictoryState | main.py:1080 | `victory` | EXACT_MATCH (art + scale restored) | — | — |
| PracticeState | main.py:~1220 | `practice` | FUNCTIONAL_MATCH | — | — |
| ReviewState | main.py:~1290 | `review` | FUNCTIONAL_MATCH (+M15 weak topics) | — | — |
| LessonState | main.py:~1418 | `lesson` | EXACT_MATCH (grid, energy bar, top bar) | — | — |
| **TimeAttackState** | main.py:1745 | **ABSENT** (card locked `M7`) | **REAL_PARITY_GAP** | **P1** | Implement from source |
| AchievementViewState | main.py:~1929 | `achievement` | FUNCTIONAL_MATCH | — | — |
| DailyState | main.py:~2004 | `daily` | FUNCTIONAL_MATCH | — | — |
| ProfileState | main.py:2130 | `profile` | FUNCTIONAL_MATCH | — | — |
| SkillMapState | main.py:2273 | `skill_map` | FUNCTIONAL_MATCH | — | — |
| ShopState | main.py:2477 | `shop` | FUNCTIONAL_MATCH | — | — |
| SkillTreeState | main.py:2550 | `skill_tree` | FUNCTIONAL_MATCH | — | — |
| BagState | main.py:~2669 | `bag` | FUNCTIONAL_MATCH | — | — |
| **CardShopState** | main.py (~class list) | **ABSENT** | **REAL_PARITY_GAP** | **P2** | Confirm scope; may be folded into `gacha` |
| **ExamTransitionState** | main.py:3091 | **ABSENT** (card locked `M10`) | **REAL_PARITY_GAP** | **P1** | Implement from source |
| **FinalExamState** | main.py:3234 | **ABSENT** | **REAL_PARITY_GAP** | **P1** | Implement from source |
| **ExamResultState** | main.py:~3286 | **ABSENT** | **REAL_PARITY_GAP** | **P1** | Implement from source |
| PetSystem / SkinSystem | game_init.py | `pet`, `skin` | FUNCTIONAL_MATCH | — | — |
| GachaSystem | game_init.py | `gacha` | FUNCTIONAL_MATCH | — | — |
| AdminPanel | (admin module) | `adminPanel` | FUNCTIONAL_MATCH (web addition) | — | — |
| Logout / session | AccountSystem | via `auth.js` | FUNCTIONAL_MATCH (+M24 restore) | — | — |

## Verified-parity areas (no gap)

- **Gameplay rules** — score, combo, XP, gold, rewards, lesson length all traced
  identical to Desktop during M15/M16 verification.
- **Unlock formula** `(level-1)//6 + 1` identical to `main.py:690,941`. Closed by
  human decision (keep-parity).
- **Curriculum** — G1=40, G2=73, G3=81, G4=73, G5=75 (342 total), contiguous ids,
  verified programmatically.
- **Question variety** — 0 repeat lessons (was 106/342).
- **UI identity** — book/buttons/colours/art restored and verified live on M25.1.

## Unknowns

| Item | Why unknown |
|---|---|
| `CardShopState` exact scope | Needs full read of its `draw`/`update` to confirm it is not merely a mode of Gacha |
| Desktop idle-GIF timing/duration | Needs `main.py:252-345` read in full |
| Exam pass thresholds | Needs `main.py:3091-3300` read in full |

## Parity counts (this milestone)

```
DESKTOP_FEATURE_COUNT      26 states
WEB_FEATURE_COUNT          24 states
EXACT_MATCH_COUNT          ~10 (loading, menu, lesson_select, lesson, victory, defeat, book/button layers)
FUNCTIONAL_MATCH_COUNT     ~10
WEB_ONLY_ADDITION_COUNT     1 (adminPanel)
REAL_PARITY_GAP_COUNT       6  (IdleGif, TimeAttack, ExamTransition, FinalExam, ExamResult, CardShop)
UNKNOWN_COUNT               3
```
