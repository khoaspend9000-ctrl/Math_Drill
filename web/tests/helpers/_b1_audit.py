# -*- coding: utf-8 -*-
"""B1 — Real dependency extraction from production JS."""
import io, os, re, json

JS_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'js')

files = sorted([f for f in os.listdir(JS_DIR) if f.endswith('.js')])

result = {}
for fn in files:
    path = os.path.join(JS_DIR, fn)
    t = io.open(path, encoding='utf-8').read()
    globals_created = []
    globals_read = []
    requires = []
    exports = []
    classes = []
    singletons = []

    for i, line in enumerate(t.splitlines(), 1):
        # global.X = ...
        for m in re.finditer(r'\bglobal\.(\w+)\s*=(?!=)', line):
            globals_created.append((i, m.group(1)))
        # global.X reads (not assignment)
        for m in re.finditer(r'\bglobal\.(\w+)', line):
            stmt = line.strip()
            if not re.search(r'\bglobal\.' + m.group(1) + r'\s*=', stmt):
                globals_read.append((i, m.group(1)))
        # require('...')
        for m in re.finditer(r'''require\(['"]([^'"]+)['"]\)''', line):
            requires.append((i, m.group(1)))
        # module.exports
        if 'module.exports' in line:
            exports.append((i, line.strip()))
        # class X
        m = re.match(r'\s*class\s+(\w+)', line)
        if m:
            classes.append((i, m.group(1)))
        # var x = new ...
        m = re.match(r'\s*(?:var|let|const)\s+(\w+)\s*=\s*new\s+', line)
        if m:
            singletons.append((i, m.group(1)))
        # global.X = new ...
        m = re.match(r'\s*global\.(\w+)\s*=\s*new\s+', line)
        if m:
            singletons.append((i, 'global.' + m.group(1)))

    result[fn] = {
        'bytes': len(t),
        'classes': [c[1] for c in classes],
        'globals_created': list(dict.fromkeys([g[1] for g in globals_created])),
        'globals_read': list(dict.fromkeys([g[1] for g in globals_read])),
        'requires': list(dict.fromkeys([r[1] for r in requires])),
        'singletons': list(dict.fromkeys([s[1] for s in singletons])),
        'exports': [e[1] for e in exports],
    }

print(json.dumps(result, indent=2, ensure_ascii=False))
