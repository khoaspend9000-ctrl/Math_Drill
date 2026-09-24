import os, subprocess, re, sys

os.chdir('E:/lam_game_2026/web/tests')
test_suites = [
    'm2_polish.test.js','m4_states.test.js','m5_player_save.test.js','m6_question.test.js',
    'm6b_mt19937.test.js','m6b_safety_guard.test.js','m7a_game_manager.test.js',
    'm7b_lesson_select.test.js','m7c_lesson.test.js','m7d_victory_defeat.test.js',
    'm8a_effects.test.js','m8b_audio.test.js','m8c_ui.test.js','m8d_performance.test.js',
    'm9a_shop.test.js','m9b_pet_skin.test.js','m9c_gacha.test.js','m9d_achievements.test.js',
    'm9e_daily.test.js','m9f_skills_items.test.js','m9_final_integration.test.js',
    'm10a_browser_load.test.js','m10b_states_menu.test.js','m10b_state_integration.test.js',
    'm10c_auth_frontend.test.js','m10d_admin.test.js','p0_question_pipeline.test.js',
    'final_qa.test.js','ui_parity.test.js','ui_parity_p1.test.js',
    'polish_m2.test.js','polish_m3.test.js','polish_m4.test.js',
    'phase1_foundation.test.js','performance_stress.test.js','book_runtime_probe.test.js',
    'm10qa2_exp_persistence.test.js','m10qa2_data_asset_audit.test.js',
    'm12_clover_book.test.js','m13_settings.test.js',
]

def first(pattern, text, flags=0):
    m = re.search(pattern, text, flags)
    return int(m.group(1)) if m else None

def parse_counts(out):
    """Return (pass, fail, skip) parsed from ANY of the project's summary formats."""
    n_pass = first(r'pass[=:]\s*(\d+)', out)
    n_fail = first(r'fail[=:]\s*(\d+)', out)
    if n_pass is None:
        n_pass = first(r'Passed:\s*(\d+)', out)
        n_fail = n_fail if n_fail is not None else first(r'Failed:\s*(\d+)', out)
    if n_pass is None:
        n_pass = first(r'(\d+)\s*/\s*(\d+)\s*checks', out, re.I)
    if n_pass is None:
        n_pass = first(r'(\d+)\s*/\s*(\d+)\s*tests passed', out, re.I)
    if n_pass is None:
        n_pass = first(r'(\d+)\s*/\s*(\d+)\s*PASS', out, re.I)
    if n_pass is None:
        # count "PASS" summary lines as a last resort
        n_pass = len(re.findall(r'(?m)^\s*PASS\b', out))
    n_skip = first(r'skip[=:]\s*(\d+)', out, re.I)
    if n_skip is None:
        n_skip = len(re.findall(r'(?m)^\s*SKIP\b', out))
    if n_fail is None:
        n_fail = len(re.findall(r'(?m)^\s*FAIL\b', out))
    return n_pass, n_fail, n_skip

total_pass = 0; total_fail = 0; total_skip = 0
harness_errors = []
bad = []
out_lines = []
for suite in test_suites:
    try:
        r = subprocess.run(['node', suite], capture_output=True, timeout=120,
                           cwd='E:/lam_game_2026/web/tests')
        out = ((r.stdout or b'') + (r.stderr or b'')).decode('utf-8', errors='replace')
        p, f, s = parse_counts(out)
        total_pass += p; total_fail += f; total_skip += s
        # Harness-correctness rule (M11 Phase 9):
        #   returncode 0  -> the run must report ZERO failures
        #   returncode !=0 -> there MUST be real failures (or it is a harness error)
        problem = None
        if r.returncode == 0 and f > 0:
            problem = 'HARNESS_ERROR(exit0_but_fail>0)'
            harness_errors.append((suite, problem, r.returncode, p, f))
        elif r.returncode != 0 and f == 0:
            problem = 'HARNESS_ERROR(exit%d_fail0)' % r.returncode
            harness_errors.append((suite, problem, r.returncode, p, f))
        elif f > 0:
            problem = 'FAILS'
            bad.append((suite, problem, r.returncode, p, f))
        st = problem if problem else 'OK'
        out_lines.append('%-42s %-30s pass=%d fail=%d skip=%d' % (suite, st, p, f, s))
    except subprocess.TimeoutExpired:
        bad.append((suite, 'TIMEOUT', None, 0, 0))
        out_lines.append('%-42s TIMEOUT' % suite)
out_lines.append('')
out_lines.append('TOTAL: %d suites, %d pass, %d fail, %d skip' %
                 (len(test_suites), total_pass, total_fail, total_skip))
out_lines.append('PROBLEM SUITES: %s' % (bad if bad else 'NONE'))
out_lines.append('HARNESS_ERRORS: %s' % (harness_errors if harness_errors else 'NONE'))
report = '\n'.join(out_lines)
with open('E:/lam_game_2026/web/tests/_regression_report.txt', 'w', encoding='utf-8') as fh:
    fh.write(report)
print(report)
sys.exit(0 if (not bad and not harness_errors) else 1)
