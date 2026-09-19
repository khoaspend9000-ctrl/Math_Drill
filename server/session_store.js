'use strict';

const crypto = require('crypto');

/**
 * SessionStore — M10-C temporary in-memory + file backup.
 * M10-E will replace this with database-backed store.
 * 
 * Interface:
 *   createSession(userId) -> sessionId
 *   getSession(sessionId) -> { userId, createdAt, expiresAt } | null
 *   deleteSession(sessionId) -> void
 *   deleteAllUserSessions(userId) -> void
 *   cleanup() -> void (remove expired)
 */
class SessionStore {
  constructor(options) {
    options = options || {};
    this.sessions = new Map();
    this.ttlMs = options.ttlMs || 24 * 60 * 60 * 1000; // 24h default
    this.filePath = options.filePath || null;
  }

  createSession(userId) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const session = {
      userId: String(userId),
      createdAt: now,
      expiresAt: now + this.ttlMs
    };
    this.sessions.set(sessionId, session);
    this._persist();
    return sessionId;
  }

  getSession(sessionId) {
    if (!sessionId) return null;
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(sessionId);
      this._persist();
      return null;
    }
    return session;
  }

  deleteSession(sessionId) {
    this.sessions.delete(sessionId);
    this._persist();
  }

  expireSession(sessionId) {
    const s = this.sessions.get(sessionId);
    if (s) { s.expiresAt = Date.now() - 1000; this._persist(); }
  }

  deleteAllUserSessions(userId) {
    const uid = String(userId);
    for (const [sid, s] of this.sessions) {
      if (s.userId === uid) this.sessions.delete(sid);
    }
    this._persist();
  }

  cleanup() {
    const now = Date.now();
    let changed = false;
    for (const [sid, s] of this.sessions) {
      if (now > s.expiresAt) { this.sessions.delete(sid); changed = true; }
    }
    if (changed) this._persist();
  }

  _persist() {
    if (!this.filePath) return;
    try {
      const fs = require('fs');
      const data = {};
      for (const [k, v] of this.sessions) data[k] = v;
      fs.writeFileSync(this.filePath, JSON.stringify(data), 'utf8');
    } catch (e) {
      // Non-fatal: session in-memory still works
    }
  }

  loadFromFile() {
    if (!this.filePath) return;
    try {
      const fs = require('fs');
      if (!fs.existsSync(this.filePath)) return;
      const data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      for (const [k, v] of Object.entries(data)) {
        if (v.expiresAt > Date.now()) this.sessions.set(k, v);
      }
    } catch (e) {
      // Non-fatal: start fresh
    }
  }
}

module.exports = { SessionStore };
