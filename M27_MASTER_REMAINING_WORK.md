# M27 — MASTER REMAINING WORK

Audit date 2026-09-30. **Audit + roadmap only — nothing was implemented.**
Desktop Python was not touched (`PY_DIFF = 0`). No deployment. No history rewritten.

## Verified baseline (measured this milestone, not reused)

```
HEAD          cb37e4d28ea40b731d96b9aa8cf17d3ad7d0d1d3   (docs only, unpushed)
origin/main   ef495a6c4d9b8b4705667abd8621bcc902edd444
render/main   ef495a6c4d9b8b4705667abd8621bcc902edd444
WORKTREE      CLEAN
TAG           m24-final-verified -> 2a8d42068f3bae643510b8dfd27d5afe2f593fd1  (verified untouched)
PRODUCTION    ef495a6c4d9b8b4705667abd8621bcc902edd444  (DEPLOY_STATUS CURRENT)

WEB     52 suites, 742 pass, 0 fail, 15 skip, 0 harness errors
SERVER  100 + admin_rbac 16 + database 20 = 136 pass, 0 fail
PY      36 files, PY_DIFF = 0
```

## Phase 1 — Feature matrix (from actual registrations, not milestone docs)

24 states are registered in `web/js/main.js`. 9 API routes exist in `server/server.js`.

| Feature | Registered | Reachable from Menu | Persistent | Mobile | Tested | Prod-verified | Severity |
|---|---|---|---|---|---|---|---|
| loading / boot | yes | n/a | n/a | yes | yes | yes | — |
| login | yes | yes | session cookie | yes | yes | yes | — |
| register | yes | yes | server | yes | yes | yes | — |
| menu | yes | yes | yes | yes | yes | yes | — |
| lesson_select | yes | yes | progress | yes | yes | yes | — |
| theory | yes | yes | — | yes | yes | yes | — |
| lesson | yes | yes | XP/level/gold | yes (keypad) | yes | yes | — |
| victory / defeat | yes | yes | reward grant | yes | yes | yes | — |
| review | yes | yes | weak topics | yes | yes | yes | — |
| practice | yes | victory/defeat | — | yes | yes | yes | — |
| shop / pet / skin / gacha | yes | yes | yes | partial | yes | yes | P2 (see gaps) |
| daily / achievement / skill_tree | yes | yes | yes | partial | yes | yes | P2 |
| profile / skill_map / bag | yes | yes | yes | partial | yes | yes | P2 |
| settings / passwordChange | yes | yes | localStorage | yes | yes | yes | — |
| adminPanel | yes | admin role only | server | n/a | yes | yes | — |
| **TimeAttack** | **NO** | card locked `M7` | n/a | n/a | n/a | n/a | see Phase 18 |
| **Exam** | **NO** | card locked `M10` | n/a | n/a | n/a | n/a | see Phase 18 |

Desktop `main.py` **does** implement `TimeAttackState` and exam states; the Web does not.
Those Menu cards are deliberately locked with honest copy (M15-D1), so this is a
**scoping decision, not a broken flow** — see F-01/F-02.

## Phases 3/4 — Curriculum and progression

Curriculum verified programmatically: **G1=40, G2=73, G3=81, G4=73, G5=75** (contiguous ids,
total 342). Question variety was fixed in M15 (106/342 lessons previously emitted ≤3 distinct
questions in a 15-question lesson; now 0). Unlock formula `(level-1)//6+1` matches Desktop and
was **not** touched (C1 closed by human decision, keep-parity).

## Phase 10 — Persistence (mandatory P1)

```
server.js:19  BACKEND  = MATHDRILL_BACKEND==='sqlite' ? 'sqlite' : 'file'   (prod = file)
server.js:23  DATA_DIR = MATHDRILL_DATA_DIR || <repo>/server/data
server.js:38  file    -> DATA_DIR/users.json
server.js:41  file    -> DATA_DIR/sessions.json
database.js:64 sqlite  -> DATA_DIR/mathdrill.db
```

