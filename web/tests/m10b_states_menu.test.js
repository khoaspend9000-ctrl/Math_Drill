// M10-B State Integration Test
var assert = require('assert');

global.GameLogger = { info: function(){}, warn: function(){}, error: function(){} };
global.BaseState = function(name) { this.name = name; };
global.BaseState.prototype.enter = function(){};
global.BaseState.prototype.exit = function(){};
global.BaseState.prototype.handleInput = function(){};
global.BaseState.prototype.update = function(){};
global.BaseState.prototype.draw = function(){};
global.TransitionEffect = function(){ this.active=false; };
global.TransitionEffect.prototype.start = function(){};
global.PlayerData = function(){ this.exp=0; this.gold=500; this.grade=1; this.username='test'; };
global.ShopSystem = function(){};
global.ShopSystem.prototype.filter = function(){ return []; };
global.ShopSystem.prototype.isOwned = function(){ return false; };
global.ShopSystem.prototype.ownsPet = function(){ return false; };
global.ShopSystem.prototype.ownsSkin = function(){ return false; };
global.ShopSystem.prototype.purchasePet = function(){ return {ok:true,msg:'ok'}; };
global.ShopSystem.prototype.purchaseSkin = function(){ return {ok:true,msg:'ok'}; };
global.ShopSystem.prototype.changePetType = function(){ return true; };
global.ShopSystem.prototype.equipSkin = function(){ return {ok:true,msg:'ok'}; };
global.ShopSystem.prototype.getCurrentPet = function(){ return {type:''}; };
global.PetSystem = function(){ this.petTypes={}; };
global.SkinSystem = function(){ this.skinTypes={}; };
global.GachaSystem = function(){ this.data={inventory:[],gacha_state:{pull_count:0,total_pulls:0,guaranteed_legendary:false,rare_pity:0}}; };
global.GachaSystem.prototype.roll = function(){ return {card:{title:'Test'},rarity:'common',isNew:true}; };
global.GachaSystem.prototype.getPityInfo = function(){ return {pull_count:0,hard_pity:90,soft_pity_start:74,total_pulls:0}; };
global.AchievementSystem = function(){};
global.AchievementSystem.prototype.getDefinitions = function(){ return {}; };
global.DailyRewardSystem = function(){};
global.DailyRewardSystem.prototype.getStatus = function(){ return {streak:0,today:1,claimedToday:false}; };
global.DailyRewardSystem.prototype.claim = function(){ return {ok:true,msg:'ok',xp:10,gold:5}; };
global.SkillTreeSystem = function(){};
global.SkillTreeSystem.prototype.getSkillsByCategory = function(){ return {}; };
global.SkillTreeSystem.prototype.getSkillInfo = function(){ return {max_level:5,effect_type:'passive'}; };
global.SkillManager = function(){};
global.SkillManager.prototype.getSkillLevels = function(){ return {}; };
global.SkillManager.prototype.unlockSkill = function(){ return [true,'ok']; };
global.SkillManager.prototype.upgradeSkill = function(){ return [true,'ok']; };
global.SkillManager.prototype.activateSkill = function(){ return [true,'ok']; };
global.DataLoader = function(){};
global.DataLoader.getLessonsForGrade = function(){ return []; };
global.QuestionGenerator = function(){};
global.QuestionGenerator.prototype.generate_question = function(){ return null; };
global.Save = { load: function(){return null;}, persist: function(){return Promise.resolve();}, KEYS:{PLAYER:'p'} };
global.AccountSystem = function(){ this.currentUser='test'; this.data=function(){ return {xp:0,gold:500}; }; };
global.ShopApi = { loadPetTypes: function(){return Promise.resolve({});}, loadSkinTypes: function(){return Promise.resolve({});}, loadSkillTypes: function(){return Promise.resolve({});} };
global.AchievementSys = { getAchievementSystem: function(){ return null; } };

var StatesReal = require('../js/states_real');

