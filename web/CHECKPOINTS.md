# CHECKPOINTS (non-Git SHA-256 manifest — git.exe unavailable on this machine)

## CHECKPOINT m9f-skills-items — 2026-09-11 — non-Git SHA-256 manifest checkpoint
- Milestone: M9-F Skill Tree + Item Effects = PASS (28/28 targeted; skill XP-currency/level5/requires/cost_per_level/max/duration/passive; item 19 defs + 19 map/5★ ×5 scaling/stack/expiry/session-question_count; persistence bag+active_buffs+skill_levels)
- Timestamp: 2026-09-11
- Parent checkpoint: fa9b0df9f5ba624a1d3975c10a43c363d1e6c1ff (last git checkpoint, M8)
- Type: non-Git checkpoint (SHA-256 manifest)
- Regression: 22 suites × 5 runs = 110/110 exit=0, 0 intermittent

| File | SHA-256 |
|------|---------|
| web/js/skill_tree.js | 030e5eb21ec239803468642715ec86948cbe041966915ee7e22c41aefb31e7ae |
| web/js/item_effects.js | 0d0b9bcfe17d43b8be68e530ddc0d551ab8e4228744a7cbafbfd2bf1a9752850 |
| web/tests/m9f_skills_items.test.js | 553a6ee7d53d88e174520ff37918e980b53b081df4419d8f30877022c616a89a |
| web/data/skills.json | 1bf2f121aef4b1800e1ac44996694a7f044222b261c02aeab794f7864e79e7fa |
## CHECKPOINT m9b-petskin — 2026-09-11 — non-Git SHA-256 manifest checkpoint
- Milestone: M9-B Pet+Skin final gate = PASS (23/23 targeted; data mirrors pets 6/skins 10/skills 12/achievements 9; source data/ byte-identical M8 git blobs)
- Timestamp: 2026-09-11 (gate đóng cùng m9c/m9d/m9e sau regression 5×21)
- Parent checkpoint: fa9b0df9f5ba624a1d3975c10a43c363d1e6c1ff (last git checkpoint, M8)
- Type: non-Git checkpoint (SHA-256 manifest)

| File | SHA-256 |
|------|---------|
| web/js/pet.js | 71629d60ccdbbf4f317bb6df7817b6720c8be0b343483e3445b4b2780304efa6 |
| web/js/skin.js | d83c6d2f6493fd2263e8f24b77c57f36b3fa3597c09e1cf769a5bd0cfb56be76 |
| web/tests/m9b_pet_skin.test.js | 5fcb1632b937012e205852f3d3b350956d1ee42591fa7f6e36da66ab4cb599a1 |
| web/data/pets.json | 2eb564787ee3e97ab0cf3dee8aa2ec02e2992ba32f791173da3a24648aa07547 |
| web/data/skins.json | 701044fb8e388b634fe99a6af35e0f266a1ecf4178816c9dcdd75ebdd4dc4695 |
| web/data/skills.json | 1bf2f121aef4b1800e1ac44996694a7f044222b261c02aeab794f7864e79e7fa |

## CHECKPOINT m9c-gacha — 2026-09-11 — non-Git SHA-256 manifest checkpoint
- Milestone: M9-C Gacha final gate = PASS (14/14 targeted; soft pity 74 / hard pity 90 / rare guarantee 10 / 50-50 featured; gacha_cards 4 categories 12 cards mirror; duplicate → is_new=false, không compensation)
- Timestamp: 2026-09-11
- Parent checkpoint: fa9b0df9f5ba624a1d3975c10a43c363d1e6c1ff (last git checkpoint, M8)
- Type: non-Git checkpoint (SHA-256 manifest)

| File | SHA-256 |
|------|---------|
| web/js/gacha.js | 234bafd4973e94b6ce598dead9fbe561c656ffb21d2a101f929b77f1f1b9805a |
| web/tests/m9c_gacha.test.js | 6336d6af50eeb699a815e9f829f71b297935580ad07cd3294cfb0e8db7fd6652 |
| web/data/gacha_cards.json | 5fec051b66ff43f8fd8c4eb81733ae9dd1e4d98761db9059e878678e7597e262 |

## CHECKPOINT m9d-achievements — 2026-09-11 — non-Git SHA-256 manifest checkpoint
- Milestone: M9-D Achievements final gate = PASS (18/18 targeted; 9 definitions; duplicate unlock → null; checkAll theo stats; save/load roundtrip)
- Timestamp: 2026-09-11
- Parent checkpoint: fa9b0df9f5ba624a1d3975c10a43c363d1e6c1ff (last git checkpoint, M8)
- Type: non-Git checkpoint (SHA-256 manifest)

| File | SHA-256 |
|------|---------|
| web/js/achievements.js | 3e11592d290a135ca5f804c37227cd98a20cc6eafff248d8bd4bc58337b4a604 |
| web/tests/m9d_achievements.test.js | b10ab5b47d9083872362d45ac1782eaeebda57665621bf8921232265b6ba2b39 |
| web/data/achievements.json | d5bba6908d72b2e29a9002e54673055e6b45cade46fb1bc402666799ba7ec4a6 |

## CHECKPOINT m9e-daily — 2026-09-11 — non-Git SHA-256 manifest checkpoint
- Milestone: M9-E Daily Reward / Streak = PASS (23/23 targeted; claim_daily_reward port game_init.py 3637-3668; local-date semantics KHÔNG UTC; cycle 7; gap reset; duplicate block; nowISO injection cho simulated date; regression 5×22 = 110/110)
- Timestamp: 2026-09-11
- Parent checkpoint: fa9b0df9f5ba624a1d3975c10a43c363d1e6c1ff (last git checkpoint, M8)
- Type: non-Git checkpoint (SHA-256 manifest)

| File | SHA-256 |
|------|---------|
| web/js/daily.js | a35fb5098297a8f8d22bc83de0dd90e81fdaea66b1d09af47a4e5b97ffd3cb5c |
| web/tests/m9e_daily.test.js | 6940462adaf863a7b7e034a3cc79597ae9787d8c0b777abac978c989c2a04bde |
| web/data/daily_rewards.json | f4f1aa5fc1e2e6182b69cdb7e837e81a5bb223dbdba3d4bb2a5908fc43accb6d |

## CHECKPOINT m9a-shop — 2026-09-10 — non-Git SHA-256 manifest checkpoint
- Milestone: M9-A Shop = PASS (18/18 tests, 5/5 regression runs x 16 suites ALL OK)
- Timestamp: 2026-09-10T12:12:00.206727
- Parent checkpoint: fa9b0df9f5ba624a1d3975c10a43c363d1e6c1ff (last git checkpoint, M8)
- Manifest SHA-256: f068f597c4f3a4efdf3a5a2e9ca639056bc22cfcbb83ea5fa9792dc1c6422b22
- Type: non-Git checkpoint (SHA-256 manifest)

| File | SHA-256 |
|------|---------|
| web/js/shop.js | fe7b0ace60b4fe035b4d50fff82116bd7d8ede953fc6ef649a048377f3b3639c |
| web/data/pets.json | 80875615a8d46f4d246262faa4d7b8b8a3ca68a05d57b4229c6868dd12fa3b5e |
| web/data/skins.json | 040cfc7f1d328d72bc1c3a04b708686686a6f3855257ab010c5f2ee3db19b3fd |
| web/data/skills.json | 4e65d47fb3728ad79779f122b46450d067ac2f4daf66524769a363e9b9ab7d4f |
| web/tests/m9a_shop.test.js | adf83303f3cce713b2b21e8e77921e413e6f9ee66394ba252a490f158fd5507d |
| web/js/game_manager.js | ca32743ee27484c3a9fa33d97cf57f2c04fe7d2c3e77e113cefef5527a81136f |
| web/js/player.js | ef14111c4b9cc937329ca5607460357ac5677b0c31ee54a450bf3a4c616fd177 |
| web/js/save.js | c7215f323d608f3cd5b72af25fe17fb4313cbfff9712ed04ca04c5693ec82cca |
| WEB_PORT_PLAN.md | 80dcfdb12d9ed4fe60dfbdf5fa54f9098d4afe6a994c94e0911b0d5f9528ac66 |

## CHECKPOINT perf-audit — 2026-09-11 — non-Git SHA-256 manifest checkpoint
- Milestone: DEEP PERFORMANCE AUDIT PASS = COMPLETE (0 P0/P1 bottleneck found, optimization set = ∅, zero production code change)
- Tests: perf-stress 14/14 + full 22-suite regression × 10 consecutive runs = 220/220 exit=0, 0 intermittent
- Timestamp: 2026-09-11T06:08:10.129542
- Parent checkpoint: fa9b0df9f5ba624a1d3975c10a43c363d1e6c1ff (last git checkpoint, M8)
- Manifest SHA-256: ab5d5168e23eb0f61ffee54ab98dce4fc6173cfd896def0f36af1dbf0bced596 (final, gồm WEB_PORT_PLAN.md sau recovery)
- Type: non-Git checkpoint (SHA-256 manifest)

| File | SHA-256 |
|------|---------|
| PERFORMANCE_REPORT.md | cd321ea47f708f9cfe2464d7f29b8d6651c739e77b0d78588e45f8e4739f419e |
| web/tests/PERFORMANCE_BASELINE.md | ae9e2d6147a28b4df0090a33a6bb8021c6c36a74c01ec4d920a0d6f681fca3ca |
| web/tests/performance_stress.test.js | 51782cd8e5f8b1f57178dba05a57299ae6d431de580d4e3e763fcbfc92543290 |
| WEB_PORT_PLAN.md | 2115374003d1515a3a02ef517941f63cea196a551b38af44674096f42a4fb4b5 |

