# MathDrill — ORIGINAL UI SOURCE OF TRUTH

**Authority:** `E:\lam_game_2026\main.py` (3730 lines) and `E:\lam_game_2026\game_init.py` (5309 lines).
**Target:** the Web game at `E:\MathDrill` must read as *the same MathDrill game running in a browser*.
**This document is an audit. No application source was modified.**

> **Measurement caveat that affects every line number below.** The Python files are pure LF
> (`main.py`: 3729 `\n`, 0 CR; `game_init.py`: 5308 `\n`, 0 CR). PowerShell's `Get-Content`
> offsets and `Measure-Object -Line` **disagree** with the true line numbers (they reported
> `COLORS` at 2086 vs the real 1972). All line numbers here were taken with `Select-String`
> and cross-checked by splitting the file on `\n` in Python. Where tools disagree, this
> document is right.

---

## A. Desktop rendering architecture

- **Screen:** `WIDTH, HEIGHT = 1300, 800` — `game_init.py:240`.
- **Renderer:** pygame immediate-mode. Each state implements `draw(surface)`; there is no
  retained scene graph. `StateManager.change(state, transition_type=...)` performs
  `HERTA` (fade), `PAGE` (book page-flip) or no transition.
- **State list** (`main.py`): LoadingState 125, LoginState 183, IdleGifState 252,
  RegisterState 366, MenuState 414, SettingsState 751, PasswordChangeState 874,
  LessonSelectState 922, TheoryState 977, DefeatState 1005, VictoryState 1081,
  PracticeState 1220, ReviewState 1324, LessonState 1418, TimeAttackState 1745,
  AchievementViewState 1927, DailyState 2002, ProfileState 2130, SkillMapState 2191,
  ShopState 2273, SkillTreeState 2477, BagState 2670, CardShopState 2947,
  ExamTransitionState 3091, FinalExamState 3140, ExamResultState 3234, StateManager 3287.
- **Shared chrome:** `RealisticBook` (`game_init.py:4279`) is the page frame used by Menu,
  Settings, LessonSelect and Theory. `draw_top_bar` (`game_init.py:3549`) is a 70 px
  in-game bar. `draw_gradient` (3528) is a full-height vertical lerp. `draw_badge` (3540)

## B. Visual constant inventory (LIVE values)

`game_init.py` binds the button palette **twice**. The first binding (309-310, muted
pastels `BLUE_BTN=(110,150,190)` etc.) is **dead code**. The live values are 1985-1991,
and `main.py:3610-3615` reads them off the `gi` module, so the later binding wins.

| Constant | Value | Source | Used by |
|---|---|---|---|
| `WIDTH`,`HEIGHT` | 1300, 800 | `game_init.py:240` | everything |
| `COLORS['primary']` | **(0, 188, 212) cyan** | `game_init.py:1973` | `BLUE_BTN` |
| `COLORS['success']` | (76, 175, 80) | 1974 | `GREEN_BTN` |
| `COLORS['danger']` | (244, 67, 54) | 1975 | `RED_BTN` |
| `COLORS['warning']` | (255, 152, 0) | 1976 | `ORANGE_BTN` |
| `COLORS['accent']` | (255, 215, 0) | 1977 | `YELLOW_BTN` |
| `COLORS['secondary']` | (138, 43, 176) | 1978 | `PURPLE_BTN` |
| `COLORS['background']` | (13, 27, 42) | 1979 | declared (see note) |
| `COLORS['text']` / `text_secondary` | (255,255,255) / (176,190,197) | 1980-1981 | declared |
| `COLORS['card']` | (23, 43, 77) | 1982 | declared |
| `SHADOW` | (100, 100, 100) | 1991 | Menu "Cài Đặt" card, ADMIN button |
| `MARGIN` / `PADDING` | 20 / 12 | 1993-1994 | layout |
| `CARD_RADIUS` | 20 | 1995 | card components |
| `BUTTON_RADIUS` | 12 | 1996 | `Button` / `CardButton` |
| `TOP_BAR_H` / `BOTTOM_BAR_H` | 70 / 100 | `game_init.py:3521-3522` | `get_layout_rects` |

