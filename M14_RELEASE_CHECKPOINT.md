# MathDrill M14 Release Checkpoint

Status: **M14_IMPLEMENTED_AWAITING_RENDER_DEPLOY**
Date: 2026-09-25
M13 baseline: `9f0344c012b54b695def9612bc10b9d143292e23` (verified live at M13 closeout)
M14 HEAD: `f44119c2fa1d66328ce90a6b4fd9108e7e9b3f99`
Desktop Python source: **UNCHANGED** (36 files, byte-identical, PY_DIFF=0)

## Commits

| SHA | Scope |
|---|---|
| `3a925a4` | M14-G1/J1 deploy identity endpoint + production release gate |
| `494d8f7` | M14-E1 portrait phones get a rotate hint instead of a collapsed canvas |
| `f44119c` | M14-C1 theory resolves for every lesson, not just 69 of 342 |

## The 13 M14 requirements

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| A1 | Lesson unlock pacing `(level-1)//6+1`; G3 L79 needs level 469 | VERIFIED_DESIGN_CONSTRAINT | Forensically confirmed Desktop parity (main.py:690,941 == data_loader.js:79). Gating deliberately UNCHANGED. Addressed by D2 (the level is now shown to the player). |
| A2 | Victory/Defeat regression gate | GUARDED | m7d_victory_defeat; live runs reached both. Unchanged. |
| B1 | XP curve `100*1.15^(L-1)` to L50 then linear | VERIFIED_DESIGN_CONSTRAINT | player.py:10-25 matches Web. No defect found; not changed. |
| B2 | Grade persistence (9f0344c) | GUARDED | server/tests/auth.test.js T02b asserts `data.grade === 3` after register. |
| C1 | Theory content / review loop | **IMPLEMENTED (bug fixed)** | 273/342 lessons showed the placeholder. Fixed + T26-T29 + real Chromium proof. |
| D1 | Settings + Password Change | GUARDED | m13_settings.test.js 4/4; verified live in M13. |
| D2 | Locked-lesson affordance | **IMPLEMENTED** | Tiles now render the exact required level. T17-T25 + real Chromium. |
| E1 | Mobile / touch | **IMPLEMENTED (bug fixed)** | Portrait collapsed to 375x231. Rotate hint added. 6-device Chromium matrix. |
| F1 | Cold-start observability | **IMPLEMENTED** | `/api/meta/version` reports `uptimeSec`; T09 pins it. |
| G1 | Deploy-status visibility | **IMPLEMENTED** | `GET /api/meta/version` returns the deployed commit. T01-T03. |
| H1 | Anonymous `/api/player/data` = 401 | GUARDED | security_hardening + live gate GATE-04. |
| H2 | RBAC `/api/admin/me` = 403 for normal user | GUARDED | admin_rbac 16/16 + live gate GATE-05. |
| I1 | G3 has 81 contiguous lessons 1..81 | GUARDED | m7b T12 (81) + T21-T25 assert 79/80/81 titles and thresholds. No data trimmed. |
| J1 | Hash gate for M14 | **IMPLEMENTED** | `web/tests/m14_release_gate.js`: one command proves live commit + 9/9 byte hashes + auth gating. |

Completed: 6 implemented, 7 verified/guarded, 0 skipped.

## Files changed

- `server/server.js` — `/api/meta/version` route, `handleMeta`, `uptimeSec`
- `web/js/states_real.js` — theory number fallback (`theoryFound`), locked-tile required level
- `web/js/data_loader.js` — `requiredLevelForLesson()` (display-only inverse of the parity gate)
- `web/index.html` — `#rotate-hint` overlay
- `web/style.css` — portrait media query
- `web/tests/m7b_lesson_select.test.js` — T17-T29
- `web/tests/m14_release_gate.js` — new production gate
- `server/tests/m14_meta_version.test.js` — new, T01-T09
- `.gitignore` — per-suite server test data dirs, sqlite `-shm`/`-wal`

## Bugs found and fixed (4 product + 2 environment)

