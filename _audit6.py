import io
for f in [r'E:\lam_game_2026\game_init.py', r'E:\lam_game_2026\main.py']:
    t = io.open(f, encoding='utf-8').read()
    lines = t.splitlines()
    for i, l in enumerate(lines):
        if 'roll_gacha' in l or ('add_to_bag' in l and i > 1825):
            print(f.split('\\')[-1], i + 1, ':', l.strip()[:150])