> ### FINDING 1 — the `BLUE_BTN` comment is stale; the value is cyan
> `game_init.py:1986` reads `BLUE_BTN = COLORS['primary']       # (70, 130, 180)`.
> The **comment** claims dusty blue, but `COLORS['primary']` at line 1973 is
> **`(0, 188, 212)` cyan**. A binding takes the value, not the comment. Every other token's
> comment *does* agree with its value, which is what makes this one easy to misread.
> **The runtime colour of the original primary button is cyan.**

`COLORS['background'|'text'|'text_secondary'|'card']` are declared but the states mostly
use their own literals (e.g. Menu `s.fill((25,35,65))`). Do not treat `COLORS` as the
single source for screen backgrounds.

## C. Original asset inventory

| File | Bytes | Loaded at | Drawn by | Destination / scale |
|---|---:|---|---|---|
| `backround1.jpg` | 40,295 | `gi:290` `background_img` | Menu, Login, Lesson | `get_scaled_background(img,(1300,800),alpha)`; alpha **60** Menu, **45** Loading, opaque Login |
| `main_character.png` | 417,444 | `gi:292` (600x600) | Theory, Menu | `smoothscale` to **200x200** at `(860,80)`; Menu left page 210x210 with idle bob at `rect.centerx, rect.bottom-220` |
| `victory_text.png` | 505,577 | `main.py:1085` `load_image` | Victory | `smoothscale` x2.0, centred `(650, HEIGHT/2-180)`, alpha 0->255 |
| `defeat.png` | 431,049 | module-level `defeat_bg_img` | Defeat | `smoothscale` to `WIDTH*bg_scale x HEIGHT*bg_scale`, `bg_scale += 0.05/s`, centred |

## D. Per-screen rendering specification (rendering order)

### D0. LoadingState — `main.py:160-182`
1. `s.fill((20,30,55))`
2. `draw_gradient((20,30,55) -> (70,120,190))`
3. `background_img` scaled 1300x800 at **alpha 45**
4. Title `"MATHDRILL"`, `load_font(54)`, WHITE, centred at `HEIGHT/2-170`
5. Bar `w=520,h=28`, `x=WIDTH/2-260`, `y=HEIGHT/2-20`, track `(40,40,60)` radius 14,
   fill `(100,200,255)` radius 14, outline `(255,255,255)` width 2 radius 14
6. `f"Dang tai... {int(progress*100)}%"` font 18 `(230,230,245)` at `y-36`
7. tip, font 18 `(230,230,245)` at `y+60`

Progress is a **fake timer**: `progress += dt*0.75`, and *any* key/mouse event forces it to
1.0 (`handle_event` 149-151). ~0.8-1.5 s. Desktop is *deliberately* fake here.

### D1. LoginState — `main.py:233-251`
1. `background_img` blitted unscaled, opaque, at `(0,0)` (no gradient)
2. `FallingCloverEffect(30)`
3. `"MATHDRILL LOGIN"` `font_big`, `(120,144,156)`, centred at y=250
4. user field `Rect(450,410,400,50)`, fill `(220,220,220)` radius 10; focus outline
   `(150,150,150)` width 2; placeholder "Tên đăng nhập" `(170,170,170)` / value
   `(80,80,80)` at `+15,+10`
5. pass field `Rect(450,490,400,50)`, same; placeholder "Password"; value `*` per char
6. login button `(450,580,400,60)` `"🔑 Đăng Nhập"` `(165,214,167)`
7. register button `(450,660,400,60)` `"📝 Đăng Ký Mới"` `(158,198,229)`
8. error text, SysFont segoe ui 22 **italic** `(200,0,0)`, centred at `(650,750)`
9. After **15 s idle** -> `IdleGifState` (252)

