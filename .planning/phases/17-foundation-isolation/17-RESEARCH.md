# Phase 17: Foundation & Isolation — Research

**Researched:** 2026-05-20
**Domain:** React 19 + Vitest 4 + ESLint 9 flat config — test infrastructure scaffolding, isolation enforcement, routing, reducer-based state, Tailwind 4 layout
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use an inline `window.location.pathname.startsWith('/v2')` check in `main.tsx` — no router library. Zero new dep.
- **D-02:** The `/v2` path prefix triggers the v2 reviewer. Rust's existing `FallbackBehavior::Ok` already serves `index.html` for any path — no Rust changes needed.
- **D-03:** `reviewer-v2/` must NOT import from any local path outside `reviewer-v2/` — not even shared hooks like `hooks/useHeartbeat.ts`. The goal is that v1 can be deleted without breaking v2.
- **D-04:** `reviewer-v2/` copies the utilities it needs (connectivity state machine, useHeartbeat, offlineLabels) into its own subtree. Some duplication is acceptable in exchange for total isolation.
- **D-05:** The ESLint coupling rule is enforced via `no-restricted-imports` in `eslint.config.js` using a `files: ['**/reviewer-v2/**']` config block that blocks `../` relative imports. Zero new deps.
- **D-06:** Coupling direction: existing view (v1) MAY import shared utilities from `reviewer-v2/` if useful — the ESLint rule does NOT block that direction.
- **D-07:** `reviewer-v2/` owns its own `useHeartbeat` copy (in `reviewer-v2/hooks/useHeartbeat.ts`) copied from the existing hook.
- **D-08:** v2 calls its own `useHeartbeat()` and gets its own `ConnectivityStatus` state — completely independent from App.tsx. Two pollers, same `/api/ping` endpoint.
- **D-09:** State is managed via `useReducer` with typed actions — matches the existing connectivity state machine pattern, testable by calling the reducer directly without a React renderer.
- **D-10:** Store lives in `reviewer-v2/hooks/useAnnotations.ts` — a hook wrapper that calls `useReducer` internally and exposes typed add/edit/remove helpers.
- **D-11:** Phase 17 defines a minimal Annotation type: `{ id, anchorText, comment, type }`. Later phases (20–21) will extend it with anchor offsets, sectionId, etc. Do not over-design the type now.
- **D-12:** `vitest.setup.ts` must be created and registered before any v2 component code. It must mock `IntersectionObserver`, `ResizeObserver`, and `CSS.highlights` for jsdom.
- **D-13:** The ESLint coupling rule (D-05) must be active and failing on violations before any v2 feature code lands — TEST-03 is a gate, not a follow-up.
- **D-14:** The 3-column layout shell uses CSS Grid or Flexbox with Tailwind 4 classes. No new UI library. The layout boundary must be visible at `/v2` (columns rendered, no content yet).

### Claude's Discretion

- Specific Tailwind class names and CSS Grid vs Flexbox for the 3-column layout — either works.
- Directory structure within `reviewer-v2/` beyond the top-level `hooks/` and `utils/` subdirectories.
- Whether the `reviewer-v2/utils/connectivity.ts` copy is a verbatim copy or stripped to the minimum v2 needs.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-02 | `vitest.setup.ts` includes jsdom mocks for `IntersectionObserver`, `ResizeObserver`, and `CSS.highlights` before any v2 component code is written | Vitest 4 `test.setupFiles` in `vite.config.ts` (or `vitest.config.ts`); jsdom peer dep must be installed; mock patterns confirmed |
| TEST-03 | An ESLint rule (`no-restricted-imports` or equivalent) enforces the ARCH-01 coupling constraint automatically — violation is a lint error, not just a convention | ESLint 9 flat config `no-restricted-imports` with `files: ['src/reviewer-v2/**']` and `patterns: [{ group: ['../*'], message: '...' }]` — verified against eslint.org docs |
| ARCH-01 | All new reviewer code lives under `ui/src/reviewer-v2/`; no file outside `reviewer-v2/` imports from within it | ESLint 9 `no-restricted-imports` in a `files`-scoped block; copying utilities into the subtree eliminates the need to import from outside |
| ARCH-02 | The new reviewer owns its own heartbeat/connectivity detection via `useHeartbeat` — no dependency on `App.tsx` internal state | `useHeartbeat.ts` copied verbatim into `reviewer-v2/hooks/`; hook signature is identical; two independent poll loops at runtime |
| LAYOUT-01 | New reviewer renders at `/v2` in a browser tab alongside the existing reviewer | `window.location.pathname.startsWith('/v2')` check in `main.tsx`; Rust `FallbackBehavior::Ok` already handles arbitrary paths |
| LAYOUT-02 | Three-column shell: outline tree (left) / formatted markdown (center) / comment sidebar (right) | CSS Grid or Tailwind Flexbox with three named regions; visible placeholder content per column; no content required in Phase 17 |
</phase_requirements>

