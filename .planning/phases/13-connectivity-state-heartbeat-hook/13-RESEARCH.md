# Phase 13: Connectivity State & Heartbeat Hook - Research

**Researched:** 2026-05-07
**Domain:** React 19 custom hook + browser polling + AbortSignal timeout + Page Visibility API + Vitest fake-timer testing
**Confidence:** HIGH

## Summary

Phase 13 adds a frontend-only `ConnectivityStatus` type and a `useHeartbeat` React hook that polls `GET /api/ping` (already shipped in Phase 12) and exposes a stable reachability signal. The goal is hysteretic offline detection: a single failure must not flip the UI offline, but three consecutive failures must, and a single success must restore online. Each request is bounded by `AbortSignal.timeout(3000)`. Polling pauses on `document.visibilityState === 'hidden'` and resumes on `visibilitychange`. Five Vitest tests must cover the online -> degraded -> offline -> online sequence in isolation.

The codebase is React 19 with Vite, TypeScript, and Vitest already installed (verified). The "Recommended Stack" Svelte block in `CLAUDE.md` is aspirational; the live UI is React. Treat the existing `ui/src/hooks/useTextSelection.ts` as the canonical hook style for this project.

**Primary recommendation:** Implement `useHeartbeat` as a single `useEffect`-driven hook in `ui/src/hooks/useHeartbeat.ts` that owns one interval, one in-flight `AbortController`, one consecutive-failure counter (kept in a `useRef`, not state, to avoid re-rendering on every tick), a single `ConnectivityStatus` `useState`, and one `visibilitychange` listener. Tests live in `ui/src/hooks/useHeartbeat.test.ts` using `vi.useFakeTimers()` + a mocked global `fetch`.

## Project Constraints (from CLAUDE.md)

These are mandatory directives the planner MUST honor:

1. **Test Coverage Requirements (BLOCKER):** A new module in `ui/src/**/*.ts` containing business logic MUST include a test task. The plan-checker will block on this. `useHeartbeat` is unambiguously business logic (state machine + timing + abort handling), so a Vitest task is required, not optional.
2. **Code quality gates:** `cargo fmt` and `cargo clippy -- -D warnings` are pre-commit-enforced — but only on Rust files. This phase touches no Rust; the relevant equivalent is `npm run lint` (eslint) and `npm test` (vitest run) in `ui/`.
3. **GSD workflow enforcement:** Edits flow through GSD commands. Phase 13 is already inside `/gsd-plan-phase`, so this is satisfied by virtue of being here.
4. **Single-binary distribution constraint:** Anything added to `ui/` is shipped via `rust-embed` from `ui/dist/`. There is no separate frontend deployment — bundle size matters. The hook adds zero new dependencies.

## User Constraints

CONTEXT.md does not exist for Phase 13 (no `gsd-discuss-phase` was run; verified via `ls .planning/phases/13-connectivity-state-heartbeat-hook/`). Locked decisions therefore come from STATE.md "Accumulated Context" and ROADMAP.md success criteria:

### Locked Decisions (from STATE.md and ROADMAP.md)

- **`ConnectivityStatus` is a parallel type to `AppState` — do NOT add `offline` as an `AppState` variant.** Merging these concerns is the primary anti-pattern STATE.md flags. `[VERIFIED: .planning/STATE.md line 70]`
- **Three consecutive failures required before declaring offline.** A single failure must not transition off `online`. `[VERIFIED: .planning/STATE.md line 72; ROADMAP.md success criterion 1]`
- **`AbortSignal.timeout(3000)` is the cancellation mechanism.** Not a manual `setTimeout` + `controller.abort()` sleeve. `[VERIFIED: ROADMAP.md success criterion 2; HB-04]`
- **Polling pauses when `document.visibilityState === 'hidden'`** and resumes on the next `visibilitychange`. `[VERIFIED: ROADMAP.md success criterion 3; HB-03]`
- **A single successful ping returns status to `online`** when recovering from offline (asymmetric hysteresis: 3 failures down, 1 success up). `[VERIFIED: ROADMAP.md success criterion 4]`
- **Polling cadence is 5 seconds.** `[VERIFIED: REQUIREMENTS.md HB-02]`
- **Vitest tests must cover online -> degraded -> offline -> online in isolation.** `[VERIFIED: ROADMAP.md success criterion 5]`

### Claude's Discretion

- Exact name and shape of the `ConnectivityStatus` type (string-literal union vs enum vs object). The codebase prefers string-literal unions (see `AnnotationType`, `Tab`, `ViewMode` in `ui/src/types.ts`).
- Where the type lives (`ui/src/types.ts` vs `ui/src/hooks/useHeartbeat.ts`). Existing convention: shared cross-component types go in `types.ts`; hook-internal types stay in the hook file.
- Naming of the failure counter and intermediate states. STATE.md uses "degraded" informally; the success criterion explicitly says "online -> degraded -> offline -> online".
- Whether the hook returns just a status or also exposes a manual `recheck()` callback. Phase 14 only needs the status, but exposing a recheck primitive costs nothing.
- Initial status value (`online` is the safe default — UI should not flash an offline banner before the first ping completes).

