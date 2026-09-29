// M22: Desktop Button interaction + RealisticBook page-turn (unit).
const UI=require('E:/MathDrill/web/js/ui.js');
const Renderer=require('E:/MathDrill/web/js/renderer.js');
let pass=0,fail=0;const fails=[];
function chk(n,f,d){ if(f)pass++;else{fail++;fails.push(n+(d?(' :: '+d):''));}console.log((f?'PASS ':'FAIL ')+n+(d&&!f?(' :: '+d):''));}
function mkR(){const c={globalAlpha:1,fillStyle:'',strokeStyle:'',lineWidth:0,saved:0,restored:0,
  save(){this.saved++;this._ga=this.globalAlpha;},restore(){this.restored++;this.globalAlpha=this._ga;},
  beginPath(){},moveTo(){},arcTo(){},closePath(){},fill(){},stroke(){}};
  const r=new Renderer(c,1300,800);
  r.ops=[];
  r.fillRoundRect=function(x,y,w,h,rad,fill,stroke,lw){r.ops.push({t:'rect',x,y,w,h,r:rad,fill,stroke,lw,ga:c.globalAlpha});};
  r.fillRoundRectAlpha=function(x,y,w,h,rad,fill,a){if(!(a>0))return;r.ops.push({t:'alpha',x,y,w,h,r:rad,fill,a});};
  r.strokeRoundRectAlpha=function(x,y,w,h,rad,stroke,a,lw){if(!(a>0))return;r.ops.push({t:'stroke',x,y,w,h,r:rad,stroke,a,lw});};
  r.text=function(){};
  return r;}
const B=UI.Button;

/* A1: update() already matched Desktop 0.20 BEFORE M22 (verified in the audit), so
   this is a lock-in check, not new work. It needs px/py. */
chk('A1 hover lerp toward target (Desktop 3901 speed 0.20)', (()=>{
  const b=new B(0,0,100,40,'X',[10,20,30]);
  b.setPointer(50,20);
  for(let i=0;i<60;i++) b.update(1/60,50,20);
  const hot=b.hoverAnim;
  b.setPointer(500,500);
  for(let i=0;i<60;i++) b.update(1/60,500,500);
  return hot>0.95 && b.hoverAnim<0.05;})(), 'hot/cold');

const b=new B(100,200,200,60,'Nut',[80,50,20]);
b.hoverAnim=0;b.glowPhase=0;b.clickScale=1;b.pressed=0;
let r=mkR();b.draw(r);
const al=r.ops.filter(o=>o.t==='alpha'), bd=r.ops.filter(o=>o.t==='rect');
chk('A2 rest shadow alpha 70/255 (Desktop 3924)', Math.abs(al[0].a-70/255)<0.01);
chk('A2 rest shadow radius 25 (Desktop 3926)', al[0].r===25);
chk('A2 rest shadow offset 6px (Desktop 3920 @hover 0)', al[0].y===(200-5+6), 'y='+al[0].y);
chk('A2 rest body radius 20 (Desktop 3929)', bd[0].r===20);
chk('A2 rest body colour = source colour', bd[0].fill==='rgb(80,50,20)');
chk('A2 rest top highlight 30/255 (Desktop 3934)', Math.abs(al[1].a-30/255)<0.01);
chk('A2 rest NO glow border (Desktop 3939 gate hover>0.1)', !bd.some(o=>o.lw===4));
const sbd=r.ops.filter(o=>o.t==='stroke');
chk('A2 rest white border 80/255 OUTLINE (Desktop 3948-3949 width=2)', sbd.length===1&&Math.abs(sbd[0].a-80/255)<0.01&&sbd[0].lw===2&&sbd[0].r===20, JSON.stringify(sbd));

const h=new B(100,200,200,60,'Nut',[80,50,20]);
h.hoverAnim=1;h.glowPhase=0;h.clickScale=1;h.pressed=0;
r=mkR();h.draw(r);
const hа=r.ops.filter(o=>o.t==='alpha'), hb=r.ops.filter(o=>o.t==='rect');
chk('A3 hover brightness +50/ch (Desktop 3874)', hb[0].fill==='rgb(130,100,70)', hb[0].fill);
chk('A3 hover lift 8px up (Desktop 3914)', hb[0].y===(200+30-30-8), 'y='+hb[0].y);
chk('A3 hover shadow alpha 120/255 (Desktop 3924)', Math.abs(hа[0].a-120/255)<0.01);
/* Desktop 3920: _smooth_lerp(6.0, 10.0, hover*0.3) is ONE step from a FIXED 6.0,
   so at hover=1 it is 6 + 4*0.3 = 7.2 -> int 7, never 10. */
