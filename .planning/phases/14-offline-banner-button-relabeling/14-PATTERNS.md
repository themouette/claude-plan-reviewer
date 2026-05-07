# Phase 14: Offline Banner & Button Relabeling - Pattern Map

**Mapped:** 2026-05-07
**Files analyzed:** 4 (2 modified + 2 new)
**Analogs found:** 4 / 4 (100%)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `ui/src/utils/offlineLabels.ts` (NEW) | utility (pure helper module) | transform (inputs -> string) | `ui/src/utils/connectivity.ts` | exact (sibling utils, pure helpers, string-literal union consumption) |
| `ui/src/utils/offlineLabels.test.ts` (NEW) | test (Vitest unit) | transform-assertion | `ui/src/utils/connectivity.test.ts` | exact (sibling test, pure-function describe/it style) |
| `ui/src/App.tsx` (MODIFIED) | component (root + colocated sub-components) | request-response + render-time-derivation | `ui/src/App.tsx` itself (PageHeader, ErrorView, LoadingSpinner — for the new colocated `OfflineBanner`) | self-analog (D-13 colocation) |
| `ui/src/index.css` (MODIFIED) | config (CSS variables / theme tokens) | static design-token | `ui/src/index.css` `:root` and `[data-theme="light"]` blocks | self-analog |

**Why these analogs:**
- `connectivity.ts` is the closest pure-helper utility. It is a sibling file in `ui/src/utils/`, exports the `ConnectivityStatus` type that `offlineLabels.ts` consumes, and follows the same "pure functions over a string-literal union" shape.
- `connectivity.test.ts` is the closest test-file analog: Vitest, no React renderer, `describe`/`it` blocks, named `Test N: <description>` cases, plain string-equality assertions. Same conventions used in `serializeAnnotations.test.ts`.
- `App.tsx` itself is the analog for the new colocated `OfflineBanner` sub-component (D-13 explicitly forbids `ui/src/components/`). The pattern to copy lives in the same file.
- `index.css` has only itself as analog — adding new tokens means appending to the existing two theme blocks.

---

## Pattern Assignments

### `ui/src/utils/offlineLabels.ts` (utility, transform)

**Analog:** `ui/src/utils/connectivity.ts`

**Imports pattern** (analog: connectivity.ts has zero imports because it self-contains its types; offlineLabels.ts must import the consumed type from connectivity.ts):

```ts
// ui/src/utils/offlineLabels.ts (NEW)
import type { ConnectivityStatus } from './connectivity'
```

Rationale: `connectivity.ts` line 1 exports `ConnectivityStatus`. Re-importing as `import type` keeps the dependency erased at runtime — same convention used in `useHeartbeat.ts` lines 2-8 (`type ConnectivityStatus`, `type HeartbeatEvent`, `type HeartbeatState` all imported with `type` qualifier).

**Constants pattern** (analog: `connectivity.ts` lines 10-13 — exported `const` with explicit type annotation):

```ts
// connectivity.ts:10-13 — copy this shape (named export, const, declarative)
export const initialHeartbeatState: HeartbeatState = {
  status: 'online',
  failCount: 0,
}
```

For `offlineLabels.ts`, follow the same `export const NAME = literal` shape:

```ts
export const OFFLINE_BANNER_LINE_1 = 'Server connection lost — working offline.'
export const OFFLINE_BANNER_LINE_2 =
  "When you're done, copy your decision to the clipboard and paste it back into Claude."
export const OFFLINE_APPROVE_LABEL = 'Copy to clipboard — approve'
export const OFFLINE_DENY_LABEL = 'Copy to clipboard — deny'
export const OFFLINE_SUBMIT_DENIAL_LABEL = 'Copy to clipboard'
```

**Pure function pattern** (analog: `connectivity.ts` lines 15-30 — `nextHeartbeatState` is a pure switch-on-union returning a value of the same type-family):