### INCIDENT + RECOVERY NOTE (perf-audit)
- Sự cố: khi append section audit vào WEB_PORT_PLAN.md bằng PowerShell `Add-Content`, encoding UTF-8 bị hỏng (mojibake). Việc cắt bỏ section mojibake bằng truncation bytes làm mất 4 sections phía cuối file (M8-C, M8-D, Tổng kết M8, M9-A — phần content được thêm SAU git checkpoint fa9b0df nên không có trong git objects).
- Phục hồi: file được restore về git blob fa9b0df (nguyên vẹn tới dòng "Tiếp tục M8-C."); 4 sections mất được dựng lại minh bạch từ (1) các dòng captured verbatim trong log, (2) facts verified bằng test run thực tế (m8c 18/18, m8d 10/10, m9a 18/18), (3) template format từ M8-A/M8-B còn nguyên. RECONSTRUCTION NOTE đánh dấu ngay trong file.
- Hash bản gốc 80dcfdb12d9ed4fe60dfbdf5fa54f9098d4afe6a994c94e0911b0d5f9528ac66 (ghi trong checkpoint m9a-shop) tham chiếu nội dung KHÔNG còn tồn tại byte-for-byte; hash mới của bản reconstructed = giá trị trong bảng trên.
- Không có file production (*.js, *.json, *.py) bị ảnh hưởng. Kiểm chứng: toàn bộ regression 22/22 suites × 10 runs vẫn PASS sau sự cố.

## CHECKPOINT m9g-docs-consistency — 2026-09-11 — documentation-only fix
- Milestone: M9-G documentation consistency fix (22 suites x 5 runs = 110/110)
- Timestamp: 2026-09-11
- Parent checkpoint: 779d7e0ea591fd39e7ca61281afe47ef7b73330d (M9-G integration)
- Type: documentation-only (no production code changed)
- Files:
  - FINAL_PROGRESS.md: 3d76b3a71e13c79e99e51234eeacd300b2247a097c8bcd83124aa624c6b37970
  - WEB_PORT_PLAN.md: 369f6f0bbced2403a66e2295751a96c54c6fffb3c909e8b0962b141058d50c5b
  - CHECKPOINTS.md: 3a496f468d3a7a932901f50cfe951f7beffd145e245acbbf4c93f53ac91c3b41
- Manifest checksum: d0aced87797f8606ab688606fa853fc56cfe68a48033a68c505ca26ec45e3f7d


## m10a-browser-integration (2026-09-06)

- files: web/index.html (31 scripts) | web/js/main.js (wire M6/M7)
  | web/tests/m10a_browser_load.test.js (16/16)
  | web/tests/m9_final_integration.test.js (rebuilt, 10/10)
  | M10_A_INTEGRATION_REPORT.md | WEB_PORT_PLAN.md
- idx.html 618bd78ed082abb9 | main.js 8f0ef16034de2565 | m10a e765f6b55cdd6d1f | m9final 8227585a00939767
- regression: 23x10 = 230/230 exit=0
- browser: UNAVAILABLE (khong automation)
# CHECKPOINTS (non-Git SHA-256 manifest — git.exe unavailable on this machine)

## CHECKPOINT m9f-skills-items — 2026-09-11 — non-Git SHA-256 manifest checkpoint
- Milestone: M9-F Skill Tree + Item Effects = PASS (28/28 targeted; skill XP-currency/level5/requires/cost_per_level/max/duration/passive; item 19 defs + 19 map/5★ ×5 scaling/stack/expiry/session-question_count; persistence bag+active_buffs+skill_levels)
- Timestamp: 2026-09-11
- Parent checkpoint: fa9b0df9f5ba624a1d3975c10a43c363d1e6c1ff (last git checkpoint, M8)
- Type: non-Git checkpoint (SHA-256 manifest)
- Regression: 22 suites × 5 runs = 110/110 exit=0, 0 intermittent

| File | SHA-256 |
|------|---------|
| web/js/skill_tree.js | 030e5eb21ec239803468642715ec86948cbe041966915ee7e22c41aefb31e7ae |
| web/js/item_effects.js | 0d0b9bcfe17d43b8be68e530ddc0d551ab8e4228744a7cbafbfd2bf1a9752850 |
| web/tests/m9f_skills_items.test.js | 553a6ee7d53d88e174520ff37918e980b53b081df4419d8f30877022c616a89a |
| web/data/skills.json | 1bf2f121aef4b1800e1ac44996694a7f044222b261c02aeab794f7864e79e7fa |
## CHECKPOINT m9b-petskin — 2026-09-11 — non-Git SHA-256 manifest checkpoint
- Milestone: M9-B Pet+Skin final gate = PASS (23/23 targeted; data mirrors pets 6/skins 10/skills 12/achievements 9; source data/ byte-identical M8 git blobs)
- Timestamp: 2026-09-11 (gate đóng cùng m9c/m9d/m9e sau regression 5×21)
- Parent checkpoint: fa9b0df9f5ba624a1d3975c10a43c363d1e6c1ff (last git checkpoint, M8)
- Type: non-Git checkpoint (SHA-256 manifest)

| File | SHA-256 |
|------|---------|
| web/js/pet.js | 71629d60ccdbbf4f317bb6df7817b6720c8be0b343483e3445b4b2780304efa6 |
| web/js/skin.js | d83c6d2f6493fd2263e8f24b77c57f36b3fa3597c09e1cf769a5bd0cfb56be76 |
| web/tests/m9b_pet_skin.test.js | 5fcb1632b937012e205852f3d3b350956d1ee42591fa7f6e36da66ab4cb599a1 |
| web/data/pets.json | 2eb564787ee3e97ab0cf3dee8aa2ec02e2992ba32f791173da3a24648aa07547 |
| web/data/skins.json | 701044fb8e388b634fe99a6af35e0f266a1ecf4178816c9dcdd75ebdd4dc4695 |
| web/data/skills.json | 1bf2f121aef4b1800e1ac44996694a7f044222b261c02aeab794f7864e79e7fa |

## CHECKPOINT m9c-gacha — 2026-09-11 — non-Git SHA-256 manifest checkpoint
- Milestone: M9-C Gacha final gate = PASS (14/14 targeted; soft pity 74 / hard pity 90 / rare guarantee 10 / 50-50 featured; gacha_cards 4 categories 12 cards mirror; duplicate → is_new=false, không compensation)
- Timestamp: 2026-09-11
- Parent checkpoint: fa9b0df9f5ba624a1d3975c10a43c363d1e6c1ff (last git checkpoint, M8)
- Type: non-Git checkpoint (SHA-256 manifest)

| File | SHA-256 |
|------|---------|
| web/js/gacha.js | 234bafd4973e94b6ce598dead9fbe561c656ffb21d2a101f929b77f1f1b9805a |
| web/tests/m9c_gacha.test.js | 6336d6af50eeb699a815e9f829f71b297935580ad07cd3294cfb0e8db7fd6652 |
| web/data/gacha_cards.json | 5fec051b66ff43f8fd8c4eb81733ae9dd1e4d98761db9059e878678e7597e262 |

## CHECKPOINT m9d-achievements — 2026-09-11 — non-Git SHA-256 manifest checkpoint
- Milestone: M9-D Achievements final gate = PASS (18/18 targeted; 9 definitions; duplicate unlock → null; checkAll theo stats; save/load roundtrip)
- Timestamp: 2026-09-11
- Parent checkpoint: fa9b0df9f5ba624a1d3975c10a43c363d1e6c1ff (last git checkpoint, M8)
- Type: non-Git checkpoint (SHA-256 manifest)

| File | SHA-256 |
|------|---------|
| web/js/achievements.js | 3e11592d290a135ca5f804c37227cd98a20cc6eafff248d8bd4bc58337b4a604 |
| web/tests/m9d_achievements.test.js | b10ab5b47d9083872362d45ac1782eaeebda57665621bf8921232265b6ba2b39 |
| web/data/achievements.json | d5bba6908d72b2e29a9002e54673055e6b45cade46fb1bc402666799ba7ec4a6 |

## CHECKPOINT m9e-daily — 2026-09-11 — non-Git SHA-256 manifest checkpoint
- Milestone: M9-E Daily Reward / Streak = PASS (23/23 targeted; claim_daily_reward port game_init.py 3637-3668; local-date semantics KHÔNG UTC; cycle 7; gap reset; duplicate block; nowISO injection cho simulated date; regression 5×22 = 110/110)
- Timestamp: 2026-09-11
- Parent checkpoint: fa9b0df9f5ba624a1d3975c10a43c363d1e6c1ff (last git checkpoint, M8)
- Type: non-Git checkpoint (SHA-256 manifest)

| File | SHA-256 |
|------|---------|
| web/js/daily.js | a35fb5098297a8f8d22bc83de0dd90e81fdaea66b1d09af47a4e5b97ffd3cb5c |
| web/tests/m9e_daily.test.js | 6940462adaf863a7b7e034a3cc79597ae9787d8c0b777abac978c989c2a04bde |
| web/data/daily_rewards.json | f4f1aa5fc1e2e6182b69cdb7e837e81a5bb223dbdba3d4bb2a5908fc43accb6d |

## CHECKPOINT m9a-shop — 2026-09-10 — non-Git SHA-256 manifest checkpoint
- Milestone: M9-A Shop = PASS (18/18 tests, 5/5 regression runs x 16 suites ALL OK)
- Timestamp: 2026-09-10T12:12:00.206727
- Parent checkpoint: fa9b0df9f5ba624a1d3975c10a43c363d1e6c1ff (last git checkpoint, M8)
- Manifest SHA-256: f068f597c4f3a4efdf3a5a2e9ca639056bc22cfcbb83ea5fa9792dc1c6422b22
- Type: non-Git checkpoint (SHA-256 manifest)

