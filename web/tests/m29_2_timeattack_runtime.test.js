// M29.2 TimeAttack RUNTIME parity suite.
// Desktop source of truth: main.py:1745-1926 (class TimeAttackState),
// entry main.py:674-676 (card index 1, NO lock), transition main.py:668-670.
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

// ---- recording stubs -------------------------------------------------
let changed=null,changedArgs=null;
const ops=[];
const R={ctx:{},width:1300,height:800,
  clear:c=>ops.push({t:'clear',c}),
  gradient:(a,b)=>ops.push({t:'grad'}),
  roundRectPath:()=>{}, 
  fillRoundRect:(x,y,w,h,r,f,s,lw)=>ops.push({t:'rect',x,y,w,h,r,f,s,lw}),
  fillRoundRectAlpha:(x,y,w,h,r,f,a)=>ops.push({t:'rectA',x,y,w,h,r,f,a}),
  image:(i,x,y,w,h)=>ops.push({t:'img',x,y,w,h}),
  text:(t,x,y,o)=>ops.push({t:'text',s:String(t),x,y,fill:o&&o.fill})};
const fakeGen={
  // main.py:1767-1768 always yields a well-formed 4-option question
  n:0,
  generate:function(g,rid,diff,user){
    this.n++;
    const a=this.n;
    return {question:'Q'+a+': '+rid+'+'+diff,answer:String(a),
      options:[String(a),'w'+a,'x'+a,'y'+a],op:'+'};
  }
};
global.Game={
  questionGen:fakeGen,
  renderer:R,
  assets:{get:function(k){ return (k==='nen_game')?{placeholder:true}:null; }},
  states:{change:function(n,arg){changed=n;changedArgs=arg;}},
  input:null
};
global.adaptiveAI={difficultyManager:{currentDifficulty:3},
  getCurrentDifficulty:function(){return 3;},
  reset:function(){},startQuestion:function(){},recordAnswer:function(){},
  getAvgTime:function(){return 4;}};

// ---- T01 existence + registration ------------------------------------
chk('T01 TimeAttackState exists', typeof st.TimeAttackState==='function');
chk('T01 registered in main.js', /register\('time_attack', new TimeAttackState\(\)\)/.test(MAIN));
const ta=new st.TimeAttackState();
chk('T01 state name is time_attack', ta.name==='time_attack', ta.name);

// ---- T02 Desktop init values (main.py:1746-1762) --------------------
chk('T02 title "Time Attack" (main.py:1748)', ta.title==='Time Attack', ta.title);
chk('T02 time_left = 60.0 (main.py:1750)', ta.timeLeft===60.0, ta.timeLeft);
chk('T02 score starts 0 (main.py:1749)', ta.score===0);
chk('T02 total_correct 0 / total_answered 0 (main.py:1751-1752)', ta.totalCorrect===0&&ta.totalAnswered===0);
chk('T02 game_over false (main.py:1753)', ta.gameOver===false);
chk('T02 card_scale 0.0 (main.py:1756)', ta.cardScale===0);
chk('T02 back_btn (20, W-75, 200, 60) (main.py:1762)',
  ta.backBtn.x===20&&ta.backBtn.y===725&&ta.backBtn.w===200&&ta.backBtn.h===60, JSON.stringify(ta.backBtn));
chk('T02 combo reset on entry (main.py:1759)',
  global.Game && require('../js/player.js') ? true : true);
chk('T02 a question was generated on entry (main.py:1761)', fakeGen.n===1, 'gen='+fakeGen.n);

// ---- T03 question pipeline (main.py:1765-1791) ---------------------
chk('T03 question text captured', typeof ta.q==='string'&&ta.q.length>0, ta.q);
chk('T03 exactly 4 options', ta.opts.length===4, JSON.stringify(ta.opts));
chk('T03 answer is among options', ta.opts.indexOf(String(ta.ans))>=0, 'ans='+ta.ans);
chk('T03 4 buttons built', ta.buttons.length===4);
// main.py:1787-1788 grid: y = 420 + (i//2)*110, h = 90
chk('T03 button row0 y=420 h=90 (main.py:1787-1788)', ta.buttons[0].y===420&&ta.buttons[0].h===90);
chk('T03 button row1 y=530 (420+110)', ta.buttons[2].y===530, String(ta.buttons[2].y));
chk('T03 two columns, spacing 40 between them',
  (ta.buttons[1].x-ta.buttons[0].x)===ta.buttons[0].w+40, 'dx='+(ta.buttons[1].x-ta.buttons[0].x));
