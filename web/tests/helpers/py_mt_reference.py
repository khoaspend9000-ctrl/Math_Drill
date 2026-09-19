# -*- coding: utf-8 -*-
"""M6-B helper: cau noi Python MT19937 cho test Node — CHAY TREN PYTHON 3.12 THAT.
Khong sua file Python game. Dung reference vectors (plan R2) de xac minh port
MT19937 trong web/js/mt19937.js — KHONG tu tin doan, KHONG tuyen bo ngoai bang chung.

Chay:  python web/tests/helpers/py_mt_reference.py
Output: web/tests/vectors/mt19937_vectors.json
"""
import json
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    out = {
        'algorithm_note': (
            'Python 3.12 random.Random(seed) — reference vectors chi de xac minh port '
            'MT19937 (seed(int) → init_by_array), khong phai tuyen bo tuong duong thuat toan'
        ),
        'python_version': '.'.join(map(str, sys.version_info[:3])),
    }
    r = random.Random(42)
    out['getrandbits32_seed42'] = [r.getrandbits(32) for _ in range(32)]
    r = random.Random(42)
    out['random_seed42'] = [r.random() for _ in range(3)]
    r = random.Random(42)
    out['randint_1_100_seed42'] = [r.randint(1, 100) for _ in range(8)]
    r = random.Random(42)
    out['randint_1_10_seed42'] = [r.randint(1, 10) for _ in range(10)]
    r = random.Random(42)
    pool = list(range(10, 51))
    out['choice_10_50_seed42'] = [r.choice(pool) for _ in range(5)]
    r = random.Random(42)
    xs = list(range(10))
    r.shuffle(xs)
    out['shuffle_range10_seed42'] = xs
    r = random.Random(7)
    out['getrandbits32_seed7'] = [r.getrandbits(32) for _ in range(8)]
    r = random.Random(0)
    out['getrandbits32_seed0'] = [r.getrandbits(32) for _ in range(4)]
    r = random.Random((1 << 64) + 5)
    out['getrandbits32_seed_2p64_plus5'] = [r.getrandbits(32) for _ in range(4)]
    r = random.Random(-42)
    out['getrandbits32_seed_neg42'] = [r.getrandbits(32) for _ in range(4)]

    dst = os.path.normpath(os.path.join(HERE, '..', 'vectors', 'mt19937_vectors.json'))
    with open(dst, 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=1)
    print('OK ->', dst)
    print('python', out['python_version'])
    for k in ('getrandbits32_seed42', 'random_seed42', 'randint_1_100_seed42',
              'choice_10_50_seed42', 'shuffle_range10_seed42', 'getrandbits32_seed_2p64_plus5'):
        print(k, '=', out[k])


if __name__ == '__main__':
    main()
