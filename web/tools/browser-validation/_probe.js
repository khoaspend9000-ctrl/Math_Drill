const pw = require('./node_modules/playwright');
(async () => {
  const b = await pw.chromium.launch();
  console.log('CHROMIUM_OK');
  const p = await b.newPage();
  console.log('PAGE_OK');
  await b.close();
  process.exit(0);
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