---

## Summary

Phase 17 is a scaffolding phase. No feature logic is written — only the structural prerequisites that every subsequent phase depends on. There are five distinct work streams: (1) install the jsdom peer dependency and create `vitest.setup.ts` registered via `test.setupFiles`, (2) add an ESLint 9 flat-config block that makes `no-restricted-imports` a hard error for any file inside `reviewer-v2/` that uses a `../` relative path, (3) add the `window.location.pathname.startsWith('/v2')` routing branch to `main.tsx`, (4) scaffold the `reviewer-v2/` subtree with copied utilities, a minimal `Annotation` type, a `useAnnotations` reducer hook, and the v2 copy of `useHeartbeat`, and (5) create the top-level `ReviewerV2` component that renders the visible 3-column shell.

The existing codebase already has all the patterns needed. `connectivity.ts` is a pure state machine (copy verbatim). `useHeartbeat.ts` exports `runHeartbeatTick` for DI-based unit testing without a renderer (copy the same pattern). The existing `eslint.config.js` uses ESLint 9 `defineConfig` flat config — the new block is additive, no plugin required. Vitest 4 is already installed (`4.1.4`) but jsdom is not yet a peer dep; it must be added as a dev dep before `environment: 'jsdom'` works.

The most important sequencing constraint from CONTEXT.md (D-12/D-13): `vitest.setup.ts` and the ESLint rule MUST land before any v2 component code. The plan must enforce this ordering within tasks.

**Primary recommendation:** Create the test infrastructure (jsdom install + `vitest.setup.ts` + ESLint coupling block) first, then scaffold the subtree and routing, and finally the layout shell — in that order.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `/v2` routing switch | Frontend entry (`main.tsx`) | — | Pure client-side path inspection; no server-side routing needed; Rust already serves `index.html` for all paths |
| Isolation enforcement (ARCH-01) | Build-time (ESLint) | — | A lint rule catches import violations at dev/CI time, not at runtime; zero runtime cost |
| jsdom mock registration (TEST-02) | Test infrastructure (`vitest.setup.ts`) | — | Mocks must be global-scope before any test file imports browser APIs; `setupFiles` runs before test modules |
| Heartbeat/connectivity (ARCH-02) | `reviewer-v2/hooks/useHeartbeat.ts` | Rust `/api/ping` endpoint | v2 owns its own poll loop; backend endpoint is shared |
| Annotation store (D-09/D-10) | `reviewer-v2/hooks/useAnnotations.ts` | — | Pure reducer — no server state, no context in Phase 17 |
| 3-column layout shell (LAYOUT-02) | `reviewer-v2/ReviewerV2.tsx` | Tailwind 4 CSS | CSS Grid/Flex provides the spatial boundary; component owns the structure |

---

## Standard Stack

### Core (no new runtime deps — all already present)

| Library | Installed Version | Purpose | Why Standard |
|---------|------------------|---------|--------------|
| React 19 | `^19.2.4` | UI framework | Already present; v2 is same-repo component |
| TypeScript ~6 | `~6.0.2` | Type safety | Already present; typed reducers are core pattern |
| Tailwind 4 | `^4.2.2` | Layout & utility classes | Already present via `@tailwindcss/vite`; no new config needed |
| Vitest 4 | `^4.1.4` | Test runner | Already present; needs `test.setupFiles` config |
| ESLint 9 | `^9.39.4` | Lint (coupling enforcement) | Already present; flat config already in place |
| typescript-eslint | `^8.58.0` | TS support in ESLint | Already present; needed for TS file linting |

