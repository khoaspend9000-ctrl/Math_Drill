'use strict';
const fs = require('fs');
const path = require('path');

const web = path.join(__dirname, 'web');
const jsDir = path.join(web, 'js');
const dataDir = path.join(web, 'data');
const testsDir = path.join(web, 'tests');
const audioDir = path.join(web, 'audio');
const fontsDir = path.join(web, 'fonts');
const assetsDir = path.join(web, 'assets');

// Scripts loaded in index.html
const indexHtml = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
const loadedScripts = [...indexHtml.matchAll(/src="js\/([^"]+)"/g)].map(m => m[1]);

// All JS files
const allJs = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).sort();

// Not loaded
const notLoaded = allJs.filter(f => !loadedScripts.includes(f));

console.log('=== INDEX.HTML LOADED SCRIPTS (' + loadedScripts.length + ') ===');
loadedScripts.forEach(s => console.log('  ', s));
console.log();
console.log('=== NOT LOADED IN INDEX.HTML (' + notLoaded.length + ') ===');
notLoaded.forEach(s => console.log('  ', s));
console.log();

// Data files
console.log('=== DATA JSON ===');
fs.readdirSync(dataDir).filter(f => f.endsWith('.json')).forEach(f => {
  console.log('  ', f, fs.statSync(path.join(dataDir, f)).size, 'B');
});
console.log();

// Audio files
console.log('=== AUDIO ===');
if (fs.existsSync(audioDir)) {
  fs.readdirSync(audioDir).forEach(f => {
    console.log('  ', f, fs.statSync(path.join(audioDir, f)).size, 'B');
  });
}
console.log();

// Fonts
console.log('=== FONTS ===');
if (fs.existsSync(fontsDir)) {
  fs.readdirSync(fontsDir).forEach(f => {
    console.log('  ', f, fs.statSync(path.join(fontsDir, f)).size, 'B');
  });
}
console.log();

// Test files
console.log('=== TEST SUITES ===');
const tests = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.js')).sort();
tests.forEach(t => console.log('  ', t));
console.log('  Total:', tests.length);
