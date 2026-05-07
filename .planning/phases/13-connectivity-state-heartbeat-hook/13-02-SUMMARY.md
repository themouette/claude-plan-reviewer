---
phase: 13-connectivity-state-heartbeat-hook
plan: 02
subsystem: ui
tags: [react, hook, polling, abortsignal, visibility, heartbeat, connectivity]

requires:
  - phase: 13-connectivity-state-heartbeat-hook
    plan: 01
    provides: "Pure ConnectivityStatus reducer (initialHeartbeatState, nextHeartbeatState) consumed by the hook"
  - phase: 12-backend-heartbeat-endpoint
    provides: "GET /api/ping endpoint that the hook polls every 5s"
provides:
  - "useHeartbeat() React hook returning ConnectivityStatus — single subscription point for Phase 14's offline banner"
  - "5-second polling loop wired to /api/ping with 3-second per-request AbortSignal.timeout"
  - "Page Visibility integration — pauses while tab hidden, fires immediate tick on resume"
affects:
  - 14-offline-banner (banner consumes useHeartbeat() directly)
  - 15-clipboard-submit (submit path branches on ConnectivityStatus from this hook)

tech-stack:
  added: []
  patterns:
    - "Single-useEffect hook with empty dep array and symmetric setup/cleanup (StrictMode-safe; analog to ui/src/hooks/useTextSelection.ts)"
    - "AbortSignal.any composition of (AbortController.signal, AbortSignal.timeout) with feature detect — defense-in-depth against in-flight overlap"
    - "Object.is bail-out via functional setState — failCount changes do not flow into React state, only ConnectivityStatus transitions cause re-renders"
    - "Reducer-as-pure-function consumed manually (no useReducer) — keeps the hook surface minimal and lets the pure reducer tests in Plan 13-01 carry the state-machine assertions"

key-files:
  created:
    - ui/src/hooks/useHeartbeat.ts
  modified: []

key-decisions:
  - "failCount tracked in useRef, not useState — only ConnectivityStatus transitions trigger re-renders (avoids 2 useless renders per offline transition)"
  - "Inverted visibility guard (document.visibilityState !== 'visible') pauses for any non-visible state including 'prerender' and 'unloaded' (RESEARCH.md Pitfall 5)"
  - "No useHeartbeat.test.ts — bundle-size policy forbids adding @testing-library/react; pure-reducer tests in Plan 13-01 cover the state-machine assertions"
  - "No err.name branching — Chromium throws AbortError and Firefox/Safari throw TimeoutError; treat any exception as a failure (RESEARCH.md Pitfall 1)"
  - "Empty dep array on the useEffect — this is a mount-only effect; cleanup symmetry guarantees StrictMode-safety in dev"

patterns-established:
  - "React 19 polling hook: single useEffect, immediate first tick, named-constant interval, symmetric cleanup"
  - "AbortSignal.any with typeof feature-detect — graceful degradation if older runtime lacks AbortSignal.any"

requirements-completed:
  - HB-02
  - HB-03
  - HB-04

duration: 2min
completed: 2026-05-07
---

# Phase 13 Plan 02: useHeartbeat Hook Summary

**React 19 hook that polls `GET /api/ping` every 5s with a 3s per-request `AbortSignal.timeout`, pauses when the tab is hidden, fires an immediate tick on resume, and returns a stable `ConnectivityStatus` driven by the pure reducer from Plan 13-01.**

## Performance

- **Duration:** ~2 min (effective coding time; npm install dominates wall clock once again)
- **Started:** 2026-05-07T05:45:59Z
- **Completed:** 2026-05-07T05:47:57Z
- **Tasks:** 1
- **Files modified:** 1 (created, none modified)

## Accomplishments

- `ui/src/hooks/useHeartbeat.ts` — single-export React hook (`useHeartbeat(): ConnectivityStatus`)
- HB-02 satisfied: 5000ms polling cadence (`const POLL_INTERVAL_MS = 5000`, line 10) and `nextHeartbeatState` delegated for 3-failure threshold
- HB-03 satisfied: `visibilitychange` listener registered (line 72) AND removed (line 77); in-tick guard `document.visibilityState !== 'visible'` (line 25); resume tick (line 61)
- HB-04 satisfied: `AbortSignal.timeout(REQUEST_TIMEOUT_MS)` with `REQUEST_TIMEOUT_MS = 3000` (line 11, used line 34)
- StrictMode-safe cleanup: `return () =>` on line 74 disposes interval, listener, AbortController, and sets the `cancelled` flag
- Zero new npm dependencies introduced (`git diff ui/package.json` is empty)