### D2. MenuState background — `main.py:732-750`
1. `s.fill((25,35,65))`
2. `draw_gradient((25,35,65) -> (95,155,220))`  ← **a real gradient**
3. `background_img` scaled 1300x800 at **alpha 60**
4. `MathParticleSystem(35)`
5. `FallingCloverEffect(20)`
6. `RealisticBook(50,50,1200,700).draw(s, draw_left, draw_right)`
7. `daily_popup`, then `exam_msg` at y=725

**Right page** (620-661): heading `"Chọn chế độ chơi:"` `load_font(18)` `(80,80,80)` at
`rect.x+50, 130`; all `CardButton`s; user chip `Rect(1050,20,230,45)` fill `(200,220,240)`
radius 8 + WHITE 2 px outline, `👤` icon (font 20) + uppercase username (18) in BLACK;
ADMIN `Button(1080,20,120,40)` only for `ADMIN_USER`.

**Left page** (507-619): greeting by hour — `"Chào buổi sáng,"/ "chiều,"/ "tối,"` in
`(80,80,80)` at `rect.x+40, rect.y+35`; username `font_big` `(40,40,40)` at `+40,+70`;
`badge_y = rect.y+130`: Level badge `(230,245,230)`/`(45,120,45)`, grade badge
`(230,235,250)`/`(45,80,160)`; EXP bar `(rect.width-80, 22)` label "EXP"; gold badge
`(255,247,215)`/`(180,140,30)` font 15; difficulty + streak pills; 2-column pet /
achievement preview; character 210x210 idle-bob; `draw_daily_tasks_panel(rect.x+24,
rect.bottom-215, rect.width-48)`.

**Card grid** — exact geometry, all from `main.py:427-464`:

| Row | y | x | w | h | label | bg |
|---|---:|---:|---:|---:|---|---|
| 1 | 155 | 680 | 240 | 90 | `🎓 Bài Học` | `BLUE_BTN` |
| 1 | 155 | 945 | 240 | 90 | `⏱️ Time Attack` | `ORANGE_BTN` |
| 2 | 265 | 680 | 240 | 90 | `🔥 Thử Thách` | `YELLOW_BTN` |
| 2 | 265 | 945 | 240 | 90 | `📝 Thi Chuyển Lớp` | (180,130,200) |
| 3 | 375 | 680 | 140 | 65 | `🏆 Thành Tích` | `GREEN_BTN` |
| 3 | 375 | 835 | 140 | 65 | `👤 Hồ Sơ` | `PURPLE_BTN` |
| 3 | 375 | 990 | 140 | 65 | `⚙️ Cài Đặt` | `SHADOW` |
| 4 | 460 | 630 | 110 | 55 | `🚪 Thoát` | `RED_BTN` |
| 4 | 460 | 750 | 110 | 55 | `🛒 Shop` | `GREEN_BTN` |
| 4 | 460 | 870 | 110 | 55 | `🌳 K.Năng` | `PURPLE_BTN` |
| 4 | 460 | 990 | 140 | 55 | `🏪 Đổi Thẻ` | (130,80,220) |
| 4 | 460 | 1140 | 110 | 55 | `🎒 Túi Đồ` | (80,140,200) |

Grades 1-2 (`is_young_learner`, `game_init.py:145`) additionally dim SkillTree + CardShop
with a `(20,20,30,150)` overlay and a centred `🔒` (`main.py:632-642`).

### D3. LessonSelectState — `main.py:968-976`
1. `s.fill((165,214,167))`  ← light green, **no gradient, no background image**
2. `FallingCloverEffect(15)`
3. `RealisticBook(50,50,1200,700)`; left page = lessons 0-3, right page = lessons 4-7
4. Title `f"KHỐI LỚP {grade}"` `font_big` BLACK centred at y=80
5. back `(80,650,150,50)` `"⬅️ QUAY LẠI"` `RED_BTN`; prev `(720,650,150,50)` `BLUE_BTN`
   (only if page>0); next `(1030,650,150,50)` `BLUE_BTN` (only if not last)