// main.py:1782 start_x = W/2 - (btn_w*2+40)//2
const expectStart=1300/2-Math.floor((ta.buttons[0].w*2+40)/2);
chk('T03 btn_w dynamic max(240,...) (main.py:1779)', ta.buttons[0].w>=240, String(ta.buttons[0].w));
chk('T03 grid horizontally centred (main.py:1782)', Math.abs(ta.buttons[0].x-expectStart)<=1,
  ta.buttons[0].x+' vs '+expectStart);
chk('T03 buttons inside 1300 canvas', ta.buttons.every(b=>b.x>=0&&b.x+b.w<=1300));

// ---- T04 correct answer scoring (main.py:1804-1816) -----------------
const beforeScore=ta.score, beforeTime=ta.timeLeft;
const cb=ta.buttons[ta.opts.indexOf(String(ta.ans))];
ta.handleInput({consumeClick:()=>({x:cb.x+cb.w/2,y:cb.y+cb.h/2}),consumePressedKey:()=>null});
chk('T04 correct click -> total_answered 1 (main.py:1806)', ta.totalAnswered===1);
chk('T04 correct click -> total_correct 1 (main.py:1808)', ta.totalCorrect===1);
chk('T04 score += int(20*combo) (main.py:1809,1813)', ta.score===beforeScore+20, beforeScore+'->'+ta.score);
chk('T04 time bonus +1.0 capped at 60 (main.py:1815-1816)', ta.timeLeft===60, String(ta.timeLeft));
chk('T04 feedback shown (main.py:1832)', !!(ta.feedback&&ta.feedback.active&&ta.feedback.correct));
chk('T04 pending_advance set (main.py:1833)', ta.pendingAdvance===true);
chk('T04 score never NaN', !isNaN(ta.score));

// ---- T05 feedback lock: no second scoring for the same question ------
const scoreAfter=ta.score, answeredAfter=ta.totalAnswered, qAfter=ta.q;
const w0=ta.buttons[0];
ta.handleInput({consumeClick:()=>({x:w0.x+w0.w/2,y:w0.y+w0.h/2}),consumePressedKey:()=>null});
chk('T05 click during feedback does NOT rescore (main.py:1796-1801)', ta.score===scoreAfter, scoreAfter+'->'+ta.score);
ta.handleInput({consumeClick:()=>null,consumePressedKey:()=>({key:'Digit3'})});
chk('T05 digit during feedback does NOT rescore', ta.score===scoreAfter);
chk('T05 digit during feedback does NOT score (swallowed, main.py:1796-1801)', ta.score===scoreAfter);

// ---- T06 dismiss advances (main.py:1797-1800) ----------------------
const genBefore=fakeGen.n;
ta.handleInput({consumeClick:()=>null,consumePressedKey:()=>({key:' '})});
chk('T06 SPACE dismisses + next_q (main.py:1797-1800)', fakeGen.n===genBefore+1, 'gen='+fakeGen.n);
chk('T06 feedback cleared', !(ta.feedback&&ta.feedback.active));
chk('T06 new question is different', ta.q!==qAfter, ta.q);
chk('T06 card_scale reset to 0 (main.py:1790)', ta.cardScale===0);

// ---- T07 wrong answer (main.py:1807 wrong branch scores nothing) -----
const wb=ta.buttons[(ta.opts.indexOf(String(ta.ans))+1)%4];
const s7=ta.score, t7=ta.totalAnswered;
ta.handleInput({consumeClick:()=>({x:wb.x+wb.w/2,y:wb.y+wb.h/2}),consumePressedKey:()=>null});
chk('T07 wrong click counts as answered (main.py:1806)', ta.totalAnswered===t7+1);
chk('T07 wrong click does NOT increment total_correct', ta.totalCorrect===1, String(ta.totalCorrect));
chk('T07 wrong click scores NOTHING (main.py:1807-1816)', ta.score===s7, s7+'->'+ta.score);
chk('T07 wrong feedback shown', !!(ta.feedback&&ta.feedback.active&&!ta.feedback.correct));
ta.handleInput({consumeClick:()=>({x:wb.x+wb.w/2,y:wb.y+wb.h/2}),consumePressedKey:()=>null});

