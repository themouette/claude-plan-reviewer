# Phase 25: Diff Viewer UI - Pattern Map

**Mapped:** 2026-05-23
**Files analyzed:** 14 new/modified files
**Analogs found:** 13 / 14

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `ui/src/code-review/types.ts` | model | — | `ui/src/reviewer-v2/types.ts` | exact |
| `ui/src/code-review/hooks/useDiff.ts` | hook | request-response | `ui/src/reviewer-v2/useHeartbeat.ts` | role-match |
| `ui/src/code-review/CodeReviewApp.tsx` | component | request-response | `ui/src/reviewer-v2/ReviewerV2Shell.tsx` | role-match |
| `ui/src/code-review/AppToolbar.tsx` | component | event-driven | `ui/src/reviewer-v2/ReviewerV2Shell.tsx` (header strip) | partial |
| `ui/src/code-review/FileListPane.tsx` | component | event-driven | `ui/src/reviewer-v2/OutlinePane.tsx` | exact |
| `ui/src/code-review/DiffPane.tsx` | component | request-response | `ui/src/reviewer-v2/ReviewerV2Shell.tsx` (body column) | partial |
| `ui/src/main.tsx` | config | — | `ui/src/main.tsx` (self — modify) | self |
| `ui/eslint.config.js` | config | — | `ui/eslint.config.js` (self — modify) | self |
| `ui/src/code-review/CodeReviewApp.test.ts` | test | — | `ui/src/reviewer-v2/ReviewerV2Shell.test.ts` | exact |
| `ui/src/code-review/AppToolbar.test.ts` | test | — | `ui/src/reviewer-v2/ReviewerV2Shell.test.ts` | role-match |
| `ui/src/code-review/FileListPane.test.ts` | test | — | `ui/src/reviewer-v2/OutlinePane.test.ts` | exact |
| `ui/src/code-review/DiffPane.test.ts` | test | — | `ui/src/reviewer-v2/ReviewerV2Shell.test.ts` | role-match |
| `ui/src/code-review/hooks/useDiff.test.ts` | test | — | `ui/src/reviewer-v2/useHeartbeat.test.ts` | exact |
| `src/diff_api.rs` | route | request-response | `src/diff_api.rs` (self — modify) | self |
| `src/plan_review.rs` | route | request-response | `src/plan_review.rs` (self — modify) | self |

---

## Pattern Assignments

### `ui/src/code-review/types.ts` (model)

**Analog:** `ui/src/reviewer-v2/types.ts`

**Full source to copy structure from** (lines 1–22):
```typescript
// reviewer-v2/types.ts — copy this exact pattern: plain export interface, no default
export type AnnotationType = 'comment' | 'delete' | 'replace'

export interface Annotation {
  id: string
  anchorText: string
  // ...
}
```

**New file shape** (from RESEARCH.md Code Examples + Phase 24 backend):
```typescript
// ui/src/code-review/types.ts
export interface FileDiff {
  filename: string
  previous_filename?: string   // present only for renames
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied'
  additions: number
  deletions: number
  changes: number
  patch: string               // raw unified diff text, or "[binary file]"
}
```

No default export. Named exports only. No barrel index needed — components import directly from `./types`.

---

### `ui/src/code-review/hooks/useDiff.ts` (hook, request-response)

**Analog:** `ui/src/reviewer-v2/useHeartbeat.ts`

**Key pattern:** Extract an injectable interface for the testable logic (the project bans `@testing-library/react`). The hook wires the real `fetch`, but tests inject a fake via a context struct.

**Imports pattern** (useHeartbeat.ts lines 1–8):
```typescript
import { useEffect, useRef, useState } from 'react'
import {
  initialHeartbeatState,
  nextHeartbeatState,
  type ConnectivityStatus,
  type HeartbeatState,
} from './connectivity'
```

**Dependency-injection interface for testability** (useHeartbeat.ts lines 26–38):
```typescript
// Export a context interface so tests can inject a fake doFetch
export interface HeartbeatTickContext {
  doFetch: (signal: AbortSignal) => Promise<Response>
  isVisible: () => boolean
  isCancelled: () => boolean
  // ...
}
```

**Core hook shape** (useHeartbeat.ts lines 92–152 — adapt for useDiff):
```typescript
export function useHeartbeat(): ConnectivityStatus {
  const [status, setStatus] = useState<ConnectivityStatus>(initialHeartbeatState.status)
  const stateRef = useRef<HeartbeatState>(initialHeartbeatState)

  useEffect(() => {
    let cancelled = false

    async function tick() { /* calls doFetch, updates state */ }

    void tick()
    const id = window.setInterval(tick, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  return status
}
```

