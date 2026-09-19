# -*- coding: utf-8 -*-
"""M10-A doc updates: WEB_PORT_PLAN.md + web/CHECKPOINTS.md (UTF-8)."""
import io
import hashlib

def sha16(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()[:16]

PLAN = r'e:/lam_game_2026/WEB_PORT_PLAN.md'
CKPT = r'e:/lam_game_2026/web/CHECKPOINTS.md'

plan_add = u"""

## M10-A — BROWSER RUNTIME INTEGRATION = PASS (2026-09-06)

- index.html: 14 -> 31 script tags (17 module M6/M7/M8/M9 vao browser runtime)
- Load order dependency-verified; performance.js TRUOC effects.js (particleBudget singleton)
- main.js: wire QuestionGenerator adapter + DataLoader thay null placeholder
- Legacy KHONG load: states.js, effects_part1.js
- Moi test: m10a_browser_load 16/16
- m9_final_integration REBUILD sau corruption: 10/10 (API that: equipped_pen,
  daily_streak, shield_1life card title, SkillManager persist path)
- Regression: 23 suites x 10 runs = 230/230 exit=0, 0 intermittent
- Browser smoke: UNAVAILABLE (khong co automation) — KHONG tuyen bo browser PASS
- Chi tiet: M10_A_INTEGRATION_REPORT.md
"""
t = io.open(PLAN, encoding='utf-8').read()
if 'M10-A — BROWSER RUNTIME INTEGRATION' not in t:
    t += plan_add
    io.open(PLAN, 'w', encoding='utf-8').write(t)
    print('PLAN updated')

ckpt_add = u"""

## m10a-browser-integration (2026-09-06)

- files: web/index.html (31 scripts) | web/js/main.js (wire M6/M7)
  | web/tests/m10a_browser_load.test.js (16/16)
  | web/tests/m9_final_integration.test.js (rebuilt, 10/10)
  | M10_A_INTEGRATION_REPORT.md | WEB_PORT_PLAN.md
- idx.html %s | main.js %s | m10a %s | m9final %s
- regression: 23x10 = 230/230 exit=0
- browser: UNAVAILABLE (khong automation)
""" % (sha16(r'e:/lam_game_2026/web/index.html'),
       sha16(r'e:/lam_game_2026/web/js/main.js'),
       sha16(r'e:/lam_game_2026/web/tests/m10a_browser_load.test.js'),
       sha16(r'e:/lam_game_2026/web/tests/m9_final_integration.test.js'))
t = io.open(CKPT, encoding='utf-8').read()
if 'm10a-browser-integration' not in t:
    t += ckpt_add
    io.open(CKPT, 'w', encoding='utf-8').write(t)
    print('CHECKPOINTS updated')

print('sha16 index.html  =', sha16(r'e:/lam_game_2026/web/index.html'))
print('sha16 main.js     =', sha16(r'e:/lam_game_2026/web/js/main.js'))
print('sha16 m10a test   =', sha16(r'e:/lam_game_2026/web/tests/m10a_browser_load.test.js'))
print('sha16 m9 final    =', sha16(r'e:/lam_game_2026/web/tests/m9_final_integration.test.js'))
