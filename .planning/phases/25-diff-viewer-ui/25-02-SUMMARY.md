---
phase: 25-diff-viewer-ui
plan: 02
subsystem: ui
tags: [react, typescript, diff-viewer, IntersectionObserver, PatchDiff, pierre-diffs, vitest]

# Dependency graph
requires:
  - phase: 25-01
    provides: FileDiff type, useDiff hook, ?context backend param, ESLint no-restricted-imports rule
provides:
  - AppToolbar component: 48px header with Unified/Side-by-side toggle and Expand All/Collapse/Loading button
  - FileListPane component: sidebar file list with status dots, basenames, rename icons, change counts, IntersectionObserver active tracking
  - DiffPane component: right-column scroll container with PatchDiff per file, loading/empty/error/binary states
  - 43 source-assertion tests locking the props contract for Plan 25-03
affects:
  - 25-03 (CodeReviewApp wires these three components together)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - AppToolbar: presentational header strip with inline-style onFocus/onBlur focus rings
    - FileListPane: IntersectionObserver with rootMargin '-10px 0px -85% 0px' mirrors OutlinePane pattern
    - DiffPane: module-scope theme detection + PatchDiff per-file mapping with binary guard
    - Source-assertion tests: readFileSync + string assertions, no @testing-library/react

key-files:
  created:
    - ui/src/code-review/AppToolbar.tsx
    - ui/src/code-review/AppToolbar.test.ts
    - ui/src/code-review/FileListPane.tsx
    - ui/src/code-review/FileListPane.test.ts
    - ui/src/code-review/DiffPane.tsx
    - ui/src/code-review/DiffPane.test.ts
  modified:
    - ui/vitest.setup.ts (added window.matchMedia mock)

key-decisions:
  - "window.matchMedia mock added to vitest.setup.ts — jsdom does not implement it; DiffPane module-scope theme read fails without it"
  - "DiffPane comment text must not include window.matchMedia text — source-assertion test counts occurrences via regex"

patterns-established:
  - "AppToolbar focus rings: inline onFocus/onBlur style toggle, never :focus-visible CSS"
  - "FileListPane: IntersectionObserver root=diffPaneRef.current, rootMargin='-10px 0px -85% 0px', click calls both onActiveIndexChange and scrollIntoView immediately"
  - "DiffPane binary guard: file.patch === '[binary file]' renders placeholder instead of PatchDiff"
  - "DiffPane DIFF_THEME: typeof guard + module-scope read, no re-read inside component"

requirements-completed:
  - DIFF-02
  - DIFF-03
  - DIFF-04

# Metrics
duration: ~25min
completed: 2026-05-24
---

# Phase 25 Plan 02: Diff Viewer UI Components Summary

**AppToolbar (layout toggles), FileListPane (IntersectionObserver sidebar), and DiffPane (PatchDiff per file with all UI states) — 43 source-assertion tests, tsc build clean**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-24T00:30:00Z
- **Completed:** 2026-05-24T00:45:40Z
- **Tasks:** 3
- **Files modified:** 7 (6 created + 1 modified)

## Accomplishments

- `AppToolbar`: 48px header with Unified/Side-by-side toggle and Expand All/Collapse/Loading button; focus rings via onFocus/onBlur; reserved slot stub for D-03 future controls
- `FileListPane`: status dot + basename + rename icon (↳) + change counts; IntersectionObserver active tracking mirrors OutlinePane; click calls both onActiveIndexChange and scrollIntoView
- `DiffPane`: loading spinner, empty state, error state with Reload Diff button, and PatchDiff per file; binary file guard prevents passing `[binary file]` sentinel to PatchDiff; DIFF_THEME read once at module scope
- 43 source-assertion tests: 11 (AppToolbar) + 17 (FileListPane) + 15 (DiffPane), all passing

## Task Commits

1. **Task 1: AppToolbar** - `158d1a7` (feat)
2. **Task 2: FileListPane** - `22c22b8` (feat)
3. **Task 3: DiffPane** - `36b39c7` (feat)

## Files Created/Modified

- `ui/src/code-review/AppToolbar.tsx` — 48px header strip with layout and expand toggles, AppToolbarProps interface
- `ui/src/code-review/AppToolbar.test.ts` — 11 source-assertion tests
- `ui/src/code-review/FileListPane.tsx` — sidebar file list with IntersectionObserver active tracking, FileListPaneProps interface
- `ui/src/code-review/FileListPane.test.ts` — 17 source-assertion tests
- `ui/src/code-review/DiffPane.tsx` — right-column scroll container with PatchDiff integration, DiffPaneProps interface
- `ui/src/code-review/DiffPane.test.ts` — 15 source-assertion tests
- `ui/vitest.setup.ts` — added `window.matchMedia` mock (jsdom does not implement it)

## Decisions Made

- `window.matchMedia` mock added to `vitest.setup.ts`: jsdom doesn't define it, causing DiffPane's module-scope theme check to throw at import time in tests
- Source comment on DiffPane's DIFF_THEME must not include `window.matchMedia` text: the test uses a regex to count occurrences and expects exactly 1

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added window.matchMedia mock to vitest.setup.ts**
- **Found during:** Task 3 (DiffPane implementation)
- **Issue:** DiffPane reads `window.matchMedia('(prefers-color-scheme: dark)')` at module scope (D-12). jsdom (the vitest test environment) does not implement `window.matchMedia`, causing a `TypeError: window.matchMedia is not a function` at import time when the test tried to load DiffPane.
- **Fix:** Added `window.matchMedia` mock to `ui/vitest.setup.ts` using `vi.fn().mockImplementation` returning `{ matches: false, ... }`. This is the established pattern — the file already has IntersectionObserver and ResizeObserver mocks for the same reason.
- **Files modified:** `ui/vitest.setup.ts`
- **Verification:** All 15 DiffPane tests now pass; all 384 tests in the full suite pass
- **Committed in:** `36b39c7` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required to unblock Task 3. No scope creep — vitest.setup.ts is the correct place for jsdom shims.

## Issues Encountered

- DiffPane source comment containing `window.matchMedia` caused the "appears exactly once" source-assertion test to count 2 occurrences instead of 1. Fixed by rewriting the comment to not include the API name.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 25-03 can now:
- Import `AppToolbar` with the exact `AppToolbarProps` interface (5 props)
- Import `FileListPane` with the exact `FileListPaneProps` interface (4 props)
- Import `DiffPane` with the exact `DiffPaneProps` interface (6 props)
- Wire `CodeReviewApp` root component, `main.tsx` pathname detection, and ARCH-01 Rust cleanup

All three components are isolated from `reviewer-v2/` (ESLint-enforced). The `diffPaneRef` ref pattern (shared between `CodeReviewApp`, `FileListPane`, and `DiffPane`) is ready to be wired in 25-03.

---
*Phase: 25-diff-viewer-ui*
*Completed: 2026-05-24*
