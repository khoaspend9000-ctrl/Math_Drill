// M30.1 ExamTransitionState parity suite.
// Desktop source of truth: main.py:3091-3138 (class ExamTransitionState),
// entry + lock main.py:682-698, handoff main.py:3118.
// GameState.handle_event is a no-op (game_init.py:2430) -> NO input is accepted.
const fs=require('fs');
require('../js/effects.js');
require('../js/save.js');
require('../js/player.js');
require('../js/state_manager.js');
const SRC=fs.readFileSync('E:/MathDrill/web/js/states_real.js','utf8');
const MAIN=fs.readFileSync('E:/MathDrill/web/js/main.js','utf8');
const st=require('../js/states_real.js');
let pass=0,fail=0;const bad=[];
function chk(n,f,d){if(f)pass++;else{fail++;bad.push(n+(d?(' :: '+d):''));}console.log((f?'PASS ':'FAIL ')+n+(d&&!f?(' :: '+d):''));}

let changed=null;
const ops=[];
const R={ctx:{},width:1300,height:800,
  clear:c=>ops.push({t:'clear',c}),
  gradient:()=>ops.push({t:'grad'}),
  roundRectPath:()=>{},
  fillRoundRect:(x,y,w,h,r,f,s,lw)=>ops.push({t:'rect',x,y,w,h,r,f,s,lw}),
  fillRoundRectAlpha:(x,y,w,h,r,f,a)=>ops.push({t:'rectA',x,y,w,h,r,f,a}),
  image:()=>ops.push({t:'img'}),
  text:(t,x,y)=>ops.push({t:'text',s:String(t),x,y})};
global.Game={renderer:R,states:{change:(n)=>{changed=n;}},assets:{get:()=>null},questionGen:null};

// ---- T01/T04 construction + Desktop __init__ values ------------------
chk('T01 ExamTransitionState exists', typeof st.ExamTransitionState==='function');
chk('T01 registered in main.js', /register\('exam_transition', new ExamTransitionState\(\)\)/.test(MAIN));
const e=new st.ExamTransitionState();
chk('T04 state name is exam_transition', e.name==='exam_transition', e.name);
chk('T04 timer 0 (main.py:3093)', e.timer===0);
chk('T04 duration 2.5 (main.py:3094)', e.duration===2.5, String(e.duration));
chk('T04 book 1200x700 (main.py:3095-3096)', e.bookW===1200&&e.bookH===700);
chk('T04 book_x = WIDTH//2 = 650 (main.py:3097)', e.bookX===650, String(e.bookX));
chk('T04 book_y = HEIGHT//2 = 400 (main.py:3098)', e.bookY===400, String(e.bookY));
chk('T04 paper_y = HEIGHT+100 = 900 (main.py:3099)', e.paperY===900, String(e.paperY));
chk('T04 paper_alpha 0 (main.py:3100)', e.paperAlpha===0);
chk('T04 paper_rotation 15.0 (main.py:3101)', e.paperRotation===15.0, String(e.paperRotation));

// ---- T02/T03 gating is a FORMULA, never a milestone lock -------------
chk('T02 no card carries a fabricated M10 lock', !/locked: 'M10'/.test(SRC));
chk('T02 exam gate uses (level-1)//6+1 (main.py:690)',
  /Math\.floor\(\(exLevel - 1\) \/ 6\) \+ 1/.test(SRC));
chk('T02 exam compares against the lesson count (main.py:691)',
  /exMaxUnlocked >= exTotal/.test(SRC));
chk('T03 lock message counts REMAINING lessons (main.py:696-697)',
  /exTotal - exMaxUnlocked/.test(SRC)&&/examMsg/.test(SRC));
chk('T03 notice lasts 3.0s (main.py:698)', /examMsgTimer = 3\.0/.test(SRC));
chk('T02 unlocked exam routes through the book flip (main.py:693 PAGE)',
  /change\('exam_transition', null, null\)/.test(SRC) && /_rbNav\.next\(goExam\)/.test(SRC));

// ---- T06/T07 animation phases ---------------------------------------
const e2=new st.ExamTransitionState();
e2.update(0.5);
chk('T06 first update advances the timer', e2.timer>0, String(e2.timer));
chk('T06 prog<=0.4 shrinks the book (main.py:3105-3107)', e2.bookW<1200&&e2.bookW>=40, 'bookW='+e2.bookW);
chk('T06 paper untouched before prog>0.6', e2.paperAlpha===0);
const e3=new st.ExamTransitionState();
e3.update(1.25);

// ---- T08 completion + T09 next state ----------------------------------
const e5=new st.ExamTransitionState();
changed=null;
e5.update(2.6);
chk('T08 prog>=1.0 completes (main.py:3117)', e5.completed===true);
changed=null; e5.update(1.0);
chk('T08 cannot complete twice (main.py:3117 runs once)', changed===null, String(changed));
chk('T09 no transition while FinalExamState is unregistered (M30.2)', changed===null);

