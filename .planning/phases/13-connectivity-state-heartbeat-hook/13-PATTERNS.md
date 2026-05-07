# Phase 13: Connectivity State & Heartbeat Hook - Pattern Map

**Mapped:** 2026-05-07
**Files analyzed:** 4 (3 new + 1 type addition)
**Analogs found:** 4 / 4

## Directory Convention Note

The orchestrator prompt specifies new files under `ui/src/lib/`, but the live codebase has no `ui/src/lib/` directory — pure utility code currently lives under `ui/src/utils/` (see `ui/src/utils/serializeAnnotations.ts`). The planner should choose one of:

1. **Recommended:** Place `connectivity.ts` + `connectivity.test.ts` in `ui/src/utils/` to match the existing convention exactly. (Same role + same data flow as `serializeAnnotations.ts`.)
2. **If a `lib/` directory is intentional:** Create `ui/src/lib/` as a new sibling to `utils/`. This introduces a new layout convention; document the rationale in the plan.

This document assumes option 1 in pattern excerpts (matches existing imports like `import type { Annotation } from '../types'`). If option 2 is chosen, the relative-path imports become `'../types'` -> still `'../types'` (both `lib/` and `utils/` are one level deep), so excerpts remain valid.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `ui/src/lib/connectivity.ts` (or `ui/src/utils/connectivity.ts`) | utility / pure reducer | transform (state -> state) | `ui/src/utils/serializeAnnotations.ts` | exact (same role, same data flow, same module style) |
| `ui/src/lib/connectivity.test.ts` (or `ui/src/utils/connectivity.test.ts`) | test | transform assertion | `ui/src/utils/serializeAnnotations.test.ts` | exact (Vitest pure-function tests, same project) |
| `ui/src/hooks/useHeartbeat.ts` | hook (browser API + state) | event-driven (timer + visibility) -> request-response (fetch) | `ui/src/hooks/useTextSelection.ts` | role-match (only existing hook in repo; uses same single-`useEffect` cleanup style) |
| `ui/src/hooks/useHeartbeat.test.ts` (optional) | test | hook integration | none (no existing hook test in repo) | no analog — see "No Analog Found" below |
| `ui/src/types.ts` (modified — append `ConnectivityStatus`) | type module | static type export | existing `AnnotationType`, `Tab`, `ViewMode` declarations in same file | exact (literal-union convention) |

## Pattern Assignments

### `ui/src/lib/connectivity.ts` (or `ui/src/utils/connectivity.ts`) — pure reducer

**Analog:** `ui/src/utils/serializeAnnotations.ts`

**Imports pattern** (lines 1-1):

```typescript
import type { Annotation } from '../types'
```

Note `import type` — required by `tsconfig.app.json` `"verbatimModuleSyntax": true`. Same path style applies for `ConnectivityStatus`: if the type lives in `ui/src/types.ts`, import as `import type { ConnectivityStatus } from '../types'`. If the type is co-located with the reducer (research suggests this is fine for hook-internal types), no import needed.

**Module structure pattern** (lines 1-9, 11-15):

```typescript
import type { Annotation } from '../types'

function typeLabel(type: Annotation['type']): string {
  switch (type) {
    case 'comment': return 'COMMENT'
    case 'delete':  return 'DELETE'
    case 'replace': return 'REPLACE'
  }
}

export function serializeAnnotations(
  denyText: string,
  overallComment: string,
  annotations: Annotation[]
): string {
```

Convention: **named exports** (no default export), **discriminated `switch`** on string-literal unions for exhaustiveness, **private helpers above the export**. Apply to `nextHeartbeatState`:

```typescript
// connectivity.ts — applying the analog pattern
export type ConnectivityStatus = 'online' | 'offline'

export interface HeartbeatState {
  status: ConnectivityStatus
  failCount: number
}

export const initialHeartbeatState: HeartbeatState = {
  status: 'online',
  failCount: 0,
}

export type HeartbeatEvent = { type: 'success' } | { type: 'failure' }

export function nextHeartbeatState(
  state: HeartbeatState,
  event: HeartbeatEvent,
): HeartbeatState {
  switch (event.type) {
    case 'success':
      return { status: 'online', failCount: 0 }
    case 'failure': {
      const failCount = state.failCount + 1
      if (failCount >= 3) return { status: 'offline', failCount }
      return { status: state.status, failCount }
    }
  }
}
```

