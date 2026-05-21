---
plan: 21-01
phase: 21-comment-actions
status: complete
completed: 2026-05-21
key-files:
  created:
    - ui/src/reviewer-v2/AnnotationForm.tsx
    - ui/src/reviewer-v2/AnnotationForm.test.ts
    - ui/src/reviewer-v2/hooks/useSectionAnnotationCounts.ts
    - ui/src/reviewer-v2/hooks/useSectionAnnotationCounts.test.ts
  modified:
    - ui/src/reviewer-v2/hooks/useTextSelection.ts
    - ui/src/reviewer-v2/hooks/useTextSelection.test.ts
commits:
  - f284fe8 feat(21-01): add getElementCharOffset to useTextSelection + tests
  - e829ed3 feat(21-01): add useSectionAnnotationCounts hook + computeSectionAnnotationCounts + tests
  - 9a63ed1 feat(21-01): add AnnotationForm popover component + source-as-text tests
tests: 53 passed (3 test files)
---

## What Was Built

Three foundational Wave 1 artifacts required before Wave 2 wiring can proceed:

**1. `getElementCharOffset` (useTextSelection.ts)**
Added `export function getElementCharOffset(container, targetElement)` immediately after `rangeFromOffsets`. Uses `document.createTreeWalker(SHOW_TEXT)` and checks `targetElement.contains(node)` (not `===`) to correctly handle headings with inline children (Pitfall 6 from RESEARCH.md). Returns total container length when target is not a descendant. 4 unit tests.

**2. `useSectionAnnotationCounts` + `computeSectionAnnotationCounts` (new hook)**
Pure `computeSectionAnnotationCounts(container, sections, annotations)` builds heading boundaries via `getElementCharOffset`, sorts them, then assigns each annotation to the last boundary `<= anchorStart`. Annotations before the first heading are silently skipped (D-14/OUTLINE-04). `useSectionAnnotationCounts` is a thin `useMemo` wrapper. 13 unit tests cover all boundary semantics.

**3. `AnnotationForm` default export + `FormState` type (new component)**
Fixed-position popover (width 280, zIndex 20) with uncontrolled textarea (autoFocus, defaultValue from `formState.prefill`). Keyboard contract: Cmd/Ctrl+Enter → submit, Escape → cancel. Click-outside cancel via `document.addEventListener('mousedown', ...)` with cleanup. `onMouseDown={stopPropagation}` on container prevents `useTextSelection` from clearing stored offsets while the user types (Pitfall 3 mitigation). `FormState` interface exported for Wave 2 ContentPane wiring. 21 source-as-text tests.

## Deviations

None. Implemented exactly per plan specification.

## Self-Check: PASSED

- All 3 tasks committed atomically (3 commits)
- 53 tests pass across 3 test files
- No new lint errors in authored files (2 pre-existing errors in unrelated lines remain)
- No `@testing-library/react` imports anywhere
- No new npm packages installed
- `FormState` and `getElementCharOffset` exported and ready for Wave 2