// ---- T10/T11 input parity: Desktop accepts NONE ---------------------
const e6=new st.ExamTransitionState();
e6.update(1.0);
const beforeT=e6.timer;
e6.handleInput({consumeClick:()=>({x:650,y:400}),consumePressedKey:()=>({key:'a'})});
chk('T10 click ignored (GameState.handle_event no-op, game_init.py:2430)', e6.timer===beforeT,
  beforeT+'->'+e6.timer);
e6.handleInput({consumeClick:()=>null,consumePressedKey:()=>({key:'Escape'})});
chk('T11 ESC ignored - Desktop accepts no input here', e6.timer===beforeT);

// ---- T12 draw (main.py:3119-3137) -----------------------------------
const e7=new st.ExamTransitionState();
ops.length=0; e7.draw({},1300,800);
chk('T12 background fill (165,214,167) (main.py:3120)',
  ops.some(o=>o.t==='clear'&&String(o.c).indexOf('165,214,167')>=0));
chk('T12 book body (101,67,33) radius 10 (main.py:3124)',
  ops.some(o=>o.t==='rect'&&o.r===10&&o.f==='rgb(101,67,33)'));
chk('T12 spine (60,40,20) radius 5 (main.py:3126)',
  ops.some(o=>o.t==='rect'&&o.r===5&&o.f==='rgb(60,40,20)'));
chk('T12 spine width max(15,book_w//10)=120 (main.py:3125)',
  ops.some(o=>o.t==='rect'&&o.w===120&&o.f==='rgb(60,40,20)'), String(e7.bookW));
ops.length=0;
const e8=new st.ExamTransitionState(); e8.update(1.9);
ops.length=0; e8.draw({},1300,800);
chk('T12 paper 850x700 white at alpha (main.py:3128-3130)',
  ops.some(o=>o.t==='rectA'&&o.w===850&&o.h===700&&o.f==='#ffffff'&&o.a>0));

// ---- T05/T13 re-entry (the M29.2 state-reuse class of bug) -----------
const e9=new st.ExamTransitionState();
e9.update(2.0); e9.bookX=-200; e9.paperAlpha=200; e9.completed=true;
e9.enter();
chk('T05 enter() resets timer (main.py:3093)', e9.timer===0, String(e9.timer));
chk('T05 enter() resets book geometry (main.py:3095-3098)',
  e9.bookW===1200&&e9.bookX===650&&e9.bookY===400);
chk('T05 enter() resets paper (main.py:3099-3101)',
  e9.paperY===900&&e9.paperAlpha===0&&e9.paperRotation===15.0);
chk('T13 enter() clears the completed latch', e9.completed===false);
const sig=[];
for(let i=0;i<3;i++){
  const s=new st.ExamTransitionState(); s.enter(); s.update(0.5);
  sig.push([s.timer,s.bookW,s.bookX,s.paperAlpha,s.paperY].join('|'));
}
chk('T13 three consecutive entries produce identical state', sig[0]===sig[1]&&sig[1]===sig[2], sig.join('  '));

// ---- T14/T15 no stale timers/listeners, single handoff --------------
const body=SRC.slice(SRC.indexOf('class ExamTransitionState'), SRC.indexOf('class MenuState'));
chk('T14 no setTimeout/setInterval/rAF in the state',
  !/setTimeout|setInterval|requestAnimationFrame/.test(body));
chk('T15 completed latch yields exactly one handoff', (function(){
  const s=new st.ExamTransitionState(); let n=0;
  global.Game.states={change:function(){n++;},states:{final_exam:{}}};
  s.update(3.0); s.update(3.0); s.update(3.0);
  return n===1;})());

// ---- T16/T17 invariants + malformed input --------------------------
const e10=new st.ExamTransitionState();
let finite=true;
for(let i=0;i<400;i++){ e10.update(0.016);
  if(!isFinite(e10.timer)||!isFinite(e10.bookW)||!isFinite(e10.bookX)||
     !isFinite(e10.paperAlpha)||!isFinite(e10.paperY)||!isFinite(e10.paperRotation)) finite=false; }
chk('T16 all animation values stay finite over 400 ticks', finite);
chk('T16 book width never below the 40 floor (main.py:3107)', e10.bookW>=40, String(e10.bookW));
chk('T17 malformed input does not throw', (function(){
  const s=new st.ExamTransitionState();
  try{ s.handleInput({}); s.handleInput({consumeClick:function(){return null;}});
       s.handleInput({consumePressedKey:function(){return undefined;}}); s.update(NaN); return true; }
  catch(err){ return false; }
})());

console.log('');
if(fail) bad.forEach(b=>console.log('  FAILED: '+b));
console.log('M30_1_EXAM_TRANSITION: pass='+pass+' fail='+fail);
process.exit(fail>0?1:0);

chk('T07 prog<=0.65 slides the book left (main.py:3108-3110)', e3.bookX<650, 'bookX='+e3.bookX);
const e4=new st.ExamTransitionState();
e4.update(1.75);
chk('T07 prog>0.6 raises the paper (main.py:3111-3116)', e4.paperAlpha>0&&e4.paperY<900,
  'alpha='+e4.paperAlpha+' y='+e4.paperY);
chk('T07 paper un-rotates from 15.0 (main.py:3116)', e4.paperRotation<15.0&&e4.paperRotation>=0,
  String(e4.paperRotation));
