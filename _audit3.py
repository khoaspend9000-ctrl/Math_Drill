import io
t = io.open(r'E:\lam_game_2026\main.py', encoding='utf-8').read()
lines = t.splitlines()
hits = [(i + 1, l.strip()[:130]) for i, l in enumerate(lines) if 'add_to_bag' in l or 'add_card_to_collection' in l or 'item_fx' in l and 'gacha' not in l]
for ln, l in hits:
    print(ln, ':', l)

# gacha result → bag wiring in main.py around gacha roll
for i, l in enumerate(lines):
    if 'item_fx.add_to_bag' in l or 'add_card_to_collection' in l:
        print('--- context', i + 1, '---')
        for j in range(max(0, i - 6), min(len(lines), i + 3)):
            print('   ', j + 1, lines[j][:130])
        print()