```ts
// connectivity.ts:15-30 — copy this shape (exported function, typed args, switch/ternary on union)
export function nextHeartbeatState(
  state: HeartbeatState,
  event: HeartbeatEvent,
): HeartbeatState {
  switch (event.type) {
    case 'success':
      return { status: 'online', failCount: 0 }
    case 'failure': {
      const failCount = state.failCount + 1
      if (failCount >= 3) {
        return { status: 'offline', failCount }
      }
      return { status: state.status, failCount }
    }
  }
}
```

For `offlineLabels.ts`, the three label functions follow the same shape but with a ternary on the binary `ConnectivityStatus` union:

```ts
export function approveButtonLabel(
  status: ConnectivityStatus,
  defaultLabel: string,
): string {
  return status === 'offline' ? OFFLINE_APPROVE_LABEL : defaultLabel
}

export function denyButtonLabel(
  status: ConnectivityStatus,
  defaultLabel: string,
): string {
  return status === 'offline' ? OFFLINE_DENY_LABEL : defaultLabel
}

export function submitDenialButtonLabel(status: ConnectivityStatus): string {
  return status === 'offline' ? OFFLINE_SUBMIT_DENIAL_LABEL : 'Submit Denial'
}
```

**Why ternary not switch:** `ConnectivityStatus` has only two members. `nextHeartbeatState` uses `switch` because `HeartbeatEvent` is a discriminated union with branch-specific shape; `ConnectivityStatus` is a flat string union with no branch shape. Ternary is the idiomatic React-codebase shape for binary string unions and matches the planned call-site pattern (render-time ternary in JSX).

**Error handling:** None — pure functions never throw. (Analog: `nextHeartbeatState` never throws; identical contract.)

**Validation:** None — TypeScript's `ConnectivityStatus` union is exhaustive at compile time; no runtime validation needed.

---

### `ui/src/utils/offlineLabels.test.ts` (test, transform-assertion)

**Analog:** `ui/src/utils/connectivity.test.ts`

**Imports pattern** (analog: connectivity.test.ts lines 1-6):

```ts
// connectivity.test.ts:1-6 — copy this shape exactly
import { describe, it, expect } from 'vitest'
import {
  initialHeartbeatState,
  nextHeartbeatState,
  type HeartbeatState,
} from './connectivity'
```

For `offlineLabels.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  OFFLINE_BANNER_LINE_1,
  OFFLINE_BANNER_LINE_2,
  OFFLINE_APPROVE_LABEL,
  OFFLINE_DENY_LABEL,
  OFFLINE_SUBMIT_DENIAL_LABEL,
  approveButtonLabel,
  denyButtonLabel,
  submitDenialButtonLabel,
} from './offlineLabels'
```

**Test structure pattern** (analog: connectivity.test.ts lines 8-45 — single top-level `describe` per function, `it('Test N: <description>', ...)` naming):

```ts
// connectivity.test.ts:8-13 — describe block + Test-N naming convention
describe('nextHeartbeatState', () => {
  it('Test 1: one failure stays online (failCount 1)', () => {
    const next = nextHeartbeatState(initialHeartbeatState, { type: 'failure' })
    expect(next.status).toBe('online')
    expect(next.failCount).toBe(1)
  })
  // ...
})
```

For `offlineLabels.test.ts`, mirror the structure with one `describe` per logical group (constants, then each label function):

```ts
describe('offlineLabels constants', () => {
  it('Test 1: banner line 1 ships byte-for-byte', () => {
    expect(OFFLINE_BANNER_LINE_1).toBe(
      'Server connection lost — working offline.',
    )
  })
  // Tests 2-5 cover OFFLINE_BANNER_LINE_2, OFFLINE_APPROVE_LABEL,
  // OFFLINE_DENY_LABEL, OFFLINE_SUBMIT_DENIAL_LABEL
})

describe('approveButtonLabel', () => {
  it('Test 6: returns default when online', () => {
    expect(approveButtonLabel('online', 'Approve')).toBe('Approve')
  })
  // Tests 7-9 cover custom-online-default preservation, offline override,
  // and offline-overrides-custom-default case
})

describe('denyButtonLabel', () => { /* Tests 10-13 — symmetric to approve */ })

describe('submitDenialButtonLabel', () => { /* Tests 14-15 */ })
```

