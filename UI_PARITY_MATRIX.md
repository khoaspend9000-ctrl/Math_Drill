# UI_PARITY_MATRIX.md — MathDrill Desktop → Web Visual Parity

> Source of truth: THE ORIGINAL Python/Pygame code (main.py + game_init.py). Web = web/js/states_real.js + ui.js + index.html + style.css.
> Severity: **P0** screen unusable · **P1** major mismatch · **P2** moderate · **P3** cosmetic.
> Browser screenshot comparison NOT available in this environment — every "Web current" is read from Web source, every "Desktop source" from Python source.

## 0. Foundation tokens (game_init.py:308-310, 1964-1996, 126-127)

| Token | Desktop source | Web current | Mismatch | Sev | Fix |
|-------|----------------|-------------|----------|-----|-----|
| Font family | `Quicksand-Bold.ttf` + `Segoe UI Emoji.TTF` (game_init:126-127) | `@font-face 'Quicksand'` + `'Segoe UI Emoji'` (style.css) + Quicksand canvas | none (fonts copied) | — | ✅ parity |
| FONT_SIZES | title 32 / subtitle 24 / button 18 / normal 14 / small 12 | states use 34-40px titles, 16-20 body | near, not exact | P3 | document |
| BUTTON_RADIUS | 12 | drawBtn `o.radius || 12` | ✅ exact | — | — |

### Effective button palette (game_init.py:1985-1991 reassigns; THIS is what screens draw with)

| *Button* | Desktop (effective) | Web BEFORE | Web NOW | Status |
|----------|---------------------|-----------|---------|--------|
| BLUE_BTN / primary | `(0,188,212)` cyan | `[90,130,180]` | `[0,188,212]` | ✅ FIXED P1 |
| GREEN_BTN / success | `(76,175,80)` | `[100,175,110]` | `[76,175,80]` | ✅ FIXED P1 |
| PURPLE_BTN / secondary | `(138,43,176)` | `[150,110,190]` | `[138,43,176]` | ✅ FIXED P1 |
| ORANGE_BTN / warning | `(255,152,0)` | `[215,140,60]` | `[255,152,0]` | ✅ FIXED P1 |
| YELLOW_BTN / accent | `(255,215,0)` | `[210,180,70]` | `[255,215,0]` | ✅ FIXED P1 |
| RED_BTN / danger | `(244,67,54)` | `[190,80,80]` | `[244,67,54]` | ✅ FIXED P1 |
| SHADOW | `(100,100,100)` | `[90,100,120]` | `[100,100,100]` | ✅ FIXED P1 |

## 1. Loading (main.py:125-182 → states_real.js LoadingState)

| Aspect | Desktop | Web | Mismatch | Sev |
|--------|---------|-----|----------|-----|
| Background | `s.fill((20,30,55))` + gradient →(70,120,190) | `#141e37` (20,30,55) + nen_game 0.35 | base fill matches; gradient not drawn | P3 |
| Title/progress | MATHDRILL + progress | MATHDRILL + bar + tip | close | P3 |

## 2. Login (main.py:183-251 → states_real.js LoginState)

| Aspect | Desktop | Web | Mismatch | Sev |
|--------|---------|-----|----------|-----|
| Background | `background_img` else `(255,255,255)` | `#ffffff` + nen_game 0.25 | original uses `backround1.jpg` (NOT copied to web) | P1 |
| Title | "MATHDRILL LOGIN" (120,144,156) | "MATHDRILL LOGIN" `#788a9c` | close | P3 |
| Fields | tkinter-like | rounded rect fields + placeholders | acceptable hybrid | P2 |
| Dev footer | none | REMOVED ("M5 · …") | ✅ FIXED P1 | — |

## 3. Register (main.py:366-413) — Web: LoginState "📝 Đăng Ký Mới" toggle

| Aspect | Desktop | Web | Mismatch | Sev |
|--------|---------|-----|----------|-----|
| Standalone state? | dedicated RegisterState + clover | in-Login toggle | structural | P2 |
| Background | background_img / (30,40,60) | same as Login `#fff` | P2 | register refactor pending |

## 4. Main Menu (main.py:414-751; `s.fill((25,35,65))` + gradient (95,155,220) + RealisticBook)