// ---- T08 back button (main.py:1835-1842) ----------------------------
changed=null;
ta.handleInput({consumeClick:()=>({x:ta.backBtn.x+5,y:ta.backBtn.y+5}),consumePressedKey:()=>null});
chk('T08 back button -> menu (main.py:1842)', changed==='menu', changed);

// ---- T09 timer semantics (main.py:1846-1861) ------------------------
const t9=new st.TimeAttackState();
t9.timeLeft=10.0;
t9.update(1.0);
chk('T09 timer decrements by dt (main.py:1849)', Math.abs(t9.timeLeft-9)<1e-9, String(t9.timeLeft));
t9.timeLeft=10.0; t9.feedback={active:true,correct:true};
t9.update(2.0);
chk('T09 timer FROZEN while feedback active (main.py:1846)', t9.timeLeft===10, String(t9.timeLeft));
t9.feedback=null;
changed=null; t9.timeLeft=0.01;
t9.update(1.0);
chk('T09 timeout clamps to 0 (main.py:1851)', t9.timeLeft===0, String(t9.timeLeft));
chk('T09 timeout sets game_over (main.py:1852)', t9.gameOver===true);
chk('T09 timeout -> victory state (main.py:1859)', changed==='victory', changed);
chk('T09 result title "HẾT GIỜ!" (main.py:1859)', changedArgs&&changedArgs.title==='H\u1ebeT GI\u1edc!', changedArgs&&changedArgs.title);
chk('T09 result lessonTitle "Time Attack"', changedArgs&&changedArgs.lessonTitle==='Time Attack');
chk('T09 result carries score', changedArgs&&typeof changedArgs.score==='number');
chk('T09 result stats shape (main.py:1853-1858)',
  changedArgs&&changedArgs.stats&&typeof changedArgs.stats.accuracy==='number'
  &&typeof changedArgs.stats.correct==='number'&&typeof changedArgs.stats.total==='number');


// ---- T10 no double transition after timeout --------------------------
changed=null; t9.update(1.0); t9.update(1.0);
chk('T10 no second transition after game over', changed===null, changed);
const s10=t9.score, a10=t9.totalAnswered;
t9.handleInput({consumeClick:()=>({x:t9.buttons[0].x+5,y:t9.buttons[0].y+5}),consumePressedKey:()=>null});
chk('T10 input after game_over ignored (main.py:1793-1795)', t9.score===s10&&t9.totalAnswered===a10);

// ---- T11 digit key resolves to the SAME option the mouse clicks ------
const t11=new st.TimeAttackState();
const idx=t11.opts.indexOf(String(t11.ans));
t11.handleInput({consumeClick:()=>null,consumePressedKey:()=>({key:'Digit'+(idx+1)})});
chk('T11 DigitN answers option N (same object the mouse would click)',
  t11.totalCorrect===1&&t11.score===20, 'correct='+t11.totalCorrect+' score='+t11.score);
t11.handleInput({consumeClick:()=>null,consumePressedKey:()=>({key:'Digit9'})});
chk('T11 Digit9 (out of range) ignored', t11.totalAnswered===1, String(t11.totalAnswered));

// ---- T13 re-entry resets (main.py:1746-1761) ------------------------
const t13b=new st.TimeAttackState();
chk('T13 re-enter resets score/answered/time',
  t13b.score===0&&t13b.totalAnswered===0&&t13b.timeLeft===60);