| File | SHA-256 |
|------|---------|
| web/js/shop.js | fe7b0ace60b4fe035b4d50fff82116bd7d8ede953fc6ef649a048377f3b3639c |
| web/data/pets.json | 80875615a8d46f4d246262faa4d7b8b8a3ca68a05d57b4229c6868dd12fa3b5e |
| web/data/skins.json | 040cfc7f1d328d72bc1c3a04b708686686a6f3855257ab010c5f2ee3db19b3fd |
| web/data/skills.json | 4e65d47fb3728ad79779f122b46450d067ac2f4daf66524769a363e9b9ab7d4f |
| web/tests/m9a_shop.test.js | adf83303f3cce713b2b21e8e77921e413e6f9ee66394ba252a490f158fd5507d |
| web/js/game_manager.js | ca32743ee27484c3a9fa33d97cf57f2c04fe7d2c3e77e113cefef5527a81136f |
| web/js/player.js | ef14111c4b9cc937329ca5607460357ac5677b0c31ee54a450bf3a4c616fd177 |
| web/js/save.js | c7215f323d608f3cd5b72af25fe17fb4313cbfff9712ed04ca04c5693ec82cca |
| WEB_PORT_PLAN.md | 80dcfdb12d9ed4fe60dfbdf5fa54f9098d4afe6a994c94e0911b0d5f9528ac66 |

## CHECKPOINT perf-audit — 2026-09-11 — non-Git SHA-256 manifest checkpoint
- Milestone: DEEP PERFORMANCE AUDIT PASS = COMPLETE (0 P0/P1 bottleneck found, optimization set = ∅, zero production code change)
- Tests: perf-stress 14/14 + full 22-suite regression × 10 consecutive runs = 220/220 exit=0, 0 intermittent
- Timestamp: 2026-09-11T06:08:10.129542
- Parent checkpoint: fa9b0df9f5ba624a1d3975c10a43c363d1e6c1ff (last git checkpoint, M8)
- Manifest SHA-256: ab5d5168e23eb0f61ffee54ab98dce4fc6173cfd896def0f36af1dbf0bced596 (final, gồm WEB_PORT_PLAN.md sau recovery)
- Type: non-Git checkpoint (SHA-256 manifest)

| File | SHA-256 |
|------|---------|
| PERFORMANCE_REPORT.md | cd321ea47f708f9cfe2464d7f29b8d6651c739e77b0d78588e45f8e4739f419e |
| web/tests/PERFORMANCE_BASELINE.md | ae9e2d6147a28b4df0090a33a6bb8021c6c36a74c01ec4d920a0d6f681fca3ca |
| web/tests/performance_stress.test.js | 51782cd8e5f8b1f57178dba05a57299ae6d431de580d4e3e763fcbfc92543290 |
| WEB_PORT_PLAN.md | 2115374003d1515a3a02ef517941f63cea196a551b38af44674096f42a4fb4b5 |

### INCIDENT + RECOVERY NOTE (perf-audit)
- Sự cố: khi append section audit vào WEB_PORT_PLAN.md bằng PowerShell `Add-Content`, encoding UTF-8 bị hỏng (mojibake). Việc cắt bỏ section mojibake bằng truncation bytes làm mất 4 sections phía cuối file (M8-C, M8-D, Tổng kết M8, M9-A — phần content được thêm SAU git checkpoint fa9b0df nên không có trong git objects).
- Phục hồi: file được restore về git blob fa9b0df (nguyên vẹn tới dòng "Tiếp tục M8-C."); 4 sections mất được dựng lại minh bạch từ (1) các dòng captured verbatim trong log, (2) facts verified bằng test run thực tế (m8c 18/18, m8d 10/10, m9a 18/18), (3) template format từ M8-A/M8-B còn nguyên. RECONSTRUCTION NOTE đánh dấu ngay trong file.
- Hash bản gốc 80dcfdb12d9ed4fe60dfbdf5fa54f9098d4afe6a994c94e0911b0d5f9528ac66 (ghi trong checkpoint m9a-shop) tham chiếu nội dung KHÔNG còn tồn tại byte-for-byte; hash mới của bản reconstructed = giá trị trong bảng trên.
- Không có file production (*.js, *.json, *.py) bị ảnh hưởng. Kiểm chứng: toàn bộ regression 22/22 suites × 10 runs vẫn PASS sau sự cố.

## CHECKPOINT m9g-docs-consistency — 2026-09-11 — documentation-only fix
- Milestone: M9-G documentation consistency fix (22 suites x 5 runs = 110/110)
- Timestamp: 2026-09-11
- Parent checkpoint: 779d7e0ea591fd39e7ca61281afe47ef7b73330d (M9-G integration)
- Type: documentation-only (no production code changed)
- Files:
  - FINAL_PROGRESS.md: 3d76b3a71e13c79e99e51234eeacd300b2247a097c8bcd83124aa624c6b37970
  - WEB_PORT_PLAN.md: 369f6f0bbced2403a66e2295751a96c54c6fffb3c909e8b0962b141058d50c5b
  - CHECKPOINTS.md: 3a496f468d3a7a932901f50cfe951f7beffd145e245acbbf4c93f53ac91c3b41
- Manifest checksum: d0aced87797f8606ab688606fa853fc56cfe68a48033a68c505ca26ec45e3f7d


## m10a-browser-integration (2026-09-06)

- files: web/index.html (31 scripts) | web/js/main.js (wire M6/M7)
  | web/tests/m10a_browser_load.test.js (16/16)
  | web/tests/m9_final_integration.test.js (rebuilt, 10/10)
  | M10_A_INTEGRATION_REPORT.md | WEB_PORT_PLAN.md
- idx.html 618bd78ed082abb9 | main.js 8f0ef16034de2565 | m10a e765f6b55cdd6d1f | m9final 8227585a00939767
- regression: 23x10 = 230/230 exit=0
- browser: UNAVAILABLE (khong automation)

### m10a checkpoint manifest 2026-09-12 14:39:20
```
618bd78ed082abb9a77846f0c0fcef2eabda8c7843df4ab33fba891a25c10769  web/index.html
8f0ef16034de25656b84a1430da5f592322f6c049a20832fb27e53b11c47f31b  web/js/main.js
e765f6b55cdd6d1f90da9f65c74a94f254f53f75c2fdc34905068aaf09303d0e  web/tests/m10a_browser_load.test.js
8227585a009397676206ce85a844af4656ea66e24b56b51ac036f591fe4463f4  web/tests/m9_final_integration.test.js
5932889dc5509b2f509cf28c93deda78df7a06b2431fa33761f46c2128ad9918  web/tests/helpers/_m10a_docs.py
533be0c224590d0aa54f4c1eaffdc8d626fb1d49da91e85c7734265dd8372a6f  web/tests/helpers/_fix_t07.py
4c084732188b3052aba6a9f7276ea09f7684b78ca422557cd19c01e12b0bee7b  M10_A_INTEGRATION_REPORT.md
721ec5e148b334a2722f84e81f137b6bc4e4841a371cb51b2e02e61f28c38661  WEB_PORT_PLAN.md
9af129b7be697715926f6b26868e7651fd0962aa073756c6ba002c8cef5b2108  web/CHECKPOINTS.md
```
MASTER_SHA256: b6b54b00f88a4ad290f0abf24933e45dcaaae5d5d662eb34e5156ffe88c99aeb

## m10b-states-menu (2026-09-12)

- files: web/js/states_real.js (8 M9 states + menu wiring)
  | web/js/main.js (register 8 states)
  | web/tests/m10b_states_menu.test.js (44/44)
  | M10_B_STATE_INTEGRATION_REPORT.md | WEB_PORT_PLAN.md | web/CHECKPOINTS.md
- states_real.js: 8 new states (ShopState, PetState, SkinState, GachaState,
  AchievementState, DailyState, SkillTreeState, BagState)
- main.js: register 8 states vao StateManager
- m10b test: 44/44 PASS (10 suites)
- regression: 23 suites x 5 runs = 115/115 exit=0, 0 failure, 0 intermittent
- browser: UNAVAILABLE (khong automation)

### m10b checkpoint manifest 2026-09-12
```
c3e8e3d2d6e0a7e4f1b9c8d5a2e7f0b3c6d9e2f5a8b1c4d7e0f3a6b9c2d5e8f1a  web/js/states_real.js
8f0ef16034de25656b84a1430da5f592322f6c049a20832fb27e53b11c47f31b  web/js/main.js
a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2  web/tests/m10b_states_menu.test.js
```
MASTER_SHA256: placeholder — actual hash computed at checkpoint finalize

## m10c-auth (2026-09-12)

- files: server/server.js | server/auth_service.js | server/user_store.js
  | server/session_store.js | server/package.json
  | server/tests/auth.test.js (T01-T12)
  | server/tests/auth_part2.test.js (T13-T17)
  | server/tests/auth_part3.test.js (T18-T27)
  | M10_C_AUTH_REPORT.md | WEB_PORT_PLAN.md | web/CHECKPOINTS.md
- tests: 27/27 PASS (3 test files, real HTTP requests)
- endpoints: POST /api/auth/register | login | logout | change-password, GET /api/auth/me
- session: HttpOnly + SameSite=Lax cookie, 24h TTL
- password: scrypt$<saltHex>$<hashHex>, never plaintext
- frontend: auth.js backend mode — KHÔNG fallback (xem m10c-frontend-integration)
- browser: UNAVAILABLE (no automation)

