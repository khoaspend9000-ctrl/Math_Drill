# MATHDRILL WEB — PERFORMANCE REPORT (Deep Audit Pass)

## 1. Baseline environment
- Node v24.20.0, Windows (win32), no browser automation available.
- Benchmark type: **Node structural/invariant harness** (`web/tests/performance_stress.test.js`, 14 invariants) + code-path inspection of hot modules. This is NOT a Chrome DevTools profile and is explicitly labeled as such.

## 2. Scenarios tested
Engine start/stop, duplicate start, dt clamp, particle cap/spawn/clear/pool, state transition repetition (a/b ×50), asset cache reuse, data loader cache, popup open/close ×20, tracked-listener add/remove, repeated menu→lessonselect→lesson→victory ×25, renderer clear/text ×500, achievement queue cap.
(scenarios A–J mapped in `web/tests/PERFORMANCE_BASELINE.md`)

## 3. Bottlenecks found
**None at P0/P1 severity.** Evidence:
- engine.js: single RAF, duplicate-start guard `if (this.running) return;` → exactly 1 RAF per start (measured rafCalls=1 in T02).
- dt bounded: `frameMs > 250 → 250`, `dt = Math.min(FRAME_MIN_MS/1000, MAX_DT)`, max 5 steps/frame (T03).
- effects.js: pool reuse + hard cap 200, budget released on expiry (T04/T05/T06 + m8a T19/T20).
- assets.js / data_loader.js: single-decode Map cache, JSON parsed once (T08/T09).
- ui.js: tracked listeners removed on popup close, `_handles = []` on close, queue cap 20 (T10/T11/T14).
- state_manager.js / states_real.js: enter/exit paired and balanced after 100 transitions (T07/T12).
- save.js: event-based, not per-frame.

## 4. Evidence for each
- T02: rafCalls === 1 after 3 starts.
- T04: `cs.explode(…, 500)` → count ≤ 200.
- T07: enter/exit counter n === 1 after 101 swaps.
- T14: 100 pushes → items.length ≤ 20.
- m8d T06: SurfaceCache FIFO eviction parity with Python.

## 5. Changes made (optimization set)
**∅ — zero production code changes.** Rationale: HARD RULES 11/15 require measured P0/P1 issues; audit found none. Applying speculative micro-optimizations would violate the rules rather than improve them. No debug instrumentation was added to production paths.

## 6. Before/after measurements
Optimization set is empty → before = after. Regression-only validation performed instead (see §7). perf-stress 14/14 before and after; m8a/m8c/m8d unchanged PASS.

## 7. Regression results
- perf-stress: 14/14 PASS
- m8d_performance: 10/10 PASS
- m8c_ui: 18/18 PASS
- m8a_effects: 20/20 PASS
- Full suite ×10 runs: 20 suites (Phase1, M4, M5, M6-A, M6-B ×3, M7 A-D, M8 A-D, M9 A-D, perf-stress) × 10 = **200/200 exit=0**, 0 intermittent failure.

## 7b. Incident during documentation (docs-only, recovered)
- PowerShell `Add-Content` với here-string làm hỏng UTF-8 của WEB_PORT_PLAN.md; truncation để remove mojibake làm mất 4 sections cuối (M8-C/M8-D/M8-totals/M9-A — chỉ documentation, KHÔNG phải production code).
- WEB_PORT_PLAN.md restored từ git blob fa9b0df + 4 sections được reconstruct minh bạch (RECONSTRUCTION NOTE trong file, INCIDENT NOTE trong web/CHECKPOINTS.md).
- Không production file bị ảnh hưởng; regression xác nhận lại 14/14 + 18/18 + 18/18 PASS sau phục hồi.

## 8. Browser test status
**Browser validation was NOT performed** — no browser automation environment available. All validation is Node-based; this is stated rather than claimed.

## 9. Remaining performance risks
- Real-browser FPS/JS-GC behavior unverifiable here; recommend manual DevTools smoke later.
- Renderer text path allocates option objects per call — P3, no measured frame-time impact, intentionally left.

## 10. Intentionally NOT applied
- Removing save/restore pairs in renderer (drawing-state risk, no measured gain).
- Moving static layout computation out of states (verified M7 behavior, no measured issue).
- Any micro-optimization in M6/M7/M8 verified modules (HARD RULES 2/12).