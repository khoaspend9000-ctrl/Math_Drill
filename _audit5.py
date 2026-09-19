import io
t = io.open(r'E:\lam_game_2026\main.py', encoding='utf-8').read()
lines = t.splitlines()
hits = [(i + 1, lines[i].strip()[:160]) for i in range(len(lines)) if '.roll(' in lines[i] or 'gacha' in lines[i].lower() and 'self.' in lines[i]]
for ln, l in hits[:40]:
    print(ln, ':', l)