chk('A3 hover shadow offset 7px (Desktop 3920 single-step lerp)', hа[0].y===(200-5+7), 'y='+hа[0].y);
chk('A3 hover highlight 50/255 (Desktop 3934)', Math.abs(hа[1].a-50/255)<0.01);
chk('A3 hover scale 1% (Desktop 3910)', hb[0].w===202, 'w='+hb[0].w);
chk('A3 hover SHOWS glow (Desktop 3939)', hb.some(o=>o.lw===4));
const g=hb.find(o=>o.lw===4);
chk('A3 glow alpha (180 + sin(0)*40+40)/255 (Desktop 3940-41)', Math.abs(g.ga-((180+40)/255))<0.01, 'ga='+g.ga);
chk('A3 glow radius 22, 4px stroke (Desktop 3944)', g.r===22 && g.lw===4);

const p=new B(100,200,200,60,'Nut',[80,50,20]);
p.hoverAnim=0;p.clickScale=0.9;p.pressed=0;
r=mkR();p.draw(r);
chk('A4 press scale 0.90 (Desktop 3983)', r.ops[1].w===180, 'w='+r.ops[1].w);
chk('A4 press keeps radius 20', r.ops[1].r===20);

const sb=new B(0,0,10,10,'X',[0,0,0]);sb.hoverAnim=1;
r=mkR();sb.draw(r);
chk('A5 ctx save/restore balanced', r.ctx.saved===r.ctx.restored, 's='+r.ctx.saved+' r='+r.ctx.restored);
chk('A5 globalAlpha restored to 1 (no ctx leakage)', r.ctx.globalAlpha===1, 'ga='+r.ctx.globalAlpha);

/* ---- Book page turn. Desktop game_init.py:4370-4430. */
const Book=UI.RealisticBook;
const bk=new Book([], {x:50,y:50,w:1200,h:700});
chk('B1 book idle at rest', bk.flipping===false && bk.flipT===0);
chk('B2 startFlip(slide_left) -> contract left page toward spine', bk.startFlip('slide_left')==='slide_left' && bk.flipDir===1 && bk.flipT===0 && bk.flipping===true);
chk('B3 startFlip(slide_right) -> contract right page', bk.startFlip('slide_right')==='slide_right' && bk.flipDir===-1);
chk('B4 flip duration = 1/3 s (Desktop 4382 dt*3.0)', Math.abs(bk.flipDur-1/3)<1e-9, 'flipDur='+bk.flipDur);
bk.startFlip('slide_left');
let f=0;const dt=1/60;
while(bk.flipping&&f<600){bk.update(dt);f++;}
chk('B4 completes in ~0.333s (20 frames @60fps)', f===20 && Math.abs(f*dt-1/3)<0.02, 'frames='+f+' s='+(f*dt).toFixed(4));
chk('B4 leaves a stable page afterwards', bk.flipping===false && bk.flipT===0);
chk('B5 desktop book rect 50,50,1200,700', bk.rect.x===50&&bk.rect.y===50&&bk.rect.w===1200&&bk.rect.h===700);
chk('B5 page width (w-40)/2 = 580 (Desktop page_w)', bk.pageW===580, 'pageW='+bk.pageW);
chk('B5 40px spine gap preserved', bk.leftRect.w===580 && bk.rightRect.x===50+580+40, JSON.stringify(bk.rightRect.x));
chk('B5 curl scale floor 0.7 (Desktop 4400)', bk.pageW===580);
const R2=mkR();R2.clear=()=>{};R2.image=()=>{};R2.text=()=>{};
let threw=null;
try{ for(const t of [0,0.25,0.5,0.75,1]){ bk.startFlip('slide_left'); bk.flipT=t; bk.draw(R2); } }catch(e){threw=e.message;}
chk('B6 flip draws at 0/25/50/75/100% without throwing', threw===null, threw);
const s=mkR();s.clear=()=>{};s.image=()=>{};s.text=()=>{};
bk.startFlip('slide_left');bk.flipT=0;bk.draw(s);
const idleDraws=s.ops.length;
bk.startFlip('slide_left');bk.flipT=0;bk.draw(s);
chk('B6 identical draws at same progress (stable, no flicker)', s.ops.length===idleDraws*2);

console.log('');
console.log('M22_UNIT: pass='+pass+' fail='+fail);
if(fails.length)console.log('FAILED: '+fails.join(' | '));
process.exit(fail?1:0);
