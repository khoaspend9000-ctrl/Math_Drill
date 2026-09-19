/* M8-A: EFFECTS - Particle, Confetti, Firework, AnswerEffects, FallingClover, ScreenShake, ComboPopup, TransitionEffect */
(function (global) {
  'use strict';
  const GLOBAL_MAX_PARTICLES = 200;

  class ParticleBudget {
    constructor() { this._count = 0; }
    available() { return Math.max(0, GLOBAL_MAX_PARTICLES - this._count); }
    request(wanted) { const g = Math.min(wanted, this.available()); this._count += g; return g; }
    release(n) { this._count = Math.max(0, this._count - (n || 1)); }
    reset() { this._count = 0; }
    get count() { return this._count; }
    get cap() { return GLOBAL_MAX_PARTICLES; }
  }

  const particleBudget = new ParticleBudget();

  class Particle {
    constructor() { this.active = false; this.x = 0; this.y = 0; }
    init(x, y) { this.x = x; this.y = y; this.active = true; }
    update(dt) {} draw(ctx) {} reset() { this.active = false; }
  }

  class ConfettiParticle extends Particle {
    constructor() { super(); this.reset(); }
    reset() { super.reset(); this.vx=0; this.vy=0; this.color=[255,0,0]; this.size=4; this.life=2; this.maxLife=2; this.rotation=0; this.rotSpeed=0; this.gravity=500; }
    init(x, y) {
      super.init(x, y);
      this.vx = (Math.random()-0.5)*400; this.vy = -Math.random()*300-100;
      var c = [[255,0,0],[0,255,0],[0,0,255],[255,255,0],[255,165,0]];
      this.color = c[Math.floor(Math.random()*c.length)];
      this.size = Math.floor(Math.random()*6)+3;
      this.life = 1.5+Math.random()*1.5; this.maxLife = this.life;
      this.rotation = Math.random()*360; this.rotSpeed = (Math.random()-0.5)*720;
    }
    update(dt) { if (!this.active) return; this.x+=this.vx*dt; this.y+=this.vy*dt; this.vy+=this.gravity*dt; this.rotation+=this.rotSpeed*dt; this.life-=dt; if (this.life<=0) { this.active=false; particleBudget.release(1); } }
    draw(ctx) { if (!this.active) return; var a=Math.max(0,Math.min(1,this.life/this.maxLife)); ctx.save(); ctx.translate(this.x,this.y); ctx.rotate(this.rotation*Math.PI/180); ctx.globalAlpha=a; ctx.fillStyle='rgb('+this.color[0]+','+this.color[1]+','+this.color[2]+')'; ctx.fillRect(-this.size,-this.size,this.size*2,this.size*2); ctx.restore(); }
  }

  class ConfettiSystem {
    constructor() { this.particles=[]; this.pool=[]; this.active=false; }
    _get() { return this.pool.length>0 ? this.pool.pop() : new ConfettiParticle(); }
    explode(x, y, count) {
      count = count || 30;
      var avail = Math.min(count, particleBudget.available());
      if (avail <= 0) return;
      particleBudget.request(avail);
      for (var i = 0; i < avail; i++) { var p = this._get(); p.init(x, y); this.particles.push(p); }
      this.active = true;
    }
    update(dt) { for (var i=this.particles.length-1; i>=0; i--) { this.particles[i].update(dt); if (!this.particles[i].active) this.pool.push(this.particles.splice(i,1)[0]); } if (this.particles.length===0) this.active=false; }
    draw(ctx) { for (var i=0; i<this.particles.length; i++) this.particles[i].draw(ctx); }
    clear() { while(this.particles.length) this.pool.push(this.particles.pop()); this.active=false; }
    get count() { return this.particles.length; }
  }

  global.Particle = Particle;
  global.ConfettiParticle = ConfettiParticle;
  global.ConfettiSystem = ConfettiSystem;
  global.particleBudget = particleBudget;
  global.GLOBAL_MAX_PARTICLES = GLOBAL_MAX_PARTICLES;
  // Backward-compat: merge effects2 (TransitionEffect et al.) when running under Node,
  // so require('effects.js') alone still exposes the full API (phase1/m4 tests).
  // In browser, index.html loads effects2.js explicitly after this file.
  try {
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      var __e2 = null;
      try { __e2 = require('./effects2.js'); } catch (_) { __e2 = null; }
      if (__e2) {
        module.exports = { ParticleBudget: ParticleBudget, Particle: Particle, ConfettiParticle: ConfettiParticle, ConfettiSystem: ConfettiSystem, particleBudget: particleBudget, GLOBAL_MAX_PARTICLES: GLOBAL_MAX_PARTICLES, FireworkParticle: __e2.FireworkParticle, Firework: __e2.Firework, WrongParticle: __e2.WrongParticle, AnswerEffectSystem: __e2.AnswerEffectSystem, FallingClover: __e2.FallingClover, ScreenShake: __e2.ScreenShake, ComboPopup: __e2.ComboPopup, ComboPopupManager: __e2.ComboPopupManager, TransitionEffect: __e2.TransitionEffect, answerEffects: __e2.answerEffects, comboPopupManager: __e2.comboPopupManager, transitionEffect: __e2.transitionEffect };
      } else {
        module.exports = { ParticleBudget: ParticleBudget, Particle: Particle, ConfettiParticle: ConfettiParticle, ConfettiSystem: ConfettiSystem, particleBudget: particleBudget, GLOBAL_MAX_PARTICLES: GLOBAL_MAX_PARTICLES };
      }
      // phase1 legacy: require('effects.js') used directly as TransitionEffect constructor.
      // Keep callable-compat: if effects2 loaded, export the constructor itself with props attached.
      if (__e2 && __e2.TransitionEffect) {
        var __TE = __e2.TransitionEffect;
        __TE.ParticleBudget = ParticleBudget; __TE.Particle = Particle;
        __TE.ConfettiParticle = ConfettiParticle; __TE.ConfettiSystem = ConfettiSystem;
        __TE.particleBudget = particleBudget; __TE.GLOBAL_MAX_PARTICLES = GLOBAL_MAX_PARTICLES;
        __TE.Firework = __e2.Firework; __TE.AnswerEffectSystem = __e2.AnswerEffectSystem;
        __TE.ScreenShake = __e2.ScreenShake; __TE.ComboPopupManager = __e2.ComboPopupManager;
        __TE.TransitionEffect = __e2.TransitionEffect;
        module.exports = __TE;
      }
    }
  } catch (_) {
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = { ParticleBudget, Particle, ConfettiParticle, ConfettiSystem, particleBudget, GLOBAL_MAX_PARTICLES };
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
