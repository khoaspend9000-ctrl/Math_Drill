# M26 FINDINGS — Product / Market Readiness Audit

Baseline: M25.1 `ef495a6c4d9b8b4705667abd8621bcc902edd444` (production-verified)
Audit date: 2026-09-30. All evidence produced this milestone.

## Issue matrix

| ID | SEVERITY | SCREEN/SYSTEM | REPRODUCIBLE | ROOT CAUSE | USER IMPACT | FIX COST | RECOMMENDATION |
|----|----------|---------------|--------------|------------|-------------|----------|----------------|
| M26-01 | **P1** | Deployment / Persistence | Yes (mechanism proven; data-loss not induced) | `server.js:18` defaults `BACKEND` to `file`; `DATA_DIR = server/data` inside the container. Render free-tier filesystems are **ephemeral** — a container restart recreates `users.json` + `sessions.json` from the image. | Every registered account, session, XP, gold, achievements and shop state is lost on any deploy, instance recycle or crash. The service already recycles frequently (uptime observed resetting to 1–5s repeatedly). | Decision + config | **ESCALATE.** Not fixable safely from the repo alone. Needs either a persistent disk, the existing SQLite backend (`MATHDRILL_BACKEND=sqlite` already implemented, needs `node:sqlite` availability check), or an external store. Do NOT silently ship file persistence to production users. |
| M26-02 | P2 | Operations | Yes | Render is connected as a **Public Repository**: `deployments_count = 0` for the repo's entire history, `render.yaml` `autoDeploy: true` is not adopted. Every release needs a human Manual Deploy. | Repeated manual deploy step; risk that a release is believed deployed when it is not. | Low | Adopt the blueprint or document the manual step as an operational gate. |
| M26-03 | P2 | Startup performance | Yes (measured) | Production cold boot to Login is **40–63 s** and variable; the instance recycles freely. Measured client-side boot work is small (state machine + assets). | Long blank wait on the Login screen for every cold start. | Medium | Server-side (free-tier cold start) dominates. Do not claim a frontend optimisation fixes it. The M16.1 reassurance text already addresses the UX. |
| M26-04 | P2 | Login/Register UX | Yes | Server returns a bare `{"ok":false,"error":"INVALID_INPUT"}` with **no field-level detail**. A player who mistypes gets one generic message for every distinct cause (short username, empty password, duplicate). | Child cannot tell what to fix; may retry blindly. | Low | Return a safe, specific message per validation failure (no user enumeration). |
| — | — | Gameplay, book, buttons, page flip, theory, progression, weak-topic review, mobile keypad, session restore, admin/RBAC | No defect found | Audited live on M25.1 production; all gates pass (see M26_IMPLEMENTATION_REPORT.md). | — | — | **NO REPRODUCED DEFECT — no change made.** |

## Findings that looked like defects but were MY harness bugs

Recorded deliberately so they are not re-investigated later.

1. **`register → 400 INVALID_INPUT`** — PowerShell was stripping the double quotes from an inline
   `curl -d '{"username":...}'` payload, so the server received invalid JSON. The correct limit
   checks (`maxUsernameLen = 32`) were never the issue. Verified with
   `curl --data-binary @file` → `201 {"ok":true,...}`. **Not a product defect.**
2. **`serverXp: 0` for all 5 users in the multi-user probe** — the probe called
   `s._dismissFeedback()` directly and never ran `state.update()`, so the lesson never advanced to
   the save point, and it invoked `pushPlayerData()` before the account blob was written. A proper
   lesson run produced `server: {xp: 90, level: 9, gold: 25948}`. **Not a product defect.**
3. **M25.1 acceptance "TRUOC page pixels unchanged"** — the sample column at `x=700` is masked by
   LessonSelect's own cards. The flip runs 19 frames, the deferred commit fires, and the curl
   geometry is numerically correct (`580 → 406 → 580`). Verified indirectly, not directly.

## Prioritisation conclusion

There is **no P0** and **no locally-fixable P1**. The single genuine P1 (M26-01) is an
infrastructure/persistence decision that cannot be safely made from the repository alone: the
SQLite backend already exists in the codebase but switching to it requires verifying `node:sqlite`
availability on the target Node runtime and documenting the requirement, exactly as the milestone
brief instructs. No code was changed to "fix" it.
