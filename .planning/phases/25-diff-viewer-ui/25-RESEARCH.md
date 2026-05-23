# Phase 25: Diff Viewer UI - Research

**Researched:** 2026-05-23
**Domain:** React 19 + TypeScript — SPA route, `@pierre/diffs` PatchDiff, IntersectionObserver, axum `?context` param
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Routing**
- D-01: Route detection via pathname check in `main.tsx` — no router library. `window.location.pathname.startsWith('/code-review')` renders `<CodeReviewApp />`, otherwise renders `<ReviewerV2 />`.
- D-02: The two views are fully standalone — no navigation links between them.
- D-03: A shared `AppToolbar` shell component is introduced in Phase 25 with slots for title, layout toggle, and reserved stubs (help/GitHub/theme switcher — empty in Phase 25). Both views use `AppToolbar` for the 48px header strip.

**Context Line Expansion (DIFF-02)**
- D-04: Per-hunk expansion via `@pierre/diffs` native `expansionLineCount` in `BaseDiffOptions`.
- D-05: "Expand All" re-fetches from `/api/diff/branch?context=999`; backend adds optional `?context: Option<u32>` to both `/api/diff/branch` and `/api/diff/commit/:sha`. Default = git2 default (3 lines).
- D-06: Default context lines: whatever git2's default is (3). No custom `collapsedContextThreshold`.

**File List (DIFF-04)**
- D-07: Each file entry shows: status icon (colored dot) + basename only + `+N -M` counts. Full path on hover tooltip.
- D-08: Renamed files show new basename + `↳` rename icon. `old → new` path on hover tooltip.
- D-09: Clicking a file entry scrolls diff pane to `file-{index}` anchor (smooth scroll). Active file highlighted with left border.

**@pierre/diffs Integration**
- D-10: Use `PatchDiff` per file — accepts raw `patch` string from `FileDiff.patch`.
- D-11: `disableWorkerPool={true}` on every `PatchDiff`.
- D-12: Syntax highlighting: `github-light` / `github-dark` based on OS `prefers-color-scheme`, read once on init.
- D-13: Unified/side-by-side toggle via `options={{ diffStyle: 'unified' | 'split' }}`. Default: `'unified'`.

**ARCH-01 Cleanup**
- D-14: Remove `GET /api/diff` handler from `src/plan_review.rs`, the `AppState.diff_content` field, and all callsites in `main.rs` (the `extract_diff()` function and the `diff_content` argument to `start_server()`). Verify nothing else depends on `/api/diff` before removing.

### Claude's Discretion

- Exact layout proportions for the two-column view (file list width vs diff pane — likely 220–280px sidebar).
- Empty state when the branch has no diff.
- Loading state while `useDiff` fetches.
- Error state when the backend returns an error.
- Exact `expansionLineCount` value (UI-SPEC resolves this to 20).

### Deferred Ideas (OUT OF SCOPE)

- Help icon, GitHub link, theme switcher in `AppToolbar` — empty stubs only.
- Worker pool for `@pierre/diffs`.
- Dynamic theme switching at runtime.
- Navigation between `ReviewerV2` and `CodeReviewApp`.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DIFF-01 | User can view a full branch diff (all changed files combined, vs main) | `useDiff` hook fetches `/api/diff/branch` (Phase 24 endpoint, already implemented); renders `FileDiff[]` via `PatchDiff` per file |
| DIFF-02 | User can expand collapsed context lines within a diff hunk | `@pierre/diffs` native `expansionLineCount: 20` in `BaseDiffOptions` (per-hunk); "Expand All" re-fetches `?context=999` (full context) |
| DIFF-03 | User can toggle between unified and side-by-side layout | `options={{ diffStyle: 'unified' | 'split' }}` prop on each `PatchDiff`; state lives in `CodeReviewApp`; toggle button in `AppToolbar` |
| DIFF-04 | User can navigate directly to any changed file via a file list | `FileListPane` renders file buttons; click calls `scrollIntoView` to `id="file-{index}"` anchors; `IntersectionObserver` tracks active file (same pattern as `OutlinePane`) |
| ARCH-01 | Code review viewer replaces existing (unused) diff tab — prior diff code removed | Remove `GET /api/diff`, `AppState.diff_content`, and `extract_diff()` from Rust; no frontend `DiffView` or `TabBar` remnants |
</phase_requirements>

---

