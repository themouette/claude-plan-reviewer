---
phase: 25-diff-viewer-ui
plan: "01"
subsystem: diff-api-and-frontend-foundation
tags:
  - rust
  - typescript
  - vitest
  - axum
  - git2
  - eslint
dependency_graph:
  requires:
    - "24-backend-diff-api (FileDiff struct, diff handlers)"
  provides:
    - "DiffContextQuery struct on /api/diff/branch and /api/diff/commit/:sha"
    - "FileDiff TypeScript type (ui/src/code-review/types.ts)"
    - "useDiff React hook + fetchDiffOnce pure function (ui/src/code-review/hooks/useDiff.ts)"
    - "ESLint no-restricted-imports rule for code-review/ → reviewer-v2/ direction"
  affects:
    - "25-02 (consumes FileDiff type + useDiff hook)"
    - "25-03 (route wiring uses useDiff, ARCH-01 cleanup)"
tech_stack:
  added: []
  patterns:
    - "axum Query<T> extractor for optional ?context=N param (Option<u32>)"
    - "fetchDiffOnce pure function with injectable DoFetch for testability (mirrors useHeartbeat pattern)"
    - "cancelledRef guard for React 19 strict-mode unmount safety"
    - "loading initialized to true; no sync setState in useEffect body"
key_files:
  created:
    - ui/src/code-review/types.ts
    - ui/src/code-review/hooks/useDiff.ts
    - ui/src/code-review/hooks/useDiff.test.ts
  modified:
    - src/diff_api.rs
    - ui/eslint.config.js
decisions:
  - "useDiff effect calls fetchDiffOnce directly (not refetch) to avoid react-hooks/set-state-in-effect violation; loading init=true covers the initial state"
  - "ESLint rule uses group ['../reviewer-v2/**', '*/reviewer-v2/**'] not '../**' to allow code-review/hooks/useDiff.ts to import from ../types (same subtree)"
metrics:
  duration: "~35 minutes"
  completed: "2026-05-24"
  tasks_completed: 4
  files_modified: 5
---

# Phase 25 Plan 01: Foundation — Types, useDiff Hook, ?context Backend, ESLint Isolation

Added the ?context=N query parameter to both Rust diff endpoints, the TypeScript FileDiff type and useDiff React hook with full Vitest coverage, and the ESLint isolation rule blocking code-review/ from importing reviewer-v2/.

## What Was Built

### Rust Backend (src/diff_api.rs)

- `DiffContextQuery` struct with `pub context: Option<u32>` field
- `get_diff_branch` now accepts `Query(params): Query<DiffContextQuery>`; default = 3 (D-06)
- `try_branch_diff` signature extended to `(repo_path: &Path, context_lines: u32)`; calls `opts.context_lines(context_lines)` before diffing
- `get_diff_commit` now accepts `Query(params): Query<DiffContextQuery>`; same default + `opts.context_lines(context_lines)` applied
- axum's typed Query extractor returns HTTP 400 automatically for malformed input (T-25-CINV mitigated)
- 4 new integration tests: context=0 vs context=999 patch size, invalid context returns 400, default matches context=3, commit endpoint accepts param

### TypeScript Foundation

**ui/src/code-review/types.ts**
```typescript
export interface FileDiff {
  filename: string
  previous_filename?: string   // snake_case matches Rust struct
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied'
  additions: number; deletions: number; changes: number
  patch: string
}
```

**ui/src/code-review/hooks/useDiff.ts**
- `fetchDiffOnce(doFetch, contextLines?)` pure function — injectable for testing
- `useDiff()` React hook — initializes loading=true, fetches on mount via useEffect (no sync setState), exposes `refetch(contextLines?)` for event handlers
- `!== undefined` strict check so `contextLines=0` includes `?context=0`

**ui/src/code-review/hooks/useDiff.test.ts**
- 6 Vitest tests: success 200, HTTP error 500, network throw, context=999 URL, no context omits param, context=0 includes param
- No @testing-library/react; all pure logic tests via injectable doFetch

### ESLint Isolation (ui/eslint.config.js)

New flat-config object for `files: ['src/code-review/**']`:
- Blocks `../reviewer-v2/**` and `*/reviewer-v2/**` patterns
- Does NOT block `../types` (within code-review/ subtree) — intentional
- Sentinel verification confirmed rule fires on violation; sentinel removed

## Test Results

| Suite | Count | Status |
|-------|-------|--------|
| Rust diff_api tests (pre-existing) | 7 | All pass |
| Rust diff_api tests (new ?context) | 4 | All pass |
| TypeScript fetchDiffOnce (new) | 6 | All pass |
| Full UI suite | 341 | All pass |
| cargo build | — | Clean |
| cargo clippy -- -D warnings | — | Clean |
| npm run lint | — | Clean |
| npm run build | — | Clean |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] react-hooks/set-state-in-effect violation in useDiff hook**
- **Found during:** Task 4 (npm run lint revealed the issue after adding ESLint rule)
- **Issue:** `refetch()` called `setLoading(true)` synchronously; calling `refetch()` inside `useEffect` triggered the `react-hooks/set-state-in-effect` lint rule
- **Fix:** Separated the mount fetch from `refetch`. The effect body calls `fetchDiffOnce` directly (async, no sync setState). `loading` initialized to `true` so no sync setState needed on mount. `refetch` still calls `setLoading(true)` — but it's invoked by event handlers, not inside an effect
- **Files modified:** `ui/src/code-review/hooks/useDiff.ts`, `ui/eslint.config.js` (combined in fix commit)
- **Commit:** 65b0c3f

**Note:** The Task 4 eslint.config.js change was committed alongside the useDiff.ts fix in commit 65b0c3f. The fix was discovered during Task 4's lint run; combining was a natural consequence of the test-and-fix workflow.

## Threat Flags

None — no new trust boundaries introduced. The `?context=N` param was already in the plan's threat model (T-25-CINV mitigated by axum's typed extractor, verified by test).

## Known Stubs

None — all exported functions and types are fully implemented with real behavior.

## Self-Check: PASSED
