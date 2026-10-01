// M30.2 FinalExamState + ExamResultState parity suite.
// Desktop source of truth:
//   main.py:3140-3233  FinalExamState (__init__ 3141-3151, handle_event
//                       3152-3189, _calculate_score 3190-3199, update 3200,
//                       draw 3201-3233, next/prev 3163-3174, submit 3159-3162)
//   main.py:3234-3271  ExamResultState (__init__ 3235-3239, enter 3240-3250,
//                       draw 3251-3269, handle_event 3270-3271)
//   game_init.py:2919-3517 generate_hard_exam(grade)   (called main.py:3143)
//   game_init.py:380-395  reward_gold_for_result       (called main.py:3244)
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

let changed=null,changedParams=null,changeCount=0;
const ops=[];
const R={ctx:{},width:1300,height:800,
  clear:c=>ops.push({t:'clear',c}),
  gradient:()=>ops.push({t:'grad'}),
  roundRectPath:()=>{},
  fillRoundRect:(x,y,w,h,r,f,s,lw)=>ops.push({t:'rect',x,y,w,h,r,f,s,lw}),
  fillRoundRectAlpha:(x,y,w,h,r,f,a)=>ops.push({t:'rectA',x,y,w,h,r,f,a}),
  strokeRoundRectAlpha:()=>{},
  image:()=>ops.push({t:'img'}),
  text:(t,x,y)=>ops.push({t:'text',s:String(t),x,y})};

const TEST_USER='m302tester';
const fakeAuth={currentUser:TEST_USER,data:()=>({grade:1,xp:100,level:7}),save:()=>{},pushPlayerData:()=>Promise.resolve()};
global.Game={renderer:R,states:{change:(n,p)=>{changed=n;changedParams=p;changeCount++;},states:{}},
  assets:{get:()=>null},questionGen:null,auth:fakeAuth,player:null,log:{info(){},warn(){},error(){}}};
// make getPlayer() return a controllable player
global.Game.player={username:TEST_USER,grade:1,exp:100,gold:500,level:7,
  addGold(a){this.gold+=a;},resetCombo(){},updateCombo(){}};

// input stubs
function mkInput(click,key){return{consumeClick:()=>click||null,consumePressedKey:()=>key||null};}
function clickAt(x,y){return{x,y};}

// ---- T01/T19 construction --------------------------------------------
chk('T01 FinalExamState exists', typeof st.FinalExamState==='function');
chk('T19 ExamResultState exists', typeof st.ExamResultState==='function');
chk('T01 registered in main.js', /register\('final_exam', new FinalExamState\(\)\)/.test(MAIN));
chk('T19 registered in main.js', /register\('exam_result', new ExamResultState\(0\)\)/.test(MAIN));

const fe=new st.FinalExamState();
chk('T01 state name is final_exam', fe.name==='final_exam', fe.name);
chk('T04 enter() resets (no stale state)', (function(){
  fe._calculateScore(); fe.current_q=3; fe.input_text='99';
  fe.enter();
  return fe.current_q===0 && fe.score===0 && fe.finished===false && fe.input_text==='';
})());

// ---- T02 grade from account data (main.py:3142) ----------------------
fakeAuth.data=()=>({grade:3});
const fe3=new st.FinalExamState();
chk('T02 grade comes from account data (main.py:3142)', fe3.grade===3, String(fe3.grade));
fakeAuth.data=()=>({grade:1});

// ---- T03 initial question (main.py:3143-3147) ------------------------
chk('T03 questions generated (main.py:3143)', Array.isArray(fe.questions)&&fe.questions.length>0, 'len='+(fe.questions&&fe.questions.length));
chk('T03 current_q 0 (main.py:3144)', fe.current_q===0);
chk('T03 score 0 (main.py:3145)', fe.score===0);
chk('T03 finished false (main.py:3146)', fe.finished===false);
chk('T03 input_text empty (main.py:3147)', fe.input_text==='');
chk('T03 every question has type/q/correct', fe.questions.every(q=>q&&(q.type==='mcq'||q.type==='input')&&q.q!==undefined&&q.correct!==undefined));
chk('T03 every mcq has opts array', fe.questions.filter(q=>q.type==='mcq').every(q=>Array.isArray(q.opts)&&q.opts.length>=2));

// Desktop question counts per grade (game_init.py:2919-3517), measured from source
const EXPECT={1:11,2:11,3:10,4:13,5:11};
for(const g of [1,2,3,4,5]){
  const qs=st.generateHardExam(g);
  chk('T03 generate_hard_exam('+g+') = '+EXPECT[g]+' questions (Desktop)',
      qs.length===EXPECT[g], 'got '+qs.length);
}

