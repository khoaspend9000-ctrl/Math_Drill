'use strict';

/**
 * M10-E — SQLite-backed persistence (node:sqlite, zero external dependency).
 *
 * Preserves the exact UserStore/SessionStore interface used by server.js and
 * AuthService (E4): callers do not change.
 *
 * Schema (E2, normalized):
 *   users(id INTEGER PK, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
 *         role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
 *         status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','locked')),
 *         lock_date TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)
 *   sessions(id_hash TEXT PK, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 *         created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)
 *   players(user_id INTEGER PK REFERENCES users(id) ON DELETE CASCADE,
 *         data TEXT NOT NULL)  -- JSON blob for game-specific fields
 *
 * Decisions (E2):
 *  - security fields stay relational (role/status/lock on users; expiry on sessions)
 *  - game-only data (inventory, pets, skins, achievements, daily, gacha, skills...)
 *    lives in players.data JSON: single writer, no relational queries needed today
 *  - session rows store SHA-256(token); raw token never persisted
 *  - foreign keys ON DELETE CASCADE prevents orphan sessions/players (E6)
 */

const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA_SQL = [
  "CREATE TABLE IF NOT EXISTS users (\n" +
  "  id INTEGER PRIMARY KEY AUTOINCREMENT,\n" +
  "  username TEXT NOT NULL UNIQUE,\n" +
  "  password_hash TEXT NOT NULL,\n" +
  "  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),\n" +
  "  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','locked')),\n" +
  "  lock_date TEXT,\n" +
  "  created_at TEXT NOT NULL,\n" +
  "  updated_at TEXT NOT NULL\n);",
  "CREATE TABLE IF NOT EXISTS sessions (\n" +
  "  id_hash TEXT PRIMARY KEY,\n" +
  "  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n" +
  "  created_at INTEGER NOT NULL,\n" +
  "  expires_at INTEGER NOT NULL\n);",
  "CREATE TABLE IF NOT EXISTS players (\n" +
  "  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,\n" +
  "  data TEXT NOT NULL\n);",
  "CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);",
  "CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);"
].join('\n');

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex');
}

class DatabaseUserStore {
  constructor(options) {
    options = options || {};
    this.filePath = options.filePath || path.join(__dirname, 'data', 'mathdrill.db');
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.db = new DatabaseSync(this.filePath);
    this.db.exec('PRAGMA foreign_keys = ON;');
    // WAL + busy timeout: tolerate concurrent handles (server + test/migration)
    // without SQLITE_BUSY races; commits stay durable across restarts.
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    this.db.exec(SCHEMA_SQL);
    this._stmtCache = new Map();
  }

  _stmt(sql) {
    if (!this._stmtCache.has(sql)) this._stmtCache.set(sql, this.db.prepare(sql));
    return this._stmtCache.get(sql);
  }

  _inTx(fn) {
    // E5: transaction wrapper; nested calls reuse outer transaction.
    if (this._inTxFlag) return fn();
    this._inTxFlag = true;
    this.db.exec('BEGIN');
    try {
      const out = fn();
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      try { this.db.exec('ROLLBACK'); } catch (_) { /* already rolled back */ }
      throw e;
    } finally {
      this._inTxFlag = false;
    }
  }

