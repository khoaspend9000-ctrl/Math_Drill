'use strict';

const fs = require('fs');
const path = require('path');

/**
 * UserStore — M10-C file-based store.
 * M10-E will replace with DatabaseStore implementing the same interface.
 * 
 * Interface:
 *   createUser(username, passwordHash) -> { ok, user, error }
 *   findUser(username) -> { username, passwordHash, createdAt, data } | null
 *   verifyPassword(username, passwordHashFn) -> bool
 *   updatePassword(username, newPasswordHash) -> { ok, error }
 *   deleteUser(username) -> void
 */
class UserStore {
  constructor(options) {
    options = options || {};
    this.filePath = options.filePath || path.join(__dirname, 'users.json');
    this.users = Object.create(null);
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this._load();
  }

  createUser(username, passwordHash) {
    if (!username || typeof username !== 'string') {
      return { ok: false, error: 'INVALID_INPUT' };
    }
    const u = username.trim();
    if (u.length < 1 || u.length > 32) {
      return { ok: false, error: 'INVALID_INPUT' };
    }
    if (u in this.users) {
      return { ok: false, error: 'USERNAME_TAKEN' };
    }
    const user = {
      username: u,
      passwordHash: String(passwordHash),
      role: 'user', // M10-D: role server-side authority
      createdAt: new Date().toISOString(),
      data: Object.create(null)
    };
    this.users[u] = user;
    this._save();
    return { ok: true, user: this._publicUser(u) };
  }

  findUser(username) {
    if (!username) return null;
    const u = String(username).trim();
    return this.users[u] || null;
  }

  verifyPassword(username, passwordHash) {
    const user = this.findUser(username);
    if (!user) return false;
    return user.passwordHash === String(passwordHash);
  }

  updatePassword(username, newPasswordHash) {
    const user = this.findUser(username);
    if (!user) return { ok: false, error: 'AUTH_REQUIRED' };
    user.passwordHash = String(newPasswordHash);
    this._save();
    return { ok: true };
  }

  deleteUser(username) {
    const u = String(username).trim();
    if (u in this.users) {
      delete this.users[u];
      this._save();
    }
  }

  _publicUser(username) {
    const u = this.users[username];
    if (!u) return null;
    return {
      username: u.username,
      role: u.role || 'user', // M10-D: role từ server-side record
      createdAt: u.createdAt,
      data: u.data
    };
  }

  // ===== M10-D: Admin operations (server-side authority) =====
  // Port admin_panel.py AdminAccountMixin: lock_user/reset_user/set_max.
  // change_grade không có trong AdminPanelState UI → không tạo endpoint.

  listUsers() {
    const out = [];
    for (const [k, u] of Object.entries(this.users)) {
      const d = u.data || {};
      out.push({
        username: u.username,
        role: u.role || 'user',
        status: u.status || 'active',
        lock_date: u.lock_date || null,
        grade: d.grade || 1,
        level: d.level || 1,
        xp: d.xp || 0
      });
    }
    return out;
  }

  setRole(username, role) {
    const user = this.findUser(username);
    if (!user) return { ok: false, error: 'AUTH_REQUIRED' };
    if (role !== 'user' && role !== 'admin') return { ok: false, error: 'INVALID_INPUT' };
    user.role = role;
    this._save();
    return { ok: true };
  }

  // admin_panel.py:101-107
  lockUser(username) {
    const user = this.findUser(username);
    if (!user) return { ok: false, error: 'AUTH_REQUIRED' };
    user.status = 'locked';
    user.lock_date = new Date().toLocaleString('vi-VN');
    this._save();
    return { ok: true };
  }

  // admin_panel.py:109-112 (game_init.py:4547-4549) — đúng 3 field
  resetUser(username) {
    const user = this.findUser(username);
    if (!user) return { ok: false, error: 'AUTH_REQUIRED' };
    user.data = Object.assign(Object.create(null), { grade: 1, level: 1, xp: 0 });
    this._save();
    return { ok: true };
  }

  // admin_panel.py:120-128 (game_init.py:4556-4558)
  setMaxUser(username) {
    const user = this.findUser(username);
    if (!user) return { ok: false, error: 'AUTH_REQUIRED' };
    if (!user.data) user.data = Object.create(null);
    user.data.level = 9999;
    user.data.xp = 9800;
    this._save();
    return { ok: true };
  }

  _save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.users, null, 2), 'utf8');
    } catch (e) {
      // Non-fatal: in-memory still works
    }
  }

  _load() {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        for (const [k, v] of Object.entries(data)) {
          if (v && v.passwordHash) this.users[k] = v;
        }
      }
    } catch (e) {
      // Non-fatal: start fresh
    }
  }
}

module.exports = { UserStore };
