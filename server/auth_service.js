'use strict';

const crypto = require('crypto');

/**
 * AuthService — M10-C business logic.
 * Separated from HTTP layer so M10-E can reuse with database store.
 * 
 * Password hashing: Node crypto.scrypt with random 32-byte salt.
 * Format: scrypt$<saltHex>$<hashHex>
 * 
 * Config should use high cost parameters.
 */
class AuthService {
  constructor(userStore, sessionStore, options) {
    this.userStore = userStore;
    this.sessionStore = sessionStore;
    this.options = options || {};
    this.maxUsernameLen = this.options.maxUsernameLen || 32;
    this.maxPasswordLen = this.options.maxPasswordLen || 128;
    this.minPasswordLen = this.options.minPasswordLen || 1;
  }

  async hashPassword(password) {
    const salt = crypto.randomBytes(32);
    const hash = await new Promise((resolve, reject) => {
      crypto.scrypt(String(password), salt, 64, {
        N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024
      }, (err, derived) => {
        if (err) return reject(err);
        resolve(derived);
      });
    });
    return 'scrypt$' + salt.toString('hex') + '$' + hash.toString('hex');
  }

  async verifyPassword(password, storedHash) {
    if (!storedHash || typeof storedHash !== 'string') return false;
    const parts = storedHash.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
    const salt = Buffer.from(parts[1], 'hex');
    const expected = Buffer.from(parts[2], 'hex');
    return new Promise((resolve, reject) => {
      crypto.scrypt(String(password), salt, expected.length, {
        N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024
      }, (err, derived) => {
        if (err) return reject(err);
        resolve(derived.length === expected.length && crypto.timingSafeEqual(derived, expected));
      });
    });
  }

  validateUsername(username) {
    if (!username || typeof username !== 'string') return 'INVALID_INPUT';
    const u = username.trim();
    if (u.length < 1 || u.length > this.maxUsernameLen) return 'INVALID_INPUT';
    return null;
  }

  validatePassword(password) {
    if (!password || typeof password !== 'string') return 'INVALID_INPUT';
    if (password.length < this.minPasswordLen) return 'INVALID_INPUT';
    if (password.length > this.maxPasswordLen) return 'INVALID_INPUT';
    return null;
  }

  async register(username, password) {
    const uErr = this.validateUsername(username);
    if (uErr) return { ok: false, error: uErr };
    const pErr = this.validatePassword(password);
    if (pErr) return { ok: false, error: pErr };

    const passwordHash = await this.hashPassword(password);
    const result = this.userStore.createUser(username, passwordHash);
    if (!result.ok) return result;

    return { ok: true, user: result.user };
  }

  async login(username, password) {
    const uErr = this.validateUsername(username);
    if (uErr) return { ok: false, error: 'INVALID_CREDENTIALS' };
    const pErr = this.validatePassword(password);
    if (pErr) return { ok: false, error: 'INVALID_CREDENTIALS' };

    const user = this.userStore.findUser(username);
    if (!user) return { ok: false, error: 'INVALID_CREDENTIALS' };

    // game_init.py:4524-4525 — user bị khóa không được login
    if (user.status === 'locked') {
      return { ok: false, error: 'ACCOUNT_LOCKED', lock_date: user.lock_date || null };
    }

    const valid = await this.verifyPassword(password, user.passwordHash);
    if (!valid) return { ok: false, error: 'INVALID_CREDENTIALS' };

    const sessionId = this.sessionStore.createSession(username);
    return { ok: true, user: this.userStore._publicUser(username), sessionId };
  }

  // ===== M10-D: Admin seed (server-side, tương đương game_init.py:4442) =====
  // Python load() pre-create account admin với ADMIN_PASS =
  // os.environ.get("MATHDRILL_ADMIN_PASSWORD", "admin123").
  // Server đọc secret từ environment; KHÔNG có secret nào rơi vào
  // client bundle/API response (mật khẩu chỉ được hash ngay lập tức).
  async ensureAdminUser(adminPassword) {
    const ADMIN_USER = 'admin'; // game_init.py:311
    if (!adminPassword || typeof adminPassword !== 'string' || adminPassword.length < 1) {
      return { ok: false, error: 'INVALID_INPUT' };
    }
    if (this.userStore.findUser(ADMIN_USER)) return { ok: true, seeded: false };
    const hash = await this.hashPassword(adminPassword);
    const created = this.userStore.createUser(ADMIN_USER, hash);
    if (!created.ok) return created;
    this.userStore.setRole(ADMIN_USER, 'admin');
    return { ok: true, seeded: true };
  }

  // M10-D: role lookup theo session — session KHÔNG chứa role
  // (revoke role/session bất kỳ lúc nào cũng có hiệu lực ngay).
  isAdminSession(sessionId) {
    const session = this.sessionStore.getSession(sessionId);
    if (!session) return false;
    const user = this.userStore.findUser(session.username || session.userId);
    return !!(user && (user.role || 'user') === 'admin');
  }

  logout(sessionId) {
    if (sessionId) this.sessionStore.deleteSession(sessionId);
    return { ok: true };
  }

  getSessionUser(sessionId) {
    const session = this.sessionStore.getSession(sessionId);
    if (!session) return null;
    // M10-E: DB session rows carry numeric userId + joined username; file store
    // carries userId==username. Prefer username, fallback numeric id.
    const identity = session.username || session.userId;
    return this.userStore._publicUser(identity);
  }

  async changePassword(sessionId, username, oldPassword, newPassword) {
    const session = this.sessionStore.getSession(sessionId);
    if (!session) return { ok: false, error: 'AUTH_REQUIRED' };
    const owner = session.username || session.userId;
    if (owner !== String(username).trim()) {
      return { ok: false, error: 'AUTH_REQUIRED' };
    }

    const user = this.userStore.findUser(username);
    if (!user) return { ok: false, error: 'AUTH_REQUIRED' };

    const valid = await this.verifyPassword(oldPassword, user.passwordHash);
    if (!valid) return { ok: false, error: 'PASSWORD_MISMATCH' };

    const pErr = this.validatePassword(newPassword);
    if (pErr) return { ok: false, error: pErr };

    const newHash = await this.hashPassword(newPassword);
    this.userStore.updatePassword(username, newHash);
    this.sessionStore.deleteAllUserSessions(owner);

    return { ok: true };
  }
}

module.exports = { AuthService };
