/* =========================================================
   MathDrill Web — M5: AUTH (AccountSystem localStorage — skeleton)
   ---------------------------------------------------------
   Port từ game_init.py (source of truth):
   - hash_password/verify_password (320-336): PBKDF2-HMAC-SHA256,
     100_000 vòng, salt = CHUỖI HEX → dùng salt.encode('utf-8')
     tức ASCII bytes của chuỗi hex. Format:
       'pbkdf2$sha256$100000$<saltHex>$<hexDigest>'
     Web dùng WebCrypto (crypto.subtle) — output phải khớp Python
     100% (test vector do py_reference.py sinh từ source thật).
   - AccountSystem (4386+): SQLite → localStorage [REPLACE] theo
     quyết định plan M1; register (4577-4594), login (4521-4542),
     data() defaults (4482-4520), set_max (4556-4559), save (4472).
   - Session: session.json → mathdrill_session (5275-5299).

   Deviation có chủ đích (ghi trong report):
   1. KHÔNG pre-create tài khoản admin trên web (R3 — client không
      chứa admin password/secret; admin thật ở backend M10).
   2. changePassword: Python AccountSystem THIẾU method này
      (main.py:898 gọi kèm type-ignore → sẽ AttributeError). Web
      bổ sung theo intent của PasswordChangeState (main.py:884-905).
   ========================================================= */
