$suites = @(
  @{p='E:/lam_game_2026/server/tests/admin_rbac.test.js'},
  @{p='E:/lam_game_2026/web/tests/phase1_foundation.test.js'},
  @{p='E:/lam_game_2026/web/tests/m2_polish.test.js'},
  @{p='E:/lam_game_2026/web/tests/m4_states.test.js'},
  @{p='E:/lam_game_2026/web/tests/m5_player_save.test.js'},
  @{p='E:/lam_game_2026/web/tests/m6_question.test.js'},
  @{p='E:/lam_game_2026/web/tests/m6b_mt19937.test.js'},
  @{p='E:/lam_game_2026/web/tests/m6b_safety_guard.test.js'},
  @{p='E:/lam_game_2026/web/tests/m6b_vectors.test.js'},
  @{p='E:/lam_game_2026/web/tests/m7a_game_manager.test.js'},
  @{p='E:/lam_game_2026/web/tests/m7b_lesson_select.test.js'},
  @{p='E:/lam_game_2026/web/tests/m7c_lesson.test.js'},
  @{p='E:/lam_game_2026/web/tests/m7d_victory_defeat.test.js'},
  @{p='E:/lam_game_2026/web/tests/m8a_effects.test.js'},
  @{p='E:/lam_game_2026/web/tests/m8b_audio.test.js'},
  @{p='E:/lam_game_2026/web/tests/m8c_ui.test.js'},
  @{p='E:/lam_game_2026/web/tests/m8d_performance.test.js'},
  @{p='E:/lam_game_2026/web/tests/m9a_shop.test.js'},
  @{p='E:/lam_game_2026/web/tests/m9b_pet_skin.test.js'},
  @{p='E:/lam_game_2026/web/tests/m9c_gacha.test.js'},
  @{p='E:/lam_game_2026/web/tests/m9d_achievements.test.js'},
  @{p='E:/lam_game_2026/web/tests/m9e_daily.test.js'},
  @{p='E:/lam_game_2026/web/tests/m9f_skills_items.test.js'},
  @{p='E:/lam_game_2026/web/tests/m9_final_integration.test.js'},
  @{p='E:/lam_game_2026/web/tests/m10a_browser_load.test.js'},
  @{p='E:/lam_game_2026/web/tests/m10b_states_menu.test.js'},
  @{p='E:/lam_game_2026/web/tests/m10b_state_integration.test.js'},
  @{p='E:/lam_game_2026/web/tests/m10c_auth_frontend.test.js'},
  @{p='E:/lam_game_2026/web/tests/m10d_admin.test.js'},
  @{p='E:/lam_game_2026/web/tests/polish_m2.test.js'},
  @{p='E:/lam_game_2026/web/tests/polish_m3.test.js'},
  @{p='E:/lam_game_2026/web/tests/polish_m4.test.js'},
  @{p='E:/lam_game_2026/web/tests/book_runtime_probe.test.js'},
  @{p='E:/lam_game_2026/web/tests/final_qa.test.js'},
  @{p='E:/lam_game_2026/web/tests/final_qa_browser.test.js'},
  @{p='E:/lam_game_2026/web/tests/ui_parity.test.js'},
  @{p='E:/lam_game_2026/web/tests/ui_parity_p1.test.js'},
  @{p='E:/lam_game_2026/web/tests/performance_stress.test.js'}
)
$totalFail = 0
$suiteCount = 0
foreach ($s in $suites) {
  if (-not (Test-Path $s.p)) { Write-Host "MISSING $($s.p)"; $totalFail++; continue }
  $suiteCount++
  $out = node $s.p 2>&1 | Out-String
  $exit = $LASTEXITCODE
  # pass/fail counters: support 'PASS '/'(N/M checks)' style suites
  $p1 = ([regex]::Matches($out, '(?m)^PASS ')).Count
  $f1 = ([regex]::Matches($out, '(?m)^FAIL ')).Count
  $pn = ([regex]::Matches($out, 'pass=(\d+)') | ForEach-Object { [int]$_.Groups[1].Value } | Measure-Object -Sum).Sum
  $fn = ([regex]::Matches($out, 'fail=(\d+)') | ForEach-Object { [int]$_.Groups[1].Value } | Measure-Object -Sum).Sum
  $p = $p1 + $pn
  $f = $f1 + $fn
  if ($null -eq $p) { $p = 0 }
  if ($null -eq $f) { $f = 0 }
  $name = Split-Path $s.p -Leaf
  if ($f -gt 0 -or $exit -ne 0) { $totalFail++ }
  Write-Host "$name -> p=$p f=$f exit=$exit"
  if ($f -gt 0 -or $exit -ne 0) { $out -split "`n" | Select-String 'FAIL' | ForEach-Object { Write-Host "  $_" } }
}
Write-Host "SUITES_RUN=$suiteCount"
Write-Host "TOTAL_FAILED_SUITES=$totalFail"
if ($totalFail -gt 0) { exit 1 } else { exit 0 }