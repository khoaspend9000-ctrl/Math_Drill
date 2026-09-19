/* M10-E — DATABASE PERSISTENCE TESTS (T01–T20). node:sqlite zero-dep backend. */
'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { DatabaseUserStore, DatabaseSessionStore, migrateFromJson, hashToken } = require('../database');

let pass = 0, fail = 0;
const failures = [];
function check(name, fn) {
  return Promise.resolve().then(fn).then(function () {
    pass++; console.log('PASS ' + name);
  }, function (err) {
    fail++; failures.push(name);
    console.log('FAIL ' + name + ' :: ' + (err && err.message));
  });
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'md-db-'));
const DB_PATH = path.join(TMP, 'test.db');
const USERS_JSON = path.join(TMP, 'users.json');
const SESSIONS_JSON = path.join(TMP, 'sessions.json');
let users, sessions;

async function main() {
  await check('T01 database initializes', () => {
    users = new DatabaseUserStore({ filePath: DB_PATH });
    sessions = new DatabaseSessionStore({ db: users.db });
    assert.ok(users.db);
  });

  await check('T02 schema exists (users/sessions/players)', () => {
    const rows = users.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users','sessions','players')"
    ).all();
    assert.strictEqual(rows.length, 3);
  });

  await check('T03 user insert', () => {
    const r = users.createUser('alice', 'scrypt$salt$hash');
    assert.ok(r.ok); assert.strictEqual(r.user.username, 'alice');
    assert.strictEqual(r.user.role, 'user');
  });

  await check('T04 duplicate username rejected', () => {
    const r = users.createUser('alice', 'other');
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, 'USERNAME_TAKEN');
  });

  await check('T05 user lookup', () => {
    assert.ok(users.findUser('alice'));
    assert.strictEqual(users.findUser('nobody'), null);
  });

  await check('T06 password hash roundtrip + updatePassword', () => {
    assert.ok(users.verifyPassword('alice', 'scrypt$salt$hash'));
    assert.ok(!users.verifyPassword('alice', 'wrong'));
    assert.ok(users.updatePassword('alice', 'scrypt$new$hash').ok);
    assert.ok(users.verifyPassword('alice', 'scrypt$new$hash'));
  });

  await check('T07 role persistence + setRole validation', () => {
    assert.strictEqual(users.setRole('alice', 'boss').error, 'INVALID_INPUT');
    assert.ok(users.setRole('alice', 'admin').ok);
    assert.strictEqual(users.findUser('alice').role, 'admin');
    assert.ok(users.setRole('alice', 'user').ok);
  });

  await check('T08 player persistence (game data JSON)', () => {
    users.setUserData('alice', { gold: 500, level: 3, xp: 210, inventory: ['pet_1'] });
    const d = users.getUserData('alice');
    assert.strictEqual(d.gold, 500);
    assert.strictEqual(d.level, 3);
    assert.deepStrictEqual(d.inventory, ['pet_1']);
  });

  await check('T09 session persistence (token hashed, never raw)', () => {
    const token = sessions.createSession('alice');
    assert.ok(/^[0-9a-f]{64}$/.test(token));
    const s = sessions.getSession(token);
    assert.ok(s, 'session resolves');
    assert.strictEqual(s.username, 'alice');
    assert.ok(!fs.readFileSync(DB_PATH).includes(token), 'raw token leaked into db file');
  });

  await check('T10 session expiry', () => {
    const token = sessions.createSession('alice');
    sessions.expireSession(token);
    assert.strictEqual(sessions.getSession(token), null);
  });

  await check('T11 transaction rollback on failure', () => {
    users.db.exec('BEGIN');
    users.db.prepare("UPDATE users SET role='admin' WHERE username='alice'").run();
    try {
      users.db.prepare("INSERT INTO users (username, password_hash, role, status, created_at, updated_at) VALUES ('alice','x','user','active','a','b')").run();
      assert.fail('should have thrown UNIQUE');
    } catch (e) { /* expected */ }
    users.db.exec('ROLLBACK');
    assert.strictEqual(users.findUser('alice').role, 'user', 'rollback restored role');
  });

  await check('T12 migration from JSON', () => {
    fs.writeFileSync(USERS_JSON, JSON.stringify({
      bob: { username: 'bob', passwordHash: 'scrypt$bob$hash', role: 'user', status: 'active', data: { gold: 100, level: 2, xp: 50 } },
      carol: { username: 'carol', passwordHash: 'scrypt$carol$hash', role: 'admin', status: 'locked', lock_date: '01/01/2025', data: {} }
    }), 'utf8');
    fs.writeFileSync(SESSIONS_JSON, JSON.stringify({
      rawtokenhex: { userId: 'bob', createdAt: Date.now(), expiresAt: Date.now() + 3600e3 },
      expired: { userId: 'bob', createdAt: 0, expiresAt: 1 },
      dangling: { userId: 'ghost', createdAt: Date.now(), expiresAt: Date.now() + 3600e3 }
    }), 'utf8');
    const stats = migrateFromJson({ usersPath: USERS_JSON, sessionsPath: SESSIONS_JSON, userStore: users, sessionStore: sessions });
    assert.strictEqual(stats.usersMigrated, 2);
    assert.ok(users.findUser('bob'), 'bob migrated');
    assert.strictEqual(users.findUser('carol').role, 'admin', 'admin role preserved');
    assert.strictEqual(users.findUser('carol').status, 'locked', 'locked preserved');
    assert.strictEqual(users.getUserData('bob').gold, 100, 'player data preserved');
    assert.strictEqual(stats.sessionsMigrated, 1, 'only valid+non-expired session');
    assert.strictEqual(stats.sessionsSkipped, 2, 'expired + dangling skipped');
    const row = sessions.db.prepare('SELECT id_hash FROM sessions').all().find(r => r.id_hash === hashToken('rawtokenhex'));
    assert.ok(row, 'migrated session stored with hashed id');
    assert.ok(stats.backup.length >= 2, 'JSON sources backed up');
  });

  await check('T13 migration idempotent', () => {
    const stats2 = migrateFromJson({ usersPath: USERS_JSON, sessionsPath: SESSIONS_JSON, userStore: users, sessionStore: sessions });
    assert.strictEqual(stats2.usersMigrated, 0);
    assert.strictEqual(stats2.usersSkipped, 2);
  });

  await check('T14 existing users preserved (no data loss)', () => {
    assert.strictEqual(users.getUserData('bob').xp, 50);
    assert.ok(users.findUser('carol'));
  });

  await check('T15 existing admin role preserved', () => {
    assert.strictEqual(users.findUser('carol').role, 'admin');
  });

  await check('T16 locked user preserved', () => {
    assert.strictEqual(users.findUser('carol').status, 'locked');
    assert.ok(users.findUser('carol').lock_date);
  });

  await check('T17 player/account association (FK cascade)', () => {
    const row = users.db.prepare("SELECT id FROM users WHERE username='bob'").get();
    assert.ok(users.db.prepare('SELECT user_id FROM players WHERE user_id=?').get(row.id), 'players row linked');
    users.db.prepare('DELETE FROM users WHERE username=?').run('bob');
    const orphan = users.db.prepare('SELECT COUNT(*) AS n FROM players WHERE user_id=?').get(row.id);
    assert.strictEqual(Number(orphan.n), 0, 'player row cascaded with user');
  });

  await check('T18 repeated writes (concurrent-ish)', () => {
    for (let i = 0; i < 50; i++) users.setUserData('alice', { gold: i, level: 1, xp: i * 2 });
    assert.strictEqual(users.getUserData('alice').gold, 49);
    const aliceId = users.findUser('alice').id;
    const before = sessions.countSessions(aliceId);
    for (let i = 0; i < 20; i++) sessions.createSession('alice');
    assert.strictEqual(sessions.countSessions(aliceId), before + 20);
  });

  await check('T19 corrupted source handled safely', () => {
    const badUsers = path.join(TMP, 'bad_users.json');
    fs.writeFileSync(badUsers, '{not valid json', 'utf8');
    const stats = migrateFromJson({ usersPath: badUsers, sessionsPath: path.join(TMP, 'nope.json'), userStore: users, sessionStore: sessions });
    assert.ok(stats.corrupt.includes('users'), 'corruption reported, not thrown');
  });

  await check('T20 database reopen persistence', () => {
    users.close();
    const users2 = new DatabaseUserStore({ filePath: DB_PATH });
    assert.ok(users2.findUser('alice'), 'alice survives reopen');
    assert.strictEqual(users2.getUserData('alice').gold, 49);
    assert.strictEqual(users2.findUser('carol').role, 'admin');
    users2.close();
  });

  console.log(`\nM10-E database: pass=${pass} fail=${fail}`);
  if (failures.length) console.log('Failures:', failures.join(', '));
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });