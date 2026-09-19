/* M8-A: EFFECTS Part 2 - Firework, AnswerEffects, FallingClover, ScreenShake, ComboPopup, TransitionEffect */
(function (global) {
  'use strict';
  var particleBudget = global.particleBudget;
  if (!particleBudget) { particleBudget = { available: function() { return 200; }, request: function(w) { return w; }, release: function() {} }; }

  class FireworkParticle {
    constructor() { this.active=false; this.x=0; this.y=0; this.reset(); }
    reset() { this.active=false; this.vx=0; this.vy=0; this.color=[255,255,0]; this.life=1; this.maxLife=1; this.size=2; }
    init(x, y, color) { this.active=true; this.x=x; this.y=y; var angle=Math.random()*Math.PI*2; var speed=100+Math.random()*200; this.vx=Math.cos(angle)*speed; this.vy=Math.sin(angle)*speed; this.color=color||[255,255,0]; this.life=0.8+Math.random()*0.8; this.maxLife=this.life; this.size=2+Math.random()*2; }
    update(dt) { if (!this.active) return; this.x+=this.vx*dt; this.y+=this.vy*dt; this.vy+=200*dt; this.life-=dt; if (this.life<=0) { this.active=false; particleBudget.release(1); } }
    draw(ctx) { if (!this.active) return; var a=Math.max(0,Math.min(1,this.life/this.maxLife)); ctx.save(); ctx.globalAlpha=a; ctx.fillStyle='rgb('+this.color[0]+','+this.color[1]+','+this.color[2]+')'; ctx.beginPath(); ctx.arc(this.x,this.y,this.size,0,Math.PI*2); ctx.fill(); ctx.restore(); }
  }

  class Firework {
    constructor(x, y) { this.x=x; this.y=y; this.particles=[]; this.pool=[]; this.active=true; this._explode(); }
    _get() { return this.pool.length>0 ? this.pool.pop() : new FireworkParticle(); }
    _explode() { var colors=[[255,50,50],[50,255,50],[50,50,255],[255,255,50],[255,50,255],[50,255,255]]; var color=colors[Math.floor(Math.random()*colors.length)]; var count=Math.min(30,particleBudget.available()); if (count<=0) { this.active=false; return; } particleBudget.request(count); for (var i=0;i<count;i++) { var p=this._get(); p.init(this.x,this.y,color); this.particles.push(p); } }
    update(dt) { if (!this.active) return; for (var i=this.particles.length-1;i>=0;i--) { this.particles[i].update(dt); if (!this.particles[i].active) this.pool.push(this.particles.splice(i,1)[0]); } if (this.particles.length===0) this.active=false; }
    draw(ctx) { for (var i=0;i<this.particles.length;i++) this.particles[i].draw(ctx); }
    get count() { return this.particles.length; }
  }

  class WrongParticle {
    constructor() { this.active=false; this.x=0; this.y=0; this.reset(); }
    reset() { this.active=false; this.life=0.5; this.maxLife=0.5; this.size=8; }
    init(x, y) { this.active=true; this.x=x; this.y=y; this.life=0.5; this.maxLife=0.5; }
    update(dt) { if (!this.active) return; this.life-=dt; if (this.life<=0) { this.active=false; particleBudget.release(1); } }
    draw(ctx) { if (!this.active) return; var a=Math.max(0,Math.min(1,this.life/this.maxLife)); ctx.save(); ctx.globalAlpha=a; ctx.strokeStyle='rgb(255,80,80)'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(this.x-this.size,this.y-this.size); ctx.lineTo(this.x+this.size,this.y+this.size); ctx.moveTo(this.x+this.size,this.y-this.size); ctx.lineTo(this.x-this.size,this.y+this.size); ctx.stroke(); ctx.restore(); }
  }

  class AnswerEffectSystem {
    constructor() { this.particles=[]; this.pool=[]; this.wrongParts=[]; this.wrongPool=[]; this.fireworks=[]; this.active=false; }
    _get() { return this.pool.length>0 ? this.pool.pop() : { active:false, x:0, y:0, vx:0, vy:0, color:[255,0,0], size:4, life:2, maxLife:2, rotation:0, rotSpeed:0, gravity:500, init: function(x, y) { this.active=true; this.x=x; this.y=y; this.vx=(Math.random()-0.5)*400; this.vy=-Math.random()*300-100; var c=[[255,0,0],[0,255,0],[0,0,255],[255,255,0],[255,165,0]]; this.color=c[Math.floor(Math.random()*c.length)]; this.size=Math.floor(Math.random()*6)+3; this.life=1.5+Math.random()*1.5; this.maxLife=this.life; this.rotation=Math.random()*360; this.rotSpeed=(Math.random()-0.5)*720; }, update: function(dt) { if (!this.active) return; this.x+=this.vx*dt; this.y+=this.vy*dt; this.vy+=this.gravity*dt; this.rotation+=this.rotSpeed*dt; this.life-=dt; if (this.life<=0) { this.active=false; particleBudget.release(1); } }, draw: function(ctx) { if (!this.active) return; var a=Math.max(0,Math.min(1,this.life/this.maxLife)); ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.rotation*Math.PI/180); ctx.globalAlpha=a; ctx.fillStyle='rgb('+this.color[0]+','+this.color[1]+','+this.color[2]+')'; ctx.fillRect(-this.size,-this.size,this.size*2,this.size*2); ctx.restore(); } }; }
    _getWrong() { return this.wrongPool.length>0 ? this.wrongPool.pop() : new WrongParticle(); }
    triggerCorrect(x, y) { var count=Math.min(30,particleBudget.available()); if (count<=0) return; particleBudget.request(count); for (var i=0;i<count;i++) { var p=this._get(); p.init(x,y); this.particles.push(p); } this.active=true; }
    triggerWrong(x, y) { var count=Math.min(3,particleBudget.available()); if (count<=0) return; particleBudget.request(count); for (var i=0;i<count;i++) { var p=this._getWrong(); p.init(x,y); this.wrongParts.push(p); } this.active=true; }
    addFirework(x, y) { if (particleBudget.available()>=10) { this.fireworks.push(new Firework(x,y)); this.active=true; } }
    update(dt) { for (var i=this.particles.length-1;i>=0;i--) { this.particles[i].update(dt); if (!this.particles[i].active) this.pool.push(this.particles.splice(i,1)[0]); } for (var i=this.wrongParts.length-1;i>=0;i--) { this.wrongParts[i].update(dt); if (!this.wrongParts[i].active) this.wrongPool.push(this.wrongParts.splice(i,1)[0]); } for (var i=this.fireworks.length-1;i>=0;i--) { this.fireworks[i].update(dt); if (!this.fireworks[i].active) this.fireworks.splice(i,1); } if (this.particles.length===0 && this.wrongParts.length===0 && this.fireworks.length===0) this.active=false; }
    draw(ctx) { for (var i=0;i<this.particles.length;i++) this.particles[i].draw(ctx); for (var i=0;i<this.wrongParts.length;i++) this.wrongParts[i].draw(ctx); for (var i=0;i<this.fireworks.length;i++) this.fireworks[i].draw(ctx); }
    clear() { while(this.particles.length) this.pool.push(this.particles.pop()); while(this.wrongParts.length) this.wrongPool.push(this.wrongParts.pop()); this.fireworks=[]; this.active=false; }
    get count() { return this.particles.length + this.wrongParts.length; }
  }

  class FallingClover {
    constructor(maxCount) { this.maxCount=maxCount||15; this.particles=[]; this.pool=[]; this.active=false; }
    _get() { if (this.pool.length>0) return this.pool.pop(); return { x:0,y:0,vy:0,vx:0,rotation:0,rotSpeed:0,size:10,alpha:1,active:false, init:function(x,y) { this.x=x;this.y=y;this.vy=20+Math.random()*40;this.vx=(Math.random()-0.5)*30;this.rotation=Math.random()*360;this.rotSpeed=(Math.random()-0.5)*100;this.size=8+Math.random()*8;this.alpha=0.6+Math.random()*0.4;this.active=true; }, update:function(dt) { if(!this.active)return;this.x+=this.vx*dt;this.y+=this.vy*dt;this.rotation+=this.rotSpeed*dt;if(this.y>900)this.active=false; }, draw:function(ctx) { if(!this.active)return;ctx.save();ctx.translate(this.x,this.y);ctx.rotate(this.rotation*Math.PI/180);ctx.globalAlpha=this.alpha;ctx.fillStyle='rgb(80,180,80)';ctx.beginPath();ctx.arc(0,-this.size/2,this.size/2,0,Math.PI*2);ctx.arc(0,this.size/2,this.size/2,0,Math.PI*2);ctx.arc(-this.size/2,0,this.size/2,0,Math.PI*2);ctx.arc(this.size/2,0,this.size/2,0,Math.PI*2);ctx.fill();ctx.restore(); } }; }
    spawn(x,y) { if(this.particles.length>=this.maxCount)return; var p=this._get(); p.init(x,y); this.particles.push(p); this.active=true; }
    update(dt) { for(var i=this.particles.length-1;i>=0;i--) { this.particles[i].update(dt); if(!this.particles[i].active) this.pool.push(this.particles.splice(i,1)[0]); } if(this.particles.length===0)this.active=false; }
    draw(ctx) { for(var i=0;i<this.particles.length;i++) this.particles[i].draw(ctx); }
    clear() { while(this.particles.length) this.pool.push(this.particles.pop()); this.active=false; }
    get count() { return this.particles.length; }
  }

  class ScreenShake {
    constructor() { this.intensity=0; this.duration=0; this.elapsed=0; this.offsetX=0; this.offsetY=0; this.active=false; }
    shake(intensity, duration) { this.intensity=intensity; this.duration=duration; this.elapsed=0; this.active=true; }
    update(dt) { if(!this.active)return; this.elapsed+=dt; if(this.elapsed>=this.duration) { this.active=false; this.offsetX=0; this.offsetY=0; return; } var progress=1-(this.elapsed/this.duration); this.offsetX=(Math.random()-0.5)*2*this.intensity*progress; this.offsetY=(Math.random()-0.5)*2*this.intensity*progress; }
    get offset() { return [this.offsetX, this.offsetY]; }
  }

  class ComboPopup {
    constructor(x, y, text) { this.x=x; this.y=y; this.text=text; this.life=1.5; this.maxLife=1.5; this.active=true; }
    update(dt) { if(!this.active)return; this.y-=50*dt; this.life-=dt; if(this.life<=0)this.active=false; }
    draw(ctx) { if(!this.active)return; var a=Math.max(0,Math.min(1,this.life/this.maxLife)); ctx.save(); ctx.globalAlpha=a; ctx.fillStyle='rgb(255,200,50)'; ctx.font='bold 24px Quicksand, sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(this.text, this.x, this.y); ctx.restore(); }
  }

  class ComboPopupManager {
    constructor() { this.popups=[]; }
    showCombo(x, y, streak) { var text=''; if(streak>=10)text='MEGA COMBO x'+streak+'!'; else if(streak>=5)text='SUPER COMBO x'+streak+'!'; else if(streak>=3)text='COMBO x'+streak+'!'; else return; this.popups.push(new ComboPopup(x,y,text)); }
    update(dt) { for(var i=this.popups.length-1;i>=0;i--) { this.popups[i].update(dt); if(!this.popups[i].active)this.popups.splice(i,1); } }
    draw(ctx) { for(var i=0;i<this.popups.length;i++) this.popups[i].draw(ctx); }
    clear() { this.popups=[]; }
    get count() { return this.popups.length; }
  }

  class TransitionEffect {
    constructor(type) { this.effectType=type||'fade'; this.progress=0; this.duration=0.5; this.active=false; this.done=true; this._midFired=false; this.onMidpoint=null; }
    start() { this.progress=0; this.active=true; this.done=false; this._midFired=false; }
    update(dt) { if(!this.active)return; this.progress+=dt/this.duration; if(!this._midFired&&this.progress>=0.5) { this._midFired=true; if(typeof this.onMidpoint==='function')this.onMidpoint(); } if(this.progress>=1) { this.progress=1; this.active=false; this.done=true; } }
    draw(ctx, w, h) { if(!this.active)return; var a=this.progress<0.5?this.progress*2:(1-this.progress)*2; a=Math.max(0,Math.min(1,a)); ctx.save(); ctx.fillStyle='rgba(11,16,32,'+a+')'; ctx.fillRect(0,0,w,h); ctx.restore(); }
  }

  var answerEffects = new AnswerEffectSystem();
  var comboPopupManager = new ComboPopupManager();
  var transitionEffect = new TransitionEffect('fade');

  global.FireworkParticle = FireworkParticle;
  global.Firework = Firework;
  global.WrongParticle = WrongParticle;
  global.AnswerEffectSystem = AnswerEffectSystem;
  global.FallingClover = FallingClover;
  global.ScreenShake = ScreenShake;
  global.ComboPopup = ComboPopup;
  global.ComboPopupManager = ComboPopupManager;
  global.TransitionEffect = TransitionEffect;
  global.answerEffects = answerEffects;
  global.comboPopupManager = comboPopupManager;
  global.transitionEffect = transitionEffect;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FireworkParticle, Firework, WrongParticle, AnswerEffectSystem, FallingClover, ScreenShake, ComboPopup, ComboPopupManager, TransitionEffect, answerEffects, comboPopupManager, transitionEffect };
  }
})(typeof window !== 'undefined' ? window : globalThis);