### New Dev Dependency Required

| Library | Version | Purpose | Why Needed |
|---------|---------|---------|------------|
| jsdom | `^29.1.1` | jsdom browser environment for Vitest | Vitest 4 lists jsdom as a peer dep; `environment: 'jsdom'` fails without it; current test suite runs in Node (default), but v2 component tests need DOM APIs |

[VERIFIED: npm registry] — `npm view jsdom version` returns `29.1.1`; package first published 2011, last modified 2026-04-30; long-standing official package (jsdom/jsdom on GitHub).

### No New Runtime Deps

Per locked decisions D-01, D-05: no router library, no ESLint plugin. All new capabilities use existing installed packages or built-in ESLint rules.

**Installation (one new dev dep):**
```bash
cd ui && npm install --save-dev jsdom
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| jsdom | npm | 14+ yrs (2011) | Tens of millions/wk | github.com/jsdom/jsdom | [SUS] on crates.io (wrong ecosystem) | Approved — npm-verified, authoritative package |

**Note on slopcheck result:** slopcheck checked `jsdom` on `crates.io` (the Rust registry), where it is indeed a low-download stub with no relevance. The package being installed is from npm, where `jsdom` is a foundational, widely-used package with 14 years of history. The [SUS] verdict does not apply to the npm package.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** jsdom on crates.io only — the npm package is clean by all human-readable signals. Planner should NOT add a `checkpoint:human-verify` — this is an ecosystem false-positive from slopcheck.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser loads index.html (served by Rust FallbackBehavior::Ok for any path)
         |
         v
main.tsx entry point
  pathname.startsWith('/v2')?
      YES --> <ReviewerV2 />          NO --> <App /> (existing v1)
              |
     reviewer-v2/ subtree (isolated)
      +------------------+------------------+
      |                  |                  |
  useHeartbeat.ts   useAnnotations.ts   ReviewerV2.tsx
  (own copy,         (useReducer,        (3-col layout shell,
   polls /api/ping)   pure reducer        mounts own hooks)
                       exported)
      |
  utils/ (copied, no ../  imports)
      connectivity.ts
      offlineLabels.ts (partial copy)
```

Data flows inward (no exports out from reviewer-v2/ to other src/ files in Phase 17).
ESLint coupling rule blocks any `../` import from within `reviewer-v2/` at lint time.

### Recommended Project Structure

```
ui/src/
├── reviewer-v2/             # All v2 code — isolated subtree
│   ├── ReviewerV2.tsx       # Top-level component, 3-column shell
│   ├── types.ts             # Minimal Annotation type {id, anchorText, comment, type}
│   ├── hooks/
│   │   ├── useHeartbeat.ts  # Verbatim copy of src/hooks/useHeartbeat.ts
│   │   └── useAnnotations.ts # useReducer wrapper with typed add/edit/remove
│   └── utils/
│       ├── connectivity.ts  # Verbatim copy of src/utils/connectivity.ts
│       └── offlineLabels.ts # Partial copy: buildClipboardPayload + shouldUseClipboard
├── hooks/
│   └── useHeartbeat.ts      # Original — untouched
├── utils/
│   └── connectivity.ts      # Original — untouched
├── App.tsx                  # v1 — untouched
├── main.tsx                 # MODIFIED: add /v2 routing branch
└── ...
ui/vitest.setup.ts           # NEW: jsdom mock registration
ui/vite.config.ts            # MODIFIED: add test.environment + test.setupFiles
ui/eslint.config.js          # MODIFIED: add reviewer-v2 coupling block
```

### Pattern 1: Vitest `setupFiles` with jsdom mocks

**What:** A single setup file registered via `test.setupFiles` that installs global browser API stubs before any test module loads.

**When to use:** Any test that exercises code touching `IntersectionObserver`, `ResizeObserver`, or `CSS.highlights` in a jsdom environment.

