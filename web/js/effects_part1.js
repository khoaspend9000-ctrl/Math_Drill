/* M8-A: EFFECTS - Part 1: ParticleBudget, Particle, Confetti */
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
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Particle, ConfettiParticle, ConfettiSystem, particleBudget, GLOBAL_MAX_PARTICLES };
  }
})(typeof window !== 'undefined' ? window : globalThis);
