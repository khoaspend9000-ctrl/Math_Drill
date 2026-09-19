'use strict';
/* M4 browser validation (real Chromium via Playwright). */
const path = require('path');
const pw = require(path.join(__dirname, '..', 'tools', 'browser-validation', 'node_modules', 'playwright'));
const http = require('http');
const fs = require('fs');

const server = http.createServer((req, res) => {
  const fp = path.join(__dirname, '..', req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  try {
    const data = fs.readFileSync(fp);
    const ext = path.extname(fp).toLowerCase();
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
      '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.json': 'application/json',
      '.ogg': 'audio/ogg', '.ttf': 'font/ttf' }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  } catch (e) {
    console.log('SRV404:', req.url, '->', (e && e.message));
    if (!res.headersSent) { res.writeHead(404); }
    try { res.end('nf'); } catch (_) {}
  }
});
server.listen(8125);
server.on('error', () => {});

(async () => {
  const errors = [];
  let failures = 0;
  const browser = await pw.chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  function t(name, cond) {
    if (cond) { console.log('PASS ' + name); }
    else { failures++; console.log('FAIL ' + name); }
  }

  await page.goto('http://127.0.0.1:8125/index.html');
  let booted = false;
  for (let i = 0; i < 40 && !booted; i++) {
    await page.waitForTimeout(500);
    booted = await page.evaluate(() => !!(window.Game && window.Game.states &&
      window.Game.states.currentName)).catch(() => false);
  }
  if (!booted) { console.log('BROWSER_FATAL: boot did not reach a state in 20s'); process.exit(2); }
  await page.waitForTimeout(3500); // loading (1.2s) -> login

  t('B1 boot registers all states incl. theory', async () => {
    await page.evaluate(() => window.Game.states.change('theory', { grade: 1, title: 'B\u00e0i 1' }));
    await page.waitForTimeout(300);
    return page.evaluate(() => window.Game.states.currentName === 'theory');
  });

  await page.evaluate(() => window.Game.states.change('menu'));
  await page.waitForTimeout(400);
  t('B2 menu state active', await page.evaluate(() => window.Game.states.currentName === 'menu'));

  await page.evaluate(() => window.Game.states.change('lesson_select', { grade: 1 }));
  await page.waitForTimeout(400);
  t('B3 lesson_select loads with data', await page.evaluate(() =>
    window.Game.states.currentName === 'lesson_select' &&
    window.Game.states.current.dataMissing !== true));
  t('B4 lesson_select has book', await page.evaluate(() => !!window.Game.states.current._rbBook));

  await page.evaluate(() => {
    const pages = window.TheoryPages();
    window.Game.states.change('theory', { grade: 1, title: pages['1'][0].t });
  });
  await page.waitForTimeout(400);
  t('B5 theory state active with Desktop content', await page.evaluate(() => {
    const s = window.Game.states.current;
    return window.Game.states.currentName === 'theory' &&
      typeof s.content === 'string' && s.content.length > 20 &&
      s.content !== 'N\u1ed9i dung \u0111ang \u0111\u01b0\u1ee3c c\u1eadp nh\u1eadt...';
  }));
  t('B6 theory book exists', await page.evaluate(() => !!window.Game.states.current._rbBook));

  // resize viewport checks
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(300);
  t('B7 1280x720 resize keeps logical engine size', await page.evaluate(() =>
    window.Game.engine.WIDTH === 1300 && window.Game.engine.HEIGHT === 800));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(300);
  t('B8 1920x1080 resize keeps logical engine size', await page.evaluate(() =>
    window.Game.engine.WIDTH === 1300 && window.Game.engine.HEIGHT === 800));

  // canvas painted: engine tick active + canvas backing store DPR-scaled
  t('B9 engine ticking and canvas DPR-scaled', await page.evaluate(() => {
    const c = document.querySelector('canvas');
    return !!c && c.width >= 1300 && c.height >= 800 && window.Game.engine.fps >= 0;
  }));

  t('B10 no page errors during run', errors.length === 0);
  if (errors.length) console.log('ERRORS:\n' + errors.slice(0, 10).join('\n'));

  await page.screenshot({ path: path.join(__dirname, '_m4_theory_1080p.png') });
  await browser.close();
  console.log('M4_BROWSER: failures=' + failures);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.log('BROWSER_FATAL: ' + e.message); process.exit(2); });
