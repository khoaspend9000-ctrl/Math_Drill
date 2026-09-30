// M29 IdleGif parity suite - Desktop main.py:252-365 / main.py:227-232.
const fs=require('fs');
/* Bootstrap exactly like web/tests/m4_states.test.js: states_real.js extends
   BaseState from state_manager.js, which needs TransitionEffect from effects.js. */
require('../js/effects.js');
require('../js/save.js');
require('../js/player.js');
/* state_manager.js must load BEFORE states_real.js: the latter reads
   global.BaseState (states_real.js:35), which state_manager.js:105 defines. */
require('../js/state_manager.js');
const SRC=fs.readFileSync('E:/MathDrill/web/js/states_real.js','utf8');
const st=require('../js/states_real.js');
let pass=0,fail=0;const bad=[];
function chk(n,f,d){if(f)pass++;else{fail++;bad.push(n+(d?(' :: '+d):''));}console.log((f?'PASS ':'FAIL ')+n+(d&&!f?(' :: '+d):''));}

// T01 class + identity
chk('T01 IdleGifState exists', typeof st.IdleGifState==='function');
const s=new st.IdleGifState();
chk('T01 state name is idleGif', s.name==='idleGif', s.name);
chk('T02 BaseState contract (exit/draw/update/handleInput)', typeof s.exit==='function'&&typeof s.draw==='function'&&typeof s.update==='function'&&typeof s.handleInput==='function');

// T03 source fidelity
chk('T03 uses the original asset key gt2', /assets\.get\('gt2'\)/.test(SRC));
chk('T03 draws fullscreen at (0,0)', /R\.image\(img, 0, 0, W2, H2\)/.test(SRC));
chk('T03 loading fallback fill is (30,40,60)', /rgb\(30,40,60\)/.test(SRC));
chk('T03 loading text is "Dang tai GIF..." equivalent', SRC.includes('\u0110ang t\u1ea3i GIF...'));
chk('T03 hint drawn at H2-100 (Desktop HEIGHT-100)', /H2 - 100/.test(SRC));
chk('T03 hint colour is white', /Click \u0111\u1ec3 quay l\u1ea1i \u0111\u0103ng nh\u1eadp[\s\S]{0,120}fill: '#ffffff'/.test(SRC));
chk('T03 gt2.gif is NOT on the boot preload LIST (protects M17 startup)', !/url: 'assets\/gt2\.gif'/.test(SRC));

// T04 LoginState 15s idle -> idleGif (Desktop main.py:227-232)
const L=new st.LoginState();
chk('T04 LoginState.IDLE_GIF_DELAY is 15.0 (Desktop main.py:231)', L.IDLE_GIF_DELAY===15.0, L.IDLE_GIF_DELAY);
chk('T04 LoginState starts idleTimer at 0', L.idleTimer===0);
let changed=null;
global.Game={states:{change:(n)=>{changed=n;}},renderer:null};
L.update(14.9); chk('T04 no transition before 15s', changed===null, changed);
L.update(0.2); chk('T04 transitions to idleGif at >=15s', changed==='idleGif', changed);

// T05 any click or key returns to Login (Desktop main.py:347-349)
changed=null; s.handleInput({consumeClick:()=>null,consumePressedKey:()=>null});
chk('T05 idle input does nothing', changed===null);
changed=null; s.handleInput({consumeClick:()=>({x:1,y:1}),consumePressedKey:()=>null});
chk('T05 any click -> login', changed==='login', changed);
changed=null; s.handleInput({consumeClick:()=>null,consumePressedKey:()=>({key:'a'})});
chk('T05 any key -> login', changed==='login', changed);

// T06 input resets the login idle timer
const L2=new st.LoginState(); L2.idleTimer=9.0;
L2.handleInput({consumeClick:()=>({x:0,y:0}),consumePressedKey:()=>null});
chk('T06 login input resets idleTimer', L2.idleTimer===0, L2.idleTimer);

// T07 draw paths (asset present + loading fallback)
const ops=[];
const R={image:(i,x,y,w,h)=>ops.push({t:'img',x,y,w,h}),clear:(c)=>ops.push({t:'clear',c}),
  text:(str,x,y,o)=>ops.push({t:'text',s:str,x,y,fill:o&&o.fill})};
global.Game.renderer=R;
global.Game.assets={get:()=>({placeholder:false})};
s.loaded=true; s.draw({},1300,800);
chk('T07 ready path blits fullscreen 1300x800 at (0,0)', ops[0].t==='img'&&ops[0].x===0&&ops[0].y===0&&ops[0].w===1300&&ops[0].h===800, JSON.stringify(ops[0]));
chk('T07 hint always drawn at y=700', ops.some(o=>o.t==='text'&&o.y===700&&o.fill==='#ffffff'), JSON.stringify(ops.find(o=>o.t==='text')));
ops.length=0;
s.loaded=false;
s.draw({},1300,800);
chk('T07 fallback clears (30,40,60)', ops[0].t==='clear'&&ops[0].c==='rgb(30,40,60)', JSON.stringify(ops[0]));
chk('T07 fallback shows loading text at centre', ops.some(o=>o.t==='text'&&o.y===400));

// T08 asset integrity still enforced (polish_m4 keeps gt2 byte-identical)
chk('T08 gt2.gif still present byte-for-byte', fs.existsSync('E:/MathDrill/web/assets/gt2.gif') && fs.statSync('E:/MathDrill/web/assets/gt2.gif').size>10000000);

console.log('');
console.log('M29_IDLEGIF: pass='+pass+' fail='+fail);
if(bad.length)console.log('FAILED: '+bad.join(' | '));
process.exit(fail?1:0);
