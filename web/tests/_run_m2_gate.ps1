$suites = @('polish_m2','m2_polish','ui_parity','m8c_ui','m10a_browser_load','m10b_states_menu','m10b_state_integration','m10c_auth_frontend','m10d_admin','phase1_foundation','m7c_lesson')
$results = @{}
foreach ($s in $suites) {
  $results[$s] = @()
  for ($i = 1; $i -le 5; $i++) {
    $out = node "E:/lam_game_2026/web/tests/$s.test.js" 2>&1 | Out-String
    $p = ([regex]::Matches($out, 'PASS ')).Count
    $f = ([regex]::Matches($out, 'FAIL ')).Count
    $exit = $LASTEXITCODE
    $results[$s] += "run$i:p=$p,f=$f,exit=$exit"
  }
}
foreach ($k in $results.Keys) { Write-Host "$k -> $($results[$k] -join ' | ')" }