**useDiff adaptation:** Replace the polling pattern with a single fetch + refetch function. The `doFetch` injection point enables tests to mock the network without a renderer. Return `{ files, loading, error, refetch }` (see RESEARCH.md Pattern 2 for the full draft).

---

### `ui/src/code-review/CodeReviewApp.tsx` (component, request-response)

**Analog:** `ui/src/reviewer-v2/ReviewerV2Shell.tsx`

**Imports pattern** (ReviewerV2Shell.tsx lines 1–10):
```typescript
import { useEffect, useRef, useState } from 'react'
import ContentPane from './ContentPane'
import OutlinePane from './OutlinePane'
// ...
import type { Section } from './types'
```

**Shell structure pattern** (ReviewerV2Shell.tsx lines 35–68):
```tsx
return (
  <div className="flex flex-col h-screen overflow-hidden">
    {/* Header strip — 48px fixed height */}
    <header
      style={{
        height: 48,
        flexShrink: 0,
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 16,
        paddingRight: 16,
      }}
    >
      {/* ... toolbar content ... */}
    </header>

    {/* Body row — occupies remaining viewport height */}
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex' }}>
      {/* Left column */}
      <aside style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--color-border)', ... }} />
      {/* Main content */}
      <div ref={mainRef} style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex' }} />
    </div>
  </div>
)
```

**CodeReviewApp-specific dimensions** (from UI-SPEC): file list sidebar is 240px (not 200px — needs room for basename + status dot + counts). Replace `<OutlinePane>` with `<FileListPane>` and the main column with `<DiffPane>`.

**State owned here** (from CONTEXT.md D-13, D-05):
```tsx
const [diffStyle, setDiffStyle] = useState<'unified' | 'split'>('unified')
const [contextExpanded, setContextExpanded] = useState(false)
const { files, loading, error, refetch } = useDiff()
```

---

### `ui/src/code-review/AppToolbar.tsx` (component, event-driven)

**Analog:** `ui/src/reviewer-v2/ReviewerV2Shell.tsx` header strip (lines 38–63) + `ui/src/reviewer-v2/SubmitControls.tsx` button styling

**Header strip pattern** (ReviewerV2Shell.tsx lines 38–63):
```tsx
<header
  style={{
    height: 48,
    flexShrink: 0,
    background: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    paddingRight: 16,
  }}
>
  <div>
    <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--color-text-secondary)' }}>
      Reviewer v2
    </span>
  </div>
  <SubmitControls annotations={annotations} connectivity={connectivity} />
</header>
```

**Button height / border / focus ring pattern** (SubmitControls.tsx lines 109–136):
```tsx
<button
  type="button"
  style={{
    height: 32,
    paddingLeft: 16, paddingRight: 16,
    borderRadius: 6,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text-secondary)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    outline: 'none',
  }}
  onFocus={(e) => {
    e.currentTarget.style.outline = '2px solid var(--color-focus)'
    e.currentTarget.style.outlineOffset = '2px'
  }}
  onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
>
```

**AppToolbar is extracted as its own component** (not inlined in CodeReviewApp) because the RESEARCH.md AppToolbar code example defines a dedicated `AppToolbarProps` interface with `diffStyle`, `contextExpanded`, `contextLoading`, `onDiffStyleChange`, `onExpandAll`.

---

### `ui/src/code-review/FileListPane.tsx` (component, event-driven)

**Analog:** `ui/src/reviewer-v2/OutlinePane.tsx` — exact role match (sidebar navigation list with active tracking via IntersectionObserver + scrollIntoView)

**Imports pattern** (OutlinePane.tsx lines 1–2):
```typescript
import { useEffect, useRef } from 'react'
import type { Section } from './types'
```

**IntersectionObserver active tracking pattern** (OutlinePane.tsx lines 20–45):
```tsx
useEffect(() => {
  if (!mainRef.current || sections.length === 0) return
  const observer = new IntersectionObserver(
    (entries) => {
      const intersectingIds = new Set(
        entries.filter((e) => e.isIntersecting).map((e) => e.target.id),
      )
      if (intersectingIds.size > 0) {
        const first = sections.find((s) => intersectingIds.has(s.id))
        if (first) onActiveIdChange(first.id)
      }
    },
    {
      root: mainRef.current,          // CRITICAL: scroll container, not null
      rootMargin: '-10px 0px -85% 0px',
      threshold: 0,
    },
  )
  sections.forEach(({ id }) => {
    const el = document.getElementById(id)
    if (el) observer.observe(el)
  })
  return () => observer.disconnect()
}, [sections, mainRef, onActiveIdChange])
```

