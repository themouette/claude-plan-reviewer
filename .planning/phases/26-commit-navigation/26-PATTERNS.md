# Phase 26: Commit Navigation - Pattern Map

**Mapped:** 2026-05-24
**Files analyzed:** 7 (2 new, 5 modified)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `ui/src/code-review/hooks/useCommits.ts` | hook | request-response | `ui/src/code-review/hooks/useDiff.ts` | exact |
| `ui/src/code-review/hooks/useCommits.test.ts` | test | — | `ui/src/code-review/hooks/useDiff.test.ts` | exact |
| `ui/src/code-review/CommitDrawer.tsx` | component | event-driven | `ui/src/code-review/FileListPane.tsx` | role-match |
| `ui/src/code-review/types.ts` | model | — | `ui/src/code-review/types.ts` (existing) | exact |
| `ui/src/code-review/CodeReviewApp.tsx` | component | event-driven | `ui/src/code-review/CodeReviewApp.tsx` (existing) | exact |
| `ui/src/code-review/AppToolbar.tsx` | component | event-driven | `ui/src/code-review/AppToolbar.tsx` (existing) | exact |
| `ui/src/code-review/DiffPane.tsx` | component | request-response | `ui/src/code-review/DiffPane.tsx` (existing) | exact |

---

## Pattern Assignments

### `ui/src/code-review/hooks/useCommits.ts` (hook, request-response)

**Analog:** `ui/src/code-review/hooks/useDiff.ts`

**Imports pattern** (lines 1-3):
```typescript
import { useEffect, useRef, useState } from 'react'
import type { Commit } from '../types'
```

**DoFetch type and result interface** (lines 6-16 of useDiff.ts — mirror exactly):
```typescript
export type DoFetch = (url: string) => Promise<Response>

export interface FetchCommitsResult {
  commits: Commit[]
  truncated: boolean
  error: string | null
}
```

**Core pure function pattern** (lines 19-38 of useDiff.ts — structural copy for `/api/commits`):
```typescript
export async function fetchCommitsOnce(doFetch: DoFetch): Promise<FetchCommitsResult> {
  try {
    const res = await doFetch('/api/commits')
    if (!res.ok) {
      return { commits: [], truncated: false, error: 'fetch failed' }
    }
    const data = (await res.json()) as { commits: Commit[]; truncated: boolean }
    return { commits: data.commits, truncated: data.truncated, error: null }
  } catch {
    return { commits: [], truncated: false, error: 'network error' }
  }
}
```

**Hook with cancelledRef pattern** (lines 56-91 of useDiff.ts — mirror exactly):
```typescript
// Note: loading initialized to true — do NOT call setLoading(true) inside useEffect body
// (violates react-hooks/set-state-in-effect). Same constraint as useDiff.
export function useCommits(): UseCommitsResult {
  const [commits, setCommits] = useState<Commit[]>([])
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false
    void fetchCommitsOnce(globalThis.fetch.bind(globalThis)).then((result) => {
      if (cancelledRef.current) return
      setCommits(result.commits)
      setTruncated(result.truncated)
      setError(result.error)
      setLoading(false)
    })
    return () => {
      cancelledRef.current = true
    }
  }, [])

  return { commits, truncated, loading, error }
}
```

