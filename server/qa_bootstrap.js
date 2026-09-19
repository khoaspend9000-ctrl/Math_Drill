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
for (const f of ['users.json', 'sessions.json']) {
  try { fs.unlinkSync(path.join(DATA, f)); } catch (e) {}
}

// If the harness supplied a known password via env (FINAL QA), use it so the
// admin credential is deterministic and the harness does not need to parse
// bootstrap stdout. Otherwise generate a fresh random one (standalone / server
// test use). Either way, no admin secret ever lands in any web/ source
// (admin_rbac T09).
if (!process.env.MATHDRILL_ADMIN_PASSWORD) {
  process.env.MATHDRILL_ADMIN_PASSWORD = 'qa-admin-' + crypto.randomBytes(8).toString('hex');
}

const srv = require('./server.js');
srv.start().then(function (server) {
  console.log('QA_ADMIN user=admin password=' + process.env.MATHDRILL_ADMIN_PASSWORD);
  console.log('QA_READY port=' + server.address().port);
}).catch(function (e) {
  console.error('QA_BOOT_FAIL ' + (e && e.message));
  process.exit(1);
});
