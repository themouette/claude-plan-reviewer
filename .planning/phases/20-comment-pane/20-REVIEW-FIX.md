---
phase: 20-comment-pane
fixed_at: 2026-05-21T00:00:00Z
review_path: .planning/phases/20-comment-pane/20-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 20: Code Review Fix Report

**Fixed at:** 2026-05-21
**Source review:** `.planning/phases/20-comment-pane/20-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, CR-02, WR-01, WR-02, WR-04)
- Fixed: 5
- Skipped: 0

Note: WR-03 was excluded from scope per instructions — it is a design decision about stub annotation data requiring Phase 21 context, not a code fix.

## Fixed Issues

### CR-01: borderLeft/border order swapped in CommentBubble

**Files modified:** `ui/src/reviewer-v2/CommentBubble.tsx`
**Commit:** b24da5f
**Applied fix:** Moved `border: '1px solid var(--color-border)'` before `borderLeft: '3px solid ...'` in the `baseStyle` object so the specific left-border colour override is not silently erased by the shorthand reset.

---

### WR-04: COMPACT_HEIGHT deduplicated — exported from useCommentLayout

**Files modified:** `ui/src/reviewer-v2/hooks/useCommentLayout.ts`, `ui/src/reviewer-v2/CommentPane.tsx`
**Commit:** 9ece215
**Applied fix:** Added `export` to `COMPACT_HEIGHT` in `useCommentLayout.ts`. Updated the import in `CommentPane.tsx` to `import { computeCommentLayout, COMPACT_HEIGHT } from './hooks/useCommentLayout'` and removed the duplicate local `const COMPACT_HEIGHT = 48` declaration.

Note: WR-04 was committed before CR-02 because CR-02's CommentPane changes depended on the import being in place.

---

### CR-02: EXPANDED_HEIGHT_ESTIMATE passed for focused item in layoutItems

**Files modified:** `ui/src/reviewer-v2/CommentPane.tsx`
**Commit:** 64dbf78
**Applied fix:** Added `const EXPANDED_HEIGHT_ESTIMATE = 160` constant and updated the `layoutItems` map to pass `height: isExpanded ? EXPANDED_HEIGHT_ESTIMATE : COMPACT_HEIGHT` so `computeCommentLayout` correctly estimates the height of the expanded bubble when computing following-item positions.
**Status:** fixed: requires human verification — the constant value 160 is an estimate. Phase 21 should replace it with a measured height.

---

### WR-01: Focused comment state can now be cleared

**Files modified:** `ui/src/reviewer-v2/CommentPane.tsx`, `ui/src/reviewer-v2/ReviewerV2Shell.tsx`
**Commit:** c647ba1
**Applied fix:**
- In `CommentPane.tsx`: changed `onClick={() => onFocus(ann.id)}` to `onClick={() => onFocus(focusedCommentId === ann.id ? null : ann.id)}` so clicking an already-focused bubble collapses it.
- In `ReviewerV2Shell.tsx`: added `useEffect` to the import and a document-level `keydown` handler that calls `setFocusedCommentId(null)` when Escape is pressed, with proper cleanup.

---

### WR-02: CSS comment-hover highlight cleanup added

**Files modified:** `ui/src/reviewer-v2/ContentPane.tsx`
**Commit:** 60db198
**Applied fix:**
- Early-return paths (no `hoveredCommentId`, no matching annotation) now return a cleanup function instead of a bare `return`.
- When `rangeFromOffsets` returns `null`, `CSS.highlights.delete(COMMENT_HOVER_HIGHLIGHT)` is called to clear any stale highlight.
- A cleanup function `return () => { CSS.highlights.delete(COMMENT_HOVER_HIGHLIGHT) }` is added at the end of the effect so the highlight is removed on unmount and before each re-run.

---

_Fixed: 2026-05-21_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
