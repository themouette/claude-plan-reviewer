---
phase: 20-comment-pane
reviewed: 2026-05-21T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - ui/src/reviewer-v2/hooks/useCommentLayout.ts
  - ui/src/reviewer-v2/hooks/useCommentLayout.test.ts
  - ui/src/reviewer-v2/types.ts
  - ui/src/reviewer-v2/useAnnotations.test.ts
  - ui/src/index.css
  - ui/src/reviewer-v2/CommentBubble.tsx
  - ui/src/reviewer-v2/CommentBubble.test.ts
  - ui/src/reviewer-v2/CommentPane.tsx
  - ui/src/reviewer-v2/CommentPane.test.ts
  - ui/src/reviewer-v2/ReviewerV2Shell.test.ts
  - ui/src/reviewer-v2/hooks/offsetFromPoint.ts
  - ui/src/reviewer-v2/hooks/offsetFromPoint.test.ts
  - ui/src/reviewer-v2/ReviewerV2Shell.tsx
  - ui/src/reviewer-v2/ContentPane.tsx
  - ui/src/reviewer-v2/ContentPane.test.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-05-21
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Phase 20 delivers `CommentPane`, `CommentBubble`, the `computeCommentLayout` and `offsetFromPoint` pure functions, the bidirectional hover system wired through `ContentPane` and `ReviewerV2Shell`, and `index.css` CSS Custom Highlight registrations. The data-flow architecture is sound: annotation state is owned by `useAnnotations`, anchor positions are recomputed on scroll/resize via `ResizeObserver`, and the CSS Highlight API is used correctly for both selection persistence and comment-hover feedback.

Two blockers prevent correct visual output. `CommentBubble` has a CSS shorthand collision that silently erases the annotation-type colour indicator on every bubble. `CommentPane` always passes the compact height for every annotation, including the focused/expanded one, causing the layout algorithm to under-estimate `previousBottom` and place following items on top of the expanded bubble. Beyond those, four warnings cover stale-highlight lifecycle, an irrecoverable expanded state, a D-07 stub with no serialization guard, and a duplicated constant that can silently skew layout.

---

## Critical Issues

### CR-01: `borderLeft` overwritten by `border` shorthand in `CommentBubble` — type indicator never renders

**File:** `ui/src/reviewer-v2/CommentBubble.tsx:39-40`

**Issue:** Inside `baseStyle`, `borderLeft` is assigned first (line 39) and then immediately overwritten by the shorthand `border` (line 40). React applies inline style object keys in their declaration order by setting individual `element.style` properties in iteration order. Because `borderLeft` appears before `border` in the object literal, React sets `element.style.borderLeft` first, then sets `element.style.border`, which is a CSS shorthand that resets all four border sub-properties including `borderLeft`. The result: every annotation bubble renders with a uniform 1px grey border on all sides; the annotation-type colour stripe on the left is never visible.

The existing test suite does not catch this because `CommentBubble.test.ts` only asserts that the string `'borderLeft'` appears somewhere in the source, not that it is applied after the shorthand.

**Fix:** Move `borderLeft` after the shorthand declaration so it applies last:

```tsx
const baseStyle: React.CSSProperties = {
  position: 'absolute',
  top,
  left: 0,
  right: 0,
  border: '1px solid var(--color-border)',     // shorthand first
  borderLeft: `3px solid ${borderColor}`,      // specific override after
  borderRadius: 6,
  padding: '8px 12px',
  background: 'var(--color-surface)',
  cursor: 'pointer',
  zIndex: isFocused ? 2 : 1,
}
```

---

### CR-02: `CommentPane` passes `height: COMPACT_HEIGHT` for all items including the focused one — following items overlap the expanded bubble

**File:** `ui/src/reviewer-v2/CommentPane.tsx:86-93`

**Issue:** The `layoutItems` array is built by mapping over annotations and always setting `height: COMPACT_HEIGHT` (48). This value is passed into `computeCommentLayout`, which uses `item.height` for the expanded item to compute `previousBottom` (line 28 of `useCommentLayout.ts`: `previousBottom = top + item.height + GAP`). Because `COMPACT_HEIGHT = 48` is far smaller than the actual rendered height of an expanded bubble (which shows full comment text plus a type badge — typically 100–180px), the `previousBottom` after the focused item is severely under-estimated. Every annotation that follows the focused one will be positioned to start roughly 56px below the focused anchor, overlapping the expanded bubble's body.

