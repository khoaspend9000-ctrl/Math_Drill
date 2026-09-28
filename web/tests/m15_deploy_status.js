// M15-F1 — deploy identity check.
//
// F1 root cause, measured in M14: the repository had ZERO entries in the
// GitHub Deployments API while commits were confirmed present on
// Math_Drill@main via `git ls-remote`. Render records a deployment through
// that API on every GitHub-triggered build, so no record means the service
// is not receiving GitHub build events and must be deployed manually from
// the Render dashboard. That part is NOT fixable from this repository and is
// recorded honestly here rather than worked around.
//
// What this script DOES make possible, and what was previously missing, is a
// one-command answer to 'which release is actually live?'. Before M14 there
// was no endpoint at all; polling could not distinguish 'deploying' from
// 'stale'. GET /api/meta/version now reports the running commit, so:
//
//   node web/tests/m15_deploy_status.js
//   -> prints the live commit and compares it to the local HEAD
//   -> exit 0  live == local HEAD
//   -> exit 1  live != local HEAD  (production is behind the repository)
//   -> exit 2  could not reach the service
'use strict';
const https = require('https');

const BASE = process.env.M15_BASE || 'https://math-drill-iwys.onrender.com';
const GIT = process.env.MATHDRILL_GIT || 'git';
const cp = require('child_process');

function get(path) {
  return new Promise(function (res) {
    const r = https.request(BASE + path, { method: 'GET', timeout: 40000 }, function (x) {
      let b = '';
      x.on('data', function (d) { b += d; });
      x.on('end', function () { res({ status: x.statusCode, body: b }); });
    });
    r.on('error', function (e) { res({ status: 0, body: String(e.message) }); });
    r.on('timeout', function () { r.destroy(); res({ status: 0, body: 'timeout' }); });
    r.end();
  });
}

function localHead() {
  try {
    return cp.execFileSync(GIT, ['-C', 'E:/MathDrill', 'rev-parse', 'HEAD'],
      { encoding: 'utf8', timeout: 20000 }).trim();
  } catch (e) {
    return null;
  }
}

(async function () {
  const head = localHead();
  const meta = await get('/api/meta/version');
  const root = await get('/');

  if (meta.status !== 200) {
    console.log('DEPLOY_STATUS=UNREACHABLE');
    console.log('meta_status=' + meta.status + ' body=' + String(meta.body).slice(0, 120));
    console.log('root_status=' + root.status);
    process.exit(2);
  }

  let info = {};
  try { info = JSON.parse(meta.body); } catch (e) { /* keep empty */ }
  const live = info.commit || null;

  console.log('SERVICE=' + BASE);
  console.log('SERVICE_NAME=' + (info.service || 'unknown'));
  console.log('BRANCH=' + (info.branch || 'unknown'));
  console.log('UPTIME_SEC=' + (info.uptimeSec !== undefined ? info.uptimeSec : 'unknown'));
  console.log('ROOT_STATUS=' + root.status);
  console.log('LIVE_COMMIT=' + live);
  console.log('LOCAL_HEAD=' + head);
  console.log('MATCH=' + (live && head && live === head ? 'YES' : 'NO'));

  if (live && head && live === head) {
    console.log('DEPLOY_STATUS=CURRENT');
    process.exit(0);
  }
  console.log('DEPLOY_STATUS=STALE');
  console.log('ACTION=Render dashboard -> math-drill-iwys -> Manual Deploy for commit ' + head);
  process.exit(1);
})();
