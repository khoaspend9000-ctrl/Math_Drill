'use strict';
/* M9-A: SHOP - verify catalog/filter/purchase logic match Python source. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { collectShopCatalog, filterShopItems, ShopSystem } = require('../js/shop.js');

let pass = 0, failed = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('PASS  ' + name); }
  catch (e) { failed++; console.error('FAIL  ' + name + ' :: ' + (e && e.message)); }
}

const DATA_DIR = path.join(__dirname, '..', 'data');
const pets = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'pets.json'), 'utf8'));
const skins = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'skins.json'), 'utf8'));

function defaultData() {
  return { gold: 5000, unlocked_pets: ['clover'], unlocked_skins: ['pen_basic', 'board_wood'], pet: { type: 'clover', stage: 0, name: 'Co Non' } };
}
function mkSys(data) { return new ShopSystem({ petTypes: pets, skinTypes: skins, data: data || defaultData() }); }

check('T01 catalog 16 items (6 pets + 5 pen + 5 board)', function () {
  const items = collectShopCatalog(pets, skins);
  assert.strictEqual(items.length, 16);
  const cats = items.map(i => i.category);
  assert.strictEqual(cats.filter(c => c === 'pet').length, 6);
  assert.strictEqual(cats.filter(c => c === 'pen').length, 5);
  assert.strictEqual(cats.filter(c => c === 'board').length, 5);
});

check('T02 catalog fields', function () {
  const items = collectShopCatalog(pets, skins);
  assert.ok(items.length > 0);
  items.forEach(function (it) {
    assert.ok(it.key, 'key'); assert.ok(it.name, 'name');
    assert.ok(typeof it.price === 'number', 'price number'); assert.ok(it.category, 'category');
  });
});

check('T03 filter pen category', function () {
  const items = collectShopCatalog(pets, skins);
  const pen = filterShopItems(items, 'pen', '');
  assert.strictEqual(pen.length, 5);
  pen.forEach(function (it) { assert.strictEqual(it.category, 'pen'); });
});

check('T04 item lookup star 250 / pen_golden 750', function () {
  const items = collectShopCatalog(pets, skins);
  const star = items.find(i => i.key === 'star');
  assert.ok(star); assert.strictEqual(star.price, 250); assert.strictEqual(star.category, 'pet');
  const golden = items.find(i => i.key === 'pen_golden');
  assert.ok(golden); assert.strictEqual(golden.price, 750); assert.strictEqual(golden.category, 'pen');
});
check('T05 valid purchase star 250', function () {
  const sys = mkSys();
  const r = sys.purchasePet('star');
  assert.strictEqual(r.ok, true);
  assert.ok(r.msg.indexOf('Mua') >= 0, r.msg);
});

check('T06 exact gold deduction 5000-250=4750', function () {
  const sys = mkSys();
  assert.strictEqual(sys.getPetPrice('star'), 250);
  sys.purchasePet('star');
  assert.strictEqual(sys.data.gold, 4750);
});

check('T07 ownership updated', function () {
  const sys = mkSys();
  assert.strictEqual(sys.ownsPet('star'), false);
  sys.purchasePet('star');
  assert.strictEqual(sys.ownsPet('star'), true);
  assert.ok(sys.getUnlockedPets().indexOf('star') >= 0);
});

check('T08 insufficient gold no deduction', function () {
  const sys = mkSys({ gold: 100, unlocked_pets: ['clover'], unlocked_skins: [] });
  const before = sys.data.gold;
  const r = sys.purchasePet('dragon');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(sys.data.gold, before);
});

check('T09 insufficient gold no ownership', function () {
  const sys = mkSys({ gold: 100, unlocked_pets: ['clover'], unlocked_skins: [] });
  sys.purchasePet('dragon');
  assert.strictEqual(sys.ownsPet('dragon'), false);
});

check('T10 duplicate purchase blocked', function () {
  const sys = mkSys();
  sys.purchasePet('star');
  const r = sys.purchasePet('star');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(sys.data.gold, 4750);
});

check('T11 invalid item no crash', function () {
  const sys = mkSys();
  assert.strictEqual(sys.purchasePet('khong_tontai').ok, false);
  assert.strictEqual(sys.purchaseSkin('khong_tontai').ok, false);
});
check('T12 purchase skin pen_golden 750', function () {
  const sys = mkSys();
  const r = sys.purchaseSkin('pen_golden');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(sys.data.gold, 4250);
  assert.strictEqual(sys.ownsSkin('pen_golden'), true);
});

check('T13 equip skin pen/board', function () {
  const sys = mkSys();
  sys.purchaseSkin('pen_golden');
  assert.strictEqual(sys.equipSkin('pen_golden').ok, true);
  assert.strictEqual(sys.getEquippedSkins().pen, 'pen_golden');
  sys.purchaseSkin('board_neon');
  sys.equipSkin('board_neon');
  assert.strictEqual(sys.getEquippedSkins().board, 'board_neon');
  assert.strictEqual(sys.equipSkin('pen_laser').ok, false);
});

check('T14 change pet type', function () {
  const sys = mkSys();
  assert.strictEqual(sys.changePetType('star'), false);
  sys.purchasePet('star');
  assert.strictEqual(sys.changePetType('star'), true);
  assert.strictEqual(sys.getCurrentPet().type, 'star');
  assert.strictEqual(sys.getCurrentPet().stage, 0);
});

check('T15 persistence save/load gold+ownership', function () {
  const sys = mkSys();
  sys.purchasePet('star'); sys.purchaseSkin('pen_golden');
  const snap = JSON.parse(JSON.stringify(sys.data));
  const sys2 = mkSys(snap);
  assert.strictEqual(sys2.data.gold, 4000);
  assert.strictEqual(sys2.ownsPet('star'), true);
  assert.strictEqual(sys2.ownsSkin('pen_golden'), true);
});

check('T16 reload preserves equipped', function () {
  const sys = mkSys();
  sys.purchaseSkin('pen_neon'); sys.equipSkin('pen_neon');
  const snap = JSON.parse(JSON.stringify(sys.data));
  const sys2 = mkSys(snap);
  assert.strictEqual(sys2.getEquippedSkins().pen, 'pen_neon');
});

check('T17 adapter save hook called', function () {
  let saved = 0;
  const sys = new ShopSystem({ petTypes: pets, skinTypes: skins, data: defaultData(), adapter: { save: function () { saved += 1; } } });
  sys.purchasePet('book'); assert.strictEqual(saved, 1);
  sys.equipSkin('board_wood'); assert.strictEqual(saved, 2);
});

check('T18 no double purchase on repeat click', function () {
  const sys = mkSys();
  sys.purchasePet('math'); sys.purchasePet('math');
  assert.strictEqual(sys.data.gold, 4450);
  assert.strictEqual(sys.getUnlockedPets().filter(p => p === 'math').length, 1);
});

console.log('M9-A Shop: pass=' + pass + ' fail=' + failed);
process.exit(failed ? 1 : 0);