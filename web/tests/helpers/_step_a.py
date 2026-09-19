import os, re, io

js_dir = r'E:\lam_game_2026\web\js'
js_files = sorted([f for f in os.listdir(js_dir) if f.endswith('.js')])

idx = io.open(r'E:\lam_game_2026\web\index.html', encoding='utf-8').read()
scripts = re.findall(r'<script\s+src="([^"]+)"', idx)

loaded = []
missing = []
for s in scripts:
    full = os.path.join(r'E:\lam_game_2026\web', s.replace('/', os.sep))
    if os.path.exists(full):
        loaded.append(s)
    else:
        missing.append(s)

loaded_base = [os.path.basename(s) for s in scripts]
not_loaded = [f for f in js_files if f not in loaded_base]

print('TOTAL_JS', len(js_files), 'SCRIPT_SRC', len(scripts), 'LOADED', len(loaded), 'MISSING', len(missing), 'NOT_LOADED', len(not_loaded))
print('LOADED:')
for x in loaded:
    print(' ', x)
print('MISSING:')
for x in missing:
    print(' ', x)
print('NOT_LOADED:')
for x in not_loaded:
    print(' ', x)
