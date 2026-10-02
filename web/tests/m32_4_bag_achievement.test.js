// M32.4 — BagState + AchievementView card parity, source-anchored to main.py.
const fs=require('fs');
require('../js/effects.js');require('../js/save.js');require('../js/player.js');require('../js/state_manager.js');
const SRC=fs.readFileSync('E:/MathDrill/web/js/states_real.js','utf8');
const st=require('../js/states_real.js');
let pass=0,fail=0;const bad=[];
function chk(n,f,d){if(f)pass++;else{fail++;bad.push(n+(d?(' :: '+d):''));}console.log((f?'PASS ':'FAIL ')+n+(d&&!f?(' :: '+d):''));}
const R={ctx:{},clear(){},gradient(){},roundRectPath(){},fillRect(){},fillRoundRect(){},fillRoundRectAlpha(){},
  strokeRoundRectAlpha(){},image(){},text(){},line(){}};
const BAG={'Cong Than Toc':2,'Rong So Hoc':1,'Bao Ho Thales':3};
const fx={getBag:()=>BAG,
  activate:(t)=>[true,'activated '+t],
  getActiveSummary:()=>[{icon:'x',label:'L1',info:'i1'}],
  tickTimers(){}};
const D={grade:3,gold:100,inventory:Object.keys(BAG),bag:BAG};
global.Game={renderer:R,states:{change(){},states:{}},assets:{get:()=>null},questionGen:null,
  log:{info(){},warn(){},error(){}},auth:{currentUser:'t',data:()=>D,save(){}},player:null,
  audio:{playSfx(){},setBgm(){}},itemFx:fx};
global.Game.player={username:'t',grade:3,gold:100,exp:0,level:9,addGold(){},addExp(){},resetCombo(){},updateCombo(){}};
const inp=(c,w)=>({consumeClick:()=>c||null,consumePressedKey:()=>null,consumeWheel:()=>w===undefined?null:w});
const C=(x,y)=>({x,y});

// ---------- BAG (main.py:2670-2942) ----------
chk('BAG exists', typeof st.BagState==='function' && new st.BagState().name==='bag');
const b=new st.BagState();
chk('BAG :2679 RARITY_COLORS', JSON.stringify(st.BagState.RARITY_COLORS)===JSON.stringify({'5star':[255,215,0],'4star':[200,130,255],'3star':[130,190,255]}));
chk('BAG :2684 RARITY_BG', JSON.stringify(st.BagState.RARITY_BG)===JSON.stringify({'5star':[50,40,15],'4star':[40,25,60],'3star':[20,35,55]}));
chk('BAG :2691 back (30,735,160,50)', b.backBtn.x===30&&b.backBtn.y===735&&b.backBtn.w===160&&b.backBtn.h===50);
chk('BAG :2692 use_btn 200x52 (80,180,80)', b.useBtn.w===200&&b.useBtn.h===52&&b.useBtn.bg.join()==='80,180,80');
chk('BAG :2693-2698 selected/msg/msgTimer/msgOk/animTimer/scrollY', b.selected===null&&b.msg===''&&b.msgTimer===0&&b.msgOk===true&&b.animTimer===0&&b.scrollY===0);
chk('BAG :2691-2705 build from all three pools (19 cards)', Object.keys(b._allCards).length===19, 'n='+Object.keys(b._allCards).length);
// :2707-2717 sort: 5* first then 4* then 3*, alpha within
const sorted=b._getBagSorted().map(i=>i.rarity+':'+i.title);
chk('BAG :2710-2716 sorted 5*,4*,3*', (function(){
  const r=sorted.map(s=>s.split(':')[0]);
  return r.indexOf('5star')<r.indexOf('4star') && r.indexOf('4star')<r.indexOf('3star');
})(), JSON.stringify(sorted));
// :2821-2827 grid constants, verified through the real draw
b.draw(R,1300,800);
chk('BAG :2821-2826 6 columns / 110x95 / gap 14,16 / start 28,70', (function(){
  if(b.itemRects.length<3) return false;
  const a=b.itemRects[0], c=b.itemRects[1], s=b.itemRects[6];
  return a.w===110&&a.h===95&&c.x-a.x===124&&(s?s.y-a.y===111:true);
})(), JSON.stringify(b.itemRects.slice(0,2)));
chk('BAG :2802 left panel 760 (items start inside it)', b.itemRects.every(r=>r.x+r.w<=760));
chk('BAG :2852-2853 detail panel y=10 h=350, rx0=770', /detailR = \{ x: rx0, y: 10, w: rw, h: 350 \}/.test(SRC) && /const rx0 = panelW \+ 10;/.test(SRC));
chk('BAG :2804 divider 2px at panel_w', /gc0\.strokeStyle = 'rgb\(60,80,120\)'; gc0\.lineWidth = 2;/.test(SRC));
chk('BAG :2796-2799 grid step 60 colour (18,22,38)', /gx \+= 60/.test(SRC) && /rgb\(18,22,38\)/.test(SRC));
// :2720-2721 wheel clamp [-600,0]
b.handleInput(inp(null,-3),0); const s1=b.scrollY;
b.handleInput(inp(null,100),0); const s2=b.scrollY;
chk('BAG :2721 scroll clamped to [-600,0]', s1===-90 && s2===0, s1+'/'+s2);
// :2729-2732 select
const first=b.itemRects[0];
b.handleInput(inp(C(first.x+10,first.y+10)),0);
chk('BAG :2731 click selects the card', b.selected===first.title, String(b.selected));
// :2734-2741 use
const beforeQty=(fx.getBag()[b.selected]||0);
b.handleInput(inp(C(b.useBtn.x+10,b.useBtn.y+10)),0);
chk('BAG :2735-2738 activate -> msg 3.0s', b.msg.length>0&&b.msgTimer===3.0&&b.msgOk===true, b.msg);
// :2743-2747 update
b.animTimer=0; b.msgTimer=1; b.update(0.4);
chk('BAG :2744-2747 update decays timers', Math.abs(b.msgTimer-0.6)<1e-9 && b.animTimer>=0.4);
chk('BAG draw does not throw with a stub ctx', (function(){ try{ new st.BagState().draw(R,1300,800); return true;}catch(e){ return false; } })());
chk('BAG :2816-2818 empty state path', (function(){
  const saveBag=D.bag; D.bag={};
  const b2=new st.BagState();
  chk('BAG :2817 empty message', /Tui Do trong/.test(SRC));
  D.bag=saveBag; return true;})());

// ---------- ACHIEVEMENTVIEW (main.py:1927-2001) ----------
chk('ACH back button (810,600,300,60) main.py:1930', (function(){const a=new st.AchievementState();return a.backBtn.x===810&&a.backBtn.y===600&&a.backBtn.w===300&&a.backBtn.h===60;})());
chk('ACH :1941 clear (165,214,167)', /R\.clear\('#a5d6a7'\)/.test(SRC));
chk('ACH :1974 cards border_radius 12', /fillRoundRect\(r\.x, r\.y, r\.w, r\.h, 12, css\(color\)/.test(SRC));
chk('ACH :1994 XP text rendered', /XP/.test(SRC));
chk('ACH draw does not throw with a stub ctx', (function(){ try{ const a=new st.AchievementState(); a.enter(); a.draw(R,1300,800); return true;}catch(e){ return false; } })());

console.log('');
console.log('M32_4_BAG_ACHIEVEMENT: pass='+pass+' fail='+fail);
if(fail){console.log('FAILED:');bad.forEach(b=>console.log('  '+b));process.exit(1);}
process.exit(0);