**Assertion pattern** (analog: connectivity.test.ts lines 9-13, 32-37 — plain `expect(value).toBe(literal)`):

```ts
// connectivity.test.ts:9-13
const next = nextHeartbeatState(initialHeartbeatState, { type: 'failure' })
expect(next.status).toBe('online')
expect(next.failCount).toBe(1)
```

For label tests, use string equality on byte-exact literals (em dash U+2014, ASCII apostrophe U+0027):

```ts
expect(OFFLINE_APPROVE_LABEL).toBe('Copy to clipboard — approve')
expect(OFFLINE_BANNER_LINE_2).toBe(
  "When you're done, copy your decision to the clipboard and paste it back into Claude.",
)
```

**No mock pattern:** Unlike `useHeartbeat.test.ts` which uses an injected harness (because the hook owns side effects), `offlineLabels.test.ts` is pure-function testing — zero mocks. The connectivity.test.ts pattern is the correct analog: just call the function and assert.

**`@testing-library/react` is NOT used.** Verified by `useHeartbeat.test.ts:14-19` ("Constraint (RESEARCH.md A1 / bundle-size policy): no `@testing-library/react`"). The project pattern is plain Vitest assertions on pure helpers.

---

### `ui/src/App.tsx` (component, request-response + render-time-derivation) — MODIFIED

The four edit sites use four different patterns from the existing file. Each pattern is sourced from a specific line range in the same file (self-analog).

#### Edit 1: New imports (after line 4)

**Analog:** `ui/src/App.tsx` lines 1-12 — existing import block uses named imports from `./hooks/...` and `./utils/...` paths:

```ts
// App.tsx:1-12 — existing import shape
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Annotation, AnnotationType, OutlineItem, Tab, ViewMode } from './types'
import { serializeAnnotations } from './utils/serializeAnnotations'
import { useTextSelection, rangeFromOffsets } from './hooks/useTextSelection'
import { TabBar } from './components/TabBar'
```

Add adjacent to existing imports (after `useTextSelection` import is the cleanest spot):

```ts
import { useHeartbeat } from './hooks/useHeartbeat'
import {
  OFFLINE_BANNER_LINE_1,
  OFFLINE_BANNER_LINE_2,
  approveButtonLabel,
  denyButtonLabel,
  submitDenialButtonLabel,
} from './utils/offlineLabels'
```

#### Edit 2: New colocated `OfflineBanner` sub-component (after `ErrorView`, ~line 150)

**Analog:** `ui/src/App.tsx` lines 89-150 — existing colocated sub-components (`LoadingSpinner`, `ErrorView`) follow this shape:

```tsx
// App.tsx:89-111 — LoadingSpinner: function declaration, zero props, inline style with var(--color-*)
function LoadingSpinner() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexGrow: 1,
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          border: '3px solid var(--color-text-secondary)',
          borderTopColor: 'var(--color-accent-approve)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
    </div>
  )
}
```

```tsx
// App.tsx:113-150 — ErrorView: function declaration, zero props, inline style block, var(--color-text-primary) tokens
function ErrorView() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flexGrow: 1,
        padding: '32px',
        textAlign: 'center',
      }}
    >
      <h2 style={{
        fontSize: '20px',
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        marginBottom: '12px',
      }}>
        Could not load plan
      </h2>
      {/* ... */}
    </div>
  )
}
```

For `OfflineBanner`:

