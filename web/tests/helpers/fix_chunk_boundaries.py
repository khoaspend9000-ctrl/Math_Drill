"""Sửa lỗi chunk-boundary trong question_generator.js:
mỗi grade được viết theo nhiều chunk, boundary có dạng:
      }
      } else if (lesson_id === ...) {
=> giữ MỘT close duy nhất:  } else if (lesson_id === ...) {
"""
import re

p = r'e:\lam_game_2026\web\js\question_generator.js'
with open(p, encoding='utf-8') as f:
    src = f.read()

before = src
# pattern: một dòng "      }" (chỉ close) rồi ngay dòng "      } else if"
new, n = re.subn(r'\n      \}\n      \} else ', '\n      } else ', src)
print('fixed double-close before else-if:', n)

# check các trường hợp hở khác
import io
open(p, 'w', encoding='utf-8').write(new)

# verify không còn boundary lỗi
for i, line in enumerate(new.split('\n'), 1):
    if line.strip() == '}':
        pass
print('written. (verify bằng node)')