**Why this shape:**
- `noFallthroughCasesInSwitch: true` (tsconfig line 22) means each `case` must `return`/`break`.
- `erasableSyntaxOnly: true` (tsconfig line 21) forbids `enum` and parameter properties — string-literal unions only. Matches `AnnotationType`, `Tab`, `ViewMode` already in `types.ts`.
- Named exports only — `serializeAnnotations.ts` has no default export.

---

### `ui/src/lib/connectivity.test.ts` (or `ui/src/utils/connectivity.test.ts`) — Vitest tests

**Analog:** `ui/src/utils/serializeAnnotations.test.ts`

**Imports pattern** (lines 1-3):

```typescript
import { describe, it, expect } from 'vitest'
import { serializeAnnotations } from './serializeAnnotations'
import type { Annotation } from '../types'
```

Convention: import test primitives from `vitest`, sibling import for the unit under test, `import type` for shared types.

**Test structure pattern** (lines 5-101):

```typescript
describe('serializeAnnotations', () => {
  it('Test 1: returns empty string when everything is empty', () => {
    expect(serializeAnnotations('', '', [])).toBe('')
  })

  it('Test 2: single denyText produces numbered header', () => {
    const result = serializeAnnotations('Please revise this.', '', [])
    expect(result).toContain('# Plan Feedback')
    expect(result).toContain('1 piece of feedback')
    expect(result).toContain('## 1. Please revise this.')
  })
  // ... Test 3..10 each follows the "Test N: <one-line description>" pattern
})
```

**Convention details to copy verbatim:**
- Single top-level `describe(<name-of-export>, () => { ... })`.
- Each `it()` title prefixed with `Test N:` and a short imperative-tense description.
- Pure-function tests — no mocks, no fakes, no DOM, no timers. Direct call + `expect`.
- Tests are numbered sequentially across the whole file (10 tests total in the analog).

**Apply to `connectivity.test.ts`:**

```typescript
import { describe, it, expect } from 'vitest'
import {
  nextHeartbeatState,
  initialHeartbeatState,
  type HeartbeatState,
} from './connectivity'

describe('nextHeartbeatState', () => {
  it('Test 1: one failure stays online (failCount 1)', () => {
    const next = nextHeartbeatState(initialHeartbeatState, { type: 'failure' })
    expect(next.status).toBe('online')
    expect(next.failCount).toBe(1)
  })

  it('Test 2: two failures stay online (failCount 2)', () => {
    let s: HeartbeatState = initialHeartbeatState
    s = nextHeartbeatState(s, { type: 'failure' })
    s = nextHeartbeatState(s, { type: 'failure' })
    expect(s.status).toBe('online')
    expect(s.failCount).toBe(2)
  })

  it('Test 3: three consecutive failures transition to offline', () => {
    let s: HeartbeatState = initialHeartbeatState
    s = nextHeartbeatState(s, { type: 'failure' })
    s = nextHeartbeatState(s, { type: 'failure' })
    s = nextHeartbeatState(s, { type: 'failure' })
    expect(s.status).toBe('offline')
    expect(s.failCount).toBe(3)
  })

  it('Test 4: single success from offline returns to online and resets failCount', () => {
    const offline: HeartbeatState = { status: 'offline', failCount: 5 }
    const recovered = nextHeartbeatState(offline, { type: 'success' })
    expect(recovered.status).toBe('online')
    expect(recovered.failCount).toBe(0)
  })

  it('Test 5: success while degraded resets failCount without status change', () => {
    const partial: HeartbeatState = { status: 'online', failCount: 2 }
    const recovered = nextHeartbeatState(partial, { type: 'success' })
    expect(recovered.status).toBe('online')
    expect(recovered.failCount).toBe(0)
  })
})
```

