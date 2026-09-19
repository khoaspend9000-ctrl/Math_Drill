'use strict';
/* M6-B: MT19937 port vs Python 3.12 reference vectors (plan R2).
   Pham vi bang chung: seed(int) → init_by_array (zero-pad theo keyused);
   getrandbits/random/randint/choice/shuffle cho cac seed da thu.
   KHONG tuyen bo tuong duong ngoai pham vi co vector (R2). */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const MT19937 = require('../js/mt19937.js');
const V = JSON.parse(fs.readFileSync(path.join(__dirname, 'vectors', 'mt19937_vectors.json'), 'utf8'));

let pass = 0, failed = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('PASS  ' + name); }
  catch (e) { failed++; console.error('FAIL  ' + name + ' :: ' + (e && e.message)); }
}

check('T01 getrandbits(32) x32, seed 42 (random_seed → init_by_array)', function () {
  const mt = new MT19937(42);
  for (let i = 0; i < V.getrandbits32_seed42.length; i++) {
    assert.strictEqual(mt.getrandbits(32), V.getrandbits32_seed42[i], 'idx ' + i);
  }
});
check('T02 random() x3, seed 42', function () {
  const mt = new MT19937(42);
  for (let i = 0; i < V.random_seed42.length; i++) {
    assert.strictEqual(mt.random(), V.random_seed42[i], 'idx ' + i);
  }
});
check('T03 randint(1,100) x8, seed 42', function () {
  const mt = new MT19937(42);
  for (let i = 0; i < V.randint_1_100_seed42.length; i++) {
    assert.strictEqual(mt.randint(1, 100), V.randint_1_100_seed42[i], 'idx ' + i);
  }
});
check('T04 randint(1,10) x10, seed 42', function () {
  const mt = new MT19937(42);
  for (let i = 0; i < V.randint_1_10_seed42.length; i++) {
    assert.strictEqual(mt.randint(1, 10), V.randint_1_10_seed42[i], 'idx ' + i);
  }
});
check('T05 choice(range(10,51)) x5, seed 42', function () {
  const mt = new MT19937(42);
  const pool = []; for (let i = 10; i <= 50; i++) pool.push(i);
  for (let i = 0; i < V.choice_10_50_seed42.length; i++) {
    assert.strictEqual(mt.choice(pool), V.choice_10_50_seed42[i], 'idx ' + i);
  }
});
check('T06 shuffle(range(10)), seed 42', function () {
  const mt = new MT19937(42);
  const xs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  mt.shuffle(xs);
  assert.deepStrictEqual(xs, V.shuffle_range10_seed42);
});
check('T07 getrandbits(32) x8, seed 7', function () {
  const mt = new MT19937(7);
  for (let i = 0; i < V.getrandbits32_seed7.length; i++) {
    assert.strictEqual(mt.getrandbits(32), V.getrandbits32_seed7[i], 'idx ' + i);
  }
});
check('T08 getrandbits(32) x4, seed 0 (key=[0])', function () {
  const mt = new MT19937(0);
  for (let i = 0; i < V.getrandbits32_seed0.length; i++) {
    assert.strictEqual(mt.getrandbits(32), V.getrandbits32_seed0[i], 'idx ' + i);
  }
});
check('T09 getrandbits(32) x4, seed 2^64+5 (multi-word key [5,1,0], BigInt)', function () {
  const mt = new MT19937(18446744073709551621n);
  for (let i = 0; i < V.getrandbits32_seed_2p64_plus5.length; i++) {
    assert.strictEqual(mt.getrandbits(32), V.getrandbits32_seed_2p64_plus5[i], 'idx ' + i);
  }
});
check('T10 seed(-42) = seed(42) (CPython PyNumber_Absolute)', function () {
  assert.strictEqual(new MT19937(-42).getrandbits(32), V.getrandbits32_seed42[0]);
});

check('T11 KHONG recursion seed -> init_by_array -> seed (init_by_array goi init_genrand truc tiep)', function () {
  const MT = require('../js/mt19937.js');
  const origSeed = MT.prototype.seed;
  let seedCalls = 0;
  MT.prototype.seed = function (v) { seedCalls++; return origSeed.call(this, v); };
  try {
    const mt = new MT19937(42);
    assert.strictEqual(seedCalls, 1, 'seed() phai duoc goi DUY NHAT 1 lan tu constructor (recursion se lam count > 1 hoac loop vo han), got ' + seedCalls);
    assert.strictEqual(mt.getrandbits(32), V.getrandbits32_seed42[0], 'state hop le sau seeding');
  } finally {
    MT.prototype.seed = origSeed;
  }
});

check('T12 MDRandom/LCG adapter: MT19937 doc lap voi global.MDRandom; LCG (Knuth MMIX) la TEST-ONLY injection, KHONG phai MT19937', function () {
  // (a) MT19937 khong doc global.MDRandom — seeding/output khong doi khi adapter ton tai:
  global.MDRandom = { random: function () { return 0.5; } };
  try {
    assert.strictEqual(new MT19937(42).getrandbits(32), V.getrandbits32_seed42[0],
      'MT19937 phai cho cung ket voi seed 42 bat ke global.MDRandom');
  } finally {
    delete global.MDRandom;
  }
  // (b) LCG (dung trong m6b_vectors.test.js de inject deterministic stream vao
  //     QuestionGenerator) cho gia tri KHAC MT19937 cung seed -> chuogn minh hai
  //     he RNG khong bi nham lan; parity vectors dung LCG O CẢ HAI PHE
  //     (Python reference + JS) nen hop le cho parity, KHONG phai claim MT19937.
  const MASK64 = (1n << 64n) - 1n;
  const LC_A = 6364136223846793005n;
  const LC_C = 1442695040888963407n;
  let s = 42n;
  const lcg = function () { s = (s * LC_A + LC_C) & MASK64; return Number(s >> 11n) / 9007199254740992; };
  const mtRandom = new MT19937(42).random();
  const lcgRandom = lcg();
  assert.notStrictEqual(mtRandom, lcgRandom, 'LCG va MT19937 phai khac nhau cung seed 42 (tranh nham lan hai he RNG)');
  console.log('NOTE  LCG(42).random()=' + lcgRandom + ' != MT19937(42).random()=' + mtRandom + ' — LCG chi la deterministic test injection (plan R2), KHONG phai MT19937');
});

console.log('SCOPE  MT19937 equivalence CHI trong pham vi co reference vectors: seed(int) -> init_by_array (42/7/0/2^64+5/-42), getrandbits(32), random(), randint(), choice(), shuffle() — plan R2');
console.log('M6-B MT19937: pass=' + pass + ' fail=' + failed);
process.exit(failed ? 1 : 0);