**ScrollIntoView on click pattern** (OutlinePane.tsx lines 64–68):
```tsx
onClick={() =>
  document
    .getElementById(section.id)
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
```

**Active item button style pattern** (OutlinePane.tsx lines 69–92):
```tsx
style={{
  width: '100%',
  textAlign: 'left',
  background: section.id === activeId ? 'var(--color-surface)' : 'transparent',
  color: section.id === activeId ? 'var(--color-focus)' : 'var(--color-text-secondary)',
  border: 'none',
  borderLeft: section.id === activeId
    ? '2px solid var(--color-focus)'
    : '2px solid transparent',
  paddingLeft: 16,
  paddingTop: 6,
  paddingBottom: 6,
  fontSize: 14,
  fontWeight: section.id === activeId ? 600 : 400,
  lineHeight: 1.4,
  cursor: 'pointer',
  display: 'block',
  minHeight: 28,
}}
```

**FileListPane deviations from OutlinePane:**
- Sections are `FileDiff[]` not `Section[]` — iterate by index for `id="file-{index}"` anchors
- Button content includes: status dot (8px circle), basename, `+N -M` counts, rename icon (↳)
- `mainRef` is a `diffPaneRef` passed in from `CodeReviewApp` (same pattern — scroll container ref)
- Status dot colors per UI-SPEC: added=`#22c55e`, deleted=`#ef4444`, modified=`#3b82f6` (= `--color-focus`), renamed=`#94a3b8` (= `--color-text-secondary`)

---

### `ui/src/code-review/DiffPane.tsx` (component, request-response)

**Analog:** `ui/src/reviewer-v2/ReviewerV2Shell.tsx` center column (lines 94–105) — no direct exact analog; DiffPane is primarily a render mapper.

**Column inner container pattern** (ReviewerV2Shell.tsx lines 94–104):
```tsx
<main style={{ flex: 1, minWidth: 0, background: 'var(--color-bg)', padding: 0 }}>
  <ContentPane
    onSectionsFound={setSections}
    // ...
  />
</main>
```

**DiffPane owns the scroll container** (from UI-SPEC): `flex: 1; min-width: 0; background: var(--color-bg); overflow-y: auto; padding: 0`. The `diffPaneRef` attached here is passed up to `CodeReviewApp` and down to `FileListPane` for `IntersectionObserver`.

**Loading/error/empty state pattern** — no direct analog. Use CSS custom properties and inline styles consistent with the rest of the codebase. Loading spinner from UI-SPEC: `border: 2px solid var(--color-border); border-top-color: var(--color-focus); border-radius: 50%; animation: spin 0.8s linear infinite` (the `@keyframes spin` is already in `index.css`).

**Binary file guard** (from RESEARCH.md Pitfall 5): check `file.patch === '[binary file]'` before passing to `PatchDiff`.

---

### `ui/src/main.tsx` (modify — route detection)

**Analog:** `ui/src/main.tsx` itself (current lines 1–10, modify)

**Current shape** (main.tsx lines 1–10):
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ReviewerV2 from './reviewer-v2/ReviewerV2'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReviewerV2 />
  </StrictMode>,
)
```

**After Phase 25 modification** (from RESEARCH.md Pattern 1):
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ReviewerV2 from './reviewer-v2/ReviewerV2'
import CodeReviewApp from './code-review/CodeReviewApp'

const isCodeReview = window.location.pathname.startsWith('/code-review')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isCodeReview ? <CodeReviewApp /> : <ReviewerV2 />}
  </StrictMode>,
)
```

---

### `ui/eslint.config.js` (modify — add `code-review/` isolation rule)

**Analog:** `ui/eslint.config.js` itself (current lines 24–40, modify)

**Existing `reviewer-v2/` isolation rule** (eslint.config.js lines 24–40):
```javascript
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
},
```

**New rule to add** (mirror the existing pattern exactly):
```javascript
{
  files: ['src/code-review/**'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['../reviewer-v2/**', '*/reviewer-v2/**'],
            message:
              'code-review/ files must not import from reviewer-v2/. ' +
              'Copy the utility into code-review/ or extract to shared/.',
          },
          {
            group: ['../**'],
            message:
              'code-review/ files must not import from outside the subtree. ' +
              'Copy the utility into code-review/ or extract to shared/.',
          },
        ],
      },
    ],
  },
},
```