This satisfies ROADMAP.md success criterion #5 ("online -> degraded -> offline -> online in isolation") with five pure tests, no DOM, no fake timers, no `@testing-library/react`.

---

### `ui/src/hooks/useHeartbeat.ts` — React hook

**Analog:** `ui/src/hooks/useTextSelection.ts`

**Imports pattern** (line 1):

```typescript
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
```

Convention: single-line React import combining hooks + types via `type` modifier (required by `verbatimModuleSyntax: true`). Apply to `useHeartbeat`:

```typescript
import { useEffect, useRef, useState } from 'react'
import {
  nextHeartbeatState,
  initialHeartbeatState,
  type ConnectivityStatus,
  type HeartbeatState,
} from '../lib/connectivity'   // or '../utils/connectivity' depending on directory choice
```

**Single-`useEffect` browser-API setup/cleanup pattern** (lines 98-163):

```typescript
useEffect(() => {
    // Capture selection on mouseup (after drag completes).
    const capture = (e: MouseEvent) => {
      // ... handler body ...
    }

    document.addEventListener('mouseup', capture)
    return () => {
      document.removeEventListener('mouseup', capture)
    }
}, [containerRef])
```

**Critical pattern elements to copy:**
1. Define the handler **inside** the effect (closes over fresh refs/state setters each effect run).
2. Register listener at the bottom of the effect setup.
3. Return a cleanup that removes the same listener with the **same function reference**.
4. Dependency array — empty `[]` for mount-only effects (this hook), or stable refs only.

**Apply to `useHeartbeat` (full pattern, drawing on Pattern 1 from RESEARCH.md):**

```typescript
import { useEffect, useRef, useState } from 'react'
import {
  nextHeartbeatState,
  initialHeartbeatState,
  type ConnectivityStatus,
  type HeartbeatState,
} from '../lib/connectivity'

const POLL_INTERVAL_MS = 5000
const REQUEST_TIMEOUT_MS = 3000
const FAILURE_THRESHOLD = 3 // documented; the threshold lives in the reducer

export function useHeartbeat(): ConnectivityStatus {
  const [status, setStatus] = useState<ConnectivityStatus>(initialHeartbeatState.status)
  // failCount lives in a ref so increments do not trigger renders.
  // Status is the only render-triggering surface.
  const stateRef = useRef<HeartbeatState>(initialHeartbeatState)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let cancelled = false

    async function tick() {
      // Pitfall 5: 'visible' is the only state we should ping under.
      if (document.visibilityState !== 'visible') return

      // Defense-in-depth: cancel any prior in-flight request.
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      const signal =
        typeof AbortSignal.any === 'function'
          ? AbortSignal.any([controller.signal, timeoutSignal])
          : timeoutSignal

      let event: { type: 'success' } | { type: 'failure' }
      try {
        const res = await fetch('/api/ping', { signal })
        if (cancelled) return
        event = res.ok ? { type: 'success' } : { type: 'failure' }
      } catch {
        // Pitfall 1: do NOT branch on err.name (Chromium throws AbortError, others TimeoutError).
        if (cancelled) return
        event = { type: 'failure' }
      }

      const next = nextHeartbeatState(stateRef.current, event)
      stateRef.current = next
      // Pattern: setStatus(prev => ...) bails out via Object.is when status unchanged
      // (avoids unnecessary re-renders when only failCount changes).
      setStatus((prev) => (prev === next.status ? prev : next.status))
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') void tick()
    }

    void tick() // immediate first tick — Pitfall 7 (avoid offline flash on slow start)
    const id = window.setInterval(tick, POLL_INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      abortRef.current?.abort()
    }
  }, [])

  return status
}
```

