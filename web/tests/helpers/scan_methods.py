"""In bản đồ class/def + số dòng của các file question/AI (M6)."""
import os
import re

FILES = [
    r'e:\lam_game_2026\question_generator.py',
    r'e:\lam_game_2026\smart_ai.py',
    r'e:\lam_game_2026\systems\adaptive_ai.py',
]

for fp in FILES:
    print('=' * 15, os.path.basename(fp), '=' * 15)
    with open(fp, encoding='utf-8') as f:
        for i, line in enumerate(f, 1):
            s = line.rstrip()
            if re.match(r'^(class |def |    def |        def )', s):
                print('%5d: %s' % (i, s[:110]))
    with open(fp, encoding='utf-8') as f:
        total = sum(1 for _ in f)
    print('TOTAL LINES:', total)