Lesson tiles (`main.py:944-953`): `8 per page`; `x = 100 if i<4 else 720`,
`y = 150 + (i%4)*110`, `480x80`; bg = `(PURPLE_BTN if i%2==0 else ORANGE_BTN)` when
unlocked, else `SHADOW`; label truncated at 32 chars -> `"..."`; prefix `"🔒 "` when
locked, `"💔 "` when the lesson is flagged for review.

### D4. TheoryState — `main.py:997-1004`
`fill((165,214,167))` -> clover(15) -> book with **empty** page callbacks ->
title `draw_multiline_text(70,80,540,100)` -> body `draw_multiline_theory(80,180,520,480)`
colour `(50,50,50)` -> `character_img` smoothscale 200x200 at `(860,80)` ->
`BẮT ĐẦU HỌC` `(810,300,300,70)` `GREEN_BTN`, `Mở SGK` `(810,400,300,70)` `BLUE_BTN`,
`QUAY LẠI` `(810,500,300,70)` `RED_BTN`.

### D5. LessonState — `main.py:1628-1741`
1. `FallingCloverEffect(15)` on `s`
2. temp surface: `background_img` at `(0,0)`; **fallback `fill((30,40,60))` only if the
   image is missing**
3. `draw_top_bar(temp)` — 70 px
4. `"MathDrill 5.0"` `font_big` BLACK centred y=40
5. progress bar `(400,150,500,24)` label `f"Câu {cc+1}/{tc}"` — **tc = 15**
6. energy bar `(450,185,400,16)`, bg `(50,50,70)` radius 8, fill `(80,180,230)` or
   `(200,80,80)` in Fever, label `⚡ {n}%`
7. question card `800x200` at `y=200`, shadow `(0,0,0,60)` offset `(+5,+8)` radius 30,
   body `WHITE` radius 30, border `(80,150,255)` **width 5** radius 30; elastic scale-in
8. difficulty label at `(370,390)`, `"Điểm bài tập: {sc}"` `(255,225,100)` at `(750,390)`
9. answer buttons (below)
10. back `(20,720,200,60)` `"⬅️ QUAY LẠI"` `RED_BTN`; optional TTS speaker
11. `answer_effects`, `confetti_sys`
12. combo: font `28 + min(streak//3,12)`, centred `(650, 450+pulse)`, 4-corner glow when
    streak >= 5
13. feedback overlay last
14. `s.blit(temp, shake_offset)`

**Answer grid** (`main.py:1484-1488`) — 2x2, **size depends on grade**:

| Grades | w | h | gapX | gapY | x | y |
|---|---:|---:|---:|---:|---|---:|
| 1-2 (`is_young_learner`) | 260 | 110 | 280 | 130 | `650-gapX/2-w/2+(i%2)*gapX` | `440+(i//2)*gapY` |
| 3-5 | 220 | 90 | 240 | 110 | same | same |

Resolved for grades 3-5: i0 `(420,440)`, i1 `(660,440)`, i2 `(420,550)`, i3 `(660,550)`.
All answer buttons are `PURPLE_BTN`. Victory at `accuracy >= 60`, else Defeat (1493-1504).

### D6. VictoryState — `main.py:1171-1219`
`fill((30,80,40))` -> `draw_gradient((30,80,40) -> (80,180,100))` -> clover(15) ->
fireworks (spawn every 0.5-1.5 s) -> `victory_text.png` at scale 2.0 (1.0 shrink-in),
alpha 0->255, centred `(650, 220)` -> panel `600x350` at `(350,320)` `WHITE` alpha 230
radius 30 + border `(200,170,80)` width **5** radius 30 -> rank letter font **100** at
`(panel.right-120, panel.y+30)`, gold `(200,170,80)` if S else `(200,200,200)` ->
title/score centred at `+50`/`+100` -> XP bar `(450,470,400,30)` -> gold text
`(180,140,40)` at `+44` -> 3 stat lines at `+210 +i*35` -> `XEM LỖI` `(525,600,250,60)`
`ORANGE_BTN`, `TIẾP TỤC` `(525,680,250,60)` `GREEN_BTN`. UI appears at `t > 0.5 s`.
Rank: S>=100, A>=90, B>=80, else C.

