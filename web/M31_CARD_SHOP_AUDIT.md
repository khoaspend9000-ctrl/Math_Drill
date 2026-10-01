# M31 — Card Shop Desktop Parity Audit

Audit date 2026-10-02. Desktop Python is READ-ONLY source of truth.
`PY_DIFF = 0` throughout; no `.py` file was modified.

## CORRECTION TO M28

M28 recorded CardShopState as "scope unverified". That was **wrong**, and this
audit proves it is a full player-facing Desktop screen. The reason M28 missed
it: the only `CardShopState(` reference outside the class body sits at
`main.py:724`, inside a long `elif` chain, and a name search alone does not
reveal that the branch is live.

# Desktop evidence

| Item | Source | Finding |
|---|---|---|
| Definition | `main.py:2947-3089` | `class CardShopState(GameState)` |
| Docstring | `main.py:2948-2955` | "Cửa Hàng Đại Thả — **thay thế hoàn toàn** cơ chế cũ Gacha/quay may rủi." It explicitly REPLACES the random gacha: "Dùng Vàng kiếm được để **Đổi** thẻ mạnh. Không xác suất, không pity, không 50/50" |
| Sole caller | `main.py:719-724` | `elif self.gacha_normal_btn.clicked(e.pos):` → grade gate → `trigger_transition(CardShopState())` |
| Exit | `main.py:3010` | `manager.change(MenuState(), transition_type="PAGE")` |
| Card data | `game_init.py:1241-1265` | `GachaBannerSystem.POOL_5STAR` (6), `POOL_4STAR` (7), `POOL_3STAR` (6) |
| Grant | `game_init.py:1420-1436` | `grant_card_direct(title, rarity)` → `inventory` list + `bag` counter + `save()` |
| Prices | `main.py:2956-2960` | 3★ **80**, 4★ **250**, 5★ **600** |
| Grade gate | `main.py:720` + `game_init.py:145-152` | `is_young_learner(grade)` = `grade <= 2` → blocked; grades 3+ allowed |
| Admin bypass | `main.py:3028-3035` | `current_user == ADMIN_USER` skips the gold check entirely |
| Shop entry | `main.py:711-712` | `self.shop_btn` → `ShopState()` (a DIFFERENT screen) |

# Runtime reachability

```
MENU
  -> gacha_normal_btn  (main.py:719)
       grade <= 2  -> "Tính năng này sẽ mở khóa khi con lên lớp 3 nhé! 🌱"  (main.py:721)
       grade >= 3  -> CardShopState()                                       (main.py:724)
                       -> filter / scroll / buy card
                       -> back -> MenuState (PAGE transition)
```

**Player-facing: YES.** Reachable by every grade 3–5 player from the main menu.

# State registration

Desktop has no registry; states are constructed directly
(`trigger_transition(CardShopState())`). No `CardShopState` string appears in
`StateManager`, `game_manager.py`, or `ui/screens.py` — consistent with the
project's construction-style state management.

# Player-facing entry

| | |
|---|---|
| Control | Menu gacha button (`gacha_normal_btn`) |
| Gate | `not is_young_learner(grade)` → grade ≥ 3 |
| Blocked message | "Tính năng này sẽ mở khóa khi con lên lớp 3 nhé! 🌱" for 2.5 s |
| Transition | Desktop default (PAGE) |
| Web today | Menu card `id:'gacha'` → `GachaState` — a **different** screen |

# Input

`main.py:3003-3021`
- `MOUSEWHEEL` → `scroll_y = min(0, scroll_y + e.y * 30)`, then rebuild
- `MOUSEBUTTONDOWN` only; every other event type returns immediately
- back button → Menu
- filter button → set `filter`, reset `scroll_y = 0`, rebuild
- card click → `_buy(card)`, first match wins

# Answer/action handling — `_buy` `main.py:3023-3043`

1. `price = RARITY_INFO[rarity].price`
2. `gold = int(d.get("gold", 0))`
3. admin → **skip** the funds check
4. non-admin and `gold < price` → message, `msg_ok = False`, `msg_timer = 2.8`, **return** (no mutation)
5. non-admin → `d["gold"] = gold - price`
6. `banner_system.grant_card_direct(title, rarity)`
7. success message, `msg_ok = True`, `msg_timer = 2.5`
8. `trigger_shake(2, 0.15)`, confetti 16 at centre, `sound_manager.play_sound("purchase")`

# Update — `main.py:3045-3047`

Only `msg_timer` decays. No gameplay timer.

# Draw — `main.py:3049-3089`

1. fill `(18, 20, 34)`
2. title "CỬA HÀNG ĐẠI THÁ" `(255, 230, 150)` at `WIDTH/2, 55`
3. subtitle 16px `(190, 190, 210)` at `WIDTH/2-270, 95`
4. gold badge top-right; admin shows "Vàng: Vô hạn (Admin)"
5. filter buttons at `y = HEIGHT-70`, x from 210, step 150, 140×50, radius 8; active is WHITE with black text
6. cards: 3 cols, 320×130, gap 16, origin `(40, 130)`; skip when `rect.bottom < 120` or `rect.top > HEIGHT - 90`
   - panel `(35, 38, 58)` r14, 2px border in the rarity colour
   - icon 30px at `+14,+14`; title 16px at `+58,+14`; description 12px truncated at 44 chars; rarity label 12px; price `"{price} 🪙"`; `"Đã có: n"` when owned
7. back button
8. message `(60,200,100)` / `(220,80,80)` at `HEIGHT-45`

# Persistence

`game_init.py:1428-1435`: `inventory` (list, unique titles) + `bag` (title→count),
then `account_system.save()`. Gold is written to the same dict at `main.py:3035`
and saved by `grant_card_direct`.

# Economy/currency

Gold only. Prices 80/250/600. Insufficient gold changes nothing.
Admin buys free. **No pity, no probability, no 50/50** — the class docstring
states this is a deliberate replacement of the random gacha.

# Inventory/card ownership

`bag[title]` counts duplicates; `inventory` holds each title once.

# Audio/effects

`play_sound("purchase")`, `trigger_shake(2, 0.15)`, `confetti_sys.explode(..., 16)`.
None on the insufficient-funds path.

# Cleanup

None — no timers, listeners or state beyond `msg_timer`.

# Re-entry

Desktop builds a fresh instance per visit, so filter/scroll/message reset.

# Web comparison

| | Desktop | Web today |
|---|---|---|
| Menu gacha button | → `CardShopState` | → `GachaState` |
| Screen semantics | deterministic gold→card exchange | random roll-1 / roll-10 |
| Rarity prices | 80 / 250 / 600 | **absent** (`gacha.js` has no `RARITY_INFO`, no `POOL_*`, no `grantCardDirect`, no `price`) |
| Grade gate | `is_young_learner` | none |
| `inventory` / `bag` grant | `grant_card_direct` | not present |

Desktop **has no `GachaState`**. `GachaSystem` / `GachaBannerSystem`
(`game_init.py:1175`, `:1232`) are systems, not screens. The Web `GachaState`
is therefore not a port of any Desktop screen, and `CardShopState` has no Web
counterpart at all.

# FINAL DECISION

## IMPLEMENT

Evidence:
1. `main.py:719-724` — a live menu branch constructs it
2. `main.py:2948-2955` — the docstring states it is the live replacement for gacha
3. `main.py:2956-2960` — concrete prices, so it is an economy surface
4. `game_init.py:1420-1436` — a real persistence path

Not UNKNOWN: every branch of `_buy`, `handle_event`, `update`, `draw` and
`grant_card_direct` was read in full. Not a FALSE GAP: the entry is reachable
for grades 3–5.