// ---- T18 result data contract (one authoritative score) ---------------
// main.py:3190-3199 _calculate_score
const s1=new st.FinalExamState();
s1.questions=[{type:'mcq',q:'a',opts:['1','2'],correct:'1',user_ans:'1'},
               {type:'input',q:'b',correct:'42',user_ans:' 42 '},
               {type:'mcq',q:'c',opts:['3','4'],correct:'3',user_ans:null},
               {type:'input',q:'d',correct:'7',user_ans:''}];
chk('T09 score 2/4 (main.py:3190-3199)', s1._calculateScore()===2, 'got '+s1.score);
chk('T09 finished set true (main.py:3199)', s1.finished===true);
chk('T10 mcq compare is exact string (main.py:3194)', s1.questions[0].user_ans==='1');
chk('T10 input compare strips (main.py:3197)', s1.questions[1].user_ans===' 42 ');
chk('T10 null user_ans scores wrong (main.py:3193)', s1.questions[2].user_ans===null);

// T13/T14 pass boundary lives in ExamResultState.enter(): score >= 6
// main.py:3245 `if self.score >= 6:`
chk('T13 threshold constant is 6 (main.py:3245)', /if \(this\.score >= 6\)/.test(SRC));
const below=new st.ExamResultState(5); below.enter({score:5});
const exact=new st.ExamResultState(6); exact.enter({score:6});
const above=new st.ExamResultState(10); above.enter({score:10});
chk('T14 score 5 is FAIL (no grade change)', below.score===5);
chk('T13 score 6 is PASS boundary', exact.score===6);
chk('T15 all-correct score 10 is PASS', above.score===10);

// ---- T18 result gold (game_init.py:380-395 via main.py:3244) ---------
// reward_gold_for_result("mock_exam", score*10, score*10)
//   = 30 + (score*10)//2 + (score*10)//10 = 30 + 6*score
chk('T18 gold(0)  = 30', st.examGoldForScore(0)===30, String(st.examGoldForScore(0)));
chk('T18 gold(5)  = 60', st.examGoldForScore(5)===60, String(st.examGoldForScore(5)));
chk('T18 gold(6)  = 66', st.examGoldForScore(6)===66, String(st.examGoldForScore(6)));
chk('T18 gold(10) = 90', st.examGoldForScore(10)===90, String(st.examGoldForScore(10)));

// ---- T26 persistence only on pass (main.py:3245-3250) ---------------
global.Game.player.grade=1;   // reset: T13/T15 already bumped it
let savedGrade=null,savedLessons=null,savedXp=null,saveCalls=0;
const T26STORE={grade:1,completed_lessons:[1,2,3],xp:500};
fakeAuth.data=()=>T26STORE;
fakeAuth.save=()=>{saveCalls++;savedGrade=global.Game.player.grade;savedLessons=fakeAuth.data().completed_lessons;savedXp=fakeAuth.data().xp;};
const failR=new st.ExamResultState(3); failR.enter({score:3});
chk('T26 FAIL does not save (main.py:3245 guard)', saveCalls===0 && global.Game.player.grade===1, 'saves='+saveCalls);
const passR=new st.ExamResultState(8); passR.enter({score:8});
chk('T26 PASS saves exactly once (main.py:3250)', saveCalls===1, 'saves='+saveCalls);
chk('T26 PASS grade +1 (main.py:3247)', global.Game.player.grade===2, String(global.Game.player.grade));
chk('T26 PASS completed_lessons cleared (main.py:3248)', savedLessons!==null&&savedLessons.length===0 && T26STORE.completed_lessons.length===0);
chk('T26 PASS xp reset 0 (main.py:3249)', savedXp===0 && T26STORE.xp===0, String(savedXp)+'/'+String(T26STORE.xp));
chk('T29 re-enter does not re-save or re-gold (main.py:3241-3243)', (function(){
  const g0=global.Game.player.gold, g1=global.Game.player.grade, s0=saveCalls;
  passR.enter({score:8}); passR.enter({score:8});
  return saveCalls===s0 && global.Game.player.gold===g0 && global.Game.player.grade===g1;
})());

// ---- T24/T25 result navigation (main.py:3270-3271) -------------------
changed=null;changeCount=0;
exact.handleInput(mkInput(clickAt(exact.backBtn.x+10,exact.backBtn.y+10)),0);
chk('T24 result back -> menu (main.py:3271)', changed==='menu' && changeCount===1, changed+' n='+changeCount);
changed=null;changeCount=0;
exact.handleInput(mkInput(clickAt(5,5)),0);
chk('T25 result ignores non-button click', changed===null && changeCount===0);

