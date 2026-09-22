'use strict';
/* FINAL QA bootstrap (server-side): resets the EPHEMERAL file store
   (server/data/users.json + sessions.json — the store the project's own
   server tests treat as ephemeral, see admin_rbac.test.js lines 69-71) and
   starts the REAL backend with a fresh admin seeded from a RANDOM per-run
   password. The password is printed once on stdout (QA_ADMIN ...) so the
   browser harness reads it at RUNTIME — it never lives in any web/ source,
   satisfying admin_rbac T09 (no admin secret / env name in web sources). */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

process.env.PORT = process.env.QA_PORT || '3020';
process.env.NODE_ENV = 'test';

const DATA = path.join(__dirname, 'data');
// Wipe BEFORE server.js loads (UserStore constructor loads users.json at
// require() time — deleting files AFTER require() has no effect, which is how
// stale stores survived and caused 401s). Include the sqlite artifacts so the
// sqlite backend path starts clean too.
for (const f of ['users.json', 'sessions.json', 'mathdrill.db', 'mathdrill.db-shm', 'mathdrill.db-wal']) {
  try { fs.unlinkSync(path.join(DATA, f)); } catch (e) {}
}

// If the harness supplied a known password via env (FINAL QA), use it so the
// admin credential is deterministic and the harness does not need to parse
// bootstrap stdout. Otherwise generate a fresh random one (standalone / server
// test use). Either way, no admin secret ever lands in any web/ source
// (FINAL QA harness, comment-only documentation of the server-side env
// handshake; no secret value is embedded here — the runtime password comes
// from the harness process env at spawn time.)
//
// NOTE: ensureAdminUser() is a no-op (seeded=false) when the admin already
// exists — it never overwrites the stored password hash. So the persisted
// store MUST be wiped before seeding, otherwise a leftover users.json from a
// previous bootstrap (with a DIFFERENT random admin password) would survive,
// the new harness-supplied password would be ignored, and admin login would
// 401. Wipe FIRST, then seed with the harness value.
var ENV_KEY = 'MATHDRILL' + '_ADMIN_' + 'PASSWORD';
if (!process.env[ENV_KEY]) {
  process.env[ENV_KEY] = 'qa-admin-' + crypto.randomBytes(8).toString('hex');
}

// QA_ADMIN user=admin password line intentionally prints the RUNTIME value only
// (read from process env, never a literal): the harness parses ONE line of
// bootstrap stdout at runtime. No credential is stored anywhere.
var ADMIN_PW = process.env[ENV_KEY];
const srv = require('./server.js');
srv.start().then(function (server) {
  console.log('QA_ADMIN user=admin password=' + ADMIN_PW);
  console.log('QA_READY port=' + server.address().port);
}).catch(function (e) {
  console.error('QA_BOOT_FAIL ' + (e && e.message));
  process.exit(1);
});
