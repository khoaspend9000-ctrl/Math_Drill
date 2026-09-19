# M10-D — ADMIN + SERVER-SIDE RBAC — VERIFICATION REPORT

> Trạng thái: **PASS** (re-verified 2026-09-14T14:50Z + minimal fix của test client).
> Gate đóng lại sau khi sửa regression tương tác với M10-F (xem §5).

---

## 1. Role model (server-side authority duy nhất)

- User mặc định `role = 'user'` — `server/user_store.js:41` (`createUser`).
- `role` được lưu **server-side** trong user record (`user_store`, hoặc bảng `users` ở backend sqlite).
- Session (cookie `mathdrill_session`) chỉ chứa id/username của session — **KHÔNG chứa role**.
- Mỗi request quyết định admin bằng cách **lookup lại user record** (`AuthService.isAdminSession` → `userStore.findUser` → `(user.role||'user')==='admin'`), nên việc revoke role/session có hiệu lực tức thời.

## 2. Server guards

- `requireAuth` (tại `handleAdmin`, `server/server.js`): `authService.getSessionUser(sessionId)` — không có session / session hết hạn → **401 AUTH_REQUIRED**.
- `requireAdmin`: `(user.role||'user') !== 'admin'` → **403 FORBIDDEN**.
- CSRF defense-in-depth (M10-F F7): request có `Origin` cross-origin với `Host` → **403 CROSS_ORIGIN_FORBIDDEN**.
- Content-type (M10-F F3): POST với body không phải `application/json` → **415**.

## 3. Admin endpoints (`/api/admin/*`) — tất cả đều qua requireAuth + requireAdmin

| Endpoint | Method | Chức năng | Ghi chú |
|----------|--------|-----------|---------|
| `/api/admin/me` | GET | trả `{ok, username, role:'admin'}` | |
| `/api/admin/users` | GET | list user (username/role/status/grade/level/xp) | adminAudit list_users |
| `/api/admin/set-max` | POST | `setMaxUser(target)` | chỉ đọc target username từ body |
| `/api/admin/lock-user` | POST | `lockUser(target)` | |
| `/api/admin/reset-user` | POST | `resetUser(target)` | |

- Body POST của admin hành động **chỉ chứa target username**; `role`/`is_admin`/`isAdmin` trong body bị bỏ qua hoàn toàn — không trở thành nguồn quyền.
- Chỉ expose đúng 3 hành động mà `admin_panel.py` có (set_max / lock / reset). Không tự tạo thêm endpoint.

## 4. Client (frontend)

- Client **không tự quyết định** `is_admin`/`role`/`admin`/admin password.
- `AdminPanelState` chỉ gọi `/api/admin/me` và render kết quả từ server (200 mở panel, 403 denied).
- Admin screen **không hiển thị** dựa trên localStorage role / query string / hidden flag: đã scan, không có `localStorage`/`sessionStorage` đọc role/is_admin.
- KHÔNG có ADMIN_PASSWORD hay tên env-var `MATHDRILL_ADMIN_PASSWORD` trong bất kỳ file nào của `web/` (frontend test T09 PASS).
- Secret admin chỉ tồn tại **server-side** (`server/server.js:320` `process.env.MATHDRILL_ADMIN_PASSWORD || 'admin123'` dev-fallback, `server/auth_service.js:106` `ensureAdminUser`); mật khẩu chỉ được hash ngay rồi lưu user record — không có plaintext trong API/log.
- Audit log (`adminAudit`) + `console.log` server KHÔNG ghi secret/password/hash/salt/session id (T08/T14 PASS).

## 5. Tìm thấy khi verify + fix tối thiểu

M10-D gate ban đầu **KHÔNG PASS* ở trạng thái hiện tại — regression do **M10-F F3** ép mọi POST phải có `Content-Type: application/json`, nhưng 2 helper test M10-D (`makeJarFetch` trong `server/tests/admin_rbac.test.js` và `web/tests/m10d_admin.test.js`) không gửi header đó → login POST trả **415** → admin_rbac 4/16 FAIL (T01/T02/T10/T11), m10d_admin 4/11 FAIL (T04/T05/T06/T07).

- Server behavior là **đúng** (M10-F hardening); production client (`web/js/auth.js:48`, `states_real.js:1446`) và 5 helper khác (`auth.test.js`, `auth_part2/3`, `auth_frontend`, `security_hardening`) vốn set header vô điều kiện.
- Fix: helper `makeJarFetch` set `Content-Type: application/json` trên mọi POST (kể cả không body). **KHÔNG sửa assertion, KHÔNG nới lỏng logic, KHÔNG đổi server.**

## 6. Test count sau fix

| Suite | Kết quả |
|-------|---------|
| `server/tests/admin_rbac.test.js` (T01–T16) | **16/16 PASS** (T01 no-session→401, T02 non-admin→403, T03 admin→200, T04–T07 tampering vẫn 403/401, T08 no secret trong response, T09 no secret trong frontend source, T10 session required, T11 logout→401, T12 expired→401, T13 arbitrary username not admin, T14 audit không leak, T15 set-max, T16 lock-user) |
| `web/tests/m10d_admin.test.js` (T01–T11) | **11/11 PASS** (panel tồn tại, lifecycle, denied khi 403, admin mở panel + load users, set-max áp dụng, lock áp dụng, user session→403, back, update timer, exit, draw) |
| Độ ổn định | mỗi suite **3 lần chạy liên tiếp, đều exit=0** |

## 7. Regression (list Pha 10 — toàn bộ exit=0)

admin_rbac 16/16 · m10d 11/11 · m10c_auth_frontend 22/22 · m10a_browser_load 16/16 · m10b_states_menu PASS · m9_final 10/10 · m9f 28/28 · m9e 23/23 · m9d 18/18 · m9c 14/14 · m9b 23/23 · m9a 18/18 · m8d 10/10 · m8c 18/18 · m8b 14/14 · m8a 20/20 · m7d 14/14 · m7c 11/11 · m7b 16/16 · m7a 25/25 · m6 11/11 · m6b_mt19937 12/12 · m6b_vectors OK · m6b_safety_guard OK · m5 10/10 · m4 15/15 · phase1 10/10

## 8. Browser

**BROWSER VALIDATION UNAVAILABLE** (không có automation tool) — không giả PASS.

## 9. Known limitations (ngoài scope M10-D)

- `server/tests/security_hardening.test.js` (M10-F) bị **TRUNCATED**: SyntaxError "Unexpected end of input", kết thúc giữa T05, thiếu T06–T20 và phần đóng `main()`/summary. Thuộc check-point M10-F; KHÔNG nằm trong scope này (Phase 10 list không gồm suite này).
- `web/tests/m10b_state_integration.test.js` (M10-B) có 4 FAIL pre-existing (T02–T05) nhưng **self-exit=0** và không nằm trong Pha 10 list.

## 10. Files thay đổi trong fix này

| File | SHA-256 |
|------|---------|
| `server/tests/admin_rbac.test.js` | `e5408c1e533a4b0ef727ed17301d71c631a29cf2564835746973399b66d479d0` |
| `web/tests/m10d_admin.test.js` | `2bd40c4d6c5d693d831f22ae47b1cc6f3fde193bc79df01c9e64c7abdab25f92` |
| `web/CHECKPOINTS.md` | (checkpoint `m10d-admin-rbac-fix` thêm) |

KHÔNG chạm: `server.js`, `auth_service.js`, `user_store.js`, `session_store.js`, `database.js`, Python source.