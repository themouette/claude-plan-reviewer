---
phase: 13-connectivity-state-heartbeat-hook
plan: 01
subsystem: ui
tags: [typescript, vitest, state-machine, react, connectivity, heartbeat]

requires:
  - phase: 12-backend-heartbeat-endpoint
    provides: "GET /api/ping endpoint that the future useHeartbeat hook (Plan 13-02) will poll"
provides:
  - "Pure ConnectivityStatus type ('online' | 'offline') — single source of truth import path for Plan 13-02"
  - "HeartbeatState type and initialHeartbeatState const for hook-internal state tracking"
  - "HeartbeatEvent discriminated union ({ type: 'success' } | { type: 'failure' })"
  - "nextHeartbeatState pure reducer encoding asymmetric hysteresis (3 failures down, 1 success up)"
  - "Five Vitest tests proving the online -> degraded -> offline -> online sequence"
affects:
  - 13-02 (useHeartbeat hook will import from ui/src/utils/connectivity)
  - 14-offline-banner (banner consumes ConnectivityStatus)
  - 15-clipboard-submit (submit path branches on ConnectivityStatus)

tech-stack:
  added: []
  patterns:
    - "Pure-function state reducer (zero DOM, zero timers, zero fetch) — analog to ui/src/utils/serializeAnnotations.ts"
    - "Discriminated-union event with exhaustive switch (no default clause; relies on noFallthroughCasesInSwitch + string-literal exhaustiveness)"
    - "Self-contained module — domain types co-located with the reducer rather than in shared ui/src/types.ts"
    - "Test titles prefixed `Test N:` matching serializeAnnotations.test.ts convention"

key-files:
  created:
    - ui/src/utils/connectivity.ts
    - ui/src/utils/connectivity.test.ts
  modified: []

key-decisions:
  - "ConnectivityStatus is two-state ('online' | 'offline'); the degraded period is internal, tracked by failCount only"
  - "Asymmetric hysteresis: 3 consecutive failures to mark offline, 1 success to recover (prevents transient-loopback false alarms)"
  - "ConnectivityStatus lives in ui/src/utils/connectivity.ts, not ui/src/types.ts — keeps the hook subsystem self-contained"
  - "No new npm dependencies — pure TS, vitest is already installed; @testing-library/react intentionally not added"

patterns-established:
  - "State-machine reducer pattern: { state, event } -> state, exhaustive switch on event.type, pure (no closures, no I/O)"
  - "Vitest unit-test pattern for pure utilities: direct call + expect, no mocks, no DOM, no timers"

requirements-completed:
  - HB-02

duration: 3min
completed: 2026-05-07
---

# Phase 13 Plan 01: Connectivity State Reducer Summary

**Pure TypeScript state-machine reducer with ConnectivityStatus ('online' | 'offline'), asymmetric hysteresis (3 failures → offline, 1 success → online), and five Vitest tests proving the full state sequence in isolation.**

## Performance

- **Duration:** ~3 min (effective coding time; npm install dominates wall clock)
- **Started:** 2026-05-07T05:39:17Z
- **Completed:** 2026-05-07T05:41:41Z
- **Tasks:** 2
- **Files modified:** 2 (both created, none modified)

## Accomplishments

- `ui/src/utils/connectivity.ts` — pure reducer with 5 named exports (`ConnectivityStatus`, `HeartbeatState`, `HeartbeatEvent`, `initialHeartbeatState`, `nextHeartbeatState`) and zero imports
- `ui/src/utils/connectivity.test.ts` — five Vitest tests, one per must_have truth, all passing under `vitest run`
- ROADMAP success criterion #5 (online → degraded → offline → online sequence covered in isolation) is now verifiable
- Source-of-truth import path established for Plan 13-02 (`from '@/utils/connectivity'` resolves to this file)
- Zero new npm dependencies introduced (zero-dep policy upheld)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create connectivity.ts with ConnectivityStatus type and nextHeartbeatState pure reducer** — `f58a32d` (feat)
2. **Task 2: Create connectivity.test.ts with five Vitest tests covering the online → degraded → offline → online sequence** — `e470134` (test)