**Key constraint:** No `refetch` needed on `useCommits` (commits don't change during a session). `useDiff` exports `refetch` — `useCommits` does not.

---

### `ui/src/code-review/hooks/useCommits.test.ts` (test, pure-function)

**Analog:** `ui/src/code-review/hooks/useDiff.test.ts`

**Test file structure** (lines 1-74 of useDiff.test.ts — mirror exactly):
```typescript
import { describe, it, expect } from 'vitest'
import { fetchCommitsOnce } from './useCommits'
import type { Commit } from '../types'

// Minimal valid Commit fixture
const sampleCommit: Commit = {
  sha: 'abc1234567890',
  short_sha: 'abc1234',
  message: 'Fix login bug',
  author: 'Alice',
  email: 'alice@example.com',
  date: '2026-05-24T10:00:00Z',
}

describe('fetchCommitsOnce', () => {
  it('resolves to { commits, error: null } on a 200 response', async () => {
    const doFetch = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({ commits: [sampleCommit], truncated: false }),
          { status: 200 },
        ),
      )
    const result = await fetchCommitsOnce(doFetch)
    expect(result.error).toBeNull()
    expect(result.commits).toHaveLength(1)
    expect(result.truncated).toBe(false)
  })

  it('resolves to { commits: [], error: "fetch failed" } on non-ok response', async () => {
    const doFetch = () => Promise.resolve(new Response(null, { status: 500 }))
    const result = await fetchCommitsOnce(doFetch)
    expect(result.commits).toHaveLength(0)
    expect(result.error).toBe('fetch failed')
  })

  it('resolves to { commits: [], error: "network error" } when doFetch throws', async () => {
    const doFetch = (): Promise<Response> => Promise.reject(new Error('network failure'))
    const result = await fetchCommitsOnce(doFetch)
    expect(result.commits).toHaveLength(0)
    expect(result.error).toBe('network error')
  })
})
```

**Test style notes:**
- Uses `readFileSync` + source-text assertions for component shape verification (pattern from `AppToolbar.test.ts`, `CodeReviewApp.test.ts`, `DiffPane.test.ts`)
- Uses direct pure-function calls for `fetchCommitsOnce` (pattern from `useDiff.test.ts`)
- No `@testing-library/react` renderer — `fetchCommitsOnce` is tested directly

---

### `ui/src/code-review/CommitDrawer.tsx` (component, event-driven)

**Analog:** `ui/src/code-review/FileListPane.tsx`

**Imports pattern** (lines 1-3 of FileListPane.tsx):
```typescript
import type { Commit } from './types'
// Note: no useEffect/useRef needed — CommitDrawer is a pure display component
```

**Props interface** (mirrors FileListPane.tsx props shape):
```typescript
export interface CommitDrawerProps {
  commits: Commit[]
  loading: boolean
  error: string | null
  activeCommitSha: string | null
  checkedCommitShas: string[]
  onCommitClick: (sha: string) => void
  onCheckChange: (sha: string, checked: boolean) => void
}
```

**Overlay positioning pattern** (from RESEARCH.md Pattern 5 — VERIFY parent has `position: relative`):
```typescript
// CommitDrawer root element — position: absolute within position: relative parent
<aside
  role="navigation"
  aria-label="Branch commits"
  style={{
    position: 'absolute',
    top: 0,
    left: 0,
    width: 296,           // midpoint of D-04 280–320px range
    height: '100%',
    background: 'var(--color-surface)',
    borderRight: '1px solid var(--color-border)',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
  }}
>
```

**Active row style pattern** (lines 101-119 of FileListPane.tsx — adapt for commit rows):
```typescript
// Active row uses borderLeft accent — same token as FileListPane
borderLeft: isActive ? '2px solid var(--color-focus)' : '2px solid transparent',
background: isActive ? 'var(--color-bg)' : 'transparent',
color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
fontWeight: isActive ? 600 : 400,
```

**SHA chip pattern** (from RESEARCH.md CommitRow example):
```typescript
// SHA chip: monospace font, blue-tinted background, bordered
<span style={{
  fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
  fontSize: 12,
  padding: '4px 8px',
  borderRadius: 4,
  border: '1px solid var(--color-border)',
  background: 'rgba(59,130,246,0.12)',
  color: 'var(--color-text-secondary)',
  flexShrink: 0,
}}>
  {commit.short_sha}
</span>
```

**Checkbox stopPropagation pattern** (from RESEARCH.md Anti-Patterns):
```typescript
// Checkbox must stop propagation; row click must NOT stop propagation
<input
  type="checkbox"
  checked={isChecked}
  onChange={(e) => {
    e.stopPropagation()
    onCheckChange(commit.sha, e.target.checked)
  }}
  onClick={(e) => e.stopPropagation()}
/>
```

**Loading spinner pattern** (lines 72-96 of DiffPane.tsx — copy spinner exactly):
```typescript
// Same spin animation as DiffPane loading state
<div style={{
  width: 24, height: 24,
  border: '2px solid var(--color-border)',
  borderTopColor: 'var(--color-focus)',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
}} />
```

---

### `ui/src/code-review/types.ts` (model — modification)

**Analog:** `ui/src/code-review/types.ts` (existing file)

**Existing interface** (lines 1-11):
```typescript
export interface FileDiff {
  filename: string
  previous_filename?: string  // snake_case — matches Rust JSON, no rename_all
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied'
  // ...
}
```

**New Commit interface to add** (mirrors Rust `Commit` struct from `src/diff_api.rs`):
```typescript
// Add after FileDiff — same snake_case convention as FileDiff (no rename_all on Rust struct)
export interface Commit {
  sha: string
  short_sha: string    // 7 chars
  message: string
  author: string
  email: string
  date: string         // ISO 8601 / RFC 3339
}
```

**Convention note:** `previous_filename` uses snake_case because the Rust struct has no `rename_all`. The new `Commit` interface must use snake_case (`short_sha`) for the same reason — the JSON field from `/api/commits` is `short_sha`, not `shortSha`.

---

### `ui/src/code-review/CodeReviewApp.tsx` (component — modification)

**Analog:** `ui/src/code-review/CodeReviewApp.tsx` (existing, lines 1-73)

**Existing imports** (lines 1-6):
```typescript
import { useEffect, useRef, useState } from 'react'
import AppToolbar from './AppToolbar'
import FileListPane from './FileListPane'
import DiffPane from './DiffPane'
import { useDiff } from './hooks/useDiff'
```

**New imports to add:**
```typescript
import CommitDrawer from './CommitDrawer'
import { useCommits } from './hooks/useCommits'
```

**State ownership pattern** (lines 8-12 — add new state below existing):
```typescript
// Existing state
const [diffStyle, setDiffStyle] = useState<'unified' | 'split'>('unified')
const [contextExpanded, setContextExpanded] = useState(false)
const [activeIndex, setActiveIndex] = useState<number | null>(null)

// Phase 26 additions — all commit state in CodeReviewApp per D-11
const [drawerOpen, setDrawerOpen] = useState(false)
const [viewMode, setViewMode] = useState<'branch' | 'commit'>('branch')
const [activeCommitSha, setActiveCommitSha] = useState<string | null>(null)
const [checkedCommitShas, setCheckedCommitShas] = useState<string[]>([])
const { commits, loading: commitsLoading, error: commitsError } = useCommits()
```

**Deferred setTimeout pattern for state seeding** (lines 30-33 — copy exactly for checkedCommitShas init):
```typescript
// Seed checkedCommitShas to all SHAs when commits first load (D-08 opt-out model).
// setTimeout(0) deferral avoids react-hooks/set-state-in-effect violation.
// Same pattern as activeIndex reset below.
useEffect(() => {
  const id = setTimeout(() => {
    if (commits.length > 0) setCheckedCommitShas(commits.map((c) => c.sha))
  }, 0)
  return () => clearTimeout(id)
}, [commits.length])
```

**Keyboard navigation handler** (lines 30-33 pattern extended — copy useEffect shape):
```typescript
// Keyboard navigation — only active in per-commit mode (D-09, D-10)
// Include all captured values in deps to avoid stale closure (RESEARCH Pitfall 2)
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if (viewMode !== 'commit' || commits.length === 0 || activeCommitSha === null) return
    const idx = commits.findIndex((c) => c.sha === activeCommitSha)
    if (e.key === 'ArrowLeft' && idx > 0) {
      setActiveCommitSha(commits[idx - 1].sha)
    } else if (e.key === 'ArrowRight' && idx < commits.length - 1) {
      setActiveCommitSha(commits[idx + 1].sha)
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [viewMode, activeCommitSha, commits])
```

**Drawer toggle handler** (from RESEARCH.md Pattern 6):
```typescript
function handleCommitsToggle() {
  if (drawerOpen) {
    // Closing — return to branch mode (D-07)
    setDrawerOpen(false)
    setViewMode('branch')
    setActiveCommitSha(null)
  } else {
    setDrawerOpen(true)
    // viewMode stays as-is — user may re-open to previously clicked commit
  }
}
```

**aside wrapper addition** (lines 44-61 — add `position: relative` to the existing aside):
```typescript
// Existing aside — add position: 'relative' so CommitDrawer absolute positioning works
<aside
  style={{
    width: 240,
    flexShrink: 0,
    borderRight: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    overflowY: 'auto',
    padding: '8px 0',
    position: 'relative',   // REQUIRED for CommitDrawer position: absolute child
  }}
>
  {drawerOpen && (
    <CommitDrawer
      commits={commits}
      loading={commitsLoading}
      error={commitsError}
      activeCommitSha={activeCommitSha}
      checkedCommitShas={checkedCommitShas}
      onCommitClick={(sha) => {
        setActiveCommitSha(sha)
        setViewMode('commit')
      }}
      onCheckChange={(sha, checked) => {
        setCheckedCommitShas((prev) =>
          checked ? [...prev, sha] : prev.filter((s) => s !== sha),
        )
      }}
    />
  )}
  <FileListPane ... />
</aside>
```

---

### `ui/src/code-review/AppToolbar.tsx` (component — modification)

**Analog:** `ui/src/code-review/AppToolbar.tsx` (existing, lines 1-129)

**Props interface extension** (lines 3-9 — add two new props):
```typescript
export interface AppToolbarProps {
  diffStyle: 'unified' | 'split'
  contextExpanded: boolean
  contextLoading: boolean
  onDiffStyleChange: (style: 'unified' | 'split') => void
  onExpandAll: () => void
  // Phase 26 additions
  commitsOpen: boolean
  onCommitsToggle: () => void
}
```

**Commits toggle button** (lines 103-125 pattern — copy Expand All button structure):
```typescript
// Add BEFORE the layout toggle group (right-side controls)
// Follows exact same style pattern as the Expand All button
<button
  type="button"
  onClick={onCommitsToggle}
  style={{
    height: 32,
    padding: '0 16px',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    fontSize: 14,
    cursor: 'pointer',
    outline: 'none',
    background: 'var(--color-surface)',
    color: commitsOpen ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
    fontWeight: commitsOpen ? 600 : 400,
  }}
  {...makeFocusHandlers('commits')}
>
  Commits
</button>
```

**Focus handler pattern** (lines 20-33 — reuse existing `makeFocusHandlers`):
```typescript
// makeFocusHandlers is already defined in AppToolbar — pass 'commits' as the id
// onFocus sets outline; onBlur clears it — same for all buttons in the toolbar
{...makeFocusHandlers('commits')}
```

---

### `ui/src/code-review/DiffPane.tsx` (component — modification)

**Analog:** `ui/src/code-review/DiffPane.tsx` (existing, lines 1-269)

**Props interface extension** (lines 49-56 — add four new props):
```typescript
export interface DiffPaneProps {
  files: FileDiff[]
  loading: boolean
  error: string | null
  diffStyle: 'unified' | 'split'
  diffPaneRef: React.RefObject<HTMLDivElement | null>
  onReload: () => void
  // Phase 26 additions
  viewMode: 'branch' | 'commit'
  activeCommitSha: string | null
  commits: Commit[]       // needed for title strip lookup
}
```

**New imports** (lines 1-4 — add Commit type):
```typescript
import type { FileDiff, Commit } from './types'
```

**Commit title strip** (inserted between DiffPane root div and file list, from RESEARCH.md Pattern 7):
```typescript
// Render above file list when in per-commit mode
// Uses same background/border/padding tokens as file header divs (lines 207-214)
{viewMode === 'commit' && activeCommit && (
  <div style={{
    background: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-border)',
    padding: '8px 16px',
  }}>
    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
      {activeCommit.short_sha} — {activeCommit.message}
    </div>
    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
      {activeCommit.author} · {activeCommit.date}
    </div>
  </div>
)}
```

**Per-commit fetch pattern** (new `useEffect` inside DiffPane — RESEARCH recommendation A3):
```typescript
// If DiffPane owns the per-commit fetch (per RESEARCH open question 2):
// Keep fetch deps tied ONLY to [viewMode, activeCommitSha] — not to diffStyle
// (diffStyle affects rendering only, not fetching — RESEARCH Pitfall 5)
useEffect(() => {
  if (viewMode !== 'commit' || activeCommitSha === null) return
  // fetch /api/diff/commit/{sha} and update local files state
}, [viewMode, activeCommitSha])  // NOT diffStyle
```

**Loading/error/empty state pattern** (lines 71-252 — reuse existing `renderContent()` structure unchanged):
```typescript
// Existing renderContent() handles loading, error, empty, and content states.
// Per-commit mode uses the same states — no new state machine needed.
// The commit title strip renders outside renderContent(), above the content area.
```

---

## Shared Patterns

### CSS Variable Tokens
**Source:** `ui/src/code-review/AppToolbar.tsx` and `ui/src/code-review/FileListPane.tsx`
**Apply to:** `CommitDrawer.tsx`, `DiffPane.tsx` commit title strip
```typescript
// Color tokens used throughout code-review components:
var(--color-surface)        // background for panels, headers, toolbar
var(--color-bg)             // active row background, outer diff container
var(--color-border)         // all border rules
var(--color-text-primary)   // active/selected text, headings
var(--color-text-secondary) // inactive text, metadata, paths
var(--color-focus)          // focus outline, active indicator borderLeft
var(--color-accent-deny)    // error state heading color
```

### Focus Ring Pattern
**Source:** `ui/src/code-review/AppToolbar.tsx` lines 20-33 (`makeFocusHandlers`)
**Apply to:** All interactive buttons in `CommitDrawer.tsx`, `AppToolbar.tsx` Commits button
```typescript
// All buttons use inline style focus rings (not CSS :focus) via onFocus/onBlur handlers
onFocus: (e: React.FocusEvent<HTMLButtonElement>) => {
  e.currentTarget.style.outline = '2px solid var(--color-focus)'
  e.currentTarget.style.outlineOffset = '2px'
},
onBlur: (e: React.FocusEvent<HTMLButtonElement>) => {
  e.currentTarget.style.outline = 'none'
},
```

### Active Indicator (borderLeft Accent)
**Source:** `ui/src/code-review/FileListPane.tsx` lines 104-119
**Apply to:** `CommitDrawer.tsx` CommitRow active state
```typescript
// Active rows in navigation lists use 2px left border + subtle background
borderLeft: isActive ? '2px solid var(--color-focus)' : '2px solid transparent',
background: isActive ? 'var(--color-bg)' : 'transparent',
```

### Loading Spinner
**Source:** `ui/src/code-review/DiffPane.tsx` lines 72-96
**Apply to:** `CommitDrawer.tsx` loading state
```typescript
// Same spinner animation is used everywhere loading states exist
// @keyframes spin must be defined in ui/src/index.css (already present from Phase 25)
<div style={{
  width: 24, height: 24,
  border: '2px solid var(--color-border)',
  borderTopColor: 'var(--color-focus)',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
}} />
```

### Source-Text Test Pattern
**Source:** `ui/src/code-review/AppToolbar.test.ts` lines 1-8, `CodeReviewApp.test.ts` lines 1-8
**Apply to:** `CommitDrawer.test.ts`, `useCommits.test.ts`, modified `AppToolbar.test.ts`, `CodeReviewApp.test.ts`, `DiffPane.test.ts`
```typescript
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import ComponentUnderTest from './ComponentUnderTest'

const source = readFileSync(resolve(__dirname, './ComponentUnderTest.tsx'), 'utf-8')

describe('ComponentUnderTest', () => {
  it('exports a function as default', () => {
    expect(typeof ComponentUnderTest).toBe('function')
  })
  // ...source.toContain() assertions for key implementation details
})
```

### No-Restricted-Imports Rule
**Source:** `ui/eslint.config.ts`
**Apply to:** ALL new Phase 26 files
```typescript
// All new files are under ui/src/code-review/ and MUST NOT import from ui/src/reviewer-v2/
// Each test file should assert:
it('does not import from reviewer-v2/', () => {
  expect(source).not.toContain('reviewer-v2/')
})
```

### SetState-in-Effect Deferral
**Source:** `ui/src/code-review/CodeReviewApp.tsx` lines 30-33
**Apply to:** `CodeReviewApp.tsx` — `checkedCommitShas` initialization
```typescript
// Avoids react-hooks/set-state-in-effect ESLint violation.
// Use setTimeout(0) for any setState inside a useEffect that runs on state change.
useEffect(() => {
  const id = setTimeout(() => { /* setState here */ }, 0)
  return () => clearTimeout(id)
}, [someDependency])
```

---

## No Analog Found

No files in Phase 26 lack a codebase analog. All patterns are directly derivable from existing code.

---

## Metadata

**Analog search scope:** `ui/src/code-review/` (all files), `ui/src/code-review/hooks/`
**Files scanned:** 9 source files + 5 test files
**Pattern extraction date:** 2026-05-24