function mockClick(x, y) { return { x: x, y: y }; }
function mockInput(click) {
  var consumed = false;
  return {
    consumeClick: function() {
      if (consumed) return null;
      consumed = true;
      return click;
    }
  };
}

var passed = 0, failed = 0, failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log('PASS  ' + name); }
  catch (e) { failed++; failures.push({name:name,err:e}); console.log('FAIL  ' + name + ' — ' + e.message); }
}
function suite(name, fn) { console.log('\n=== ' + name + ' ==='); fn(); }

suite('M10-B State Existence', function() {
  test('ShopState exists', function() { assert.ok(StatesReal.ShopState); });
  test('PetState exists', function() { assert.ok(StatesReal.PetState); });
  test('SkinState exists', function() { assert.ok(StatesReal.SkinState); });
  test('GachaState exists', function() { assert.ok(StatesReal.GachaState); });
  test('AchievementState exists', function() { assert.ok(StatesReal.AchievementState); });
  test('DailyState exists', function() { assert.ok(StatesReal.DailyState); });
  test('SkillTreeState exists', function() { assert.ok(StatesReal.SkillTreeState); });
  test('BagState exists', function() { assert.ok(StatesReal.BagState); });
});

suite('M10-B BaseState Extension', function() {
  test('ShopState extends BaseState', function() {
    var s = new StatesReal.ShopState();
    assert.strictEqual(typeof s.enter, 'function');
    assert.strictEqual(typeof s.exit, 'function');
    assert.strictEqual(typeof s.handleInput, 'function');
    assert.strictEqual(typeof s.update, 'function');
    assert.strictEqual(typeof s.draw, 'function');
  });
  test('PetState extends BaseState', function() {
    var s = new StatesReal.PetState();
    assert.strictEqual(typeof s.enter, 'function');
    assert.strictEqual(typeof s.exit, 'function');
    assert.strictEqual(typeof s.handleInput, 'function');
    assert.strictEqual(typeof s.update, 'function');
    assert.strictEqual(typeof s.draw, 'function');
  });
  test('SkinState extends BaseState', function() {
    var s = new StatesReal.SkinState();
    assert.strictEqual(typeof s.enter, 'function');
    assert.strictEqual(typeof s.exit, 'function');
    assert.strictEqual(typeof s.handleInput, 'function');
    assert.strictEqual(typeof s.update, 'function');
    assert.strictEqual(typeof s.draw, 'function');
  });
  test('GachaState extends BaseState', function() {
    var s = new StatesReal.GachaState();
    assert.strictEqual(typeof s.enter, 'function');
    assert.strictEqual(typeof s.exit, 'function');
    assert.strictEqual(typeof s.handleInput, 'function');
    assert.strictEqual(typeof s.update, 'function');
    assert.strictEqual(typeof s.draw, 'function');
  });
  test('AchievementState extends BaseState', function() {
    var s = new StatesReal.AchievementState();
    assert.strictEqual(typeof s.enter, 'function');
    assert.strictEqual(typeof s.exit, 'function');
    assert.strictEqual(typeof s.handleInput, 'function');
    assert.strictEqual(typeof s.update, 'function');
    assert.strictEqual(typeof s.draw, 'function');
  });
  test('DailyState extends BaseState', function() {
    var s = new StatesReal.DailyState();
    assert.strictEqual(typeof s.enter, 'function');
    assert.strictEqual(typeof s.exit, 'function');
    assert.strictEqual(typeof s.handleInput, 'function');
    assert.strictEqual(typeof s.update, 'function');
    assert.strictEqual(typeof s.draw, 'function');
  });
  test('SkillTreeState extends BaseState', function() {
    var s = new StatesReal.SkillTreeState();
    assert.strictEqual(typeof s.enter, 'function');
    assert.strictEqual(typeof s.exit, 'function');
    assert.strictEqual(typeof s.handleInput, 'function');
    assert.strictEqual(typeof s.update, 'function');
    assert.strictEqual(typeof s.draw, 'function');
  });
  test('BagState extends BaseState', function() {
    var s = new StatesReal.BagState();
    assert.strictEqual(typeof s.enter, 'function');
    assert.strictEqual(typeof s.exit, 'function');
    assert.strictEqual(typeof s.handleInput, 'function');
    assert.strictEqual(typeof s.update, 'function');
    assert.strictEqual(typeof s.draw, 'function');
  });
});

