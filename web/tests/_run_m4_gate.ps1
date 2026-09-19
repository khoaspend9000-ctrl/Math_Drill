$suites = @('polish_m4','ui_parity','ui_parity_p1','polish_m2','polish_m3','m8c_ui','m9_final_integration','m10b_states_menu','m10b_state_integration','performance_stress','m4_states','m10a_browser_load','m7b_lesson_select')
$failedRuns = 0
foreach ($s in $suites) {
  $fails = 0
  for ($i = 1; $i -le 5; $i++) {
    node "E:/lam_game_2026/web/tests/$s.test.js" *> $null
    if ($LASTEXITCODE -ne 0) { $fails++ ; Write-Output "$s RUN$i exit=$LASTEXITCODE" }
  }
  Write-Output "$s : 5 runs, failedRuns=$fails"
  $failedRuns += $fails
}
Write-Output "M4_GATE_TOTAL_FAILED_RUNS=$failedRuns"