### D7. DefeatState — `main.py:1044-1080`
`fill((30,35,55))` -> `defeat.png` zoomed -> overlay `(20,25,45,110)` -> clover(15) ->

## E. Web vs Desktop gap matrix

Classification: `EXACT_MATCH` · `MINOR_DIFFERENCE` · `FUNCTIONAL_ADDITION` ·
`VISUAL_DEVIATION` · `MISSING` · `UNKNOWN`.

| # | Element | Desktop | Web | Class |
|---|---|---|---|---|
| 1 | Screen size | 1300x800 | 1300x800 logical | EXACT_MATCH |
| 2 | `RealisticBook` geometry/colours | §D8 | cover `(80,50,20)`, spine `(150,150,150)`, page `(253,246,227)` sampled live at `[70,130,180]`/`[150,150,150]`/`[253,246,227]` | EXACT_MATCH |
| 3 | `BUTTON_RADIUS` | 12 | 12 | EXACT_MATCH |
| 4 | GREEN/PURPLE/ORANGE/YELLOW/RED/SHADOW | §B | all six byte-identical | EXACT_MATCH |
| 5 | **`BLUE_BTN`** | **`(0,188,212)`** | **`(70,130,180)`** | **VISUAL_DEVIATION** |
| 6 | Menu card grid coords | 12 cards §D2 | same x/y/w/h | EXACT_MATCH |
| 7 | Menu background gradient | `(25,35,65)->(95,155,220)` | flat fill, no gradient | VISUAL_DEVIATION |
| 8 | Menu `background_img` alpha 60 | yes | not drawn on menu | MISSING |
| 9 | `MathParticleSystem(35)` | yes | not verified in web | UNKNOWN |
| 10 | Menu user chip `(1050,20,230,45)` | yes | not found in web | MISSING |
| 11 | Menu ADMIN button `(1080,20,120,40)` | yes | web has an Admin card in the grid instead | MINOR_DIFFERENCE |
| 12 | Menu Pet + Skin cards | **no such buttons** | present at `card_y5` | FUNCTIONAL_ADDITION |
| 13 | LessonSelect bg `(165,214,167)` | yes | yes | EXACT_MATCH |
| 14 | LessonSelect title `KHỐI LỚP n` y=80 | yes | yes | EXACT_MATCH |
| 15 | Lesson tiles 480x80 @ (100\|720, 150+i*110) | yes | same | EXACT_MATCH |
| 16 | Lesson locked prefix `🔒` | yes | yes | EXACT_MATCH |
| 17 | Lesson review prefix `💔` | yes | web uses a different weak-topic affordance | MINOR_DIFFERENCE |
| 18 | Theory bg + buttons `(810,300/400/500)` | yes | yes | EXACT_MATCH |
| 19 | Theory character 200x200 @ (860,80) | yes | yes | EXACT_MATCH |
| 20 | **Lesson background image** | `background_img` at (0,0) | flat `#1e2840` | **VISUAL_DEVIATION** |
| 21 | Lesson answer grid (grades 3-5) | 220x90 gap 240/110 @ y440 | identical (`states_real.js:1341-1353`) | EXACT_MATCH |
| 22 | **Answer grid grades 1-2** | 260x110 gap 280/130 | fixed 220x90 | **MISSING** |
| 23 | Lesson `draw_top_bar` (70 px) | yes | not verified | UNKNOWN |
| 24 | `"MathDrill 5.0"` title y=40 | yes | not verified | UNKNOWN |
| 25 | Energy bar `(450,185,400,16)` | yes | not verified | UNKNOWN |
| 26 | Question card 800x200, border `(80,150,255)` w5 r30, shadow | yes | white card present; border/shadow not confirmed | UNKNOWN |
| 27 | `"Điểm bài tập: n"` at (750,390) | yes | web shows score in a different position | VISUAL_DEVIATION |
| 28 | Combo glow + pulse at (650,450) | yes | not verified | UNKNOWN |
| 29 | **Victory `victory_text.png` art** | scale 2.0, centred (650,220) | asset downloaded, **never drawn by any state** | **MISSING** |
| 30 | **Defeat `defeat.png` zoom bg + overlay** | yes | asset downloaded, **never drawn** | **MISSING** |
| 31 | Victory green gradient `(30,80,40)->(80,180,100)` | yes | not confirmed | UNKNOWN |
| 32 | Victory rank letter S/A/B/C font 100 | yes | not confirmed | UNKNOWN |
| 33 | Defeat warm panel `(45,48,68,210)` r30 + `(255,180,90)` w4 | yes | not confirmed | UNKNOWN |
| 34 | Loading gradient `(20,30,55)->(70,120,190)` | yes | web uses flat `#141e37` | VISUAL_DEVIATION |
| 35 | Loading bar geometry 520x28 r14 | yes | identical | EXACT_MATCH |
| 36 | Loading percentage text | `int(progress*100)%` | now real asset count (M17) | FUNCTIONAL_ADDITION |
| 37 | Login bg opaque `background_img` | yes | web draws `nen_game` | MINOR_DIFFERENCE |
| 38 | Login title `MATHDRILL LOGIN` y=250 `(120,144,156)` | yes | yes | EXACT_MATCH |
| 39 | Login field/button rects | 410/490/580/660 | identical (`states_real.js:576`, register 421) | EXACT_MATCH |
| 40 | Login error text italic 22 at (650,750) | yes | not confirmed | UNKNOWN |
| 41 | IdleGif after 15 s | yes | absent | MISSING (low value) |
| 42 | Mobile numeric keypad | absent | M15-E2, touch-only | FUNCTIONAL_ADDITION |
| 43 | Keyboard digit answering | absent | M15-D2 | FUNCTIONAL_ADDITION |
| 44 | `Da mo x/81 bai` progression header | absent | M15-C2 | FUNCTIONAL_ADDITION |
| 45 | `🔒 Lv469` required-level label | absent | M14-D2 | FUNCTIONAL_ADDITION |
| 46 | Weak-topic review screen | ReviewState exists but via "XEM LỖI" only | M15-B3 weak-topic surfacing | FUNCTIONAL_ADDITION |
| 47 | M16 `theme.js` design system | absent | deleted in M16.1 | CORRECT (removed) |
| 48 | M16 loading "plate"/gradient | n/a | removed in M16.1 | CORRECT (removed) |