**Example:**
```typescript
// ui/vitest.setup.ts
// Source: vitest.dev/config/ + codebase existing pattern (connectivity.test.ts)

import { vi } from 'vitest'

// IntersectionObserver — not implemented in jsdom
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}))

// ResizeObserver — not implemented in jsdom
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// CSS Custom Highlight API — not implemented in jsdom
if (typeof CSS === 'undefined') {
  (global as unknown as { CSS: object }).CSS = {}
}
if (!(CSS as { highlights?: unknown }).highlights) {
  ;(CSS as { highlights: unknown }).highlights = new Map()
}
```

And register in `vite.config.ts`:
```typescript
// vite.config.ts — add test block
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
})
```

[CITED: vitest.dev/config/] — `test.setupFiles` and `test.environment` are documented Vitest 4 config options.

### Pattern 2: ESLint 9 flat-config coupling rule

**What:** A scoped config block in `eslint.config.js` that makes `no-restricted-imports` an error for any file inside `reviewer-v2/` that uses a `../` relative path. Zero new plugins.

**When to use:** This is a one-time addition; ESLint enforces it on every `npm run lint` call (and in CI).

**Key insight:** In ESLint 9 flat config, `files` uses glob patterns relative to the project root. The pattern `'src/reviewer-v2/**'` matches all files inside that directory. The `patterns: [{ group: ['../*'], message: '...' }]` option in `no-restricted-imports` catches any import that begins with `../`.

**Example:**
```javascript
// ui/eslint.config.js — additive block (append to existing defineConfig array)
// Source: eslint.org/docs/latest/rules/no-restricted-imports
{
  files: ['src/reviewer-v2/**'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['../*'],
            message:
              'reviewer-v2/ must not import from outside its subtree. ' +
              'Copy the utility into reviewer-v2/ instead.',
          },
        ],
      },
    ],
  },
}
```

[CITED: eslint.org/docs/latest/rules/no-restricted-imports] — `patterns` with `group` and `message` is documented behavior in ESLint 9.

### Pattern 3: `useReducer` with exported pure reducer (testable without renderer)

**What:** The annotation store follows the exact same pattern as `connectivity.ts` + `useHeartbeat.ts` — a pure reducer function exported for direct unit testing, wrapped by a hook that wires it to `useReducer`.

**Example:**
```typescript
// ui/src/reviewer-v2/hooks/useAnnotations.ts
// Source: codebase pattern (ui/src/hooks/useHeartbeat.ts + connectivity.ts)

import { useReducer } from 'react'
import type { Annotation, AnnotationAction } from '../types'

export interface AnnotationState {
  annotations: Annotation[]
}

const initialAnnotationState: AnnotationState = { annotations: [] }

// Exported for direct unit testing — no React renderer needed
export function annotationReducer(
  state: AnnotationState,
  action: AnnotationAction,
): AnnotationState {
  switch (action.type) {
    case 'add':
      return { annotations: [...state.annotations, action.annotation] }
    case 'edit':
      return {
        annotations: state.annotations.map((a) =>
          a.id === action.id ? { ...a, comment: action.comment } : a,
        ),
      }
    case 'remove':
      return { annotations: state.annotations.filter((a) => a.id !== action.id) }
  }
}

export function useAnnotations() {
  const [state, dispatch] = useReducer(annotationReducer, initialAnnotationState)

  return {
    annotations: state.annotations,
    addAnnotation: (annotation: Annotation) => dispatch({ type: 'add', annotation }),
    editAnnotation: (id: string, comment: string) => dispatch({ type: 'edit', id, comment }),
    removeAnnotation: (id: string) => dispatch({ type: 'remove', id }),
  }
}
```

[ASSUMED] — Specific Annotation type fields for Phase 17 (`{ id, anchorText, comment, type }`) match D-11 from CONTEXT.md; the discriminated union action pattern is standard TypeScript.

### Pattern 4: `main.tsx` routing branch

**What:** A simple pathname check that mounts either the existing `<App />` or the new `<ReviewerV2 />` before calling `createRoot`. No router library.

**Example:**
```tsx
// ui/src/main.tsx
// Source: D-01 from CONTEXT.md
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import ReviewerV2 from './reviewer-v2/ReviewerV2'

const isV2 = window.location.pathname.startsWith('/v2')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isV2 ? <ReviewerV2 /> : <App />}
  </StrictMode>,
)
```

