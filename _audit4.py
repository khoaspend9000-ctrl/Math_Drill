import io
for f in [r'E:\lam_game_2026\game_init.py', r'E:\lam_game_2026\main.py']:
    t = io.open(f, encoding='utf-8').read()
    lines = t.splitlines()
    for i, l in enumerate(lines):
        if 'add_to_bag' in l:
            print(f.split('\\')[-1], i + 1, ':', l.strip()[:140])
            for j in range(max(0, i - 3), min(len(lines), i + 4)):
                print('    ', j + 1, lines[j].strip()[:130])
            print()