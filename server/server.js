'use strict';

const http = require('http');
const path = require('path');
const fs = require('fs');


const { UserStore } = require('./user_store');
const { SessionStore } = require('./session_store');
const { AuthService } = require('./auth_service');

const PORT = process.env.PORT || 3000;
const COOKIE_NAME = 'mathdrill_session';
const COOKIE_PATH = '/';
const COOKIE_TTL_MS = 24 * 60 * 60 * 1000;

// M10-E: MATHDRILL_BACKEND=sqlite selects the SQLite-backed stores implementing
// the same interface. Default remains the M10-C file stores (backward compatible).
const BACKEND = process.env.MATHDRILL_BACKEND === 'sqlite' ? 'sqlite' : 'file';

// M10-B: MATHDRILL_DATA_DIR overrides the default data/ directory for file-backed
// stores. Used by tests to isolate per-suite data directories.
const DATA_DIR = process.env.MATHDRILL_DATA_DIR || path.join(__dirname, 'data');

let userStore, sessionStore;
if (BACKEND === 'sqlite') {
  const { DatabaseUserStore, DatabaseSessionStore } = require('./database');
  userStore = new DatabaseUserStore({
    filePath: path.join(DATA_DIR, 'mathdrill.db')
  });
  sessionStore = new DatabaseSessionStore({
    db: userStore.db,
    ttlMs: COOKIE_TTL_MS
  });
  console.log('[Server] Persistence backend: sqlite');
} else {
  userStore = new UserStore({
    filePath: path.join(DATA_DIR, 'users.json')
  });
  sessionStore = new SessionStore({
    filePath: path.join(DATA_DIR, 'sessions.json'),
    ttlMs: COOKIE_TTL_MS
  });
  sessionStore.loadFromFile();
  console.log('[Server] Persistence backend: file');
}

const authService = new AuthService(userStore, sessionStore);

// M10-F: baseline security headers applied to every response (API + static).
// CSP matched to actual app behavior: zero inline scripts/styles in index.html,
// all assets same-origin, canvas/JS/CSS/fonts/audio self, fetch/API self.
const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; " +
    "script-src 'self'; " +
    "style-src 'self'; " +
    "img-src 'self' data:; " +
    "media-src 'self'; " +
    "font-src 'self'; " +
    "connect-src 'self'; " +
    "object-src 'none'; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'X-Frame-Options': 'DENY'
};

function applySecurityHeaders(res) {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
}

function sendJson(res, status, body) {
  applySecurityHeaders(res);
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(json);
}

function getCookie(req, name) {
  const cookieHeader = req.headers['cookie'];
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const c of cookies) {
    const idx = c.indexOf('=');
    if (idx < 0) continue;
    const key = c.substring(0, idx).trim();
    if (key === name) return decodeURIComponent(c.substring(idx + 1).trim());
  }
  return null;
}