```tsx
function OfflineBanner() {
  return (
    <div
      role="status"
      style={{
        background: 'var(--color-banner-bg)',
        color: 'var(--color-banner-text)',
        padding: '16px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: 'flex-start',
        fontSize: '14px',
        fontWeight: 400,
        lineHeight: 1.5,
        flexShrink: 0,
      }}
    >
      <div>{OFFLINE_BANNER_LINE_1}</div>
      <div>{OFFLINE_BANNER_LINE_2}</div>
    </div>
  )
}
```

**Key conventions copied:**
- Function declaration (not arrow), zero props (matches `LoadingSpinner` / `ErrorView`).
- Inline `style={{ ... }}` object — no Tailwind utility classes in JSX (verified ErrorView lines 116-124).
- CSS-variable color references via `var(--color-...)` (verified ErrorView line 130, LoadingSpinner line 103).
- `flexShrink: 0` — direct copy of PageHeader pattern at App.tsx:51 (sibling under the same App-level flex column).

**Diverges from analog:**
- Adds `role="status"` (D-09). PageHeader uses `<header>` (line 39); ErrorView and LoadingSpinner are plain `<div>` without ARIA roles. The role is required by D-09 and UI-SPEC §Live-Region Behavior — `OfflineBanner` is the first colocated component to need it.

#### Edit 3: `useHeartbeat()` call inside `App` body (~line 543)

**Analog:** `ui/src/App.tsx` lines 537-561 — existing hook calls at the top of the App body:

```tsx
// App.tsx:537-561 — top-of-body hook block, hooks before `function handleThemeToggle`,
// hooks resume after handler declaration on line 551+
export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => { /* ... */ })

  function handleThemeToggle() { /* ... */ }

  const [appState, setAppState] = useState<AppState>('loading')
  const [planMd, setPlanMd] = useState<string>('')
  // ...
  const [approveLabel, setApproveLabel] = useState('Approve')
  const [denyLabel, setDenyLabel] = useState('Deny')
  const denyTextareaRef = useRef<HTMLTextAreaElement>(null)
  const denyButtonRef = useRef<HTMLButtonElement>(null)
```

Insert the new hook call alongside the existing block. Recommended position: immediately after `theme` state initialization and `handleThemeToggle` (around line 551, before `appState`):

```tsx
const connectivity = useHeartbeat()
```

The placement is a `const` binding from a hook, parallel to lines 538 / 551 / 558 / 559. No prop drilling needed — `connectivity` is in scope across the entire `App` body, including the JSX return that starts at line 1067.

#### Edit 4a: Banner mount point (between line 1075 and 1078)

**Analog:** `ui/src/App.tsx` lines 1075-1086 — existing render-time conditional pattern:

```tsx
// App.tsx:1075-1086 — render-time conditionals at the top of App's JSX return
<PageHeader activeTab={activeTab} onTabChange={setActiveTab} theme={theme} onThemeToggle={handleThemeToggle} />

{/* Non-reviewing states: loading, error, confirmed */}
{appState !== 'reviewing' && (
  <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
    {appState === 'loading' && <LoadingSpinner />}
    {appState === 'error' && <ErrorView />}
    {appState === 'confirmed' && decision && (
      <ConfirmationView decision={decision} approveLabel={approveLabel} denyLabel={denyLabel} />
    )}
  </div>
)}
```

For the banner, insert a single conditional render between line 1075 and the `{/* Non-reviewing states... */}` comment on line 1077:

```tsx
<PageHeader activeTab={activeTab} onTabChange={setActiveTab} theme={theme} onThemeToggle={handleThemeToggle} />
{connectivity === 'offline' && <OfflineBanner />}

{/* Non-reviewing states: loading, error, confirmed */}
{appState !== 'reviewing' && ( /* ... */ )}
```

**Pattern justification:** The existing file uses inline `{condition && <Component />}` for `LoadingSpinner`, `ErrorView`, `ConfirmationView` (lines 1080-1084) and `PlanOutline` (line 1099). The banner follows the identical shape. Critically, the banner sits OUTSIDE the `appState !== 'reviewing'` block (D-10, Pitfall 1) — it is a sibling of the appState branches, not a descendant.