The unit tests in `useCommentLayout.test.ts` pass `height: 120` for expanded items — this discrepancy means the algorithm is tested correctly but the call site is broken.

**Fix:** Pass the actual expanded height. If it is not yet measured, use a representative estimate for the focused item:

```tsx
const EXPANDED_HEIGHT_ESTIMATE = 160   // temporary until Phase 21 layout measurement

const layoutItems = annotations
  .filter((ann) => anchorYMap.has(ann.id))
  .map((ann) => {
    const isExpanded = focusedCommentId === ann.id
    return {
      id: ann.id,
      anchorY: anchorYMap.get(ann.id)!,
      isExpanded,
      height: isExpanded ? EXPANDED_HEIGHT_ESTIMATE : COMPACT_HEIGHT,
    }
  })
```

---

## Warnings

### WR-01: `focusedCommentId` can never be cleared — the expanded bubble is permanently locked open

**File:** `ui/src/reviewer-v2/CommentPane.tsx:112` and `ui/src/reviewer-v2/ReviewerV2Shell.tsx`

**Issue:** `onClick` always calls `onFocus(ann.id)`. If the user clicks the already-focused annotation, the same id is set again — the bubble never collapses. There is no document-level click handler, Escape-key handler, or any other code path in `ReviewerV2Shell` that calls `setFocusedCommentId(null)`. Once any bubble is clicked, the expanded state is permanent for the lifetime of the page.

**Fix:** Toggle off on re-click, and add an Escape handler in `ReviewerV2Shell`:

```tsx
// CommentPane.tsx line 112 — toggle off when already focused:
onClick={() => onFocus(focusedCommentId === ann.id ? null : ann.id)}

// ReviewerV2Shell.tsx — Escape key to collapse:
useEffect(() => {
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') setFocusedCommentId(null)
  }
  document.addEventListener('keydown', onKeyDown)
  return () => document.removeEventListener('keydown', onKeyDown)
}, [])
```

---

### WR-02: CSS `comment-hover` highlight not cleared when `rangeFromOffsets` returns `null` and not deleted on unmount

**File:** `ui/src/reviewer-v2/ContentPane.tsx:65-80`

**Issue:** Two related gaps in the `hoveredCommentId` effect:

1. When `rangeFromOffsets` returns `null` (lines 76-79), the highlight is not deleted. If a previous hover established a highlight and `hoveredCommentId` then changes to an annotation whose offsets cannot be resolved (e.g., during a plan content reload), the old highlight remains visible.
2. The effect has no cleanup function. If `ContentPane` unmounts while `hoveredCommentId` is non-null, the `Highlight` entry stays registered in the global `CSS.highlights` registry.

**Fix:**

```tsx
useEffect(() => {
  if (!supportsHighlights) return
  if (!hoveredCommentId || !planRef.current) {
    CSS.highlights.delete(COMMENT_HOVER_HIGHLIGHT)
    return () => { CSS.highlights.delete(COMMENT_HOVER_HIGHLIGHT) }
  }
  const annotation = annotations?.find((a) => a.id === hoveredCommentId)
  if (!annotation) {
    CSS.highlights.delete(COMMENT_HOVER_HIGHLIGHT)
    return () => { CSS.highlights.delete(COMMENT_HOVER_HIGHLIGHT) }
  }
  const range = rangeFromOffsets(planRef.current, annotation.anchorStart, annotation.anchorEnd)
  if (range) {
    CSS.highlights.set(COMMENT_HOVER_HIGHLIGHT, new Highlight(range))
  } else {
    CSS.highlights.delete(COMMENT_HOVER_HIGHLIGHT)   // clear stale highlight
  }
  return () => { CSS.highlights.delete(COMMENT_HOVER_HIGHLIGHT) }
}, [hoveredCommentId, annotations, planRef])
```

---

### WR-03: D-07 stub `comment: anchorText` will reach the Rust backend with wrong content if the user submits before Phase 21

**File:** `ui/src/reviewer-v2/ContentPane.tsx:97`

