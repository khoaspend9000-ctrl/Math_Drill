/* =========================================================
   MathDrill Web — M6-B: MT19937 PORT (Python random.Random tương thích)
   ---------------------------------------------------------
   Port nguyên tắc Mersenne Twister 32-bit của CPython random module
   (random.py → _randommodule.c: init_genrand, genrand_uint32).
   KHÔNG phải Xorshift / Mulberry32.

   - seed(int): CPython random_seed(int) → abs(int) → key = các word 32-bit
     little-endian (word thấp trước), n==0 → key=[0] → init_by_array(key).
     (Comment cũ "int seed → init_genrand" là SAI — xác minh bằng vector
     Python 3.12 thật random.Random(42).getrandbits(32) ×32, plan R2.)
   - init_genrand(seed): seeding Knuth 19650218 — dùng NỘI BỘ, được
     init_by_array gọi trước khi trộn key (chuỗi CPython init_by_array).
   - init_by_array(key): đường seeding chung của CPython cho int/bytes/str.
   - genrand_int32(): chuẩn MT19937 với tempering.
   - getrandbits(k), random(), randint(), choice(), shuffle(): cùng semantics Python.

   Xác minh: web/tests/m6b_mt19937.test.js dùng reference vectors sinh từ
   Python 3.12 thật (web/tests/helpers/py_mt_reference.py) — KHÔNG tự tin
   đoán, KHÔNG tuyên bố ngoài bằng chứng (plan R2).
   ========================================================= */