### Pattern 5: 3-column layout shell with Tailwind 4

**What:** A `ReviewerV2` component that renders three named columns using CSS Grid or Flexbox. Columns must be visually distinct even with no content.

**Example (CSS Grid approach):**
```tsx
// ui/src/reviewer-v2/ReviewerV2.tsx
import { useHeartbeat } from './hooks/useHeartbeat'
import { useAnnotations } from './hooks/useAnnotations'

export default function ReviewerV2() {
  const _connectivity = useHeartbeat()
  const _annotationStore = useAnnotations()

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left column: outline */}
      <aside className="w-64 shrink-0 overflow-y-auto border-r border-neutral-700 bg-neutral-900">
        <p className="p-4 text-sm text-neutral-400">Outline</p>
      </aside>

      {/* Center column: content */}
      <main className="flex-1 overflow-y-auto bg-neutral-950">
        <p className="p-8 text-sm text-neutral-400">Content</p>
      </main>

      {/* Right column: comments */}
      <aside className="w-80 shrink-0 overflow-y-auto border-l border-neutral-700 bg-neutral-900">
        <p className="p-4 text-sm text-neutral-400">Comments</p>
      </aside>
    </div>
  )
}
```

[ASSUMED] — Specific Tailwind class names are Claude's discretion per CONTEXT.md; the `flex h-screen` approach is well-established for sticky-column UIs. Tailwind 4 class names are compatible with existing Tailwind 4 config.

### Anti-Patterns to Avoid

- **Importing from outside `reviewer-v2/` via relative paths:** `import { useHeartbeat } from '../hooks/useHeartbeat'` from inside reviewer-v2/ violates ARCH-01 and triggers the ESLint rule. Always copy the utility.
- **Putting the ESLint block inside the main `files: ['**/*.{ts,tsx}']` block:** The coupling rule must be in a separate config block with its own `files: ['src/reviewer-v2/**']` so it only fires for v2 files.
- **Using `vi.stubGlobal` for ResizeObserver without assigning to `global`:** In Vitest 4 + jsdom, `global.ResizeObserver = ...` is the direct assignment; `vi.stubGlobal` also works but adds an implicit vitest dependency in setup code. Both are valid.
- **Using `/// <reference types="vitest" />` in `vite.config.ts`:** No longer needed in Vitest 4 when importing from `vite`; only needed if `defineConfig` is imported from `vitest/config` instead. The existing `vite.config.ts` pattern is fine as-is.
- **Rendering `<ReviewerV2 />` inside `<App />` via a conditional:** The routing branch must be in `main.tsx` so the component trees are completely separate. `<App />` must not render `<ReviewerV2 />` at all.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| jsdom mock registration | Ad-hoc mocks inside individual test files | `vitest.setup.ts` registered via `test.setupFiles` | Setup files run once before all tests; per-file mocks are brittle and easy to forget |
| Import coupling enforcement | Code review checklist | ESLint `no-restricted-imports` with `files` scope | Lint runs on every save and in CI; manual review can't catch every violation |
| Routing | React Router or any router library | `window.location.pathname.startsWith('/v2')` | Zero dependency; no hydration concerns; matches the explicit D-01 decision |
| Testable state logic | React state tested via `@testing-library/react` | Exported pure reducer called directly | Project bans `@testing-library/react`; DI pattern is already established |

**Key insight:** The project has a consistent, verified pattern for testable state logic. Every new hook must export its pure function for direct testing. `useAnnotations` must follow the same pattern as `useHeartbeat` / `connectivity.ts`.

---

## Common Pitfalls

### Pitfall 1: Vitest runs in Node environment by default

**What goes wrong:** Adding `vitest.setup.ts` with `global.IntersectionObserver = ...` but not setting `test.environment: 'jsdom'` in `vite.config.ts` means the setup file runs in Node — there is no `window`, no `document`, and the mocks are irrelevant.

**Why it happens:** Vitest's default environment is `node`, not `jsdom`. The test suite currently passes in Node because existing tests test pure functions that don't use the DOM.

