# M10-A INTEGRATION REPORT — Browser Runtime Integration

**Status: PASS (Node regression 230/230)** — Date: 2026-09-06

## 1. Real numbers (filesystem + index.html, audit cũ KHÔNG dùng)

| Metric | Trước M10-A | Sau M10-A |
|---|---|---|
| Tổng JS modules (`web/js/*.js`) | 33 | 33 |
| Legacy (KHÔNG load): `states.js`, `effects_part1.js` | 2 | 2 |
| Production modules | 31 | 31 |
| Scripts trong index.html | 14 | **31** |
| Missing (browser không có) | 17 | **0** |

## 2. Final load order (31 scripts, dependency-verified từ B1 audit)

```
logger → errors → engine → input → renderer → assets → audio
→ performance → effects → effects2        (M8: performance TRƯỚC effects
                                            để effects.js thắng global.particleBudget
                                            mà effects2.js tiêu thụ)
→ save → player → auth                    (M5)
→ data_loader → mt19937 → question_generator
→ smart_ai → adaptive_ai                  (M6 chain, đúng thứ tự require)
→ game_manager → ui                       (M7)
→ shop → pet → skin → gacha → achievements
→ daily → skill_tree → item_effects       (M9, player/save đã load trước)
→ state_manager → states_real → main
```

## 3. Global API map (scan thực tế, m10a T08)

| Module | Global | Notes |
|---|---|---|
| shop.js | `ShopSystem` (+ShopApi) | |
| pet.js / skin.js | `PetSystem, PetManager` / `SkinSystem, SkinManager` | |
| gacha.js | `GachaSystem` | |
| achievements.js | `AchievementSys` | **KHÔNG phải AchievementSystem** |
| daily.js | `Daily` (+DailyRewardSystem trong export) | |
| skill_tree.js | `SkillTreeSystem, SkillManager, SKILL_UNLOCK_COST` | |
| item_effects.js | `ItemEffectSystem, ITEM_DEFS, CARD_EFFECT_MAP` | |
| performance.js | `SurfaceCache, ParticleBudget, particleBudget, GLOBAL_MAX_PARTICLES` | singleton dup hazard → xử lý bằng load order |
| question stack | `MT19937, QuestionGenerator, SmartAI, AdaptiveAI` | |
| game_manager.js | `GameManager` | |
| data_loader.js | `DataLoader` | fetch `data/*.json` |
| effects2.js | `TransitionEffect, answerEffects, comboPopupManager` | |

## 4. Files modified (M10-A production)

1. **web/index.html** — 14 → 31 script tags theo dependency order; comment ghi lý do performance-before-effects.
2. **web/js/main.js** — wire thật thay placeholder null:
   - `game.dataLoader = DataLoader` (getLessonsForGrade → Promise, khớp LessonSelectState L566-576)
   - `game.questionGen = adapter` bọc `QuestionGenerator.generate_question()` → contract LessonState `{question, answer, options, op, hint}` (states_real.js L740-756)
3. **web/tests/m10a_browser_load.test.js** — mới, 16 checks (T01-T16): inventory, duplicate, order, global surface, fs/path safety, legacy exclusion, contract static scan.
4. **web/tests/m9_final_integration.test.js** — REBUILD sau corruption (2 file trộn lẫn, TDZ crash `failed before initialization` + `check` chạy trước khai báo). 10 checks mới dùng API thật đã verify: `equipped_pen/board` (không phải equipped_skin), `daily_streak/last_claim` (không phải streak), shield buff qua `activate('Khiên Tri Thức')` (card title, không phải effect id), SkillManager là persist path (không phải tree), player gold/xp mirror qua addGold/addXp.
5. **web/tests/helpers/_fix_t07.py** — one-shot fixer cho tail T07.

## 5. Root causes đã fix

| # | Vấn đề | Root cause | Fix |
|---|---|---|---|
| 1 | 17 module M6-M9 không vào browser | index.html chỉ có 14 script tag M4-era | Thêm 17 tags đúng order |
| 2 | `performance.js` singleton dup | định nghĩa `particleBudget` riêng | Load TRƯỚC effects.js → effects.js thắng global |
| 3 | LessonState sẽ hiện panel chờ mãi | main.js đặt `questionGen/dataLoader = null` | Wire thật + adapter contract |
| 4 | m9_final_integration crash TDZ | 2 file trộn lẫn (kernel disconnect) | Rebuild 10 checks trên API thật |
| 5 | assert helper thiếu methods | local `assert()` shadow module | dùng `require('assert')` |
| 6 | T09 gold 20≠4470 | `daily.claim` mirror `player.gold` (addGold `d.gold=this.gold`) | sync p.gold trước claim (đúng flow login thật) |
| 7 | T09 skill_levels trống | persist path là SkillManager | dùng mgr.unlockSkill/upgradeSkill |

## 6. Browser runtime validation

**UNAVAILABLE** — môi trường không có browser automation. KHÔNG tuyên bố browser PASS. Static verification: m10a T01-T16 (filesystem + source contract). Browser smoke (console clean, 22 routes) = việc của M10-B/verification kế tiếp với tool phù hợp.

## 7. Regression

23 suites × **10 runs** = **230/230 exit=0**, 0 intermittent. Suites: m10a(16) + m9_final_integration(10) + m9f(28) + m9e(23) + m9d(?) + m9c(14) + m9b(23) + m9a(18) + m8d + m8c + m8b(14) + m8a(20) + m7d(14) + m7c(11) + m7b(16) + m7a(25) + m6b_mt(12) + m6b_safety + m6b_vectors(1005) + m6(11) + m5(10) + m4(15) + phase1.

## 8. Known issues / deferred

- AchievementSystem singleton `_sys` + account-key `achievements_unlocked` KHÔNG được ghi bởi unlock (persist qua save() blob riêng) — nhất quán với m9d contract; UI wiring M10-B phải dùng save() blob.
- `states.js`, `effects_part1.js` legacy: KHÔNG load, chưa xóa (quyết định xóa thuộc M10-B+ với owner approval).
- Browser smoke + Admin/backend/CSP = M10-B+ (ngoài scope M10-A).

## 9. M10-B next task

Mở rộng states_real.js: ShopState/PetState/SkinState/GachaState/AchievementState/DailyState/SkillState + menu card wiring + browser smoke thật (HTTP server + console clean).