**Both backends write into the same `DATA_DIR` inside the container.** Render's filesystem
without an attached Persistent Disk is ephemeral. Observed production `uptimeSec` resetting to
1–5 s repeatedly ⇒ every account/session/XP/gold/inventory is lost on each recycle.
Enabling SQLite alone changes *format*, not durability.

Production runtime/plan/disk/mount are **UNKNOWN** — no endpoint or header exposes them, and
`render.yaml` is not adopted (0 GitHub deployment records ever).

## Phases 9/13 — Performance and audio

```
REAL client payload (js+assets+audio+fonts+css+html) = 20.43 MB
  web/assets/gt2.gif          10,769 KB   TRACKED IN GIT, referenced NOWHERE
  web/audio/bgm_main.ogg       2,440 KB
  web/audio/nhac_nen.ogg       2,440 KB   (same byte size - likely duplicate)
  web/fonts/Segoe UI Emoji     2,024 KB
  web/assets/victory_text.png   494 KB   (used)
  web/assets/defeat.png         421 KB   (used)
18 audio files, real playback via audio.js (.play()), browser autoplay unlock honoured
34 <script> tags in index.html, no defer/async  -> fully serialised boot
Measured production cold boot to Login: 40-63 s, variable
```

## Phases 7/8 — UI, mobile, accessibility

Original identity protected and verified live on M25.1 (book 40/40 across 8 screens, page flip
0.3333 s, curl 580→406→580, no full-screen transition, buttons/hover/glow/press, 5 viewports).
`index.html` has `lang`; canvas carries `role`. **Zero `tabindex`** anywhere — expected for a
canvas game driven by its own input layer, but there is no visible-focus management and no
screen-reader path to the canvas UI.

## Phases 14/15/16 — Security, tests, launch

Auth/RBAC, 5-user isolation, password/hash/session non-leakage and tamper-resistance were all
exercised in M25/M26 with zero leakage. No secrets in web JS/HTML/CSS/tests. 15 documented
test skips remain (audio gaps, browser-only cases). No false-positive harness defects outstanding.

---

# Remaining work register

| ID | CATEGORY | SEV | DESCRIPTION | EVIDENCE | PLAYER IMPACT | REQ_WEB_GAME | REQ_BETA | REQ_LAUNCH | DEPS | SCOPE | SOURCE | PRODUCTION DEP |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| M27-01 | Persistence | **P1** | Production storage is inside the ephemeral container filesystem | `server.js:23,38,41`; uptime reset to 1–5 s observed | **All progress lost on every recycle** | YES | YES | YES | Render plan + disk decision | Infra + 1 env var | `server/server.js` | **BLOCKED — dashboard** |
| M27-02 | Deployment | **P1** | Deploys are manual; service is a Public-Repo connection | `deployments_count = 0` all-time | Releases can be believed live when they are not | YES | YES | YES | Repo → GitHub App connect | Config only | Render dashboard | **BLOCKED — dashboard** |
| M27-03 | Auth/Account | **P1** | No user-facing account recovery. Only `/api/admin/reset-user` exists | route scan; `forgot`/`reset-password` absent | A child who forgets the password is locked out permanently | NO | **YES** | YES | M27-01 | Small | `server/server.js` | none |
| M27-04 | Performance | **P1** | `gt2.gif` is 10.7 MB, tracked in git, referenced nowhere | asset scan | 10.7 MB of dead weight shipped to every client | NO | SHOULD | SHOULD | none | Trivial (delete) | `web/assets/gt2.gif` | none |
| M27-05 | Performance | P2 | 20.43 MB client payload; duplicate 2.44 MB BGM pair; 2 MB emoji font | asset audit | Slow first load on weak devices | NO | SHOULD | SHOULD | M27-04 | Small | `web/assets`,`web/audio`,`web/fonts` | none |
| M27-06 | Performance | P2 | 34 serial `<script>` tags, no `defer`/`async` | `index.html` | Fully blocking parse/boot | NO | SHOULD | SHOULD | none | Small | `web/index.html` | none |
| M27-07 | Performance | P2 | 40–63 s variable cold boot | measured | Long blank wait | NO | SHOULD | SHOULD | M27-01 | Infra | Render plan | **BLOCKED** |
| M27-08 | UX | P2 | Validation returns bare `INVALID_INPUT`, no field detail | `auth_service.js:54-63` | Child cannot tell what to fix | NO | SHOULD | SHOULD | none | Trivial | `server/auth_service.js` | none |
| M27-09 | Data integrity | P2 | `user_store.js:174` overwrites `users.json` in place, no temp+rename | source | Crash mid-write can corrupt ALL accounts | NO | SHOULD | SHOULD | M27-01 | Trivial | `server/user_store.js` | none |
| M27-10 | Mobile | P2 | Secondary systems only partially mobile-verified (9 screens at 4 viewports, not 390×844 portrait) | M25 evidence | Possible unusable controls on phones | NO | SHOULD | SHOULD | none | Small | `web/js/states_real.js` | none |
| M27-11 | Accessibility | P3 | No focus management / screen-reader path for a canvas-only UI | `tabindex` = 0 repo-wide | Excludes assistive-tech users | NO | no | SHOULD (if public) | none | Large | whole `web/js` | none |
| M27-12 | Operations | P2 | No `/health` endpoint; health path is `/api/meta/version` and 404s on HEAD | method probe | Probes/monitors using HEAD fail | NO | SHOULD | SHOULD | none | Trivial | `server/server.js` | none |
| M27-13 | Security | P3 | No rate limiting on `/api/auth/*` | route scan | Brute-force possible on a public URL | NO | SHOULD | SHOULD | none | Small | `server/server.js` | none |

