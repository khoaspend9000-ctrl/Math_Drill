# M29.2 — TimeAttack Desktop→Web parity matrix

Desktop source of truth: `main.py:1745-1926` (`class TimeAttackState`), entry at
`main.py:674-676`. All values below were read from the source, not assumed.

| RULE | DESKTOP_VALUE | DESKTOP_SOURCE | WEB_CURRENT | AFTER M29.2 |
|---|---|---|---|---|
| ENTRY | Menu card index 1 | `main.py:674-676` | card `id:'time'` exists but `locked:'M7'` | unlocked, book-flip nav |
| LOCK_RULE | **NONE** — no level/flag gate | `main.py:675-676` | `locked:'M7'` (invented) | **removed** (parity defect) |
| NAV_TRANSITION | `transition_type="PAGE"` | `main.py:668-670` | none (locked) | `_rbNav.next()` book flip (M25.1) |
| TIME_LIMIT | `60.0` | `main.py:1750` | absent | 60.0 |
| TIME_CAP_ON_BONUS | `min(60, t + add)` | `main.py:1816` | absent | same |
| TIME_BONUS_PER_CORRECT | `1.0 + item_fx.get_time_bonus()` | `main.py:1815` | absent | same |
| FREEZE_PAUSE | `if not has_freeze_timer(): time_left -= dt` | `main.py:1848-1849` | absent | same |
| TIMER_STOPS_DURING_FEEDBACK | `not (feedback and feedback.active)` | `main.py:1846` | absent | same |
| QUESTION_RANGE | `randint(1,40)` grade 1 else `randint(1,60)` | `main.py:1765` | absent | same |
| QUESTION_GEN | `safe_generate_question(grade, rid, adaptive_ai.difficulty, user_id)` | `main.py:1767-1768` | absent | same via questionGen |
| COMBO_RESET_ON_ENTER | `update_combo(False)` | `main.py:1759` | absent | `resetCombo()` |
| ADAPTIVE_RESET_ON_ENTER | `adaptive_ai.reset()` | `main.py:1758` | absent | same |
| SCORE_PER_CORRECT | `int(20 * combo_multiplier)` | `main.py:1809` | absent | same |
| SCORE_ITEM_MULT | `int(points * get_score_multiplier())` | `main.py:1811` | absent | same |
| ITEM_CONSUME | `consume_question_count("score_x3_10q")` | `main.py:1812` | absent | same |
| WRONG_SCORING | no points, no time bonus | `main.py:1807-1816` | absent | same |
| BTN_COLOUR | `(220,150,50)` if combo_mult > 1.5 else `PURPLE_BTN` | `main.py:1770` | absent | same |
| BTN_WIDTH | `max(240, max_tw + 80)` | `main.py:1779` | absent | same |
| BTN_SPACING | x=40, y=110 | `main.py:1780-1781` | absent | same |
| BTN_START_X | `WIDTH//2 - (btn_w*2 + 40)//2` | `main.py:1782` | absent | same |
| BTN_ROWS | `y = 420 + (i//2)*110`, h=90 | `main.py:1787-1788` | absent | same |
| TIMER_TEXT | `f"⏱ {int(time_left)}s"`, centre x, y=80 | `main.py:1873-1874` | absent | same |
| TIMER_COLOUR | `(200,80,80)` if <10s else WHITE | `main.py:1872` | absent | same |
| CARD | 800x200, y=`220 + (200-h)//2` | `main.py:1876-1879` | absent | same |
| CARD_SHADOW | `(0,0,0,60)` at `(+5,+8)`, radius 30 | `main.py:1881` | absent | same |
| CARD_BODY | WHITE, radius 30 | `main.py:1883` | absent | same |
| CARD_BORDER | `(255,150,50)`, width 5, radius 30 | `main.py:1884` | absent | same |
| CARD_ANIM | `card_scale += dt*6`, text only when `sc > 0.5` | `main.py:1860-1861, 1885` | absent | same |
| SCORE_TEXT | `f"ĐIỂM HIỆN TẠI: {score}"`, `(255,225,100)`, centred y=390 | `main.py:1912-1913` | absent | same |
| BACKGROUND | `background_img` else `(30,40,60)` | `main.py:1869` | absent | same (incl. top bar) |
| CLOVER | `FallingCloverEffect(15)` | `main.py:1757` | absent | same |
| BACK_BTN | `(20, HEIGHT-75, 200, 60)` "THOÁT" RED_BTN | `main.py:1762` | absent | same |
| BACK_ACTION | `set_bgm("menu")` then `MenuState()` | `main.py:1835-1842` | absent | same |
| DISMISS | MOUSEDOWN or SPACE → dismiss + `next_q()` | `main.py:1797-1800` | absent | same |
| END_CONDITION | `time_left <= 0` → clamp 0, `game_over=True` | `main.py:1850-1852` | absent | same |
| RESULT | `VictoryState("HẾT GIỜ!", score, "Time Attack", stats)` | `main.py:1859` | absent | same |
| STATS | correct/total/accuracy/avg_time | `main.py:1853-1858` | absent | same |
| SAVE_POINT | none in TimeAttack; VictoryState owns rewards | `main.py:1843-1923` | n/a | none added (parity) |

## Notes on faithful-but-bounded adaptations

- **Browser audio:** `set_bgm("menu")` maps to the existing Web `AudioManager` menu track
  if one is registered; otherwise it is a silent no-op, exactly as in the existing
  back-navigation paths. No new sound is invented.
- **`item_fx` naming:** Web exposes the same object as `ItemEffects`
  (`web/js/item_effects.js`) with `getScoreMultiplier` / `getTimeBonus` /
  `consumeQuestionCount` / `hasFreezeTimer` / `tickTimers` — identical semantics.
- **Timer decrement:** Desktop subtracts `dt` only when the freeze buff is absent.
  Web uses the same guard, so gameplay is unaffected by browser timing.

**P0/P1 severity:** the invented `locked:'M7'` gate is a **source-proven deviation**
— Desktop has no lock at all — so removing it is required for strict parity.
