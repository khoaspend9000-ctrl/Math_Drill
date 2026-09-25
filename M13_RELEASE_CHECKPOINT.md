# MathDrill M13 Closeout Checkpoint

- Baseline: `e69a3863c84005c84178ec49e027f8b71856537b`
- M13 implementation: `84f8a93` harness race fix, `7d1419c` playable Settings+Password, `6bff2c8` local RC record
- Production fix: `9f0344c012b54b695def9612bc10b9d143292e23` (persist selected grade through web/js/auth.js, server/server.js, server/auth_service.js, server/user_store.js + server/tests/auth.test.js)
- Production: https://math-drill-iwys.onrender.com = 9f0344c (render/main = 9f0344c; live /js/auth.js byte-identical to 9f0344c blob, SHA-256 9c9ddb50...; 8/8 critical files MATCH)
- Grade 3: 79/80/81 = NOT_REACHED_BY_PRACTICAL_QA (ordinary year-end reviews; Web `(level-1)//6+1` == Desktop `(level-1)//6+1`; L79=469, L80=475, L81=481; injection prohibited)
- Bugs: found 2 (Settings locked/no-state; grade lost on register), fixed 2, remaining 0
- Regression: web 573/0/15/0; server 127/0/0; Chromium final QA 90/0
- Python guard: PY_DIFF=0, PYTHON_CHANGED=NO
- Render: DEPLOYED + VERIFIED at 9f0344c
- Compact closeout: 120 live questions (105 correct/15 wrong, 720 invariants, Victory 7 + Defeat 1); API persistence level37/exp13882/gold121244/grade3 identical; anon player-data 401; normal-user admin 403; login after reload OK via fresh-field harness (prior reload-timeout was stale-field harness artifact, not product defect; no code change needed)