#### Edit 4b: Approve button label (line 1297)

**Analog:** `ui/src/App.tsx` line 1297 — existing pattern is a bare `{approveLabel}` interpolation inside the button. The phase swap replaces the bare interpolation with a helper call.

```tsx
// App.tsx:1297 today
{approveLabel}
```

After:

```tsx
{approveButtonLabel(connectivity, approveLabel)}
```

**Pattern source:** This shape mirrors how the existing file passes derived values through helper functions (e.g., `serializeAnnotations(denyText, overallComment, annotations)` is called inline elsewhere). The render-time computation avoids the forbidden `useEffect`-on-connectivity state mutation (D-05, Anti-Pattern in RESEARCH.md).

**Surrounding `<span>↵ Enter</span>` is preserved** (App.tsx:1298-1306) — the helper returns only the button text; the keyboard hint stays a sibling node.

#### Edit 4c: Outer Deny button label (line 1335)

**Analog:** `ui/src/App.tsx` line 1335 — same pattern as 1297:

```tsx
// App.tsx:1335 today
{denyLabel}
```

After:

```tsx
{denyButtonLabel(connectivity, denyLabel)}
```

**Behavior unchanged:** The outer Deny button's `onClick` (line 1312-1314) still toggles the deny form. Only the displayed text changes. D-03 / domain section explicitly forbids modifying the click handler body.

#### Edit 4d: Inner Submit Denial button label (line 1418)

**Analog:** `ui/src/App.tsx` line 1418 — static string interpolation:

```tsx
// App.tsx:1418 today
Submit Denial
```

After:

```tsx
{submitDenialButtonLabel(connectivity)}
```

**Note the brace addition:** Today's line 1418 is plain JSX text. The replacement wraps it in `{ ... }` to enable the function call. The `submitDenialButtonLabel` helper takes only `connectivity` (no `defaultLabel` parameter) because the online label is the static string `'Submit Denial'` — never sourced from `/api/config`.

**Click handler unchanged** (App.tsx:1389-1392 still calls `deny()` if `denyMessageValid`). Phase 14 must not modify the body.

---

### `ui/src/index.css` (config, design-token) — MODIFIED

**Analog:** `ui/src/index.css` lines 3-22 (`:root` block) and 24-43 (`[data-theme="light"]` block) — existing CSS variable declarations under both theme selectors:

```css
/* index.css:3-22 — :root block, dark theme (existing) */
:root {
  --color-bg: #0f1117;
  --color-surface: #1a1d27;
  --color-border: #2d3148;
  /* ... 18 more vars ... */
  --color-link: #60a5fa;
}
```

```css
/* index.css:24-43 — [data-theme="light"] block, light theme (existing) */
[data-theme="light"] {
  --color-bg: #f8fafc;
  --color-surface: #f1f5f9;
  /* ... 18 more vars ... */
  --color-link: #1d4ed8; /* blue-700, ~6.5:1 on #f8fafc */
}
```

**Pattern to copy:** Append two new variables to the END of each block (just before the closing `}`). Use the same hex-color literal style and (in light theme) the trailing AA-contrast comment:

```css
/* index.css :root — append after line 21 (--color-link) */
:root {
  /* ...existing dark vars... */
  --color-link: #60a5fa;
  --color-banner-bg: #f59e0b;
  --color-banner-text: #0f1117;
}
```

```css
/* index.css [data-theme="light"] — append after line 42 (--color-link) */
[data-theme="light"] {
  /* ...existing light vars... */
  --color-link: #1d4ed8; /* blue-700, ~6.5:1 on #f8fafc */
  --color-banner-bg: #d97706;
  --color-banner-text: #0f172a; /* dark on amber, 5.60:1 — UI-SPEC override of D-08 literal */
}
```