| Aspect | Desktop | Web | Mismatch | Sev |
|--------|---------|-----|----------|-----|
| Background | (25,35,65)→(95,155,220) gradient | `#192341` flat + (25,35,65) fill | flat vs gradient | P3 |
| Layout | RealisticBook (50,50,1200,700) pages | 2-panel dashboard (60,120,560,640)+(680,120,560,640) | **P1: dash not book** | P1 |
| Player header | book left page | greeting + Level/Lớp + XP bar + Vàng | present, layout differs | P1 |
| Mode cards | book right page | right panel cards x=680 | present | P2 |
| Dev captions | none | REMOVED | ✅ FIXED P1 | — |

## 5. Lesson Select (main.py:922-976; bg (165,214,167))

| Aspect | Desktop | Web | Mismatch | Sev |
|--------|---------|-----|----------|-----|
| Background | (165,214,167) | `R.clear('#a5d6a7')` | ✅ parity | — |
| Container | RealisticBook (50,50,1200,700) | white translucent panel | book vs panel | P1 |
| Title | "KHỐI LỚP {g}" | "KHỐI LỚP " + grade | ✅ | — |
| Lesson cells | lesson_btns | drawBtn 480×80 alt PURPLE/ORANGE + 🔒 | close | P2 |
## 6. Lesson / Game (main.py:1418-1741 → LessonState) — CRITICAL

| Aspect | Desktop | Web | Mismatch | Sev |
|--------|---------|-----|----------|-----|
| Question source | QuestionGenerator + SmartAI | `Game.questionGen` (real M6), no hard-code stub | ✅ | — |
| Correct/wrong styling | answer effects + particles | effects2 AnswerEffectSystem | ✅ | — |
| Progress / pass gate | 15 câu, đúng ≥60% | 15 câu, accuracy ≥60% → Victory | ✅ logic parity | — |

## 7. Victory (main.py:1081+ → VictoryState) dark-green

| Aspect | Desktop | Web | Mismatch | Sev |
|--------|---------|-----|----------|-----|
| Background | victory bg | `#1e5030` dark-green | ✅ | — |
| Rank S/A/B/C | rank_font | rank letter 90px | ✅ | — |
| XP anim + gold | XP bar anim | XP anim (+ gold via M7) | ✅ | — |
| Continue/Review | buttons | continue/review | ✅ | — |

## 8. Defeat (main.py:1005-1080 → DefeatState)

| Aspect | Desktop | Web | Mismatch | Sev |
|--------|---------|-----|----------|-----|
| Panel | (45,48,68,210) + border (255,180,90) r30 | `rgba(45,48,68,.95)` + `rgb(255,180,90)` r24 | ✅ close | — |
| Message | "Cần đạt 60% …" | same | ✅ | — |
| Buttons | retry/home/review | 🔄 LÀM LẠI / 🏠 VỀ MENU / 🧐 XEM LỖI | ✅ | — |

## 9-16. M9 screens

| Screen | Desktop bg | Web bg | Mismatch | Sev |
|--------|------------|--------|----------|-----|
| Shop (main 2462) | (165,214,167)+book | `#a5d6a7` | ✅ | — |
| Pet (main 2793) | (8,12,24) | dark | verify | P2 |
| Skin | (8,12,24) | dark | verify | P2 |
| Gacha (main 3049) | (18,20,34) | dark | verify | P2 |
| Achievement (main 2239) | (28,32,48) | dark | verify | P2 |
| Daily (main 2083) | (165,214,167)+book | `#a5d6a7` | ✅ | — |
| Skill (main 2548) | (165,214,167)+book | `#a5d6a7` | ✅ | — |

## Assets / Fonts

| Asset | Desktop | Web | Status |
|-------|---------|-----|--------|
| login bg `backround1.jpg` | used by Login | NOT in web/assets | **MISSING — P1** |
| fonts Quicksand/Segoe Emoji | root | copied web/fonts | ✅ |
| clover / nen_game | — | web/assets | ✅ |

## Remaining high-severity gaps (NOT fixed this session)

1. **P1 — RealisticBook identity**: Menu/LessonSelect/Shop/Daily/Skill draw a real book (50,50,1200,700); Web uses flat panels. `ui.js` has `RealisticBook` — needs wiring into Menu + LessonSelect.
2. **P1 — Login background** `backround1.jpg` missing from web/.
3. **P3** font-size deltas, flat-vs-gradient backgrounds, panel-vs-book.