1. **Theory placeholder for 273/342 lessons (M14-C1).** `TheoryState` matched theory pages by exact title. `theory_pages.js` derives from `math_theory.json` and its titles are frequently longer than the `math_lessons.json` titles, so Grade 3 lessons 2..81 mostly displayed the "being updated" placeholder. Fixed by falling back to the lesson number, the key both files share.
2. **Unusable portrait layout (M14-E1).** On a 375x667 phone the fixed landscape canvas collapsed to 375x231, leaving two thirds of the screen as dead space with unusable tap targets. Fixed with a portrait-only rotate hint; landscape/desktop unchanged.
3. **Locked lessons gave no reason (M14-D2).** A padlock alone told a child nothing about why a lesson was unavailable. It now shows the exact required level.
4. **Release gate failed on CRLF-vs-LF (M14-J1).** The gate compared live bytes to the Git blob byte-for-byte. A Windows checkout holds CRLF while the blob and a Linux deploy hold LF, so 4 of 9 critical files reported a false MISMATCH. Now compares raw **and** LF-normalised hashes, labelling the difference while still failing on real content drift.
5. **(Environment, not product.)** Leaked `PORT` / `MATHDRILL_DATA_DIR` shell variables made `m10d_admin` run against the wrong data dir. No code change; the regression harness is unaffected once the shell is clean.
6. **(Environment, not product.)** `.gitignore` uses CRLF, so a scripted `server/data/*.db-shm` / `-wal` insertion silently failed and the worktree never went clean after the server tests. Added via a line-aware edit.

## Test results

```text
Web regression    40 suites, 586 pass, 0 fail, 15 skip, 0 harness errors
Server            11 suites, 136 pass, 0 fail
Real Chromium     M14-D2 8/8, M14-C1 7/7, M14-E1 6/6
Console errors    0
Page errors       0
Request failures  0
```

## Production

```text
Live commit                     9f0344c  (M13, unchanged)
GitHub Math_Drill main          9478b62
GitHub Math-Drill main          9478b62
Render deployment               NOT DEPLOYED after ~7 h and 7 pushes
```

### F1 — Render has stopped deploying (operational blocker)

Every M14 commit is verified present on `Math_Drill@main` via
`git ls-remote` (`3a925a4`, `494d8f7`, `f44119c`, `b7e9335`, `ad764a5`,
`bc41617`, `9478b62`), yet production still serves M13:

```text
GET /api/meta/version                       -> 404  (endpoint not live)
GET /                                       -> 200
GET /js/auth.js                             -> contains payload.grade  (M13 build)
m14_release_gate.js against production      -> LIVE_COMMIT=unknown, HASH_MATCH=NO
```

The M14 gate run against a LOCAL server built from `HEAD` returns
`HASH_MATCH=YES 9/9`, 15/15 pass, so the code and the gate are both sound.
The failure is external: the Render service is not picking up `main` from
`Math_Drill`. There is no `render.yaml`, `Procfile`, `.github/workflows`,
deploy hook, or Render API credential in this workspace, so the deploy
cannot be triggered from here.

**Required human action (M15 F1):** Render dashboard → `math-drill-iwys` →
confirm the connected repository is `khoaspend9000-ctrl/Math_Drill` and the
branch is `main` → Manual Deploy → wait for the build to go live.

Once live, the acceptance command is:

```text
MATHDRILL_GIT=<git.exe> node web/tests/m14_release_gate.js
```

which must report `LIVE_COMMIT=9478b62…` (or any commit ≥ `3a925a4`),
`HASH_MATCH=YES 9/9`, `ANON_PLAYER_DATA=401`, `ANON_ADMIN_ME=401`, exit 0.

## Unresolved

- **A1 / B1 progression grind** remains a design constraint by explicit Desktop parity. Grade 3 lessons 79/80/81 need levels 469/475/481. Changing the formula would break parity and is out of M14 scope; it needs a human product decision. (Carried into M15 as C1.)
- **Render deploy** — see F1 above. M14-G1/J1 made it observable; it cannot be forced from this workspace.


## Artifact / disk hygiene

```text
E:\m13_temp   single diagnostic directory, reused/overwritten
Screenshots   0 (no visual defect required one)
Per-question  HTML/TXT dumps: 0
Traces/videos disabled
```

## Python guard

```text
PYTHON_CHANGED = NO
PY_DIFF         = 0  (36 Desktop .py files, byte-identical to E:\MathDrill)
```