## F. Recommended restoration changes (ordered)

1. **Restore `BLUE_BTN` to `[0, 188, 212]`** in `web/js/states_real.js` and revert
   `web/tests/ui_parity.test.js` T19 to assert `const BLUE_BTN   = [0, 188, 212]`.
   Source: `game_init.py:1973` + `:1986`. *(Fixes item 5.)*
2. **Draw `victory_text.png` and `defeat.png`.** Both are already downloaded by the M17
   loader, so this costs no extra bytes. Victory: `scale 2.0` shrinking to 1.0, alpha
   0->255, centred `(650, 220)`, above the panel. Defeat: full-screen smoothscale zoom
   `bg_scale += 0.05/s` + `(20,25,45,110)` overlay, behind the panel. *(Items 29, 30.)*
3. **Restore the Menu gradient** `(25,35,65) -> (95,155,220)` and the `background_img` at
   alpha 60 beneath the book. *(Items 7, 8.)*
4. **Use the real `background_img` on LessonState** instead of the `#1e2840` fallback
   fill — that fill is Desktop's *no-image* fallback (`main.py:1634`), not the normal look.
   *(Item 20.)*
5. **Implement the grade 1-2 answer-button variant** `260x110` gap `280/130`
   (`is_young_learner`), which is a deliberate cognitive-load accommodation, not styling.
   *(Item 22.)*