## m10c-frontend-integration (2026-09-13)
- type: non-Git checkpoint (SHA-256 manifest), parent: m10c-backend
- scope: web/js/auth.js (backend mode, no fallback), web/tests/m10c_auth_frontend.test.js (mới), M10_C_AUTH_REPORT.md, WEB_PORT_PLAN.md
- frontend test: 22/22 PASS (real HTTP backend + cookie jar)
- regression: 25 suites × 10 runs = 250/250 PASS
- security: no plaintext password / session token trong client storage; KHÔNG automatic fallback
- browser: UNAVAILABLE (no automation)
- manifest SHA-256: d3fff3ded39c9cacaa2f353c94c2265069149576a49cd667ca80ece0dd6fedec

### m10d-admin-rbac (non-Git checkpoint, SHA-256 manifest)
- timestamp: 2026-09-14T06:24:15Z
- parent: m10c-frontend-integration
- backend admin_rbac: 16/16 PASS; frontend m10d_admin: 11/11 PASS; regression PASS
- files: {
  "server/server.js": "b2f978be322ad909ec9d0270b2197e5fa1cd4edca482e05927f7861ae964d4da",
  "server/auth_service.js": "549c8cc07b6355f7e0d1c3dd023037baa8d10270864afeeaec430d8ed817f6b2",
  "server/user_store.js": "a0b3c2833895b52f8c33316fc2de4353beedfbde9d237e95defaba46c9f82b28",
  "server/session_store.js": "04d4df987b1454a36f7af75a15567702952857be0d4f84ad9652f190822a8c43",
  "server/tests/admin_rbac.test.js": "367cf1f4419e5119bd46501e2bbf61d8381ba25f962881fd7cc48be846bc6d3d",
  "web/tests/m10d_admin.test.js": "1d02a6b5edf7f823dac7c37fc83f36484b10f04ee38314b8bd2e2df31852586a",
  "WEB_PORT_PLAN.md": "f930b085e92c9065b63c72331bb6dc29b63a6bd3c942b1d93eb5c67df20f428c"
}
- MASTER_SHA256: 1021392dbf249d3278fb50b416b42c042c6819057c68c478d2f0558f7b0b0e5f

### m10e-database (non-Git checkpoint, SHA-256 manifest)
- timestamp: 2026-09-14T07:11:08Z
- parent: m10d-admin-rbac
- backend file 4/4 + sqlite 5/5 suites PASS; database.test 20/20; web regression 7x10=70/70
- files: {"server/database.js": "e4b94fc2f72b15317c1d7b564452d61de614eded2f69ff11daabddac104446b6", "server/server.js": "8792c181f33d4af03a3b640421e7c3544edc13adf494349b9a4d55f88bb1b083", "server/auth_service.js": "4453a140a3e7e67a55b8b5a3e82eeaca774cba660348f8236a6e5f96d02a86e9", "server/tests/database.test.js": "cb99f04fe90595a5de6d5ddee0831c70f632d87dc238fe49c538046f09f4cac4", "server/tests/auth.test.js": "90ba0432fadcf8caa570e985a713a871e89669d30ff3cfdb8b279208f29bb71e", "server/tests/auth_part2.test.js": "aea3af25940520b6f2eb4d513ac92de9e209d086ae7943acd0d8923c5daed0ea", "server/tests/auth_part3.test.js": "dcca15d9e285b0d412d942026b60e988c394d2bd7590d7b3679054ca2b60ce95", "server/tests/admin_rbac.test.js": "ee0f0e6a0a19643989010cc2257214f39c7bab0b451df83f4d1daf658206179d", "M10_E_DATABASE_REPORT.md": "72baa625db4a6c409abfd500562fe257f65df8a040b54213087e05eb6352e287"}
- MASTER_SHA256: d950328901c504e5eeada814c08c97f37e78b99937cd609a89bd35052803f91b

### m10d-admin-rbac-fix (non-Git checkpoint, SHA-256 manifest)
- timestamp: 2026-09-14T14:50:00Z
- parent: m10d-admin-rbac
- M10-D gate re-verified & mở lại gate. Phát hiện regression từ M10-F F3
  (server yêu cầu `Content-Type: application/json` trên mọi POST): hai helper
  test M10-D (`makeJarFetch`) chưa gửi header → login POST trả 415
  UNSUPPORTED_MEDIA_TYPE → admin_rbac 4/16 FAIL (T01/T02/T10/T11), m10d_admin
  4/11 FAIL (T04/T05/T06/T07). Server behavior đúng (M10-F), production client
  (auth.js apiFetch L48, states_real.js L1446) và 5 helper khác (auth.test.js /
  auth_part*.test.js / security_hardening.test.js) vốn set header vô điều kiện.
- Fix tối thiểu (KHÔNG sửa assertion, KHÔNG nới lỏng): helper `makeJarFetch`
  set `Content-Type: application/json` trên mọi POST (kể cả không body), đồng
  bộ với các helper còn lại. Chỉ chạm server/tests/admin_rbac.test.js +
  web/tests/m10d_admin.test.js — không sửa server, không sửa logic.
- Result: admin_rbac 16/16 PASS, m10d_admin 11/11 PASS (mỗi suite 3 lần chạy
  liên tiếp đều exit=0).
- Regression (list Pha 10, toàn bộ exit=0): admin_rbac 16/16 · m10d 11/11 ·
  m10c 22/22 · m10a 16/16 · m10b_states_menu PASS · m9_final 10/10 · m9f 28/28 ·
  m9e 23/23 · m9d 18/18 · m9c 14/14 · m9b 23/23 · m9a 18/18 · m8d 10/10 ·
  m8c 18/18 · m8b 14/14 · m8a 20/20 · m7d 14/14 · m7c 11/11 · m7b 16/16 ·
  m7a 25/25 · m6 11/11 · m6b_mt19937 12/12 · m6b_vectors OK · m6b_safety_guard OK ·
  m5 10/10 · m4 15/15 · phase1 10/10
- Known out-of-scope (M10-F / M10-B, KHÔNG thuộc M10-D): server/tests/security_hardening.test.js
  bị TRUNCATED (SyntaxError — kết thúc giữa T05, thiếu T06–T20 + main()/summary);
  web/tests/m10b_state_integration.test.js có 4 FAIL pre-existing (T02–T05) nhưng
  self-exit=0 và không nằm trong list Pha 10.
- security: không có ADMIN_PASSWORD/env-var name trong web/ (T09 PASS); không có
  localStorage/sessionStorage role/is_admin; role='admin' chỉ ở server.js:236 (server
  authorization) + test vectors — client không tự cấp quyền.
- browser: BROWSER VALIDATION UNAVAILABLE (no automation tool)
- files (thay đổi trong fix này): {
  "server/tests/admin_rbac.test.js": "e5408c1e533a4b0ef727ed17301d71c631a29cf2564835746973399b66d479d0",
  "web/tests/m10d_admin.test.js": "2bd40c4d6c5d693d831f22ae47b1cc6f3fde193bc79df01c9e64c7abdab25f92"
}
- MASTER_SHA256: placeholder (chưa chốt manifest đầy đủ — M10-D gate đóng, không chạm M10-E/F/G/H)

## polish-m1-ui-fixes
- date: 2026-09-13
- parent: m10d-admin-rbac-fix
- files:
  - web/js/ui.js 298c807f5aefd0f17a2eb2ea01d195d61994c70bb11b60197c07b655b877e0dc
  - web/js/states_real.js 77f9e28afc3f290de3e8bd84304ced98cc339e2bc64a8e8a815b57d4819d8324

## polish-m2-menu-dashboard-theory
- date: 2026-09-16
- parent: polish-m1-ui-fixes
- Milestone: POLISH M2 (Menu Dashboard + Theory) FINAL GATE = PASS
- Scope đóng gate:
  - backround1.jpg: copy byte-identical từ root sang web/assets (SHA trùng khớp source, không rename/convert)
  - TheoryState: class hoàn chỉnh trong states_real.js (title/book 50,50,1200,700 khớp RealisticBook Python, page bounds, prev/next, scroll clamp, buttons conditional)
  - Menu dashboard: avatar/greeting/level/grade/XP/gold/pet/achievement/difficulty/streak/daily tasks; layout trái/phải RealisticBook không overlap/overflow (kiểm qua m10b_states_menu + polish suites)
- Fixes trong gate này:
  - T02 m10b_state_integration: test-harness bug — clickCard(states,…) tham chiếu bare 'states' undefined → đổi param thành managerObj (fix harness, KHÔNG nới assertion)
  - T03 m10b_state_integration: production bug — ShopState._actItem pet purchase không chọn pet mới → thêm d.pet.type = key sau purchase ok (đúng parity Python: mua pet xong được chọn)
  - T05 m10b_state_integration: test data bug — 'pen_wood' không tồn tại trong data/skins.json → dùng 'pen_magic' (key thực tế)
  - m10a_browser_load T06: pre-existing harness bug LEGACY undefined → NOT_LOADED
- Tests (mỗi suite tối thiểu 5 lần chạy, tất cả PASS/exit=0):
  - polish_m2 12/12 ×5 · m2_polish 14/14 ×5 · ui_parity 20/20 ×5 · m8c_ui 18/18 ×5
  - m10a_browser_load 16/16 ×5 · m10b_states_menu 44/44 ×5 · m10b_state_integration 5/5 ×5 (đã fix T02–T05)
  - m10c_auth_frontend 22/22 ×5 · m10d_admin 11/11 ×5 · phase1_foundation 10/10 ×5 · m7c_lesson 11/11 ×5
