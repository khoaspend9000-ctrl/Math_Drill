# MathDrill M16.1 — ORIGINAL IDENTITY GAP REPORT

Written **before** any restoration code, from direct inspection of the
Desktop/Pygame source of truth (`E:\lam_game_2026`) and the three web states.

---

## 1. The Desktop original (visual authority)

### Palette — `game_init.py:1980-1991`
`main.py` imports `BLUE_BTN, GREEN_BTN, PURPLE_BTN, ORANGE_BTN, YELLOW_BTN,
RED_BTN, SHADOW, WHITE` from `game_init`. Those names are bound twice: first at
`game_init.py:308-310` (muted pastels) and then **rebound at 1985-1991** from
the `COLORS` dict. The later binding is the one the running game uses.

```text
WHITE      = (220, 220, 215)   warm off-white   (game_init.py:308, not rebound)
BLUE_BTN   = (70, 130, 180)    dusty blue
GREEN_BTN  = (76, 175, 80)
PURPLE_BTN = (138, 43, 176)
ORANGE_BTN = (255, 152, 0)
YELLOW_BTN = (255, 215, 0)
RED_BTN    = (244, 67, 54)
SHADOW     = (100, 100, 100)
COLORS['background'] = (13, 27, 42)   dark blue
COLORS['card']       = (23, 43, 77)   dark blue card
CARD_RADIUS = 20   BUTTON_RADIUS = 12   MARGIN = 20   PADDING = 12
```

### Composition
- **Menu = a cream book**, not a dashboard: `self.book = RealisticBook(50, 50,
  1200, 700)` (`main.py:416`, also 754, 876).
- **Background art**: `backround1.jpg` (`game_init.py:290`).
- **Victory art**: `victory_text.png` → `img_vic_text` (`game_init.py:295`).
- **Defeat art**: `defeat.jpg` → `defeat_bg_img` (`game_init.py:291`).
- **Character**: `main_character.png`; **clover**: `pixel_clover.png`;
  **icon**: `Untitled_design.png`; **settings**: `setting.png`.

**The web already ships every one of these original assets** in `web/assets/`.

---

## 2. The gap, screen by screen

| Screen | Original identity | What M16 replaced | Verdict |
|---|---|---|---|
| **Loading** | `nen_game.png` at 0.35 alpha, flat fill, thin bar, tip | Gradient stage + white "logo plate" card + new tagline | **Plate is foreign** |
| **Login** | Pale background, flat fields/buttons | Gradient wash **+ a raised white card** behind the form | **Card is foreign** |
| **Menu** | **Cream RealisticBook** with a dark wash inside its pages, flat panels | Navy gradient + two **glowing raised "dashboard" cards** | **Worst drift** |
| **Lesson Select** | Flat green board `#a5d6a7` | Same green **+ vignette + themed title plate** | Plate is foreign |
| **Theory** | Book pages, flat buttons | Book kept; buttons restyled | Minor |
| **Lesson** | Flat `#1e2840`, white question card | Navy gradient, framed header, **stat chips**, elevated hero card | Over-designed |
| **Feedback** | Dark box, 1px coloured border, small text | **Glowing 680×150 banner, 66px glyph, gold chips** | **Over-designed** |
| **Victory** | Green field + **`victory_text.png` art** + white panel | Green **gradient** + raised card, art de-emphasised | Lost art focus |
| **Defeat** | **`defeat.jpg` art** | Indigo **gradient** | **Lost the art** |
| **Review** | Flat `#f5f5fa` | Gradient + raised report card | Card is foreign |
| **Settings/Password** | Flat | Inherits restyled buttons | Minor |

### Root cause of the drift
`drawBtn()` was delegated to `theme.js`, which used a **dark navy palette with
cyan accents, 3-D "depth lips" and outer glows**. No element of that language
exists in the original game. The original buttons are **flat, muted and
radius-12**.

---

## 3. What M16 legitimately contributed (keep)

None of the M16 work was gameplay. All *functional* value already shipped in
**M15 (`c62031a`)**, which is therefore the correct restoration base:

- keyboard answering (1–4), M15-D2
- on-screen touch keypad, M15-E2
- weak-topic review, M15-B3
- progression-to-unlock header, M15-C2
- deeper theory text, M15-B4
- honest locked-card wording, M15-D1
- deploy tooling + all six mutation-verified guards

---

## 4. Restoration decision

**Revert the three visual files to M15 (`c62031a`) and remove the foreign
design system.** M15 is proven: 676 web + 136 server passing, 0 fail, and it
already contains every functional improvement.

Then re-apply, from M16, **only** the loading-screen reassurance *text* (no
plate, no gradient) because a 40–63 s production cold boot otherwise reads as
a hang, and it sits on the original art.

`theme.js` is deleted rather than re-skinned: with `drawBtn` already using
`BUTTON_RADIUS = 12` and colours that match the Desktop palette exactly, a
second styling layer would only be dead code that could drift again.

---

## 5. The acceptance test

A screenshot of the web game and a screenshot of the Desktop game must be
immediately recognisable as the **same game**: cream book menu, original
background art, flat muted buttons, original victory/defeat art, green lesson
board.
