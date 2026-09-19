'use strict';
/* M8-A: Effects tests. */
const assert = require('assert');
const effects = require('../js/effects.js');
const effects2 = require('../js/effects2.js');

let pass = 0, failed = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('PASS  ' + name); }
  catch (e) { failed++; console.error('FAIL  ' + name + ' :: ' + (e && e.message)); }
}

check('T01 ParticleBudget: cap is 200', function () {
  assert.strictEqual(effects.GLOBAL_MAX_PARTICLES, 200);
});

check('T02 ParticleBudget: available starts at 200', function () {
  const budget = new effects.ParticleBudget();
  assert.strictEqual(budget.available(), 200);
});

check('T03 ParticleBudget: request grants particles', function () {
  const budget = new effects.ParticleBudget();
  const granted = budget.request(50);
  assert.strictEqual(granted, 50);
  assert.strictEqual(budget.count, 50);
});

check('T04 ParticleBudget: request cannot exceed cap', function () {
  const budget = new effects.ParticleBudget();
  budget.request(150);
  const granted = budget.request(100);
  assert.strictEqual(granted, 50);
  assert.strictEqual(budget.count, 200);
});

check('T05 ParticleBudget: release frees particles', function () {
  const budget = new effects.ParticleBudget();
  budget.request(100);
  budget.release(30);
  assert.strictEqual(budget.count, 70);
});

check('T06 ConfettiSystem: explode spawns particles', function () {
  effects.particleBudget.reset();
  const confetti = new effects.ConfettiSystem();
  confetti.explode(100, 100, 30);
  assert.ok(confetti.count > 0);
  assert.ok(confetti.count <= 30);
});

check('T07 ConfettiSystem: particles expire over time', function () {
  effects.particleBudget.reset();
  const confetti = new effects.ConfettiSystem();
  confetti.explode(100, 100, 10);
  for (let i = 0; i < 300; i++) confetti.update(1/60);
  assert.strictEqual(confetti.count, 0);
  assert.strictEqual(confetti.active, false);
});

check('T08 ConfettiSystem: clear removes all particles', function () {
  effects.particleBudget.reset();
  const confetti = new effects.ConfettiSystem();
  confetti.explode(100, 100, 20);
  confetti.clear();
  assert.strictEqual(confetti.count, 0);
});

check('T09 ConfettiSystem: pool reuses particles', function () {
  effects.particleBudget.reset();
  const confetti = new effects.ConfettiSystem();
  confetti.explode(100, 100, 10);
  confetti.update(5);
  const poolSize = confetti.pool.length;
  assert.ok(poolSize > 0);
  confetti.explode(200, 200, 10);
  assert.ok(confetti.pool.length < poolSize + 10);
});

check('T10 AnswerEffectSystem: triggerCorrect spawns particles', function () {
  effects.particleBudget.reset();
  const aes = new effects2.AnswerEffectSystem();
  aes.triggerCorrect(100, 100);
  assert.ok(aes.count > 0);
  assert.strictEqual(aes.active, true);
});

check('T11 AnswerEffectSystem: triggerWrong spawns wrong particles', function () {
  effects.particleBudget.reset();
  const aes = new effects2.AnswerEffectSystem();
  aes.triggerWrong(100, 100);
  assert.ok(aes.wrongParts.length > 0);
});

check('T12 AnswerEffectSystem: clear resets state', function () {
  effects.particleBudget.reset();
  const aes = new effects2.AnswerEffectSystem();
  aes.triggerCorrect(100, 100);
  aes.clear();
  assert.strictEqual(aes.count, 0);
  assert.strictEqual(aes.active, false);
});

check('T13 Firework: spawns and expires', function () {
  effects.particleBudget.reset();
  const fw = new effects2.Firework(100, 100);
  assert.ok(fw.count > 0);
  for (let i = 0; i < 120; i++) fw.update(1/60);
  assert.strictEqual(fw.active, false);
});

check('T14 ScreenShake: shake activates and decays', function () {
  const shake = new effects2.ScreenShake();
  shake.shake(10, 0.5);
  assert.strictEqual(shake.active, true);
  shake.update(0.6);
  assert.strictEqual(shake.active, false);
});

check('T15 ComboPopupManager: shows combo for streak >= 3', function () {
  const cpm = new effects2.ComboPopupManager();
  cpm.showCombo(100, 100, 3);
  assert.strictEqual(cpm.count, 1);
});

check('T16 ComboPopupManager: no popup for streak < 3', function () {
  const cpm = new effects2.ComboPopupManager();
  cpm.showCombo(100, 100, 2);
  assert.strictEqual(cpm.count, 0);
});

check('T17 TransitionEffect: starts and completes', function () {
  const te = new effects2.TransitionEffect('fade');
  te.start();
  assert.strictEqual(te.active, true);
  te.update(0.6);
  assert.strictEqual(te.done, true);
});

check('T18 Repeated effects do not grow unbounded', function () {
  effects.particleBudget.reset();
  const aes = new effects2.AnswerEffectSystem();
  for (let i = 0; i < 100; i++) {
    aes.triggerCorrect(100, 100);
    aes.update(1/60);
  }
  assert.ok(aes.count <= effects.GLOBAL_MAX_PARTICLES);
});

check('T19 Global budget shared across systems', function () {
  effects.particleBudget.reset();
  const confetti = new effects.ConfettiSystem();
  const aes = new effects2.AnswerEffectSystem();
  confetti.explode(100, 100, 100);
  aes.triggerCorrect(200, 200);
  const total = confetti.count + aes.count;
  assert.ok(total <= effects.GLOBAL_MAX_PARTICLES);
});

check('T20 Particles returned to pool after expiry', function () {
  effects.particleBudget.reset();
  const confetti = new effects.ConfettiSystem();
  for (let round = 0; round < 5; round++) {
    confetti.explode(100, 100, 20);
    for (let i = 0; i < 300; i++) confetti.update(1/60);
  }
  assert.ok(confetti.pool.length <= 100);
  assert.strictEqual(confetti.count, 0);
});

console.log('M8-A Effects: pass=' + pass + ' fail=' + failed);
process.exit(failed ? 1 : 0);