function setSessionCookie(res, sessionId) {
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    `Path=${COOKIE_PATH}`,
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(COOKIE_TTL_MS / 1000)}`
  ];
  if (process.env.NODE_ENV === 'production') attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearSessionCookie(res) {
  const attrs = [
    `${COOKIE_NAME}=`,
    `Path=${COOKIE_PATH}`,
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0'
  ];
  if (process.env.NODE_ENV === 'production') attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function readJsonBody(req, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        /* M10-B FIX: previously req.destroy() killed the socket, so the client
           never received the documented 413 (it saw "socket hang up"). Drain and
           discard the remainder instead, then let the handler answer 413. */
        req.removeAllListeners('data');
        req.removeAllListeners('end');
        req.resume();
        return reject(new Error('PAYLOAD_TOO_LARGE'));
      }
      body += chunk;
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(new Error('INVALID_JSON')); }
    });
    req.on('error', reject);
  });
}

async function handleAuth(req, res, pathname) {
  const method = req.method.toUpperCase();
  const sessionId = getCookie(req, COOKIE_NAME);
    // M10-F F3: JSON APIs only accept application/json bodies.
  // Bodyless POSTs (e.g. /api/auth/logout) must not be rejected for lacking
  // a content-type — only enforce when a real JSON body is present.
  if (method === 'POST' && req.headers['content-length'] && Number(req.headers['content-length']) > 0) {
    const ct = String(req.headers['content-type'] || '');
    if (!ct.toLowerCase().includes('application/json')) {
      return sendJson(res, 415, { ok: false, error: 'UNSUPPORTED_MEDIA_TYPE' });
    }
  }
  // M10-F F7 (CSRF defense-in-depth): cookie auth + SameSite=Lax mitigates
  // cross-site POSTs; additionally reject cross-origin Origin headers.
  const origin = req.headers['origin'];
  if (origin) {
    const host = req.headers['host'];
    let originHost = null;
    try { originHost = new URL(origin).host; } catch (e) { originHost = null; }
    if (!originHost || originHost !== host) {
      return sendJson(res, 403, { ok: false, error: 'CROSS_ORIGIN_FORBIDDEN' });
    }
  }
  try {
    if (method === 'POST' && pathname === '/api/auth/register') {
      const body = await readJsonBody(req);
      const result = await authService.register(body.username, body.password, body.grade);
      if (result.ok) return sendJson(res, 201, { ok: true, user: result.user });
      return sendJson(res, 400, result);
    }
    if (method === 'POST' && pathname === '/api/auth/login') {
      const body = await readJsonBody(req);
      const result = await authService.login(body.username, body.password);
      if (result.ok) {
        setSessionCookie(res, result.sessionId);
        return sendJson(res, 200, { ok: true, user: result.user });
      }
      return sendJson(res, 401, result);
    }
    if (method === 'POST' && pathname === '/api/auth/logout') {
      const result = authService.logout(sessionId);
      clearSessionCookie(res);
      return sendJson(res, 200, result);
    }
    if (method === 'GET' && pathname === '/api/auth/me') {
      const user = authService.getSessionUser(sessionId);
      if (!user) return sendJson(res, 401, { ok: false, error: 'AUTH_REQUIRED' });
      return sendJson(res, 200, { ok: true, user: user });
    }
    if (method === 'POST' && pathname === '/api/auth/change-password') {
      const body = await readJsonBody(req);
      const result = await authService.changePassword(sessionId, body.username, body.oldPassword, body.newPassword);
      if (result.ok) { clearSessionCookie(res); return sendJson(res, 200, result); }
      const status = result.error === 'AUTH_REQUIRED' ? 401 : 400;
      return sendJson(res, status, result);
    }
    return sendJson(res, 404, { ok: false, error: 'NOT_FOUND' });
  } catch (err) {
    if (err.message === 'INVALID_JSON') return sendJson(res, 400, { ok: false, error: 'INVALID_INPUT' });
    if (err.message === 'PAYLOAD_TOO_LARGE') return sendJson(res, 413, { ok: false, error: 'INVALID_INPUT' });
    console.error('[Server] Auth error:', err.message);
    return sendJson(res, 500, { ok: false, error: 'SERVER_ERROR' });
  }
}

// ===== M10-D: Admin RBAC (server-side authority duy nhất) =====
// Admin API port từ admin_panel.py (lock_user/reset_user/set_max + user list).
// Mọi endpoint requireAuth + requireAdmin. Role KHÔNG bao giờ nhận từ client.
// Audit log KHÔNG chứa secret (chỉ action/actor/target).
function adminAudit(action, actor, target) {
  console.log('[AdminAudit] action=' + action + ' by=' + actor +
    (target ? ' target=' + target : '') + ' at=' + new Date().toISOString());
}

function handleAdmin(req, res, pathname, sessionId) {
  const method = req.method.toUpperCase();
  // M10-F F7: cross-origin state changes forbidden (defense-in-depth vs CSRF).
  const origin = req.headers['origin'];
  if (origin) {
    const host = req.headers['host'];
    let originHost = null;
    try { originHost = new URL(origin).host; } catch (e) { originHost = null; }
    if (!originHost || originHost !== host) {
      return sendJson(res, 403, { ok: false, error: 'CROSS_ORIGIN_FORBIDDEN' });
    }
  }
  if (method === 'POST') {
    const ct = String(req.headers['content-type'] || '');
    if (!ct.toLowerCase().includes('application/json')) {
      return sendJson(res, 415, { ok: false, error: 'UNSUPPORTED_MEDIA_TYPE' });
    }
  }
  // requireAuth: không session / session hết hạn → 401
  const user = authService.getSessionUser(sessionId);
  if (!user) return sendJson(res, 401, { ok: false, error: 'AUTH_REQUIRED' });
  // requireAdmin: có session nhưng không phải admin → 403
  if ((user.role || 'user') !== 'admin') {
    return sendJson(res, 403, { ok: false, error: 'FORBIDDEN' });
  }

  if (method === 'GET' && pathname === '/api/admin/me') {
    return sendJson(res, 200, { ok: true, username: user.username, role: 'admin' });
  }
  if (method === 'GET' && pathname === '/api/admin/users') {
    adminAudit('list_users', user.username);
    return sendJson(res, 200, { ok: true, users: userStore.listUsers() });
  }

  // POST actions — body chỉ chứa target username; role/is_admin trong body bị bỏ qua hoàn toàn.
  const ACTION_ROUTES = {
    '/api/admin/set-max': { op: 'set-max', fn: (u) => userStore.setMaxUser(u) },
    '/api/admin/lock-user': { op: 'lock-user', fn: (u) => userStore.lockUser(u) },
    '/api/admin/reset-user': { op: 'reset-user', fn: (u) => userStore.resetUser(u) }
  };
  const route = ACTION_ROUTES[pathname];
  if (route && method === 'POST') {
    return readJsonBody(req).then(function (body) {
      const target = body && body.username;
      if (!target || typeof target !== 'string') {
        return sendJson(res, 400, { ok: false, error: 'INVALID_INPUT' });
      }
      const result = route.fn(String(target).trim());
      if (!result.ok) {
        const status = result.error === 'AUTH_REQUIRED' ? 404 : 400;
        return sendJson(res, status, result);
      }
      adminAudit(route.op, user.username, String(target).trim());
      return sendJson(res, 200, { ok: true });
    }).catch(function (err) {
      if (err.message === 'INVALID_JSON') return sendJson(res, 400, { ok: false, error: 'INVALID_INPUT' });
      console.error('[Server] Admin action error:', err.message);
      return sendJson(res, 500, { ok: false, error: 'SERVER_ERROR' });
    });
  }
  return sendJson(res, 404, { ok: false, error: 'NOT_FOUND' });
}

function serveStatic(req, res, pathname) {
  const webRoot = path.join(__dirname, '..', 'web');
  // FINAL QA fix: req.url keeps percent-encoding (e.g. "Segoe%20UI%20Emoji.TTF"),
  // so the raw pathname 404'd every asset whose name contains a space. Decode
  // first; malformed encodings fall back to the raw pathname (defined behaviour).
  let rel;
  try { rel = decodeURIComponent(pathname); }
  catch (err) { rel = pathname; }
  let filePath;
  if (rel === '/' || rel === '') filePath = path.join(webRoot, 'index.html');
  else filePath = path.join(webRoot, rel);
  if (!filePath.startsWith(webRoot)) return sendJson(res, 403, { ok: false, error: 'FORBIDDEN' });
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not Found'); }
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.map': 'application/json' };
    const mime = mimeTypes[ext] || 'application/octet-stream';
    applySecurityHeaders(res);
    res.writeHead(200, { 'Content-Type': mime + '; charset=utf-8' });
    fs.createReadStream(filePath).pipe(res);
  });
}

// ===== M10-B: player progress persistence (server-side authority) =====
// The browser can no longer lose progress on reload: the player blob round-trips
// through a session-authenticated endpoint. Rules mirror handleAuth:
//   - cross-origin Origin headers rejected (CSRF defense-in-depth)
//   - POST bodies must be application/json (bodyless POSTs still allowed)
//   - 401 when there is no valid session; payload is a plain JSON object only
function handlePlayer(req, res, pathname, sessionId) {
  const method = req.method.toUpperCase();
  const origin = req.headers['origin'];
  if (origin) {
    const host = req.headers['host'];
    let originHost = null;
    try { originHost = new URL(origin).host; } catch (e) { originHost = null; }
    if (!originHost || originHost !== host) {
      return sendJson(res, 403, { ok: false, error: 'CROSS_ORIGIN_FORBIDDEN' });
    }
  }
  if (method === 'POST' && req.headers['content-length'] && Number(req.headers['content-length']) > 0) {
    const ct = String(req.headers['content-type'] || '');
    if (!ct.toLowerCase().includes('application/json')) {
      return sendJson(res, 415, { ok: false, error: 'UNSUPPORTED_MEDIA_TYPE' });
    }
  }
  const user = authService.getSessionUser(sessionId);
  if (!user) return sendJson(res, 401, { ok: false, error: 'AUTH_REQUIRED' });

  if (method === 'GET' && pathname === '/api/player/data') {
    const data = userStore.getUserData ? userStore.getUserData(user.username) : null;
    return sendJson(res, 200, { ok: true, data: (data && typeof data === 'object') ? data : {} });
  }
  if (method === 'POST' && pathname === '/api/player/data') {
    return readJsonBody(req).then(function (body) {
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return sendJson(res, 400, { ok: false, error: 'INVALID_INPUT' });
      }
      const result = userStore.setUserData(user.username, body);
      if (!result.ok) {
        const status = result.error === 'AUTH_REQUIRED' ? 401 : 400;
        return sendJson(res, status, result);
      }
      return sendJson(res, 200, { ok: true });
    }).catch(function (err) {
      if (err.message === 'INVALID_JSON') return sendJson(res, 400, { ok: false, error: 'INVALID_INPUT' });
      if (err.message === 'PAYLOAD_TOO_LARGE') return sendJson(res, 413, { ok: false, error: 'INVALID_INPUT' });
      console.error('[Server] Player save error:', err.message);
      return sendJson(res, 500, { ok: false, error: 'SERVER_ERROR' });
    });
  }
  return sendJson(res, 404, { ok: false, error: 'NOT_FOUND' });
}

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsed.pathname;
  if (pathname.startsWith('/api/auth/')) {
    try { await handleAuth(req, res, pathname); }
    catch (err) {
      console.error('[Server] Unhandled error:', err.message);
      if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'SERVER_ERROR' });
    }
    return;
  }
  if (pathname.startsWith('/api/admin/')) {
    try { handleAdmin(req, res, pathname, getCookie(req, COOKIE_NAME)); }
    catch (err) {
      console.error('[Server] Admin unhandled error:', err.message);
      if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'SERVER_ERROR' });
    }
    return;
  }
  if (pathname.startsWith('/api/player/')) {
    try { handlePlayer(req, res, pathname, getCookie(req, COOKIE_NAME)); }
    catch (err) {
      console.error('[Server] Player unhandled error:', err.message);
      if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'SERVER_ERROR' });
    }
    return;
  }
  if (pathname.startsWith('/api/meta/')) {
    try { handleMeta(req, res, pathname); }
    catch (err) {
      console.error('[Server] Meta unhandled error:', err.message);
      if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'SERVER_ERROR' });
    }
    return;
  }
  // Unknown /api/* route → JSON 404 (M10-C contract: API endpoints never fall to static).
  if (pathname.startsWith('/api/')) {
    return sendJson(res, 404, { ok: false, error: 'NOT_FOUND' });
  }
  serveStatic(req, res, pathname);
});

function start() {
  return new Promise(async (resolve) => {
    // M10-D: seed admin từ env secret (dev fallback 'admin123' — production
    // PHẢI set MATHDRILL_ADMIN_PASSWORD; secret không bao giờ rơi vào client).
    const seeded = await authService.ensureAdminUser(
      process.env.MATHDRILL_ADMIN_PASSWORD || 'admin123'
    );
    if (seeded && seeded.seeded) console.log('[Server] Admin account seeded (role=admin)');
    server.listen(PORT, () => {
      console.log(`[Server] MathDrill backend running on http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

