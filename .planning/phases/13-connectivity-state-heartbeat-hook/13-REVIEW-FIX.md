---
phase: 13-connectivity-state-heartbeat-hook
fixed_at: 2026-05-07T00:00:00Z
review_path: .planning/phases/13-connectivity-state-heartbeat-hook/13-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 13: Code Review Fix Report

**Fixed at:** 2026-05-07
**Source review:** `.planning/phases/13-connectivity-state-heartbeat-hook/13-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (warnings only — no critical findings; info findings outside `critical_warning` scope)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-01: Tick-overlap race produces phantom failure increments

**Files modified:** `ui/src/hooks/useHeartbeat.ts`
**Commit:** `47a4eb5`
**Applied fix:** Introduced a per-effect `generation` counter inside `useEffect`. Each tick captures `myGen = ++generation` before its first `await`. After every `await`, the tick re-checks `myGen !== generation` (alongside the existing `cancelled` flag) and returns silently if its generation has been superseded by a newer tick. This means: when an interval-driven tick is in flight and a `visibilitychange`-driven tick fires, the older tick's fetch (which is aborted by the newer tick's `abortRef.current?.abort()` call) no longer poisons `failCount` via its `catch` block. Updated comments in the file document the rationale.

### WR-02: AbortSignal.any fallback silently disables cleanup-time cancellation

**Files modified:** `ui/src/hooks/useHeartbeat.ts`
**Commit:** `bd88591`
**Applied fix:** Removed the `typeof AbortSignal.any === 'function'` feature check and the dead `else` branch that wired only `timeoutSignal` into the fetch. Replaced with an unconditional `AbortSignal.any([controller.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])` composition. Justification (matches reviewer's Option (a)): `AbortSignal.any` and `AbortSignal.timeout` shipped in the same browser-version cohort (Baseline 2024 — Chrome 116+, Safari 17.4+, Firefox 124+), so requiring one while feature-checking the other was pure dead code that, if it ever ran, lost the cancellation semantics the rest of the file claimed to provide. Cleanup-time aborts now reliably cancel the in-flight fetch.

### WR-03: Hook has no automated coverage despite non-trivial wiring

**Files modified:** `ui/src/hooks/useHeartbeat.ts`, `ui/src/hooks/useHeartbeat.test.ts` (new)
**Commit:** `a84a974`
**Applied fix:** Took the reviewer's preferred Option 2 (a real test file, not just a SAFETY comment). Refactored `useHeartbeat.ts` to extract the per-tick orchestration into an exported pure async helper, `runHeartbeatTick(ctx: HeartbeatTickContext)`, whose every dependency (fetch, refs, callbacks, visibility, cancellation, generation) is injected. The hook itself wires real refs and globals into the helper, so the helper exercises the same production code path the hook runs. Added `ui/src/hooks/useHeartbeat.test.ts` with 9 vitest cases covering:

1. Visibility guard (skips fetch when `document.visibilityState !== 'visible'`).
2. Success path (`res.ok` -> reducer 'success' event).
3. Failure path (non-ok response -> reducer 'failure' event).
4. Failure path (thrown error treated as failure regardless of error class — Pitfall 1).
5. Three consecutive failures transition status to `'offline'` (end-to-end across the helper + reducer).
6. Defense-in-depth abort: a new tick aborts the prior controller before installing its own.
7. **WR-01 regression test:** A tick whose fetch is aborted by a newer tick (deterministic via a 2-fetch promise queue + abort listener) MUST NOT increment `failCount`. Confirms the generation guard.
8. **WR-02 regression test:** The signal handed to fetch is composite — aborting the controller (simulating cleanup) propagates to the fetch's signal. Confirms `controller.signal` is wired in.
9. Cancellation guard: when the effect cleanup fires (`cancelled = true`) before the fetch resolves, no status callback runs and state is untouched.

Constraint compliance:
- **No `@testing-library/react`:** `package.json` `dependencies` and `devDependencies` are unchanged. Tests drive `runHeartbeatTick` directly with synthetic refs/state, so no React renderer is needed.
- **Plan grep gates preserved:** `useHeartbeat.ts` still contains literal `5000`, `3000`, `AbortSignal.timeout`, `visibilitychange` (addEventListener + removeEventListener), `clearInterval`, `removeEventListener`, `.abort()`, `nextHeartbeatState` (twice — import + call inside helper), `fetch('/api/ping'`, and `from '../utils/connectivity'`. No `err.name`/`error.name`. No `export default`.
- **Plan file unchanged:** `.planning/phases/13-connectivity-state-heartbeat-hook/13-02-PLAN.md` was not modified (it is read-only per orchestrator instructions).

## Verification

Final consolidated check, run inside the worktree at `/tmp/sv-13-reviewfix-g0D4Ks`:

```
cd ui && npm test -- --run && npm run build && npm run lint
# FINAL_EXIT=0
```

Result: **exit 0**.

- `npm test -- --run`: 3 test files, **24 tests passed** (5 connectivity reducer tests from Plan 13-01 + 9 new heartbeat wiring tests from WR-03 + 10 pre-existing `serializeAnnotations` tests).
- `npm run build`: TypeScript build clean (tsc -b), Vite production build succeeds (chunk-size advisory warnings are pre-existing and unrelated).
- `npm run lint`: ESLint clean.

---

_Fixed: 2026-05-07_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