_Note: Plan-level type=execute (not type=tdd), so the RED→GREEN gate sequence is not enforced as separate commits within the same task. The test commit (e470134) follows the implementation commit (f58a32d) — both must commits exist together for the plan to be considered complete._

## Files Created/Modified

- `ui/src/utils/connectivity.ts` — Pure state reducer module:
  - `export type ConnectivityStatus = 'online' | 'offline'`
  - `export interface HeartbeatState { status: ConnectivityStatus; failCount: number }`
  - `export type HeartbeatEvent = { type: 'success' } | { type: 'failure' }`
  - `export const initialHeartbeatState: HeartbeatState = { status: 'online', failCount: 0 }`
  - `export function nextHeartbeatState(state: HeartbeatState, event: HeartbeatEvent): HeartbeatState`
- `ui/src/utils/connectivity.test.ts` — Vitest test suite (5 tests under `describe('nextHeartbeatState', ...)`)

## Test Coverage (must_have truths → tests)

| must_have truth | Test |
|---|---|
| A single failed ping does not transition status off online (failCount=1, status='online') | Test 1: one failure stays online (failCount 1) |
| Two consecutive failures keep status online (failCount=2, status='online') | Test 2: two failures stay online (failCount 2) |
| Three consecutive failures transition status to offline (failCount=3, status='offline') | Test 3: three consecutive failures transition to offline |
| A single success from offline transitions back to online and resets failCount to 0 | Test 4: single success from offline returns to online and resets failCount |
| A success while degraded (failCount > 0, status='online') resets failCount to 0 without changing status | Test 5: success while degraded resets failCount without status change |

All five tests pass under `cd ui && npm test -- --run src/utils/connectivity.test.ts`. The full UI suite (15 tests across 2 files) is green; lint is clean; `npm run build` succeeds end-to-end.

## Decisions Made

- None - followed plan as specified (the `<action>` blocks supplied exact code; no deviation needed).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `node_modules/` was not present in the worktree on spawn — `npm install` was run once before verification could proceed. This is expected behavior in a fresh worktree (`node_modules` is gitignored); not a deviation, just a one-time setup step.

## Verification Results

- `cd ui && npm test -- --run src/utils/connectivity.test.ts` — 5/5 tests pass
- `cd ui && npm test -- --run` — 15/15 tests pass across 2 test files (no regressions in serializeAnnotations.test.ts)
- `cd ui && npm run lint` — exit 0, clean
- `cd ui && npm run build` — exit 0, full TypeScript + Vite build succeeds (proves verbatimModuleSyntax + erasableSyntaxOnly compliance)
- `grep -c "export type ConnectivityStatus = 'online' | 'offline'" ui/src/utils/connectivity.ts` — 1
- `grep -cE "\benum\b" ui/src/utils/connectivity.ts` — 0 (no enum keyword)
- `grep -c "export default" ui/src/utils/connectivity.ts` — 0 (no default export)
- `grep -cE "it\('Test [1-5]:" ui/src/utils/connectivity.test.ts` — 5 (five sequentially numbered tests)
- `grep -cE "from '@testing-library/react'" ui/src/utils/connectivity.test.ts` — 0 (zero-dep policy upheld)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 13-02 (useHeartbeat hook) can now `import { nextHeartbeatState, initialHeartbeatState, type ConnectivityStatus } from '@/utils/connectivity'` (or `'./connectivity'` from a sibling location)
- The hook will wrap the reducer in `useReducer(...)` and drive it from a `setInterval` polling loop against `/api/ping` (Phase 12 endpoint)
- No blockers; no concerns

## Self-Check: PASSED

- File `ui/src/utils/connectivity.ts`: FOUND
- File `ui/src/utils/connectivity.test.ts`: FOUND
- Commit `f58a32d` (Task 1): FOUND
- Commit `e470134` (Task 2): FOUND

---
*Phase: 13-connectivity-state-heartbeat-hook*
*Completed: 2026-05-07*