function stop() { return new Promise((resolve) => server.close(() => resolve())); }

// M14-G1: deploy/build identity endpoint (read-only, no secrets).
// Lets production verification prove the exact deployed commit without guessing.
// M14-F1: also reports process uptime so Render cold starts are observable from
// outside instead of being guessed at.
const PROCESS_START_MS = Date.now();
function handleMeta(req, res, pathname) {
  const method = req.method.toUpperCase();
  if (method === 'GET' && pathname === '/api/meta/version') {
    // Render injects RENDER_GIT_COMMIT for the exact deployed commit.
    // Plain `git rev-parse` fails on hosts without git on PATH, so prefer env first.
    let commit = process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || 'unknown';
    if (commit === 'unknown') {
      try {
        const cp = require('child_process');
        const gitExe = process.env.GIT_EXE || 'git';
        commit = cp.execFileSync(gitExe, ['rev-parse', 'HEAD'], { cwd: __dirname, timeout: 3000 }).toString().trim().slice(0, 40) || 'unknown';
      } catch (e) { commit = 'unknown'; }
    }
    return sendJson(res, 200, {
      ok: true, commit: commit, service: 'math-drill', branch: 'main',
      uptimeSec: Math.floor((Date.now() - PROCESS_START_MS) / 1000)
    });
  }
  return sendJson(res, 404, { ok: false, error: 'NOT_FOUND' });
}
if (require.main === module) { start(); }

module.exports = { server, start, stop, authService, userStore, sessionStore };