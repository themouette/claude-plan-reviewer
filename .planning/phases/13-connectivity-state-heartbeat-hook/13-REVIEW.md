---
phase: 13-connectivity-state-heartbeat-hook
reviewed: 2026-05-07T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - ui/src/utils/connectivity.ts
  - ui/src/utils/connectivity.test.ts
  - ui/src/hooks/useHeartbeat.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-05-07
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

The pure reducer in `connectivity.ts` and its sibling test file are clean,
exhaustive, and faithful to the locked design (3-failure-down / 1-success-up
hysteresis). No defects found in those two files beyond minor stylistic notes.

The `useHeartbeat` hook implements the visibility-aware polling and abort
plumbing correctly for the happy path, but has a **race condition** in the
overlap-handling logic that can phantom-increment `failCount` in real
scenarios (back-to-back `visibilitychange` events while a tick is in flight),
plus a **silent degradation** in the `AbortSignal.any` fallback branch where
cleanup-time aborts no longer cancel the in-flight fetch. Neither rises to
critical because the reducer's asymmetric hysteresis forgives a transient
spurious failure as soon as one real success arrives, but both should be
addressed before this hook is consumed by Phase 14's offline banner — the
banner will visibly flash if a phantom failure happens to land as the third
consecutive in a degraded window.

There is also no automated coverage for the hook's wiring (visibility guard,
abort composition, immediate-tick-on-resume). The plan acknowledges this
explicitly and substitutes grep gates, but the trade-off is real: the bugs
flagged below would not be caught by any check currently in CI.

## Warnings

### WR-01: Tick-overlap race produces phantom failure increments

**File:** `ui/src/hooks/useHeartbeat.ts:30-51`
**Issue:**
The comment on line 28-29 asserts that "AbortSignal.timeout(3000) < 5000ms
interval makes overlap structurally impossible." This is true for the
`setInterval` axis alone, but **false** once the `visibilitychange` handler
is in play. Concrete sequence that breaks the invariant:

1. `T=0` — tab is visible, interval-driven `tick A` starts a fetch (signal:
   3 s timeout + abortRef.current.signal).
2. `T=500ms` — user briefly switches to another tab, then back. The
   `visibilitychange` listener fires `void tick()` for `tick B`.
3. `tick B` line 30 calls `abortRef.current?.abort()` — this aborts
   `tick A`'s in-flight fetch.
4. `tick A`'s `await fetch(...)` rejects. `tick A` enters the `catch` block
   (line 45). The closure-scope `cancelled` flag is `false` (the effect is
   still mounted), so the guard on line 49 does **not** return.
5. `tick A` records `event = { type: 'failure' }` and calls
   `nextHeartbeatState(stateRef.current, event)` — `failCount` increments
   even though the network was never actually unreachable.
6. `tick B` then completes its own fetch and (assuming the server is up)
   records a success, resetting `failCount` to 0.

Net outcome on a healthy server: a transient `failCount` of 1 that gets
reset within milliseconds. **However**, if the user happens to be in a
degraded state (`failCount = 2` from two real failures), the phantom
increment from this race will trip the threshold and flip
`ConnectivityStatus` to `'offline'` for the time it takes `tick B` to
return — a user-visible offline flash that does not reflect reality.

The bug is rare in practice but the code's own comment claims it is
impossible, which it is not. The root cause is that the `catch` block does
not distinguish between "this fetch was aborted because the effect cleaned
up", "this fetch timed out", and "this fetch was aborted because a newer
tick superseded it". The first two are real failures; the third is not.

**Fix:**
Track which tick is current with a generation token, and skip
`stateRef`/`setStatus` updates from any tick that has been superseded.