suite('M10-B State Names', function() {
  test('ShopState name is shop', function() { assert.strictEqual(new StatesReal.ShopState().name, 'shop'); });
  test('PetState name is pet', function() { assert.strictEqual(new StatesReal.PetState().name, 'pet'); });
  test('SkinState name is skin', function() { assert.strictEqual(new StatesReal.SkinState().name, 'skin'); });
  test('GachaState name is gacha', function() { assert.strictEqual(new StatesReal.GachaState().name, 'gacha'); });
  test('AchievementState name is achievement', function() { assert.strictEqual(new StatesReal.AchievementState().name, 'achievement'); });
  test('DailyState name is daily', function() { assert.strictEqual(new StatesReal.DailyState().name, 'daily'); });
  test('SkillTreeState name is skill_tree', function() { assert.strictEqual(new StatesReal.SkillTreeState().name, 'skill_tree'); });
  test('BagState name is bag', function() { assert.strictEqual(new StatesReal.BagState().name, 'bag'); });
});

suite('M10-B Lifecycle', function() {
  test('All states enter/exit without throwing', function() {
    var ctors = [StatesReal.ShopState, StatesReal.PetState, StatesReal.SkinState, StatesReal.GachaState,
                 StatesReal.AchievementState, StatesReal.DailyState, StatesReal.SkillTreeState, StatesReal.BagState];
    for (var i = 0; i < ctors.length; i++) { var s = new ctors[i](); s.enter({}); s.exit(); }
  });
});

suite('M10-B Back-to-Menu Navigation', function() {
  var capturedChange = null;
  var origGame = global.Game;
  global.Game = { states: { change: function(n,p,t){ capturedChange={name:n,params:p,transition:t}; } },
    renderer: { clear:function(){},text:function(){},fillRoundRect:function(){},fillRect:function(){},strokeRoundRect:function(){},measureText:function(){return{width:10};} } };

  test('ShopState back routes to menu', function() {
    capturedChange=null; var s=new StatesReal.ShopState(); s.enter({});
    s.handleInput(mockInput(mockClick(s.backBtn.x+1,s.backBtn.y+1)),0.016);
    assert.strictEqual(capturedChange.name,'menu');
  });
  test('PetState back routes to menu', function() {
    capturedChange=null; var s=new StatesReal.PetState(); s.enter({});
    s.handleInput(mockInput(mockClick(s.backBtn.x+1,s.backBtn.y+1)),0.016);
    assert.strictEqual(capturedChange.name,'menu');
  });
  test('SkinState back routes to menu', function() {
    capturedChange=null; var s=new StatesReal.SkinState(); s.enter({});
    s.handleInput(mockInput(mockClick(s.backBtn.x+1,s.backBtn.y+1)),0.016);
    assert.strictEqual(capturedChange.name,'menu');
  });
  test('GachaState back routes to menu', function() {
    capturedChange=null; var s=new StatesReal.GachaState(); s.enter({});
    s.handleInput(mockInput(mockClick(s.backBtn.x+1,s.backBtn.y+1)),0.016);
    assert.strictEqual(capturedChange.name,'menu');
  });
  test('AchievementState back routes to menu', function() {
    capturedChange=null; var s=new StatesReal.AchievementState(); s.enter({});
    s.handleInput(mockInput(mockClick(s.backBtn.x+1,s.backBtn.y+1)),0.016);
    assert.strictEqual(capturedChange.name,'menu');
  });
  test('DailyState back routes to menu', function() {
    capturedChange=null; var s=new StatesReal.DailyState(); s.enter({});
    s.handleInput(mockInput(mockClick(s.backBtn.x+1,s.backBtn.y+1)),0.016);
    assert.strictEqual(capturedChange.name,'menu');
  });
  test('SkillTreeState back routes to menu', function() {
    capturedChange=null; var s=new StatesReal.SkillTreeState(); s.enter({});
    s.handleInput(mockInput(mockClick(s.backBtn.x+1,s.backBtn.y+1)),0.016);
    assert.strictEqual(capturedChange.name,'menu');
  });
  test('BagState back routes to menu', function() {
    capturedChange=null; var s=new StatesReal.BagState(); s.enter({});
    s.handleInput(mockInput(mockClick(s.backBtn.x+1,s.backBtn.y+1)),0.016);
    assert.strictEqual(capturedChange.name,'menu');
  });

  global.Game = origGame;
});