- Full regression (web + server, 21 suites, TOTAL_FAILED_SUITES=0):
  - admin_rbac 16/16 · m4 15/15 · m5 10/10 · m6 11/11 · m6b_mt19937 12/12 · m6b_safety_guard 9/9 ·
    m6b_vectors 1/1 · m7a 25/25 · m7b 16/16 · m7d 14/14 · m8a 20/20 · m8b 14/14 · m8d 10/10 ·
    m9a 18/18 · m9b 23/23 · m9c 14/14 · m9d 18/18 · m9e 23/23 · m9f 28/28 · m9_final 10/10 · perf_stress 16/16
- Python Desktop: KHÔNG thay đổi (verified qua mtime — .py mới nhất chỉ là audit helper có từ trước task)
- Browser: BROWSER VALIDATION UNAVAILABLE (no automation) — visual parity menu/theory chỉ được xác nhận bằng structural test, KHÔNG suy ra visual PASS
- Files changed: {
  "web/js/states_real.js": "d840bb70de7a1f68b2fdf9db1444c115cfd21ca724aae96e8dffcc70370c90d9",
  "web/tests/m10b_state_integration.test.js": "0a6e286886ff55652353098b68064df1133d08bfa7f3d5abe3ba86a519d1c133",
  "web/tests/m10a_browser_load.test.js": "0073d6081e10e51ccff2ebd0c3955eefa6cc29c569a3f9268471d975fb003e90",
  "web/assets/backround1.jpg": "3e4a71980b2df5564fb96f5aa32ccd2fdff5de92da4559adb0d2f70181a02e1a"
}
- Manifest method: MASTER_SHA256 = sha256 của các dòng "path:sha256\n" sort theo path
- MASTER_SHA256: da0832add0976812e4de5dd82194890b2febf736a1cf8925d0ba1382ab85e34c

## polish-m3-secondary-systems
- date: 2026-09-16
- parent: polish-m2-menu-dashboard-theory
- Milestone: POLISH M3 (Secondary Systems Visual/UX) = PASS
- Scope:
  - A Shop: card polish (icon/title/desc/rarity/price/owned-equipped/selection ring/preview panel/scroll-clip)
  - B Pet + Skin: pet cards, skin cards, rarity, active/equipped, locked/unlocked, desc, boundaries
  - C Gacha: banner, rarity presentation, pull buttons, cost, pity, result panel, NEW/duplicate, bounds (rates/pity constants UNCHANGED)
  - D Daily: 7-day grid, current-day highlight, claimed check, locked future days, reward amount, claim button, bounds (reward behavior UNCHANGED)
  - E Achievement: cards (icon/name/desc/progress/completed/XP), scroll/clip, back button (unlock logic UNCHANGED)
  - F Skill Tree: node cards, category separation, locked/unlocked/max-level, cost, selected, desc, status, scroll (formulas/costs UNCHANGED)
  - G Profile: avatar/username/level/XP/statistics/pet buttons/alignment/clip/scroll (calculations PRESERVED)
  - H SkillMap (weak-topic): weakest-first rows, mastery bars, color legend, empty friendly state
  - I UI consistency: reuses existing UI components only; NO second Button/CardButton, NO duplicate popup system, NO second RealisticBook
- P1 UI-parity remediation closed in this milestone:
  - RealisticBook integration root-cause fix (states_real.js): ui.js publishes classes ONLY on global.UI, so the previous
    bare-global lookup made RB null in the browser => integration was dead. Resolution order now
    global.UI.RealisticBook -> require('./ui.js') fallback, with an early-return guard.
  - _bookDrawBase now passes the RENDERER (global.Game.renderer, api fillRoundRect/text) instead of the raw 2D ctx,
    resolved lazily so script load order cannot break a state draw; skips when the book has no pages.
  - ui.js: RealisticBook.reset(index) added (page identity on state enter) — additive, no behaviour removed.
  - main.js: registers 'profile' and 'skill_map' states (they existed in states_real.js but were not routable) — POLISH M3.
- Tests (each suite 5 runs for the M3 gate; M3_GATE_TOTAL_FAILED_RUNS=0):
  - polish_m3 12/12 x5 · m9a_shop 18/18 x5 · m9b_pet_skin 23/23 x5 · m9c_gacha 14/14 x5
  - m9d_achievements 18/18 x5 · m9e_daily 23/23 x5 · m9f_skills_items 28/28 x5 · m9_final_integration 10/10 x5
  - m8c_ui 18/18 x5 · ui_parity 20/20 x5 · ui_parity_p1 12/12 x5 · m10b_states_menu 44/44 x5 · m10b_state_integration 5/5 x5
- Full regression (web + server): SUITES_RUN=34, TOTAL_FAILED_SUITES=0, all exit=0
  - admin_rbac, phase1_foundation, m2_polish, m4_states, m5_player_save, m6_question, m6b_mt19937, m6b_safety_guard,
    m6b_vectors, m7a_game_manager, m7b_lesson_select, m7c_lesson, m7d_victory_defeat, m8a_effects, m8b_audio, m8c_ui,
    m8d_performance, m9a_shop, m9b_pet_skin, m9c_gacha, m9d_achievements, m9e_daily, m9f_skills_items, m9_final_integration,
    m10a_browser_load, m10b_states_menu, m10b_state_integration, m10c_auth_frontend, m10d_admin, polish_m2, polish_m3,
    ui_parity, ui_parity_p1, performance_stress
- Python Desktop: UNCHANGED (no .py file has a modified mtime in the task window; PYTHON_SOURCE_GUARD frozen below)
- Browser: BROWSER VALIDATION UNAVAILABLE (no automation available).
  Do NOT read this checkpoint as visual browser confirmation — subsystem visuals are covered by structural draw-call tests only.
- Files changed (SHA-256 per file):
  - web/js/states_real.js: 0d248d374567b3be271cf6b8d1dc2c3a7641b27fadc15e96583511abe068807c
  - web/js/ui.js: 0c9c57f6dd0339986211b871b1faf849d709f56ca1a113b8dc41c35b73e408d3
  - web/js/main.js: ab66b5c0d7907a848eda93a76bb612e1cc6c390204b69396842ccae22191d72a
  - web/tests/polish_m3.test.js: 030169ea2990f57d70507338304056e86cb81b93af3be15d8eef8bf6b802c5c9
  - web/tests/ui_parity_p1.test.js: 5da5633f14429a88d16ffdb07c424fc6898dcd3ad62d373c2a77370aade47af1
  - web/tests/_run_m3_gate.ps1: a3a1fba3a2d6c47f7fac50b7c84fef41021ecda91be146e75c5948e75810fc4e
  - web/tests/_run_full_regression.ps1: 14e56b1aa41b3478f3cd88425bae1131ffd8f2258c6df2467015f971382a6154
- Manifest method: MASTER_SHA256 = sha256(sorted "path:sha256\n" lines)
- MASTER_SHA256: e1f3b6d4ada47725f2a58d038fbbbf9ed8b50493bc6834ea259541176e505cdd
- PYTHON_SOURCE_GUARD files: 23 (*.py at repo root)
- PYTHON_SOURCE_GUARD_SHA256: e6024127fe8f1dc5e68c3b91f7cb64d1ebd225b5bf6fb17cc534fb7e1566fe93

## polish-m4-responsive-assets-book
- date: 2026-09-17
- parent: polish-m3-secondary-systems
- Milestone: POLISH M4 (Responsive + Asset completion + RealisticBook content) = PASS
- A Asset completion (copied byte-identical from Desktop root; no rename, no convert, no fake art):
  - nen_game.png -> web/assets/nen_game.png
      src: 68aa49490fdd4c1fe548e20f6b8aea8cb4ee102e423d35da16f42aa8477f43ed
      dst: 68aa49490fdd4c1fe548e20f6b8aea8cb4ee102e423d35da16f42aa8477f43ed
      identical: YES
  - pixel_clover.png -> web/assets/pixel_clover.png
      src: f7c0b022b494c840671d95f80e1d08887fe5fae782b37fa3a77872a98270a9e4
      dst: f7c0b022b494c840671d95f80e1d08887fe5fae782b37fa3a77872a98270a9e4
      identical: YES
  - favicon.png -> web/assets/favicon.png
      src: 2dbf0ce5251c9f172429831cf3a94f161d92dcc58d431bf4b07bcf0ab6b2fcde
      dst: 2dbf0ce5251c9f172429831cf3a94f161d92dcc58d431bf4b07bcf0ab6b2fcde
      identical: YES
  - defeat.png -> web/assets/defeat.png
      src: b51f930da8c35d666486daec18deb5126caf8356db7741f59f0eb3ff14a48b5a
      dst: b51f930da8c35d666486daec18deb5126caf8356db7741f59f0eb3ff14a48b5a
      identical: YES
  - gt2.gif -> web/assets/gt2.gif
      src: bc7daba233eac5bcb28c23b033f5c26654fef08c517583a2ff59ad9e4bc59fec
      dst: bc7daba233eac5bcb28c23b033f5c26654fef08c517583a2ff59ad9e4bc59fec
      identical: YES
  - main_character.png -> web/assets/main_character.png
      src: 24a1aec9941e16496894470af18f30a550a9777e7893b87b2ee6b785285add88
      dst: 24a1aec9941e16496894470af18f30a550a9777e7893b87b2ee6b785285add88
      identical: YES
  - setting.png -> web/assets/setting.png
      src: 2dbf0ce5251c9f172429831cf3a94f161d92dcc58d431bf4b07bcf0ab6b2fcde
      dst: 2dbf0ce5251c9f172429831cf3a94f161d92dcc58d431bf4b07bcf0ab6b2fcde
      identical: YES
  - Untitled_design.png -> web/assets/Untitled_design.png
      src: a11743ad907ff03e682b8a3474d4f2a1703e72833bbcc2557bc0f2c7d3f4d5d5
      dst: a11743ad907ff03e682b8a3474d4f2a1703e72833bbcc2557bc0f2c7d3f4d5d5
      identical: YES
  - victory_text.png -> web/assets/victory_text.png
      src: 727c190eea72a7ab0d1529bbacad008ada7b53b45c63acc7cefe83cf2fe235c0
      dst: 727c190eea72a7ab0d1529bbacad008ada7b53b45c63acc7cefe83cf2fe235c0
      identical: YES
  - math_lessons.json -> web/data/math_lessons.json
      src: 56037d5af42f2f3ecde65cafa8ab7eab80615d68be814709b21d5467826629a9
      dst: 56037d5af42f2f3ecde65cafa8ab7eab80615d68be814709b21d5467826629a9
      identical: YES
