# M26.1 DECISION — Production Persistence Architecture

Baseline: production/live = `ef495a6c4d9b8b4705667abd8621bcc902edd444` (M25.1, verified)
Local HEAD = `fa5ec74838d96deafc98d6501fac49e5c9f5eeef` — **docs only**, verified to contain
zero paths under `web/`, `server/`, `index.html`, `package.json`, `render.yaml`.
Product code is byte-identical between `fa5ec74` and `ef495a6`.

---

## CURRENT_ARCHITECTURE

`server/server.js:19-45` selects the backend at startup:

```js
const BACKEND  = process.env.MATHDRILL_BACKEND === 'sqlite' ? 'sqlite' : 'file';
const DATA_DIR = process.env.MATHDRILL_DATA_DIR || path.join(__dirname, 'data');
```

**file backend (what production runs today)**
- `server/user_store.js` → `UserStore`  → `DATA_DIR/users.json`
- `server/session_store.js` → `SessionStore` → `DATA_DIR/sessions.json`
- Load: `fs.readFileSync` guarded by `existsSync` (missing file = empty store, no error)
- Save: `fs.writeFileSync(this.filePath, JSON.stringify(...))` (`user_store.js:174`)
- Store interface: `create/find/update/lockUser/setMax/...`; admin mutations in the same store

**sqlite backend (implemented, NOT enabled in production)**
- `server/database.js` → `DatabaseUserStore` + `DatabaseSessionStore`
- `const { DatabaseSync } = require('node:sqlite')` (`database.js:30`)
- `new DatabaseSync(path.join(DATA_DIR, 'mathdrill.db'))` (`database.js:64`)
- Tables created with `CREATE TABLE IF NOT EXISTS`: `users`, `sessions`, `players` (`database.js:33-57`)

**Critical fact that decides this milestone:**
```
file backend    -> DATA_DIR/users.json      (inside the container)
sqlite backend  -> DATA_DIR/mathdrill.db   (inside the container)
                      ^^^^^^^^^^^^^^^^^^^^^^^^^ THE SAME DIRECTORY
```
**Both backends write to the same path.** `DATA_DIR` defaults to
`server/data`, inside the service filesystem. Switching
`MATHDRILL_BACKEND` to `sqlite` therefore changes the *format*, **not the
durability**.

## ROOT_CAUSE

The failure is not the storage engine, it is the *location*. Render's filesystem
for a service without an attached Persistent Disk is **ephemeral**: a redeploy,
instance replacement or spin-down destroys everything written to it.

Evidence that production recycles: during M26 the live
`/api/meta/version.uptimeSec` was observed resetting to **1–5 s** on several
separate occasions while the served commit stayed `ef495a6`.

Consequence: every account, session, XP, level, gold, shop/inventory,
achievement, daily and pet state written to `server/data` is lost on each
recycle.

## RUNTIME_FACTS

| Fact | Value | How established |
|---|---|---|
| `PROD_NODE_VERSION` | **UNKNOWN** | Production exposes no runtime version. `/api/meta/version` returns only commit/service/branch/uptimeSec. No header carries it (`x-render-origin-server: Render` only). Server code never calls `process.version` (grep: `False`). |
| `PROD_RENDER_PLAN` | **UNKNOWN** | `render.yaml` declares `plan: free` but that file is **not adopted** (0 GitHub deployment records ever). Plan is dashboard-only. Not inferred. |
| `PERSISTENT_DISK` | **UNKNOWN / presumed none** | No mount path is exposed by any endpoint. No disk declaration exists in `render.yaml`. Cannot be confirmed without the dashboard. |
| `MOUNT_PATH` | **UNKNOWN** | Not exposed. |
| `LOCAL_NODE_VERSION` | `v24.20.0` | `node -v` |
| `node:sqlite` on local runtime | **AVAILABLE** — `DatabaseSync = function` | `node -e "require('node:sqlite')"` |
| `node:sqlite` on **production** runtime | **NOT VERIFIED** | Requires executing on Render. No endpoint can answer this. |

**This is the hard verification limit.** The brief requires an *actual runtime*
check for `node:sqlite` on production. It cannot be performed from this
workspace: there is no Render API credential, no dashboard session, and no code
path in the service that reports its own Node version. The smallest manual
check is stated under REQUIRED_EXTERNAL_ACTIONS.

## OPTION_COMPARISON