**Variable naming convention copied:** `--color-banner-bg` and `--color-banner-text` follow the `--color-<role>-<property>` pattern already in use (`--color-tab-active`, `--color-tab-inactive`, `--color-accent-approve`, `--color-accent-deny`).

**Why both blocks must redeclare:** The light-theme block does NOT inherit from `:root`; CSS Custom Properties resolve per-selector. Verified at index.css lines 25-42 — every var defined in `:root` is re-declared with a different value in `[data-theme="light"]`.

**No new color tokens borrowed from elsewhere:** `--color-banner-bg` is a brand-new amber token (`#f59e0b` / `#d97706`). The light-theme `--color-banner-text` value (`#0f172a`) reuses the same value as `--color-text-primary` (light theme, line 30) but is declared as a separate token to decouple semantics (UI-SPEC §Color rationale, RESEARCH Pattern 5).

---

## Shared Patterns

### Pattern A: String-literal union as a function input

**Source:** `ui/src/utils/connectivity.ts` line 1
**Apply to:** `offlineLabels.ts` (all three label functions)

```ts
// connectivity.ts:1
export type ConnectivityStatus = 'online' | 'offline'
```

Both functions in `offlineLabels.ts` accept `status: ConnectivityStatus` as the discriminator. Use exact string equality (`status === 'offline'`) — never `status !== 'online'` (RESEARCH.md Open Question 3 — both produce identical truth tables, but `=== 'offline'` is the explicit positive form and matches the project's existing checks).

### Pattern B: `import type` for type-only imports

**Source:** `ui/src/hooks/useHeartbeat.ts` lines 2-8
**Apply to:** `offlineLabels.ts`, `offlineLabels.test.ts`

```ts
// useHeartbeat.ts:2-8 — type-only imports use the `type` qualifier per import name
import {
  initialHeartbeatState,
  nextHeartbeatState,
  type ConnectivityStatus,
  type HeartbeatEvent,
  type HeartbeatState,
} from '../utils/connectivity'
```

`offlineLabels.ts` consumes only the type (`ConnectivityStatus`), so a top-level `import type` is appropriate:

```ts
import type { ConnectivityStatus } from './connectivity'
```

`offlineLabels.test.ts` imports only values (constants and functions), no types — no `type` qualifier needed.

### Pattern C: Inline `style={{ ... }}` with CSS variable references

**Source:** `ui/src/App.tsx` lines 39-86 (`PageHeader`), 89-111 (`LoadingSpinner`), 113-150 (`ErrorView`)
**Apply to:** `OfflineBanner` (new colocated sub-component)

```tsx
// App.tsx:39-52 — inline-style + var(--color-*) on header
<header
  style={{
    height: '48px',
    background: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    alignItems: 'center',
    /* ... */
    flexShrink: 0,
  }}
>
```

`OfflineBanner` follows the identical shape. NO Tailwind utility classes in JSX (verified across all three sub-components). NO `className` for styling. ALL color tokens reference `var(--color-*)` so theme switching is automatic.

### Pattern D: Render-time conditional `{cond && <Component />}` for colocated sub-components

**Source:** `ui/src/App.tsx` lines 1080-1084
**Apply to:** Banner mount site (new line ~1076)

```tsx
// App.tsx:1080-1084 — render-time conditional rendering
{appState === 'loading' && <LoadingSpinner />}
{appState === 'error' && <ErrorView />}
{appState === 'confirmed' && decision && (
  <ConfirmationView decision={decision} approveLabel={approveLabel} denyLabel={denyLabel} />
)}
```

Banner uses identical shape:

```tsx
{connectivity === 'offline' && <OfflineBanner />}
```

### Pattern E: Pure-function Vitest test (no React renderer, no module mocks)

**Source:** `ui/src/utils/connectivity.test.ts` lines 1-45 and `ui/src/utils/serializeAnnotations.test.ts` lines 1-30
**Apply to:** `offlineLabels.test.ts`

```ts
// connectivity.test.ts:1-13 — minimal Vitest pattern
import { describe, it, expect } from 'vitest'
import { /* names */ } from './module-under-test'

describe('functionName', () => {
  it('Test 1: <descriptive case>', () => {
    expect(functionName(input)).toBe(output)
  })
})
```

**Naming convention:** `'Test N: <description>'` (verified in connectivity.test.ts:9, serializeAnnotations.test.ts:6 — both files use the `Test N:` prefix). Apply to all 15 test cases in `offlineLabels.test.ts`.

**No mocks, no harnesses:** `useHeartbeat.test.ts` uses an injected harness because the hook owns side effects. Pure helpers do not — `connectivity.test.ts` and `serializeAnnotations.test.ts` use plain function calls. `offlineLabels.test.ts` follows the pure-helper pattern.

---

## No Analog Found

None. All four files have direct codebase analogs.

---

## Anti-Patterns (Forbidden — for planner reference)

These are NOT to be applied. Listed because the planner needs to know what to avoid when reading the analogs.

| Anti-pattern | Why forbidden | Source of prohibition |
|--------------|---------------|----------------------|
| `useEffect(() => setApproveLabel(...), [connectivity])` to flip labels in state | Persists offline strings into state across recovery; D-05 explicit | RESEARCH.md "Don't Hand-Roll" |
| Tailwind utility classes in JSX | Inline-style convention enforced across `App.tsx` | RESEARCH.md Project Constraints #3 |
| `@testing-library/react` import in `offlineLabels.test.ts` | Bundle-size policy; project precedent (Phase 13 RESEARCH A1) | RESEARCH.md Project Constraints #2 |
| New file at `ui/src/components/OfflineBanner.tsx` | D-13 colocation requirement | CONTEXT.md D-13 |
| Calling `useHeartbeat()` inside `OfflineBanner` (second consumer) | Doubles ping rate; D-12 single-call invariant | RESEARCH.md Pitfall 6 |
| `role="alert"` or manual `aria-live="assertive"` on banner | Disruptive for non-destructive status; D-09 | UI-SPEC §Live-Region Behavior |
| Banner inside `appState === 'reviewing'` or `appState !== 'reviewing'` blocks | Banner must be sibling of, not descendant of, appState branches; D-10 | RESEARCH.md Pitfall 1 |
| Mutating `approveLabel` / `denyLabel` React state on connectivity transitions | Forbidden by D-05; render-time ternary is the correct shape | CONTEXT.md D-05 |
| `position: sticky` on banner | UI-SPEC normal-flow requirement; PageHeader already owns sticky-top | UI-SPEC §Spacing |
| `--` or `-` instead of em dash `—` (U+2014) in label strings | Byte-for-byte spec contract | RESEARCH.md Pitfall 3 |
| Curly apostrophe `’` (U+2019) in `you're` | ASCII U+0027 required; project convention | RESEARCH.md Pitfall 4 |
| Extracting `<ActionBar />` to a separate component | Action bar must stay inline JSX in `App` body; A3 | RESEARCH.md Pattern 4 |

---

## Metadata

**Analog search scope:** `ui/src/utils/`, `ui/src/hooks/`, `ui/src/App.tsx`, `ui/src/index.css`
**Files scanned:** 7 (`connectivity.ts`, `connectivity.test.ts`, `serializeAnnotations.ts`, `serializeAnnotations.test.ts`, `useHeartbeat.ts`, `useHeartbeat.test.ts`, `App.tsx`, `index.css`)
**Pattern extraction date:** 2026-05-07
**Project stack reality:** React 19, NOT Svelte 5. CLAUDE.md "Recommended Stack" Svelte block is aspirational; actual UI is `ui/src/App.tsx` React with inline-style convention.
**Test infrastructure:** Vitest (no `@testing-library/react`). Pattern is pure-helper extraction → sibling `.test.ts` file.