**Why this matches `useTextSelection`'s style:**
- Single `useEffect` owns all setup and disposal.
- Handler defined inside the effect.
- Listener add/remove pair is symmetric (`addEventListener`/`removeEventListener` with the same function reference).
- Refs for non-rendering state (`useTextSelection` uses `currentRange`, `storedOffsets`; this hook uses `stateRef`, `abortRef`).
- Empty dependency array for a one-time mount effect.

**Why no `useCallback` on returned value:** `useTextSelection` exposes setters/getters via `useCallback` because consumers pass them to React props. `useHeartbeat` only returns a `string`-union value; no callback wrapping needed.

---

### `ui/src/hooks/useHeartbeat.test.ts` (OPTIONAL) — hook integration test

**Analog:** No direct analog — see "No Analog Found" below.

The Test Coverage Requirement (CLAUDE.md) is satisfied by `connectivity.test.ts` covering the reducer (the BLOCKER threshold is "at least one of: tdd plan, test task referencing test files, or `<verify>npm test</verify>` block"). An integration test of the hook itself is OPTIONAL per RESEARCH.md A1 and the assumption note in code examples.

**Recommendation:** Skip this file. The pure reducer tests fully exercise the state transitions; the hook becomes a thin wiring layer that is verified manually via the local axum smoke test. Adding `@testing-library/react` for one wiring test is not justified per the bundle-size policy in CLAUDE.md.

If the planner chooses to include it anyway, no in-repo analog exists; follow the Code Examples section of RESEARCH.md (lines 521-572) verbatim.

---

### `ui/src/types.ts` — type module modification

**Analog:** existing declarations in the same file (lines 1-5).

**Existing convention** (lines 1-5):

```typescript
export type AnnotationType = 'comment' | 'delete' | 'replace'

export type Tab = 'plan' | 'diff' | 'help'

export type ViewMode = 'preview' | 'markdown'
```

Convention: **string-literal union types**, one per `export type`, blank line between, lowercase string members, no enums.

**Decision point:** Per RESEARCH.md "Claude's Discretion" line 41, the planner can either:
- (A) Add `ConnectivityStatus` to `ui/src/types.ts` (matches existing cross-component types)
- (B) Co-locate `ConnectivityStatus` in `ui/src/lib/connectivity.ts` (matches "hook-internal types stay in the hook file" rule of thumb)

Both are valid. Recommendation per research: option (B) since the type is owned by the connectivity reducer and there is currently no second consumer. If Phase 14's banner imports it from the connectivity module, that is fine — the import path is `import { useHeartbeat } from '../hooks/useHeartbeat'` and the type re-exported from there if needed.

**If option (A) is chosen, append to `types.ts`:**

```typescript
// ... existing types ...

export type ConnectivityStatus = 'online' | 'offline'
```

## Shared Patterns

### `import type` for type-only imports

**Source:** `ui/src/utils/serializeAnnotations.ts:1`, `ui/src/utils/serializeAnnotations.test.ts:3`, `ui/src/hooks/useTextSelection.ts:1`
**Apply to:** All new files (`connectivity.ts`, `connectivity.test.ts`, `useHeartbeat.ts`)

```typescript
import type { Annotation } from '../types'                                  // serializeAnnotations.ts
import type { Annotation } from '../types'                                  // serializeAnnotations.test.ts
import { useCallback, ..., type RefObject } from 'react'                    // useTextSelection.ts
```

`tsconfig.app.json` enables `"verbatimModuleSyntax": true` (line 13). Without `type` markers on type-only imports, `tsc -b` fails the build. The pre-commit hook in this project gates Rust formatting only, but `npm run build` (CI) will fail on this.

### Vitest test file naming and placement

**Source:** `ui/src/utils/serializeAnnotations.test.ts`
**Apply to:** `connectivity.test.ts`, `useHeartbeat.test.ts` (if added)

Sibling test file pattern: `<module>.ts` + `<module>.test.ts` in the same directory. `vitest.config.ts` is not present (project relies on Vite + Vitest defaults), so the `*.test.ts` glob is the discovery contract.

### React 19 StrictMode-correct cleanup