**How to avoid:** Always set `environment: 'jsdom'` alongside `setupFiles` in the same config change. The two are co-dependent.

**Warning signs:** Tests pass but `document` or `window` is undefined in test code. OR tests pass in isolation but fail when a component that touches `IntersectionObserver` is imported.

### Pitfall 2: ESLint `files` glob is relative to project root, not `src/`

**What goes wrong:** Writing `files: ['reviewer-v2/**']` instead of `files: ['src/reviewer-v2/**']` means ESLint never matches any files (the glob is relative to the `ui/` directory where `eslint.config.js` lives, not the `src/` subdirectory).

**Why it happens:** Confusion about what the glob is relative to. In ESLint flat config, file patterns are relative to the directory containing `eslint.config.js`.

**How to avoid:** Use `files: ['src/reviewer-v2/**']`. Verify with `npx eslint --print-config src/reviewer-v2/ReviewerV2.tsx` — the output should show `no-restricted-imports: error`.

**Warning signs:** `npm run lint` passes even after introducing a deliberate `import something from '../App'` inside `reviewer-v2/`.

### Pitfall 3: The `patterns: ['../*']` glob only blocks one level up

**What goes wrong:** `patterns: [{ group: ['../*'] }]` blocks `../foo` but not `../../foo`.

**Why it happens:** gitignore-style patterns do not match across directory separators by default. `../*` only matches one-level-up imports.

**How to avoid:** Use `patterns: [{ group: ['../*', '../../*', '../../../*'] }]` or use a single-star glob `['../**']` — but note that in `no-restricted-imports`, the `group` option uses gitignore-style patterns where `**` expands across separators. CONTEXT.md (specifics section) recommends blocking `'../**'` and `'./../**'` to catch both.

Per CONTEXT.md D-05 specifics: use `group: ['../**']` (covers any depth). Test with a two-level-deep import after writing the rule.

**Warning signs:** A file at `reviewer-v2/hooks/useAnnotations.ts` that imports `../../App` is not flagged.

### Pitfall 4: CSS.highlights assignment breaks when `CSS` is `undefined` in jsdom

**What goes wrong:** `CSS.highlights = new Map()` throws `TypeError: Cannot set properties of undefined` if `CSS` is not defined in the jsdom global scope at all.

**Why it happens:** jsdom may not define the global `CSS` object in older configurations. This depends on the jsdom version.

**How to avoid:** Guard the assignment:
```ts
if (typeof CSS === 'undefined') {
  (global as unknown as { CSS: Record<string, unknown> }).CSS = {}
}
if (!(CSS as { highlights?: unknown }).highlights) {
  (CSS as Record<string, unknown>).highlights = new Map()
}
```

**Warning signs:** `vitest.setup.ts` throws during test setup rather than in the test itself.

### Pitfall 5: Existing tests break when `environment: 'jsdom'` is added globally

**What goes wrong:** Adding `environment: 'jsdom'` globally affects all 46 existing tests. The existing tests are pure function tests that don't need DOM — they will still pass, but they run slightly slower due to jsdom initialization.

**Why it happens:** `test.environment` is global unless overridden per-file.

**How to avoid:** This is acceptable for this codebase — the existing tests are pure functions and don't break in jsdom. Verify by running `npm test` after adding `environment: 'jsdom'` to the config.

**Warning signs:** Existing tests fail after config change. If so, use the per-file `@vitest-environment` docblock to scope jsdom to v2 test files only.

---

## Code Examples

### Verified jsdom mock pattern (from codebase + vitest.dev docs)

```typescript
// Source: vitest.dev/config/ documentation + web search verification
// [CITED: vitest.dev/config/]

import { vi } from 'vitest'

global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}))

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))
```

### ESLint 9 flat config with `no-restricted-imports` (verified)

```javascript
// Source: eslint.org/docs/latest/rules/no-restricted-imports
// [CITED: eslint.org/docs/latest/rules/no-restricted-imports]

// In eslint.config.js, within the defineConfig([...]) array:
{
  files: ['src/reviewer-v2/**'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['../**'],
            message:
              'reviewer-v2/ files must not import from outside the subtree. ' +
              'Copy the utility into reviewer-v2/utils/ or reviewer-v2/hooks/.',
          },
        ],
      },
    ],
  },
}
```

