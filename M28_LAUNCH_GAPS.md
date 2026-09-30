# M28 LAUNCH GAPS (non-parity, kept strictly separate from Desktop parity)

Desktop parity is one axis. This file is the other: what a real public launch
still needs that **Desktop parity cannot supply**.

| Item | Class | Status | Notes |
|---|---|---|---|
| Durable production persistence | EXTERNAL | **BLOCKED** | `DATA_DIR` is inside the ephemeral Render container FS. Needs the four dashboard facts (plan / disk / mount / Node version). SQLite on the same FS does **not** help. |
| Automatic deploys | EXTERNAL | **BLOCKED** | Service is a Public-Repository connection; `deployments_count = 0` all-time. Every release is a manual dashboard deploy. |
| Account / password recovery | CODE | OPEN (P1) | No `forgot-password` route; only `/api/admin/reset-user`. Desktop has no equivalent, so this is a **web-only launch requirement**, not a parity gap. |
| Privacy policy / children's data | EXTERNAL | **OPEN (P1)** | MathDrill targets children and stores accounts + play data. No policy exists in the repo. Legal review (COPPA / GDPR-K) required. No code can close this. |
| Performance | CODE | OPEN (P2) | 20.43 MB payload, 34 serial `<script>` tags, 40–63 s cold boot. **Correction:** the largest single asset, `gt2.gif` (10.7 MB), is Desktop-mandated (`main.py:290` `IdleGifState`) and must NOT be deleted. Real savings come from script loading and BGM/emoji-font weight. |
| Accessibility | CODE | OPEN (P3) | Canvas-only UI, `tabindex` = 0 repo-wide; no focus or screen-reader path. |
| Mobile device QA | CODE | OPEN (P2) | Secondary systems verified at 4 viewports but not 390×844 portrait. |
| Monitoring / health | CODE | OPEN (P2) | No `/health`; declared health path 404s on HEAD. |
| Rate limiting on `/api/auth/*` | CODE | OPEN (P3) | Absent. |
| Custom domain / landing / analytics / support | EXTERNAL | OPTIONAL | Business decision, not parity, not engineering. |

**Class legend** — CODE: fixable in repo. EXTERNAL: needs Render dashboard or
legal/business action. OPTIONAL: go-to-market choice.
