"""Quét cân bằng {} cho question_generator.js — in các vùng deep <0."""
import json

p = r'e:\lam_game_2026\web\js\question_generator.js'
out = r'e:\lam_game_2026\web\tests\helpers\_brace_report.txt'

with open(p, encoding='utf-8') as f:
    lines = f.readlines()

depth = 0
min_depth = 0
min_line = 1
issues = []
in_str = None
for i, line in enumerate(lines, 1):
    code = line
    j = 0
    while j < len(code):
        c = code[j]
        if in_str:
            if c == '\\': j += 2; continue
            if c == in_str: in_str = None
            j += 1; continue
        if c in "'\"`":
            in_str = c; j += 1; continue
        if c == '/':
            if j+1 < len(code) and code[j+1] == '/':
                break
            if j+1 < len(code) and code[j+1] == '*':
                k = code.find('*/', j+2)
                j = len(code) if k < 0 else k+2
                continue
        if c == '{': depth += 1
        elif c == '}':
            depth -= 1
            if depth < min_depth:
                min_depth = depth
                min_line = i
        j += 1
    # in cảnh báo mỗi dòng nếu muốn

with open(out, 'w', encoding='utf-8') as f:
    f.write('final_depth=%d  min_depth=%d (at line %d)\n' % (depth, min_depth, min_line))
    # in các dòng quanh min_line
    if min_depth < 0:
        start = max(1, min_line-3)
        for k in range(start, min(min_line+3, len(lines))+1):
            f.write('%5d: %s\n' % (k, lines[k-1].rstrip()))
    # thống kê số dòng "}" và "{"
    f.write('total_lines=%d\n' % len(lines))
print('done', out)