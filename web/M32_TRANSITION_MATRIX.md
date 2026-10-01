# M32 — TRANSITION MATRIX

Desktop transitions extracted from every `trigger_transition(` and `manager.change(`
call in `main.py`. Web targets extracted from every `states.change('…'` in
`states_real.js` and `settings_states.js`.

| From | Trigger | Desktop destination | Desktop args | Type | Web destination | Match |
|---|---|---|---|---|---|---|
| Loading | boot | `LoginState()` | — | — | `login` | YES |
| Login | open register | `RegisterState()` (main.py:202) | — | — | `register` | YES |
| Login | 15 s idle | `IdleGifState()` (main.py:232) | — | — | `idleGif` | YES |
| Login | login ok | `MenuState()` (main.py:225) | — | PAGE | `menu` | YES |
| Login | logout (menu) | `LoginState(prefill_user=…)` (main.py:710) | prefill | — | `login` | YES (target) |
| IdleGif | click | `LoginState()` (main.py:349) | — | — | `login` | YES |
| Menu | card 0 | `LessonSelectState()` (main.py:673) | — | — | `lesson_select` | YES |
| Menu | Time Attack | `TimeAttackState()` (main.py:676) | — | — | `time_attack` | YES |
| Menu | daily card | `DailyState()` (main.py:680) | — | — | `daily` | YES |
| Menu | exam card | `ExamTransitionState()` (main.py:693) | — | PAGE | `exam_transition` | YES |
| Menu | achievement | `AchievementViewState()` (main.py:700) | — | — | `achievement` | YES |
| Menu | profile | `ProfileState()` (main.py:702) | — | — | `profile` | YES |
| Menu | settings | `SettingsState()` (main.py:704) | — | — | `settings` | YES |
| Menu | shop | `ShopState()` (main.py:712) | — | — | `shop` | YES |
| Menu | skill | `SkillTreeState()` (main.py:718) | — | — | `skill_tree` | YES |
| Menu | 🏪 card | `CardShopState()` (main.py:724) | — | — | `cardShop` | YES |
| Menu | bag | `BagState()` (main.py:726) | — | — | `bag` | YES |
| Menu | user btn | `ProfileState()` (main.py:728) | — | — | `profile` | YES |
| Menu | admin | `AdminPanelState()` (main.py:731) | — | — | `adminPanel` | YES |
| Settings | back | `MenuState()` (main.py:789) | — | — | `menu` | YES |
| Settings | password | `PasswordChangeState()` (main.py:842) | — | — | `passwordChange` | YES |
| PasswordChange | back | `SettingsState()` (main.py:890) | — | — | `settings` | YES |
| LessonSelect | next page | `LessonSelectState(cur+1)` (main.py:957) | page | — | in-place `bookNav` | YES (M25.1) |
| LessonSelect | prev page | `LessonSelectState(cur-1)` (main.py:958) | page | — | in-place `bookNav` | YES (M25.1) |
| LessonSelect | back | `MenuState()` (main.py:956) | — | — | `menu` | YES |
| LessonSelect | theory | `TheoryState(original_title)` (main.py:960) | title | — | `theory` | YES |
| Theory | start | `LessonState(title)` (main.py:989) | title | — | `lesson` | YES |
| Theory | back | `LessonSelectState()` (main.py:990) | — | — | `lesson_select` | YES |
| **Defeat** | **retry (daily)** | **`DailyState()` (main.py:1029)** | — | — | **`lesson`** | **NO** |
| **Defeat** | **retry (normal)** | **`LessonState(lesson_title)` (main.py:1030)** | title | — | `lesson` | YES |
| Defeat | home | `MenuState()` (main.py:1032) | — | — | `menu` | YES |
| Defeat | review | `ReviewState(wrong, title, cb)` (main.py:1038) | 3 args | — | `review` | YES |
| Victory | home | `MenuState()` (main.py:1143) | — | — | `menu` | YES |
| Victory | review | `ReviewState(wrong, title, cb)` (main.py:1149) | 3 args | — | `review` | YES |
| Review | practice | `PracticeState(wrong, title, cb)` (main.py:1372) | 3 args | — | `practice` | YES |
| Practice | complete | `VictoryState(title, score*10, lesson, stats)` (main.py:1283) | 4 args | — | `victory` | YES |
| Lesson | win | `VictoryState(title, score, lesson, stats)` (main.py:1502) | 4 args | — | `victory` | YES |
| Lesson | lose | `DefeatState(title, correct, total, lesson, stats)` (main.py:1504) | 5 args | — | `defeat` | YES |
| Lesson | back | `MenuState()` (main.py:1614) | — | — | `menu` | YES |
| TimeAttack | timeout | `VictoryState("HẾT GIỜ!", score, "Time Attack", stats)` (main.py:1859) | 4 args | — | `victory` | YES |
| TimeAttack | back | `MenuState()` (main.py:1842) | — | — | `menu` | YES |
| Achievement | back | `MenuState()` (main.py:1935) | — | PAGE | `menu` | YES (target) |
| Daily | win | `VictoryState(...)` (main.py:2034) | 4 args | — | `victory` | YES |
| Daily | lose | `DefeatState(...)` (main.py:2036) | 5 args | — | `defeat` | YES |
| Daily | back | `MenuState()` (main.py:2047) | — | — | `menu` | YES |
| Profile | back | `MenuState()` (main.py:2139) | — | PAGE | `menu` | YES |
| Profile | skill map | `SkillMapState()` (main.py:2141) | — | PAGE | `skill_map` | YES |
| SkillMap | back | `ProfileState()` (main.py:2229) | — | PAGE | `profile` | YES |
| Shop | back | `MenuState()` (main.py:2443) | — | PAGE | `menu` | YES |
| SkillTree | back | `MenuState()` (main.py:2515) | — | — | `menu` | YES |
| Bag | back | `MenuState()` (main.py:2726) | — | PAGE | `menu` | YES |
| CardShop | back | `MenuState()` (main.py:3010) | — | PAGE | `menu` | YES |
| ExamTransition | done | `FinalExamState()` (main.py:3118) | — | — | `final_exam` | YES |
| FinalExam | back | `MenuState()` (main.py:3157) | — | — | `menu` | YES |
| FinalExam | submit | `ExamResultState(score)` (main.py:3161) | score | — | `exam_result` | YES |
| ExamResult | back | `MenuState()` (main.py:3271) | — | — | `menu` | YES |
| AdminPanel | back | `MenuState()` (main.py:3282) | — | — | `menu` | YES |

**57 Desktop transitions mapped. 1 mismatch (§16.1 of the parity matrix).**

Web-only transitions with no Desktop origin: `→ pet`, `→ skin`, `→ gacha`,
`→ practice` (Practice exists in Desktop but is reached only from Review, which the
Web honours), `→ review` from Defeat (Desktop reaches Review from Defeat too).
