# -*- coding: utf-8 -*-
"""M10-A checkpoint: SHA-256 manifest (non-Git, ghi ro trong CHECKPOINTS.md)."""
import io
import hashlib
import os
import datetime

ROOT = r'e:/lam_game_2026'
FILES = [
    'web/index.html',
    'web/js/main.js',
    'web/tests/m10a_browser_load.test.js',
    'web/tests/m9_final_integration.test.js',
    'web/tests/helpers/_m10a_docs.py',
    'web/tests/helpers/_fix_t07.py',
    'M10_A_INTEGRATION_REPORT.md',
    'WEB_PORT_PLAN.md',
    'web/CHECKPOINTS.md',
]

manifest = io.open(os.path.join(ROOT, 'web', 'CHECKPOINTS.md'), encoding='utf-8').read()
stamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
entries = []
for rel in FILES:
    p = os.path.join(ROOT, rel.replace('/', os.sep))
    if os.path.exists(p):
        with open(p, 'rb') as f:
            entries.append('%s  %s' % (hashlib.sha256(f.read()).hexdigest(), rel))
    else:
        entries.append('MISSING  %s' % rel)

blob = '\n'.join(entries)
master = hashlib.sha256(blob.encode('utf-8')).hexdigest()
manifest += ('\n### m10a checkpoint manifest %s\n```\n%s\n```\nMASTER_SHA256: %s\n'
             % (stamp, blob, master))
io.open(os.path.join(ROOT, 'web', 'CHECKPOINTS.md'), 'a', encoding='utf-8').write(manifest)
print('MASTER_SHA256:', master)
for e in entries:
    print(' ', e)
