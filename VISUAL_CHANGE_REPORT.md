# MathDrill — M16 VISUAL CHANGE REPORT

**Commit:** `01d8ac7451369a513431eb99bda86af423bb29ea`
**Baseline:** `c62031abf8f4cb679949ea6ea8e63af4bf7964db` (M15, production-verified)
**Python Desktop source:** UNCHANGED — 36 files, `PY_DIFF=0`

---

## The problem

Every screen hand-rolled flat rounded rectangles with a hard white border
(`drawBtn` in `states_real.js`) on solid background fills. Functionally the
game was strong, but the result read as a Pygame port rather than a product.

## Files changed

| File | Change |
|---|---|
| `web/js/theme.js` | **NEW** — the whole design system |
| `web/index.html` | loads `theme.js` after `renderer.js` |
| `web/js/states_real.js` | `drawBtn` delegates to theme; Loading, Login, Menu, Lesson, Feedback, Victory, Defeat, LessonSelect restyled |
| `web/js/settings_states.js` | Review screen restyled |

## The design system (`web/js/theme.js`)

- **Palette** — deeper than the old flat Material-500 set; one cyan accent
  (`#35c9e8`) for primary actions, plus success/danger/warn/violet/gold.
- **Type scale** — display 54 / h1 40 / h2 30 / h3 24 / body 20 / small 16 / tiny 14.
- **Radii** — 10 / 14 / 20 / 28, plus a pill radius for chips.
- **Primitives** — `backdrop`, `card`, `button`, `badge`, `bar`, `heading`,
  `body`, `divider`.
- **Robustness** — falls back to flat fills when the canvas gradient API is
  absent, so Node test harnesses still render every screen.

---

## Screen-by-screen: what is visibly different

### 1. Loading / boot
- Branded logo plate (raised card) with the wordmark in the accent colour
  and a "Luyện toán vui cho bé" tagline.
- Determinate themed progress bar with gloss instead of a thin plain bar.
- The tip is now separated by a divider and shown in gold.
- New reassurance line: **"Lần đầu tải có thể mất vài giây..."**, and
  "Sẵn sàng!" on completion.
- *Why:* production cold boot measures **40–63 s**. This is the screen a
  player stares at longest, and it previously read as a hang.

### 2. Login
- Pale themed stage (cyan + violet radial glows) instead of pure white.
- A raised white card behind the form gives a clear focal point.
- Title scaled to 44px in the primary colour with a soft shadow.

### 3. Main Menu
- Navy gradient stage with cyan and violet glows.
- Both dashboard panels are now **raised surfaces** (gradient face, shadow,
  accent-tinted stroke) instead of near-invisible `rgba(255,255,255,0.06)`.
- Wordmark in the accent colour with a glow.
- *Kept dark on purpose:* Desktop draws light text here, so contrast is preserved.

### 4. Lesson Select
- Desktop green board (`#a5d6a7`) kept **exactly** — it is Desktop identity.
- Added a soft vignette and a themed title plate so the board reads as a
  designed surface rather than a flat fill.
- Lesson tiles inherit the new button treatment automatically.

### 5. Theory
- Inherits the new button treatment; book chrome untouched for parity.

### 6. Lesson gameplay
- Gradient stage with primary/accent glows instead of flat `#1e2840`.
- Framed header card; title in the accent colour.
- Difficulty and score are now **chips** instead of loose grey text.
- Question card is an **elevated themed card** with an accent border and
  top highlight, instead of a flat white plate.

### 7–8. Correct / wrong feedback
- A wide **glowing banner** (680×150) tinted green or red, with a large ✓ / ✗
  glyph at 66px.
- Headline at 28px bold.
- **Wrong answer:** the correct answer is promoted to its own gold chip.
- **Correct answer:** a gold **COMBO xN** chip appears at combo ≥ 1.
- Both original message strings are preserved verbatim.

### 9. Victory
- Celebratory green stage (`#1d6b40` → `#123523`) with a golden glow.
- Result panel is a **raised card** with a gold stroke.
- Lesson title in the primary colour; wordmark in gold.

### 10. Defeat
- Deep indigo stage with a soft violet glow — a nudge, not a punishment.
- Result panel raised like Victory.

### 11. Review / weak-topic
- Calm light stage (violet + cyan glows).
- The analysis content sits on a **raised report card**.

### 12. Mobile gameplay
- Unchanged logic, but every control now picks up the new button treatment.
- The M15 touch keypad inherits the same depth/glow language.

---

## Defects found and fixed during the overhaul

1. **Three screens erased the new gradient.** Menu, Victory and Defeat each
   painted an *opaque* full-screen fill (Desktop parity) **after** the
   backdrop. Demoted to a subtle tint when the theme is active.
2. **`theme.js` threw on the Node test harness**, which stubs
   `renderer.ctx` without `createLinearGradient`. It now falls back to flat
   fills — the harness caught this immediately (m4_states 15 → 5 failures).
3. **`ReviewState.draw` lost its renderer binding** during editing
   (`R is not defined`). Caught by `m15_review_practice` (16/18) and fixed.

## Verification

| Gate | Result |
|---|---|
| Web regression | **49 suites, 676 pass, 0 fail, 15 skip, 0 harness errors** |
| Server regression | **11 suites, 136 pass, 0 fail** |
| Chromium screen gate | **13/13 screens draw**, 0 console errors, 0 page errors, 0 request failures, 0 unexpected 4xx/5xx |
| Mobile gate | **5/5 viewports** — phone portrait/landscape, tablet, 1024×640, 1920×1080 |
| Pixel proof | lesson stage samples `[20,29,60] → [23,38,76] → [13,21,40]` top-to-bottom: a real gradient, not a fill |
| Gameplay unregressed | 9 questions, 6 correct / 3 wrong, 0 failures |
| Python | 36 files, `PY_DIFF=0` |

## Not changed (protected)

Question generation, scoring, combo, XP/gold, the `(level-1)//6+1` unlock
formula, auth/session, the server, and Desktop Python were **not touched**.
No label text, layout coordinate, or hit area was altered.