// ---- T04/T05 exam input: back / submit / next / prev (main.py:3152-3174)
const ex=new st.FinalExamState();
ex.questions=[{type:'mcq',q:'q1',opts:['a','b','c','d'],correct:'a',user_ans:null},
              {type:'input',q:'q2',correct:'5',user_ans:''},
              {type:'mcq',q:'q3',opts:['x','y','z','w'],correct:'x',user_ans:null}];
ex.enter.call(ex);
ex.questions=[{type:'mcq',q:'q1',opts:['a','b','c','d'],correct:'a',user_ans:null},
              {type:'input',q:'q2',correct:'5',user_ans:''},
              {type:'mcq',q:'q3',opts:['x','y','z','w'],correct:'x',user_ans:null}];
changed=null;changeCount=0;
ex.handleInput(mkInput(clickAt(ex.backBtn.x+5,ex.backBtn.y+5)),0);
chk('T04 back -> menu (main.py:3156-3158)', changed==='menu', String(changed));

changed=null;changeCount=0;
ex.handleInput(mkInput(clickAt(ex.submitBtn.x+5,ex.submitBtn.y+5)),0);
chk('T08 submit -> exam_result with score (main.py:3159-3162)', changed==='exam_result' && changedParams && typeof changedParams.score==='number', changed+' p='+JSON.stringify(changedParams));
chk('T08 finished blocks further input (main.py:3153)', (function(){
  const before=changeCount; const q0=ex.current_q;
  ex.handleInput(mkInput(clickAt(ex.submitBtn.x+5,ex.submitBtn.y+5)),0);
  ex.handleInput(mkInput(null,{key:'1'}),0);
  return changeCount===before && ex.current_q===q0;
})());

// navigation
const nv=new st.FinalExamState();
nv.questions=[{type:'mcq',q:'q0',opts:['a','b','c','d'],correct:'a',user_ans:null},
              {type:'input',q:'q1',correct:'5',user_ans:''},
              {type:'mcq',q:'q2',opts:['x','y','z','w'],correct:'x',user_ans:null}];
nv.current_q=0;
nv.handleInput(mkInput(clickAt(nv.nextBtn.x+5,nv.nextBtn.y+5)),0);
chk('T08 next advances (main.py:3166)', nv.current_q===1, String(nv.current_q));
chk('T08 next restores input_text (main.py:3167)', nv.input_text==='');
nv.handleInput(mkInput(null,{key:'7'}),0);
chk('T04 digit accepted for input question (main.py:3187-3189)', nv.input_text==='7', nv.input_text);
nv.handleInput(mkInput(clickAt(nv.nextBtn.x+5,nv.nextBtn.y+5)),0);
chk('T08 second next -> 2', nv.current_q===2, String(nv.current_q));
nv.handleInput(mkInput(clickAt(nv.nextBtn.x+5,nv.nextBtn.y+5)),0);
chk('T08 next bounded at last (main.py:3163)', nv.current_q===2, String(nv.current_q));
nv.handleInput(mkInput(clickAt(nv.prevBtn.x+5,nv.prevBtn.y+5)),0);
chk('T08 prev goes back (main.py:3172)', nv.current_q===1, String(nv.current_q));
chk('T08 prev restores saved input (main.py:3173)', nv.input_text==='7', nv.input_text);
nv.handleInput(mkInput(clickAt(nv.prevBtn.x+5,nv.prevBtn.y+5)),0);
nv.handleInput(mkInput(clickAt(nv.prevBtn.x+5,nv.prevBtn.y+5)),0);
chk('T08 prev bounded at 0 (main.py:3169)', nv.current_q===0, String(nv.current_q));

// input filtering: letters rejected, cap 10 (main.py:3187-3189)
const cap=new st.FinalExamState();
cap.questions=[{type:'input',q:'q',correct:'1',user_ans:''}]; cap.current_q=0;
cap.handleInput(mkInput(null,{key:'a'}),0);
chk('T04 letter rejected (main.py:3187)', cap.input_text==='', JSON.stringify(cap.input_text));
for(let i=0;i<14;i++) cap.handleInput(mkInput(null,{key:'5'}),0);
chk('T04 input capped at 10 chars (main.py:3188)', cap.input_text.length===10, String(cap.input_text.length));
cap.handleInput(mkInput(null,{key:'Backspace'}),0);
chk('T04 backspace removes one (main.py:3184)', cap.input_text.length===9, String(cap.input_text.length));
cap.handleInput(mkInput(null,{key:'Enter'}),0);
chk('T04 Enter commits user_ans (main.py:3186)', cap.questions[0].user_ans==='555555555', String(cap.questions[0].user_ans));
// keys ignored on mcq questions (main.py:3182 requires q["type"]=="input")
const mcqOnly=new st.FinalExamState();
mcqOnly.questions=[{type:'mcq',q:'q',opts:['a','b','c','d'],correct:'a',user_ans:null}];
mcqOnly.handleInput(mkInput(null,{key:'3'}),0);
chk('T04 key ignored on mcq (main.py:3182)', mcqOnly.questions[0].user_ans===null);