### Pure reducer test (codebase pattern, no renderer)

```typescript
// Source: ui/src/utils/connectivity.test.ts (codebase, verbatim pattern)
// [VERIFIED: codebase grep]

import { describe, it, expect } from 'vitest'
import { annotationReducer } from './useAnnotations'
import type { AnnotationState } from './useAnnotations'

const initial: AnnotationState = { annotations: [] }

describe('annotationReducer', () => {
  it('add inserts an annotation', () => {
    const next = annotationReducer(initial, {
      type: 'add',
      annotation: { id: '1', anchorText: 'foo', comment: '', type: 'comment' },
    })
    expect(next.annotations).toHaveLength(1)
  })

  it('remove deletes by id', () => {
    const withOne = annotationReducer(initial, {
      type: 'add',
      annotation: { id: '1', anchorText: 'foo', comment: '', type: 'comment' },
    })
    const empty = annotationReducer(withOne, { type: 'remove', id: '1' })
    expect(empty.annotations).toHaveLength(0)
  })
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ESLint `.eslintrc.json` (legacy config) | ESLint 9 flat config (`eslint.config.js` with `defineConfig`) | ESLint 9 (2024) | `files` scoping is now a first-class config primitive; `overrides` is gone |
| Vitest configured separately in `vitest.config.ts` | Vitest `test` block inside `vite.config.ts` | Vitest 1+ | Single config file is preferred for small projects; `vitest.config.ts` still works and overrides if present |
| `@testing-library/react` for hook testing | Exported pure function + DI harness | This project's established pattern | No renderer dependency; faster tests; already in use for `useHeartbeat` |

**Deprecated/outdated:**
- `/// <reference types="vitest" />` triple-slash directive in `vite.config.ts`: No longer required in Vitest 4 when `test` block is added to `vite.config.ts` (types are inferred). Harmless if present.
- `test.globals: true`: Not required for this project — all tests import from `vitest` explicitly. Not needed here.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Tailwind 4 utility class names (`flex`, `h-screen`, `w-64`, etc.) work identically to Tailwind 3 in this project | Code Examples — Pattern 5 | Low — Tailwind 4 maintains backward compatibility for these core utilities; specific class names are Claude's discretion anyway |
| A2 | The Annotation type for Phase 17 is `{ id: string, anchorText: string, comment: string, type: 'comment' \| 'delete' \| 'replace' }` | Code Examples — Pattern 3 | Low — matches D-11 (minimal type) and the existing v1 `Annotation` interface; any deviation is caught by TypeScript |
| A3 | Adding `environment: 'jsdom'` globally in `vite.config.ts` does not break the 46 existing pure-function tests | Common Pitfalls — Pitfall 5 | Low — jsdom is a superset of Node for pure function tests; existing tests import no DOM APIs |
| A4 | `group: ['../**']` in `no-restricted-imports` catches multi-level relative imports (`../../`, `../../../`) | Architecture Patterns — Pattern 2 | Medium — gitignore `**` semantics across path separators; verified by documentation description but not tested live |

---

## Open Questions

1. **Does `group: ['../**']` actually block `../../` imports?**
   - What we know: ESLint docs describe `group` as using gitignore-style patterns; `**` is supposed to cross directory separators.
   - What's unclear: Live behavior with two-level-up imports has not been smoke-tested in this codebase.
   - Recommendation: The first task that writes the ESLint rule MUST include a verification step: add a deliberately violating import at `../../App`, run `npm run lint`, confirm it errors, then remove the violation.

2. **Does the existing `npm test` still pass after adding `environment: 'jsdom'`?**
   - What we know: All 46 existing tests are pure function tests with no DOM dependency.
   - What's unclear: There may be subtle Node-only globals that break in jsdom.
   - Recommendation: The task that modifies `vite.config.ts` must run `npm test` as its verification step immediately after the config change, before any other work.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/test toolchain | Yes | v25.8.1 | — |
