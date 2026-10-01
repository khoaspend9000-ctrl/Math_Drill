# M32 — FINAL PARITY REPORT

Phase A (audit) only. No application logic was modified in this milestone.

Method note: M31 proved the M28 audit wrong by missing a live entry point, so every
inventory in M32 was re-derived directly from Desktop source rather than inherited
from a prior milestone document.

| Metric | Value |
|---|---|
| Desktop `GameState` subclasses | **26** (all in `main.py`) |
| plus non-GameState state | `admin_panel.py:131 AdminPanelState` |
| Web registered states | **30** |
| Desktop transitions mapped | **57** |
| Transition mismatches | **1** |
| P0 | 0 |
| P1 | 1 |
| P2 | 0 |
| P3 | 3 |

**Matrix statuses:** PASS 21 · PARTIAL 4 · MISMATCH 1 · MISSING 0 · DEAD 0 ·
INTERNAL 0 · UNKNOWN 0 (of the 26 Desktop states; PARTIAL means reachable and
functional but not re-verified line-by-line this milestone).

Detailed artefacts:
- `web/M32_FINAL_PARITY_MATRIX.md` — inventory, state matrix, systems, gaps
- `web/M32_TRANSITION_MATRIX.md` — all 57 Desktop transitions

## Findings this milestone actually produced

The headline is one real P1 and three P3 items, all source-proven. Everything the
previous five milestones reported was re-derived, and the re-derivation is what
surfaced the P1.

**P1 — Defeat retry cannot return to the Daily Challenge.**
`main.py:1029-1030` branches on `lesson_title == "Thử Thách"`. The Web
`DefeatState` has no such branch, so a player who fails the daily and presses
"LÀM LẠI" lands in an ordinary numbered lesson. This is reachable by every player.

**P3 — ProfileState admin gold text** (`main.py:2173` "Vô hạn (Admin)").
**P3 — `web/js/states.js`** duplicates `LoadingState`/`MenuState`, is absent from
`index.html`, yet is still required by `main.js` and 10 test files.
**P3 — `set_bgm` is a no-op** in Web since M4 (acknowledged platform gap).

**Structural difference (not a defect):** Desktop folds pen/board/pet into one
`ShopState` (`main.py:2288`); Web splits them into `ShopState` + `PetState` +
`SkinState`. No capability is unreachable.

## What was NOT re-verified

`RegisterState.draw`, `AchievementViewState.draw`, `DailyState.draw`,
`ShopState.draw`, `SkillTreeState.draw`, `BagState.draw`, `VictoryState.draw`, and
the `TransitionEffect` / `compute_profile_stats` helpers. These are marked PARTIAL,
not PASS. A previous PASS was not accepted as proof.

## Scope respected

Production storage durability, deployment automation, privacy/legal and analytics
were excluded by the brief and are untouched.

## Decision

**B — VERIFIED P1 GAPS REMAIN.**

"100% Desktop parity" is **not** claimed.

## Next phase

- **M32.1** — fix the Defeat retry branch (`main.py:1029-1030`).
  Files: `web/js/states_real.js`. Test: new focused suite asserting daily→`daily`
  and normal→`lesson`. Browser: fail a daily, press retry, land on `daily`.
- **M32.2** — re-diff the eight PARTIAL draw methods.
- **M33** — persistence durability, security and deployment hardening (the standing
  external blocker, unchanged since M26).
