'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
function loadPets() { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'pets.json'), 'utf8')); }
function loadSkins() { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'skins.json'), 'utf8')); }
const pets = loadPets(); const skins = loadSkins();
const { PetSystem, PetManager } = require('../js/pet.js');
const { SkinSystem, SkinManager } = require('../js/skin.js');
let pass = 0, failed = 0;
function check(name, fn) { try { fn(); pass++; console.log('PASS  ' + name); } catch (e) { failed++; console.error('FAIL  ' + name + ' :: ' + (e && e.message)); } }
function savedata(gold) { return { gold: gold, unlocked_pets: ['clover'], unlocked_skins: ['pen_basic', 'board_wood'] }; }
check('T01 PetSystem getPetInfo stage0', function () { const ps = new PetSystem(pets); const i = ps.getPetInfo('clover',0); assert.strictEqual(i.name,'Cỏ Non'); assert.strictEqual(i.xp_required,0); });
check('T02 PetSystem getMaxStage', function () { const ps = new PetSystem(pets); assert.strictEqual(ps.getMaxStage('clover'),4); assert.strictEqual(ps.getMaxStage('xyz'),0); });
check('T03 PetSystem getPrice', function () { const ps = new PetSystem(pets); assert.strictEqual(ps.getPrice('star'),250); assert.strictEqual(ps.getPrice('math'),550); });
check('T04 canEvolve threshold', function () { const ps = new PetSystem(pets); assert.strictEqual(ps.canEvolve('clover',0,499),false); assert.strictEqual(ps.canEvolve('clover',0,500),true); });
check('T05 purchasePet admin bypass gold gate', function () { const ps=new PetSystem(pets); const d=savedata(10); const pm=new PetManager({petSystem:ps,data:d,isAdmin:true}); const r=pm.purchasePet('star'); assert.strictEqual(r.ok,true); assert.strictEqual(d.gold,10); assert.ok(d.unlocked_pets.indexOf('star')>=0); });
check('T06 purchasePet valid', function () { const ps=new PetSystem(pets); const d=savedata(500); const pm=new PetManager({petSystem:ps,data:d}); const r=pm.purchasePet('star'); assert.strictEqual(r.ok,true); assert.strictEqual(d.gold,250); assert.ok(d.unlocked_pets.indexOf('star')>=0); });
check('T07 purchasePet insufficient', function () { const ps=new PetSystem(pets); const d=savedata(100); const pm=new PetManager({petSystem:ps,data:d}); const r=pm.purchasePet('star'); assert.strictEqual(r.ok,false); assert.strictEqual(d.gold,100); });
check('T08 purchasePet duplicate', function () { const ps=new PetSystem(pets); const d=savedata(1000); d.unlocked_pets.push('star'); const pm=new PetManager({petSystem:ps,data:d}); const r=pm.purchasePet('star'); assert.strictEqual(r.ok,false); assert.strictEqual(d.gold,1000); });
check('T09 purchasePet invalid', function () { const ps=new PetSystem(pets); const d=savedata(1000); const pm=new PetManager({petSystem:ps,data:d}); const r=pm.purchasePet('xyz'); assert.strictEqual(r.ok,false); });
check('T10 changePetType requires unlocked', function () { const ps=new PetSystem(pets); const d=savedata(1000); d.unlocked_pets.push('star'); const pm=new PetManager({petSystem:ps,data:d}); assert.strictEqual(pm.changePetType('math'),false); assert.strictEqual(pm.changePetType('star'),true); assert.strictEqual(d.pet.type,'star'); });
check('T11 evolvePet rule', function () { const ps=new PetSystem(pets); const d=savedata(100); d.pet={type:'clover',stage:0,name:'Clover'}; d.xp=500; const pm=new PetManager({petSystem:ps,data:d}); assert.strictEqual(pm.canEvolvePet(),true); assert.strictEqual(pm.evolvePet(),true); assert.strictEqual(d.pet.stage,1); });
check('T12 evolvePet max blocked', function () { const ps=new PetSystem(pets); const d=savedata(999999); d.pet={type:'clover',stage:4,name:'X'}; d.xp=99999; const pm=new PetManager({petSystem:ps,data:d}); assert.strictEqual(pm.canEvolvePet(),false); });

// T13-T16 skins
check('T13 SkinSystem getSkinInfo', function () {
  const ss=new SkinSystem(skins);
  assert.strictEqual(ss.getPrice('pen_magic'),300);
  assert.strictEqual(ss.getSkinInfo('pen_magic').effect,'sparkle');
});
check('T14 getSkinsByType', function () { const ss=new SkinSystem(skins); assert.ok(Object.keys(ss.getSkinsByType('pen')).indexOf('pen_basic')>=0); assert.ok(Object.keys(ss.getSkinsByType('board')).indexOf('board_wood')>=0); });
check('T15 getPrice', function () { const ss=new SkinSystem(skins); assert.strictEqual(ss.getPrice('pen_basic'),0); assert.strictEqual(ss.getPrice('pen_golden'),750); });
check('T16 normalize color', function () { const ss=new SkinSystem(); ss.normalize({p:{color:[1,2,3,9]}}); assert.deepStrictEqual(ss.getColor('p'),[1,2,3]); });
check('T17 purchaseSkin valid', function () { const ss=new SkinSystem(skins); const d=savedata(400); const sm=new SkinManager({skinSystem:ss,data:d}); const r=sm.purchaseSkin('pen_magic'); assert.strictEqual(r.ok,true); assert.strictEqual(d.gold,100); });
check('T18 purchaseSkin insufficient', function () { const ss=new SkinSystem(skins); const d=savedata(50); const sm=new SkinManager({skinSystem:ss,data:d}); const r=sm.purchaseSkin('pen_magic'); assert.strictEqual(r.ok,false); assert.strictEqual(d.gold,50); });
check('T19 purchaseSkin duplicate', function () { const ss=new SkinSystem(skins); const d=savedata(1000); d.unlocked_skins.push('pen_magic'); const sm=new SkinManager({skinSystem:ss,data:d}); assert.strictEqual(sm.purchaseSkin('pen_magic').ok,false); });
check('T20 purchaseSkin invalid', function () { const ss=new SkinSystem(skins); const d=savedata(1000); const sm=new SkinManager({skinSystem:ss,data:d}); assert.strictEqual(sm.purchaseSkin('xyz').ok,false); });
check('T21 equipSkin requires ownership', function () { const ss=new SkinSystem(skins); const d=savedata(1000); d.unlocked_skins.push('pen_magic'); const sm=new SkinManager({skinSystem:ss,data:d}); assert.strictEqual(sm.equipSkin('pen_laser').ok,false); assert.strictEqual(sm.equipSkin('pen_magic').ok,true); });
check('T22 equipSkin invalid', function () { const ss=new SkinSystem(skins); const d=savedata(1000); const sm=new SkinManager({skinSystem:ss,data:d}); assert.strictEqual(sm.equipSkin('xyz').ok,false); });
check('T23 persistence', function () { const ss=new SkinSystem(skins); const ps=new PetSystem(pets); const d=savedata(350); const pm=new PetManager({petSystem:ps,data:d}); const sm=new SkinManager({skinSystem:ss,data:d}); pm.purchasePet('star'); sm.purchaseSkin('pen_magic'); sm.equipSkin('pen_magic'); const d2=JSON.parse(JSON.stringify(d)); assert.strictEqual(d2.gold,100); });
function finalize() { console.log('M9-B PetSkin: pass=' + pass + ' fail=' + failed); process.exit(failed ? 1 : 0); }
finalize();



