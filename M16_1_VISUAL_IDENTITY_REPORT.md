# MathDrill M16.1 — VISUAL IDENTITY RESTORATION REPORT

**Commit:** `ee4245e278be988dc9fc91974827e747a317d862`
**Visual files reverted to:** `c62031a` (M15)
**Python Desktop source:** UNCHANGED — 36 files, `PY_DIFF=0`
**Not deployed** — production still serves the M16 build `08882f8`.

---

## 1. What was wrong, and the root cause

M16 replaced the game's look with a generic modern-web language. Inspecting
the Desktop source showed **nothing in M16 existed in the original game**.

`game_init.py` binds the button palette **twice**:

```text
game_init.py:308-310   muted pastels   BLUE_BTN=(110,150,190)  GREEN_BTN=(120,180,140)
game_init.py:1985-1991 COLORS set      BLUE_BTN=( 70,130,180)  GREEN_BTN=( 76,175,80)
```

`main.py` imports those names, so the **later** binding is what the running
game actually uses:

```text
WHITE      = (220, 220, 215)     PURPLE_BTN = (138, 43, 176)
BLUE_BTN   = ( 70, 130, 180)     ORANGE_BTN = (255, 152,   0)
GREEN_BTN  = ( 76, 175,  80)     YELLOW_BTN = (255, 215,   0)
RED_BTN    = (244,  67,  54)     SHADOW     = (100, 100, 100)
BUTTON_RADIUS = 12   CARD_RADIUS = 20
```

M16 used none of this: dark navy gradients, a cyan accent, 3-D "depth lips"
and outer glows. It also painted over the original art (`victory_text.png`,
`defeat.png`, `backround1.jpg`) with gradients.

---

## 2. Screens restored

| Screen | Original identity restored | Removed from M16 |
|---|---|---|
| **Loading** | `nen_game.png` art, flat `#141e37`, thin bar, tip | Logo plate card, tagline, gradient stage |
| **Login** | Pale background, flat fields/buttons | Gradient wash, raised white card |
| **Menu** | **Cream `RealisticBook(50,50,1200,700)`** (main.py:416), dark wash inside its pages, flat mode cards | Navy gradient, two glowing "dashboard" cards |
| **Lesson Select** | Flat green board `#a5d6a7` | Vignette, themed title plate |
| **Theory** | Book pages, flat buttons | Restyled buttons |
| **Lesson** | Flat `#1e2840`, white question card, purple 2×2 answer grid | Gradient stage, framed header, stat chips, elevated hero card |
| **Feedback** | Dark box, 1px coloured border | 680×150 glowing banner, 66px glyph, gold chips |
| **Victory** | Green field + **`victory_text.png`** art + white panel | Green gradient, raised card |
| **Defeat** | **`defeat.png`** art | Indigo gradient |
| **Review** | Flat `#f5f5fa` | Gradient, raised report card |
| **Settings / Password** | Flat | Restyled buttons |

---

## 3. Files changed

| File | Change |
|---|---|
| `web/js/states_real.js` | reverted to M15 + `BLUE_BTN` fix + loading text |
| `web/js/settings_states.js` | reverted to M15 |
| `web/index.html` | reverted to M15 (no `theme.js`) |
| `web/js/theme.js` | **deleted** (271 lines of foreign styling) |
| `M16_1_ORIGINAL_IDENTITY_GAP_REPORT.md` | new — required gap analysis |
| `M16_1_VISUAL_IDENTITY_REPORT.md` | new — this file |

---

## 4. M16 elements removed vs retained

**Removed:** gradient backdrops, glowing dashboard cards, framed header, stat
chips, elevated question card, glowing feedback banner, victory/defeat
gradients, review card, lesson-select vignette + plate, login card, and the
entire `theme.js` design system.

**Retained (all from M15, untouched):** keyboard answering (1–4), touch
keypad, weak-topic review, progression-to-unlock header, deeper theory,
honest locked-card wording, deploy tooling, six mutation-verified guards.

**Retained from M16 — one item:** a plain reassurance line on the loading
screen. Production cold boot measures 40–63 s and a silent wait reads as a
hang. Plain text on the original art — no plate, no gradient, no new element.

---

## 5. A real pre-existing identity defect found and fixed

The audit found one genuine drift that predated M16:

```text
Desktop  game_init.py:1986   BLUE_BTN = (70, 130, 180)   dusty blue
Web      (before this fix)    BLUE_BTN = [0, 188, 212]    bright cyan
```

Every other web colour already matched Desktop exactly. The cyan buttons are
part of why the game read as a modern web app. Corrected to `(70,130,180)`.

---

## 6. Verification

| Gate | Result |
|---|---|
| Web regression | **49 suites, 676 pass, 0 fail, 15 skip, 0 harness errors** |
| Server regression | **11 suites, 136 pass, 0 fail** |
| Chromium identity gate | **14/14 PASS** |
| Original art loaded | `nen_game` ✓ `victory_text` ✓ `defeat` ✓ `main_character` ✓ `pixel_clover` ✓ |
| M16 design system | **confirmed absent** (`MathDrillTheme` undefined) |
| Gameplay | 9 questions, 6 correct / 3 wrong, 0 failures |
| Mobile | keypad 4 keys, answers correctly |
| Console errors | **0** |
| Page errors | **0** |
| Request failures | **0** |
| Python | **36 files, `PY_DIFF=0`** |

### Evidence — 11 screenshots in `E:\m13_temp\m161_shots`

```text
01_menu.png            02_lesson_select.png   03_theory.png
04_lesson.png          05_victory.png         06_defeat.png
07_review.png          08_login.png           09_settings.png
10_feedback_correct.png                        11_feedback_wrong.png
```

**Visual confirmation.** The menu shows the original layout: `MATHDRILL`
wordmark, clover, greeting, Level/Lớp badges, EXP bar, Vàng, the daily-task
panel, and the "Chọn chế độ chơi" card grid in the Desktop palette. The lesson
screen shows the flat `#1e2840` stage, `Câu 1/15` progress, the white question
card, and the purple 2×2 answer grid. Both are recognisably the same game as
the Desktop original.

*(Victory shows only the trophy headline because `showUi` is false until the
original intro animation finishes — original behaviour, not a regression.)*

---

## 7. Deployment status

**Not deployed.** Production still serves the M16 build `08882f8`. Deploy
`ee4245e278be988dc9fc91974827e747a317d862` for the original identity to go
live:

```text
Render dashboard -> math-drill-iwys -> Manual Deploy for
ee4245e278be988dc9fc91974827e747a317d862
```

Rollback point until then: `c62031a` (M15) remains in history.