| Option | Survives redeploy / restart / spin-down / instance replace? | Implementation surface | Migration risk | Verdict |
|---|---|---|---|---|
| **1. Keep file backend** | **No.** `server/data/users.json` is inside the ephemeral container filesystem. | none | none | Rejected. This is the current P1. |
| **2. Enable SQLite on current filesystem** | **No.** DB path is `DATA_DIR/mathdrill.db` — the *same* ephemeral directory. Verified from source, not assumed. | 1 env var | low, but **gains zero durability** while adding a hard runtime dependency on `node:sqlite` | **Rejected. Common but wrong.** This is the trap the brief warns about. |
| **3. SQLite + Render Persistent Disk** | **Yes** — a mounted disk outlives the container. | mount + 1 env var | low | **Viable, but conditional:** Render persistent disks are not offered on the Free instance type. Requires a paid instance. Also single-instance (a disk cannot be shared across replicas). |
| **4. Render Postgres** | **Yes** — externally managed, durable. | new store implementation + `DATABASE_URL` + schema migration | **highest** — `database.js` is built on `node:sqlite` `DatabaseSync` with a *file path*; Postgres needs a different driver and dialect. | Viable but the largest change. Not justified until the plan is known. |
| **5. Another datastore already in repo** | n/a | n/a | n/a | **None exists.** `grep` over `server/` shows only the file and SQLite stores. No Redis/Postgres/Mongo client is present. |

## MIGRATION_RISK

- **Option 3** (disk): application change is ~1 env var (`MATHDRILL_DATA_DIR` →
  mount path) or enabling the existing sqlite backend pointed at the mount.
  **All existing player data on the current ephemeral volume is already lost or
  will be lost on the next recycle** — so there is effectively *nothing to
  migrate* from the file store, which also means migration risk is near-zero and
  data-loss risk is already realised. This is the cheapest safe path *if* a paid
  instance is acceptable.
- **Option 4** (Postgres): requires rewriting `database.js` storage primitives,
  a schema/migration story, connection-pooling and secret management. Disproportionate
  to the current single-instance, few-player deployment.
- **Data currently on production:** the only accounts exercised are QA accounts
  created during automated testing (e.g. `m251p…`, `m26u…`). No real-player data
  was observed. **No migration of real data is required, and none should be
  performed against production.**

## REQUIRED_EXTERNAL_ACTIONS

The minimum a human must do in the Render Dashboard — none of it is achievable
from this workspace:

1. **Service → `math-drill-iwys` → Settings → Runtime**
   Read and record the exact **Node version**. This settles `PROD_NODE_VERSION`
   and therefore whether `node:sqlite` (needs Node ≥ 22.5, stable from 24) exists
   in production. *(Smallest possible check; nothing else is needed for this fact.)*
2. **Service → Settings → Plan** — record the actual plan (confirms whether a
   Persistent Disk can be attached at all).
3. **Service → Disks** — record whether any disk is mounted and its mount path.
4. Decide: attach a Persistent Disk (Option 3) **or** provision Postgres
   (Option 4).
5. Only then set `MATHDRILL_DATA_DIR` (and `MATHDRILL_BACKEND` if using disk+SQLite)
   as environment variables and redeploy.

## ROLLBACK_PLAN

- Current code is **unchanged** by this milestone, so rollback is a no-op: the
  deployed `ef495a6` is still the rollback target.
- If a disk is attached and the mount fails, set `MATHDRILL_DATA_DIR` back to the
  default to restore the file backend — behaviour degrades to today's known state,
  never worse.
- `m24-final-verified` → `2a8d420` remains untouched throughout.

## RECOMMENDED_NEXT_IMPLEMENTATION_STEP

**Implement nothing yet.** The decision gate is not satisfied, because B1–B4 are
UNKNOWN and cannot be determined from this workspace.

The single next step is a **read-only dashboard inspection** to collect the four
unknowns. Only then can Option 3 or Option 4 be chosen on evidence.

Concretely, the recommended *first code change* (once the plan is known to permit
a disk) is deliberately tiny:

> Attach a Persistent Disk, point `MATHDRILL_DATA_DIR` at its mount path, and
> enable `MATHDRILL_BACKEND=sqlite` so writes are transactional rather than
> whole-file `writeFileSync`.

`node:sqlite` writes are atomic per-transaction, which also fixes a real
secondary weakness in the current file backend: `user_store.js:174` overwrites
`users.json` in place with no temp-file+rename, so a crash mid-write can corrupt
the entire account database. That is worth doing regardless of the durability
question.