| npm | Package installation | Yes | (bundled with Node) | — |
| jsdom (npm) | `environment: 'jsdom'` in Vitest | No (peer dep missing) | — | None — must install |
| Vitest 4 | Test runner | Yes | 4.1.4 (installed) | — |
| ESLint 9 | Lint / coupling enforcement | Yes | 9.39.4 (installed) | — |
| typescript-eslint 8 | TS ESLint support | Yes | 8.59.4 (installed) | — |
| Tailwind 4 | Layout CSS | Yes | 4.2.2 (installed) | — |

**Missing dependencies with no fallback:**
- `jsdom` — blocks `environment: 'jsdom'`; must be added as dev dep before any v2 component tests run.

**Missing dependencies with fallback:**
- None (only jsdom is missing, no fallback exists — it must be installed).

---

## Validation Architecture

> `workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`. This section is SKIPPED.

---

## Security Domain

This phase introduces no authentication, network endpoints, user input validation, cryptography, or session management. Phase 17 is a scaffolding phase with no user-facing data paths. Security domain is not applicable.

---

## Project Constraints (from CLAUDE.md)

The following directives from `CLAUDE.md` are binding on this phase:

1. **Tech stack is Rust + React 19 (not Svelte).** The UI is React 19. CLAUDE.md "Recommended Stack" section is aspirational/historical — anchor all decisions to `ui/` source. [VERIFIED: codebase — `ui/package.json` shows React 19]

2. **Code quality:** Before committing, run `cargo fmt` and `cargo clippy -- -D warnings`. This phase is TypeScript-only (no Rust changes), so only `npm run lint` applies. The ESLint rule added in this phase must not introduce new warnings or errors in existing code.

3. **Test coverage requirement:** Every plan that creates or modifies a TypeScript module with business logic MUST include at least one test. `useAnnotations.ts` contains business logic (reducer with non-trivial state transitions) and requires a test task. `ReviewerV2.tsx` is pure layout (no logic) — no test task required for the layout shell itself.

4. **No direct repo edits outside a GSD workflow.** All changes must flow through the planned phase execution.

5. **Git hooks:** The `.githooks/` pre-commit hook runs `cargo fmt` and `cargo clippy`. This phase makes no Rust changes, so hooks will pass. Verify `git config core.hooksPath .githooks` is active.

---

## Sources

### Primary (HIGH confidence)
- ESLint 9 flat config docs — `no-restricted-imports` rule, `patterns.group` option — [eslint.org/docs/latest/rules/no-restricted-imports](https://eslint.org/docs/latest/rules/no-restricted-imports)
- Vitest 4 config docs — `test.setupFiles`, `test.environment` — [vitest.dev/config/](https://vitest.dev/config/)
- Codebase — `ui/src/hooks/useHeartbeat.ts` — verbatim copy source; DI pattern for testable hooks
- Codebase — `ui/src/utils/connectivity.ts` — verbatim copy source; pure reducer pattern
- Codebase — `ui/eslint.config.js` — existing flat config structure; additive block target
- Codebase — `ui/vite.config.ts` — existing Vite config; `test` block insertion point
- Codebase — `ui/package.json` — installed deps; confirmed no jsdom present
- npm registry — `npm view jsdom` — version 29.1.1, published 2011, active (2026-04-30)

### Secondary (MEDIUM confidence)
- WebSearch — Vitest jsdom mock patterns for IntersectionObserver, ResizeObserver, CSS.highlights — multiple sources agree on `global.X = vi.fn().mockImplementation(...)` pattern
- WebSearch — ESLint 9 `no-restricted-imports` with `files`-scoped flat config block — verified against eslint.org docs

### Tertiary (LOW confidence)
- [ASSUMED] Tailwind 4 flex/grid class compatibility — training knowledge, not verified against Tailwind 4 changelog

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified on npm registry or confirmed installed
- Architecture: HIGH — directly derived from locked decisions in CONTEXT.md and existing codebase patterns
- Pitfalls: HIGH (Pitfalls 1–3) / MEDIUM (Pitfall 4–5) — verified against documentation; Pitfall 5 is a known jsdom concern from community patterns

**Research date:** 2026-05-20
**Valid until:** 2026-06-19 (30 days — stable tooling)
