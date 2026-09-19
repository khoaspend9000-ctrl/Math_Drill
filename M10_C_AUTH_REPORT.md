# M10-C Backend Auth Report (2026-09-12)

## 1. Backend Stack

- **Runtime:** Node.js v24.20.0 (native)
- **HTTP:** Native `http` module (no framework)
- **Password Hashing:** `crypto.scrypt` (N=16384, r=8, p=1, 32-byte salt, 64-byte key)
- **Session IDs:** `crypto.randomBytes(32)` → 64-char hex
- **User Store:** JSON file (`server/data/users.json`) — M10-C temporary, M10-E replaceable
- **Session Store:** JSON file (`server/data/sessions.json`) — M10-C temporary, M10-E replaceable

## 2. Architecture

```
server/
  server.js         - HTTP server + routing + cookie handling
  auth_service.js   - Auth business logic (hash, verify, register, login, changePassword)
  user_store.js     - User persistence (JSON file, replaceable interface)
  session_store.js  - Session management (JSON file, replaceable interface)
  package.json      - Server dependencies (none — native only)
  data/             - Runtime data (users.json, sessions.json)
  tests/
    auth.test.js       - T01-T12 (register, login, cookie, validation)
    auth_part2.test.js - T13-T17 (session, logout, expiry)
    auth_part3.test.js - T18-T27 (change password, security, stress)
```

## 3. Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/register | No | Create account, return safe user |
| POST | /api/auth/login | No | Verify credentials, set session cookie |
| POST | /api/auth/logout | Yes | Invalidate session, clear cookie |
| GET | /api/auth/me | Yes | Return current user from session |
| POST | /api/auth/change-password | Yes | Verify old, set new, invalidate sessions |

## 4. Request/Response Contract

**Success:**
```json
{ "ok": true, "user": { "username": "...", "createdAt": "...", "data": {} } }
```

**Failure:**
```json
{ "ok": false, "error": "ERROR_CODE" }
```

**Error Codes:** `AUTH_REQUIRED`, `INVALID_CREDENTIALS`, `USERNAME_TAKEN`, `INVALID_INPUT`, `SESSION_EXPIRED`, `PASSWORD_MISMATCH`, `SERVER_ERROR`, `NOT_FOUND`

## 5. Password Hashing

- Algorithm: scrypt (Node crypto native)
- Parameters: N=16384, r=8, p=1, maxmem=32MB
- Salt: 32 random bytes
- Key length: 64 bytes
- Format: `scrypt$<saltHex>$<hashHex>`
- Never stored in plaintext
- Never sent to client

## 6. Session Design

- Opaque random ID (256-bit from crypto.randomBytes)
- HttpOnly cookie (not accessible from JS)
- SameSite=Lax
- Secure flag in production (NODE_ENV=production)
- 24-hour TTL
- Automatic expiry cleanup

## 7. Cookie Attributes

```
Set-Cookie: mathdrill_session=<64hex>; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400
```

## 8. User Store (M10-C Temporary)

**Interface (replaceable in M10-E):**
- `createUser(username, passwordHash)` → `{ ok, user, error }`
- `findUser(username)` → `{ username, passwordHash, createdAt, data } | null`
- `verifyPassword(username, passwordHash)` → bool
- `updatePassword(username, newPasswordHash)` → `{ ok, error }`
- `deleteUser(username)` → void

**Persistence:** Atomic JSON file writes. Directory auto-created.

## 9. Frontend Changes

**M10-C does NOT modify `web/js/auth.js`.** The client-side AccountSystem remains as fallback for offline/dev mode. Frontend integration with the backend API is deferred to a future milestone when the full stack is ready.

This ensures:
- No regression in existing gameplay tests
- Clean separation between M10-C (backend) and future frontend integration

## 10. Security Tests

| Test | Coverage |
|------|----------|
| T06 | Password stored as scrypt hash, never plaintext |
| T09 | Login failure does NOT reveal which field was wrong |
| T10 | Session cookie is 64-char hex |
| T11 | Cookie has HttpOnly flag |
| T12 | Cookie has SameSite=Lax |
| T17 | Expired session is rejected |
| T22 | Malformed JSON returns 400 |
| T24 | Password/hash never in response body |
| T25 | Session ID never in JSON response |
| T27 | 5x repeated login/logout cycles |