### Deferred Ideas (OUT OF SCOPE)

- **OFX-01 / OFX-02 (offline banner, button relabel)** — Phase 14 owns these. Phase 13 only produces the signal.
- **CLB-01 / CLB-02 (clipboard submit path)** — Phase 15.
- **OFX-04 graceful online recovery UX polish** — explicitly deferred per REQUIREMENTS.md line 113.
- **Exponential backoff between failed pings** — not in success criteria; cadence is fixed 5s.
- **Network-status integration via `navigator.onLine`** — not in requirements; the heartbeat is the source of truth.
- **Server-Sent Events / WebSocket replacement of polling** — out of scope, polling is the chosen mechanism.
- **Telemetry / failure logging beyond `console.warn`** — not requested.

## Phase Requirements

| ID    | Description                                                                                        | Research Support                                                                                                                                                                          |
|-------|----------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| HB-02 | Frontend polls `/api/ping` every 5s, requiring 3 consecutive failures before declaring offline    | State machine pattern (Pattern 2 below) + `setInterval` inside `useEffect` cleanup pattern (Pattern 1). Phase 12 verified the endpoint returns `200 OK` with non-`text/html` content-type. |
| HB-03 | Polling pauses when the browser tab is hidden and resumes on visibility                             | Page Visibility API guidance (Pitfall 3 + Pattern 3). `visibilitychange` listener registered in same `useEffect` as the interval; cleanup removes both.                                    |
| HB-04 | Each ping request uses `AbortSignal.timeout(3000)` to prevent hanging fetches                       | `AbortSignal.timeout()` is Baseline 2024, returns a `DOMException` with `err.name === 'TimeoutError'` (Firefox/Safari) or `'AbortError'` (Chromium quirk — Pitfall 1). Both must be treated as a failed ping.    |

## Architectural Responsibility Map

| Capability                          | Primary Tier      | Secondary Tier | Rationale                                                                                                                                              |
|-------------------------------------|-------------------|----------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|
| Polling `/api/ping` every 5s        | Browser / Client  | —              | The whole point is detecting that the local server may be gone; the work cannot live server-side.                                                       |
| Maintaining `ConnectivityStatus`    | Browser / Client  | —              | Pure client state. Never persisted, never sent to the server.                                                                                          |
| Aborting hung requests at 3s        | Browser / Client  | —              | `AbortSignal` is a browser API; the server is unaware.                                                                                                 |
| Pausing on hidden visibility        | Browser / Client  | —              | `document.visibilityState` is a window-only DOM API.                                                                                                   |
| Returning `200 OK` from `/api/ping` | API / Backend     | —              | Already implemented in Phase 12 (`src/server.rs:73-75`). Out of scope for Phase 13 except as the consumed contract.                                    |

**Tier sanity check:** No work belongs in the API tier. No work belongs in the SSR / static / database tier (this app has none of those). All Phase 13 work is in `ui/src/`.

## Standard Stack

### Core (already installed — verified via `ui/package.json` and `npm view`)

| Library      | Version                          | Purpose                                  | Why Standard                                                                                                                  |
|--------------|----------------------------------|------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| react        | ^19.2.4 (registry: 19.2.6)       | Component model + `useEffect`/`useState` | The UI is built on it; introducing anything else is out of scope.                                                              |
| typescript   | ~6.0.2                           | Static typing                            | Already configured (`tsconfig.app.json` with `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`).                  |
| vitest       | ^4.1.4 (registry: 4.1.5)         | Unit test runner                         | Already wired (`ui/package.json` "test" script: `vitest run`); existing test `ui/src/utils/serializeAnnotations.test.ts` verifies. |

### Supporting (zero new dependencies required)

| API                         | Origin             | Purpose                                                | When to Use                                                                                                                  |
|-----------------------------|--------------------|--------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------|
| `fetch`                     | Browser native     | Issue the GET to `/api/ping`                           | Standard request; matches existing `fetch('/api/plan')` etc. in `App.tsx`.                                                    |
| `AbortSignal.timeout(ms)`   | Browser native     | Auto-abort the request after 3000ms                     | The signal must be passed to `fetch` via `{ signal: AbortSignal.timeout(3000) }`. Throws on timeout — wrap in `try/catch`.    |
| `document.visibilityState`  | Browser native     | Detect tab hidden/visible state                         | Read at start of each tick; also listen to `visibilitychange` to resume immediately when the tab becomes visible.            |
| `setInterval` / `clearInterval` | Browser native | Drive the 5s tick                                       | Must be cleared in the `useEffect` cleanup; no other timer mechanism is needed.                                              |

### Test-only Supporting (NEW, optional)

| Library                                  | Latest version | Purpose                                | When to Use                                                                                                              |
|------------------------------------------|----------------|----------------------------------------|--------------------------------------------------------------------------------------------------------------------------|
| `@testing-library/react`                 | ^16.3.2 (verified via `npm view`) | `renderHook`, `act` for testing hooks | Only if a planner chooses to test by mounting; for this hook, a plain test file with vi mocks is enough and avoids the dep. |

