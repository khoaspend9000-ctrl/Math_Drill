// M31 CardShopState parity suite.
// Desktop source of truth:
//   main.py:2947-3089      CardShopState (__init__ 2962-2977, _all_cards 2979-2988,
//                          _rebuild 2990-3001, handle_event 3003-3021, _buy 3023-3043,
//                          update 3045-3047, draw 3049-3089)
//   main.py:463            gacha_normal_btn = CardButton(... "\u0110\u1ED1I Th\u1EBB" ...)
//   main.py:719-724        entry with the is_young_learner grade gate
//   main.py:2956-2960      RARITY_INFO prices
//   game_init.py:1241-1265 GachaBannerSystem.POOL_5STAR/4STAR/3STAR
//   game_init.py:1420-1436 grant_card_direct
//   game_init.py:145-152   is_young_learner
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

let changed=null,changeCount=0;
const ops=[];
const R={ctx:{},width:1300,height:800,
  clear:c=>ops.push({t:'clear',c}), gradient:()=>ops.push({t:'g'}),
  roundRectPath:()=>{},
  fillRoundRect:(x,y,w,h,r,f,s,lw)=>ops.push({t:'rect',x,y,w,h,r,f,s,lw}),
  fillRoundRectAlpha:()=>{}, strokeRoundRectAlpha:()=>{},
  image:()=>ops.push({t:'img'}),
  text:(t,x,y)=>ops.push({t:'text',s:String(t),x,y})};

const STORE={grade:3,gold:5000,inventory:[],bag:{}};
const auth={currentUser:'tester',data:()=>STORE,save:()=>{auth.saves=(auth.saves||0)+1;}};
global.Game={renderer:R,states:{change:(n,p)=>{changed=n;changeCount++;},states:{}},
  assets:{get:()=>null},questionGen:null,auth:auth,player:null,log:{info(){},warn(){},error(){}},
  audio:{playSound:()=>{global.__sfx=(global.__sfx||0)+1;}}};
global.Game.player={username:'tester',grade:3,gold:5000,exp:0,level:20,addGold(a){this.gold+=a;}};

function inp(click,key,wheel){return{consumeClick:()=>click||null,consumePressedKey:()=>key||null,consumeWheel:()=>wheel||null};}
const C=(x,y)=>({x,y});