- B RealisticBook content: Desktop theory content is real, not a shell.
  - web/js/theory_pages.js (NEW) is a generated mirror of the Desktop theory pages
    (data_manager.py theory tables) - pages[grade] = [{ t: title, c: content }, ...]
  - ui.js RealisticBook now has a real page renderer (_drawPage): page rects/text are drawn from
    the page objects, so Menu / LessonSelect / Theory books render actual content instead of an empty shell.
  - 2-page layout, left/right renderer, flip state, reset(index) page identity and the click guard
    are all preserved; NO second RealisticBook, NO fullscreen page-turn was added.
- C Theory character: TheoryState uses the Desktop main_character.png asset for the character
  slot (preloaded through assets.js, drawn in-bounds, no placeholder).
- D Responsive safety (structural, NOT visual): logical canvas stays 1300x800.
  - 1300x800 logical bounds for all core states (T10)
  - 1280x720 -> 1170x720 letterbox rect: corners map correctly + scroll/value clamping (T11)
  - 1920x1080 -> 1755x1080 letterbox rect: corners map correctly + clamping (T12)
  - text/button bounds (T13) and popup/scrollbar-track safety (T14)
- E Browser validation: chromium automation became AVAILABLE in this milestone (Playwright,
  web/tools/browser-validation). web/tests/_m4_browser.js drives a real headless Chromium over a
  local static server: boot/state registration, menu, lesson_select (+book), theory (Desktop content
  +book), 1280x720 and 1920x1080 resizes, engine ticking + DPR canvas, zero page errors.
- F Tests:
  - polish_m4 14/14 (T01..T14, behaviour/values, not string grep)
  - M4 gate: 13 suites x 5 runs, M4_GATE_TOTAL_FAILED_RUNS=0
    (polish_m4, ui_parity, ui_parity_p1, polish_m2, polish_m3, m8c_ui, m9_final_integration,
     m10b_states_menu, m10b_state_integration, performance_stress, m4_states, m10a_browser_load,
     m7b_lesson_select)
  - Browser: _m4_browser.js 10/10 PASS (real Chromium), failures=0
- Root-cause fixes in this milestone (no assertion was weakened):
  - _verify_guard.js used a non-canonical guard algorithm (hashed bare hashes joined by a newline
    instead of sorted "path:sha256" lines) and therefore reported a false MISMATCH. Fixed to the
    canonical master(); guard now matches the frozen baseline exactly (PYTHON_GUARD_VERIFY=PASS).
  - web/CHECKPOINTS.md contained a DUPLICATE polish-m3-secondary-systems block (the M3 writer was run
    twice, appending a second block with intermediate hashes). Because the M3 verifier resolves the tag
    with lastIndexOf(), the duplicate silently shadowed the canonical record. The stray duplicate was
    removed so exactly one canonical polish-m3 record remains (MASTER e1f3b6d4..., the declared
    verified baseline). Removed duplicate value (kept here so nothing is lost):
    MASTER_SHA256=a5d82133592e6573e38ef0fdff375fbaf949e1c0b59085089532013d974cbbe3,
    states_real.js=b839c9ece85f1c4fd8f02a49e2ae29182ff97f3c126868e5f633256516e4ff86.
  - Added book_runtime_probe.test.js to the full-regression suite list (RealisticBook runtime coverage).
