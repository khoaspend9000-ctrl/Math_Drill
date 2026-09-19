"""
M5 reference vector generator — CHẠY TRÊN SOURCE PYTHON THẬT.
Đọc player.py (get_required_exp, PlayerData.add_exp) + hashlib PBKDF2
cùng format 'pbkdf2$sha256$100000$salt$hex' của game_init.hash_password.

KHÔNG sửa bất kỳ file Python nào. Output: web/tests/vectors/*.json
Chạy:  python web/tests/helpers/py_reference.py
"""
import sys
import os
import json
import hashlib

HERE = os.path.dirname(os.path.abspath(__file__))
# root = web/tests/helpers -> lên 3 cấp (tests -> web -> project root) để import player.py thật
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, ROOT)

from player import get_required_exp, PlayerData  # noqa: E402  (source of truth)

OUT = os.path.normpath(os.path.join(HERE, '..', 'vectors'))
if not os.path.isdir(OUT):
    os.makedirs(OUT)

# ---------------------------------------------------------------
# 1) XP curve — plan T01: 300 level + edge cases, tolerance ±1
# ---------------------------------------------------------------
levels = list(range(1, 301)) + [0, -5, 999, 1000, 1001, 5000]
curve = []
for lvl in levels:
    curve.append([int(lvl), int(get_required_exp(lvl))])
with open(os.path.join(OUT, 'xp_curve.json'), 'w', encoding='utf-8') as f:
    json.dump({
        'source': 'player.py get_required_exp (chạy trên source thật)',
        'tolerance': 1,
        'curve': curve,
    }, f, indent=1)

# ---------------------------------------------------------------
# 2) Level-up loop — plan T02: add_exp(2_000_000) từ level 1
#    + bảng checkpoint nhiều mốc XP (mỗi mốc dùng PlayerData tươi)
# ---------------------------------------------------------------
p = PlayerData()
p.add_exp(2_000_000)
final_2m = {'level': int(p.level), 'exp': int(p.exp), 'exp_to_next_level': int(p.exp_to_next_level)}

p500 = PlayerData()
p500.add_exp(500)
final_500 = {'level': int(p500.level), 'exp': int(p500.exp), 'exp_to_next_level': int(p500.exp_to_next_level)}

checkpoints = []
for xp in [0, 100, 500, 1000, 1500, 2000, 5000, 10000, 50000, 100000, 500000, 1000000, 2000000]:
    q = PlayerData()
    q.add_exp(xp)
    checkpoints.append({
        'xp': int(xp),
        'level': int(q.level),
        'exp': int(q.exp),
        'exp_to_next_level': int(q.exp_to_next_level),
    })

with open(os.path.join(OUT, 'levelup.json'), 'w', encoding='utf-8') as f:
    json.dump({
        'source': 'player.py PlayerData.add_exp (chạy trên source thật)',
        'final_2m': final_2m,
        'final_500': final_500,
        'checkpoints': checkpoints,
    }, f, indent=1)


# ---------------------------------------------------------------
# 3) PBKDF2 — plan T18/R4: đúng format game_init.hash_password (dòng 320-326)
#    LƯU Ý: salt là CHUỖI hex, pbkdf2 dùng salt.encode('utf-8')
#    tức ASCII bytes của chuỗi hex (không phải raw bytes).
# ---------------------------------------------------------------
def hash_password(password, salt):
    digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100_000)
    return 'pbkdf2$sha256$100000$' + salt + '$' + digest.hex()


vectors = [
    {'password': 'demo123', 'salt': '0' * 32, 'stored': hash_password('demo123', '0' * 32)},
    {'password': 'demo123', 'salt': 'abcdef0123456789abcdef0123456789',
     'stored': hash_password('demo123', 'abcdef0123456789abcdef0123456789')},
    {'password': 'alice12345', 'salt': '1234567890abcdef1234567890abcdef',
     'stored': hash_password('alice12345', '1234567890abcdef1234567890abcdef')},
    {'password': u'Trư Việt NaM!@# 123', 'salt': 'f' * 32,
     'stored': hash_password(u'Trư Việt NaM!@# 123', 'f' * 32)},
]
with open(os.path.join(OUT, 'pbkdf2_vectors.json'), 'w', encoding='utf-8') as f:
    json.dump({
        'source': 'game_init.py hash_password/verify_password (format pbkdf2$sha256$100000$salt$hex)',
        'vectors': vectors,
    }, f, ensure_ascii=False, indent=1)

print('OK: 3 vector files written to', OUT)
