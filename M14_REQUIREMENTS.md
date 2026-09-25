  # MathDrill M14 Requirements (evidence baseline, NOT started)

Source: actual M13 closeout state. Production 9f0344c live. No item implemented.

## A. Gameplay experience
- A1. Lesson unlock pacing: formula `(level-1)//6+1`, Grade3 L79 needs level 469.
  Impact: end-grade lessons unreachable by practical QA. Type: design constraint.
  Evidence: main.py:690,941; web/js/data_loader.js:79. Priority: P1. Dep: progression design.
- A2. Victory/Defeat verified live (7 victory + 1 defeat, 120q, 720 invariants, 0 fail).
  Keep as regression gate. Priority: P0-guard.

## B. Player progression
- B1. XP curve `100*1.15^(L-1)` to L50 then linear; L37 needs ~13k exp.
  Impact: grind-heavy late game. Type: design. Evidence: player.py:10-25, M13 gate (L37/exp13882).
  Priority: P1. Dep: A1.
- B2. Grade persistence fix 9f0344c verified live (grade 3 stored/restored).
  Guard against regression. Priority: P0-guard.

## C. Educational experience
- C1. Theory content present for G3 lessons; review-needed flags exist.
  Impact: review loop exists but no spaced-repetition schedule. Type: enhancement.
  Evidence: main.py:943, TheoryState. Priority: P2.

## D. UX/UI
- D1. Settings + Password Change verified live. Keep guarded. Priority: P0-guard.
- D2. Locked-lesson affordance: lock icon + no navigation (verified for 79/80/81).
  Consider showing required level explicitly. Type: enhancement. Priority: P2.

## E. Mobile/touch
- E1. Canvas fixed 1300x800 with responsive pointer mapping (verified 4 sizes).
  No true mobile layout. Type: enhancement. Priority: P1.

## F. Performance
- F1. Lesson sessions ~8s/15q headless; live boot ~6s after CDN warm.
  Monitor cold-start. Priority: P2.

## G. Production engineering
- G1. Render auto-deploy lag observed (9f0344c pushed, deploy delayed).
  Need deploy-status visibility. Priority: P1.

## H. Account/security
- H1. Anonymous /api/player/data = 401 AUTH_REQUIRED (verified). Keep guarded. P0-guard.
- H2. RBAC normal user /api/admin/me = 403 (verified). Keep guarded. P0-guard.

## I. Content/data
- I1. G3 has 81 contiguous lessons 1..81 (verified). 79/80/81 ordinary reviews.
  No trim allowed. P0-guard.

## J. Release/operations
- J1. M13 checkpoint + live hashes (8/8 + auth.js) recorded. Keep hash-gate for M14. P0-guard.

Count: 13 items (4 guards, 9 design/enhancement).