```typescript
useEffect(() => {
  let cancelled = false
  let generation = 0  // monotonically increasing per tick

  async function tick() {
    if (document.visibilityState !== 'visible') return

    const myGen = ++generation
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    const signal =
      typeof AbortSignal.any === 'function'
        ? AbortSignal.any([controller.signal, timeoutSignal])
        : timeoutSignal

    let event: HeartbeatEvent
    try {
      const res = await fetch('/api/ping', { signal })
      if (cancelled || myGen !== generation) return
      event = res.ok ? { type: 'success' } : { type: 'failure' }
    } catch {
      if (cancelled || myGen !== generation) return
      event = { type: 'failure' }
    }

    const next = nextHeartbeatState(stateRef.current, event)
    stateRef.current = next
    setStatus((prev) => (prev === next.status ? prev : next.status))
  }
  // ...
}, [])
```

The `myGen !== generation` guard ensures only the *latest* tick can update
state; superseded ticks (whose abort was triggered by a newer tick) silently
no-op rather than poisoning the failure counter.

---

### WR-02: AbortSignal.any fallback silently disables cleanup-time cancellation

**File:** `ui/src/hooks/useHeartbeat.ts:34-38`
**Issue:**
In the `else` branch of the `AbortSignal.any` feature check, `signal` is set
to `timeoutSignal` only — `controller.signal` is never wired into the fetch.
This means:

- The `abortRef.current?.abort()` call at line 30 (defense-in-depth before
  starting a new tick) becomes a no-op for the in-flight request.
- More importantly, the cleanup at line 78 (`abortRef.current?.abort()`)
  does not actually cancel the in-flight fetch. The fetch continues until
  its 3-second timeout fires naturally.

In a StrictMode dev double-mount, this means the first mount's fetch can
still complete and resolve after the first effect's cleanup ran but before
the second mount's effect installs new closures. Because `cancelled` from
the outer closure is `true` for that first invocation, the resolution
correctly bails on lines 43 / 49 — so this does not cause incorrect state
under StrictMode specifically. The real cost is in production: a hung
server response (e.g., 2.9 s) cannot be cancelled by tab close until the
3 s timeout, instead of being cancelled immediately on unmount.

In modern browsers `AbortSignal.any` is available (Baseline 2024: Chrome
116+, Safari 17.4+, Firefox 124+) and the fallback branch is dead code.
But if it ever runs, it loses cancellation semantics that the rest of the
file claims to provide.

**Fix:**
Either (a) drop the fallback entirely and require `AbortSignal.any` (the
project already requires `AbortSignal.timeout`, which has the same browser
matrix), or (b) implement a real fallback that wires the controller signal
in, e.g. by abandoning `AbortSignal.timeout` in this branch and using a
`setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)` plus a single
controller. Option (a) is simpler and consistent:

```typescript
const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
```

`AbortSignal.timeout` and `AbortSignal.any` shipped in the same
browser-version cohort, so accepting one and feature-checking the other
buys nothing.

---

### WR-03: Hook has no automated coverage despite non-trivial wiring

**File:** `ui/src/hooks/useHeartbeat.ts` (whole file)
**Issue:**
CLAUDE.md "Test Coverage Requirements" classifies hooks containing business
logic (route handlers, validation, async behavior) as BLOCKER if no test
exists. The plan (13-02-PLAN.md, lines 254 / 318-319) explicitly waives
this on the grounds that adding `@testing-library/react` would violate the
bundle-size policy, and substitutes grep gates.

The grep gates can prove that the literal strings `'visibilitychange'`,
`AbortSignal.timeout`, `5000`, `3000`, etc. exist in the file, but they
cannot prove behavior. In particular, the bug in WR-01 (phantom failure
increment from racing ticks) and WR-02 (cleanup-time abort no-op in the
fallback branch) would both pass every grep gate currently in the plan.

The waiver is defensible if and only if the rest of the team understands
that any change to this file's wiring needs a manual smoke test against
a flaky `/api/ping` server. That expectation is not documented anywhere
the next maintainer will see.

**Fix:**
Two acceptable resolutions:
1. Accept the policy and add a `// SAFETY: see 13-02-PLAN.md verification
   note — no automated coverage, hand-test changes against /api/ping`
   comment at the top of the file so future contributors know.