**Recommendation: do NOT add `@testing-library/react`.** The hook can be tested by extracting the state machine into a pure function and testing that, plus a thin "wires up timers and listeners" smoke test. This honors the bundle-size rule from CLAUDE.md and the patterns-established for this codebase (the existing `serializeAnnotations.test.ts` is a pure-function test with no React harness). See "Architecture Patterns -> Pattern 2: Pure state-machine reducer" below.

### Alternatives Considered

| Instead of                                | Could Use                                      | Tradeoff                                                                                                                                          |
|-------------------------------------------|-----------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------|
| `AbortSignal.timeout(3000)`               | `new AbortController()` + manual `setTimeout` | Manual version requires extra `clearTimeout` bookkeeping; Baseline-2024 `AbortSignal.timeout` is shorter and is the literal text of REQ HB-04.    |
| `setInterval`                             | Recursive `setTimeout`                          | Recursive `setTimeout` avoids overlap-when-slow but adds complexity; with `AbortSignal.timeout(3000)` < 5s tick, overlap is structurally impossible. |
| Custom hook                               | Module-level singleton + React `useSyncExternalStore` | The store/subscription pattern is overkill — only one component (the offline banner in Phase 14) needs to read the status; it is a tree-local concern. |
| State counter in `useState`               | `useRef` for the failure count                  | `useRef` avoids re-render on every tick when the count changes from 0 to 1 to 2; only the `ConnectivityStatus` transition needs to trigger render.  |
| `react-use` / `usehooks-ts`               | Hand-rolled hook                                | Adds a dependency for a 60-line hook. Bundle size matters (single-binary distribution).                                                            |

**Installation:** None. Zero new packages.

**Version verification (run 2026-05-07):**

```bash
npm view vitest version
# 4.1.5 (installed: ^4.1.4 — within range)
npm view react version
# 19.2.6 (installed: ^19.2.4 — within range)
npm view @testing-library/react version
# 16.3.2 (NOT installed — recommend NOT adding)
```

## Architecture Patterns

### System Architecture Diagram

```
                    +-------------------------------+
                    |  React Component Tree         |
                    |  (App.tsx, Phase 14 banner)   |
                    +---------------+---------------+
                                    | reads ConnectivityStatus
                                    v
              +-------------------------------------+
              |   useHeartbeat() custom hook        |
              |                                     |
              |  +----------------------------+     |
              |  | useState<Status>           |     |
              |  | (only changes trigger      |     |
              |  |  re-render; transient      |     |
              |  |  fail counts do not)       |     |
              |  +-------------+--------------+     |
              |                |                    |
              |  +-------------v--------------+     |
              |  | useRef<failCount>          |     |
              |  +----------------------------+     |
              |                                     |
              |  +----------------------------+     |
              |  | useEffect (mount-only)     |     |
              |  |  - register visibilitychange listener |
              |  |  - start setInterval(5s)   |     |
              |  |  - return cleanup: clearInterval + removeEventListener + abort in-flight |
              |  +-------------+--------------+     |
              |                |                    |
              +----------------|--------------------+
                               |
                 every 5s tick |  if visibilityState === 'hidden': skip
                               v
                  +--------------------------+
                  | tick():                  |
                  |  fetch('/api/ping',      |
                  |    { signal:             |
                  |       AbortSignal        |
                  |       .timeout(3000) })  |
                  +-----------+--------------+
                              |
              +---------------+----------------+
              v                                v
       +-----------------+              +-----------------+
       | success (2xx)   |              | failure         |
       | failCount = 0   |              | (network error, |
       | status -> online|              |  timeout, !2xx) |
       +-----------------+              | failCount += 1  |
                                        | if >= 3:        |
                                        |   status -> off |
                                        +-----------------+
                              ^
                              | resume on
                              | visibilitychange
                              | (visible)
                              |
                +-----------------------------+
                | document.visibilityState    |
                | listener                    |
                +-----------------------------+

                +-----------------------------+
                | Backend: GET /api/ping      |
                | (Phase 12, src/server.rs)   |
                | returns 200 OK              |
                +-----------------------------+
```

### Recommended Project Structure

The existing `ui/src/` layout is the right one. No new folders.

```
ui/src/
├── hooks/
│   ├── useTextSelection.ts          # existing
│   ├── useHeartbeat.ts              # NEW — phase 13 deliverable
│   └── useHeartbeat.test.ts         # NEW — phase 13 deliverable
├── types.ts                         # ADD: export ConnectivityStatus
├── App.tsx                          # NOT modified in phase 13 (consumer is phase 14)
└── ...
```

### Pattern 1: Single-`useEffect` polling hook with full cleanup

**What:** Encapsulate timer + listener + in-flight request inside one `useEffect` with an empty dependency array. The cleanup function clears the interval, removes the listener, and aborts any in-flight request via a stable `AbortController` reference.

**When to use:** Every browser-API hook that owns timers or listeners. This is the prevailing React idiom and matches the cleanup style of the existing `useTextSelection` hook (`document.addEventListener('mouseup', capture)` paired with `document.removeEventListener('mouseup', capture)` in the cleanup).

**Example:**

