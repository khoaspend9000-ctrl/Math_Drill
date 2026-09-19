import io, os, re
d = r'E:\lam_game_2026\server\tests'
for fn in ['auth.test.js', 'auth_part2.test.js', 'auth_part3.test.js', 'admin_rbac.test.js']:
    p = os.path.join(d, fn)
    t = io.open(p, encoding='utf-8').read()
    # wrap each unlinkSync in try/catch so a db file held by an unrelated
    # handle never aborts the suite (test-env cleanup, not assertion change)
    t2 = re.sub(r'fs\.unlinkSync\(([^)]+)\);', r'try { fs.unlinkSync(\1); } catch (e) {}', t)
    if 'auth_part3' in fn or True:
        pass
    if t2 != t:
        io.open(p, 'w', encoding='utf-8').write(t2)
        print(fn, 'unlink-guarded')
    else:
        print(fn, 'no change')