**Source:** `ui/src/main.tsx:7-9` (StrictMode active) + `ui/src/hooks/useTextSelection.ts:159-162` (symmetric add/remove)
**Apply to:** `useHeartbeat.ts`

```typescript
// useTextSelection.ts:159-162
document.addEventListener('mouseup', capture)
return () => {
  document.removeEventListener('mouseup', capture)
}
```

Every `addEventListener` pairs with a `removeEventListener` using the **same function reference**. Every `setInterval` must pair with `clearInterval`. Every `AbortController` must be `abort()`-ed on cleanup. RESEARCH.md Pitfall 3 documents why — StrictMode doubles effect invocations in dev, and unsymmetric cleanup leaks intervals.

### Fetch convention (existing `App.tsx` patterns)

**Source:** `ui/src/App.tsx:589-603, 649-657, 660-675`
**Apply to:** `useHeartbeat.ts` (the only new fetch site)

Existing usage uses `.then()` chains and inspects `res.ok`:

```typescript
fetch('/api/plan')
  .then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  })
  .then((data: { plan_md: string }) => { /* ... */ })
  .catch(() => { /* ... */ })
```

`useHeartbeat` differs in three deliberate ways (per RESEARCH.md):
1. Uses `async`/`await` rather than `.then()` chains — needed because the abort signal logic interleaves with control flow.
2. Does NOT call `res.json()` — the ping endpoint is checked for `res.ok` only (Phase 12 returns `200 OK` with empty body).
3. Passes `{ signal: AbortSignal.timeout(...) }` — none of the existing fetches use abort signals, so this is a new pattern unique to the polling hook.

The path `'/api/ping'` matches the existing `/api/plan`, `/api/diff`, `/api/config`, `/api/decide` URL convention.

### Switch on discriminated unions

**Source:** `ui/src/utils/serializeAnnotations.ts:3-9, 27-37`
**Apply to:** `connectivity.ts` `nextHeartbeatState` reducer

```typescript
function typeLabel(type: Annotation['type']): string {
  switch (type) {
    case 'comment': return 'COMMENT'
    case 'delete':  return 'DELETE'
    case 'replace': return 'REPLACE'
  }
}
```

Combined with `noFallthroughCasesInSwitch: true` (tsconfig line 22), every `case` must `return` or `break`. Apply the same shape to `nextHeartbeatState`'s `switch (event.type)`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `ui/src/hooks/useHeartbeat.test.ts` (optional) | hook integration test | timer + fetch mocking | No existing hook-level test in this codebase. The single existing hook (`useTextSelection`) has no test sibling. If written, follow RESEARCH.md "Code Examples" section verbatim — but the recommendation is to skip this file and rely on the pure reducer tests in `connectivity.test.ts`. |

## Metadata

**Analog search scope:**
- `ui/src/hooks/` — found `useTextSelection.ts` (only hook in repo)
- `ui/src/utils/` — found `serializeAnnotations.ts` and its `.test.ts` sibling
- `ui/src/types.ts` — type-declaration analogs
- `ui/src/main.tsx` — confirmed StrictMode active
- `ui/src/App.tsx` (lines 580-696) — surveyed existing fetch patterns
- `ui/package.json`, `ui/tsconfig.app.json` — confirmed Vitest, React 19, `verbatimModuleSyntax`, `noFallthroughCasesInSwitch`, `erasableSyntaxOnly`

**Files scanned:** 7

**Pattern extraction date:** 2026-05-07

**Key project-wide conventions detected:**
1. Named exports only — no `default` exports anywhere in the analyzed files.
2. String-literal union types — no `enum` (forbidden by `erasableSyntaxOnly`).
3. `import type { ... }` mandatory for type-only imports (`verbatimModuleSyntax`).
4. Pure-function tests with `describe`/`it`/`expect` — no `@testing-library/react` in `package.json`.
5. Sibling test files (`<module>.test.ts` next to `<module>.ts`).
6. Single-`useEffect` for browser-API hooks with symmetric setup/cleanup, empty dep array for mount-only.
7. `Test N:` prefix on every `it()` title.
