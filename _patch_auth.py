import io

path = r"E:\lam_game_2026\web\js\auth.js"
t = io.open(path, encoding="utf-8").read()

# Insert backend API helpers after the IIFE opening
marker = "  const Save = global.Save;\n"
insert = """
  // ===== M10-C: Backend API integration =====
  // In browser with __M10C_API_BASE set: use backend API (fetch with credentials)
  // In Node/tests/no backend: use localStorage (original behavior)
  const API_BASE = (typeof window !== 'undefined' && window.__M10C_API_BASE) || '';

  function apiFetch(p, body) {
    if (!API_BASE) return null;
    return fetch(API_BASE + p, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) { return r.json(); });
  }

  function backendRegister(username, password) {
    return apiFetch('/api/auth/register', { username: password ? username : username, password: password })
      .then(function (res) {
        if (res && res.ok) return { ok: true, msg: '\\u0102\\u0103ng k\\u00fd th\\u00e0nh c\\u00f4ng!' };
        if (res && res.error === 'USERNAME_TAKEN') return { ok: false, msg: 'T\\u00e0i kho\\u1ea3n \\u0103\\u00e3 t\\u1ed3n t\\u1ea1i!' };
        return { ok: false, msg: 'L\\u1ed7i \\u0103\\u00e3ng k\\u00fd' };
      });
  }

  function backendLogin(username, password) {
    return apiFetch('/api/auth/login', { username: username, password: password })
      .then(function (res) {
        if (res && res.ok) return { ok: true, msg: 'Th\\u00e0nh c\\u00f4ng', user: res.user };
        return { ok: false, msg: 'Sai t\\u00e0i kho\\u1ea3n/m\\u1eadt kh\\u1ea9u' };
      });
  }

  function backendLogout() {
    return apiFetch('/api/auth/logout').then(function () {});
  }

  function backendChangePassword(username, oldPw, newPw) {
    return apiFetch('/api/auth/change-password', { username: username, oldPassword: oldPw, newPassword: newPw })
      .then(function (res) {
        if (res && res.ok) return { ok: true, msg: '\\u0102\\u0103\\u1ed5i m\\u1eadt kh\\u1ea9u th\\u00e0nh c\\u00f4ng!' };
        if (res && res.error === 'PASSWORD_MISMATCH') return { ok: false, msg: 'Sai m\\u1eadt kh\\u1ea9u hi\\u1ec7n t\\u1ea1i' };
        return { ok: false, msg: 'L\\u1ed7i \\u0103\\u0103\\u1ed5i m\\u1eadt kh\\u1ea9u' };
      });
  }

"""
t = t.replace(marker, marker + insert, 1)

# Modify register() to use backend when available
old_register = "    async function register(username, password, grade) {\n      if (!username || !password) return { ok: false, msg: 'Không được để trống!' };\n      if (username in this.accounts) return { ok: false, msg: 'Tài khoản đã tồn tại!' };"
new_register = "    async function register(username, password, grade) {\n      if (!username || !password) return { ok: false, msg: 'Không \\u0103\\u103\\u1ec3 tr\\u1ed1ng!' };\n      if (API_BASE) return backendRegister(username, password);\n      if (username in this.accounts) return { ok: false, msg: 'T\\u00e0i kho\\u1ea3n \\u0103\\u00e3 t\\u1ed3n t\\u1ea1i!' };"
t = t.replace(old_register, new_register, 1)

# Modify login() to use backend when available
old_login = "    async function login(username, password) {\n      if (!username || !password) return { ok: false, msg: 'Không được để trống!' };\n      if (!(username in this.accounts)) return { ok: false, msg: 'Sai tài khoản/mật khẩu' };"
new_login = "    async function login(username, password) {\n      if (!username || !password) return { ok: false, msg: 'Kh\\u00f4ng \\u0103\\u0103\\u1ec3 tr\\u1ed1ng!' };\n      if (API_BASE) return backendLogin(username, password).then(function (res) { if (res.ok) currentUserRef().currentUser = username; return res; });\n      if (!(username in this.accounts)) return { ok: false, msg: 'Sai t\\u00e0i kho\\u1ea3n/m\\u1eadt kh\\u1ea9u' };"
t = t.replace(old_login, new_login, 1)

# Modify logout() to use backend when available
old_logout = "    logout() {\n      this.currentUser = null;\n    }"
new_logout = "    logout() {\n      if (API_BASE) backendLogout();\n      currentUserRef().currentUser = null;\n    }"
t = t.replace(old_logout, new_logout, 1)

# Modify changePassword() to use backend when available
old_cp = "    async function changePassword(username, oldPw, newPw) {\n      if (!(username in this.accounts)) return { ok: false, msg: 'Sai mật khẩu hiện tại' };"
new_cp = "    async function changePassword(username, oldPw, newPw) {\n      if (API_BASE) return backendChangePassword(username, oldPw, newPw);\n      if (!(username in this.accounts)) return { ok: false, msg: 'Sai m\\u1eadt kh\\u1ea9u hi\\u1ec7n t\\u1ea1i' };"
t = t.replace(old_cp, new_cp, 1)

# Add currentUserRef helper at the top of the class
old_class = "class AccountSystem {\n    constructor() {\n      this.accounts = loadAccounts();\n      this.currentUser = null;"
new_class = "class AccountSystem {\n    constructor() {\n      this.accounts = loadAccounts();\n      this.currentUser = null;\n    }\n\n    _currentUserRef() { return this; }\n\n    static currentUserRef() { return null; }\n\n    currentUserRef() { return this; }"
t = t.replace(old_class, new_class, 1)

# Fix the currentUserRef usage in login
t = t.replace(
  "if (res.ok) currentUserRef().currentUser = username;",
  "if (res.ok) { const self = this; self.currentUser = username; }",
  1
)
t = t.replace(
  "if (API_BASE) backendLogout();\n      currentUserRef().currentUser = null;",
  "if (API_BASE) backendLogout();\n      this.currentUser = null;",
  1
)

io.open(path, 'w', encoding='utf-8').write(t)
print("Patched auth.js:", len(t), "bytes")
print("API_BASE occurrences:", t.count("API_BASE"))
print("backendRegister occurrences:", t.count("backendRegister"))
print("backendLogin occurrences:", t.count("backendLogin"))
print("backendLogout occurrences:", t.count("backendLogout"))
print("backendChangePassword occurrences:", t.count("backendChangePassword"))
