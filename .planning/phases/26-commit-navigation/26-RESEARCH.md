# Phase 26: Commit Navigation - Research

**Researched:** 2026-05-24
**Domain:** React 19 + TypeScript frontend — commit list drawer, per-commit diff view, keyboard navigation, multi-commit checkbox filtering
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Commit Panel Layout (D-01–D-04)**
- D-01: Collapsible side drawer that slides over the existing file list sidebar from the left. Overlays the file list — no third column.
- D-02: Drawer toggle is an AppToolbar button in the existing header row.
- D-03: Drawer open/close is snap/instant — no CSS transition or animation.
- D-04: Drawer is 280–320px wide (exact is Claude's discretion).

**Mode & Select Model (D-05–D-08)**
- D-05: Two separate gestures — clicking a commit row switches to per-commit view; checkboxes independently control which commits are included in the full-branch combined diff.
- D-06: In per-commit view, diff pane title shows `{short_sha} — {commit message}`. No toolbar badge.
- D-07: Returning to full-branch view is triggered by closing the commit drawer. No separate "Full diff" button.
- D-08: Default checkbox state when drawer first opens: all checked (opt-out model).

**Keyboard Navigation (D-09–D-10)**
- D-09: Arrow key navigation active only when in per-commit mode. In full-branch view, arrow keys do nothing special.
- D-10: Left arrow = previous commit; Right arrow = next commit. Up/down arrows are not wired to commit navigation.

**State Ownership (D-11–D-13)**
- D-11: All commit-related state lives in `CodeReviewApp`: `drawerOpen: boolean`, `viewMode: 'branch' | 'commit'`, `activeCommitSha: string | null`, `checkedCommitShas: string[]`.
- D-12: `useCommits` follows the same injectable doFetch pattern as `useDiff`: exports `fetchCommitsOnce(doFetch)` + `useCommits()` hook with cancelledRef. Tests call `fetchCommitsOnce` directly.
- D-13: When in per-commit view and the user unchecks a commit, nothing immediate happens — unchecking only affects full-branch mode. The two gestures are fully independent.

### Claude's Discretion

- Exact drawer width within 280–320px range
- Commit row layout (short_sha chip + truncated message + author + date — exact column widths)
- Empty state when no commits are found
- What happens at boundary: arrow keys at first/last commit (wrap vs stop — stop chosen per UI-SPEC)
- Loading state for the commit list (spinner or skeleton)
- How `checkedCommitShas` is passed to the diff fetch — client-side union chosen (no new backend param)

### Deferred Ideas (OUT OF SCOPE)

- Theme switcher, help icon, GitHub link in AppToolbar
- Worker pool for @pierre/diffs (disableWorkerPool=true remains)
- Animation/transition for commit drawer — snap/instant for Phase 26
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMMIT-01 | User can view a list of all commits in the current branch | `/api/commits` exists (Phase 24); `useCommits` hook mirrors `useDiff` pattern |
| COMMIT-02 | User can click a commit to view its individual diff | `/api/diff/commit/{sha}` exists (Phase 24); DiffPane receives `viewMode` + `activeCommitSha` |
| COMMIT-03 | User can switch between per-commit view and full branch diff mode | Drawer close triggers mode switch (D-07); `viewMode` state in CodeReviewApp |
| COMMIT-04 | User can navigate between commits with keyboard (prev/next) | `keydown` listener on `window` in CodeReviewApp `useEffect`; left/right arrows only |
| DIFF-05 | User can select which commits to include in the current diff view | `checkedCommitShas` state; client-side union of `/api/diff/commit/{sha}` responses |
</phase_requirements>

---

## Summary

Phase 26 is a pure frontend phase — no Rust backend changes are needed. All three backend endpoints (`/api/commits`, `/api/diff/branch`, `/api/diff/commit/{sha}`) were fully implemented and tested in Phase 24. Phase 26 wires them into the UI by adding: a `CommitDrawer` component that lists commits, a `useCommits` hook that mirrors `useDiff` exactly, new state in `CodeReviewApp`, extensions to `AppToolbar`, mode-aware rendering in `DiffPane`, and keyboard navigation via a `keydown` handler.

The key complexity is in three interactions: (1) the orthogonal commit-click-to-view vs checkbox-to-filter model (D-05, D-13); (2) the DIFF-05 client-side union of `FileDiff[]` arrays when a subset of commits is checked in branch view; and (3) the keyboard handler that must stay dormant during branch view and activate only in commit view (D-09).

The test pattern for this phase is source-text inspection (as used in `CodeReviewApp.test.ts`, `AppToolbar.test.ts`, `DiffPane.test.ts`) combined with direct pure-function testing of `fetchCommitsOnce` (as in `useDiff.test.ts`). No `@testing-library/react` renderer is needed.

**Primary recommendation:** Build 26-01 as TDD (types + `useCommits` hook + `CommitDrawer` skeleton + DiffPane per-commit rendering), then 26-02 for mode toggle + keyboard nav + checkbox union filtering.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Commit list fetch + display | Frontend (React hook + component) | — | Data already served by existing `/api/commits`; pure UI concern |
| Per-commit diff fetch | Frontend (DiffPane, `useDiff` refetch or new `useCommitDiff`) | Rust backend (existing route) | Backend endpoint exists; frontend decides when to call it |
| Mode switching (branch ↔ commit) | Frontend (CodeReviewApp state) | — | Pure UI state; no backend awareness needed |
| Keyboard navigation | Frontend (CodeReviewApp `useEffect`) | — | Client-side only; no server round-trip |
| Multi-commit checkbox filtering | Frontend (CodeReviewApp state + fetch union) | Rust backend (existing `/api/diff/commit/{sha}`) | Client-side union of N existing endpoint responses; no new backend query |
| CommitDrawer overlay positioning | Frontend (CSS `position: absolute`, `z-index`) | — | Pure layout |

---

## Standard Stack

### Core (already installed, no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | `^19.2.4` | Component rendering, state, effects | Project stack (MEMORY.md confirmed) |
| TypeScript `~6.0.2` | Already installed | Type safety for new Commit interface | Project standard |
| `@pierre/diffs` | `^1.1.12` | Per-commit diff rendering (same as branch diff) | Already used in DiffPane; `PatchDiff` + `FileDiff` + `parseDiffFromFile` |
| Vitest `^4.1.4` | Already installed | Test runner (jsdom environment) | Established in Phase 25 |

### No New Packages Required

Phase 26 introduces zero new npm dependencies. All component logic uses:
- Inline styles (established pattern — no CSS modules, no Tailwind component classes)
- `useState`, `useEffect`, `useCallback`, `useRef` from React (already imported in existing files)
- Existing CSS variable tokens from `ui/src/index.css`

**Package Legitimacy Audit:** Not applicable — no new packages installed.

---

## Architecture Patterns

### System Architecture Diagram

```
User interaction
      │
      ▼
AppToolbar "Commits" button
      │ toggle
      ▼
CodeReviewApp state
  drawerOpen: boolean
  viewMode: 'branch' | 'commit'
  activeCommitSha: string | null
  checkedCommitShas: string[]
      │
      ├─── [drawerOpen=true] ─────────────────────────────────────────────────────┐
      │                                                                           │
      │    useCommits() ──→ GET /api/commits ──→ CommitList                      │
      │                                               │                           │
      │                                               ▼                           ▼
      │                                         CommitDrawer (overlay, z:10)
      │                                         ├── header "COMMITS"
      │                                         ├── CommitRow × N
      │                                         │     ├── checkbox (→ checkedCommitShas)
      │                                         │     └── click row (→ activeCommitSha, viewMode:'commit')
      │                                         └── empty/loading state
      │
      ├─── [viewMode='commit'] ──────────────────────────────────────────────────┐
      │                         GET /api/diff/commit/{sha}                       │
      │                                    │                                     │
      │                                    ▼                                     │
      │                        DiffPane receives files[]                         │
      │                        + shows commit title strip                        │
      │                          {short_sha} — {message}                         │
      │                          {author} · {date}                               │
      │                                                                          │
      │         window keydown (left/right arrow)                                │
      │              │                                                            │
      │              └── navigates activeCommitSha to prev/next in commits[]     │
      │
      └─── [viewMode='branch'] ──────────────────────────────────────────────────┐
                                                                                  │
           checkedCommitShas === all shas ──→ GET /api/diff/branch                │
           checkedCommitShas is subset   ──→ GET /api/diff/commit/{sha} × N       │
                                              union FileDiff[] client-side         │
                                              ▼                                   │
                                        DiffPane renders union                    │
```

### Recommended Project Structure (additions only)

```
ui/src/code-review/
├── hooks/
│   ├── useDiff.ts           (existing)
│   └── useCommits.ts        (NEW — mirrors useDiff pattern exactly)
├── CommitDrawer.tsx          (NEW — drawer overlay + CommitRow list)
├── CodeReviewApp.tsx         (MODIFIED — new state + CommitDrawer + keyboard handler)
├── AppToolbar.tsx            (MODIFIED — commitsOpen prop + onCommitsToggle handler)
├── DiffPane.tsx              (MODIFIED — viewMode + activeCommitSha + commit title strip)
└── types.ts                  (MODIFIED — add Commit interface)
```

### Pattern 1: useCommits Hook — Injectable doFetch (mirrors useDiff exactly)

**What:** Pure function `fetchCommitsOnce(doFetch)` + React hook `useCommits()` with `cancelledRef`.
**When to use:** Fetching the commit list on drawer open; makes the pure function testable without a React renderer.

```typescript
// Source: CONTEXT.md D-12 + useDiff.ts (existing implementation)

export type DoFetch = (url: string) => Promise<Response>

export interface FetchCommitsResult {
  commits: Commit[]
  truncated: boolean
  error: string | null
}

export async function fetchCommitsOnce(doFetch: DoFetch): Promise<FetchCommitsResult> {
  try {
    const res = await doFetch('/api/commits')
    if (!res.ok) return { commits: [], truncated: false, error: 'fetch failed' }
    const data = (await res.json()) as { commits: Commit[]; truncated: boolean }
    return { commits: data.commits, truncated: data.truncated, error: null }
  } catch {
    return { commits: [], truncated: false, error: 'network error' }
  }
}

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
    return () => { cancelledRef.current = true }
  }, [])

  return { commits, truncated, loading, error }
}
```

### Pattern 2: Commit Interface Addition to types.ts

**What:** TypeScript mirror of the Rust `Commit` struct. Fields match JSON output exactly (snake_case preserved — same convention as `FileDiff.previous_filename`).

```typescript
// Source: src/diff_api.rs Commit struct
export interface Commit {
  sha: string
  short_sha: string    // 7 chars
  message: string
  author: string
  email: string
  date: string         // ISO 8601 / RFC 3339
}
```

### Pattern 3: Client-Side FileDiff Union for DIFF-05

**What:** When `checkedCommitShas` is a proper subset of all commit shas and `viewMode === 'branch'`, fetch `FileDiff[]` from each checked commit and union them. When all commits are checked, use `/api/diff/branch` directly.

```typescript
// Source: CONTEXT.md Specifics + D-05

async function fetchFilteredBranchDiff(
  checkedShas: string[],
  allShas: string[],
  doFetch: DoFetch,
): Promise<FileDiff[]> {
  const isAll = checkedShas.length === allShas.length &&
    allShas.every(s => checkedShas.includes(s))

  if (isAll) {
    const res = await doFetch('/api/diff/branch')
    return res.ok ? (await res.json() as FileDiff[]) : []
  }

  // Fetch per-commit and union (client-side merge by filename)
  const perCommit = await Promise.all(
    checkedShas.map(sha =>
      doFetch(`/api/diff/commit/${sha}`)
        .then(r => r.ok ? r.json() as Promise<FileDiff[]> : [])
        .catch(() => [] as FileDiff[])
    )
  )
  return perCommit.flat()
}
```

**Note:** The union produces duplicate `filename` entries when the same file is touched in multiple commits. The planner must decide: either dedup by filename (taking the last/most-recent) or pass all entries to DiffPane (which renders each). The CONTEXT.md does not prescribe dedup — this is Claude's discretion at implementation time.

### Pattern 4: Keyboard Navigation Handler

**What:** `useEffect` on `CodeReviewApp` listening to `window` `keydown`. Active only when `viewMode === 'commit'`.

```typescript
// Source: CONTEXT.md D-09, D-10 + UI-SPEC Interaction Contract

useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if (viewMode !== 'commit' || commits.length === 0 || activeCommitSha === null) return
    const idx = commits.findIndex(c => c.sha === activeCommitSha)
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

**Boundary behavior:** Stop at first/last (no wrap) — per UI-SPEC Boundary Behavior section.

### Pattern 5: CommitDrawer as Overlay

**What:** `position: absolute` inside the `aside` wrapper, `zIndex: 10`, covering the file list.

```typescript
// Source: UI-SPEC Component Inventory — CommitDrawer

<aside
  role="navigation"
  aria-label="Branch commits"
  style={{
    position: 'absolute',
    top: 0, left: 0,
    width: 296,           // midpoint of D-04 280–320px range
    height: '100%',
    background: 'var(--color-surface)',
    borderRight: '1px solid var(--color-border)',
    zIndex: 10,
    display: drawerOpen ? 'flex' : 'none',
    flexDirection: 'column',
    overflowY: 'auto',
  }}
>
```

The outer `aside` container in `CodeReviewApp` must have `position: relative` for the absolute child to be positioned within it.

### Pattern 6: Mode Switching — Drawer Close Resets to Branch

**What:** When the user clicks the "Commits" toggle again (closes drawer), viewMode returns to 'branch' and `activeCommitSha` clears to `null`. This is the only path back to branch view (D-07).

```typescript
// Source: CONTEXT.md D-07 + UI-SPEC Mode Switching

function handleCommitsToggle() {
  if (drawerOpen) {
    // Closing — return to branch mode
    setDrawerOpen(false)
    setViewMode('branch')
    setActiveCommitSha(null)
  } else {
    setDrawerOpen(true)
    // viewMode stays as-is — user may re-open to a previously clicked commit
  }
}
```

### Pattern 7: DiffPane Per-Commit Title Strip

**What:** When `viewMode === 'commit'` and `activeCommitSha` is non-null, render a title bar between the scroll container top and the first file diff.

```typescript
// Source: UI-SPEC Component Inventory — DiffPane title

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

### Anti-Patterns to Avoid

- **Putting commit state in CommitDrawer:** All state (`drawerOpen`, `viewMode`, `activeCommitSha`, `checkedCommitShas`) lives in `CodeReviewApp` (D-11). CommitDrawer is a pure display component that receives props.
- **Calling setLoading(true) synchronously inside useEffect:** The `useDiff` pattern initializes `loading: true` so the effect body does not call `setLoading(true)` on mount — `useCommits` must do the same.
- **Using `e.stopPropagation()` on the row instead of the checkbox:** The checkbox click must stop propagation; the row click should NOT stop propagation (it is the primary action).
- **Wrapping `keydown` handler outside a `useEffect`:** Without cleanup, the handler leaks on unmount. Always return `() => window.removeEventListener(...)`.
- **Using up/down arrows for commit navigation:** Only left/right (D-10). Up/down already scroll the diff pane.
- **Importing from `reviewer-v2/`:** All new files under `ui/src/code-review/` — ESLint rule blocks cross-subtree imports. [VERIFIED: codebase]
- **Using `position: fixed` for the drawer:** Use `position: absolute` within `position: relative` parent so the drawer stays within the sidebar column.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Diff rendering (per-commit) | Custom diff parser | `@pierre/diffs` `PatchDiff` / `FileDiff` — same as branch diff | Already used and working; `FileDiff.patch` + `old_content` + `new_content` work identically for per-commit diffs |
| Date formatting | Custom date formatter | Display `commit.date` string directly (ISO 8601 already) | Backend formats as RFC 3339; display as-is or use `new Date(date).toLocaleDateString()` — no library needed |
| Checkbox state management | Custom checkbox tree | Plain `string[]` of checked SHAs in `CodeReviewApp` (D-11) | Simple enough for opt-out model with N ≤ 500 commits |

**Key insight:** The backend already does the heavy lifting. Phase 26 is wiring + display work, not algorithmic work.

---

## Common Pitfalls

### Pitfall 1: FileDiff Union Duplicates

**What goes wrong:** When two checked commits both modify the same file, the client-side union produces two `FileDiff` entries with the same `filename`. `DiffPane` renders both sequentially — which shows the file twice.
**Why it happens:** Simple `perCommit.flat()` union does not deduplicate.
**How to avoid:** Accept this behavior (two hunks for the same file from different commits is actually informative), OR deduplicate by merging the `patch` strings. The planner must pick one; the CONTEXT.md leaves it to Claude's discretion.
**Warning signs:** During testing, check a repo with two commits that both touch the same file — confirm the output is sensible.

### Pitfall 2: Keyboard Handler Stale Closure

**What goes wrong:** The `keydown` handler closes over `viewMode`, `activeCommitSha`, and `commits`. If the `useEffect` deps array is incomplete, the handler reads stale values and navigates incorrectly.
**Why it happens:** Missing dependency in the `useEffect` deps array.
**How to avoid:** Include `[viewMode, activeCommitSha, commits]` in the deps array — this re-registers the listener on every relevant state change. The listener cleanup in the return function prevents accumulation.
**Warning signs:** Arrow keys navigate to the wrong commit or do nothing after a commit is clicked.

### Pitfall 3: Absolute Positioning Without Relative Parent

**What goes wrong:** `CommitDrawer` uses `position: absolute` but the parent container does not have `position: relative`. The drawer positions relative to the nearest positioned ancestor — which may be the viewport.
**Why it happens:** `CodeReviewApp`'s `aside` does not have `position: relative` in the current code.
**How to avoid:** Add `position: 'relative'` to the `aside` element in `CodeReviewApp` before rendering `CommitDrawer` inside it.
**Warning signs:** Drawer appears in the wrong place or covers the AppToolbar.

### Pitfall 4: initializating checkedCommitShas Before Commits Load

**What goes wrong:** `checkedCommitShas` is initialized to `[]` but should be populated with all SHAs when commits first load (D-08 opt-out model). If the initialization is missing, all commits appear unchecked.
**Why it happens:** Forgetting to seed `checkedCommitShas` from the `useCommits` result in a `useEffect` or lazy initializer.
**How to avoid:** When `commits` first loads (non-empty, `checkedCommitShas` is still `[]`), set `checkedCommitShas` to `commits.map(c => c.sha)`. Use a one-shot `useEffect` with `[commits.length]` dep (same pattern as `activeIndex` reset in `CodeReviewApp`).
**Warning signs:** Checkbox filtering shows empty diff immediately when drawer opens.

### Pitfall 5: DiffPane Fetching on Every viewMode Change

**What goes wrong:** If DiffPane owns the fetch logic for per-commit diffs, it may refetch unnecessarily when unrelated state changes (e.g., `diffStyle`) trigger re-renders.
**Why it happens:** Putting `useEffect(() => { fetch(...) }, [viewMode, activeCommitSha, diffStyle])` couples fetching to non-fetch concerns.
**How to avoid:** Keep fetch triggers tied only to `[viewMode, activeCommitSha]`. The `diffStyle` prop only affects rendering, not the fetch.
**Warning signs:** Network tab shows repeated `/api/diff/commit/{sha}` calls on style toggle.

### Pitfall 6: react-hooks/set-state-in-effect Violation

**What goes wrong:** Calling `setCheckedCommitShas(commits.map(...))` directly inside a `useEffect` body that runs on mount triggers the react-hooks/exhaustive-deps linter rule about setting state in effects.
**Why it happens:** The ESLint react-hooks plugin flags synchronous setState inside effects when the state and the trigger are in the same component.
**How to avoid:** Use the same `setTimeout(0)` deferral pattern used for `activeIndex` in `CodeReviewApp`. Or initialize `checkedCommitShas` via a callback initializer tied to `useMemo` of `commits.map(c => c.sha)` — but the setTimeout approach is already established in the project.
**Warning signs:** ESLint error `react-hooks/exhaustive-deps` or `react-hooks/set-state-in-effect`.

---

## Code Examples

### CommitRow structure

```typescript
// Source: UI-SPEC Component Inventory — CommitRow

function CommitRow({
  commit,
  isActive,
  isChecked,
  onRowClick,
  onCheckChange,
}: {
  commit: Commit
  isActive: boolean
  isChecked: boolean
  onRowClick: (sha: string) => void
  onCheckChange: (sha: string, checked: boolean) => void
}) {
  return (
    <li
      onClick={() => onRowClick(commit.sha)}
      style={{
        padding: '8px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        cursor: 'pointer',
        borderLeft: isActive ? '2px solid var(--color-focus)' : '2px solid transparent',
        background: isActive ? 'var(--color-bg)' : 'transparent',
        color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        fontWeight: isActive ? 600 : 400,
      }}
    >
      {/* Line 1: checkbox + SHA chip + message */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => {
            e.stopPropagation()
            onCheckChange(commit.sha, e.target.checked)
          }}
          onClick={(e) => e.stopPropagation()}
          style={{ flexShrink: 0 }}
        />
        {/* SHA chip */}
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
        {/* Message */}
        <span style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: 14,
        }}
          title={commit.message}
        >
          {commit.message}
        </span>
      </div>
      {/* Line 2: author · date */}
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', paddingLeft: 48 }}>
        {commit.author} · {commit.date}
      </div>
    </li>
  )
}
```

### AppToolbar Commits button addition

```typescript
// Source: AppToolbar.tsx existing pattern + UI-SPEC Component Inventory

// Add to AppToolbarProps:
commitsOpen: boolean
onCommitsToggle: () => void

// Add to right controls group (before the Unified/Side-by-side toggle group):
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

---

## State Architecture Detail

```
CodeReviewApp state (all commit-related per D-11):

┌─────────────────────────────────────────────────────────────────────┐
│ drawerOpen: boolean = false                                         │
│ viewMode: 'branch' | 'commit' = 'branch'                           │
│ activeCommitSha: string | null = null                               │
│ checkedCommitShas: string[] = []  (seeded to all shas on load)     │
└─────────────────────────────────────────────────────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
  AppToolbar            CommitDrawer          DiffPane
  commitsOpen=          commits=              viewMode=
  drawerOpen            from useCommits()     viewMode
  onCommitsToggle=      activeCommitSha=      activeCommitSha=
  handleCommitsToggle   activeCommitSha       commits= (for title strip)
                        checkedCommitShas=    files= (from branch OR commit fetch)
                        onCommitClick=
                        onCheckChange=
```

Data flow note: `DiffPane` receives `files: FileDiff[]` as a prop — it does NOT own the fetch. The fetch is triggered in `CodeReviewApp` when `viewMode` or `activeCommitSha` changes, and the result is stored in existing `files` state (from `useDiff`). Alternatively, DiffPane can own a per-commit fetch via a `useEffect` when `viewMode === 'commit'`. The planner must decide which approach — the CONTEXT.md leaves fetch ownership open. The cleaner separation is: `CodeReviewApp` owns all fetch triggers, passes `files` down to `DiffPane`.

---

## Environment Availability

Step 2.6: No new external dependencies. All tooling (Node.js, Vitest, TypeScript, React) already active in the project. Rust backend has no changes.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vitest | Frontend tests | ✓ | `^4.1.4` | — |
| React 19 | UI components | ✓ | `^19.2.4` | — |
| `@pierre/diffs` | Per-commit diff rendering | ✓ | `^1.1.12` | — |
| `/api/commits` endpoint | `useCommits` hook | ✓ | Phase 24 | — |
| `/api/diff/commit/{sha}` endpoint | Per-commit diff fetch | ✓ | Phase 24 | — |

---

## Package Legitimacy Audit

No new packages are installed in Phase 26. Not applicable.

---

## Validation Architecture

`workflow.nyquist_validation` is `false` in `.planning/config.json`. Section skipped per instruction.

---

## Security Domain

Phase 26 is a pure frontend display phase with no new user-controlled input flowing to the backend. The SHA passed to `/api/diff/commit/{sha}` comes from the commit list fetched from `/api/commits` — it is server-provided, not user-typed. No new injection surface.

**Existing backend protection:** `src/diff_api.rs` line 312 validates SHA format via `git2::Oid::from_str(&sha)` returning 400 on non-hex input. This protection is already in place (Phase 24) and is not changed by Phase 26.

---

## Open Questions

1. **FileDiff union dedup strategy for DIFF-05**
   - What we know: Multiple commits touching the same file will produce duplicate `FileDiff` entries in the union.
   - What's unclear: Should the planner merge them (concatenate patches) or render both (showing the file twice)?
   - Recommendation: Render both entries unmerged — it mirrors the actual git history more accurately. Flag for planner to confirm.

2. **Where does the per-commit diff fetch live?**
   - What we know: CONTEXT.md says "DiffPane receives `viewMode` + `activeCommitSha`" and "when `viewMode === 'commit'`, fetches `/api/diff/commit/{sha}`". This implies DiffPane owns the per-commit fetch.
   - What's unclear: Whether `CodeReviewApp` should own the fetch (passing `files` down as it does today) or DiffPane should branch on `viewMode` to fetch per-commit data internally.
   - Recommendation: DiffPane owns the per-commit fetch (new internal state + `useEffect` on `[viewMode, activeCommitSha]`). This keeps `CodeReviewApp` from needing to manage two different `files` arrays. The planner should confirm.

3. **checkedCommitShas initialization timing**
   - What we know: D-08 says default is all checked when drawer first opens. `useCommits` loads data asynchronously.
   - What's unclear: `checkedCommitShas` in `CodeReviewApp` must be seeded from `useCommits().commits` once loaded. If `useCommits` is called unconditionally (regardless of `drawerOpen`), it loads on mount. If called only when `drawerOpen`, it loads on first open.
   - Recommendation: Call `useCommits` unconditionally on `CodeReviewApp` mount (matches the `useDiff` pattern). The data is needed as soon as the drawer opens, so pre-loading is better UX.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | FileDiff union rendering duplicate entries for same file is acceptable | Code Examples (Pitfall 1) | Visual duplication in combined branch diff; may need dedup |
| A2 | `useCommits` is called unconditionally on CodeReviewApp mount (not deferred to drawer open) | Open Questions | Unnecessary fetch on every page load; trivial to change |
| A3 | Per-commit fetch is owned by DiffPane (not CodeReviewApp) | Open Questions | Architecture split could go either way; affects component interface shape |

---

## Sources

### Primary (HIGH confidence)
- `ui/src/code-review/hooks/useDiff.ts` — exact injectable doFetch pattern; `useCommits` mirrors structurally [VERIFIED: codebase]
- `ui/src/code-review/CodeReviewApp.tsx` — current state ownership pattern; Phase 26 extends it [VERIFIED: codebase]
- `ui/src/code-review/AppToolbar.tsx` — existing button style; Commits button follows same pattern [VERIFIED: codebase]
- `ui/src/code-review/DiffPane.tsx` — existing loading/error/empty states; commit title strip uses same patterns [VERIFIED: codebase]
- `src/diff_api.rs` — `/api/commits` and `/api/diff/commit/{sha}` endpoints fully implemented, tested, no changes needed [VERIFIED: codebase]
- `.planning/phases/26-commit-navigation/26-CONTEXT.md` — locked decisions D-01 through D-13 [VERIFIED: project artifact]
- `.planning/phases/26-commit-navigation/26-UI-SPEC.md` — component inventory, spacing, color, interaction contract [VERIFIED: project artifact]
- `ui/src/code-review/hooks/useDiff.test.ts` — test pattern for pure function testing; `useCommits.test.ts` mirrors exactly [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- `ui/package.json` — confirmed no new packages needed; all dependencies already installed [VERIFIED: codebase]
- `ui/eslint.config.ts` — confirmed no-restricted-imports rule for `code-review/` files [VERIFIED: codebase]
- `ui/vite.config.ts` — Vitest jsdom environment, `setupFiles: ['./vitest.setup.ts']` [VERIFIED: codebase]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies confirmed installed and in use
- Architecture: HIGH — backend exists, patterns fully established in Phase 25
- Pitfalls: HIGH — derived from reading existing code and established patterns; pitfall 2 (stale closure) is a well-known React pattern issue
- State model: HIGH — directly specified in CONTEXT.md D-11 through D-13

**Research date:** 2026-05-24
**Valid until:** 2026-06-24 (stable; no fast-moving dependencies)
