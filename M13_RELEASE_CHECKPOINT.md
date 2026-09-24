# MathDrill M13 Local Release Candidate

- Date: 2026-09-24
- Baseline: `e69a3863c84005c84178ec49e027f8b71856537b`
- Implementation commits:
  - `84f8a93b48943c6fdf80acf4d426c7d37dffbad2` — browser auth navigation harness race fix
  - `7d1419cdc53dc7f0229bc66d98830072580bed59` — playable Settings and Password Change flow

## Reproduced defects and fixes

1. **Product defect:** the Menu Settings card was locked and the Web runtime had no registered Settings or Password Change state. The M13 implementation adds Desktop-parity settings controls, immediate save/feedback, reload restoration, and a functional Password Change form with validation and authenticated API submission.
2. **Harness defect:** Register → Back was clicked while the fade transition still swallowed input, and typed field values were read before the engine tick consumed queued keys. The browser harness now waits for idle state and polls field updates.

No additional evidence-backed defect was reproduced in Shop, Pet, Skin, Gacha, Daily, Achievement, Skill Tree, Profile, secondary-screen back navigation, or rapid card navigation.

## Fresh verification

- Web regression: **40 suites, 573 pass, 0 fail, 15 skip, 0 harness errors** (exit 0)
- Server regression: **126 pass, 0 fail, 0 harness errors** (10 suites)
- Real Chromium final QA: **90 pass, 0 fail**
  - 0 console errors
  - 0 page errors
  - 0 unexpected network >=400 responses
  - 0 wrong MIME
  - Settings change, reload persistence, Password Change validation/back, RBAC, all secondary back routes, theory, gameplay, result, responsive pointer mapping, logout/login, and admin verified
- Real Chromium deep gameplay: **555 questions**, **438 correct clicks**, **117 wrong clicks**
  - 15,685 invariant checks; 0 failures
  - 1 Victory and 1 Defeat
  - Grade 3 lesson IDs 79, 80, and 81 included
  - 0 console/page/request/4xx failures
- Responsive real clicks: 1300x800, 1280x720, 1920x1080, 1024x640
- Focused M13 settings contract: **4 pass, 0 fail**
- Desktop Python: **unchanged** (source/repository SHA-256 comparison: 0 differences)
- Source/repository intended-file match: **yes**

## Release boundary

This checkpoint is local only. GitHub `origin/main` and Render remain at the M12 rollback baseline until a later explicit release/deployment task.
