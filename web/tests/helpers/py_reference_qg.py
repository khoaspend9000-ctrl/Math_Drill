"""
M6-B reference vector generator — CHẠY TRÊN SOURCE PYTHON THẬT (question_generator.py).

Plan R2: KHÔNG tuyên bố tương đương MT19937. Thay vào đó inject LCG 64-bit
(Knuth MMIX) vào random module khi sinh vector, để output Python hoàn toàn
deterministic và JS có thể reproduce bằng cùng LCG:

    state = (state * 6364136223846793005 + 1442695040888963407) mod 2^64
    out   = (state >> 11) / 2^53        # double trong [0,1)

Patch:
    random._inst._randbelow -> lambda n: int(lcg() * n)
      => randint/randrange/choice/shuffle đều dùng stream này.
    random._inst.random / random.random -> lcg
      => random.uniform (a + (b-a)*random()) cũng dùng stream này.

Ngữ nghĩa JS tương ứng (web/js/question_generator.js):
    ri(a,b)   = floor(r*(b-a+1))+a   ==  randint(a,b) khi _randbelow=int(r*n)
    pick(arr) = arr[floor(r*len)]    ==  choice(seq)
    shuffle   = Fisher-Yates i=len-1..1, j=floor(r*(i+1)) == random.shuffle
    uniform   = a + (b-a)*rf()       ==  random.uniform

KHÔNG sửa bất kỳ file Python nào.
Output: web/tests/vectors/question_vectors.json
Chạy:  python web/tests/helpers/py_reference_qg.py
"""
import sys
import os
import json
import random
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, ROOT)

import question_generator as qgmod  # noqa: E402  (source of truth)

MASK64 = (1 << 64) - 1
_A = 6364136223846793005
_C = 1442695040888963407
_state = [0]
_draw_count = [0]
DRAW_BUDGET = 10000  # generator hop le tieu <~50 draw; vuot nguong = infinite loop


class DrawBudgetExceeded(Exception):
    """Vuot ngan sach draw -> generator lap vo han (KNOWN_PYTHON_INFINITE_LOOP)."""


def lcg():
    _draw_count[0] += 1
    if _draw_count[0] > DRAW_BUDGET:
        raise DrawBudgetExceeded('draw budget exceeded: generator never terminates')
    _state[0] = (_state[0] * _A + _C) & MASK64
    return (_state[0] >> 11) / float(1 << 53)


def qg_innermost_line(tb):
    """Dong SAU NHAT trong question_generator.py tren traceback (de ghi backlog)."""
    line = None
    t = tb
    while t is not None:
        if t.tb_frame.f_code.co_filename.endswith('question_generator.py'):
            line = t.tb_frame.f_lineno
        t = t.tb_next
    return line


def set_seed(s):
    _state[0] = int(s) & MASK64


SEEDS = [42, 7, 2026]
GRADES = [(1, 41), (2, 75), (3, 76), (4, 73), (5, 75)]


def make_vector(grade, lesson, seed):
    set_seed(seed)
    _draw_count[0] = 0
    gen = qgmod.QuestionGenerator()  # question_cache sạch cho từng vector
    try:
        with mock.patch.object(random._inst, '_randbelow',
                               lambda n: int(lcg() * n)), \
             mock.patch.object(random._inst, 'random', lcg), \
             mock.patch.object(random, 'random', lcg):
            q = gen.generate_question(grade, lesson, qgmod.Difficulty.MEDIUM, user_id=None)
    except DrawBudgetExceeded:
        line = qg_innermost_line(sys.exc_info()[2])
        return {
            'seed': seed, 'grade': grade, 'lesson_id': lesson,
            'hang': True,
            'reason': 'KNOWN_PYTHON_INFINITE_LOOP',
            'detail': ('question_generator.py line %s — vong lap ep co nho/muon khong bao '
                       'gio thoa (vuot draw budget %d); Python khong bao gio tra ve question; '
                       'vector SKIP theo thiet ke (B+C: JS SAFETY_GUARD, Python giu nguyen)'
                       % (line, DRAW_BUDGET)),
        }
    except Exception as e:
        # Bug khac trong source Python (vd UnboundLocalError KH5 B9 — py:1550).
        # KHONG che giau exception: ghi day type + message + dong Python vao detail.
        line = qg_innermost_line(sys.exc_info()[2])
        return {
            'seed': seed, 'grade': grade, 'lesson_id': lesson,
            'py_error': True,
            'reason': 'KNOWN_PYTHON_ERROR',
            'detail': ('%s: %s (question_generator.py line %s) — Python raise khi sinh '
                       'question; vector SKIP theo thiet ke (Python giu nguyen, khong sua)'
                       % (type(e).__name__, e, line)),
        }
    qt = q.question_type
    df = q.difficulty
    return {
        'seed': seed, 'grade': grade, 'lesson_id': lesson,
        'question_text': q.question_text,
        'options': list(q.options),
        'correct_answer': q.correct_answer,
        'hint': q.hint,
        'question_type': qt.value if hasattr(qt, 'value') else str(qt),
        'difficulty': int(df.value) if hasattr(df, 'value') else int(df),
    }


def main():
    vectors = []
    hangs = 0
    errs = 0
    for grade, max_lesson in GRADES:
        for lesson in range(1, max_lesson + 1):
            for seed in SEEDS:
                v = make_vector(grade, lesson, seed)
                if v.get('hang'):
                    hangs += 1
                    print('  HANG     g%d L%d seed%d -> %s | %s'
                          % (grade, lesson, seed, v.get('reason', ''), v.get('detail', '')))
                elif v.get('py_error'):
                    errs += 1
                    print('  PY_ERROR g%d L%d seed%d -> %s | %s'
                          % (grade, lesson, seed, v.get('reason', ''), v.get('detail', '')))
                vectors.append(v)
        print('grade %d done (%d lessons x %d seeds)' % (grade, max_lesson, len(SEEDS)))
    print('MARKED: hang=%d py_error=%d normal=%d / total=%d'
          % (hangs, errs, len(vectors) - hangs - errs, len(vectors)))

    # LCG golden: JS phải reproduce bit-identical 3 double đầu với seed 42
    set_seed(42)
    _draw_count[0] = 0
    golden = [lcg() for _ in range(3)]

    out = {
        'source': 'question_generator.py generate_question (source that, LCG-injected, plan R2)',
        'lcg': {
            'a': _A, 'c': _C, 'mask64': MASK64, 'shift': 11, 'denom': 1 << 53,
            'formula': 'state=(state*a+c) mod 2^64; out=(state>>11)/2^53',
            'note': 'Test-only determinism; KHONG phan ung MT19937 cua Python',
        },
        'lcg_golden_seed42': golden,
        'seeds': SEEDS,
        'grade_lesson_counts': {str(g): m for g, m in GRADES},
        'count': len(vectors),
        'counts': {
            'normal': len(vectors) - hangs - errs,
            'hang': hangs,
            'py_error': errs,
        },
        'vectors': vectors,
    }
    out_path = os.path.normpath(os.path.join(HERE, '..', 'vectors', 'question_vectors.json'))
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print('OK: %d vectors -> %s' % (len(vectors), out_path))
    print('LCG golden seed42:', golden)


if __name__ == '__main__':
    main()