  createUser(username, passwordHash, extra) {
    extra = extra || {};
    if (!username || typeof username !== 'string') return { ok: false, error: 'INVALID_INPUT' };
    const u = username.trim();
    if (u.length < 1 || u.length > 32) return { ok: false, error: 'INVALID_INPUT' };
    const now = new Date().toISOString();
    try {
      return this._inTx(() => {
        const info = this._stmt(
          'INSERT INTO users (username, password_hash, role, status, lock_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(u, String(passwordHash), extra.role || 'user', extra.status || 'active', extra.lock_date || null, now, now);
        const id = Number(info.lastInsertRowid);
        if (extra.data) {
          this._stmt('INSERT INTO players (user_id, data) VALUES (?, ?)')
            .run(id, JSON.stringify(extra.data));
        }
        return { ok: true, user: this._publicUser(u) };
      });
    } catch (e) {
      if (/UNIQUE constraint failed/i.test(String(e.message))) return { ok: false, error: 'USERNAME_TAKEN' };
      return { ok: false, error: 'DB_ERROR' };
    }
  }

  findUser(username) {
    if (!username) return null;
    const row = this._stmt('SELECT * FROM users WHERE username = ?').get(String(username).trim());
    if (!row) return null;
    // AuthService contract uses camelCase passwordHash (file-store schema);
    // expose it as an alias so business logic stays storage-agnostic (E4).
    row.passwordHash = row.password_hash;
    return row;
  }

  verifyPassword(username, passwordHash) {
    const user = this.findUser(username);
    if (!user) return false;
    return user.password_hash === String(passwordHash);
  }

  updatePassword(username, newPasswordHash) {
    const user = this.findUser(username);
    if (!user) return { ok: false, error: 'AUTH_REQUIRED' };
    this._inTx(() => {
      this._stmt("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
        .run(String(newPasswordHash), new Date().toISOString(), user.id);
    });
    return { ok: true };
  }

  deleteUser(username) {
    const user = this.findUser(username);
    if (!user) return { ok: false, error: 'AUTH_REQUIRED' };
    this._inTx(() => {
      // players/sessions rows cascade (foreign_keys=ON)
      this._stmt('DELETE FROM users WHERE id = ?').run(user.id);
    });
    return { ok: true };
  }

  getUserData(username) {
    const user = this.findUser(username);
    if (!user) return null;
    const row = this._stmt('SELECT data FROM players WHERE user_id = ?').get(user.id);
    if (!row) return null;
    try { return JSON.parse(row.data); } catch (e) { return null; }
  }

  setUserData(username, data) {
    const user = this.findUser(username);
    if (!user) return { ok: false, error: 'AUTH_REQUIRED' };
    this._inTx(() => {
      this._stmt('INSERT INTO players (user_id, data) VALUES (?, ?) ' +
        'ON CONFLICT(user_id) DO UPDATE SET data = excluded.data')
        .run(user.id, JSON.stringify(data || {}));
    });
    return { ok: true };
  }

  _publicUser(username) {
    const user = this.findUser(username);
    if (!user) return null;
    const data = this.getUserData(username) || Object.create(null);
    return {
      username: user.username,
      role: user.role || 'user',
      createdAt: user.created_at,
      data: data
    };
  }

  // ===== Admin operations (M10-D API preserved) =====
  listUsers() {
    const rows = this._stmt('SELECT u.*, p.data AS pdata FROM users u LEFT JOIN players p ON p.user_id = u.id ORDER BY u.id').all();
    return rows.map((row) => {
      let d = {};
      try { d = row.pdata ? JSON.parse(row.pdata) : {}; } catch (e) { d = {}; }
      return {
        username: row.username,
        role: row.role,
        status: row.status,
        lock_date: row.lock_date || null,
        grade: d.grade || 1,
        level: d.level || 1,
        xp: d.xp || 0
      };
    });
  }

  setRole(username, role) {
    const user = this.findUser(username);
    if (!user) return { ok: false, error: 'AUTH_REQUIRED' };
    if (role !== 'user' && role !== 'admin') return { ok: false, error: 'INVALID_INPUT' };
    this._inTx(() => {
      this._stmt('UPDATE users SET role = ?, updated_at = ? WHERE id = ?')
        .run(role, new Date().toISOString(), user.id);
    });
    return { ok: true };
  }

  lockUser(username) {
    const user = this.findUser(username);
    if (!user) return { ok: false, error: 'AUTH_REQUIRED' };
    this._inTx(() => {
      this._stmt("UPDATE users SET status = 'locked', lock_date = ?, updated_at = ? WHERE id = ?")
        .run(new Date().toLocaleString('vi-VN'), new Date().toISOString(), user.id);
      // locked user loses all sessions immediately
      this._stmt('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    });
    return { ok: true };
  }

  resetUser(username) {
    const user = this.findUser(username);
    if (!user) return { ok: false, error: 'AUTH_REQUIRED' };
    this._inTx(() => {
      this._stmt("UPDATE users SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), user.id);
      this._stmt('INSERT INTO players (user_id, data) VALUES (?, ?) ' +
        'ON CONFLICT(user_id) DO UPDATE SET data = excluded.data')
        .run(user.id, JSON.stringify({ grade: 1, level: 1, xp: 0 }));
    });
    return { ok: true };
  }

  setMaxUser(username) {
    const user = this.findUser(username);
    if (!user) return { ok: false, error: 'AUTH_REQUIRED' };
    this._inTx(() => {
      const current = this.getUserData(username) || {};
      current.level = 9999;
      current.xp = 9800;
      this._stmt('INSERT INTO players (user_id, data) VALUES (?, ?) ' +
        'ON CONFLICT(user_id) DO UPDATE SET data = excluded.data')
        .run(user.id, JSON.stringify(current));
    });
    return { ok: true };
  }

  close() { try { this.db.close(); } catch (e) { /* already closed */ } }
}

class DatabaseSessionStore {
  constructor(options) {
    options = options || {};
    this.db = options.db || new DatabaseSync(options.filePath || path.join(__dirname, 'data', 'mathdrill.db'));
    this.ttlMs = options.ttlMs || 24 * 60 * 60 * 1000;
    this._ownsDb = !options.db;
  }

  createSession(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    // AuthService passes username (string); resolve to numeric users.id FK.
    let uid = Number(userId);
    if (!Number.isInteger(uid)) {
      const row = this.db.prepare('SELECT id FROM users WHERE username = ?').get(String(userId).trim());
      if (!row) return token; // no user row -> unusable session (never orphaned)
      uid = row.id;
    }
    this.db.prepare(
      'INSERT OR REPLACE INTO sessions (id_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
    ).run(hashToken(token), uid, now, now + this.ttlMs);
    this._prune();
    return token;
  }

  getSession(sessionId) {
    if (!sessionId) return null;
    this._prune();
    const row = this.db.prepare(
      'SELECT s.id_hash, s.user_id, s.created_at, s.expires_at, u.username FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ?'
    ).get(hashToken(sessionId));
    if (!row) return null;
    if (Date.now() > row.expires_at) {
      this.db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(row.id_hash);
      return null;
    }
    return {
      userId: row.user_id, // numeric FK (M10-E)
      username: row.username,
      createdAt: row.created_at,
      expiresAt: row.expires_at
    };
  }

  // DB row stores SHA-256(token); raw token never persisted.
  deleteSession(sessionId) {
    if (!sessionId) return;
    this.db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(hashToken(sessionId));
  }

  expireSession(sessionId) {
    if (!sessionId) return;
    this.db.prepare('UPDATE sessions SET expires_at = ? WHERE id_hash = ?')
      .run(Date.now() - 1000, hashToken(sessionId));
  }

  deleteAllUserSessions(userId) {
    // userId may be username (AuthService.changePassword) or numeric id.
    let uid = Number(userId);
    if (!Number.isInteger(uid)) {
      const row = this.db.prepare('SELECT id FROM users WHERE username = ?').get(String(userId).trim());
      if (!row) return;
      uid = row.id;
    }
    this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(uid);
  }

  cleanup() { this._prune(); }

  _prune() {
    this.db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  }

  countSessions(userId) {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?').get(Number(userId));
    return row ? Number(row.n) : 0;
  }

  close() { if (this._ownsDb) { try { this.db.close(); } catch (e) { /* noop */ } } }
}

/**
 * E3 — one-time idempotent migration from JSON stores.
 * - Backs up source file (.migrated-<ts> copy) before touching DB; never deletes source.
 * - Preserves password hashes, roles, locked state, player data.
 * - Skips users already in DB (idempotent). Corrupt source -> reported, not thrown.
 */
function migrateFromJson(options) {
  options = options || {};
  const usersPath = options.usersPath || path.join(__dirname, 'data', 'users.json');
  const sessionsPath = options.sessionsPath || path.join(__dirname, 'data', 'sessions.json');
  const userStore = options.userStore;
  const sessionStore = options.sessionStore; // may be null
  const ttlMs = options.ttlMs || 24 * 60 * 60 * 1000;

  const stats = { usersMigrated: 0, usersSkipped: 0, sessionsMigrated: 0, sessionsSkipped: 0, corrupt: [], backup: [] };

  const readJson = (p) => {
    if (!fs.existsSync(p)) return null;
    try {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
      return (parsed && typeof parsed === 'object') ? parsed : { __corrupt: true };
    } catch (e) {
      return { __corrupt: true };
    }
  };

  const users = readJson(usersPath);
  const sessions = readJson(sessionsPath);
  if (users && users.__corrupt) stats.corrupt.push('users');
  if (sessions && sessions.__corrupt) stats.corrupt.push('sessions');

  if (users && !users.__corrupt) {
    for (const [key, rec] of Object.entries(users)) {
      if (!rec || !rec.passwordHash) continue;
      if (userStore.findUser(rec.username || key)) { stats.usersSkipped++; continue; }
      userStore.createUser(rec.username || key, rec.passwordHash, {
        role: rec.role || 'user',
        status: rec.status || 'active',
        lock_date: rec.lock_date || null,
        data: rec.data || {}
      });
      stats.usersMigrated++;
    }
  }

  if (sessions && !sessions.__corrupt && sessionStore) {
    const now = Date.now();
    for (const [sid, s] of Object.entries(sessions)) {
      if (!s || !s.userId) { stats.sessionsSkipped++; continue; }
      if (now > (s.expiresAt || 0)) { stats.sessionsSkipped++; continue; }
      const user = sessionStore.db
        ? sessionStore.db.prepare('SELECT id FROM users WHERE username = ?').get(String(s.userId))
        : null;
      if (!user) { stats.sessionsSkipped++; continue; }
      sessionStore.db.prepare(
        'INSERT OR REPLACE INTO sessions (id_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
      ).run(hashToken(sid), user.id, s.createdAt || now, s.expiresAt || (now + ttlMs));
      stats.sessionsMigrated++;
    }
  }

  for (const src of [usersPath, sessionsPath]) {
    if (!fs.existsSync(src)) continue;
    const dest = src + '.migrated-' + new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(src, dest);
    stats.backup.push(dest);
  }

  return stats;
}

module.exports = { DatabaseUserStore, DatabaseSessionStore, migrateFromJson, hashToken, SCHEMA_SQL };