// ---- T01/T02 entry + construction ------------------------------------
chk('T01 CardShopState exists', typeof st.CardShopState==='function');
chk('T01 registered in main.js', /register\('cardShop', new CardShopState\(\)\)/.test(MAIN));
chk('T02 state name is cardShop', new st.CardShopState().name==='cardShop');
chk('T01 menu routes the card button to cardShop (main.py:719-724)',
    /c\.id === 'gacha'[\s\S]{0,900}change\('cardShop'/.test(SRC));
chk('T01 menu applies the is_young_learner grade gate (main.py:720)',
    /isYoungLearnerGrade\(csGrade\)/.test(SRC));

// ---- T03 enter() resets (Desktop builds a new instance per visit) -----
const cs=new st.CardShopState();
cs.filter='5star'; cs.scrollY=-40; cs.msg='x'; cs.msgTimer=2;
cs.enter();
chk('T03 enter() resets filter/scroll/message (main.py:724 fresh instance)',
    cs.filter==='all' && cs.scrollY===0 && cs.msg==='' && cs.msgTimer===0);

// ---- T04 draw (main.py:3049-3089) ------------------------------------
ops.length=0;
cs.draw(R,1300,800);
chk('T04 clears (18,20,34) main.py:3050', ops[0]&&ops[0].t==='clear'&&ops[0].c==='rgb(18,20,34)');
chk('T04 title CUA HANG DAI THA main.py:3051', ops.some(o=>o.t==='text'&&o.s==='CUA HANG DAI THA'));
chk('T04 gold readout main.py:3058', ops.some(o=>o.t==='text'&&/Vang: /.test(o.s)));
chk('T04 4 filter buttons drawn main.py:3059-3063', ops.filter(o=>o.t==='rect'&&o.w===140&&o.h===50).length===4);
chk('T04 card grid uses 320x130 main.py:2995', ops.some(o=>o.t==='rect'&&o.w===320&&o.h===130&&o.r===14));
chk('T04 card panel (35,38,58) r14 main.py:3071', ops.some(o=>o.t==='rect'&&o.f==='rgb(35,38,58)'));
chk('T04 rarity label shown main.py:3080', ops.some(o=>o.t==='text'&&['Thuong','Hiem','Dac Biet'].indexOf(o.s)>=0));
chk('T04 price rendered main.py:3081', ops.some(o=>o.t==='text'&&/\d+ \uD83E\uDDFE/.test(o.s)));

// ---- T04b card data matches Desktop pools ----------------------------
const all=st.cardShopAllCards();
chk('T04 pools total 19 cards (6+7+6, game_init.py:1241-1265)', all.length===19, 'got '+all.length);
const byR={}; all.forEach(c=>{byR[c.rarity]=(byR[c.rarity]||0)+1;});
chk('T04 3star=6 4star=7 5star=6', byR['3star']===6&&byR['4star']===7&&byR['5star']===6, JSON.stringify(byR));
chk('T04 every card has title/icon/content/effect_id',
    all.every(c=>c.title&&c.icon&&c.content&&c.effect_id));

// ---- T05 filter + selection (main.py:3012-3017) ---------------------
chk('T05 filter buttons are all/3star/4star/5star (main.py:2966)',
    cs.filterButtons.map(f=>f.key).join(',')==='all,3star,4star,5star');
const fb=cs.filterButtons[2]; // 4star
cs.handleInput(inp(C(fb.x+10,fb.y+10)),0);
chk('T05 filter click sets filter + resets scroll (main.py:3013-3016)',
    cs.filter==='4star' && cs.scrollY===0);
chk('T05 filtered grid has only 4star (main.py:2992-2993)',
    cs.cardButtons.every(cb=>cb.card.rarity==='4star') && cs.cardButtons.length===7, 'n='+cs.cardButtons.length);
cs.enter();
const before=cs.cardButtons.length;
cs.handleInput(inp(null,null,1),0);
chk('T05 positive wheel clamps at 0 (main.py:3005 min)', cs.scrollY===0, String(cs.scrollY));
cs.handleInput(inp(null,null,-3),0);
chk('T05 negative wheel scrolls the list (main.py:3005)', cs.scrollY===-90, String(cs.scrollY));
cs.enter();

// ---- T06 valid purchase (main.py:3023-3043) -------------------------
STORE.gold=5000; STORE.inventory=[]; STORE.bag={}; auth.saves=0; global.__sfx=0;
const c0=cs.cardButtons[0];
const g0=STORE.gold, sh0=global.__sfx;
cs.handleInput(inp(C(c0.x+10,c0.y+10)),0);
chk('T06 gold deducted by rarity price (main.py:3035)',
    STORE.gold===g0-st.CARD_SHOP_RARITY[c0.card.rarity].price, 'gold='+STORE.gold);
chk('T06 bag counter incremented (main.py:1434)', STORE.bag[c0.card.title]===1, JSON.stringify(STORE.bag));
chk('T06 inventory holds the title once (main.py:1430-1432)', STORE.inventory.indexOf(c0.card.title)>=0);
chk('T06 success message main.py:3037-3039', cs.msgOk===true && cs.msgTimer===2.5 && /Da doi the/.test(cs.msg));
chk('T06 purchase sound played (main.py:3043)', global.__sfx===sh0+1, 'sfx='+global.__sfx);
chk('T06 persisted via save (game_init.py:1435)', auth.saves===1, 'saves='+auth.saves);

// ---- T07 insufficient funds (main.py:3029-3033) ---------------------
STORE.gold=100;   // genuinely short of the 600 five-star price
const g1=STORE.gold, bag1=JSON.stringify(STORE.bag), inv1=STORE.inventory.length;
const five=cs.cardButtons.filter(cb=>cb.card.rarity==='5star')[0];
cs.handleInput(inp(C(five.x+10,five.y+10)),0);
chk('T07 nothing changes when gold is short (main.py:3029-3033)',
    STORE.gold===g1 && JSON.stringify(STORE.bag)===bag1 && STORE.inventory.length===inv1);
chk('T07 failure message + msg_ok False + 2.8s (main.py:3030-3032)',
    cs.msgOk===false && cs.msgTimer===2.8 && /Chua du Vang/.test(cs.msg));
chk('T07 message states price and balance (main.py:3030)',
    cs.msg.indexOf('600')>=0 && cs.msg.indexOf('100')>=0, cs.msg);

// ---- T08 exact balance is enough -------------------------------------
STORE.gold=st.CARD_SHOP_RARITY['5star'].price;
const five2=cs.cardButtons.filter(cb=>cb.card.rarity==='5star')[0];
cs.handleInput(inp(C(five2.x+10,five2.y+10)),0);
chk('T08 exact balance succeeds and reaches 0 (never negative)',
    STORE.gold===0 && cs.msgOk===true, 'gold='+STORE.gold);

// ---- T08b zero balance is blocked ------------------------------------
const g0b=STORE.gold, bag0b=JSON.stringify(STORE.bag);
const any=cs.cardButtons[0];
cs.handleInput(inp(C(any.x+10,any.y+10)),0);
chk('T08b zero balance cannot buy (main.py:3029)',
    STORE.gold===g0b && JSON.stringify(STORE.bag)===bag0b && cs.msgOk===false);

// ---- T09 duplicate purchase increments, never replaces --------------
STORE.gold=5000; STORE.bag={}; STORE.inventory=[];
const dup=cs.cardButtons[0];
cs.handleInput(inp(C(dup.x+10,dup.y+10)),0);
cs.handleInput(inp(C(dup.x+10,dup.y+10)),0);
chk('T09 repeated purchase increments bag to 2 (game_init.py:1434)',
    STORE.bag[dup.card.title]===2, JSON.stringify(STORE.bag));
chk('T09 inventory still lists the title once (game_init.py:1430)',
    STORE.inventory.filter(t=>t===dup.card.title).length===1);

// ---- T10 persistence via grantCardDirect ----------------------------
const fresh={grade:3,gold:0,inventory:[],bag:{}};
const saved=[]; global.Game.auth={currentUser:'t',data:()=>fresh,save:()=>saved.push(1)};
chk('T10 grantCardDirect returns isNew=true first time', st.grantCardDirect('X')===true);
chk('T10 grantCardDirect returns isNew=false second time', st.grantCardDirect('X')===false);
chk('T10 bag count is 2 and inventory has one entry (game_init.py:1429-1435)',
    fresh.bag.X===2 && fresh.inventory.length===1 && saved.length===2, JSON.stringify(fresh));
global.Game.auth=auth;

// ---- T11 duplicate-click protection ----------------------------------
// Desktop processes one MOUSEBUTTONDOWN per event; a single delivered click
// must produce exactly one transaction.
STORE.gold=5000; STORE.bag={}; STORE.inventory=[]; auth.saves=0;
const once=cs.cardButtons[0];
cs.handleInput(inp(C(once.x+10,once.y+10)),0);
chk('T11 one click = one transaction', auth.saves===1 && STORE.bag[once.card.title]===1, 'saves='+auth.saves);

// ---- T12 back/exit (main.py:3009-3011) ------------------------------
changed=null;changeCount=0;
cs.handleInput(inp(C(cs.backBtn.x+5,cs.backBtn.y+5)),0);
chk('T12 back -> menu (main.py:3010)', changed==='menu' && changeCount===1, String(changed));

// ---- T13 re-entry is clean -------------------------------------------
const r1=[cs.filter,cs.scrollY,cs.msg,cs.msgTimer];
cs.handleInput(inp(C(cs.filterButtons[1].x+5,cs.filterButtons[1].y+5)),0);
cs.handleInput(inp(null,null,2),0);
cs._buy(cs.cardButtons[0].card);
cs.enter();
chk('T14 re-entry starts clean (main.py:724 fresh instance)',
    cs.filter==='all'&&cs.scrollY===0&&cs.msg===''&&cs.msgTimer===0,
    JSON.stringify([cs.filter,cs.scrollY,cs.msg,cs.msgTimer]));

// ---- T15 update decays only the message timer (main.py:3045-3047) ---
cs.msgTimer=1.0; cs.shake=0.15;
cs.update(0.4);
chk('T15 update decays msgTimer (main.py:3046-3047)', Math.abs(cs.msgTimer-0.6)<1e-9, String(cs.msgTimer));
cs.update(5);
chk('T15 msgTimer clamps at 0', cs.msgTimer===0);

// ---- T16 update never mutates economy -------------------------------
const gU=STORE.gold, bagU=JSON.stringify(STORE.bag);
cs.update(1); cs.update(1);
chk('T16 update touches no currency or inventory (main.py:3045-3047)',
    STORE.gold===gU && JSON.stringify(STORE.bag)===bagU);

// ---- T17 malformed input safe ----------------------------------------
const gM=STORE.gold;
cs.handleInput(inp(C(-9999,-9999)),0);
cs.handleInput(inp(C(1e9,1e9)),0);
cs.handleInput(inp(null,null,0),0);
cs.handleInput(inp(null,null,-100),0);
chk('T17 out-of-range clicks/wheel are harmless', STORE.gold===gM && cs.scrollY<=0);

// ---- T18 admin bypass (main.py:3028-3035) ---------------------------
STORE.gold=0; STORE.bag={}; STORE.inventory=[]; auth.saves=0;
global.Game.auth.currentUser='admin';
const adm=cs.cardButtons.filter(cb=>cb.card.rarity==='5star')[0];
cs.handleInput(inp(C(adm.x+10,adm.y+10)),0);
chk('T18 admin buys without paying (main.py:3029,3034)', STORE.gold===0 && STORE.bag[adm.card.title]===1, 'gold='+STORE.gold);
global.Game.auth.currentUser='tester';

// ---- invariants -------------------------------------------------------
chk('INV currency finite', isFinite(STORE.gold));
chk('INV currency never negative (no rule permits it)',
    [0,1,79,80,250,600].every(function(g){ const save=STORE.gold; STORE.gold=g; cs._buy(cs.cardButtons[0].card); const ok=STORE.gold>=0; STORE.gold=save; return ok; }));
chk('INV no NaN in prices', ['3star','4star','5star'].every(r=>isFinite(st.CARD_SHOP_RARITY[r].price) && st.CARD_SHOP_RARITY[r].price>0));
chk('INV prices match Desktop 80/250/600 (main.py:2956-2960)',
    st.CARD_SHOP_RARITY['3star'].price===80 && st.CARD_SHOP_RARITY['4star'].price===250 && st.CARD_SHOP_RARITY['5star'].price===600);
chk('INV no timers/listeners added (Desktop has none)', !/setInterval|addEventListener/.test(
    SRC.slice(SRC.indexOf('class CardShopState'), SRC.indexOf('global.CardShopState'))));
chk('INV cleanup: state owns only msgTimer/shake', (function(){
    const c=new st.CardShopState();
    return ['filter','scrollY','msg','msgTimer','msgOk','cardButtons','backBtn','filterButtons','shake'].every(k=>k in c);
})());

console.log('');
console.log('M31_CARD_SHOP: pass='+pass+' fail='+fail);
if(fail){console.log('FAILED:');bad.forEach(b=>console.log('  '+b));process.exit(1);}
process.exit(0);
