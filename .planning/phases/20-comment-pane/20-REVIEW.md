---
phase: 20-comment-pane
reviewed: 2026-05-21T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - ui/src/reviewer-v2/CommentBubble.tsx
  - ui/src/reviewer-v2/CommentBubble.test.ts
  - ui/src/reviewer-v2/CommentPane.tsx
  - ui/src/reviewer-v2/CommentPane.test.ts
  - ui/src/reviewer-v2/ContentPane.tsx
  - ui/src/reviewer-v2/ContentPane.test.ts
  - ui/src/reviewer-v2/ReviewerV2Shell.tsx
  - ui/src/reviewer-v2/ReviewerV2Shell.test.ts
  - ui/src/reviewer-v2/hooks/offsetFromPoint.ts
  - ui/src/reviewer-v2/hooks/offsetFromPoint.test.ts
  - ui/src/reviewer-v2/hooks/useCommentLayout.ts
  - ui/src/reviewer-v2/hooks/useCommentLayout.test.ts
  - ui/src/reviewer-v2/types.ts
  - ui/src/reviewer-v2/useAnnotations.test.ts
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-05-21
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 20 delivers CommentPane, CommentBubble, ContentPane annotation wiring, and the
`computeCommentLayout` / `offsetFromPoint` pure functions. The architecture is clean and
the source-file tests (read-file-and-grep pattern) verify the structural contracts
well. However, two blocking correctness bugs were found — one in `computeCommentLayout`
that causes the focused bubble to collide with items that precede it, and one in
`CommentPane` where `planRef` is passed as a `useEffect` dependency but is a
`React.RefObject` whose identity never changes, meaning the effect never re-runs when
the element itself is reassigned. Beyond those blockers there are five warnings covering
logic errors (incorrect `baseStyle` border override, uncleared CSS highlight on
unmount, `comment` field set to `anchorText` stub with no removal guard) and two
quality-level findings.

---

## Critical Issues

### CR-01: `computeCommentLayout` — expanded item can collide with preceding compact items

**File:** `ui/src/reviewer-v2/hooks/useCommentLayout.ts:24-39`

**Issue:** The loop processes items in `anchorY` order. When an expanded (focused) item
appears, it unconditionally snaps `top = item.anchorY` and resets `previousBottom` to
`item.anchorY + item.height + GAP`. It does **not** check whether `item.anchorY` is
already below `previousBottom`. If the preceding compact items have been pushed down
such that `previousBottom > item.anchorY`, the expanded bubble overlaps the tail of the
preceding chain.

Concrete repro:
- Item A: anchorY=100, compact, height=48 → top=100, previousBottom=156
- Item B: anchorY=110, compact, height=48 → pushed to top=156, previousBottom=212
- Item C: anchorY=120, expanded, height=120 → snaps to top=120 — **overlaps B**

The test suite does not cover a focused item that is squeezed by preceding pushes
because the test fixture for the focused-item case (anchorY=130) has item A sitting at
100 with no cascaded push, so previousBottom=156 and anchorY=130 < 156. The test
**passes but hides the bug** in the other ordering.

**Fix:**
```typescript
if (item.isExpanded) {
  // Snap to anchorY but never overlap the previous item
  const top = Math.max(item.anchorY, previousBottom)
  previousBottom = top + item.height + GAP
  result.push({ id: item.id, top, isCompact: false })
}
```

---

### CR-02: `CommentPane` effect dependency on `planRef` / `mainRef` never re-runs when `.current` changes

**File:** `ui/src/reviewer-v2/CommentPane.tsx:28-57`

**Issue:** The `useEffect` lists `[mainRef, planRef, annotations]` as dependencies. Both
refs are `React.RefObject` objects whose **identity** is stable across renders — React
never creates a new ref object when the DOM element is attached. Mutating `.current`
does not trigger a re-run. The effect captures `mainRef.current` and `planRef.current`
at the top as `el` / `content`, then returns a cleanup that uses those same snapshots.
This means:

1. If either ref attaches its element **after** the first render (e.g., the element is
   conditionally rendered), the effect captures `null` and never re-runs.
2. If the content element is replaced (remount), the ResizeObserver continues watching
   the old node and the scroll listener is attached to the old element.

In practice, `ReviewerV2Shell` renders `<main ref={mainRef}>` and
`<div ref={planRef}>` unconditionally, so the first render does attach them. The bug
is latent but will surface in any test or usage that renders `CommentPane` before the
parent DOM is ready (SSR, StrictMode double-invoke, or deferred mounting).

**Fix:** Use a callback ref pattern or an effect that depends on `.current` being
non-null, with a `MutationObserver`/callback ref to detect late attachment:

```typescript
// Minimal safe fix: accept el/content as direct props instead of refs,
// OR ensure the effect re-runs when the element is assigned by depending
// on a state variable that is set by a callback ref in ReviewerV2Shell.
```