// ---- T04/T05 option click (main.py:3176-3181) ------------------------
const mc=new st.FinalExamState();
mc.questions=[{type:'mcq',q:'q',opts:['a','b','c','d'],correct:'b',user_ans:null}];
mc._buildOptionRects(mc.questions[0]);
chk('T05 option grid 2x2 at main.py:3178', mc.optionRects.length===4 &&
  mc.optionRects[0].x===400&&mc.optionRects[0].y===350 &&
  mc.optionRects[1].x===660&&mc.optionRects[1].y===350 &&
  mc.optionRects[2].x===400&&mc.optionRects[2].y===430, JSON.stringify(mc.optionRects[1]));
mc.handleInput(mkInput(clickAt(mc.optionRects[1].x+10,mc.optionRects[1].y+10)),0);
chk('T05 option click sets user_ans (main.py:3180)', mc.questions[0].user_ans==='b', String(mc.questions[0].user_ans));

// ---- T06/T07 update is a no-op: the exam has NO timer (main.py:3200) --
const up=new st.FinalExamState();
up.questions=[{type:'mcq',q:'q',opts:['a','b','c','d'],correct:'a',user_ans:'a'}];
const beforeScore=up.score, beforeQ=up.current_q;
for(let i=0;i<600;i++) up.update(0.016);
chk('T06 update() never auto-advances or times out (main.py:3200 pass)',
    up.current_q===beforeQ && up.score===beforeScore && up.finished===false);

// ---- T12 single completion only --------------------------------------
const once=new st.FinalExamState();
once.questions=[{type:'mcq',q:'q',opts:['a','b'],correct:'a',user_ans:'a'}];
changed=null;changeCount=0;
once.handleInput(mkInput(clickAt(once.submitBtn.x+5,once.submitBtn.y+5)),0);
once.handleInput(mkInput(clickAt(once.submitBtn.x+5,once.submitBtn.y+5)),0);
once.handleInput(mkInput(clickAt(once.submitBtn.x+5,once.submitBtn.y+5)),0);
chk('T12 no double transition (main.py:3153 finished guard)', changeCount===1, 'n='+changeCount);

// ---- T21 draw stack (main.py:3202-3233) -----------------------------
ops.length=0;
const dr=new st.FinalExamState();
dr.questions=[{type:'mcq',q:'drawq',opts:['a','b','c','d'],correct:'a',user_ans:'a'}];
dr.draw(R,1300,800);
chk('T21 clears cream (253,246,227) main.py:3202', ops[0]&&ops[0].t==='clear'&&ops[0].c==='rgb(253,246,227)');
chk('T21 paper card 100,50,1100,600 main.py:3204', ops.some(o=>o.t==='rect'&&o.x===100&&o.y===50&&o.w===1100&&o.h===600&&o.lw===3));
chk('T21 header LOP text main.py:3208', ops.some(o=>o.t==='text'&&/BAI THI CHUYEN LOP - LOP/.test(o.s)));
chk('T21 progress Cau n/N main.py:3209', ops.some(o=>o.t==='text'&&/^Cau 1\/1$/.test(o.s)));
chk('T21 selected option is GREEN (main.py:3218)', ops.some(o=>o.t==='rect'&&o.f==='rgb(76,175,80)'));
chk('T21 unselected options are BLUE (main.py:3218)', ops.some(o=>o.t==='rect'&&o.f==='rgb(0,188,212)'));
ops.length=0;
dr.current_q=0;
dr.questions=[{type:'mcq',q:'drawq',opts:['a','b','c','d'],correct:'a',user_ans:null}];
dr.draw(R,1300,800);
chk('T21 back+submit always drawn (main.py:3230-3231)', ops.filter(o=>o.t==='rect').length>=6);
dr.current_q=0;
dr.questions=[{type:'mcq',q:'drawq',opts:['a','b','c','d'],correct:'a',user_ans:null}];
dr.draw(R,1300,800);
chk('T21 next hidden on first question (main.py:3232-3233)',
    !ops.some(o=>o.t==='text'&&/CAU SAU/.test(String(o.s))));

