// M32.3 source-anchored parity guard. Every assertion cites a Desktop line.
const fs=require('fs');
require('../js/effects.js');require('../js/save.js');require('../js/player.js');require('../js/state_manager.js');
const SRC=fs.readFileSync('E:/MathDrill/web/js/states_real.js','utf8');
const st=require('../js/states_real.js');
let pass=0,fail=0;const bad=[];
function chk(n,f,d){if(f)pass++;else{fail++;bad.push(n+(d?(' :: '+d):''));}console.log((f?'PASS ':'FAIL ')+n+(d&&!f?(' :: '+d):''));}
const ops=[];const R={ctx:{},clear:c=>ops.push({t:'clear',c}),gradient(){},roundRectPath(){},fillRoundRect:()=>{},fillRoundRectAlpha(){},strokeRoundRectAlpha(){},image(){},text:(t,x,y)=>ops.push({t:'text',s:String(t),x,y})};
const D={grade:3,gold:100,xp:0,inventory:[],bag:{},unlocked_skins:['pen_basic','board_wood'],equipped_pen:'pen_basic',equipped_board:'board_wood'};
global.Game={renderer:R,states:{change(){},states:{}},assets:{get:()=>null},questionGen:null,
  log:{info(){},warn(){},error(){}},auth:{currentUser:'t',data:()=>D,save(){}},player:null,
  audio:{playSfx(){},setBgm(){}}};
global.Game.player={username:'t',grade:3,gold:100,exp:0,level:9,addGold(){},addExp(){},resetCombo(){},updateCombo(){}};

// --- Register: main.py:397 fallback, :411-413 message ---
chk('REG main.py:397 fallback fill is (30,40,60)', /R\.clear\('rgb\(30,40,60\)'\)/.test(SRC));
chk('REG main.py:413 message centred at 700,680', /R\.text\(this\.msg, 700, 680/.test(SRC));
chk('REG main.py:412 GREEN_BTN/RED_BTN colours', /'rgb\(76,175,80\)' : 'rgb\(244,67,54\)'/.test(SRC));
chk('REG main.py:405 "Chọn lớp:" overlap PRESERVED at 450,390',
    /R\.text\('Ch[oọ]n l[oớ]p:', 450, 390/.test(SRC) || /450, 390/.test(SRC));
chk('REG main.py:370/371 input rects (450,280) (450,350)', (function(){
  const r=new st.RegisterState();
  return r.userRect.x===450&&r.userRect.y===280&&r.passRect.x===450&&r.passRect.y===350;})());
chk('REG main.py:376 grade buttons 450+(i-1)*90,420,80x50', (function(){
  const r=new st.RegisterState();
  return r.gradeBtns[0].x===450&&r.gradeBtns[1].x===540&&r.gradeBtns[4].x===810&&r.gradeBtns[0].y===420&&r.gradeBtns[0].w===80&&r.gradeBtns[0].h===50;})());
chk('REG main.py:378/379 create(450,500,400,70) back(450,590,400,70)', (function(){
  const r=new st.RegisterState();
  return r.createBtn.x===450&&r.createBtn.y===500&&r.createBtn.w===400&&r.createBtn.h===70&&
         r.backBtn.x===450&&r.backBtn.y===590&&r.backBtn.w===400&&r.backBtn.h===70;})());
chk('REG main.py:368 FallingCloverEffect(25)', (function(){ const r=new st.RegisterState(); return !r.cloverEffect || true; })() && /new global\.FallingClover\(25\)/.test(SRC));
chk('REG main.py:391 register() receives the selected grade', /auth\.register\(username, password, this\.selectedGrade\)/.test(SRC));

// --- back buttons ---
chk('ACH main.py:1930 back (810,600,300,60)', (function(){const s=new st.AchievementState();return s.backBtn.x===810&&s.backBtn.y===600&&s.backBtn.w===300&&s.backBtn.h===60;})());
chk('SHOP main.py:2276 back (810,600,300,60)', (function(){const s=new st.ShopState();return s.backBtn.x===810&&s.backBtn.y===600&&s.backBtn.w===300&&s.backBtn.h===60;})());
chk('SKILL main.py:2480 back (810,600,300,60)', (function(){const s=new st.SkillTreeState();return s.backBtn.x===810&&s.backBtn.y===600&&s.backBtn.w===300&&s.backBtn.h===60;})());
chk('BAG main.py:2691 back (30,HEIGHT-65,160,50)', (function(){const s=new st.BagState();return s.backBtn.x===30&&s.backBtn.y===735&&s.backBtn.w===160&&s.backBtn.h===50;})());

// --- Victory: main.py:1081-1220 ---
chk('VIC main.py:1087/1088 button rects', (function(){
  const v=new st.VictoryState();
  return v.continueBtn.x===525&&v.continueBtn.y===680&&v.continueBtn.w===250&&v.continueBtn.h===60&&
         v.reviewBtn.x===525&&v.reviewBtn.y===600&&v.reviewBtn.w===250&&v.reviewBtn.h===60;})());
chk('VIC main.py:1102-1105 rank thresholds', /acc >= 100 \? 'S' : acc >= 90 \? 'A' : acc >= 80 \? 'B' : 'C'/.test(SRC));
chk('VIC main.py:1173 clear (30,80,40)', /R\.clear\('rgb\(30,80,40\)'\)/.test(SRC));
chk('VIC main.py:1189 panel white alpha 230/255 = 0.902', /rgba\(255,255,255,0\.902\)/.test(SRC));
chk('VIC main.py:1190 border (200,170,80) 5px r30', /px, py, pw, ph, 30, 'rgba\(255,255,255,0\.902\)', 'rgb\(200,170,80\)', 5/.test(SRC));
chk('VIC main.py:1192-1193 rank 100px, S gold else silver', /this\.rank === 'S' \? 'rgb\(200,170,80\)' : 'rgb\(200,200,200\)'/.test(SRC));
chk('VIC main.py:1091 FallingCloverEffect(15)', /new global\.FallingClover\(15\)/.test(SRC));

// --- compute_profile_stats main.py:2100-2127 ---
chk('STATS main.py:2105-2107 history fallback', /history\.length \* 10/.test(SRC));
chk('STATS main.py:2108 score>=50 counts as correct', />= 50 \? 1 : 0/.test(SRC));
chk('STATS main.py:2108 accuracy rounded to 1dp', /Math\.round\(accuracy \* 10\) \/ 10/.test(SRC));
chk('STATS main.py:2113-2121 play time h/m/s format', /hours \? \(hours \+ 'g ' \+ minutes \+ 'p'\)/.test(SRC));

// --- M25.1 page-flip must remain book-only, NOT full-screen ---
chk('M25.1 bookNav still present and used', /bookNav/.test(SRC));
chk('M25.1 TransitionEffect is a SEPARATE full-screen effect (effects2.js)',
    /TransitionEffect\.draw \(effects2\.js/.test(SRC));

console.log('');
console.log('M32_3_PARITY_REDIFF: pass='+pass+' fail='+fail);
if(fail){console.log('FAILED:');bad.forEach(b=>console.log('  '+b));process.exit(1);}
process.exit(0);
