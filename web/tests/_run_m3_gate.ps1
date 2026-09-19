$suites = @(
  @{n='polish_m3';                p='E:/lam_game_2026/web/tests/polish_m3.test.js'},
  @{n='m9a_shop';                 p='E:/lam_game_2026/web/tests/m9a_shop.test.js'},
  @{n='m9b_pet_skin';             p='E:/lam_game_2026/web/tests/m9b_pet_skin.test.js'},
  @{n='m9c_gacha';                p='E:/lam_game_2026/web/tests/m9c_gacha.test.js'},
  @{n='m9d_achievements';         p='E:/lam_game_2026/web/tests/m9d_achievements.test.js'},
  @{n='m9e_daily';                p='E:/lam_game_2026/web/tests/m9e_daily.test.js'},
  @{n='m9f_skills_items';         p='E:/lam_game_2026/web/tests/m9f_skills_items.test.js'},
  @{n='m9_final_integration';     p='E:/lam_game_2026/web/tests/m9_final_integration.test.js'},
  @{n='m8c_ui';                   p='E:/lam_game_2026/web/tests/m8c_ui.test.js'},
  @{n='ui_parity';                p='E:/lam_game_2026/web/tests/ui_parity.test.js'},
  @{n='ui_parity_p1';             p='E:/lam_game_2026/web/tests/ui_parity_p1.test.js'},
  @{n='m10b_states_menu';         p='E:/lam_game_2026/web/tests/m10b_states_menu.test.js'},
  @{n='m10b_state_integration';   p='E:/lam_game_2026/web/tests/m10b_state_integration.test.js'}
)
$grandFail = 0
foreach ($s in $suites) {
  if (-not (Test-Path $s.p)) { Write-Host "$($s.n) -> MISSING"; $grandFail++; continue }
  $runs = @()
  for ($i = 1; $i -le 5; $i++) {
    $out  = node $s.p 2>&1 | Out-String
    $exit = $LASTEXITCODE
    $p = ([regex]::Matches($out, '(?m)^PASS ')).Count
    $f = ([regex]::Matches($out, '(?m)^FAIL ')).Count
    if ($f -eq 0 -and $exit -ne 0) { $f = -1 }   # exit!=0 with no parsed FAIL => mark failure
    $runs += "p=$p,f=$f,exit=$exit"
    if ($f -ne 0) { $grandFail++ }
  }
  Write-Host "$($s.n) -> $($runs -join ' | ')"
}
Write-Host "M3_GATE_TOTAL_FAILED_RUNS=$grandFail"
if ($grandFail -gt 0) { exit 1 } else { exit 0 }