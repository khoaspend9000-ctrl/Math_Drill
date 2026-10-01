// M32.1 Defeat retry Desktop-parity suite.
// Desktop main.py:1026-1038
//   if self.btn_retry.clicked(e.pos):
//       if self.lesson_title == "Thử Thách": manager.change(DailyState())
//       else: manager.change(LessonState(self.lesson_title))
const fs=require('fs');
require('../js/effects.js');
require('../js/save.js');
require('../js/player.js');
require('../js/state_manager.js');
const SRC=fs.readFileSync('E:/MathDrill/web/js/states_real.js','utf8');
const st=require('../js/states_real.js');
let pass=0,fail=0;const bad=[];
function chk(n,f,d){if(f)pass++;else{fail++;bad.push(n+(d?(' :: '+d):''));}console.log((f?'PASS ':'FAIL ')+n+(d&&!f?(' :: '+d):''));}

const DAILY = 'Th' + String.fromCharCode(0x1EED) + ' Th' + String.fromCharCode(0x00E1) + 'ch';

let changed=null,changeCount=0,lastParams=null;
const ops=[];
const R={ctx:{},width:1300,height:800,clear:()=>{},gradient:()=>{},roundRectPath:()=>{},
  fillRoundRect:()=>{},fillRoundRectAlpha:()=>{},strokeRoundRectAlpha:()=>{},image:()=>{},
  text:(t,x,y)=>ops.push({t:String(t)})};
const D={grade:3,gold:100,inventory:[],bag:{}};
global.Game={renderer:R,states:{change:(n,p)=>{changed=n;changeCount++;lastParams=p;},states:{}},
  assets:{get:()=>null},questionGen:null,log:{info(){},warn(){},error(){}},
  auth:{currentUser:'t',data:()=>D,save:()=>{}},player:null};
global.Game.player={username:'t',grade:3,gold:100,exp:0,level:9,addGold(){}};
const inp=(click)=>({consumeClick:()=>click||null,consumePressedKey:()=>null,consumeWheel:()=>null});
const C=(x,y)=>({x,y});

function makeDefeat(title){ const d=new st.DefeatState(); d.lessonTitle=title||''; d.showUi=true; return d; }

// ---- T01 normal lesson defeat -> lesson ----
let d=makeDefeat('Bài 1. Các số 0, 1, 2');
changed=null;changeCount=0;
d.handleInput(inp(C(d.retryBtn.x+10,d.retryBtn.y+10)),0);
chk('T01 normal lesson defeat -> LessonState (main.py:1030)', changed==='lesson' && changeCount===1, 'got '+changed);

// ---- T02 daily challenge defeat -> daily ----
d=makeDefeat(DAILY);
changed=null;changeCount=0;
d.handleInput(inp(C(d.retryBtn.x+10,d.retryBtn.y+10)),0);
chk('T02 daily challenge defeat -> DailyState (main.py:1029)', changed==='daily' && changeCount===1, 'got '+changed);

// ---- T03 exact title detection ----
chk('T03 constant is byte-exact vs main.py:1029', (()=>{
  const m=/const DAILY_CHALLENGE_TITLE = '([^']*)';/.exec(SRC);
  return !!m && m[1]===DAILY;
})(), 'constant mismatch');
chk('T03 detection is exact-match, not a prefix (Desktop == semantics)', (function(){
  const near=makeDefeat('Thử Thách Ngày');       // superset must NOT match
  changed=null; near.handleInput(inp(C(near.retryBtn.x+10,near.retryBtn.y+10)),0);
  return changed==='lesson';
})(), 'superset wrongly matched');
chk('T03 an empty lesson title falls through to lesson', (function(){
  const e=makeDefeat(''); changed=null;
  e.handleInput(inp(C(e.retryBtn.x+10,e.retryBtn.y+10)),0);
  return changed==='lesson';
})(), String(changed));

// ---- T04 one retry = one transition ----
d=makeDefeat(DAILY); changeCount=0; changed=null;
d.handleInput(inp(C(d.retryBtn.x+10,d.retryBtn.y+10)),0);
chk('T04 retry fires exactly one transition', changeCount===1, 'n='+changeCount);

// ---- T05 repeated clicks stay on the same Desktop destination ----
// Desktop has no re-entry guard either: manager.change replaces the state, so a
// second click can never land on the old one. The harness keeps a single state
// object, so raw call counts are meaningless; assert the destination is stable.
d=makeDefeat(DAILY); changed=null; const dests=[];
for(let i=0;i<3;i++){ d.handleInput(inp(C(d.retryBtn.x+10,d.retryBtn.y+10)),0); dests.push(changed); }
chk('T05 repeated clicks resolve to one stable destination (main.py:1029)',
    dests.length===3 && dests.every(x=>x==='daily'), JSON.stringify(dests));

// ---- T06 back still goes to the Desktop destination ----
d=makeDefeat(DAILY); changed=null; changeCount=0;
d.handleInput(inp(C(d.homeBtn.x+10,d.homeBtn.y+10)),0);
chk('T06 back -> menu (main.py:1032)', changed==='menu' && changeCount===1, String(changed));

// ---- T07 no stale defeat state after retry ----
chk('T07 retry passes the lesson title through to the lesson (main.py:1030)', (function(){
  const x=makeDefeat('Bài 7. Bảng nhân'); changed=null; lastParams=null;
  x.handleInput(inp(C(x.retryBtn.x+10,x.retryBtn.y+10)),0);
  return changed==='lesson' && lastParams && lastParams.title==='Bài 7. Bảng nhân';
})(), 'params='+JSON.stringify(lastParams));

// ---- regression assertions from the brief ----
chk('REGRESSION normal lesson retry != DailyState', (function(){
  const x=makeDefeat('Bài 3. Phép trừ'); changed=null;
  x.handleInput(inp(C(x.retryBtn.x+10,x.retryBtn.y+10)),0); return changed!=='daily';
})(), String(changed));
chk('REGRESSION daily retry == DailyState', (function(){
  const x=makeDefeat(DAILY); changed=null;
  x.handleInput(inp(C(x.retryBtn.x+10,x.retryBtn.y+10)),0); return changed==='daily';
})(), String(changed));

// ---- documented limitation ----
chk('KNOWN daily branch is currently unreachable in live play', (function(){
  // No Web flow builds a Defeat with the daily title: Web DailyState is the
  // reward-claim screen, not the Desktop daily quiz (main.py:2002-2130).
  const before=(SRC.match(/lessonTitle:\s*'Th/g)||[]).length;
  return before===0 && /class DailyState/.test(SRC) && !/states\.change\('defeat'[\s\S]{0,400}Th/.test(SRC.split('class DefeatState')[0]||'');
})());

console.log('');
console.log('M32_1_DEFEAT_RETRY: pass='+pass+' fail='+fail);
if(fail){console.log('FAILED:');bad.forEach(b=>console.log('  '+b));process.exit(1);}
process.exit(0);