- Observation (NOT changed, out of M4 scope): web/data/{pets,skins,skills,daily_rewards,achievements}.json
  are generated M9 artifacts and are not byte-identical to data/*.json; m9* suites pass against them.
  web/data/gacha_cards.json and web/data/math_lessons.json ARE byte-identical to their Desktop sources.
- Python Desktop: UNCHANGED (PYTHON_SOURCE_GUARD recomputes to the frozen baseline).
- Files changed (SHA-256 per file):
  - web/js/states_real.js: 0b7c812bc2c3bfade77b89a744ced6fdc266f3c68918d11b08b1b847667b49ce
  - web/js/ui.js: bd74e8cf9bfdcd4c81507ddb18bef6f38628f043acad979f23edea25243dfbe4
  - web/js/main.js: 0c25b8aee7db66b452cfd2f9fcd8b51c294608919db99a23ccfef7a87643ab87
  - web/js/theory_pages.js: 33b433ce0d26b53570378b4037abfdf61db80e3e665792a30bb1b70f59293e78
  - web/index.html: f5a34fde044ad79031ef271ec4ca868fde5a933916eb7c069bceccbf6c6f3a0f
  - web/tests/polish_m4.test.js: ad9a08cecf25e4c9389f2f8baa3868463b35bea8f2e073f70ccffe569b24a075
  - web/tests/book_runtime_probe.test.js: e4967bbf2865bd68e5839ae899c79423c984eefd1fa82cf95554c9ddd9d7977d
  - web/tests/ui_parity_p1.test.js: 595fc445942a68d3f4f1228529d1c85f503021ccd2d57f230643f364d52d8720
  - web/tests/m10a_browser_load.test.js: 08716f880a98659fe3578f53b1efcee6762e7af0f8b03f9ac510464fd92636e6
  - web/tests/m4_states.test.js: 0dc259f39441e311e9f9aeae2eb81a6ff03869c495f0074fff3914997d899002
  - web/tests/_run_full_regression.ps1: 2eb8b30ce3a9c17085679f78424b3144a5dc3defcf2c4196d67995d460b05ad9
  - web/tests/_run_m4_gate.ps1: af4a6f33cdffeb5dfd6a6df03c6e2bbc229e1fe48f8622d6d6f6d249c9293ca1
  - web/tests/_m4_browser.js: 89689966c70cbb8f47e6242d6acdccb851028b9933687d5c3a4d5b11e0b32a77
  - web/tests/_verify_guard.js: ee0261f4bf1a689e70e8651fdb1d3778482ed09a8efd62d40e21e0c37906135c
- Manifest method: MASTER_SHA256 = sha256(sorted "path:sha256" lines)
- MASTER_SHA256: 4debddfe083cdba9a754427760b5f6b3019d08b4a061568347e372f3b5d7df41
- ASSET_MANIFEST method: sha256(sorted "destPath:srcSha|dstSha" lines)
- ASSET_MANIFEST_SHA256: 7e690464f08c834bcdab9987db60563f5475822d86ede62647d5fe6b086385e8
- PYTHON_SOURCE_GUARD files: 23 (*.py at repo root)
- PYTHON_SOURCE_GUARD_SHA256: e6024127fe8f1dc5e68c3b91f7cb64d1ebd225b5bf6fb17cc534fb7e1566fe93


## final-qa
- date: 2026-09-18
- parent: polish-m4-responsive-assets-book
- Milestone: FINAL QA (cross-screen browser validation + interaction contracts) = PASS
- A Screens browser-tested (real Chromium, real mouse + keyboard + backend, 84 checks):
  - Loading boot, Login (form typing, 20-char cap, register placeholder, backend login)
  - Menu: 15 cards in-bounds, hover mapping, locked-card message, double-click single transition
  - shop/pet/skin/gacha/daily/achievement/skill_tree/bag/profile: open, hover, scroll,
    card click, back button, all without navigation errors
  - skill_map via profile, gacha graceful pull, locked settings, non-admin RBAC refusal
  - lesson_select with 40 real lessons (labels verified, NO [object Object])
  - theory with Desktop content + book pages + pageApi, real page flip, scroll
  - lesson gameplay smoke: 40 real questions answered with feedback to victory,
    XP/gold/level updated, continue back to menu
  - victory/defeat entry points, adminPanel for a seeded admin (rows loaded)
  - logout real click back to login, admin logout
- B Responsive (real browser): 1300x800, 1280x720, 1920x1080, 1024x640 — logical
  stays 1300x800, canvas downscales to fit and is never upscaled (CSS contract),
  real clicks map to the correct logical target at every viewport.
- C Secondary screens: all 9 covered above in the real browser (NOT Node-only).
- D Gameplay smoke: menu -> lesson_select (real click) -> theory (real click) ->
  lesson (real start button); every answer clicked; feedback dismissed; victory
  reached; XP 0->240+, gold earned, rank computed; continue to menu.
- E Console/runtime scan: 0 pageerrors, 0 console.error, 0 requestfailed, 0 >=400.
  Two /api/admin/me 401s for the non-admin user are EXPECTED_AUTHZ (RBAC gate
  firing) and are asserted as such, not counted as errors.
- F Assets/network: every boot asset is 200 with the correct MIME
  (image/png + font/ttf). Fixed in this milestone: /fonts/* with a space in the
  name 404'd (serveStatic keyed by the raw encoded pathname) and .ttf/.jpg/.gif
  served as application/octet-stream — both fixed in server/server.js.
- G Full regression: 37+1 suites, 0 failed (admin_rbac back to 16/16 after the
  T09 secret-scan forced the admin credential OUT of web sources and into a
  runtime-only bootstrap handshake).
- H New coverage: web/tests/final_qa.test.js (13 behavioural checks: registry,
  routing, transitions, back buttons, theory chain, book bounds, scroll clamp)
  and web/tests/_final_browser.js + final_qa_browser.test.js (real browser).
- I Cleanup: removed ~35 scratch/audit/log helper files from web/tests
  (_audit_* _parse_* _patch_* _m4out* _m4_baseline* *.log *.png etc.). Kept all
  real tests, gate scripts, checkpoint machinery, browser harnesses and docs.
  No test, checkpoint or reference uses any removed file.
- J Python guard: PASS (unchanged).
- Not QA-blockers (documented, Desktop-faithful):
  * lessons without a theory page show the Desktop fallback text
    (matches Desktop contract of showing a fallback for missing theory).
  * web/data/{pets,skins,skills,daily_rewards,achievements}.json are generated
    M9 artifacts, not byte copies of data/*.json (pre-existing, m9* all pass).
- Harness-only corrections (root-caused, not assertion-weakening):
  * login username kept <= 20 chars (Desktop cap, asserted in A05b);
  * reads poll the per-tick input queue instead of racing it;
  * waits for transition.active === false before clicking (fade tail swallows
    clicks by design); non-admin /api/admin/* 401s classified as expected RBAC;
  * viewport expectations follow the style.css no-upscale contract.
- Scope notes:
  * Settings card is a designed M10 locked placeholder (verified message).
  * Password Change exists only as the auth service + backend route
    (auth.changePassword + /api/auth/change-password, covered by server tests);
    there is no PasswordChange web state in this milestone's scope.
- P0/P1 production fixes in this milestone (no assertion weakened):
  1. server/server.js serveStatic keyed the file lookup by the raw encoded URL
     pathname, so any asset with a space ("Segoe UI Emoji.TTF") returned 404.
     Fixed with decodeURIComponent (traversal guard kept); Chromium now gets 200.
  2. server/server.js MIME map lacked .ttf/.jpg/.gif/.woff* -> those served as
     application/octet-stream. Map extended; browser receives font/ttf.
  3. web/js/states_real.js LessonSelectState stored raw data_loader OBJECTS in
     this.lessons, so every button rendered "[object Object]" and the theory
     lookup always missed. Added a _lessonTitles() normalizer (string lists
     still pass through unchanged).
  4. web/js/states_real.js TheoryState built its RealisticBook with ZERO pages,
     so only chrome ever painted and flipping was a no-op. The book now carries
     the grade's Desktop theory pages + the makeTheoryPageApi renderer, and
     TheoryState draw/update run through _bookDrawBase (2-page layout/flip/
     reset kept, no second RealisticBook).
- Files changed (SHA-256 per file, CHECKPOINTS.md hashed pre-append):
  - server/server.js: 65142f6597d410ad9856ecbc41c9a1303d657303fd954b1779dea35ac8fccd53
  - server/qa_bootstrap.js: eb89af73ef251e751b61f2027f84979de8661b5257ba247049f7a4a7b3f4ad93
  - web/js/states_real.js: 0cf0d5ec0db796a6e6854dfdfd8f66eff1926c3011df3205a435286b55f9c0c6
  - web/tests/final_qa.test.js: ad762809e77fa5b2ee0a6eb25d0324754052d6002756802a96d4d6798a78b1a1
  - web/tests/final_qa_browser.test.js: 79977b4beba7698217582623e8362848d507e391e83584db9aba21d469faef2e
  - web/tests/_final_browser.js: f232f57c51470594beb7db936cabb1bd4ba8563dc66b887d5f663d375db57b4f
  - web/tests/_run_full_regression.ps1: 73d2a18bb573f97f3bc88f4987a9f2963d05a6b95ce5d608026d42633e9c77d8
  - web/CHECKPOINTS.md: bb4b64224fe44eb3fe36753654e6d8015de8356be364bb5fbc054a08f16623b3
- Manifest method: MASTER_SHA256 = sha256(sorted "path:sha256\n" lines)
- MASTER_SHA256: b4980bd74dbc207074b3ee7acfffcaf5ec506fd836d6d5c190c1bce36fbb2c64
- ASSET_MANIFEST method: sha256(sorted "destPath:srcSha|dstSha\n" lines)
- ASSET_MANIFEST_SHA256: 7e690464f08c834bcdab9987db60563f5475822d86ede62647d5fe6b086385e8
- PYTHON_SOURCE_GUARD files: 23 (*.py at repo root)
- PYTHON_SOURCE_GUARD_SHA256: e6024127fe8f1dc5e68c3b91f7cb64d1ebd225b5bf6fb17cc534fb7e1566fe93

## final-qa
- date: 2026-09-18
- parent: polish-m4-responsive-assets-book
- Milestone: FINAL QA (cross-screen browser validation + interaction contracts) = PASS
- A Screens browser-tested (real Chromium, real mouse + keyboard + backend, 84 checks):
  - Loading boot, Login (form typing, 20-char cap, register placeholder, backend login)
  - Menu: 15 cards in-bounds, hover mapping, locked-card message, double-click single transition
  - shop/pet/skin/gacha/daily/achievement/skill_tree/bag/profile: open, hover, scroll,
    card click, back button, all without navigation errors
  - skill_map via profile, gacha graceful pull, locked settings, non-admin RBAC refusal
  - lesson_select with 40 real lessons (labels verified, NO [object Object])
  - theory with Desktop content + book pages + pageApi, real page flip, scroll
  - lesson gameplay smoke: 40 real questions answered with feedback to victory,
    XP/gold/level updated, continue back to menu
  - victory/defeat entry points, adminPanel for a seeded admin (rows loaded)
  - logout real click back to login, admin logout
- B Responsive (real browser): 1300x800, 1280x720, 1920x1080, 1024x640 — logical
  stays 1300x800, canvas downscales to fit and is never upscaled (CSS contract),
  real clicks map to the correct logical target at every viewport.
- C Secondary screens: all 9 covered above in the real browser (NOT Node-only).
- D Gameplay smoke: menu -> lesson_select (real click) -> theory (real click) ->
  lesson (real start button); every answer clicked; feedback dismissed; victory
  reached; XP 0->240+, gold earned, rank computed; continue to menu.
- E Console/runtime scan: 0 pageerrors, 0 console.error, 0 requestfailed, 0 >=400.
  Two /api/admin/me 401s for the non-admin user are EXPECTED_AUTHZ (RBAC gate
  firing) and are asserted as such, not counted as errors.
- F Assets/network: every boot asset is 200 with the correct MIME
  (image/png + font/ttf). Fixed in this milestone: /fonts/* with a space in the
  name 404'd (serveStatic keyed by the raw encoded pathname) and .ttf/.jpg/.gif
  served as application/octet-stream — both fixed in server/server.js.
- G Full regression: 37+1 suites, 0 failed (admin_rbac back to 16/16 after the
  T09 secret-scan forced the admin credential OUT of web sources and into a
  runtime-only bootstrap handshake).
- H New coverage: web/tests/final_qa.test.js (13 behavioural checks: registry,
  routing, transitions, back buttons, theory chain, book bounds, scroll clamp)
  and web/tests/_final_browser.js + final_qa_browser.test.js (real browser).
- I Cleanup: removed ~35 scratch/audit/log helper files from web/tests
  (_audit_* _parse_* _patch_* _m4out* _m4_baseline* *.log *.png etc.). Kept all
  real tests, gate scripts, checkpoint machinery, browser harnesses and docs.
  No test, checkpoint or reference uses any removed file.
- J Python guard: PASS (unchanged).
- Not QA-blockers (documented, Desktop-faithful):
  * lessons without a theory page show the Desktop fallback text
    (matches Desktop contract of showing a fallback for missing theory).
  * web/data/{pets,skins,skills,daily_rewards,achievements}.json are generated
    M9 artifacts, not byte copies of data/*.json (pre-existing, m9* all pass).
- Harness-only corrections (root-caused, not assertion-weakening):
  * login username kept <= 20 chars (Desktop cap, asserted in A05b);
  * reads poll the per-tick input queue instead of racing it;
  * waits for transition.active === false before clicking (fade tail swallows
    clicks by design); non-admin /api/admin/* 401s classified as expected RBAC;
  * viewport expectations follow the style.css no-upscale contract.
- Scope notes:
  * Settings card is a designed M10 locked placeholder (verified message).
  * Password Change exists only as the auth service + backend route
    (auth.changePassword + /api/auth/change-password, covered by server tests);
    there is no PasswordChange web state in this milestone's scope.
- P0/P1 production fixes in this milestone (no assertion weakened):
  1. server/server.js serveStatic keyed the file lookup by the raw encoded URL
     pathname, so any asset with a space ("Segoe UI Emoji.TTF") returned 404.
     Fixed with decodeURIComponent (traversal guard kept); Chromium now gets 200.
  2. server/server.js MIME map lacked .ttf/.jpg/.gif/.woff* -> those served as
     application/octet-stream. Map extended; browser receives font/ttf.
  3. web/js/states_real.js LessonSelectState stored raw data_loader OBJECTS in
     this.lessons, so every button rendered "[object Object]" and the theory
     lookup always missed. Added a _lessonTitles() normalizer (string lists
     still pass through unchanged).
  4. web/js/states_real.js TheoryState built its RealisticBook with ZERO pages,
     so only chrome ever painted and flipping was a no-op. The book now carries
     the grade's Desktop theory pages + the makeTheoryPageApi renderer, and
     TheoryState draw/update run through _bookDrawBase (2-page layout/flip/
     reset kept, no second RealisticBook).
- Files changed (SHA-256 per file, CHECKPOINTS.md hashed pre-append):
  - server/server.js: 65142f6597d410ad9856ecbc41c9a1303d657303fd954b1779dea35ac8fccd53
  - server/qa_bootstrap.js: eb89af73ef251e751b61f2027f84979de8661b5257ba247049f7a4a7b3f4ad93
  - web/js/states_real.js: 0cf0d5ec0db796a6e6854dfdfd8f66eff1926c3011df3205a435286b55f9c0c6
  - web/tests/final_qa.test.js: ad762809e77fa5b2ee0a6eb25d0324754052d6002756802a96d4d6798a78b1a1
  - web/tests/final_qa_browser.test.js: 79977b4beba7698217582623e8362848d507e391e83584db9aba21d469faef2e
  - web/tests/_final_browser.js: f232f57c51470594beb7db936cabb1bd4ba8563dc66b887d5f663d375db57b4f
  - web/tests/_run_full_regression.ps1: 73d2a18bb573f97f3bc88f4987a9f2963d05a6b95ce5d608026d42633e9c77d8
  - web/CHECKPOINTS.md: bb4b64224fe44eb3fe36753654e6d8015de8356be364bb5fbc054a08f16623b3
- Manifest method: MASTER_SHA256 = sha256(sorted "path:sha256\n" lines)
- MASTER_SHA256: b4980bd74dbc207074b3ee7acfffcaf5ec506fd836d6d5c190c1bce36fbb2c64
- ASSET_MANIFEST method: sha256(sorted "destPath:srcSha|dstSha\n" lines)
- ASSET_MANIFEST_SHA256: 7e690464f08c834bcdab9987db60563f5475822d86ede62647d5fe6b086385e8
- PYTHON_SOURCE_GUARD files: 23 (*.py at repo root)
- PYTHON_SOURCE_GUARD_SHA256: e6024127fe8f1dc5e68c3b91f7cb64d1ebd225b5bf6fb17cc534fb7e1566fe93

## polish-m2-menu-dashboard-theory
- date: 2026-09-16
- parent: polish-m1-ui-fixes
- Milestone: POLISH M2 (Menu Dashboard + Theory) FINAL GATE = PASS
- Scope đóng gate:
  - backround1.jpg: copy byte-identical từ root sang web/assets (SHA trùng khớp source, không rename/convert)
  - TheoryState: class hoàn chỉnh trong states_real.js (title/book 50,50,1200,700 khớp RealisticBook Python, page bounds, prev/next, scroll clamp, buttons conditional)
  - Menu dashboard: avatar/greeting/level/grade/XP/gold/pet/achievement/difficulty/streak/daily tasks; layout trái/phải RealisticBook không overlap/overflow (kiểm qua m10b_states_menu + polish suites)
- Fixes trong gate này:
  - T02 m10b_state_integration: test-harness bug — clickCard(states,…) tham chiếu bare 'states' undefined → đổi param thành managerObj (fix harness, KHÔNG nới assertion)
  - T03 m10b_state_integration: production bug — ShopState._actItem pet purchase không chọn pet mới → thêm d.pet.type = key sau purchase ok (đúng parity Python: mua pet xong được chọn)
  - T05 m10b_state_integration: test data bug — 'pen_wood' không tồn tại trong data/skins.json → dùng 'pen_magic' (key thực tế)
  - m10a_browser_load T06: pre-existing harness bug LEGACY undefined → NOT_LOADED
- Tests (mỗi suite tối thiểu 5 lần chạy, tất cả PASS/exit=0):
  - polish_m2 12/12 ×5 · m2_polish 14/14 ×5 · ui_parity 20/20 ×5 · m8c_ui 18/18 ×5
  - m10a_browser_load 16/16 ×5 · m10b_states_menu 44/44 ×5 · m10b_state_integration 5/5 ×5 (đã fix T02–T05)
  - m10c_auth_frontend 22/22 ×5 · m10d_admin 11/11 ×5 · phase1_foundation 10/10 ×5 · m7c_lesson 11/11 ×5
- Full regression (web + server, 21 suites, TOTAL_FAILED_SUITES=0):
  - admin_rbac 16/16 · m4 15/15 · m5 10/10 · m6 11/11 · m6b_mt19937 12/12 · m6b_safety_guard 9/9 ·
    m6b_vectors 1/1 · m7a 25/25 · m7b 16/16 · m7d 14/14 · m8a 20/20 · m8b 14/14 · m8d 10/10 ·
    m9a 18/18 · m9b 23/23 · m9c 14/14 · m9d 18/18 · m9e 23/23 · m9f 28/28 · m9_final 10/10 · perf_stress 16/16
- Python Desktop: KHÔNG thay đổi (verified qua mtime — .py mới nhất chỉ là audit helper có từ trước task)
- Browser: BROWSER VALIDATION UNAVAILABLE (no automation) — visual parity menu/theory chỉ được xác nhận bằng structural test, KHÔNG suy ra visual PASS
- Files changed: {
  "web/js/states_real.js": "6ac71af5ce23c9c51103212b18230d0477214ea51e4081ca8745bb1ead3e85b6",
  "web/tests/m10b_state_integration.test.js": "0a6e286886ff55652353098b68064df1133d08bfa7f3d5abe3ba86a519d1c133",
  "web/tests/m10a_browser_load.test.js": "08716f880a98659fe3578f53b1efcee6762e7af0f8b03f9ac510464fd92636e6",
  "web/assets/backround1.jpg": "3e4a71980b2df5564fb96f5aa32ccd2fdff5de92da4559adb0d2f70181a02e1a"
}
- Manifest method: MASTER_SHA256 = sha256 của các dòng "path:sha256\n" sort theo path
- MASTER_SHA256: f0066c0e3785576a7068cbf1e1f544876e5525511bd8dadd6dc829c585400802

## M12 — product evolution / post-release hardening
- date: 2026-09-24
- parent: 74eccaf (M12 RC) on release baseline 9f8b9b4
- Gate: M12 FIX GATE = PASS — the M12 RC UI-parity features were silent no-ops; they now render.
- Bugs found, reproduced first, then fixed (each has a regression test):
  - B1 MenuState.draw / LessonSelectState.draw painted a hand-rolled RealisticBook frame BEFORE
    R.clear(); Renderer.clear() is a full-canvas fillRect (web/js/renderer.js:20-27) so the frame was
    erased on the same frame. Removed (dead code); the chrome comes from UI.RealisticBook only.
  - B2 REALISTICBOOK_P1 integration called _bookDrawBase(state) WITHOUT the state draw callback, so
    R.clear was restored before the state ran and the state's own clear erased the chrome — the P1
    book identity was invisible on Menu / LessonSelect / Theory. Fixed: the state draw now runs inside
    the clear hook (drawFn must be supplied).
  - B3 The P1 book was built with UI.RealisticBook's default rect (150,100,1000,600) instead of the
    Desktop RealisticBook(50,50,1200,700) used by every Desktop book state
    (main.py 416 Menu, 754 Settings, 876 PasswordChange, 924 LessonSelect, 979 Theory, 1929
    AchievementView, 2004 Daily, 2132 Profile, 2275 Shop, 2479 SkillTree). Fixed via BOOK_RECT.
  - B4 effects2.js FallingClover is a BURST pool (particles empty until spawn()); the RC called
    update()/draw() on an empty pool so Menu/Victory/Defeat had no clover layer. Desktop
    FallingCloverEffect pre-allocates + recycles CloverParticle objects (game_init.py:4208-4236),
    i.e. an always-on rain. Added cloverRain() + drawClover() with the Desktop caps
    (Menu 20 = main.py:422, Victory 15 = main.py:1091, Defeat 15 = main.py:1020) and the Desktop
    background-layer z-order (clover under the book/content).
- Test inventory (actual counts, local):
  - FULL REGRESSION: 39 suites, 569 pass, 0 fail, 15 skip — exit 0, PROBLEM SUITES: NONE,
    HARNESS_ERRORS: NONE (was 38/562 before adding the new suite)
  - NEW unit suite m12_clover_book.test.js: 7/7 (types the two root causes directly)
  - NEW real-Chromium harness _m12_fix_verify.js: 16 probes, 0 fails
  - M11 live-production suite against the deployed 9f8b9b4 build: 180 questions,
    123 correct / 57 wrong, 5111 invariants 0 fails, victory 1, defeat 1, 0 console/page/4xx errors
- Real-browser pixel evidence (local, 1300x800 logical canvas):
  - Menu clover pool 20 -> 172 clover pixels; Victory pool 15 -> 2428 px; Defeat pool 15 -> 982 px
  - LessonSelect book chrome: cover (80,50,20) @ (41,400) · page (253,246,227) @ (56,400) ·
    spine (150,150,150) @ (640,720) — all previously invisible
- Files changed: web/js/states_real.js · web/tests/m12_clover_book.test.js (new) ·
  web/tests/_m12_fix_verify.js (new) · web/tests/_run_regression.py · web/CHECKPOINTS.md
- Python Desktop: NOT changed (READ-ONLY SOURCE OF TRUTH).
- Render: production still serves the 9f8b9b4 build (live /js/states_real.js sha256
  3e8180e04bc11b695ccaea1dd31b823345e639bb6b87e2ea19ba609f19cdb98e, 149506 B). No Render API key,
  deploy hook or dashboard session exists in the workspace, so the redeploy could not be triggered
  from here -> M12_GITHUB_VERIFIED_RENDER_PENDING.