## Final Exports

```typescript
// ui/src/hooks/useHeartbeat.ts
export function useHeartbeat(): ConnectivityStatus
```

Single named export. No default export. Phase 14 will consume via:

```typescript
import { useHeartbeat } from '../hooks/useHeartbeat'
import { type ConnectivityStatus } from '../utils/connectivity'
```

## Task Commits

1. **Task 1: Create useHeartbeat hook with 5s polling, AbortSignal.timeout(3000), and visibility-aware pause/resume** — `0c45e38` (feat)

_Note: Plan-level type=execute (not type=tdd). The plan explicitly directs that no `useHeartbeat.test.ts` be created (RESEARCH.md A1 / bundle-size policy). The state-machine logic this hook drives is fully covered by `connectivity.test.ts` from Plan 13-01 (5/5 tests pass)._

## Files Created/Modified

- `ui/src/hooks/useHeartbeat.ts` (created, 83 lines)
  - 1 import block (React hooks + connectivity types)
  - 2 module-scope constants: `POLL_INTERVAL_MS = 5000`, `REQUEST_TIMEOUT_MS = 3000`
  - 1 `useEffect(..., [])` with `tick()`, `onVisibilityChange()`, immediate first tick, `setInterval`, listener registration, and 4-step cleanup return

## Requirement Satisfaction (file:line evidence)

| Requirement | File:line evidence |
|---|---|
| HB-02 (5s polling) | `useHeartbeat.ts:10` (`POLL_INTERVAL_MS = 5000`); `useHeartbeat.ts:71` (`window.setInterval(tick, POLL_INTERVAL_MS)`) |
| HB-02 (3-failure threshold) | `useHeartbeat.ts:51` (`nextHeartbeatState(stateRef.current, event)`) — delegated to Plan 13-01 reducer; tested by `connectivity.test.ts` Test 3 |
| HB-03 (in-tick visibility guard) | `useHeartbeat.ts:25` (`if (document.visibilityState !== 'visible') return`) |
| HB-03 (visibilitychange add) | `useHeartbeat.ts:72` (`document.addEventListener('visibilitychange', onVisibilityChange)`) |
| HB-03 (visibilitychange remove) | `useHeartbeat.ts:77` (`document.removeEventListener('visibilitychange', onVisibilityChange)`) |
| HB-03 (immediate tick on resume) | `useHeartbeat.ts:60-64` (`onVisibilityChange` calls `void tick()` when `visibilityState === 'visible'`) |
| HB-04 (3s abort timeout) | `useHeartbeat.ts:11` (`REQUEST_TIMEOUT_MS = 3000`); `useHeartbeat.ts:34` (`AbortSignal.timeout(REQUEST_TIMEOUT_MS)`) |
| StrictMode-safe cleanup | `useHeartbeat.ts:74-79` (cancelled flag, clearInterval, removeEventListener, abortRef.current?.abort()) |
| Pitfall 1 (no err.name branching) | `useHeartbeat.ts:43-49` (`catch {` block — no error parameter; `grep -cE "err\.name\|error\.name" useHeartbeat.ts` returns 0) |

## Decisions Made

- **No `useHeartbeat.test.ts` created** — explicit instruction in the plan's `<action>` block ("Do NOT: Write a `useHeartbeat.test.ts` integration test"). The bundle-size policy forbids adding `@testing-library/react`, the only realistic in-process renderer for hook tests. Behavior is verified via grep markers (HB-02/03/04 acceptance checks) and the pure-reducer tests in Plan 13-01.
- **`failCount` lives in a `useRef`, not `useState`** — every increment would trigger a re-render. Only the `ConnectivityStatus` string is React state; failCount progressing 0 → 1 → 2 stays in the ref.
- **Functional `setStatus` form** — `setStatus((prev) => prev === next.status ? prev : next.status)` exploits React 19's Object.is bail-out so a tick that does not change the visible status (e.g., a success while still online) does not re-render the consumer tree.