```ts
// Source: codebase pattern (ui/src/hooks/useTextSelection.ts) + React docs (verified)
import { useEffect, useRef, useState } from 'react'

export type ConnectivityStatus = 'online' | 'offline'

export function useHeartbeat(): ConnectivityStatus {
  const [status, setStatus] = useState<ConnectivityStatus>('online')
  const failCountRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let cancelled = false

    async function tick() {
      if (document.visibilityState === 'hidden') return
      // Cancel any prior in-flight request before issuing a new one.
      // Defense-in-depth — AbortSignal.timeout(3000) < 5s interval makes
      // overlap structurally impossible, but be explicit.
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller

      // Combine our own controller with the 3s timeout signal so cleanup
      // can still abort even if the timeout has not yet fired.
      const timeoutSignal = AbortSignal.timeout(3000)
      const signal = AbortSignal.any
        ? AbortSignal.any([controller.signal, timeoutSignal])
        : timeoutSignal

      try {
        const res = await fetch('/api/ping', { signal })
        if (cancelled) return
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        failCountRef.current = 0
        setStatus((prev) => (prev === 'online' ? prev : 'online'))
      } catch (err) {
        if (cancelled) return
        failCountRef.current += 1
        if (failCountRef.current >= 3) {
          setStatus((prev) => (prev === 'offline' ? prev : 'offline'))
        }
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        // Optional: fire an immediate tick so the user does not wait
        // up to 5s for the next interval after returning to the tab.
        void tick()
      }
    }

    // Initial tick on mount
    void tick()
    const id = window.setInterval(tick, 5000)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      abortControllerRef.current?.abort()
    }
  }, [])

  return status
}
```

`[VERIFIED: codebase grep — same listener add/remove pattern exists in ui/src/hooks/useTextSelection.ts:159-162]`

### Pattern 2: Pure state-machine reducer (testable in isolation)

**What:** Extract the (status, failCount) -> (status, failCount) transition into a pure function. Test that function directly with Vitest, then a tiny smoke test for the timer wiring.

**When to use:** When the state machine has more than two transitions and the test plan says "online -> degraded -> offline -> online" — this is exactly that case. Pure functions are the most reliable way to satisfy the success criterion #5.

**Example:**

```ts
// useHeartbeat.ts (top of file, exported)
export type ConnectivityStatus = 'online' | 'offline'

export interface HeartbeatState {
  status: ConnectivityStatus
  failCount: number
}

export const initialHeartbeatState: HeartbeatState = {
  status: 'online',
  failCount: 0,
}

export function nextHeartbeatState(
  state: HeartbeatState,
  event: { type: 'success' } | { type: 'failure' }
): HeartbeatState {
  if (event.type === 'success') {
    return { status: 'online', failCount: 0 }
  }
  // failure
  const failCount = state.failCount + 1
  if (failCount >= 3) {
    return { status: 'offline', failCount }
  }
  return { status: state.status, failCount }
}
```

The hook then becomes a thin wrapper that calls `nextHeartbeatState` from inside `tick()`. The test file imports `nextHeartbeatState` and `initialHeartbeatState` and exercises the four-step sequence with no DOM, no timers, no fetch.

`[ASSUMED]`: This pattern is recommended based on the existing `serializeAnnotations.ts` / `serializeAnnotations.test.ts` split — pure logic in one file, test in a sibling file. It is project convention, but no other React hook in this codebase uses a reducer split, so the planner has discretion to inline the logic if preferred.

### Pattern 3: Visibility-aware skip + immediate-resume

**What:** Inside the tick, check `document.visibilityState === 'hidden'` and bail. Separately, register a `visibilitychange` listener that fires a tick immediately when the tab returns to `visible`.

**When to use:** Any background polling that should stop wasting bandwidth/battery when the user is not looking.

**Why both checks:** The interval continues to fire while hidden (browsers throttle background timers but do not pause them), so the in-tick guard is what actually prevents the network call. The listener exists to give a snappy UX on resume rather than waiting up to 5 s for the next tick.

`[VERIFIED: web.dev/articles/pagevisibility-intro — listener pattern is canonical]`

### Pattern 4: Handle both `TimeoutError` and `AbortError` as "failure"

**What:** In the `catch` block, do not branch on `err.name`. Treat any thrown exception as a ping failure.

**Why:** Chromium-based browsers (Chrome, Edge, and any Electron-style WebView) historically throw `AbortError` instead of the spec-correct `TimeoutError` when `AbortSignal.timeout()` fires. Firefox throws `TimeoutError`. Safari behavior matches Firefox. Whether Chromium has converged to spec by 2026-05 is uncertain — see Pitfall 1.

`[VERIFIED: github.com/mdn/browser-compat-data#20381]`

### Anti-Patterns to Avoid