## Summary

Phase 25 is a pure frontend-plus-small-backend-extension phase. The Rust backend work is minimal: add an optional `?context=N` query parameter to two existing handlers (`GET /api/diff/branch` and `GET /api/diff/commit/:sha`) in `src/diff_api.rs`, and remove the unused `GET /api/diff` endpoint plus `AppState.diff_content` field from `src/plan_review.rs`.

The frontend work is the bulk of the phase: create a new `ui/src/code-review/` module with five components/hooks (`CodeReviewApp`, `AppToolbar`, `FileListPane`, `DiffPane`, `useDiff`), wire pathname detection into `main.tsx`, and integrate the `@pierre/diffs` `PatchDiff` component for rendering. The `@pierre/diffs` library is already installed at `^1.1.12` and its type definitions have been read directly — no new dependencies needed. All design decisions and layout specifics are fully captured in `25-UI-SPEC.md`.

The testing pattern established in the codebase uses source-file assertion tests (read file, regex/contain checks) rather than rendering library tests. This avoids `@testing-library/react` and keeps tests in `jsdom` with minimal setup. New tests for Phase 25 follow the same `source.contains(...)` pattern observed in `ReviewerV2Shell.test.ts`, plus pure logic tests for `useDiff` by injecting dependencies the same way `useHeartbeat.test.ts` does.

**Primary recommendation:** Build in the order: types → `useDiff` hook (with tests) → `FileListPane` → `DiffPane` → `CodeReviewApp` → `AppToolbar` → `main.tsx` wiring → Rust `?context` param → ARCH-01 cleanup. The `useDiff` hook and Rust `?context` param can proceed in parallel since they are independently testable.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Full branch diff data | API / Backend | — | `GET /api/diff/branch` already implemented in Phase 24; frontend reads it |
| Context line count control | API / Backend | Browser/Client | Backend exposes `?context=N`; frontend sends the value |
| Diff rendering | Browser / Client | — | `@pierre/diffs` PatchDiff is a React component; runs in the browser |
| Unified/split layout toggle | Browser / Client | — | Pure prop change on `PatchDiff`; no server involvement |
| File list navigation | Browser / Client | — | `scrollIntoView` + `IntersectionObserver`; entirely DOM-side |
| Syntax highlighting theme | Browser / Client | — | `window.matchMedia('prefers-color-scheme')` read once; passed as option to PatchDiff |
| ARCH-01 dead code removal | API / Backend | — | `GET /api/diff`, `AppState.diff_content`, `extract_diff()` are Rust-side only |

---

## Standard Stack

### Core (already installed — no new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@pierre/diffs` | `^1.1.12` (installed) | Diff rendering via `PatchDiff` | Already a project dependency; provides `PatchDiff`, `BaseDiffOptions` (`diffStyle`, `expansionLineCount`, `theme`) |
| `react` | `^19.2.4` (installed) | Component rendering | Project standard |
| `react-dom` | `^19.2.4` (installed) | DOM rendering | Project standard |

[VERIFIED: codebase scan of `ui/package.json`]

### Supporting (Rust side — already in `Cargo.toml`)

| Library | Purpose |
|---------|---------|
| `axum` 0.8.x | `Query` extractor for optional `?context=N` parameter |
| `serde` | Deserialize the `context` query struct |

[VERIFIED: codebase scan of `src/diff_api.rs`]

### No New Dependencies

Phase 25 introduces zero new npm or Cargo packages. All rendering, layout, and state management is handled by existing dependencies. [VERIFIED: codebase scan]

---

## Package Legitimacy Audit

No new packages are introduced in Phase 25. All required libraries are already present in `ui/package.json` and `Cargo.toml`.

| Package | Status |
|---------|--------|
| `@pierre/diffs` | Already installed — no new vetting required |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Browser: /code-review route
      │
      ▼
main.tsx  (pathname check)
      │  startsWith('/code-review') → true
      ▼