Alternatively, add an explicit `null` guard early-return that is **not** silently
swallowed — currently the `if (!el || !content) return` on line 31 silently no-ops
rather than scheduling a retry, so callers have no signal that layout is broken.

---

## Warnings

### WR-01: `CommentBubble` — `borderLeft` override silently lost due to shorthand `border`

**File:** `ui/src/reviewer-v2/CommentBubble.tsx:34-46`

**Issue:** `baseStyle` sets `borderLeft` on line 39, then immediately overrides it with
the shorthand `border: '1px solid var(--color-border)'` on line 40. CSS-in-JS inline
style objects are plain JS objects; later duplicate keys overwrite earlier ones. The
`borderLeft` property is written first but the shorthand `border` key comes second —
**the shorthand wins** and the colored left border is never applied.

```typescript
const baseStyle: React.CSSProperties = {
  // ...
  borderLeft: `3px solid ${borderColor}`,  // line 39 — set
  border: '1px solid var(--color-border)', // line 40 — overwrites borderLeft
```

This is a visual bug: the annotation type color indicator on the bubble's left edge
will never render.

**Fix:**
```typescript
const baseStyle: React.CSSProperties = {
  position: 'absolute',
  top,
  left: 0,
  right: 0,
  border: '1px solid var(--color-border)',
  borderLeft: `3px solid ${borderColor}`, // must come AFTER the shorthand
  borderRadius: 6,
  padding: '8px 12px',
  background: 'var(--color-surface)',
  cursor: 'pointer',
  zIndex: isFocused ? 2 : 1,
}
```

---

### WR-02: CSS `comment-hover` highlight not deleted on `ContentPane` unmount

**File:** `ui/src/reviewer-v2/ContentPane.tsx:65-80`

**Issue:** The `useEffect` that manages `CSS.highlights.set/delete` for the
`comment-hover` highlight has **no cleanup function**. If `ContentPane` unmounts while
`hoveredCommentId` is non-null, the `Highlight` object remains registered in
`CSS.highlights` and will continue to visually highlight text in any other component
that shares the same document. Since the app renders a single `ContentPane` this is
low-risk today, but it is an observable resource leak.

**Fix:**
```typescript
useEffect(() => {
  if (!supportsHighlights) return
  // ... existing set/delete logic ...
  return () => {
    CSS.highlights.delete(COMMENT_HOVER_HIGHLIGHT)
  }
}, [hoveredCommentId, annotations, planRef])
```

---

### WR-03: `ContentPane` stub sets `comment: anchorText` with no guard preventing it from reaching the backend

**File:** `ui/src/reviewer-v2/ContentPane.tsx:97`

**Issue:** The D-07 stub assigns `comment: anchorText` (the raw selected text) as the
annotation's comment field. The comment in the source says "Phase 21 replaces with
textarea form." However, there is no runtime guard preventing this annotation from
being serialized and submitted to the hook payload before Phase 21 lands. If a user
clicks "Approve" after adding annotations, `serializeAnnotations` (which exists in the
module directory) will include `comment: anchorText` verbatim in the JSON sent to the
Rust backend, meaning the annotation comment will duplicate the anchor text rather than
contain any user-authored feedback.

This is a data-correctness bug for the phase boundary: the annotation comment field
arriving at the backend will be wrong content, silently, with no indication to the
user.

**Fix:** Either block the "Approve" / "Submit" action when any annotation has
`comment === anchorText` (or `comment === ''`), or explicitly mark stub annotations
as drafts and filter them before serialization.

---

### WR-04: `CommentPane` — annotations without a resolved `anchorY` are silently dropped from layout but still in the `annotations` array

**File:** `ui/src/reviewer-v2/CommentPane.tsx:86-101`

**Issue:** `layoutItems` is built by filtering to only annotations that appear in
`anchorYMap` (line 87: `.filter((ann) => anchorYMap.has(ann.id))`). Annotations that
fail `rangeFromOffsets` (e.g., because `anchorStart`/`anchorEnd` point past the current
DOM content) are silently excluded. The parent `annotations.map(...)` on line 99 then
calls `layout.find((l) => l.id === ann.id)` and returns `null` for those items. React
will render `null` — which is fine — but:

1. There is no empty-state fallback for the case where `annotations.length > 0` but all
   resolved to `null`. The `if (annotations.length === 0)` guard (line 59) will not
   fire, the wrapper `<div>` will render with zero children, and the user will see a
   blank comment pane with no explanation.
2. A stale annotation whose offsets are outside the current DOM (possible after plan
   content reloads) will produce this silent blank pane indefinitely.