- **Adding `offline` as an `AppState` variant.** STATE.md explicitly flags this as the primary anti-pattern. `ConnectivityStatus` is a parallel concern; `AppState` describes the review lifecycle, not server reachability. `[VERIFIED: .planning/STATE.md line 70]`
- **Storing the failure counter in `useState`.** Every increment would trigger a render. Use `useRef` and only set state on the threshold crossing.
- **Calling `setStatus('online')` on every successful ping.** React 19 with `Object.is` equality already bails out, but going through `setStatus((prev) => prev === 'online' ? prev : 'online')` (returning the same reference) is the explicit guard and reads more clearly.
- **Forgetting cleanup.** React 19 StrictMode double-invokes effects in dev. Without cleanup, two intervals stack and the test would observe double the expected ping rate. Confirmed in `ui/src/main.tsx` — `<StrictMode>` is active.
- **Using `navigator.onLine` as the source of truth.** It reflects OS-level network status, not local-server reachability. Phase 13 cares about whether the local axum process is alive, which is exactly the case `navigator.onLine` cannot detect.
- **Conditional cleanup based on `cancelled`.** The cleanup function should always run all of its disposal logic; the `cancelled` boolean is only used inside the async tick to skip state updates after unmount.

## Don't Hand-Roll

| Problem                                  | Don't Build                                          | Use Instead                                            | Why                                                                                                                          |
|------------------------------------------|------------------------------------------------------|--------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------|
| Timing out a fetch                       | `setTimeout` + manual `controller.abort()`           | `AbortSignal.timeout(3000)`                            | One-line, no bookkeeping, exact text of HB-04. Baseline 2024 — supported in all targets.                                     |
| Combining cleanup-abort + timeout-abort  | Boolean flags around `controller.abort()`            | `AbortSignal.any([cleanup, AbortSignal.timeout(ms)])`  | `AbortSignal.any` is also Baseline; if it is unavailable in a target browser, fall back to passing only the timeout signal. |
| Visibility detection                     | `window.blur` / `window.focus`                        | `document.visibilityState` + `visibilitychange`         | `blur`/`focus` fire when the window loses keyboard focus, not when the tab is hidden — wrong semantic.                       |
| Polling with manual loop control         | While loop + `await sleep`                           | `setInterval` + `clearInterval` in cleanup              | React's effect lifecycle naturally maps to `setInterval`'s register/dispose pair.                                            |
| Subscription / store for one consumer    | `useSyncExternalStore` + module singleton             | Plain `useState` in a hook                              | The status only flows to one component (Phase 14 banner). A store is overkill and forces extra teardown logic.               |
| Network-status detection                 | Custom retry-with-backoff scheduler                   | Fixed 5s interval + 3-failure threshold                 | The requirement is fixed cadence. Backoff would be out of scope.                                                              |

**Key insight:** This hook is small. The pitfalls are not in size — they are in (a) not handling Chromium's wrong error name, (b) double-mount in StrictMode, and (c) the state-machine asymmetry (3 down, 1 up). Hand-rolling is fine; what matters is using the right *primitives* (`AbortSignal.timeout`, `visibilitychange`).

## Common Pitfalls

### Pitfall 1: Chromium throws `AbortError`, not `TimeoutError`

**What goes wrong:** Code that branches on `err.name === 'TimeoutError'` to decide whether the failure was a timeout vs a network error will silently misclassify all timeouts in Chrome/Edge/Electron-based browsers.

**Why it happens:** Chromium implementations historically alias `AbortSignal.timeout` to the manual `controller.abort()` path internally, producing an `AbortError` even though the WHATWG spec says the reason should be `TimeoutError`. Firefox and Safari throw `TimeoutError` correctly.

**How to avoid:** Do not branch on `err.name`. Treat any thrown exception in the `tick()` function as a failure. The 3-failure threshold absorbs transient errors regardless of category.