---

### `src/diff_api.rs` (modify — add `?context=N` param)

**Analog:** `src/diff_api.rs` itself — existing handler patterns

**Existing handler signature** (diff_api.rs lines 192–194):
```rust
async fn get_diff_branch(State(state): State<Arc<CodeReviewState>>) -> impl IntoResponse {
    Json(try_branch_diff(&state.repo_path).unwrap_or_default())
}
```

**Existing `DiffOptions` construction** (diff_api.rs lines 207–208):
```rust
let mut opts = git2::DiffOptions::new();
opts.old_prefix("a/").new_prefix("b/");
```

**Query extractor pattern** (from RESEARCH.md Pattern 5 — verified against existing `State` and `Path` extractor usage in diff_api.rs):
```rust
use axum::extract::Query;
use serde::Deserialize;

#[derive(Deserialize)]
pub struct DiffContextQuery {
    context: Option<u32>,
}

async fn get_diff_branch(
    State(state): State<Arc<CodeReviewState>>,
    Query(params): Query<DiffContextQuery>,
) -> impl IntoResponse {
    let context_lines = params.context.unwrap_or(3);
    Json(try_branch_diff(&state.repo_path, context_lines).unwrap_or_default())
}
```

**`try_branch_diff` signature change:**
```rust
// Before:
fn try_branch_diff(repo_path: &std::path::Path) -> Option<Vec<FileDiff>> {

// After:
fn try_branch_diff(repo_path: &std::path::Path, context_lines: u32) -> Option<Vec<FileDiff>> {
    // ...
    let mut opts = git2::DiffOptions::new();
    opts.old_prefix("a/").new_prefix("b/");
    opts.context_lines(context_lines);   // NEW LINE
```

Apply the same change to `get_diff_commit` and a new `try_commit_diff(repo_path, sha, context_lines)` inner function.

---

### `src/plan_review.rs` (modify — ARCH-01 removal)

**Analog:** `src/plan_review.rs` itself (current lines 1–73)

**Items to remove:**
- Line 25: `pub diff_content: String,` field from `AppState`
- Lines 36–38: `get_diff` handler
- Line 70: `.route("/api/diff", get(get_diff))` line from `router()`

**Result:** `AppState` becomes:
```rust
pub struct AppState {
    pub plan_md: String,
    // diff_content REMOVED
    pub approve_label: String,
    pub deny_label: String,
    pub decision_tx: Mutex<Option<oneshot::Sender<Decision>>>,
}
```

**Cascade:** Removing `diff_content` from `AppState` requires updating all `AppState { ... }` construction calls in `src/server.rs` and `src/main.rs`. See RESEARCH.md Pitfall 2 for the ordered removal sequence.

---

## Test Pattern Assignments

### `ui/src/code-review/CodeReviewApp.test.ts`

**Analog:** `ui/src/reviewer-v2/ReviewerV2Shell.test.ts`

**Source-file assertion pattern** (ReviewerV2Shell.test.ts lines 1–15):
```typescript
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import CodeReviewApp from './CodeReviewApp'

const source = readFileSync(
  resolve(__dirname, './CodeReviewApp.tsx'),
  'utf-8',
)

describe('CodeReviewApp', () => {
  it('exports a function as default', () => {
    expect(typeof CodeReviewApp).toBe('function')
  })

  it('source contains useDiff import and usage', () => {
    expect(source).toContain('useDiff')
  })

  it('source declares diffStyle state with useState', () => {
    expect(source).toContain("useState<'unified' | 'split'>")
  })
  // ...
})
```

### `ui/src/code-review/FileListPane.test.ts`

**Analog:** `ui/src/reviewer-v2/OutlinePane.test.ts`

**Pattern** (OutlinePane.test.ts lines 1–55):
```typescript
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import FileListPane from './FileListPane'

const source = readFileSync(resolve(__dirname, './FileListPane.tsx'), 'utf-8')

describe('FileListPane', () => {
  it('exports a function as default', () => {
    expect(typeof FileListPane).toBe('function')
  })

  it('uses IntersectionObserver for active file tracking', () => {
    expect(source).toContain('IntersectionObserver')
  })

  it('uses scrollIntoView for file navigation', () => {
    expect(source).toContain('scrollIntoView')
  })

  it('uses <button> not <a href=> for file entries', () => {
    expect(source).toContain('<button')
    expect(source).not.toContain('<a href=')
  })
  // ...
})
```

