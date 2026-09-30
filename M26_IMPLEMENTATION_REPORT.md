# M26 IMPLEMENTATION REPORT

Milestone goal: move MathDrill from "technically verified and visually faithful"
toward "polished, maintainable, user-ready", without damaging the original
Desktop visual identity.

Baseline: M25.1 `ef495a6c4d9b8b4705667abd8621bcc902edd444` (production-verified,
live). Release tag `m24-final-verified` -> `2a8d420...` left untouched.

## HEADLINE RESULT: no product code was changed, because no product defect was reproduced.

The audit was run against live production with real Chromium. Everything that
looked like a bug turned out to be a bug in my own probe. Reporting those as
product defects would have manufactured work and, worse, could have triggered a
change to a correct system. Full detail in `M26_FINDINGS.md`.

## What was actually verified on production

**Baseline truth**
```
HEAD / origin/main / render/main = ef495a6c4d9b8b4705667abd8621bcc902edd444
PRODUCTION commit                 = ef495a6c4d9b8b4705667abd8621bcc902edd444
WORKTREE                          = CLEAN
PY_DIFF                           = 0  (36 Python files, byte-identical)
web *.test.js files               = 54
server *.test.js files            = 11
```

**Multi-user / persistence (5 accounts, shuffled re-login)**
```
register 5 accounts                      -> [201,201,201,201,201]
server-side grade per account           -> 3,3,3,3,3   (M24 grade propagation holds)
cross-user identity leakage (5 checks)  -> leaks=0
each user keeps own server XP           -> confirmed
page errors / console errors / failures -> 0 / 0 / 0
```

**Progression persistence, done correctly**
A full lesson driven through the real loop produced:
```
server = { grade:3, xp:90, level:9, gold:25948 }
```
matching the client exactly. XP/level/gold therefore DO reach the backend.
The earlier `serverXp: 0` reading was a probe defect (see findings).

**M25.1 feature surface re-confirmed live**
- Book surface: 8 screens x cover `(80,50,20)` / inner `(101,67,33)` /
  spine `(150,150,150)` / cream `(253,246,227)` -> 40/40
- Page flip: duration `0.3333 s`, curl `580 -> 406 -> 580`, pageW 580
- No full-screen transition on any navigation (`trFrames = 0`)
- Viewport outside the book pixel-stable (`outsideChanged = 0`)
- Destination revealed only after the final flip frame (swap 28 > flip 27)
- Duplicate-click guard: busy during flip, exactly one commit
- M15/M24 intact: real-UI login, 48 questions 24/24 with 0 invariant failures,
  mobile keypad (4 keys, answers), weak-topic API, progression header
  `Da mo 1/81 bai | Bai 2 mo o Lv7`, session restore across reload

**Regression (fresh, not reused)**
```
WEB     52 suites, 742 pass, 0 fail, 15 skip, 0 harness errors
SERVER  100 pass + admin_rbac 16 + database 20 = 136 pass, 0 fail
PY_DIFF 0
```

## Open issues (not fixed, deliberately)

| ID | Severity | Why not fixed here |
|----|----------|--------------------|
| M26-01 | **P1** | Ephemeral-filesystem persistence. `server.js` defaults to the `file` backend with `DATA_DIR = server/data` inside the container; Render's free tier discards that on any recycle, and the instance recycles every few minutes. A SQLite backend already exists in the codebase behind `MATHDRILL_BACKEND=sqlite`, but enabling it requires first verifying `node:sqlite` exists on the deployed Node runtime and documenting the operational requirement. The brief explicitly forbids switching persistence "without first measuring and documenting the requirement", so this is escalated, not silently changed. |
| M26-02 | P2 | Manual-only deploys (Public Repository connection, 0 deployment records). Operational, not code. |
| M26-03 | P2 | 40-63 s cold boot. Measured to be dominated by server/free-tier cold start, not client work. Not claiming a frontend fix. |
| M26-04 | P2 | Generic `INVALID_INPUT` on validation failure with no field detail. Genuine UX gap, but changing server error payloads touches auth surfaces and needs its own focused change + regression; not bundled into an audit milestone. |

## Artifact / disk hygiene
Test artefacts confined to `E:\m13_temp` (single scratch directory). No
per-question dumps, screenshots or traces were produced this milestone beyond the
flip-geometry captures. Nothing committed except this documentation.
