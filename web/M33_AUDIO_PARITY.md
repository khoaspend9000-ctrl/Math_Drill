# M33 AUDIO PARITY
Baseline `75edbbc3ccd123ebe37c5a2389dc2ed110884d76`. Desktop `audio.py` / `main.py` / `game_init.py` are the source of truth; Desktop Python untouched (`PY_DIFF = 0`, 36 files).

## 1. Correction to M32.5
M32.5 reported "web/assets ships 0 audio files". True for `web/assets/`, but **the assets were already in the repo** at `web/audio/` — 18 `.ogg` files, 5,653,021 bytes, tracked in git. No asset integration was needed; no download or conversion was performed. M33 verified the mapping instead.

## 2. Desktop source inventory (audio.py)
| Desktop | Value | Line |
|---|---|---|
| BGM map | `nhac_nen.mp3` for menu/lesson/quiz/victory/defeat — **ONE file** | 114-120 |
| BGM volume | `bgm_volume(0.3) x {menu .5, lesson .6, quiz .8, victory .7, defeat .5}` | 163-171 |
| Fever | `bgm_volume * 0.9` | 321-324 |
| `set_bgm` same file | adjust volume only, **do not restart** | 187-194 |
| Combo tiers | 1-4→sound 1 | 5-9→sound 2 | 10-14→sound 3 | 15-19→sound 4 | 20-24→sound 5 | 25+→sound 6 | 267-283 |
| Combo volume | `sfx * (1.0 + tier*0.1)`, cap 1.6 | 290-291 |
| Missing sound | warn + no-op | 80-82, 248 |
| Web-build deferral | no autoplay before first user gesture | 150-161 |

## 3. Source-proven defects found and fixed
1. **BGM map was fabricated** — Web used `menu_bgm/gameplay_bgm/victory_bgm/defeat_bgm`; only `victory_bgm.ogg` exists. Desktop uses one file for all states.
2. **Volume was absolute, not a multiplier** — Web returned 0.8 for victory; Desktop computes `0.3 x 0.7 = 0.21`.
3. **`setBgm` did not exist** — `states_real.js:1222` called it, so every BGM switch was a silent no-op.
4. **Combo tiers were a 3-step ad-hoc map** (`>=10 combo`, `>=5 sound4`, `>=3 sound5`) instead of Desktop's six tiers.
5. **Correct-answer sound was random** — `Math.random()` over sound 1-6. Desktop plays **nothing** on a correct answer except in TimeAttack (`game_init.py:2775-2781`).
6. **Semantic names were unresolvable** — `playSfx('wrong')` looked for `wrong.ogg`, which does not exist. Desktop addresses sounds by semantic key (`audio.py:143`).
7. **`silent` was not a parameter** of `updateCombo` although Desktop's is (`game_init.py:396`), so the combo sound reference threw.
8. **`window.addEventListener` unguarded** in `main.js` — crashed two headless suites.

## 4. Two bugs found by the browser gate in my own M33 code
- **`setBgm` namespace mismatch** — `playBgm` stores `_bgmInfo.file` as the *unresolved* map value (`nhac_nen.mp3`) but `setBgm` compared the *resolved* path (`nhac_nen.ogg`), so the "same file" branch never matched: every switch re-created the `Audio` element, restarting playback and raising `AbortError`. Fixed to compare like with like (`audio.py:180`).
- **Phantom play for missing assets** — `_fileExists` short-circuits to `true` when there is no `fs`, so `playSfx('bogus')` reported success and would 404. Added a known-asset inventory so unknown names are a silent no-op, matching `audio.py:80-82`.

## 5. Test-quality correction
`m8b_audio` T05 and T10 asserted the **pre-M33 (incorrect) Web** behaviour: `menu_bgm.mp3` and the 3-step combo map. Both contradicted Desktop. Corrected to the Desktop values with line citations — this is the same stale-assertion trap that produced the M28 CardShop error. No assertion was weakened or deleted.

## 6. Performance
Audio is **lazy** — nothing is preloaded. Only assets actually played are fetched.
```
initial load (before any gesture) : 0 audio bytes requested
after first gesture               : 1 request (nhac_nen.ogg, 2,498,507 B)
SFX on demand                     : one request per sound
total distinct audio fetched      : 3 in the verification run
```
M17's startup work is preserved: no audio enters the boot path.

## 7. Tests
```
m33_audio_parity.test.js   18 pass / 0 fail   (every assertion cites a Desktop line)
m8b_audio.test.js          14 pass / 0 fail   (T05/T10 corrected to Desktop)
full web regression        63 suites, 1179 pass, 0 fail, 15 skip, 0 harness errors
server                     11 suites, exit 0, 0 fail
PY_DIFF                    0  (36 files)
```

## 8. Browser evidence (real Chromium)
**Desktop 1300x800 — 14/14:** boot→login; no BGM before gesture (`plays=0`); real click unlocks; `nhac_nen` requested over the wire; volume 0.15; register + login through the real UI; `setBgm('lesson')`→0.18; wrong SFX instantiates `tra_loi_sai.ogg`; combo 10 → `sound 3.ogg`; repeated `setBgm` creates 0 new nodes; missing asset → `false`; no media errors.
**Mobile 844x390 — 6/6:** real `touchscreen.tap` unlocks audio and starts BGM at 0.15; no media errors; no duplicate nodes.
```
console=0 page=0 requestFailures=0 audio404=0
```

**Portrait 390x844 is intentionally non-interactive** — M14-E1 shows a rotate hint, so `elementFromPoint` returns `BODY` and a tap cannot reach the canvas. That is existing designed behaviour, not an audio defect; landscape is the playable phone orientation.

## 9. Remaining differences
- `fever_mode.mp3` / `button_click.mp3` are **absent from Desktop too**, so fever and button sounds are silent no-ops — parity preserved.
- Exact question-text parity remains a `WEB_PLATFORM_IMPLEMENTATION_DIFFERENCE` (Python MT19937 vs `Math.random`); untouched.

## 10. Verdict
`100% PLAYER-FACING DESKTOP PARITY: NO` — audio parity is now implemented and verified, but M33 deliberately did not re-audit the full 26-state matrix, and production still serves the pre-M33 build. Non-blocking platform differences remain as listed in §9.