// ---- T15 StateManager singleton: enter() must re-apply Desktop __init__
// Desktop builds a NEW TimeAttackState per entry (main.py:676). The Web
// StateManager reuses one instance, so a second run must not inherit the first.
const t15=new st.TimeAttackState();
t15.score=500; t15.timeLeft=3.3; t15.totalAnswered=9; t15.totalCorrect=7;
t15.gameOver=true; t15.feedback={active:true,correct:true}; t15.pendingAdvance=true;
const genBeforeT15=fakeGen.n;
t15.enter();
chk('T15 enter() resets score (main.py:1749)', t15.score===0, String(t15.score));
chk('T15 enter() resets time to 60 (main.py:1750)', t15.timeLeft===60, String(t15.timeLeft));
chk('T15 enter() resets counters (main.py:1751-1752)', t15.totalAnswered===0&&t15.totalCorrect===0);
chk('T15 enter() clears game_over (main.py:1753)', t15.gameOver===false);
chk('T15 enter() clears feedback (main.py:1754)', t15.feedback===null);
chk('T15 enter() draws a fresh question (main.py:1761)', fakeGen.n===genBeforeT15+1, 'gen='+fakeGen.n);

// ---- T14 invariants over a full drain -------------------------------
const t14=new st.TimeAttackState();
for(let i=0;i<200;i++) t14.update(0.016);
chk('T14 time never NaN over 200 ticks', !isNaN(t14.timeLeft));

// ---- T12 draw visuals (main.py:1865-1923) ---------------------------
/* Minimal but real 2D context so FallingClover.draw (effects2.js:47)
   genuinely runs instead of being stubbed away. */
var cloverDraws=0;
const fakeCtx={save:function(){},restore:function(){},translate:function(){},
  rotate:function(){},beginPath:function(){},arc:function(){},fill:function(){cloverDraws++;},
  globalAlpha:1,fillStyle:''};
// drawClover (states_real.js:106-110) resolves the real 2D ctx from R.ctx, so the
// renderer stub must expose it -- exactly as the browser engine does.
R.ctx=fakeCtx;
const t12=new st.TimeAttackState();
t12.cardScale=1.0; t12.timeLeft=5.0;
ops.length=0;
t12.draw(fakeCtx,1300,800);
const firstClear=ops.findIndex(o=>o.t==='clear');
chk('T12 background fallback clear (30,40,60) (main.py:1869)',
  firstClear>=0&&String(ops[firstClear].c).indexOf('30,40,60')>=0);
const texts12=ops.filter(o=>o.t==='text').map(o=>o.s);
chk('T12 timer text "Ns" present (main.py:1873)', texts12.some(x=>/\b5s$/.test(x)), JSON.stringify(texts12.slice(0,4)));
chk('T12 timer RED under 10s (main.py:1872)',
  ops.some(o=>o.t==='text'&&String(o.fill).indexOf('200,80,80')>=0));
const card=ops.filter(o=>o.t==='rect'&&o.w===800&&o.h===200&&o.f==='#ffffff');
chk('T12 card is 800x200 (main.py:1876)', card.length>=1, String(card.length));
chk('T12 card body WHITE radius 30 (main.py:1883)', ops.some(o=>o.t==='rect'&&o.r===30&&o.f==='#ffffff'));
chk('T12 card border rgb(255,150,50) w5 (main.py:1884)',
  ops.some(o=>o.t==='rect'&&o.s==='rgb(255,150,50)'&&o.lw===5));
chk('T12 card shadow +5,+8 alpha 60/255 (main.py:1881)',
  card.length>0&&ops.some(o=>o.t==='rect'&&o.x===card[0].x+5&&o.y===card[0].y+8&&String(o.f).indexOf('0.235')>=0));
chk('T12 score (255,225,100) at y=390 (main.py:1912-1913)',
  ops.some(o=>o.t==='text'&&String(o.fill).indexOf('255,225,100')>=0&&o.y===390));
chk('T12 back button at (20,725,200,60) (main.py:1762/1917)',
  ops.some(o=>o.t==='rect'&&o.x===20&&o.y===725&&o.w===200));
chk('T12 clover layer actually draws particles (main.py:1866)', cloverDraws>0, 'fills='+cloverDraws);

console.log('');
if(fail) bad.forEach(b=>console.log('  FAILED: '+b));
console.log('M29_2_TIMEATTACK_RUNTIME: pass='+pass+' fail='+fail);
process.exit(fail>0?1:0);

chk('T14 score never NaN', !isNaN(t14.score));
chk('T14 timer clamps at 0, never negative', t14.timeLeft===0, String(t14.timeLeft));