## Deviations from Plan

**1. [Rule 1 — Comment phrasing] Reworded the Pitfall 1 catch-block comment to avoid the literal substring `err.name`.**

- **Found during:** Task 1 verification step
- **Issue:** The plan's `<action>` block prescribed the comment `// Pitfall 1: do NOT branch on err.name — ...`, but the plan's own acceptance criterion `grep -cE "err\.name|error\.name" ui/src/hooks/useHeartbeat.ts returns 0` would fail because that literal substring appears inside the comment. The two requirements were internally inconsistent.
- **Fix:** Reworded the comment to "do NOT inspect the thrown error" + describe the cross-browser behaviour (Chromium reports an AbortError, Firefox/Safari report a TimeoutError). The intent (do not branch on the thrown error type) is preserved verbatim; only the literal substring `err.name` was removed so the regex check passes.
- **Files modified:** `ui/src/hooks/useHeartbeat.ts` (comment lines only)
- **Commit:** `0c45e38` (the file was committed with the reworded comment; no separate fixup commit was needed since the rewording happened before the initial commit)

## Issues Encountered

- `node_modules/` was not present in the worktree on spawn — `npm install` was run once before verification could proceed (same expected behavior noted in Plan 13-01's summary). One-time setup, not a deviation.

## Verification Results

- `cd ui && npm run build` — exit 0, full TypeScript + Vite build succeeds (proves `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals` compliance)
- `cd ui && npm run lint` — exit 0, eslint clean
- `cd ui && npm test -- --run` — 15/15 tests pass across 2 test files (connectivity.test.ts: 5; serializeAnnotations.test.ts: 10) — no regressions
- `grep -c "export function useHeartbeat" ui/src/hooks/useHeartbeat.ts` → 1
- `grep -c "AbortSignal.timeout" ui/src/hooks/useHeartbeat.ts` → 2 (constant declaration site + usage)
- `grep -c "3000" ui/src/hooks/useHeartbeat.ts` → 2 (constant + comment)
- `grep -c "5000" ui/src/hooks/useHeartbeat.ts` → 2 (constant + comment)
- `grep -c "visibilitychange" ui/src/hooks/useHeartbeat.ts` → 2 (addEventListener + removeEventListener)
- `grep -c "visibilityState" ui/src/hooks/useHeartbeat.ts` → 2 (in-tick guard + resume guard)
- `grep -c "fetch('/api/ping'" ui/src/hooks/useHeartbeat.ts` → 1
- `grep -c "from '../utils/connectivity'" ui/src/hooks/useHeartbeat.ts` → 1
- `grep -c "nextHeartbeatState" ui/src/hooks/useHeartbeat.ts` → 2 (import + call)
- `grep -c "clearInterval" ui/src/hooks/useHeartbeat.ts` → 1
- `grep -c "removeEventListener" ui/src/hooks/useHeartbeat.ts` → 1
- `grep -cE "\.abort\(\)" ui/src/hooks/useHeartbeat.ts` → 2 (defense-in-depth pre-tick abort + cleanup abort)
- `grep -cE "err\.name|error\.name" ui/src/hooks/useHeartbeat.ts` → 0 (Pitfall 1 honored)
- `grep -c "export default" ui/src/hooks/useHeartbeat.ts` → 0
- `git diff ui/package.json` — empty (zero new dependencies)

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 14 (offline banner) can now `import { useHeartbeat } from '../hooks/useHeartbeat'` and subscribe to the returned `ConnectivityStatus`
- Phase 15 (clipboard submit) can branch its submit path on the same value
- No blockers; no concerns
- Forward note: `useHeartbeat` is the **only** subscription point — consumers must NOT add competing polling loops; one polling hook per app

## Self-Check: PASSED

- File `ui/src/hooks/useHeartbeat.ts`: FOUND
- Commit `0c45e38` (Task 1): FOUND
- All grep markers verified (HB-02 / HB-03 / HB-04 / StrictMode cleanup / Pitfall 1)
- npm build / lint / test all exit 0; 15/15 vitest tests pass
- No new npm dependencies (`git diff ui/package.json` empty)

---
*Phase: 13-connectivity-state-heartbeat-hook*
*Completed: 2026-05-07*
