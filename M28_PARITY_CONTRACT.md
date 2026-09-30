# M28 PARITY CONTRACT — definition of "100% synchronized with Desktop"

Baseline: production `ef495a6c4d9b8b4705667abd8621bcc902edd444` (M25.1)
Tag `m24-final-verified` -> `2a8d42068f3bae643510b8dfd27d5afe2f593fd1` (must remain untouched)
Desktop `main.py` + `game_init.py` are READ-ONLY SOURCE OF TRUTH.

## What "parity" means

Parity is **player-visible equivalence**, not identical code. For every Desktop
feature, all of the following must hold:

1. **Existence** — the feature is reachable by a player in the Web build.
2. **Route** — the navigation that reaches it exists on Web.
3. **Rule** — every numeric/formula rule produces the same result for the same inputs.
4. **Content** — same lesson ids, titles, templates, theory, rewards, unlock levels.
5. **Asset** — the Desktop asset is used, or an explicitly documented substitute exists.
6. **Presentation** — colours, geometry, typography, z-order match the source values.
7. **Feedback** — same correct/wrong/combo/level-up/victory/defeat response.
8. **Audio** — same trigger and same asset, where the browser permits.
9. **Persistence** — same *observable* save/restore semantics (storage engine may differ).
10. **Input** — same actions reachable; extra input methods are additive only.

A screen merely *existing* is NOT parity. A locked/greyed screen is NOT parity
for a Desktop feature that is playable.

## Allowed Web-only differences (explicit)

- **Storage engine** — SQLite/file/Postgres instead of Python JSON. Player-visible
  semantics must still match.
- **Canvas instead of pygame** — same coordinates, same colours, same draw order.
- **Additive input** — M15 keyboard digits, M15 touch keypad. These *add* reachability;
  they never change a rule.
- **Responsive scaling** — M14/M15 viewport handling. The logical design space stays
  1300x800 so geometry is unchanged.
- **Session-cookie account model** — Desktop is local-account; Web is HTTP. Player-facing
  register/login/logout/change-password semantics must match.
- **M16.1 loading reassurance text** — additive copy on an existing Desktop screen.

## Forbidden under this milestone

- Redesigning, restyling, or "modernising" any screen.
- Inventing mechanics Desktop does not have.
- Removing a Desktop feature because Web never implemented it.
- Touching `*.py`.
- Deleting a Desktop asset on the grounds that Web does not currently load it
  (see the `gt2.gif` correction below).

## CORRECTION to M27 (M27-04 was wrong)

M27 recorded *"web/assets/gt2.gif is 10.7 MB, tracked in git, referenced nowhere —
delete it."* **That is incorrect and the deletion was NOT performed.**

Evidence gathered in M28:
- `web/tests/polish_m4.test.js:78,90` (in the regression runner) assert `gt2.gif`
  exists AND is **SHA-256 byte-identical to the Desktop source asset**.
- Desktop `main.py:290` — `IdleGifState` loads `gt2.gif`.
- Desktop `main.py:232` — boot enters `IdleGifState()` (the attract/screensaver
  screen) before Login.

So `gt2.gif` is **not dead weight**. It is the original asset of a real Desktop
feature (`IdleGifState`) that the Web build has not implemented. Deleting it would
destroy an original Desktop asset and break two enforced parity assertions.

Reclassified: **M28-01 IdleGifState / attract screen missing on Web = P1 parity gap**,
and `gt2.gif` is its *required* asset. The 10.7 MB weight is a real cost but it is
Desktop-mandated content, not waste.