**Warning signs:** Tests that pass under jsdom (which uses node's spec-compliant implementation) but flake in real Chrome end-to-end runs. Console messages like "AbortError: signal is aborted without reason" with no clear cause.

`[VERIFIED: github.com/mdn/browser-compat-data#20381]`

### Pitfall 2: Vitest fake timers freeze microtask queue progression

**What goes wrong:** A test calls `vi.useFakeTimers()` then `vi.advanceTimersByTime(5000)` and expects the fetch promise to resolve and update state. Nothing happens.

**Why it happens:** `vi.advanceTimersByTime` only fast-forwards macrotasks (`setTimeout`/`setInterval`). Microtasks (promise continuations) only run when the JS stack unwinds. The pending `await res.ok` callback never runs, so neither does `setStatus`.

**How to avoid:**
- Prefer `await vi.advanceTimersByTimeAsync(5000)` — it interleaves microtask flushing with timer advancement.
- Mock `fetch` to return *resolved* promises (`Promise.resolve(...)`) rather than ones that need real I/O.
- Be explicit about the order: schedule the fetch mock, advance timers, then `await Promise.resolve()` (or directly `await advanceTimersByTimeAsync`) before asserting.
- Configure `vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] })` if `queueMicrotask` interference is suspected (excluding it from the fake list).

**Warning signs:** Test asserts that status changed but it is still the initial value; coverage tools show the failure-count branch never runs.

`[CITED: vitest.dev/api/vi.html — advanceTimersByTimeAsync; dheerajmurali.com/blog/vitest-usefaketimer-and-msw]`

### Pitfall 3: StrictMode double-invocation creates two intervals

**What goes wrong:** In development, React 19 StrictMode runs effects twice. Without cleanup, two `setInterval` instances exist and the server sees pings every 2.5 s on average (interleaved). In tests, the same double-mount produces double the expected fetch call count and breaks assertion math.

**Why it happens:** StrictMode mounts -> unmounts -> mounts again to surface effects that do not handle the unmount path. The first interval is leaked unless the cleanup clears it.

**How to avoid:** Always return a cleanup from the `useEffect`. The cleanup must:
1. `clearInterval(id)`
2. `removeEventListener('visibilitychange', onVisibilityChange)`
3. `abortControllerRef.current?.abort()` to terminate any pending fetch
4. Set the local `cancelled` flag so any tick *currently mid-await* will skip its `setStatus` call.

**Warning signs:** Test asserts `mockFetch.toHaveBeenCalledTimes(1)` but receives 2.

`[VERIFIED: ui/src/main.tsx — StrictMode is active in this project]`

### Pitfall 4: `setInterval` does not stop when the tab is hidden

**What goes wrong:** Engineers expect that hiding the tab pauses the interval. It does not — browsers may *throttle* (e.g. minimum 1s in Chrome) but do not pause. Without an explicit visibility check, the hook keeps issuing fetches in the background.

**Why it happens:** The Page Visibility API is a separate, opt-in mechanism. There is no automatic linkage between `setInterval` and `document.hidden`.

**How to avoid:** Check `document.visibilityState === 'hidden'` at the top of the tick function and return early if hidden (success criterion #3 demands this). Listen to `visibilitychange` to fire a fresh tick immediately on resume.

**Warning signs:** A user reporting the tab is "still talking to localhost" while in another window — visible in DevTools Network tab while the tab is in the background.

`[VERIFIED: web.dev/articles/pagevisibility-intro]`

### Pitfall 5: `prerender` and bfcache visibility states

**What goes wrong:** `document.visibilityState` can be `'prerender'` (some browsers preload pages) or the document can be restored from the back-forward cache. The naive check `visibilityState !== 'hidden'` would treat `prerender` as a permission to ping — sending pings while the user has not even opened the page.

**Why it happens:** The valid `visibilityState` values are `'visible'`, `'hidden'`, `'prerender'`, `'unloaded'`. Most code only thinks about the first two.

**How to avoid:** Invert the check — `if (document.visibilityState !== 'visible') return` — so any non-visible state pauses polling. Phase 12's endpoint is cheap, so this is not a real bug, but the inverted form reads more conservatively.

**Warning signs:** Server logs show ping traffic before the user-facing tab is opened (back-forward cache restore + prerender).

`[VERIFIED: developer.mozilla.org/en-US/docs/Web/API/Document/visibilityState]`

### Pitfall 6: `AbortSignal.timeout` time pauses in bfcache

**What goes wrong:** The 3-second timeout is "active time," not wall-clock time. If the document goes into bfcache during a pending fetch, the timeout pauses. On resume, the timeout resumes from where it was.

**Why it happens:** This is by design — the spec defines the timeout as "active rather than elapsed time."

**How to avoid:** Combine the timeout signal with a manual `AbortController.abort()` in the cleanup so unmount/bfcache do not leak in-flight requests. (This is exactly the `AbortSignal.any([controller.signal, timeoutSignal])` pattern in Pattern 1.)

**Warning signs:** A request started before backgrounding completes "successfully" minutes later when the user returns to the tab — in this hook, success criterion #4 says one success returns to online, so a stale success from before the user backgrounded would incorrectly clear an offline state.

`[VERIFIED: developer.mozilla.org AbortSignal/timeout_static]`

### Pitfall 7: Initial-status flash

**What goes wrong:** If the hook is instantiated with `useState<ConnectivityStatus>('offline')` and the first ping needs ~5s, the offline banner from Phase 14 flashes for 5 s before vanishing.

**Why it happens:** Initial-state choice; Phase 14 will derive its render from this hook's return value.

**How to avoid:** Initialize as `'online'`. The first tick is fired immediately on mount (not after a 5s delay) by calling `void tick()` at the end of the effect setup — that way, if the server really is down, the offline transition takes ~3 ticks * ~5s = ~15 s but the UI never falsely *displays* offline at startup.

**Warning signs:** Phase 14 review feedback that the banner flashes on every page load.

## Runtime State Inventory

This is a greenfield phase (creating a new hook + new type), not a rename/refactor/migration. **Section omitted per template guidance** — there is no preexisting runtime state to inventory.

## Code Examples

### Verified pattern: hook test using fake timers and mocked fetch

```ts
// ui/src/hooks/useHeartbeat.test.ts
// Source: vitest.dev/guide/mocking/timers + project pattern (serializeAnnotations.test.ts)
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextHeartbeatState, initialHeartbeatState } from './useHeartbeat'

describe('nextHeartbeatState (pure state machine)', () => {
  it('online -> still online after one failure', () => {
    const s1 = nextHeartbeatState(initialHeartbeatState, { type: 'failure' })
    expect(s1.status).toBe('online')
    expect(s1.failCount).toBe(1)
  })

  it('online -> still online after two failures (degraded zone)', () => {
    const s1 = nextHeartbeatState(initialHeartbeatState, { type: 'failure' })
    const s2 = nextHeartbeatState(s1, { type: 'failure' })
    expect(s2.status).toBe('online')
    expect(s2.failCount).toBe(2)
  })

  it('online -> offline after three consecutive failures', () => {
    let s = initialHeartbeatState
    s = nextHeartbeatState(s, { type: 'failure' })
    s = nextHeartbeatState(s, { type: 'failure' })
    s = nextHeartbeatState(s, { type: 'failure' })
    expect(s.status).toBe('offline')
    expect(s.failCount).toBe(3)
  })

  it('offline -> online after one success', () => {
    const offline = { status: 'offline' as const, failCount: 5 }
    const recovered = nextHeartbeatState(offline, { type: 'success' })
    expect(recovered.status).toBe('online')
    expect(recovered.failCount).toBe(0)
  })

  it('any success resets the failure counter', () => {
    const partial = { status: 'online' as const, failCount: 2 }
    const recovered = nextHeartbeatState(partial, { type: 'success' })
    expect(recovered.failCount).toBe(0)
  })
})
```

### Verified pattern: integration smoke test for the hook

```ts
// Source: vitest.dev/guide/mocking/timers (advanceTimersByTimeAsync)
// This is the optional "wiring" test — only worth writing if @testing-library/react is added.
// If not added, the pure-function tests above are sufficient for HB-02.

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useHeartbeat } from './useHeartbeat'

describe('useHeartbeat (integration)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('starts online and stays online when fetch succeeds', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 })
    )

    const { result } = renderHook(() => useHeartbeat())
    expect(result.current).toBe('online')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(fetchSpy).toHaveBeenCalledWith('/api/ping', expect.anything())
    expect(result.current).toBe('online')
  })

  it('transitions to offline after three consecutive failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'))

    const { result } = renderHook(() => useHeartbeat())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000) // tick 1
      await vi.advanceTimersByTimeAsync(5000) // tick 2
      await vi.advanceTimersByTimeAsync(5000) // tick 3
    })
    expect(result.current).toBe('offline')
  })
})
```

`[ASSUMED]`: This integration test pattern relies on `@testing-library/react`. If the planner chooses not to add it (recommended), drop this file and rely on the pure-function tests in `useHeartbeat.test.ts`.

## State of the Art

| Old Approach                                            | Current Approach                                        | When Changed       | Impact                                                                                                              |
|---------------------------------------------------------|---------------------------------------------------------|--------------------|---------------------------------------------------------------------------------------------------------------------|
| `setTimeout` + manual `AbortController.abort()`         | `AbortSignal.timeout(ms)`                                 | Baseline 2024 (Apr) | One line, no orphan timers. Recommended.                                                                            |
| Branching on `err.name === 'TimeoutError'`              | Treat any caught exception as a failure                   | Ongoing             | Avoids Chromium-vs-Firefox semantic divergence.                                                                    |
| `useEffect(() => { fetch(...) }, [])` (no cleanup)      | `useEffect` with cleanup that aborts in-flight requests   | React 18 (2022)     | Required for StrictMode correctness; React 19 keeps this contract.                                                  |
| `react-use` / `usehooks-ts` for visibility              | Inline `document.addEventListener('visibilitychange', ...)` | Ongoing             | Zero-dep, project bundle policy.                                                                                    |

**Deprecated/outdated:**
- Polling with `setTimeout` recursion to "prevent overlap" — superseded by `AbortSignal.timeout` < interval guaranteeing no overlap.
- `window.addEventListener('focus' / 'blur', ...)` for tab-switch detection — wrong semantic; `visibilitychange` is the correct API.

## Validation Architecture

> Skipped — `workflow.nyquist_validation: false` in `.planning/config.json` (verified line 12).

## Security Domain

> Skipped — `security_enforcement` is not present in config and this phase introduces no auth, input validation surface, or secrets. The hook reads from a local-only endpoint already shipped (Phase 12) on `127.0.0.1`. No new attack surface.

## Environment Availability

| Dependency      | Required By                  | Available | Version            | Fallback                                     |
|-----------------|------------------------------|-----------|--------------------|----------------------------------------------|
| Node + npm      | Vite/Vitest                  | yes       | (project local)    | —                                            |
| `vitest`        | Test execution               | yes       | 4.1.4 (registry 4.1.5) | —                                          |
| `react`         | Hook API                     | yes       | 19.2.4 (registry 19.2.6) | —                                        |
| Local axum binary running on 127.0.0.1 | Manual smoke test of `/api/ping` | yes (shipped Phase 12) | — | — |
| `@testing-library/react` | Optional integration test of the hook | NO | — | Use pure-function tests on `nextHeartbeatState` instead — recommended |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** `@testing-library/react` is the only candidate; the recommended approach avoids it entirely by extracting a pure state-machine function.

## Assumptions Log

| #  | Claim                                                                                                                                              | Section                            | Risk if Wrong                                                                                                                       |
|----|----------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------|
| A1 | Project convention is to split logic into a pure function tested separately rather than test the hook with `@testing-library/react`.              | Pattern 2 / Code Examples          | Reviewer prefers integration tests; planner can add `@testing-library/react` instead. Low risk — both patterns satisfy HB-02/03/04. |
| A2 | Chromium has not converged to throw spec-correct `TimeoutError` by 2026-05.                                                                       | Pitfall 1                          | If Chromium has fixed it, the "treat all errors as failure" recommendation still works; it is just over-defensive.                  |
| A3 | The hook's status only feeds Phase 14's banner — no other consumer is planned, so a `useSyncExternalStore`-backed module is unnecessary.          | Standard Stack -> Alternatives Considered | If multiple distant components later need the status, refactor to a context or store at that point — not blocking Phase 13.      |
| A4 | A 5 s polling cadence is correct (REQUIREMENTS.md HB-02 line 82).                                                                                  | User Constraints / Phase Requirements | Verified literal; no risk.                                                                                                          |
| A5 | The first tick should fire immediately on mount (not after the first 5 s delay), to surface real reachability promptly without a banner flash.    | Pitfall 7                          | If the planner chooses to delay the first tick, the offline-detection time at startup grows by 5 s — a UX preference, not a defect. |

## Open Questions (RESOLVED)

All three questions are advisory — the planner internalized each outcome into Plans 13-01 and 13-02. Q3's recommendation was not adopted; rationale is recorded inline below.

1. **Should the hook also expose a manual `recheck()` function?**
   - What we know: Phase 14 only renders based on the status; nothing else triggers a recheck today.
   - What's unclear: A future "Reconnect now" button (OFX-04, deferred) would need this.
   - RESOLVED: Do not add `recheck()` in Phase 13. Add it when OFX-04 lands. (Plan 13-02 returns `ConnectivityStatus` only.)

2. **Should `ConnectivityStatus` include a third `'checking'` state?**
   - What we know: Success criteria use only `online`/`offline`. STATE.md uses "degraded" only as descriptive prose, not a discrete external state.
   - What's unclear: Phase 14 may want to render an "checking..." indicator while degraded (1-2 failures so far).
   - RESOLVED: Two states only (`online` | `offline`). The degraded period is internally tracked via `failCount` but not exposed. If Phase 14 wants more granularity, expose it then — adding now is YAGNI. (Plan 13-01 codifies the two-state union and forbids `'checking'`/`'degraded'` as public variants.)

3. **Should the hook log failures via `console.warn`?**
   - What we know: No requirement either way.
   - What's unclear: A user reporting "the offline banner came on" might want the dev console to show why.
   - RESOLVED: **Recommendation NOT adopted.** Plan 13-02 explicitly chose to omit `console.warn` to keep the hook surface minimal — no requirement mandates it, and the existing UI codebase uses bare `console` calls sparingly. Reintroduce when OFX-04 / banner-debug work surfaces a real need.

## Sources

### Primary (HIGH confidence)
- MDN: AbortSignal.timeout() — error type, browser support, bfcache behavior. https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static
- MDN: Document.visibilitychange event — semantics, edge cases (prerender, iframe, unloaded). https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event
- MDN: Page Visibility API. https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
- web.dev: Using the Page Visibility API. https://web.dev/articles/pagevisibility-intro
- Vitest: Timers guide. https://vitest.dev/guide/mocking/timers
- Vitest: vi API reference (advanceTimersByTimeAsync, runOnlyPendingTimers). https://vitest.dev/api/vi.html
- Codebase: `ui/src/hooks/useTextSelection.ts` (existing hook style — listener add/remove pattern in cleanup)
- Codebase: `ui/src/utils/serializeAnnotations.test.ts` (existing pure-function test style)
- Codebase: `ui/src/main.tsx` (StrictMode confirmation)
- Codebase: `src/server.rs:73-75` (Phase 12 `/api/ping` handler — endpoint contract verified)
- `.planning/STATE.md` lines 70-72 (locked v0.5.0 decisions)
- `.planning/REQUIREMENTS.md` HB-01 through HB-04
- `.planning/ROADMAP.md` Phase 13 success criteria

### Secondary (MEDIUM confidence)
- GitHub: mdn/browser-compat-data #20381 — Chromium AbortError vs TimeoutError discrepancy (issue closed but resolution status not fully verified for 2026 browser releases). https://github.com/mdn/browser-compat-data/issues/20381
- dheerajmurali.com — vitest fake timers + MSW pitfall (toFake configuration). Cross-checked against Vitest official guide.

### Tertiary (LOW confidence)
- None — no LOW-confidence claims drove a recommendation.

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — verified via `npm view` against installed `package.json` versions.
- Architecture / Patterns: HIGH — patterns lifted directly from existing project files plus official MDN/Vitest docs.
- Pitfalls: HIGH — every pitfall is backed by an official source URL or a reproducible codebase-grep observation.
- State machine asymmetry (3 fail / 1 success): HIGH — literal from STATE.md and ROADMAP.md.
- Chromium error-name behavior in 2026: MEDIUM — issue marked closed but exact runtime-of-record behavior on bleeding-edge Chrome is not retested here.

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (30 days — stable web APIs, mature Vitest API; only Chromium error-name story is volatile, mitigated by recommending error-name-agnostic handling).
