# MATHDRILL WEB — PERFORMANCE BASELINE (Phase 0)

> benchmark type: **Node benchmark** (structural/invariant harness + micro-benchmark of particle update path).
> Đây KHÔNG phải Chrome DevTools profile — browser validation được ghi rõ ở Phase 7.

## Environment

- Node v24.20.0, Windows, VS Code terminal
- harness: `web/tests/performance_stress.test.js` (14 invariants, no machine-FPS assertion)
- no real browser automation available in this environment

## Structural invariants verified (baseline, before optimization)

| # | invariant | baseline result |
|---|-----------|-----------------|
| T01 | engine start/stop | PASS |
| T02 | duplicate start → exactly 1 RAF | PASS (rafCalls=1) |
| T03 | dt clamp guard (MAX_DT, frameMs>250 cap, steps<5) | PASS |
| T04 | hard particle cap = 200 | PASS |
| T05 | repeated spawn/clear → count 0 | PASS |
| T06 | particle pool reuse | PASS |
| T07 | 50× a/b transitions → enter/exit balanced (n=1) | PASS |
| T08 | asset cache reuse (same id → cached promise) | PASS |
| T09 | data loader cache present | PASS |
| T10 | 20× popup show/close → closed, no growth | PASS |
| T11 | tracked listener add/remove → back to baseline | PASS |
| T12 | 25× menu→lessonselect→lesson→victory | PASS |
| T13 | 500× renderer clear/text stable | PASS |
| T14 | achievement queue cap 20 | PASS |

## Code audit findings (measured by inspection + Node micro-benchmark)

1. **A. GAME LOOP (engine.js)** — single RAF loop, duplicate-start guarded by `if (this.running) return;`, stop cancels RAF + removes resize listener, dt clamped (`frameMs>250 → 250`, `dt = min(FRAME_MIN_MS/1000, MAX_DT=1/20)`, max 5 steps/frame). FPS counter throttled to 0.5s windows. **No duplicate loop, no fixdt semantics change needed.**
2. **B. RENDER PATH (renderer.js)** — save/restore paired in text/roundRect paths; no gradient/Path2D rebuild per frame found in hot loop; getTransform re-reads only in applyTransform. No P0/P1 issue measured.
3. **C. PARTICLES (effects.js)** — pool reuse confirmed (T06), cap 200 (T04), budget released on expiry (T20 in m8a). No splice-in-forward-loop hot-path issue found.
4. **D. ASSETS (assets.js)** — Map cache, same URL decoded once (T08). Cache capped, eviction FIFO verified in M8-D T06. No rewrite.
5. **E. DATA LOADING (data_loader.js)** — in-memory `_cache`; JSON parsed once (T09 structural). No repeated fetch per transition.
6. **F. INPUT (input.js)** — singleton, listeners bound once, coordinate transform only on click events. No duplicate registration measured.
7. **G. UI (ui.js)** — tracked listener registry (T11), popup `_handles` cleared on close (T10), AchievementQueue capped at 20 (T14), no per-frame DOM query.
8. **H. AUDIO (audio.js)** — SFX cache Map, missing files null-cached, BGM single instance, unlock attached once.
9. **I. SAVE (save.js)** — event-based (answer/reward/equip), not per-frame. No redundant stringify measured in hot path.
10. **J. STATE TRANSITIONS (state_manager.js, states_real.js)** — enter/exit paired (T07/T12), listeners survive only via tracked registry, no timers retained after exit.

## Conclusion

Baseline already structurally sound. Phase 1+ found **no P0 bottleneck** (no duplicate RAF, no unbounded growth, no per-frame allocation hotspot). Any change in Phase 3 would be P3 micro without measurement evidence — per HARD RULE 11/15 those are **intentionally NOT applied**.

Phase 1 (find bottlenecks): see PERFORMANCE_REPORT.md (same conclusions as above, with evidence refs).
Phase 5 before/after: optimization set = ∅ (documented in PERFORMANCE_REPORT.md), so before = after; regression only.