### `ui/src/code-review/hooks/useDiff.test.ts`

**Analog:** `ui/src/reviewer-v2/useHeartbeat.test.ts`

**Dependency-injection harness pattern** (useHeartbeat.test.ts lines 1–58):
```typescript
import { describe, it, expect } from 'vitest'
import { runHeartbeatTick, type HeartbeatTickContext } from './useHeartbeat'

interface Harness {
  // ...injected dependencies as mutable refs...
  fetchCalls: AbortSignal[]
}

function createHarness(opts: {
  doFetch: (signal: AbortSignal) => Promise<Response>
}): Harness {
  // ...returns wired-up ctx object...
}

describe('runHeartbeatTick (v2 copy)', () => {
  it('v2 copy: successful fetch keeps status online without calling onStatus', async () => {
    const h = createHarness({
      doFetch: () => Promise.resolve(new Response(null, { status: 200 })),
    })
    await runHeartbeatTick(h.ctx)
    expect(h.state.value.status).toBe('online')
  })
})
```

**useDiff adaptation:** Export a `fetchDiff(url: string, doFetch: typeof fetch): Promise<FileDiff[]>` pure function alongside `useDiff()`. Tests invoke `fetchDiff` directly with a fake `doFetch` — no renderer needed.

---

## Shared Patterns

### CSS Custom Property Tokens
**Source:** `ui/src/index.css` (verified by RESEARCH.md)
**Apply to:** All new `code-review/` component files

Use only these tokens (never hardcode colors):
- `--color-bg` — page background, diff pane background
- `--color-surface` — sidebar, toolbar background
- `--color-border` — dividers, button borders
- `--color-text-primary` — active labels, headings
- `--color-text-secondary` — inactive labels, metadata
- `--color-focus` — active left border, focus rings, modified file dot
- `--color-accent-approve` — added file dot (`#22c55e` / `#16a34a`)
- `--color-accent-deny` — deleted file dot (`#ef4444` / `#dc2626`)

Exception: status dots use the token semantic values directly; pass as inline style values `'var(--color-accent-approve)'` etc.

### Focus Ring Pattern
**Source:** `ui/src/reviewer-v2/SubmitControls.tsx` lines 127–131
**Apply to:** All interactive `<button>` elements in `code-review/`
```tsx
onFocus={(e) => {
  e.currentTarget.style.outline = '2px solid var(--color-focus)'
  e.currentTarget.style.outlineOffset = '2px'
}}
onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
```

### Source-File Assertion Test Pattern
**Source:** `ui/src/reviewer-v2/ReviewerV2Shell.test.ts` lines 1–15
**Apply to:** `CodeReviewApp.test.ts`, `AppToolbar.test.ts`, `FileListPane.test.ts`, `DiffPane.test.ts`

```typescript
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import ComponentName from './ComponentName'

const source = readFileSync(resolve(__dirname, './ComponentName.tsx'), 'utf-8')
```

No `@testing-library/react` — it is not installed and the project explicitly rejects it.

### Axum `State` Extraction Pattern
**Source:** `src/diff_api.rs` lines 192–194, 270–273
**Apply to:** Modified handlers in `diff_api.rs`
```rust
async fn get_diff_branch(
    State(state): State<Arc<CodeReviewState>>,
    Query(params): Query<DiffContextQuery>,    // add this extractor
) -> impl IntoResponse {
```

Multiple extractors are listed as comma-separated function parameters. `State` must come before `Query` and `Path` extractors (axum extractor ordering convention).

### Rust Test Fixture Helpers
**Source:** `src/diff_api.rs` lines 370–468
**Apply to:** Any new `#[tokio::test]` functions in `diff_api.rs`

The `make_repo_with_main()` and `make_repo_with_main_and_feature()` helpers plus the `do_get()` helper are already defined — reuse them. Do not define new fixture helpers if the existing ones cover the scenario.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `ui/src/code-review/DiffPane.tsx` (fully) | component | request-response | No existing "list of diff components" pane exists — closest is the `ContentPane` prose renderer, but that is HTML not `PatchDiff` instances. Planner should use RESEARCH.md Pattern 3 for the `PatchDiff` usage and binary file guard. |

---

## Metadata

**Analog search scope:** `ui/src/reviewer-v2/`, `src/*.rs`, `ui/src/main.tsx`, `ui/eslint.config.js`
**Files scanned:** 15
**Pattern extraction date:** 2026-05-23