## Classification (Phase 18 — no artificial work)

**FUTURE_FEATURE / scoping decision, NOT a defect**
- **F-01 TimeAttack** — Desktop implements it; Web does not; the Menu card is honestly locked
  with "đang được xây dựng". No player flow is broken. Building it is a product decision.
- **F-02 Exam** — same, locked `M10`.
- **F-03 Custom domain / landing page / analytics / support contact** — not required for a
  working web game; needed for public distribution. EXTERNAL/business decision.
- **F-04 Privacy policy / children's data (COPPA/GDPR-K)** — MathDrill targets children and
  collects accounts + play data. **No privacy policy or data-handling notice exists in the
  codebase.** This is EXTERNAL and requires legal review before public release. Not a code
  defect, but a launch blocker that no amount of engineering removes.

**NOT defects** (verified, do not "fix")
- Grade 3 L79/80/81 gated at levels 469/475/481 — Desktop parity, closed by human decision.
- 15 test skips — documented gaps, not failures.

## Totals

```
TOTAL_OPEN_ITEMS   = 13
P0 = 0
P1 = 4   (M27-01 persistence, M27-02 deploy, M27-03 recovery, M27-04 dead 10.7MB asset)
P2 = 6   (M27-05 payload, M27-06 scripts, M27-07 cold boot, M27-08 errors,
           M27-09 write atomicity, M27-10 mobile, M27-12 health)
P3 = 2   (M27-11 a11y, M27-13 rate limiting)
EXTERNAL_BLOCKERS = 3  (M27-01 + M27-02 need Render dashboard; F-04 needs legal)
FUTURE_FEATURES   = 2  (F-01 TimeAttack, F-02 Exam)
OUT_OF_SCOPE      = 2  (F-03 go-to-market, F-04 legal — business/human)
```

## Recommended order

1. **M27-04** (delete dead 10.7 MB asset) — trivial, zero risk, immediately cuts payload ~53 %.
2. **M27-01 + M27-02** — the only true launch blockers; both need one dashboard session.
3. **M27-03** account recovery — highest player-facing risk after persistence.
4. **M27-05/06/09/12** — cheap performance + robustness wins.
5. **M27-10, M27-08, M27-13** — polish/security hardening.
6. **F-04 privacy review** — must start early; long legal lead time.

## Recommended order

Do **not** begin implementing until M27-01/M27-02 are resolved, because persistence
architecture determines whether the later P2 persistence work (M27-09) is even written
against `user_store.js` or against SQLite. Implementing M27-09 now would likely be discarded.
