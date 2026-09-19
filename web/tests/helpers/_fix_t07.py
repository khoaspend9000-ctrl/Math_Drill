# -*- coding: utf-8 -*-
"""Fix m9_final_integration.test.js tail: T07 must run before summary/exit."""
import io

P = r'e:/lam_game_2026/web/tests/m9_final_integration.test.js'
lines = io.open(P, encoding='utf-8').read().splitlines()

# find summary line index
sum_idx = None
for i, l in enumerate(lines):
    if l.startswith("console.log('M9-G final integration"):
        sum_idx = i
        break
assert sum_idx is not None, 'summary line not found'

head = lines[:sum_idx]
# strip any broken T07 remnants from head (lines after last real check close)
# find last '});' that closes T10
last_close = max(i for i, l in enumerate(head) if l.rstrip() == '});')
head = head[:last_close + 1]

T07 = [
    "check('T07 Skill XP flow + level persisted (SkillManager = AccountSystem port)', function () {",
    "  const tree = new Skill.SkillTreeSystem(JSON.parse(JSON.stringify(skills)), {});",
    "  const acct = mkAccount({ level: 5, xp: 1000, gold: 0 });",
    "  const mgr = new Skill.SkillManager({ skillTree: tree, accountSystem: acct });",
    "  assert.strictEqual(mgr.unlockSkill('gold_boost_1')[0], true, 'unlock with enough XP');",
    "  assert.strictEqual(acct._data.xp, 950, 'unlock deducted exactly 50 XP');",
    "  assert.strictEqual(mgr.upgradeSkill('gold_boost_1')[0], true, 'upgrade level1');",
    "  assert.strictEqual(acct._data.xp, 700, 'upgrade deducted exactly 250 XP');",
    "  assert.strictEqual(acct._data.skill_levels['gold_boost_1'], 2, 'skill level persisted');",
    "});",
]

tail = [
    "",
    "console.log('');",
    "console.log('M9-G final integration: pass=' + pass + ' fail=' + failed);",
    "process.exit(failed === 0 ? 0 : 1);",
    "",
]

out = head + [""] + T07 + tail
io.open(P, 'w', encoding='utf-8', newline='').write('\n'.join(out) + '\n')
print('rewritten: head=%d + T07=%d + tail=%d' % (len(head), len(T07), len(tail)))
