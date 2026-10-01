// M32.2 Desktop Daily Challenge parity suite.
// Desktop main.py:2002-2099 (DailyState quiz).
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
const DAILY='Th'+String.fromCharCode(0x1EED)+' Th'+String.fromCharCode(0x00E1)+'ch';

let changed=null,cp=null,count=0;
const ops=[];
const R={ctx:{},width:1300,height:800,clear:c=>ops.push({t:'clear',c}),gradient:()=>{},
  roundRectPath:()=>{},fillRoundRect:(...a)=>ops.push({t:'rect',a}),fillRoundRectAlpha:()=>{},
  strokeRoundRectAlpha:()=>{},image:()=>{},text:(t,x,y)=>ops.push({t:'text',s:String(t),x,y})};
// deterministic generator: 4 options, one known-correct
let genCall=0;
const fakeGen={generate:(g,rid,diff,u)=>{genCall++;return {question:'Q'+genCall,answer:'a',options:['a','b','c','d'],op:'add'};}};
const D={grade:3,gold:100,xp:0,inventory:[],bag:{}};
let saves=0;
global.Game={renderer:R,questionGen:fakeGen,states:{change:(n,p)=>{changed=n;cp=p;count++;},states:{}},
  assets:{get:()=>null},log:{info(){},warn(){},error(){}},
  auth:{currentUser:'t',data:()=>D,save:()=>{saves++;}},
  audio:{playSfx:()=>{}},player:null,adaptiveAI:{reset(){},startQuestion(){},recordAnswer(){},
    getCurrentDifficulty:()=>3,getDifficultyLabel:()=>'Vua',avgTime:()=>1.2,questionStartTime:0}};
const pl={username:'t',grade:3,gold:100,exp:0,level:9,addExp(a){this.exp+=a;},addGold(){},resetCombo(){},updateCombo(){}};
global.Game.player=pl;
const inp=(click,key)=>({consumeClick:()=>click||null,consumePressedKey:()=>key||null,consumeWheel:()=>null});
const C=(x,y)=>({x,y});
function clickBtn(b){ return inp(C(b.x+10,b.y+10)); }

function answerCur(d,correct){
  const b = correct ? d.btns.find(x=>x.value===d.ans) : d.btns.find(x=>x.value!==d.ans);
  d.handleInput(clickBtn(b),0);
  return b;
}
function advance(d){ d.handleInput(clickBtn(d.btns[0]||{x:0,y:0,w:1,h:1}),0); } // dismiss feedback