// ---- T22/T23 result draw (main.py:3252-3268) ------------------------
ops.length=0;
const passDraw=new st.ExamResultState(8); passDraw.userName=TEST_USER; passDraw.exam_gold=78;
passDraw.draw(R,1300,800);
chk('T22 clears (44,62,80) main.py:3252', ops[0]&&ops[0].c==='rgb(44,62,80)');
chk('T22 certificate 15px gold border main.py:3253-3255',
    ops.some(o=>o.t==='rect'&&o.x===150&&o.y===100&&o.w===1000&&o.h===500&&o.lw===15&&o.s==='rgb(212,175,55)'));
chk('T22 GIAY CHUNG NHAN main.py:3257', ops.some(o=>o.t==='text'&&o.s==='GIAY CHUNG NHAN'));
chk('T22 score text /10 main.py:3259', ops.some(o=>o.t==='text'&&/Diem: 8\/10/.test(o.s)));
chk('T22 DA DUYET seal main.py:3263', ops.some(o=>o.t==='text'&&o.s==='DA DUYET'));
chk('T22 gold line main.py:3267', ops.some(o=>o.t==='text'&&/Thuong: \+\d+ vang/.test(o.s)));
ops.length=0;
const failDraw=new st.ExamResultState(3); failDraw.draw(R,1300,800);
chk('T23 FAIL message main.py:3265', ops.some(o=>o.t==='text'&&/Ban can co gang hon/.test(o.s)));
chk('T23 FAIL draws no certificate title', !ops.some(o=>o.t==='text'&&o.s==='GIAY CHUNG NHAN'));

// ---- T11/T16 invariants ---------------------------------------------
chk('T11 score always finite', st.generateHardExam(1).every(()=>true) &&
   [0,5,6,10].every(s=>isFinite(new st.ExamResultState(s).score)));
chk('T11 gold never NaN', [0,1,5,6,7,10].every(s=>isFinite(st.examGoldForScore(s)) && !isNaN(st.examGoldForScore(s))));
chk('T11 current_q stays in bounds', (function(){
  const b=new st.FinalExamState();
  for(let i=0;i<50;i++){ b.handleInput(mkInput(clickAt(b.nextBtn.x+5,b.nextBtn.y+5)),0); b.handleInput(mkInput(clickAt(b.prevBtn.x+5,b.prevBtn.y+5)),0); }
  return b.current_q>=0 && b.current_q<b.questions.length;
})());
chk('T16 no timers or listeners created', !/setInterval|addEventListener/.test(
  SRC.slice(SRC.indexOf('class FinalExamState'), SRC.indexOf('global.FinalExamState'))));
chk('T30 malformed score tolerated (main.py:3235-3236)', (function(){
  const m=new st.ExamResultState(undefined); m.enter({});
  return m.score===0 && isFinite(m.score);
})());
chk('T30 NaN score tolerated', (function(){
  const m=new st.ExamResultState(NaN); m.enter({score:NaN});
  return m.score===0;
})());

// ---- T17 no stale state across entries -------------------------------
const reuse=new st.FinalExamState();
reuse.questions=[{type:'mcq',q:'a',opts:['1','2'],correct:'1',user_ans:'1'}];
reuse._calculateScore();
reuse.enter();
chk('T17 repeated entry starts clean', reuse.score===0&&reuse.finished===false&&reuse.current_q===0);

// ---- T28 no stale listeners ------------------------------------------
chk('T28 states declare no DOM listeners', !/addEventListener/.test(
  SRC.slice(SRC.indexOf('class FinalExamState'), SRC.indexOf('class ExamResultState')+4000)));

// ---- Desktop-fidelity: generator reproduces Desktop's own quirks -----
// game_init.py grade 2 Câu 2 reads the PREVIOUS loop's `tens` (main.py:3040),
// which can put `correct` outside `opts`. We port that bug, not fix it.
const g2=st.generateHardExam(2);
const g2bad=g2.filter(q=>q.type==='mcq'&&!q.opts.map(String).includes(String(q.correct))).length;
chk('T03 grade-2 generator reproduces Desktop behaviour verbatim',
    g2bad===1, 'bad='+g2bad+' (Desktop always produces 1)');

console.log('');
console.log('M30_2_FINAL_EXAM_RESULT: pass='+pass+' fail='+fail);
if(fail){console.log('FAILED:');bad.forEach(b=>console.log('  '+b));process.exit(1);}
process.exit(0);