CodeReviewApp (owns diffStyle, contextExpanded state)
      │
      ├── AppToolbar (48px header)
      │       ├── "Code Review" title
      │       ├── Unified | Side-by-side toggle  ──── diffStyle state
      │       └── Expand All toggle  ─────────────── contextExpanded state
      │
      └── Body row (flex, height: remaining)
              │
              ├── FileListPane (240px, flex-shrink:0)
              │       ├── reads FileDiff[] from useDiff
              │       ├── renders file buttons (status dot + basename + counts)
              │       ├── active file highlight (IntersectionObserver)
              │       └── onClick → scrollIntoView(#file-{index})
              │
              └── DiffPane (flex:1, overflow-y:auto)
                      ├── reads FileDiff[] from useDiff
                      ├── loading / empty / error states
                      └── per-file: <div id="file-{index}"> + <PatchDiff patch={file.patch} options={...} />

useDiff hook:
  fetch /api/diff/branch         (default — no ?context)
  fetch /api/diff/branch?context=999   (Expand All)
  returns: { files: FileDiff[], loading, error }

Rust backend (diff_api.rs):
  GET /api/diff/branch?context=N  → adds DiffContextQuery { context: Option<u32> }
  GET /api/diff/commit/:sha?context=N  → same query param
  Default when absent: 3 lines (git2 default)

ARCH-01 removal (plan_review.rs + main.rs):
  Remove: GET /api/diff route
  Remove: AppState.diff_content field
  Remove: extract_diff() function and its callsites in main.rs
```

### Recommended Project Structure

```
ui/src/
├── code-review/          # NEW — Phase 25
│   ├── types.ts          # FileDiff type (mirrors Phase 24 JSON shape)
│   ├── CodeReviewApp.tsx # Root component
│   ├── AppToolbar.tsx    # Shared 48px header strip
│   ├── FileListPane.tsx  # Left sidebar with file entries
│   ├── DiffPane.tsx      # Right content area with PatchDiff per file
│   ├── hooks/
│   │   └── useDiff.ts    # Fetches /api/diff/branch, returns FileDiff[]
│   ├── CodeReviewApp.test.ts
│   ├── AppToolbar.test.ts
│   ├── FileListPane.test.ts
│   ├── DiffPane.test.ts
│   └── hooks/
│       └── useDiff.test.ts
├── reviewer-v2/          # UNCHANGED — no imports to/from code-review/
└── main.tsx              # MODIFIED — add pathname check

src/
├── diff_api.rs           # MODIFIED — add ?context=N param
├── plan_review.rs        # MODIFIED — remove get_diff handler + diff_content field
├── server.rs             # MODIFIED — remove diff_content arg from start_server
└── main.rs               # MODIFIED — remove extract_diff() and diff_content callsites
```

### Pattern 1: Pathname Routing in main.tsx

**What:** Simple `if/else` on `window.location.pathname` — no router library needed.
**When to use:** Two completely independent SPA roots with no shared state or navigation.

```tsx
// Source: 25-CONTEXT.md D-01; established project pattern
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

[VERIFIED: codebase scan of `ui/src/main.tsx` — current shape, Phase 25 adds the branch]

### Pattern 2: useDiff Hook Structure

**What:** Custom hook that fetches `FileDiff[]` from the backend; follows the project hook pattern in `ui/src/reviewer-v2/hooks/`.
**When to use:** All diff data access in Phase 25 goes through this single hook.

```typescript
// Source: 25-CONTEXT.md D-05; modelled on useHeartbeat dependency injection pattern
// Path: ui/src/code-review/hooks/useDiff.ts

export interface UseDiffResult {
  files: FileDiff[]
  loading: boolean
  error: string | null
  refetch: (contextLines?: number) => void
}

export function useDiff(): UseDiffResult {
  const [files, setFiles] = useState<FileDiff[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function fetchDiff(contextLines?: number) {
    setLoading(true)
    const url = contextLines != null
      ? `/api/diff/branch?context=${contextLines}`
      : '/api/diff/branch'
    try {
      const res = await fetch(url)
      if (!res.ok) { setError('fetch failed'); setLoading(false); return }
      const data: FileDiff[] = await res.json()
      setFiles(data)
      setError(null)
    } catch {
      setError('network error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void fetchDiff() }, [])

  return { files, loading, error, refetch: fetchDiff }
}
```

[ASSUMED — exact interface shape is Claude's discretion per 25-CONTEXT.md]

### Pattern 3: PatchDiff Usage

**What:** `PatchDiff` from `@pierre/diffs` — renders a single file's unified diff patch string.
**When to use:** One `PatchDiff` per file in `FileDiff[]`.

```tsx
// Source: ui/node_modules/@pierre/diffs/dist/react/PatchDiff.d.ts
// Source: ui/node_modules/@pierre/diffs/dist/types.d.ts (BaseDiffOptions)

import { PatchDiff } from '@pierre/diffs/react'

// Theme read once before first render (D-12)
const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
const theme = isDark ? 'github-dark' : 'github-light'

// Per-file usage in DiffPane
{files.map((file, index) => (
  <React.Fragment key={file.filename}>
    <div id={`file-${index}`} aria-label={file.filename} />
    <PatchDiff
      patch={file.patch}
      disableWorkerPool={true}
      options={{
        diffStyle: diffStyle,     // 'unified' | 'split' — from CodeReviewApp state
        expansionLineCount: 20,   // per-hunk expansion (UI-SPEC D-04)
        theme: theme,
      }}
    />
  </React.Fragment>
))}
```

[VERIFIED: type definitions read directly from `ui/node_modules/@pierre/diffs/dist/`]

### Pattern 4: IntersectionObserver for Active File Tracking

**What:** Observe each `file-{index}` anchor element; the closest one to the top of the diff pane viewport becomes the "active" file in `FileListPane`.
**When to use:** Mirrors `OutlinePane`'s `IntersectionObserver` pattern for active section tracking.

```tsx
// Source: 25-UI-SPEC.md Interaction Contracts; mirrors OutlinePane pattern
// rootMargin: '-10px 0px -85% 0px' — same as OutlinePane
useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const idx = entry.target.id.replace('file-', '')
          setActiveIndex(parseInt(idx, 10))
        }
      })
    },
    { root: diffPaneRef.current, rootMargin: '-10px 0px -85% 0px', threshold: 0 }
  )
  // observe each anchor
  anchors.forEach(el => observer.observe(el))
  return () => observer.disconnect()
}, [files])
```

[VERIFIED: `vitest.setup.ts` already mocks `IntersectionObserver` for tests — no setup gap]

### Pattern 5: Rust `?context` Query Parameter

**What:** Axum `Query` extractor for an optional `u32` parameter added to existing handlers.
**When to use:** Both `/api/diff/branch` and `/api/diff/commit/:sha` need optional context.

```rust
// Source: established axum pattern from existing diff_api.rs handlers
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
    let context_lines = params.context.unwrap_or(3); // git2 default
    Json(try_branch_diff(&state.repo_path, context_lines).unwrap_or_default())
}
```

[VERIFIED: codebase scan of `src/diff_api.rs` — existing `State` extraction pattern; `DiffOptions::context_lines()` exists in git2]

### Anti-Patterns to Avoid

- **Importing from `reviewer-v2/` into `code-review/`:** The ESLint `no-restricted-imports` rule in `eslint.config.js` blocks `reviewer-v2/` files from importing `../` paths. The `code-review/` rule does NOT yet exist in eslint.config — add a matching rule that blocks `code-review/` from importing from `reviewer-v2/`. [VERIFIED: codebase scan of `ui/eslint.config.js`]
- **Adding `no-restricted-imports` for `code-review/` in the wrong direction:** The existing rule guards `reviewer-v2/` from reaching out — the new rule must guard `code-review/` from importing from `reviewer-v2/`.
- **Using `@testing-library/react`:** Not installed. The project uses source-file assertion tests and pure logic unit tests only. Do not render React components in tests.
- **Placing `AppToolbar` inside `reviewer-v2/`:** `AppToolbar` is a new shared component but must NOT live in `reviewer-v2/` (coupling direction). It belongs in `code-review/` for Phase 25. If `ReviewerV2Shell` later adopts it, extract to `shared/` — that is a future-phase concern.
- **Calling `extract_diff()` in main.rs after ARCH-01:** Remove all three callsites (lines ~496, ~552, ~659) and the `diff_content` parameter from `async_main`'s `launch_browser_and_wait()` helper. Verify no test still references `AppState.diff_content`. [VERIFIED: codebase scan of `src/main.rs`]
- **Using a `filter: Option<String>` on `DiffOptions` to set context — wrong API:** The correct git2 API is `DiffOptions::context_lines(u32)`. Do not confuse with pathspec filters. [ASSUMED — based on git2 0.20 API knowledge; verify against crates.io docs if uncertain]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Diff rendering with syntax highlighting | Custom diff renderer | `@pierre/diffs` `PatchDiff` | Already installed; handles unified/split, hunk expansion, theme, syntax highlighting, virtualization |
| Per-hunk context expansion | Custom `...` click handler | `@pierre/diffs` `expansionLineCount` in `BaseDiffOptions` | Library-native; handles edge cases (first/last hunk, direction) |
| Syntax highlighting | `highlight.js` directly | `@pierre/diffs` built-in Shiki highlighter | PatchDiff handles highlighting internally; adding highlight.js creates double-rendering |
| Active-element tracking | Manual scroll listener + `getBoundingClientRect` | `IntersectionObserver` with `rootMargin` | Already established pattern in `OutlinePane`; already mocked in `vitest.setup.ts` |
| Diff patch string parsing | Custom hunk parser | `PatchDiff` consumes raw patch string directly | No intermediate parsing needed; patch string from API → PatchDiff prop |

**Key insight:** `@pierre/diffs` handles everything below the "give me a patch string" level. The planner should never create tasks that build custom diff parsing, expansion logic, or syntax highlighting.

---

## Common Pitfalls

### Pitfall 1: `code-review/` Coupling to `reviewer-v2/`

**What goes wrong:** A developer sees that `useHeartbeat` is in `reviewer-v2/` and imports it into `CodeReviewApp` directly.
**Why it happens:** The import appears obvious; the ESLint rule only guards `reviewer-v2/` from reaching outside — not the reverse.
**How to avoid:** Add a `no-restricted-imports` rule for `src/code-review/**` in `eslint.config.js` that blocks imports from `reviewer-v2/`. If `useHeartbeat` is needed in CodeReviewApp, copy the import to use the existing module or call the hook directly.
**Warning signs:** `import ... from '../reviewer-v2/...'` in any `code-review/` file.

Note: `useHeartbeat` is not needed in Phase 25 — `CodeReviewApp` does NOT show an offline banner. The connectivity status is irrelevant for a read-only diff viewer. Do not wire `useHeartbeat` into `CodeReviewApp`. [ASSUMED — CONTEXT.md does not explicitly mention this; verify if connectivity display is desired]

### Pitfall 2: `AppState.diff_content` Removal — Cascading Callsites

**What goes wrong:** Removing `diff_content` from `AppState` in `plan_review.rs` without updating all callsites in `main.rs` causes compile errors.
**Why it happens:** `main.rs` has three callsites that pass `diff_content` to `start_server()` (lines ~496, ~552, ~659 based on grep). `server.rs`'s `start_server()` signature passes it through to `AppState`.
**How to avoid:** Change in this order: (1) remove `AppState.diff_content` field, (2) remove `diff_content` param from `start_server()`, (3) remove `extract_diff()` call from each `main.rs` callsite, (4) remove `extract_diff()` definition.
**Warning signs:** `cargo build` fails with "expected N arguments, found N-1" after removing.

### Pitfall 3: `PatchDiff` options Prop Reactivity

**What goes wrong:** The `options` prop is re-created inline on every render (e.g., `options={{ diffStyle, theme }}`), which may cause `PatchDiff` to re-render all hunks even when only `diffStyle` changed.
**Why it happens:** Object literal creates a new reference on each render.
**How to avoid:** Create the options object with `useMemo` or lift the theme constant out of the component function body (since it is read once and never changes). For `diffStyle`, the re-render is intentional — it's the toggle mechanism.
**Warning signs:** Perceptible flicker or full re-highlight on toggle; only relevant if the diff is large.

### Pitfall 4: `scrollIntoView` on an Unmounted Anchor

**What goes wrong:** The user clicks a file entry before `DiffPane` has finished rendering the anchor divs, resulting in `getElementById` returning `null`.
**Why it happens:** Race between the file list click handler and `DiffPane`'s render cycle.
**How to avoid:** Guard the click handler: `document.getElementById('file-${index}')?.scrollIntoView(...)` — the optional chain silently no-ops if the element is absent.
**Warning signs:** Click on a file in the list does nothing (no scroll).

### Pitfall 5: Binary Files in PatchDiff

**What goes wrong:** `file.patch` for binary files is the sentinel string `"[binary file]"` (from Phase 24's `build_file_diffs`). Passing this to `PatchDiff` may produce a rendering error or empty diff.
**Why it happens:** Binary files have no text patch — the backend emits a sentinel.
**How to avoid:** In `DiffPane`, check `file.patch === '[binary file]'` and render a "Binary file — no diff available" placeholder instead of `PatchDiff`.
**Warning signs:** Console errors when a binary file is in the diff.

### Pitfall 6: `?context=999` Expand All — Response Size

**What goes wrong:** On a large branch with many modified large files, fetching `?context=999` returns a very large JSON payload, freezing the tab.
**Why it happens:** git2 context lines multiply the response size proportionally.
**How to avoid:** This is a known trade-off (per CONTEXT.md D-05, it's a 2-state toggle). No mitigation needed in Phase 25 — the tool is for local single-user use with agent-generated diffs (typically small). Document in loading state.
**Warning signs:** The "Loading..." button state hangs for > 2s on a large repo.

### Pitfall 7: ESLint Rule Gap for `code-review/` Module

**What goes wrong:** `code-review/` imports from `reviewer-v2/` pass through linting silently because the existing `eslint.config.js` only guards `reviewer-v2/` from reaching outside.
**Why it happens:** The rule was written for the `reviewer-v2/` subtree isolation; `code-review/` did not exist when the rule was written.
**How to avoid:** Add a mirrored `no-restricted-imports` rule for `src/code-review/**` that blocks `../reviewer-v2/` imports. This is part of Wave 0 / setup tasks.

---

## Code Examples

### FileDiff Type (TypeScript — mirrors Phase 24 JSON schema)

```typescript
// Source: 24-CONTEXT.md D-01; matches Rust FileDiff struct field names
// Path: ui/src/code-review/types.ts

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

[VERIFIED: codebase scan of `src/diff_api.rs` — Rust struct field names; JSON serializes as snake_case (no `#[serde(rename_all)]` observed)]

### Rust `DiffOptions::context_lines` Integration

```rust
// Source: git2 crate API (established in src/diff_api.rs existing opts pattern)
let mut opts = git2::DiffOptions::new();
opts.old_prefix("a/").new_prefix("b/");
opts.context_lines(context_lines);  // u32 — from ?context param, default 3
```

[ASSUMED — `context_lines()` is the correct git2 API name; verify against `git2` 0.20 docs if uncertain]

### AppToolbar Component Structure (layout from UI-SPEC)

```tsx
// Source: 25-UI-SPEC.md AppToolbar section; mirrors ReviewerV2Shell header strip
// Path: ui/src/code-review/AppToolbar.tsx

interface AppToolbarProps {
  diffStyle: 'unified' | 'split'
  contextExpanded: boolean
  contextLoading: boolean
  onDiffStyleChange: (style: 'unified' | 'split') => void
  onExpandAll: () => void
}

export default function AppToolbar({
  diffStyle, contextExpanded, contextLoading,
  onDiffStyleChange, onExpandAll
}: AppToolbarProps) {
  return (
    <header style={{
      height: 48, flexShrink: 0,
      background: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-border)',
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: 16, paddingRight: 16,
    }}>
      <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--color-text-secondary)' }}>
        Code Review
      </span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {/* Layout toggle */}
        <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 6 }}>
          {(['unified', 'split'] as const).map(style => (
            <button key={style}
              onClick={() => onDiffStyleChange(style)}
              style={{
                height: 32, padding: '0 12px', border: 'none', cursor: 'pointer',
                borderRadius: 6, fontSize: 14,
                background: diffStyle === style ? 'var(--color-surface)' : 'transparent',
                color: diffStyle === style ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                fontWeight: diffStyle === style ? 600 : 400,
              }}
            >
              {style === 'unified' ? 'Unified' : 'Side-by-side'}
            </button>
          ))}
        </div>
        {/* Expand All */}
        <button onClick={onExpandAll} disabled={contextLoading}
          style={{ height: 32, padding: '0 16px', border: '1px solid var(--color-border)',
            borderRadius: 6, fontSize: 14, cursor: 'pointer',
            background: 'var(--color-surface)',
            color: contextExpanded ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            fontWeight: contextExpanded ? 600 : 400,
          }}
        >
          {contextLoading ? 'Loading...' : contextExpanded ? 'Collapse' : 'Expand All'}
        </button>
      </div>
    </header>
  )
}
```

[VERIFIED: structure from 25-UI-SPEC.md; matches ReviewerV2Shell header pattern from codebase scan]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `GET /api/diff` returning a raw diff string to the frontend | `GET /api/diff/branch` returning `FileDiff[]` GitHub-format (Phase 24) | Phase 24 (this milestone) | Phase 25 renders structured per-file data; the old `get_diff` handler is now dead code |
| Monolithic `server.rs` with all routes | Split `plan_review.rs` + `diff_api.rs` + thin assembler in `server.rs` | Phase 24 | Phase 25 only touches `diff_api.rs` for `?context` and `plan_review.rs` for ARCH-01 removal |

**Deprecated/outdated:**
- `GET /api/diff` handler: unused since Phase 24 delivered `/api/diff/branch`. Phase 25 removes it (ARCH-01).
- `AppState.diff_content` field: populated by `extract_diff()` at startup for the old diff tab; that tab no longer exists. Phase 25 removes both.

---

## Integration Points Detail

### `src/diff_api.rs` — What Changes

Two handlers gain an optional `Query<DiffContextQuery>` extractor:

1. `get_diff_branch`: passes `context_lines` to `try_branch_diff()`; `try_branch_diff` calls `opts.context_lines(n)` before building the diff.
2. `get_diff_commit`: passes `context_lines` similarly.

`try_branch_diff` signature changes from `(repo_path: &Path) -> Option<Vec<FileDiff>>` to `(repo_path: &Path, context_lines: u32) -> Option<Vec<FileDiff>>`.

No new state, no new test fixtures needed — existing tests for these handlers still pass because `?context` is optional (default = 3 lines matches git2 default behavior).

### `src/plan_review.rs` — What Changes (ARCH-01)

Remove:
- `pub diff_content: String` field from `AppState`
- `get_diff` async handler
- `.route("/api/diff", get(get_diff))` line from `router()`

Update: `AppState::new` (if it exists) — otherwise all callsites in `server.rs` that construct `AppState { plan_md, diff_content, ... }` need `diff_content` removed.

### `src/server.rs` — What Changes (ARCH-01)

`start_server()` signature: remove `diff_content: String` parameter. Remove it from the `AppState { ... }` construction call.

### `src/main.rs` — What Changes (ARCH-01)

Three callsites call `server::start_server(plan_md, diff_content, ...)` — each loses the `diff_content` arg. The `extract_diff()` call above each (lines ~496, ~552, ~659) is also removed. The `extract_diff()` function definition itself (line ~369) is removed.

---

## Open Questions

1. **Does `CodeReviewApp` need connectivity/heartbeat?**
   - What we know: `ReviewerV2` uses `useHeartbeat` for the offline banner.
   - What's unclear: Whether a diff viewer showing read-only data needs to signal offline state.
   - Recommendation: Skip `useHeartbeat` in Phase 25 — the diff is loaded once; if the server is unreachable, the `useDiff` error state covers it.

2. **Should `AppToolbar` be extracted to `ui/src/shared/` immediately?**
   - What we know: `ReviewerV2Shell` does not use `AppToolbar` in Phase 25 (D-02); `AppToolbar` is purely for `CodeReviewApp`.
   - What's unclear: Whether the planner should pre-create `shared/` for future use.
   - Recommendation: Keep `AppToolbar` in `code-review/` for Phase 25 per D-02. No `shared/` module needed yet.

3. **`isPartial: true` and per-hunk expansion in PatchDiff**
   - What we know: `FileDiffMetadata.isPartial` is `true` when diff is from a patch string (vs full file contents). The type definition states: "When true, `deletionLines`/`additionLines` contain only the lines present in the patch and hunk expansion is unavailable."
   - What's unclear: Whether `expansionLineCount` still works when `isPartial: true`.
   - Recommendation: Per-hunk expansion (`expansionLineCount`) is a `BaseDiffOptions` UI control — it tells the library how many lines to reveal per `...` click. However, if expansion requires full file content (which `PatchDiff` with a raw patch string does not have), the `...` separators may not expand beyond what the patch provides. The "Expand All" re-fetch approach (D-05) sidesteps this entirely by fetching more context from the backend. Per-hunk expansion may be limited to what the initial 3-line context patch provides — which is the correct behavior and matches D-04.

---

## Environment Availability

Step 2.6: No new external dependencies. Phase 25 is frontend TypeScript + minimal Rust changes. All tools already verified in prior phases.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js + npm | Frontend build | Assumed present | — | — |
| Rust + cargo | Backend compile | Assumed present | — | — |
| `@pierre/diffs` | Diff rendering | Already installed | ^1.1.12 | — |

---

## Project Constraints (from CLAUDE.md)

Directives the planner must verify compliance with:

1. **Single binary output** — Phase 25 adds no new runtime. `@pierre/diffs` bundles into the Vite output, which is embedded via `rust-embed`. Constraint met.
2. **No router library** — D-01 confirms pathname check only. Constraint met.
3. **cargo fmt + cargo clippy -- -D warnings** before commit — all Rust changes in Phase 25 must pass both. Add as verification step on every Rust task.
4. **Test coverage requirement (CLAUDE.md):** New modules with business logic must have at least one TDD task or a task referencing specific test files. Applicable modules: `useDiff.ts` (data fetch logic), `CodeReviewApp.tsx` (state management), `FileListPane.tsx` (active tracking logic). Pure layout components (`AppToolbar.tsx` with only styling, `DiffPane.tsx` as a render-only mapper) may be covered by source-assertion tests.
5. **ESLint `no-restricted-imports`** — Phase 25 adds a new rule to `eslint.config.js` for `code-review/` → no imports from `reviewer-v2/`. The plan must include this as a Wave 0 task.
6. **Test framework:** Vitest + jsdom. `vitest.setup.ts` already mocks `IntersectionObserver` and `ResizeObserver`. No additional setup needed for Phase 25 tests.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `useHeartbeat` is not needed in `CodeReviewApp` | Open Questions | Connectivity UI missing if wrong — low impact for a read-only viewer |
| A2 | `git2::DiffOptions::context_lines(u32)` is the correct API name | Code Examples | Compile error in `diff_api.rs`; easy to fix by checking `git2` 0.20 docs |
| A3 | `expansionLineCount` in `BaseDiffOptions` controls the `...` click expansion in `PatchDiff` even when `isPartial: true` | Open Questions / PatchDiff usage | Per-hunk expansion silently does nothing; fallback is "Expand All" re-fetch |
| A4 | `useDiff` does not need a dependency-injected interface (unlike `useHeartbeat`) | Pattern 2 | Testing becomes harder; may need to extract `doFetch` for testability |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.
*(Table is not empty — see A1–A4 above)*

---

## Sources

### Primary (HIGH confidence)

- Codebase scan: `ui/node_modules/@pierre/diffs/dist/react/PatchDiff.d.ts` — PatchDiff props, disableWorkerPool
- Codebase scan: `ui/node_modules/@pierre/diffs/dist/types.d.ts` — BaseDiffOptions (diffStyle, expansionLineCount, collapsedContextThreshold, theme)
- Codebase scan: `ui/node_modules/@pierre/diffs/dist/components/FileDiff.d.ts` — FileDiffOptions, FileDiffMetadata.isPartial
- Codebase scan: `src/diff_api.rs` — existing handler patterns, CodeReviewState, build_file_diffs
- Codebase scan: `src/plan_review.rs` — AppState.diff_content, get_diff handler, router()
- Codebase scan: `src/server.rs` — start_server() signature, diff_content parameter
- Codebase scan: `src/main.rs` — extract_diff() callsites (lines ~496, ~552, ~659)
- Codebase scan: `ui/src/reviewer-v2/ReviewerV2Shell.tsx` — header strip pattern (48px)
- Codebase scan: `ui/src/index.css` — CSS custom property tokens
- Codebase scan: `ui/eslint.config.js` — no-restricted-imports rule scope
- Codebase scan: `ui/vitest.setup.ts` — IntersectionObserver mock already present
- Codebase scan: `ui/vite.config.ts` — test environment: jsdom

### Secondary (MEDIUM confidence)

- `25-CONTEXT.md` — all D-01 through D-14 decisions
- `25-UI-SPEC.md` — layout dimensions, spacing, color tokens, copywriting, component inventory
- `24-CONTEXT.md` D-01 — FileDiff JSON schema (GitHub API format)

### Tertiary (LOW confidence)

- `git2::DiffOptions::context_lines()` API name — based on training knowledge of git2 0.20; not verified against crates.io docs in this session [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified in-tree
- Architecture: HIGH — patterns verified against existing codebase
- Pitfalls: HIGH (pitfalls 1-5) / MEDIUM (pitfall 6 — performance) — based on code reading
- Rust `?context` param: MEDIUM — pattern is correct; exact API name for `context_lines()` is assumed

**Research date:** 2026-05-23
**Valid until:** 2026-06-22 (stable stack; 30-day window)