## 11. HTTP Integration Tests

All 27 tests use real HTTP requests (not unit tests):
- Server starts on localhost
- Tests send actual HTTP requests with cookies
- Tests inspect real response headers and bodies
- Server stopped after each test suite

## 12. Regression Results

**Backend tests (M10-C):**
- Part 1 (T01-T12): 12/12 PASS
- Part 2 (T13-T17): 5/5 PASS
- Part 3 (T18-T27): 10/10 PASS
- **Total: 27/27 PASS**

**Frontend regression (existing tests):**
- phase1_foundation.test.js: PASS
- m4_states.test.js: PASS
- m5_player_save.test.js: 10/10 PASS
- m10a_browser_load.test.js: 16/16 PASS
- m10b_states_menu.test.js: 44/44 PASS
- m9_final_integration.test.js: 10/10 PASS

## 13. Browser Validation

**UNAVAILABLE** — no browser automation in this environment.
Frontend integration smoke test deferred.

## 14. Limitations

- No frontend integration (auth.js unchanged)
- No admin/M10-D
- No database/M10-E
- No security headers/M10-F
- No rate limiting/M10-G
- No GDPR/M10-H
- User store is file-based (not production-ready)
- Session store is file-based (not production-ready)

## 15. Deferred Work

| Milestone | Task |
|-----------|------|
| M10-D | Admin panel, server-side RBAC |
| M10-E | Database layer (replace UserStore/SessionStore) |
| M10-F | Security headers, XSS hardening |
| M10-G | Rate limiting |
| M10-H | GDPR compliance |
| DONE | Frontend auth.js → backend API integration (M10-C FULL) |

## 16. Test Counts

| Suite | Tests | Result |
|-------|-------|--------|
| auth.test.js (T01-T12) | 12 | PASS |
| auth_part2.test.js (T13-T17) | 5 | PASS |
| auth_part3.test.js (T18-T27) | 10 | PASS |
| **Total M10-C** | **27** | **PASS** |
| Existing web tests | 95+ | PASS |

## 17. Next Task

M10-D: Admin panel with server-side RBAC.

## 18. M10-C FRONTEND INTEGRATION GATE (FINAL — 2026-09-13)

**M10-C = FULL PASS**

### Frontend (web/js/auth.js — backend mode)
- Browser (production): LUÔN dùng backend qua relative /api/auth/... — KHÔNG automatic fallback.
- Node: legacy localStorage path chỉ khi __M10C_API_BASE không set (explicit DEV-only switch, disabled by default — giữ M5 regression).
- login/register/changePassword/logout/me: backend branch trước, không fallback khi server fail.
- Backend mode: KHÔNG load/persist accounts vào localStorage (password/session không bao giờ nằm client-side).

### Bug đã sửa
- POST /api/auth/logout bị gọi bằng GET (apiFetch mặc định body→POST/GET) → session không bị xoá.
  Fix: apiFetch nhận method param; backendLogout + AccountSystem.logout gọi POST.

### Frontend integration test — web/tests/m10c_auth_frontend.test.js
- **22/22 PASS** (T01–T22): register, duplicate, login, invalid login,
  cookie HttpOnly/SameSite=Lax/Path=/, me auth/unauth, logout, me sau logout 401,
  change password, old fail, new works, no password/hash/salt/sessionId trong response,
  localStorage không chứa password/token, server unavailable KHÔNG fallback,
  repeated login/logout consistency.
- Backend thật (ephemeral port) + cookie-jar fetch (browser primitive mock).

### Security scan auth.js
- localStorage/sessionStorage mentions: chỉ comment; KHÔNG persist password/hash/session.
- Fallback: KHÔNG có automatic fallback (chỉ comment cấm).

### Regression (sau frontend integration)
- **25 suites × 10 runs = 250/250 PASS** (0 failure, 0 intermittent).

### Browser
BROWSER VALIDATION UNAVAILABLE (không có automation trong environment).

### Storage contract
- Không plaintext password • Không session token • Không auth fallback trong localStorage.