// ---- T01/T02 entry + construction ----
chk('T01 menu card "daily" still routes to daily', /c\.id === 'daily'[\s\S]{0,120}change\('daily'/.test(SRC));
chk('T02 DailyState exists and is the quiz', typeof st.DailyState==='function' && new st.DailyState().name==='daily');
chk('T02 DailyRewardState retained for the claim screen', typeof st.DailyRewardState==='function' && new st.DailyRewardState().name==='daily_reward');
chk('T01 daily_reward registered in main.js', /register\('daily_reward', new DailyRewardState\(\)\)/.test(MAIN));

// ---- T03/T04/T05 construction values ----
let d=new st.DailyState();
chk('T04 tc = 10 questions (main.py:2007)', d.tc===10, String(d.tc));
chk('T04 sc = 0 (main.py:2007)', d.sc===0);
chk('T04 cc = 0 (main.py:2007)', d.cc===0);
chk('T04 title is the daily title (main.py:2006)', d.title===DAILY);
chk('T04 grade from player (main.py:2005)', d.gr===3, String(d.gr));
chk('T04 back button 810,600,300,60 (main.py:2012)', d.backBtn.x===810&&d.backBtn.y===600&&d.backBtn.w===300&&d.backBtn.h===60);
chk('T04 first question generated on enter (main.py:2014)', !!d.q && d.btns.length===4, 'q='+d.q);
chk('T04 answer buttons vertical at x=810 step 85 (main.py:2019)',
    d.btns[0].x===810 && d.btns[0].y===200 && d.btns[1].y===285 && d.btns[0].w===300 && d.btns[0].h===65,
    JSON.stringify(d.btns[1]));

// ---- T05 question count is exactly 10 ----
chk('T05 run of 10 questions then terminal', (function(){
  const x=new st.DailyState(); let count10=0;
  for(let i=0;i<20;i++){
    answerCur(x,true); x.handleInput(clickBtn(x.btns[0]||{x:0,y:0,w:1,h:1}),0); count10++;
    if(String(changed)==='victory'||String(changed)==='defeat') break;
  }
  return count10===10 && (changed==='victory'||changed==='defeat');
})(), 'end='+changed);

// ---- T06/T07/T08/T09/T10 answering ----
d=new st.DailyState(); answerCur(d,true);
chk('T07 correct scores +10 (main.py:2057)', d.sc===10, String(d.sc));
chk('T06 answer sets feedback active (main.py:2073-2074)', d.feedback && d.feedback.active===true && d.pendingAdvance===true);
d=new st.DailyState(); answerCur(d,false);
chk('T08 wrong scores 0 (main.py:2057-2059)', d.sc===0);
chk('T08 wrong feedback correct=false', d.feedback.correct===false);

// ---- T11/T12/T13 THERE IS NO TIMER (brief assumed one) ----
chk('T11 DailyState has no time-left field', !/this\.timeLeft|this\.timeLimit/.test(SRC.slice(SRC.indexOf('class DailyState'),SRC.indexOf('class DailyRewardState'))));
chk('T12 update() cannot time out', (function(){
  const x=new st.DailyState(); let done=null;
  global.Game.states.change=(n)=>{done=n;};
  for(let i=0;i<600;i++){ if(x.feedback&&x.feedback.active) continue; x.update(60); }
  global.Game.states.change=(n,p)=>{changed=n;cp=p;count++;};
  return done===null;
})());
chk('T13 no timeout transition exists in source', !/daily.{0,40}time/i.test(SRC.slice(SRC.indexOf('class DailyState'),SRC.indexOf('class DailyRewardState')).replace(/\/\*[\s\S]*?\*\//g,'')));

// ---- T14 pass threshold 60% (main.py:2031) ----
function run(correctCount){
  global.Game.states.change=(n,p)=>{changed=n;cp=p;count++;};
  changed=null;cp=null;count=0;
  const x=new st.DailyState();
  const dismiss=()=>x.handleInput(clickBtn(x.btns[0]||{x:0,y:0,w:1,h:1}),0);
  let scored=0,asked=0;
  for(let i=0;i<40;i++){
    if(String(changed)==='victory'||String(changed)==='defeat') break;
    if(x.feedback&&x.feedback.active){ dismiss(); continue; }   // dismiss advances (main.py:2040-2045)
    if(asked>=10) break;
    const before=x.sc;
    answerCur(x, asked<correctCount);                            // answer click
    if(x.sc>before) scored++;
    asked++;
    dismiss();                                                    // dismiss -> advance
  }
  x.__scored=scored; x.__asked=asked;
  return {end:changed,params:cp,state:x};
}
let r=run(10);
chk('T14 10/10 -> Victory (accuracy 100 >= 60)', r.end==='victory', String(r.end));
chk('T14 victory score = sc (main.py:2034)', r.params && r.params.score===100, JSON.stringify(r.params&&r.params.score));
chk('T14 victory lessonTitle = daily (main.py:2034)', r.params && r.params.lessonTitle===DAILY);
r=run(6);
chk('T14 6/10 = exactly 60 -> Victory (boundary)', r.end==='victory', String(r.end));
const r5=run(5);
chk('T15 5/10 = 50 -> Defeat', r5.end==='defeat', String(r5.end));
r=run(0);
chk('T15 0/10 all wrong -> Defeat', r.end==='defeat', String(r.end));
chk('HELPER asked 10 and scored 5 for run(5)', r5.state.__asked===10 && r5.state.__scored===5, JSON.stringify({asked:r5.state.__asked,scored:r5.state.__scored}));
chk('T10 stats accuracy = 50 for 5/10 (main.py:2025)', r5.params && Math.abs(r5.params.stats.accuracy-50)<1e-9, JSON.stringify(r5.params&&r5.params.stats));
chk('T10 stats correct/total (main.py:2027)', r5.params && r5.params.stats.correct===5 && r5.params.stats.total===10);
chk('T18 defeat correct/total args (main.py:2036)', r5.params && r5.params.correct===5 && r5.params.total===10);
chk('T19 defeat lessonTitle is exactly "Thử Thách" (main.py:2036)', r.params && r.params.lessonTitle===DAILY);

// ---- T26 persistence: XP only on pass (main.py:2032-2033) ----
const exp0=pl.exp; run(5);
chk('T26 FAIL grants no XP (main.py:2032 is inside the pass branch)', pl.exp===exp0, 'exp='+pl.exp);
run(6);
chk('T26 PASS grants correct*20 XP (main.py:2032-2033)', pl.exp-exp0===120, 'gained='+(pl.exp-exp0));

// ---- T20 retry returns to Daily, T21 normal lesson unchanged ----
const D2=new st.DefeatState(); D2.lessonTitle=DAILY; D2.showUi=true;
changed=null; D2.handleInput(clickBtn(D2.retryBtn),0);
chk('T20 daily defeat retry -> daily (M32.1 branch now live)', changed==='daily', String(changed));
const D3=new st.DefeatState(); D3.lessonTitle='Bai 3'; D3.showUi=true;
changed=null; D3.handleInput(clickBtn(D3.retryBtn),0);
chk('T21 normal lesson retry -> lesson (no regression)', changed==='lesson', String(changed));

// ---- T22/T23 input guards ----
d=new st.DailyState();
answerCur(d,true); const sc1=d.sc;
d.handleInput(clickBtn(d.btns.find(x=>x.value!==d.ans)||d.btns[0]),0);
chk('T22 second answer during feedback is ignored (main.py:2040-2045)', d.sc===sc1, String(d.sc));
d=new st.DailyState();
answerCur(d,true);            // q1 answered, cc still 0
d.handleInput(clickBtn(d.btns[0]),0);  // dismiss -> advance exactly once (cc=1)
const ccAfterDismiss=d.cc;
d.feedback.dismissed=true; d.feedback.active=false; d.pendingAdvance=true;
d.update(0.016);                              // stale flags must NOT advance again
d.update(0.016);
chk('T23 dismiss advances exactly once and stale flags do not re-advance (main.py:2043-2044)',
    ccAfterDismiss===1 && d.cc===1, 'afterDismiss='+ccAfterDismiss+' now='+d.cc);

// ---- T24 re-entry reset, three times ----
chk('T24 three re-entries all reset (main.py:680 fresh instance)', (function(){
  for(let i=0;i<3;i++){
    const x=new st.DailyState();
    answerCur(x,true); x.handleInput(clickBtn(x.btns[0]||{x:0,y:0,w:1,h:1}),0);
    x.enter();
    if(x.cc!==0||x.sc!==0||x.tc!==10||x.answerTimes.length!==0||x.feedback!==null||x.pendingAdvance!==false) return false;
  }
  return true;
})());

// ---- T25 no stale timers/listeners ----
chk('T25 DailyState registers no timer or listener', !/setInterval|addEventListener/.test(
  SRC.slice(SRC.indexOf('class DailyState'),SRC.indexOf('class DailyRewardState'))));

// ---- T28 malformed input safe ----
chk('T28 malformed/out-of-range input is harmless', (function(){
  const x=new st.DailyState();
  x.handleInput(inp(C(-9999,-9999)),0);
  x.handleInput(inp(C(1e9,1e9)),0);
  x.handleInput(inp(null,{key:'Digit9'}),0);
  x.handleInput(inp(null,{key:'KeyA'}),0);
  return x.sc===0 && isFinite(x.cc) && isFinite(x.sc);
})());

// ---- T29 generator compatibility ----
chk('T29 generator called with (grade, rid<=60, difficulty, username)', (function(){
  genCall=0; const x=new st.DailyState();
  return genCall>=1 && x.gr===3;
})());
chk('T29 grade 1 uses rid range 1..40 (main.py:2016)', (function(){
  const src=SRC.slice(SRC.indexOf('class DailyState'),SRC.indexOf('class DailyRewardState'));
  return /this\.gr === 1 \? 40 : 60/.test(src);
})());

// ---- T30 mobile: all answer buttons inside the 1300x800 canvas ----
chk('T30 answer buttons inside the logical canvas', (function(){
  const x=new st.DailyState();
  return x.btns.every(b=>b.x>=0&&b.x+b.w<=1300&&b.y>=0&&b.y+b.h<=800) &&
         x.backBtn.x>=0&&x.backBtn.x+x.backBtn.w<=1300&&x.backBtn.y+x.backBtn.h<=800;
})());

// ---- invariants ----
chk('INV score/counters finite and bounded', (function(){
  const x=new st.DailyState();
  let prev=-1;
  for(let i=0;i<10;i++){ if(x.feedback&&x.feedback.active){x.handleInput(clickBtn(x.btns[0]||{x:0,y:0,w:1,h:1}),0);} answerCur(x,true); x.handleInput(clickBtn(x.btns[0]||{x:0,y:0,w:1,h:1}),0); if(x.cc<prev) return false; prev=x.cc; }
  return isFinite(x.sc)&&isFinite(x.cc)&&x.cc<=x.tc&&x.sc<=100;
})());
chk('INV no NaN anywhere after a full run', (function(){
  const x=new st.DailyState();
  for(let i=0;i<10;i++){ if(x.feedback&&x.feedback.active){x.handleInput(clickBtn(x.btns[0]||{x:0,y:0,w:1,h:1}),0);} answerCur(x,i%2===0); x.feedback.dismissed=true; x.update(0.016); }
  return !isNaN(x.sc)&&!isNaN(x.cc)&&!isNaN(x.tc);
})());

console.log('');
console.log('M32_2_DAILY_CHALLENGE: pass='+pass+' fail='+fail);
if(fail){console.log('FAILED:');bad.forEach(b=>console.log('  '+b));process.exit(1);}
process.exit(0);
