const fs = require('fs');
function mods(names) {
  names.forEach(n => {
    try {
      const m = require('E:/lam_game_2026/web/js/' + n + '.js');
      console.log(n, '→', Object.keys(m).join(','));
    } catch (e) {
      console.log(n, '→ LOAD ERROR:', e.message.slice(0, 90));
    }
  });
}
mods(['shop', 'pet', 'skin', 'gacha', 'achievements', 'daily', 'skill_tree', 'item_effects', 'player', 'game_manager', 'save', 'data_loader', 'performance']);

const main = fs.readFileSync('E:/lam_game_2026/web/js/main.js', 'utf8');
console.log('=== main.js: Game singleton refs ===');
main.split('\n').forEach((l, i) => {
  if (/Game\.|global\.Game|new (Shop|Pet|Skin|Gacha|Achie|Daily|Skill|Item|Account)|states|setState|change\('/.test(l)) console.log(i + 1, l.trim().slice(0, 110));
});