(function (global) {
  'use strict';

  const L = global.GameLogger || {
    info: function () {}, warn: function () {}, error: function () {}
  };
  const Save = global.Save;

  // ===== M10-C: Backend API integration =====
  // Browser (production): LUÔN dùng backend auth qua relative '/api/auth/...'
  //   — KHÔNG automatic fallback về localStorage auth.
  // Node: __M10C_API_BASE không set → legacy localStorage path
  //   (explicit DEV-only switch, disabled by default — chỉ để M5 regression).
  const IS_BROWSER = typeof window !== 'undefined';
  const API_BASE = IS_BROWSER
    ? (window.__M10C_API_BASE || '')            // relative mặc định → backend
    : (globalThis.__M10C_API_BASE || null);     // Node: null → legacy dev path
  const USE_BACKEND = API_BASE !== null;
  const NETWORK_ERROR_MSG = 'Kh\u00f4ng th\u1ec3 k\u1ebft n\u1ed1i m\u00e1y ch\u1ee7. Vui l\u00f2ng th\u1eed l\u1ea1i sau.';

  async function apiFetch(p, body, method) {
    if (!USE_BACKEND) return null;
    const m = method || (body ? 'POST' : 'GET');
    const opt = {
      method: m,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    };
    if (body) opt.body = JSON.stringify(body);
    let r;
    try { r = await fetch(API_BASE + p, opt); }
    catch (err) {
      L.warn('[Auth] API unreachable', p, err && err.message);
      return { status: 0, data: { ok: false, error: 'NETWORK_ERROR' } };
    }
    let data;
    try { data = await r.json(); }
    catch (err) { data = { ok: false, error: 'SERVER_ERROR' }; }
    return { status: r.status, data: data };
  }

  async function backendRegister(username, password) {
    const r = await apiFetch('/api/auth/register', { username: username, password: password });
    const d = r && r.data;
    if (r && r.status === 201 && d && d.ok) return { ok: true, msg: '\u0110\u0103ng k\u00fd th\u00e0nh c\u00f4ng!', user: d.user };
    if (d && d.error === 'USERNAME_TAKEN') return { ok: false, msg: 'T\u00e0i kho\u1ea3n \u0111\u00e3 t\u1ed3n t\u1ea1i!' };
    if (d && d.error === 'INVALID_INPUT') return { ok: false, msg: 'D\u1eef li\u1ec7u kh\u00f4ng h\u1ee3p l\u1ec7!' };
    return { ok: false, msg: NETWORK_ERROR_MSG };
  }

  async function backendLogin(username, password) {
    const r = await apiFetch('/api/auth/login', { username: username, password: password });
    const d = r && r.data;
    if (d && d.error === 'NETWORK_ERROR') return { ok: false, msg: NETWORK_ERROR_MSG };
    if (r && r.status === 200 && d && d.ok) return { ok: true, msg: 'Th\u00e0nh c\u00f4ng', user: d.user };
    return { ok: false, msg: 'Sai t\u00e0i kho\u1ea3n/m\u1eadt kh\u1ea9u' };
  }

  async function backendLogout() {
    await apiFetch('/api/auth/logout', undefined, 'POST');
    return { ok: true };
  }

  async function backendChangePassword(username, oldPw, newPw) {
    const r = await apiFetch('/api/auth/change-password', { username: username, oldPassword: oldPw, newPassword: newPw });
    const d = r && r.data;
    if (d && d.error === 'NETWORK_ERROR') return { ok: false, msg: NETWORK_ERROR_MSG };
    if (r && r.status === 200 && d && d.ok) return { ok: true, msg: '\u0110\u1ed5i m\u1eadt kh\u1ea9u th\u00e0nh c\u00f4ng!' };
    if (d && d.error === 'PASSWORD_MISMATCH') return { ok: false, msg: 'Sai m\u1eadt kh\u1ea9u hi\u1ec7n t\u1ea1i' };
    if (d && d.error === 'AUTH_REQUIRED') return { ok: false, msg: 'Phi\u00ean \u0111\u0103ng nh\u1eadp h\u1ebft h\u1ea1n' };
    if (d && d.error === 'INVALID_INPUT') return { ok: false, msg: 'M\u1eadt kh\u1ea9u m\u1edbi kh\u00f4ng h\u1ee3p l\u1ec7!' };
    return { ok: false, msg: NETWORK_ERROR_MSG };
  }

  async function backendMe() {
    const r = await apiFetch('/api/auth/me');
    if (r && r.status === 200 && r.data && r.data.ok) return r.data.user;
    return null;
  }


  const ITERATIONS = 100000; // game_init.py:325
  const ALGO = 'PBKDF2';
  const HASH = 'SHA-256';
  const BITS = 256; // hashlib.pbkdf2_hmac mặc định dklen = 32 bytes

  function subtle() {
    const c = global.crypto || (typeof crypto !== 'undefined' ? crypto : null);
    if (!c || !c.subtle) {
      throw new Error('WebCrypto (crypto.subtle) không khả dụng — cần HTTPS/localhost hoặc Node >= 15');
    }
    return c.subtle;
  }

  function bytesToHex(buffer) {
    const view = new Uint8Array(buffer);
    let out = '';
    for (let i = 0; i < view.length; i++) {
      out += (view[i] < 16 ? '0' : '') + view[i].toString(16);
    }
    return out;
  }

  // So sánh hex kiểu constant-time (secrets.compare_digest của Python)
  function constantTimeHexEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  // secrets.token_hex(16) → 32 ký tự hex ngẫu nhiên
  function randomSaltHex() {
    const bytes = new Uint8Array(16);
    (global.crypto || crypto).getRandomValues(bytes);
    return bytesToHex(bytes.buffer);
  }

  // game_init.py:320-326 — async vì WebCrypto là async API
  async function hashPassword(password, saltHex) {
    const salt = saltHex || randomSaltHex();
    const enc = new TextEncoder();
    const baseKey = await subtle().importKey('raw', enc.encode(String(password)), ALGO, false, ['deriveBits']);
    const bits = await subtle().deriveBits(
      { name: ALGO, hash: HASH, salt: enc.encode(salt), iterations: ITERATIONS },
      baseKey, BITS
    );
    return 'pbkdf2$sha256$' + ITERATIONS + '$' + salt + '$' + bytesToHex(bits);
  }

  // game_init.py:328-336 verify_password
  async function verifyPassword(password, stored) {
    try {
      const parts = String(stored).split('$');
      if (parts.length !== 5 || parts[0] !== 'pbkdf2') return false;
      const hashname = parts[1]; // 'sha256'
      const iterations = parseInt(parts[2], 10);
      const salt = parts[3];
      const hexdigest = parts[4];
      if (hashname !== 'sha256' || !isFinite(iterations) || iterations <= 0) return false;
      const enc = new TextEncoder();
      const baseKey = await subtle().importKey('raw', enc.encode(String(password)), ALGO, false, ['deriveBits']);
      const bits = await subtle().deriveBits(
        { name: ALGO, hash: HASH, salt: enc.encode(salt), iterations: iterations },
        baseKey, hexdigest.length * 4
      );
      return constantTimeHexEqual(bytesToHex(bits), hexdigest);
    } catch (err) {
      L.error('[Auth] verifyPassword error', err);
      return false;
    }
  }

  // game_init.py:338-339
  function isPasswordHashed(stored) {
    return typeof stored === 'string' && stored.indexOf('pbkdf2$') === 0;
  }

  // Default data dict — mirror game_init.py:4580-4592 (register)
  function defaultUserData(grade) {
    return {
      grade: grade || 1,
      xp: 0,
      level: 1,
      history: [],
      completed_lessons: [],
      mastery_levels: {},
      recent_answers: [],
      streak: 0,
      max_streak: 0,
      energy: 0,
      fever_mode: false,
      flagged_topics: [],
      pet: { type: 'clover', stage: 0, name: 'Cỏ Non' },
      collected_cards: [],
      avatar_path: '',
      gold: 0,
      unlocked_pets: ['clover']
    };
  }

  // =========================================================
  // AccountSystem — game_init.py:4386+ (SQLite → localStorage)
  // Tất cả method trả {ok, msg} (Python trả tuple (bool, str)).
  // login/register/changePassword là ASYNC (WebCrypto).
  // =========================================================
  class AccountSystem {
    constructor() {
      // game_init.py:4409 — accounts load từ storage
      // M10-C backend mode: KHÔNG load accounts từ localStorage
      // (không dùng dữ liệu legacy để authenticate).
      this.accounts = (!USE_BACKEND && Save && Save.load) ? Save.load(Save.KEYS.ACCOUNTS, {}) : {};
      this.currentUser = null; // game_init.py:4410
      // Deviation R3: KHÔNG pre-create admin (Python load() tạo account
      // admin với ADMIN_PASS env — web không chứa admin password ở client).
    }

    _persist() {
      // M10-C backend mode: KHÔNG persist accounts client-side
      // (password/session không bao giờ nằm trong localStorage).
      if (USE_BACKEND) return;
      if (Save && Save.save) Save.save(Save.KEYS.ACCOUNTS, this.accounts);
    }

    // game_init.py:4482-4520 — setdefault từng key như Python
    data() {
      if (!this.currentUser) return {};
      const obj = this.accounts[this.currentUser];
      if (!obj) return {};
      if (!obj.data) {
        obj.data = defaultUserData(1);
      }
      const d = obj.data;
      const defaults = defaultUserData(d.grade || 1);
      Object.keys(defaults).forEach(function (k) {
        if (!(k in d)) d[k] = defaults[k];
      });
      if (!d.pet) d.pet = { type: 'clover', stage: 0, name: 'Cỏ Non' };
      return d;
    }

    // game_init.py:4472-4481 — chỉ persist khi có current_user
    save() {
      if (!this.currentUser) return;
      this._persist();
    }

    // game_init.py:4521-4542 — M10-C: backend branch (KHÔNG fallback)
    async login(u, p) {
      if (USE_BACKEND) {
        const res = await backendLogin(u, p);
        if (res.ok) {
          this.currentUser = (res.user && res.user.username) || String(u).trim();
          this.data(); // init defaults như Python login
        }
        return res;
      }
      if (!(u in this.accounts)) return { ok: false, msg: 'Sai tài khoản/mật khẩu' };
      const userObj = this.accounts[u];
      if (userObj.status === 'locked') {
        return {
          ok: false,
          msg: 'Tài khoản đã bị khóa vào ' + (userObj.lock_date || '') + '.\nLiên hệ Admin để mở.'
        };
      }
      const stored = userObj.password || '';
      let ok = false;
      if (isPasswordHashed(stored)) {
        ok = await verifyPassword(p, stored);
      } else {
        // Legacy plaintext (dữ liệu cũ) — verify rồi nâng cấp lên hash
        ok = (stored === p);
        if (ok) {
          userObj.password = await hashPassword(p);
          this._persist();
        }
      }
      if (ok) {
        this.currentUser = u;
        // Python: if u == ADMIN_USER: self.set_max(u) — web KHÔNG auto set_max
        // (không có admin client-side; setMax chỉ gọi tường minh, xem M10).
        this.data(); // init defaults như Python login
        return { ok: true, msg: 'Thành công' };
      }
      return { ok: false, msg: 'Sai tài khoản/mật khẩu' };
    }

    // game_init.py:4577-4594 — M10-C: backend branch
    async register(username, password, grade) {
      if (USE_BACKEND) return backendRegister(username, password);
      if (!username || !password) return { ok: false, msg: 'Không được để trống!' };
      if (username in this.accounts) return { ok: false, msg: 'Tài khoản đã tồn tại!' };
      this.accounts[username] = {
        password: await hashPassword(password),
        status: 'active',
        createdAt: new Date().toISOString(),
        data: defaultUserData(grade)
      };
      this._persist();
      return { ok: true, msg: 'Đăng ký thành công!' };
    }

    // Python AccountSystem THIẾU method này (main.py:898 + type-ignore).
    // Bổ sung theo intent PasswordChangeState (main.py:884-905):
    // verify old → hash new → persist.
    // M10-C: backend branch — dùng session cookie, KHÔNG localStorage.
    async changePassword(username, oldPw, newPw) {
      if (USE_BACKEND) return backendChangePassword(username, oldPw, newPw);
      if (!(username in this.accounts)) return { ok: false, msg: 'Sai mật khẩu hiện tại' };
      const userObj = this.accounts[username];
      const stored = userObj.password || '';
      let okOld = false;
      if (isPasswordHashed(stored)) okOld = await verifyPassword(oldPw, stored);
      else okOld = (stored === oldPw);
      if (!okOld) return { ok: false, msg: 'Sai mật khẩu hiện tại' };
      if (!newPw) return { ok: false, msg: 'Mật khẩu mới không được để trống!' };
      userObj.password = await hashPassword(newPw);
      this._persist();
      return { ok: true, msg: 'Đổi mật khẩu thành công!' };
    }

    // game_init.py:4556-4559 (admin) — chỉ gọi tường minh, không auto
    setMax(username) {
      if (!(username in this.accounts)) return;
      const d = this.accounts[username].data || (this.accounts[username].data = {});
      d.level = 9999;
      d.xp = 9800;
      this._persist();
    }

    // game_init.py:4543-4546
    lockUser(username) {
      if (!(username in this.accounts)) return;
      this.accounts[username].status = 'locked';
      this.accounts[username].lock_date = new Date().toLocaleString('vi-VN');
      this._persist();
    }

    // Python LogoutState (main.py:706-710): current_user = None
    // M10-C backend: POST /api/auth/logout → server xoá session + clear cookie.
    // apiFetch không bao giờ reject (bắt network error nội bộ) → không unhandled rejection.
    async logout() {
      if (USE_BACKEND) await apiFetch('/api/auth/logout', undefined, 'POST');
      this.currentUser = null;
    }

    // M10-C: GET /api/auth/me — session hiện tại từ cookie.
    // 401 / không session → currentUser = null.
    async me() {
      if (!USE_BACKEND) return this.currentUser;
      const user = await backendMe();
      this.currentUser = user ? (user.username || null) : null;
      return user;
    }
  }

  AccountSystem.hashPassword = hashPassword;
  AccountSystem.verifyPassword = verifyPassword;
  AccountSystem.isPasswordHashed = isPasswordHashed;

  global.AccountSystem = AccountSystem;
  global.hashPassword = hashPassword;
  global.verifyPassword = verifyPassword;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      AccountSystem: AccountSystem,
      hashPassword: hashPassword,
      verifyPassword: verifyPassword,
      isPasswordHashed: isPasswordHashed
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);