6. **Restore the Loading gradient** `(20,30,55) -> (70,120,190)`. *(Item 34.)*
7. **Verify/implement the remaining `UNKNOWN` rows** (23-28, 31-33, 40) before changing
   them: `draw_top_bar`, the "MathDrill 5.0" title, the energy bar, the question-card
   border/shadow, the combo glow, the Victory rank letter and the Defeat warm panel.
   These are *not* claimed as defects — they are simply not yet confirmed either way.
8. **Add the Menu user chip** `(1050,20,230,45)` and reconcile the Admin affordance.
   *(Items 10, 11.)*

## G. Must NOT be changed

- Question generation, scoring, combo, XP/gold, the unlock formula `(level-1)//6+1`.
- Auth/session semantics, backend, Desktop Python, existing tests, C1.
- `RealisticBook` geometry and palette (already exact).
- Grade 3-5 answer-grid geometry (already exact).
- The lesson-select green background and title (already exact).
- The M16.1 removal of `theme.js` and the loading plate — those were correct restorations.

## H. M15 functional features that can remain

These have no Desktop visual equivalent but are behaviour, not decoration, and can stay as
long as they are styled with the original palette/geometry:

- M15-D2 keyboard digit answering; M15-E2 touch keypad.
- M15-C2 `Da mo x/81 bai | Bai 2 mo o Lv7` progression header.
- M14-D2 `🔒 Lv469` required-level label (consistent with Desktop's own `🔒` locked prefix).
- M15-B3 weak-topic surfacing on the Review screen.
- M15-B1/B2 Review + Practice states (Desktop has `ReviewState` 1324 and `PracticeState` 1220).

## I. M16 / M16.1 elements

- **Remove (already done, keep removed):** `web/js/theme.js`; the navy gradient / glow
  "depth lip" button treatment; the loading plate; the generic dashboard framing.
- **Retain from M16.1:** the revert of `states_real.js` / `settings_states.js` / `index.html`
  toward the M15 originals; the M16.1 loading hint line (plain text, no new element).
- **Net:** M16.1 was directionally right but shipped one regression (item 5) because it
  trusted a stale source comment instead of the binding.

## J. Verification checklist

- [ ] Re-run `ui_parity` T19 against `(0,188,212)`; confirm the token and the assertion agree.
- [ ] Screenshot-diff Menu card 1 fill against `(0,188,212)`.
- [ ] Confirm `victory_text.png` is drawn on Victory (canvas pixel probe, not a load check).
- [ ] Confirm `defeat.png` is drawn on Defeat.
- [ ] Confirm Menu shows a vertical gradient (sample top vs bottom of the margin).
- [ ] Confirm LessonState draws `background_img`, not the fallback fill.
- [ ] Confirm grade 1-2 answer buttons are 260x110.
- [ ] Confirm Loading shows a gradient.
- [ ] Full web regression + server regression; `PY_DIFF = 0`.
- [ ] Real Chromium on desktop **and** mobile viewports; 0 console/page/request errors.

---

## Explicit uncertainty

- Rows marked `UNKNOWN` were **not** verified in the web build in this pass. They are not
  defects and must not be "fixed" without first confirming the current web behaviour.
- Menu `MathParticleSystem(35)` equivalence in the web is unverified.
- `draw_top_bar` presence in the web was not confirmed either way.
- Screens not read line-by-line in this pass: `RegisterState` (366), `SettingsState` (751),
  `PasswordChangeState` (874), `PracticeState` (1220), `ReviewState` (1324),
  `TimeAttackState` (1745), `AchievementViewState` (1927), `DailyState` (2002),
  `ProfileState` (2130), `SkillMapState` (2191), `ShopState` (2273), `SkillTreeState` (2477),
  `BagState` (2670), `CardShopState` (2947), the exam states, and `IdleGifState`.
  Their **positions in the class list** are recorded in §A, but their draw internals are
  **not** specified here and must be read before any change is made to them.
- I did not run the Desktop game, so every claim here is derived from source, not from
  runtime observation. The one runtime cross-check available was the live-web pixel probe
  recorded in the M16.1 gate.


### The single highest-confidence defect

**Item 5.** The web primary button is `(70,130,180)`. The Desktop primary button is
`(0,188,212)`. This is not a judgement call — `game_init.py:1986` assigns
`BLUE_BTN = COLORS['primary']` and `game_init.py:1973` defines
`COLORS['primary'] = (0, 188, 212)`. The inline comment `# (70, 130, 180)` is stale.

The web value was introduced by M16.1 on the strength of that comment, and the original
`ui_parity` T19 assertion (`const BLUE_BTN   = [0, 188, 212]`) was **correct all along**;
it was changed in M17. Both need to be reverted. This affects the "Bài Học" menu card, the
LessonSelect prev/next buttons, the Theory "Mở SGK" button, and the Settings brightness
button — i.e. a large share of the primary-coloured UI.

panel `600x400` at `(350,250)` `(45,48,68,210)` radius 30 + border `(255,180,90)` width
**4** radius 30 -> title `(255,200,110)` -> `Đúng: c/t câu (acc%)` -> encouragement
`(210,210,220)` -> 2 stat lines at `+230 +i*40` -> `XEM LỖI` `(525,600,250,60)`
`PURPLE_BTN`, `LÀM LẠI` `(390,680,250,60)` `ORANGE_BTN`, `VỀ MENU` `(660,680,250,60)`
`RED_BTN`. Deliberately **encouraging, not punitive** (class docstring 1007-1011).

### D8. RealisticBook — `game_init.py:4345-4375`
Given `(x,y,w,h)` = `(50,50,1200,700)`, `page_w = (w-40)//2 = 580`:

| Element | Rect | Colour | Radius |
|---|---|---|---|
| outer cover | `(38,40,1224,720)` | `(80,50,20)` | 15 |
| inner cover | `(42,42,1216,716)` | `(101,67,33)` | 12 |
| spine | `(630,60,40,680)` | `(150,150,150)` | 5 |
| left page | `(50,50,580,700)` | `(253,246,227)` | TL/BL 10 |
| right page | `(670,50,580,700)` | `(253,246,227)` | TR/BR 10 |

Page-flip: `flip_progress += dt*3.0` (~0.33 s); old page scales 1.0->0.7 toward the spine,
new page 0.7->1.0, with an 8->12 px shadow strip fading alpha 100->0.


| `pixel_clover` | 33,189 | web `assets/` + Desktop | `FallingCloverEffect` | falling overlay |
| `Quicksand-Bold.ttf` | 78,592 | `gi:2196` | all text | UI typeface |
| `Segoe UI Emoji.TTF` | 2,072,388 | `gi:2151` | all emoji | emoji only |

`web/assets/setting.png` and `web/assets/Untitled_design.png` are present but are **not
referenced by either renderer** — they are not part of the original UI.

  is an auto-width pill (`radius = h//2`). `draw_progress_bar` (2895).
- **Text:** `get_font`/`load_font` (`game_init.py:2187/2218`) load **`Quicksand-Bold.ttf`**
  and bucket a raw px size: `<=18 -> 'normal' (14)`, `<=24 -> 'button' (18)`,
  `<=32 -> 'subtitle' (24)`, `else -> 'title' (54)` (`FONT_SIZES` ends 1970).
  Emoji render separately via `load_icon_font` (2146) using **`Segoe UI Emoji.TTF`** and
  `render_text_mixed` (2161), which splits a string into emoji/text runs with a 2 px gap.
- **Assets:** `game_init.py:290-293` binds `background_img = backround1.jpg` and
  `DEFAULT_CHARACTER_IMG/character_img = main_character.png`. `background_img` is re-bound
  to `None` at 1886 and repopulated during `init_display`; `character_img` is replaced by a
  per-user avatar (`game_init.py:1948`) falling back to the default at 1952.