**Issue:** Annotations are created with `comment: anchorText` as an explicit stub. The comment in the source says Phase 21 will replace this with a textarea form, but there is no guard preventing a user from clicking the submit/approve action before Phase 21 ships. `serializeAnnotations` (present in `ui/src/reviewer-v2/serializeAnnotations.ts`) will include `comment: anchorText` verbatim in the JSON payload sent to the Rust hook, meaning the user's annotation will carry the selected text as both `anchorText` and `comment` rather than any authored feedback. This is a silent data-correctness issue — the backend will accept the payload, the user will receive no error, and the comment field in the hook output will be meaningless.

**Fix:** Mark stub annotations at creation and filter them before serialization, or block submission when any annotation has an empty/stub comment:

```tsx
// At creation in handleAction — tag as draft:
comment: '',  // cleared stub; Phase 21 replaces with textarea value

// In serializeAnnotations or submission handler:
const submittable = annotations.filter((a) => a.comment.trim().length > 0)
```

---

### WR-04: `COMPACT_HEIGHT = 48` duplicated across `CommentPane` and `useCommentLayout` — silent skew if they diverge

**File:** `ui/src/reviewer-v2/CommentPane.tsx:7` and `ui/src/reviewer-v2/hooks/useCommentLayout.ts:1`

**Issue:** Both files independently define `const COMPACT_HEIGHT = 48`. The layout algorithm in `useCommentLayout.ts` uses its own copy as the height of non-expanded items (line 34: `const height = COMPACT_HEIGHT`). `CommentPane` passes its own copy as the `height` input. If either value is changed in isolation the layout positions will silently diverge — items will either overlap or carry unexpected gaps with no error thrown.

**Fix:** Export the constant from `useCommentLayout.ts` and import it in `CommentPane.tsx`:

```typescript
// useCommentLayout.ts — add export
export const COMPACT_HEIGHT = 48

// CommentPane.tsx — replace local declaration with import
import { computeCommentLayout, COMPACT_HEIGHT } from './hooks/useCommentLayout'
```

---

## Info

### IN-01: `aria-expanded` on `<article>` is non-standard ARIA — screen readers will not announce it

**File:** `ui/src/reviewer-v2/CommentBubble.tsx:85-88`

**Issue:** `aria-expanded` is valid only on ARIA widget roles that own collapsible sub-trees (`button`, `combobox`, `listbox`, `treeitem`, etc.). The `<article>` element carries implicit role `article`, which does not support `aria-expanded`. Screen readers will not surface the expanded/collapsed state. The attribute is also always emitted — even as `aria-expanded="false"` when not focused — which is non-standard; the attribute should be absent when the element does not control a disclosure.

**Fix:** Move the expand/collapse semantics to a `<button>` element inside the bubble, or apply `role="button"` with `tabIndex={0}` to the `<article>` if it must remain the interactive element.

---

### IN-02: Test suite scans source text — behavioral regressions not caught

**Files:** `ui/src/reviewer-v2/CommentBubble.test.ts`, `CommentPane.test.ts`, `ContentPane.test.ts`, `ReviewerV2Shell.test.ts`

**Issue:** All tests in these files read the `.tsx` source as a raw string and assert substring presence. This pattern detects deletion of structural contracts but cannot detect logic errors. The CR-01 `borderLeft`/`border` collision and CR-02 height mismatch are both invisible to the current test suite because the test only checks that the tokens appear somewhere in the source, not that they produce correct output. Any correct refactoring that renames a token (e.g., replacing inline `borderLeft` with a CSS variable) would also break tests without breaking behaviour.

**Fix:** Progressively migrate key assertions to render-level tests using `@testing-library/react`. Priority: a render test for `CommentBubble` verifying `borderLeft` style value, and a snapshot or layout test for `CommentPane` verifying bubble positions for a two-annotation, one-focused scenario.

---

### IN-03: `handleAdd` in `ContentPane` is dead abstraction

**File:** `ui/src/reviewer-v2/ContentPane.tsx:108-110`

**Issue:** `handleAdd` contains only `resetTextSelection()` and is passed as the `onAdd` prop to `PlanContent`. It adds no logic over passing `resetTextSelection` directly. The Phase 18 comment states Phase 21 will expand it; until then it is unnecessary indirection.

**Fix:** If Phase 21 will genuinely expand the function, leave it. Otherwise collapse to:

```tsx
<PlanContent onAdd={resetTextSelection} ... />
```

---

_Reviewed: 2026-05-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