2. Add a minimal `useHeartbeat.test.ts` using `vitest`'s `vi.useFakeTimers`
   plus a `globalThis.fetch` stub — no `@testing-library/react` needed.
   The race in WR-01 can be reproduced deterministically with fake timers
   and a 2-fetch promise queue (resolve in reverse order).

Option 2 is preferred: a 50-line test file would catch both warnings above.

## Info

### IN-01: `failCount` tracked outside React state forfeits DevTools visibility

**File:** `ui/src/hooks/useHeartbeat.ts:17`
**Issue:**
`stateRef` holds `HeartbeatState` (status + failCount) but only `status` is
mirrored into React state via `setStatus`. This is intentional per the
comment on line 15-16 (avoid spurious re-renders from failCount churn), and
the design is sound. The trade-off is that `failCount` is invisible to React
DevTools and unobservable from outside the hook. If a future maintainer
wants to expose "degraded" or surface the failure counter for debugging,
they will need to refactor.
**Fix:** Document the trade-off in a JSDoc on the hook, e.g.:

```typescript
/**
 * Returns the current connectivity status. The internal failCount used by
 * the 3-failure threshold is deliberately stored in a ref (not React state)
 * so transient counter increments do not trigger re-renders. If you need to
 * surface failCount to consumers, expose it via a separate exported state.
 */
export function useHeartbeat(): ConnectivityStatus {
```

---

### IN-02: Polling cadence and timeout are private; consumers cannot adjust

**File:** `ui/src/hooks/useHeartbeat.ts:10-11`
**Issue:**
`POLL_INTERVAL_MS` and `REQUEST_TIMEOUT_MS` are module-private constants.
They satisfy the HB-02 / HB-04 grep gates but are unreachable from tests
or other consumers (e.g., a future "fast" or "slow" heartbeat for a
different UI surface). Not a defect — the plan locks both values — but
worth noting for forward planning.
**Fix:** No action required for this phase. If Phase 14+ ever needs a
configurable variant, take the `useHeartbeat({ pollMs?, timeoutMs? })`
overload route at that time rather than retrofitting now.

---

### IN-03: Test 2 reuses `initialHeartbeatState` reference but reassigns

**File:** `ui/src/utils/connectivity.test.ts:16, 24`
**Issue:**
`let s: HeartbeatState = initialHeartbeatState` binds `s` to the shared
module-level constant. The reducer returns new objects (verified by
inspection of `connectivity.ts` lines 21, 25, 27), so `s` is reassigned
on every call rather than mutated. This is correct, but a strict reader
might flinch at the visual pattern of "reassigning the initial state
sentinel". A short comment or a fresh `{ ...initialHeartbeatState }`
would remove the cognitive friction.
**Fix:** Optional. If addressed:

```typescript
let s: HeartbeatState = { ...initialHeartbeatState }
```

Cost: 3 extra characters, eliminates the "is this mutation?" mental check.

---

### IN-04: Switch in reducer omits explicit exhaustiveness assertion

**File:** `ui/src/utils/connectivity.ts:19-29`
**Issue:**
The `switch (event.type)` is exhaustive over the discriminated union
`{ type: 'success' } | { type: 'failure' }`, and TypeScript will catch any
new variant added without a matching case (return type would become
`HeartbeatState | undefined`). The `noFallthroughCasesInSwitch` flag
provides additional safety. So this is structurally sound today.

If a third event variant is ever added (e.g., `{ type: 'reset' }`), the
compile error will surface, but only at the reducer's caller, not at the
reducer itself. A `default: { const _exhaustive: never = event.type;
throw new Error(...) }` clause would localise the error. This is project
style — `serializeAnnotations.ts` does not use the pattern either, so
consistency argues against introducing it here.
**Fix:** No action required. Documenting in case a future event variant is
added.

---

_Reviewed: 2026-05-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