suite('M10-B System Linkage', function() {
  test('ShopSystem exists', function() { assert.ok(global.ShopSystem); });
  test('PetSystem exists', function() { assert.ok(global.PetSystem); });
  test('SkinSystem exists', function() { assert.ok(global.SkinSystem); });
  test('GachaSystem exists', function() { assert.ok(global.GachaSystem); });
  test('AchievementSystem exists', function() { assert.ok(global.AchievementSystem); });
  test('DailyRewardSystem exists', function() { assert.ok(global.DailyRewardSystem); });
  test('SkillTreeSystem exists', function() { assert.ok(global.SkillTreeSystem); });
});

suite('M10-B Invalid Input', function() {
  test('All states handle null click', function() {
    var ctors = [StatesReal.ShopState, StatesReal.PetState, StatesReal.SkinState, StatesReal.GachaState,
                 StatesReal.AchievementState, StatesReal.DailyState, StatesReal.SkillTreeState, StatesReal.BagState];
    for (var i = 0; i < ctors.length; i++) { var s = new ctors[i](); s.enter({}); s.handleInput(mockInput(null), 0.016); }
  });
});

suite('M10-B Update', function() {
  test('All states update without throwing', function() {
    var ctors = [StatesReal.ShopState, StatesReal.PetState, StatesReal.SkinState, StatesReal.GachaState,
                 StatesReal.AchievementState, StatesReal.DailyState, StatesReal.SkillTreeState, StatesReal.BagState];
    for (var i = 0; i < ctors.length; i++) { new ctors[i]().update(0.016); }
  });
});

suite('M10-B Draw', function() {
  var mockCtx = {};
  var mockR = { clear:function(){},text:function(){},fillRoundRect:function(){},fillRect:function(){},strokeRoundRect:function(){},measureText:function(){return{width:10};} };
  var origGame = global.Game;
  global.Game = { renderer: mockR };

  test('All states draw without throwing', function() {
    var ctors = [StatesReal.ShopState, StatesReal.PetState, StatesReal.SkinState, StatesReal.GachaState,
                 StatesReal.AchievementState, StatesReal.DailyState, StatesReal.SkillTreeState, StatesReal.BagState];
    for (var i = 0; i < ctors.length; i++) { var s = new ctors[i](); s.enter({}); s.draw(mockCtx, 1300, 800); }
  });

  global.Game = origGame;
});

suite('M10-B Full Flow', function() {
  test('All states complete full lifecycle', function() {
    var ctors = [StatesReal.ShopState, StatesReal.PetState, StatesReal.SkinState, StatesReal.GachaState,
                 StatesReal.AchievementState, StatesReal.DailyState, StatesReal.SkillTreeState, StatesReal.BagState];
    for (var i = 0; i < ctors.length; i++) { var s = new ctors[i](); s.enter({}); s.update(0.016); s.handleInput(mockInput(null), 0.016); s.exit(); }
  });
});

console.log('\n=== M10-B SUMMARY ===');
console.log('Passed: ' + passed);
console.log('Failed: ' + failed);
if (failed > 0) {
  console.log('\nFailures:');
  for (var i = 0; i < failures.length; i++) { console.log('  - ' + failures[i].name + ': ' + failures[i].err.message); }
  process.exit(1);
} else {
  console.log('ALL M10-B tests passed.');
  process.exit(0);
}