(function (global) {
  'use strict';

  const N = 624;
  const M = 397;
  const MATRIX_A = 0x9908b0df;      // 2567483615
  const UPPER_MASK = 0x80000000;    // bit 31
  const LOWER_MASK = 0x7fffffff;    // bits 0..30

  function toUint32(x) { return x >>> 0; }

  class MT19937 {
    constructor(seed) {
      this.mt = new Array(N).fill(0);
      this.mti = N + 1; // theo CPython: mti=N+1 nghĩa là "chưa init"
      if (seed !== undefined) this.seed(seed);
    }

    // init_genrand — seeding Knuth 19650218 (CPython init_genrand).
    // DÙNG NỘI BỘ: init_by_array gọi init_genrand(19650218) trước khi trộn key.
    init_genrand(seedValue) {
      const s = toUint32(seedValue);
      this.mt[0] = s;
      for (let i = 1; i < N; i++) {
        const prev = this.mt[i - 1];
        // mt[i] = (1812433253 * (mt[i-1] ^ (mt[i-1] >> 30)) + i) & 0xffffffff
        this.mt[i] = toUint32(
          (Math.imul(1812433253, toUint32(prev ^ (prev >>> 30))) + i) >>> 0
        );
      }
      this.mti = N;
      return this;
    }

    // CPython random_seed(int): abs(int) → key = các word 32-bit little-endian
    // (word thấp trước; n==0 → key=[0]) → init_by_array. KHÔNG phải init_genrand —
    // xác minh bằng vector Python 3.12 thật (py_mt_reference.py, plan R2).
    seed(value) {
      let s = value;
      if (s == null) s = (Date.now() ^ Math.floor(Math.random() * 0x100000000));
      if (typeof s !== 'bigint') s = BigInt(Math.floor(Number(s)));
      if (s < 0n) s = -s; // CPython: PyNumber_Absolute
      const key = [];
      if (s === 0n) {
        key.push(0);
      } else {
        // CPython random_seed: keyused = (bits-1)//32 + 1; buffer zero-pad theo
        // keyused — vd seed 2^64+5 (bits=65) → key=[5, 1, 0] (word 0 la pad).
        const bits = s.toString(2).length;
        const keyused = Math.floor((bits - 1) / 32) + 1;
        while (s > 0n) { key.push(Number(s & 0xFFFFFFFFn)); s >>= 32n; }
        while (key.length < keyused) key.push(0);
      }
      return this.init_by_array(key);
    }

    // CPython random_seed(bytes/str) → init_by_array. Key = mảng số nguyên 32-bit.
    init_by_array(key) {
      let i = 1; let j = 0; let k;
      this.init_genrand(19650218);
      const maxNK = Math.max(N, key.length);
      for (k = maxNK; k; k--) {
        const prev = this.mt[i - 1];
        const ki = key[j] >>> 0;
        // CPython: state[i] = (state[i] ^ ((state[i-1] ^ (state[i-1]>>30)) * 1664525)) + key[j] + j
        this.mt[i] = toUint32(
          toUint32(this.mt[i] ^ Math.imul(toUint32(prev ^ (prev >>> 30)), 1664525)) + ki + j
        );
        i++; j++;
        if (i >= N) { this.mt[0] = this.mt[N - 1]; i = 1; }
        if (j >= key.length) j = 0;
      }
      for (k = N - 1; k; k--) {
        const prev = this.mt[i - 1];
        // CPython: state[i] = (state[i] ^ ((state[i-1] ^ (state[i-1]>>30)) * 1566083941)) - i
        this.mt[i] = toUint32(
          toUint32(this.mt[i] ^ Math.imul(toUint32(prev ^ (prev >>> 30)), 1566083941)) - i
        );
        i++;
        if (i >= N) { this.mt[0] = this.mt[N - 1]; i = 1; }
      }
      this.mt[0] = 0x80000000;
      this.mti = N;
      return this;
    }

    // CPython genrand_uint32 — MT19937 chuẩn
    genrand_int32() {
      let y;
      if (this.mti >= N) {
        let kk;
        for (kk = 0; kk < N - M; kk++) {
          y = toUint32((this.mt[kk] & UPPER_MASK) | (this.mt[kk + 1] & LOWER_MASK));
          this.mt[kk] = toUint32(this.mt[kk + M] ^ (y >>> 1) ^ ((y & 1) ? MATRIX_A : 0));
        }
        for (; kk < N - 1; kk++) {
          y = toUint32((this.mt[kk] & UPPER_MASK) | (this.mt[kk + 1] & LOWER_MASK));
          this.mt[kk] = toUint32(this.mt[kk + (M - N)] ^ (y >>> 1) ^ ((y & 1) ? MATRIX_A : 0));
        }
        y = toUint32((this.mt[N - 1] & UPPER_MASK) | (this.mt[0] & LOWER_MASK));
        this.mt[N - 1] = toUint32(this.mt[M - 1] ^ (y >>> 1) ^ ((y & 1) ? MATRIX_A : 0));
        this.mti = 0;
      }

      y = this.mt[this.mti++];
      // Tempering
      y = toUint32(y ^ (y >>> 11));
      y = toUint32(y ^ ((y << 7) & 0x9d2c5680));
      y = toUint32(y ^ ((y << 15) & 0xefc60000));
      y = toUint32(y ^ (y >>> 18));
      return y >>> 0;
    }

    // CPython random_getrandbits: k=32 → 1 word; k<=32 → bit cao (word >> (32-k))
    getrandbits(k) {
      const kk = k | 0;
      if (kk <= 0) return 0;
      if (kk <= 32) return (this.genrand_int32() >>> (32 - kk)) >>> 0;
      // k > 32: ghép nhiều word (ít dùng trong game)
      const words = Math.ceil(kk / 32);
      let result = 0;
      for (let i = 0; i < words; i++) {
        const w = this.genrand_int32();
        const shift = 32 * i;
        const chunk = (i === words - 1) ? (w >>> (32 * words - kk)) : w;
        result += chunk * Math.pow(2, shift);
      }
      return result;
    }

    // CPython random_random: a>>5, b>>6 → (a*2^26 + b) / 2^53
    random() {
      const a = this.genrand_int32() >>> 5;   // 27 bit cao
      const b = this.genrand_int32() >>> 6;   // 26 bit cao
      return (a * 67108864.0 + b) * (1.0 / 9007199254740992.0);
    }

    // CPython _randbelow_with_getrandbits:
    //   k = n.bit_length(); r = getrandbits(k); while r >= n: r = getrandbits(k)
    _randbelow(n) {
      if (n <= 0) throw new Error('n must be > 0, got ' + n);
      const k = 32 - Math.clz32(n); // n.bit_length() dung y CPython _randbelow (cu: clz32(n-1) sai cho n = 2^k)
      let r = this.getrandbits(k);
      while (r >= n) r = this.getrandbits(k);
      return r;
    }

    // CPython randint(a, b) → randrange(a, b+1) = a + _randbelow(b - a + 1)
    randint(a, b) {
      if (a > b) throw new Error('randint: empty range [' + a + ', ' + b + ']');
      return a + this._randbelow(b - a + 1);
    }

    // CPython choice(seq) → seq[_randbelow(len(seq))]
    choice(seq) {
      if (!seq || !seq.length) throw new Error('Cannot choose from an empty sequence');
      return seq[this._randbelow(seq.length)];
    }

    // CPython shuffle: for i in reversed(range(1, len(x))): j = _randbelow(i+1); swap
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = this._randbelow(i + 1);
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }

  }

  global.MT19937 = MT19937;
  if (typeof module !== 'undefined' && module.exports) module.exports = MT19937;
})(typeof window !== 'undefined' ? window : globalThis);
