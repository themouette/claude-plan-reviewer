---
phase: 21-comment-actions
fixed_at: 2026-05-22T18:44:30Z
review_path: .planning/phases/21-comment-actions/21-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 21: Code Review Fix Report

**Fixed at:** 2026-05-22T18:44:30Z
**Source review:** .planning/phases/21-comment-actions/21-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (3 Critical + 6 Warning)
- Fixed: 9
- Skipped: 0

## Fixed Issues

### CR-01: `rangeFromOffsets` drops annotations whose anchor ends exactly at a text-node boundary

**Files modified:** `ui/src/reviewer-v2/hooks/useTextSelection.ts`
**Commit:** dd2c6d1
**Applied fix:** Changed `charCount + len > start` to `charCount + len >= start` on line 71 so the start-node condition uses `>=` to match the end-node condition, preventing reversed Range boundary points when a selection starts exactly at a text-node edge.

---

### CR-02: "Save Changes" button missing `onMouseDown preventDefault`

**Files modified:** `ui/src/reviewer-v2/CommentBubble.tsx`
**Commit:** 0b31427
**Applied fix:** Added `onMouseDown={(e) => e.preventDefault()}` to the "Save Changes" button, consistent with all other action buttons in the component, preventing the article `onClick` from firing before the save commits.

---

### CR-03: `editingId` is not cleared when the annotation being edited is deleted

**Files modified:** `ui/src/reviewer-v2/ReviewerV2Shell.tsx`
**Commit:** 48f9bbc
**Applied fix:** Wrapped `onRemove={removeAnnotation}` in a closure that clears both `editingId` and `focusedCommentId` (via `setEditingId(null)` / `setFocusedCommentId(null)`) when the removed id matches the current editing/focused state before calling `removeAnnotation(id)`. This also addresses WR-04.

---

### WR-01: `CommentPane` bubbles drift from anchors when content is scrolled

**Files modified:** `ui/src/reviewer-v2/CommentPane.tsx`
**Commit:** dab1412
**Applied fix:** Added a `scroll` event listener on `scroller` (captured as `el = mainRef.current`) with `{ passive: true }` alongside the existing `ResizeObserver`. The cleanup function now also removes the scroll listener.

---

### WR-02: `handleFormCancel` not memoized in `ContentPane`

**Files modified:** `ui/src/reviewer-v2/ContentPane.tsx`, `ui/src/reviewer-v2/ContentPane.test.ts`
**Commit:** 361fe92 (source fix), 31b3cdc (test update)
**Applied fix:** Added `useCallback` to the import and converted `function handleFormCancel()` to `const handleFormCancel = useCallback(() => { ... }, [resetTextSelection])`. Updated the source-contract tests in `ContentPane.test.ts` to match the new `useCallback` form (the regex previously matched the `function` keyword declaration).

---

### WR-03: `GutterIcon.test.ts` uses CWD-relative path for `readFileSync`

**Files modified:** `ui/src/reviewer-v2/GutterIcon.test.ts`
**Commit:** 153dcc3
**Applied fix:** Added `import { resolve } from 'path'` and changed `readFileSync('src/reviewer-v2/GutterIcon.tsx', 'utf8')` to `readFileSync(resolve(__dirname, './GutterIcon.tsx'), 'utf-8')`, matching the pattern used by all other test files in this directory.

---

### WR-04: `focusedCommentId` not cleared on annotation removal

**Files modified:** `ui/src/reviewer-v2/ReviewerV2Shell.tsx`
**Commit:** 48f9bbc (combined with CR-03)
**Applied fix:** Addressed as part of CR-03 fix — the `onRemove` closure clears both `editingId` and `focusedCommentId` when the removed annotation id matches.

---

### WR-05: Popup top not clamped to viewport bottom

**Files modified:** `ui/src/reviewer-v2/ContentPane.tsx`, `ui/src/reviewer-v2/SelectionToolbar.tsx`
**Commit:** 6b36c0f
**Applied fix:** In `ContentPane.tsx`, replaced `const formTop = (lastRect?.bottom ?? 0) + 6` with a `Math.min` clamp using `FORM_HEIGHT_ESTIMATE = 140`. In `SelectionToolbar.tsx`, replaced `const top = lastRect.bottom + 6` with a `Math.min` clamp using `TOOLBAR_HEIGHT_ESTIMATE = 44`.

---

### WR-06: `useSectionAnnotationCounts` captures `planRef.current` outside `useMemo`

**Files modified:** `ui/src/reviewer-v2/hooks/useSectionAnnotationCounts.ts`
**Commit:** 3d81abb
**Applied fix:** Moved the `const container = planRef.current` read from outside the `useMemo` callback to inside it, so the container is always fresh when the memo recomputes. Added an explanatory comment noting why `planRef` is in the dep array (stable identity) and that recomputes are driven by `sections`/`annotations`.

---

_Fixed: 2026-05-22T18:44:30Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