**Fix:** Add a secondary empty-state guard after layout resolution:
```tsx
const visibleCount = annotations.filter((ann) => layout.find((l) => l.id === ann.id)).length
if (visibleCount === 0) {
  return <div style={{ position: 'relative', minHeight: '100%' }}>
    <p style={{ ... }}>Comments are not yet visible — the plan content may still be loading.</p>
  </div>
}
```

---

### WR-05: `offsetFromPoint` — `caretPositionFromPoint` fallback type cast is incorrect for Firefox's actual API shape

**File:** `ui/src/reviewer-v2/hooks/offsetFromPoint.ts:27-30`

**Issue:** The Firefox fallback casts `document` to a type with a `caretPositionFromPoint` that returns `{ offsetNode: Node; offset: number } | null`. The actual Firefox `CaretPosition` object has `offsetNode` and `offset` properties but also a `getClientRect()` method — the cast itself is harmless. However, the `typeof` guard on line 27 casts to a type that **also describes `caretPositionFromPoint` as a function** in the `typeof` check. The cast on line 27 is evaluated before the check passes, meaning the expression always evaluates the cast, even on browsers where neither path should apply. If `document` does not have `caretPositionFromPoint`, TypeScript's narrowing is satisfied by the cast but the runtime `typeof` check is on `(document as T).caretPositionFromPoint` — the cast does not add the property, it only suppresses the type error. This is functionally correct at runtime because `typeof undefined === 'function'` is false, but the cast is semantically misleading and could mask a future refactor that accidentally removes the runtime `typeof` guard and calls the method unconditionally.

More importantly: the same cast object is defined inline on both lines 27 and 28, duplicating the verbose type. If this path ever needs to be updated (e.g., to support the full `CaretPosition` interface), the developer must update two identical inline casts.

**Fix:** Extract a typed accessor:
```typescript
type DocWithCaretPosition = typeof document & {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
}
const docExt = document as DocWithCaretPosition
if (typeof docExt.caretPositionFromPoint === 'function') {
  const cp = docExt.caretPositionFromPoint(clientX, clientY)
  node = cp?.offsetNode ?? null
  nodeOffset = cp?.offset ?? 0
}
```

---

## Info

### IN-01: Test suite uses source-file string scanning instead of rendering — behavioral regressions are not caught

**File:** `ui/src/reviewer-v2/CommentBubble.test.ts`, `CommentPane.test.ts`, `ContentPane.test.ts`, `ReviewerV2Shell.test.ts`

**Issue:** Every test in these four files follows the pattern: read the source file as a
string and assert that it `toContain(...)` a substring. This verifies static structure
(API contracts, import presence) but does **not** execute any component logic. For
example, the `CommentBubble` test confirms that `aria-expanded` appears somewhere in
the source, but does not verify that the rendered output actually sets
`aria-expanded="true"` when `isFocused=true`. The WR-01 `borderLeft`/`border`
collision bug in `CommentBubble` would pass all existing tests because the erroneous
code is present in the source.

This is an accepted pattern in the codebase (phase 20 plan appears to require it), but
it means any logic bug inside JSX expressions or computed styles is invisible to the
test suite.

**Fix:** No immediate action required if source-scanning is the project's intentional
test pattern for this phase. Future phases should add at least one render-level test
(using `@testing-library/react`) per component to catch behavioral regressions.

---

### IN-02: `handleAdd` in `ContentPane` is dead code

**File:** `ui/src/reviewer-v2/ContentPane.tsx:108-110`

**Issue:** `handleAdd` calls only `resetTextSelection()` and is passed as `onAdd` to
`PlanContent`. The Phase 18 comment says it will be wired in Phase 21. In the current
implementation it is purely a passthrough — the same `resetTextSelection` could be
passed directly. This is not harmful, but it is dead abstraction.

**Fix:** Leave as-is if Phase 21 will expand `handleAdd`; otherwise replace with:
```tsx
<PlanContent onAdd={resetTextSelection} ... />
```

---

### IN-03: Magic number `COMPACT_HEIGHT = 48` duplicated across `CommentPane` and `useCommentLayout`

**File:** `ui/src/reviewer-v2/CommentPane.tsx:7`, `ui/src/reviewer-v2/hooks/useCommentLayout.ts:1`

**Issue:** `COMPACT_HEIGHT` is defined as `48` in both modules independently. If the
value is changed in one, it silently diverges in the other. The layout algorithm in
`useCommentLayout` uses `COMPACT_HEIGHT` as the height of non-expanded items; `CommentPane`
passes `height: COMPACT_HEIGHT` in the `layoutItems` array. They must agree.

**Fix:** Export `COMPACT_HEIGHT` from `useCommentLayout.ts` and import it in `CommentPane.tsx`:
```typescript
// useCommentLayout.ts
export const COMPACT_HEIGHT = 48

// CommentPane.tsx
import { computeCommentLayout, COMPACT_HEIGHT } from './hooks/useCommentLayout'
```

---

_Reviewed: 2026-05-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
