# ORIGINAL_UI_RESTORATION_REPORT

Commit: `1fa2feb622f04b9c98fed94aa00ef90be1abb4d3`
Rollback point: `59ed808ee1e84ebf9d8ad2f2a03099682abd3a69` (M16.1, production-verified)
Python diff: **0** (36 files byte-identical)

## Status: ORIGINAL_UI_RESTORATION_PARTIAL_WITH_DOCUMENTED_GAPS

The 7 confirmed differences listed in the audit are implemented and pixel-verified.
The 12 rows previously classified **UNKNOWN** were not touched — per instruction they
were not converted to "fixed" by guessing. See "Remaining gaps".

## Source findings

`game_init.py` binds the palette **twice**; the later binding is the live one:

| Line | Binding | Live? |
|---|---|---|
| `game_init.py:309` | `BLUE_BTN=(110,150,190)` pastel | no — dead |
| `game_init.py:1973` | `'primary': (0,188,212)` | yes |
| `game_init.py:1986` | `BLUE_BTN = COLORS['primary']  # (70,130,180)` | yes — **comment is stale** |

## Corrections to the previous milestone

1. **BLUE_BTN** — M16.1 set the web token to `(70,130,180)`, read from the *stale
   comment* on line 1986. The running binding is `COLORS['primary'] = (0,188,212)`.
   Restored to `(0,188,212)`, and the original T19 assertion restored to enforce it.
2. **Victory background** — web was `rgb(30,80,48)`; Desktop `main.py:1173` is
   `s.fill((30,80,40))`.
3. **Loading overlay** — web alpha was `0.35`; Desktop `main.py:165` uses `alpha=45`.

## Restorations implemented

| Screen | Desktop source | Change |
|---|---|---|
| Renderer | `game_init.py:3528` `draw_gradient` | New `Renderer.gradient()` — canvas linear gradient, degrades to flat fill when `createLinearGradient` is absent |
| Menu | `main.py:732-739` | gradient `(25,35,65)→(95,155,220)` + `nen_game` at alpha 60 |
| Loading | `main.py:160-166` | gradient `(20,30,55)→(70,120,190)` + `nen_game` at alpha 45 |
| Lesson | `main.py:1634` | draws `background_img`; `#1e2840` kept only as the no-image fallback |
| Victory | `main.py:1080-1084, 1173-1175, 1180-1184` | gradient `(30,80,40)→(80,180,100)`; `victory_text.png` scaled 2.0→1.0 @4/s, alpha 0→255 @200/s, centred `(650,220)` |
| Defeat | `main.py:1046-1055` | `defeat.png` zoomed about centre under translucent `(20,25,45,110)`; previously a flat fill hid the art |
| Lesson grid | `main.py:1484-1488`, `game_init.py:145` | grades 1-2 → `260x110` gap `280x130`; grades 3-5 keep `220x90` gap `240x110` |

## Defect found and fixed by this change

The M15 touch keypad was positioned at a fixed `y=660`. With the taller grade 1-2
grid the answers end at **680**, so the keypad would have overlapped the answer row
on phones. Fixed by deriving the keypad Y from the live grid, and by re-running
`_initKeypad()` whenever buttons are rebuilt — it previously ran only in the
constructor, against an empty grid. Mutation-verified: reintroducing `const y=660`
fails E2-T02 (`answers end 680, keypad starts 660`).

## Pixel evidence (real Chromium, 1300x800)

| Check | Evidence |
|---|---|
| menu gradient | top `[39,75,95]` → bottom `[82,151,193]` (bottom bluer) |
| victory gradient | top `[83,116,70]` → bottom `[80,180,100]` (bottom greener) |
| `victory_text.png` blitted | 6064 cream px in the y60–300 band above the panel |
| `defeat.png` visible | 18 distinct edge colours (not a flat fill) |
| lesson `background_img` | 4 distinct colours in the stage region |
| grade 1-2 grid | `w=260 h=110 gapX=280 gapY=130` |
| grade 3-5 grid | `w=220 h=90 gapX=240 gapY=110` |
| `Digit3` → index 2 | M15-D2 keyboard mapping intact |
| mobile keypad | answers end 680, keypad starts 700 |

`M18_RESTORE_GATE: pass=10 fail=0` · console 0 · page 0 · request 0

## Tests

- Web regression: **49 suites, 676 pass, 0 fail, 15 skip, 0 harness errors**
- Server: **11 suites, all exit 0**
- Harness fixes (no assertion weakened): `polish_m3`/`polish_m4`/`ui_parity_p1` mock
  renderers lacked `gradient()`; `m15_mobile_touch` fixture now mirrors production
  build order; `ui_parity` T08 and `ui_parity_p1` T10 updated to Desktop source values.

## Preserved

Question generation, scoring, combo, XP/gold, `(level-1)//6+1` unlock, auth/session,
backend, M15 keyboard answering, touch keypad, weak-topic review, progression header,
theory improvements, all M15 guards. Desktop Python untouched.

## Remaining gaps (documented, not fixed)

- **12 UNKNOWN rows** from the audit remain UNKNOWN — no source evidence gathered
  that would justify changing them.
- **RegisterState, PracticeState, TimeAttackState, ShopState, SkillTreeState and the
  exam states** still have incomplete per-screen rendering specifications; their
  draw internals were not read in full in this pass.
- The `victory_text.png` scale/alpha animation is driven from `this.timer` (the web's
  equivalent of Desktop's `self.timer`) rather than a per-frame delta; behaviour is
  equivalent but not frame-rate independent if `timer` is not incremented elsewhere.

## Git

```
1fa2feb  M18 original UI restoration
59ed808  M16.1 (production-verified rollback point)
HEAD = origin = render = 1fa2feb622f04b9c98fed94aa00ef90be1abb4d3
WORKTREE = CLEAN
DEPLOYED = NO (production still serves 59ed808)
```
