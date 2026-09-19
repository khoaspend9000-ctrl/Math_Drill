const fs = require('fs');
const idx = fs.readFileSync('E:/lam_game_2026/web/index.html', 'utf8');
const ms = idx.match(/src="[^"]+"/g) || [];
console.log('script tags:', ms.length);
ms.forEach(m => console.log(' ', m));
