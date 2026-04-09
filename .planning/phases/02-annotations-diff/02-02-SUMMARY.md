---
phase: 02-annotations-diff
plan: 02
subsystem: ui
tags: [react, typescript, vitest, annotation, diff, @pierre/diffs]

# Dependency graph
requires:
  - phase: 02-annotations-diff plan 01
    provides: "@pierre/diffs installed on Rust side, GET /api/diff route returning raw unified diff string"
provides:
  - "Annotation and Tab type definitions (types.ts)"
  - "serializeAnnotations utility producing D-08 structured markdown format"
  - "useTextSelection hook tracking text selections within a container ref"
  - "TabBar component with Plan/Diff tabs and full ARIA tablist support"
  - "DiffView component wrapping @pierre/diffs PatchDiff with empty state"
  - "AnnotationSidebar component with OverallCommentField, AnnotationCard list, AddAnnotationAffordance"
affects: [02-03-PLAN]

# Tech tracking
tech-stack:
  added: ["@pierre/diffs ^1.1.12", "vitest ^4.1.4"]
  patterns:
    - "Inline React styles with CSS custom property fallbacks (var(--token, #hex))"
    - "TDD RED/GREEN for serialization logic"
    - "Sub-components defined in same file as parent (not exported)"
    - "onMouseDown preventDefault on annotation pill buttons (Pitfall 1 guard)"

key-files:
  created:
    - ui/src/types.ts
    - ui/src/utils/serializeAnnotations.ts
    - ui/src/utils/serializeAnnotations.test.ts
    - ui/src/hooks/useTextSelection.ts
    - ui/src/components/TabBar.tsx
    - ui/src/components/DiffView.tsx
    - ui/src/components/AnnotationSidebar.tsx
  modified:
    - ui/package.json

key-decisions:
  - "vitest added as devDependency with 'test' script for serializeAnnotations unit tests"
  - "AnnotationCard sub-components defined in same AnnotationSidebar.tsx file (not exported separately)"
  - "CSS custom property fallback pattern: var(--color-tab-active, #f1f5f9) — works before Plan 03 adds tokens to index.css"
  - "onMouseDown e.preventDefault() on annotation pills is critical Pitfall 1 guard — prevents selection clearing before click fires"

patterns-established:
  - "Pattern: Sub-components private to a file — only export the top-level component"
  - "Pattern: Inline styles with CSS custom property fallback values for tokens not yet declared"
  - "Pattern: TDD for serialization utilities — test behavior, not implementation"

requirements-completed: [ANN-01, ANN-02, ANN-03, ANN-04, ANN-05, DIFF-02, DIFF-03]

# Metrics
duration: 4min
completed: 2026-04-09
---

# Phase 02 Plan 02: Annotations & Diff — Frontend Components Summary

**React annotation system: types, serializeAnnotations (8 tests passing), useTextSelection hook, TabBar/DiffView/AnnotationSidebar components ready for App.tsx wiring in Plan 03**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-09T14:30:29Z
- **Completed:** 2026-04-09T14:34:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Defined `Annotation`, `AnnotationType`, `Tab` types in `ui/src/types.ts`
- Implemented `serializeAnnotations` with TDD — 8 tests covering all D-08 format combinations
- Implemented `useTextSelection` hook listening to `selectionchange` with container guard
- Created `TabBar` with full ARIA tablist/tab/aria-selected/aria-controls pattern
- Created `DiffView` wrapping `@pierre/diffs` `PatchDiff` with empty state and `aria-label`
- Created `AnnotationSidebar` with `OverallCommentField`, `AnnotationCard` (type-colored left border), `AddAnnotationAffordance` pills with `onMouseDown preventDefault` (Pitfall 1 guard)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: serializeAnnotations tests** - `3b565fc` (test)
2. **Task 1 GREEN: types + serializeAnnotations + useTextSelection** - `4f49e8d` (feat)
3. **Task 2: TabBar + DiffView + AnnotationSidebar** - `d9dda84` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified

- `ui/package.json` — added `@pierre/diffs` dependency, `vitest` devDependency, `"test"` script
- `ui/src/types.ts` — `Annotation`, `AnnotationType`, `Tab` type exports
- `ui/src/utils/serializeAnnotations.ts` — D-08 format serialization function
- `ui/src/utils/serializeAnnotations.test.ts` — 8 vitest behavior tests (all passing)
- `ui/src/hooks/useTextSelection.ts` — `selectionchange` listener with container guard
- `ui/src/components/TabBar.tsx` — Plan/Diff tab bar with ARIA tablist
- `ui/src/components/DiffView.tsx` — `@pierre/diffs` `PatchDiff` wrapper with empty state
- `ui/src/components/AnnotationSidebar.tsx` — Sidebar with OverallComment, AnnotationCard list, AddAnnotationAffordance

## Decisions Made

- **vitest as devDependency**: Not present in Phase 1; added with `"test": "vitest run"` script to enable unit testing of serialization logic.
- **Sub-components in same file**: `OverallCommentField`, `AnnotationCard`, `AddAnnotationAffordance` are defined in `AnnotationSidebar.tsx` but not exported — keeps import graph simple and these components are only used in the sidebar.
- **CSS variable fallback pattern**: `var(--color-tab-active, #f1f5f9)` — Plan 03 will add the CSS variables to `index.css`; the fallback hex values ensure the component works before that.
- **`onMouseDown` guard is critical**: Without `e.preventDefault()` on annotation pills, `mousedown` clears the text selection before `click` fires — annotating would always produce empty `anchorText`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — all components have full logic. No hardcoded empty values that affect functionality.

## Next Phase Readiness

- All 6 new frontend files ready for import by Plan 03 (App.tsx wiring)
- Plan 03 needs to: import `TabBar`, `DiffView`, `AnnotationSidebar`; add tab state; add annotation state; remove 900px max-width cap; add two-column layout; add `GET /api/diff` fetch; update `denyMessageValid` logic
- TypeScript compiles cleanly with zero errors
- `@pierre/diffs` installed and ready in the `node_modules`

---
*Phase: 02-annotations-diff*
*Completed: 2026-04-09*

## Self-Check: PASSED

All files exist and all commits found.
- FOUND: ui/src/types.ts
- FOUND: ui/src/utils/serializeAnnotations.ts
- FOUND: ui/src/utils/serializeAnnotations.test.ts
- FOUND: ui/src/hooks/useTextSelection.ts
- FOUND: ui/src/components/TabBar.tsx
- FOUND: ui/src/components/DiffView.tsx
- FOUND: ui/src/components/AnnotationSidebar.tsx
- FOUND: .planning/phases/02-annotations-diff/02-02-SUMMARY.md
- FOUND: commit 3b565fc (test RED)
- FOUND: commit 4f49e8d (feat GREEN)
- FOUND: commit d9dda84 (feat components)
