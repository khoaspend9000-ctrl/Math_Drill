# M10-E — DATABASE PERSISTENCE REPORT

## Công nghệ (E1)
- **node:sqlite (DatabaseSync)** — built-in Node 24, **zero external dependency**, WAL + busy_timeout 5000ms.
- Lựa chọn theo priority: minimal dep (0 packages mới), local reliability, transactional updates, abstraction cho PostgreSQL sau này (E4).

## Schema (E2)
```
users(id PK, username UNIQUE, password_hash, role CHECK(user|admin),
      status CHECK(active|locked), lock_date, created_at, updated_at)
sessions(id_hash PK = SHA-256(token), user_id FK->users ON DELETE CASCADE,
      created_at, expires_at)
players(user_id PK FK->users ON DELETE CASCADE, data JSON)  -- game data blob
```
Quyết định: security fields quan hệ hóa (role/status/lock/expiry); game-only data
(inventory/pets/skins/achievements/daily/gacha/skills) gộp players.data JSON —
một writer, không cần query quan hệ hôm nay. **Raw session token KHÔNG BAO GIỜ
lưu db** — chỉ lưu SHA-256.

## Migration (E3)
`migrateFromJson()` — idempotent (skip user đã có), preserve password_hash/role/
lock/lock_date/player data, sessions convert raw->hash và skip expired+dangling,
**backup copy** users.json/sessions.json thành *.migrated-<ts>, KHÔNG xóa JSON nguồn.
Corrupt source → báo `stats.corrupt`, không throw, không phá data.

## Store abstraction (E4)
`DatabaseUserStore` + `DatabaseSessionStore` implement đúng interface file store:
createUser/findUser/verifyPassword/updatePassword/deleteUser/listUsers/setRole/
lockUser/resetUser/setMaxUser/_publicUser/createSession/getSession/deleteSession/
deleteAllUserSessions/expireSession/cleanup. `findUser` expose alias camelCase
`passwordHash` để AuthService không đổi. `server.js`: `MATHDRILL_BACKEND=sqlite`
chọn DB backend; mặc định `file` (backward compatible).

## Transactions (E5)
`_inTx()` wrapper BEGIN/COMMIT/ROLLBACK (nested reuse). createUser/lockUser/
resetUser/setMaxUser/updatePassword chạy trong transaction; T11 test rollback
thành công (UNIQUE violation → ROLLBACK khôi phục role).

## Data integrity (E6)
UNIQUE username; CHECK role/status; FK CASCADE → zero orphan sessions/players
(T17 verify); session expiry prune; locked user → sessions revoked ngay (lockUser
xóa sessions); corrupted record không được nâng quyền (role từ CHECK constraint).

## Tests (E7) — server/tests/database.test.js: 20/20 PASS
T01 init, T02 schema, T03 insert, T04 duplicate, T05 lookup, T06 hash roundtrip,
T07 role, T08 player, T09 session hashed (raw token không có trong db file),
T10 expiry, T11 rollback, T12 migration, T13 idempotent, T14 user preserved,
T15 admin preserved, T16 locked preserved, T17 FK cascade, T18 50 writes+20 sessions,
T19 corrupt safe, T20 reopen persistence.

## API contract (E8) — KHÔNG đổi
register/login/me/logout/change-password + admin endpoints chạy nguyên vẹn trên
CẢ HAI backend: file (12+5+10+16) và sqlite (12+5+10+16) — tất cả PASS.

## Test-infra fixes (không weaken assertion)
- auth.test T06 + part3 T26: backend-neutral (đọc users.json nếu có, else mathdrill.db);
  T26 dùng đúng user cpuser mà part3 tạo (trước đây đọc testuser từ run cũ — latent bug).
- Wipe loop thêm mathdrill.db/-shm/-wal + unlinkSync guard try/catch.
- auth.test 39100→port 0, part2 39101→0, part3 39102→0 (ephemeral, hết EADDRINUSE).

## Regression (E9)
- Backend: file 4 suite + sqlite 5 suite = tất cả exit 0 (xác minh 2 backend).
- Web: 7 suite auth/admin/integration × 10 runs = 70/70 (log chạy thật).
- Module M6/M7/M8/M9/M4/Phase1: không bị đụng code — suite regression vẫn xanh.

## Checkpoint
- m10e-database (non-Git SHA-256 manifest, parent m10d-admin-rbac)
