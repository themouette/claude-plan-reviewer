---
phase: 21-comment-actions
reviewed: 2026-05-22T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - ui/src/index.css
  - ui/src/reviewer-v2/AnnotationForm.test.ts
  - ui/src/reviewer-v2/AnnotationForm.tsx
  - ui/src/reviewer-v2/CommentBubble.test.ts
  - ui/src/reviewer-v2/CommentBubble.tsx
  - ui/src/reviewer-v2/CommentPane.test.ts
  - ui/src/reviewer-v2/CommentPane.tsx
  - ui/src/reviewer-v2/ContentPane.test.ts
  - ui/src/reviewer-v2/ContentPane.tsx
  - ui/src/reviewer-v2/GutterIcon.test.ts
  - ui/src/reviewer-v2/GutterIcon.tsx
  - ui/src/reviewer-v2/hooks/useSectionAnnotationCounts.test.ts
  - ui/src/reviewer-v2/hooks/useSectionAnnotationCounts.ts
  - ui/src/reviewer-v2/hooks/useTextSelection.test.ts
  - ui/src/reviewer-v2/hooks/useTextSelection.ts
  - ui/src/reviewer-v2/OutlinePane.test.ts
  - ui/src/reviewer-v2/OutlinePane.tsx
  - ui/src/reviewer-v2/PlanContent.test.ts
  - ui/src/reviewer-v2/PlanContent.tsx
  - ui/src/reviewer-v2/ReviewerV2Shell.test.ts
  - ui/src/reviewer-v2/ReviewerV2Shell.tsx
  - ui/src/reviewer-v2/SelectionToolbar.test.ts
  - ui/src/reviewer-v2/SelectionToolbar.tsx
findings:
  critical: 3
  warning: 6
  info: 3
  total: 12
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-05-22T00:00:00Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Phase 21 adds comment edit/delete affordances to `CommentBubble`, wires `editingId` through
`CommentPane` and `ReviewerV2Shell`, introduces sticky/absolute bubble positioning during edit
mode, adds annotation-count badges to `OutlinePane`, and introduces an `AnnotationForm` popup
with auto-submit tracking via `latestFormValueRef`. The end-to-end prop-wiring chain is
consistent and the CSS Custom Highlight API usage is correct.

Three critical correctness bugs were found: a boundary condition in `rangeFromOffsets` that silently
drops annotations whose anchor lands at a text-node boundary; missing `onMouseDown preventDefault`
on the "Save Changes" button that allows the article `onClick` to fire before the save commits;
and a dangling `editingId` when an annotation is deleted without clearing the editing state.
Six quality warnings cover scroll-position drift of bubbles, an unstable `onCancel` closure,
a CWD-relative test path, a missing `focusedCommentId` cleanup on removal, a viewport bottom-edge
clamp gap, and a stale-container risk in `useSectionAnnotationCounts`.

---

## Critical Issues

### CR-01: `rangeFromOffsets` drops annotations whose anchor ends exactly at a text-node boundary

**File:** `ui/src/reviewer-v2/hooks/useTextSelection.ts:71-82`

The start-node condition is `charCount + len > start` (strict greater-than). When `start` falls
exactly at `charCount + len` — i.e., the selection begins at the first character of the *next*
node — `startNode` is not set for the current node and the loop advances. The end condition
`charCount + len >= end` is a greater-than-or-equal, so `endNode` is set at the current node.
After `charCount += len`, the next node satisfies `> start` and sets `startNode`. But `endNode`
was already set on the previous node and the loop breaks — so `endNode` precedes `startNode` in
document order. The resulting `Range` has reversed boundary points, which is a spec violation:
browsers set the range to collapsed at `startNode` instead of spanning both nodes, causing
`rangeFromOffsets` to return a nonsense range that does not cover the annotation anchor.

For `CommentPane.recompute`, the `getBoundingClientRect()` of such a range returns all-zeros (a
collapsed range not in the viewport), so `anchorY` is computed as `0 - containerTop`, a negative
number. `computeCommentLayout` clamps negative values to 0, so the bubble floats to the top of
the comment pane instead of aligning with its anchor text. This is visible in production with any
selection that ends at an HTML element boundary (e.g., the end of a `<code>` span inside a `<p>`).

The existing test `'returns a collapsed range when start === end'` only tests within a single text
node and does not exercise the cross-node boundary case.

**Fix:** Change the `startNode` condition to `>=` to match the `endNode` condition:

```ts
// useTextSelection.ts line ~71
if (startNode === null && charCount + len >= start) {
  startNode = node
  startNodeOffset = start - charCount
}
if (endNode === null && charCount + len >= end) {
  endNode = node
  endNodeOffset = end - charCount
}
if (startNode !== null && endNode !== null) break
charCount += len
```

---

### CR-02: "Save Changes" button missing `onMouseDown preventDefault` — article `onClick` fires before save commits

**File:** `ui/src/reviewer-v2/CommentBubble.tsx:257-273`

Every other action button in `CommentBubble` carries `onMouseDown={(e) => e.preventDefault()}`:
the "Discard Changes" button (line 241), the Edit pencil button (line 184), and the Delete button
(line 210). This guard prevents the `mousedown` event from propagating to `<article>` and
triggering `onClick` (which calls `onFocus` to toggle `focusedCommentId`) before the button's
own `click` fires. The "Save Changes" button has no `onMouseDown` handler:

```tsx
<button
  type="button"
  onClick={(e) => { e.stopPropagation(); onEdit(textareaRef.current?.value ?? '') }}
```

In the browser event sequence, `mousedown` fires before `click`. Without `preventDefault`,
`mousedown` on "Save Changes" propagates up to `<article onClick={onClick}>`. `onClick` calls
the `onFocus` toggle, which in `ReviewerV2Shell` calls `setFocusedCommentId(ann.id ? null : ann.id)`.
If `focusedCommentId` was already `ann.id` (it must be, since the Save button is only visible
when `isFocused`), this sets it to `null` — collapsing the bubble — before the button's `click`
fires and calls `onEdit`. The save still executes (the `click` does fire), but the parent state
has already been modified: the annotation is saved, and the bubble is simultaneously toggled
off. The user sees a flash where the editing state appears to reset.

**Fix:**

```tsx
<button
  type="button"
  onMouseDown={(e) => e.preventDefault()}
  onClick={(e) => { e.stopPropagation(); onEdit(textareaRef.current?.value ?? '') }}
  style={{ ... }}
>
  Save Changes
</button>
```

---

### CR-03: `editingId` is not cleared when the annotation being edited is deleted — dangling state

**File:** `ui/src/reviewer-v2/ReviewerV2Shell.tsx:124`

`onRemove` is wired as:

```tsx
onRemove={removeAnnotation}
```

`removeAnnotation` dispatches `{ type: 'remove', id }` to `annotationReducer`, which removes the
annotation from the list. It does not clear `editingId`. If `editingId` currently points to that
annotation (which requires the user to have entered edit mode before clicking Delete — possible
if the user clicks the pencil, then immediately clicks the × in rapid succession), `editingId`
retains the deleted id. On the next render `CommentPane` iterates `annotations` (now without that
id) and the sticky wrapper is never rendered, so there is no visual corruption. However, the
state is stale. If CR-02's layout fix (or a future refactor) makes `CommentPane` not gate bubble
rendering on `anchorYMap`, a sticky wrapper `{position:'sticky', top:16}` for a ghost annotation
will appear at the top of the comment pane and never go away.

Additionally, the delete button is rendered inside `isFocused && !isEditing`, meaning the user
cannot click Delete while in edit mode in the current UI. But a keyboard `Escape` key exits edit
mode via `ReviewerV2Shell`'s global keydown handler (line 24: `setEditingId(null)`), so the flow
"enter edit → press Escape → click ×" does leave `editingId` unset properly. The flow that
triggers the bug is "enter edit mode on annotation A → the annotation is removed via a future
programmatic path (batch delete, etc.)".

**Fix:**

```tsx
onRemove={(id) => {
  if (editingId === id) setEditingId(null)
  if (focusedCommentId === id) setFocusedCommentId(null)
  removeAnnotation(id)
}}
```

---

## Warnings

### WR-01: `CommentPane` bubbles drift from anchors when content is scrolled — scroll events not handled

**File:** `ui/src/reviewer-v2/CommentPane.tsx:34-64`

`anchorY` is computed as `rangeRect.top - containerRect.top` inside the `recompute` function.
The comment in the code (line 51) correctly notes this is "scroll-invariant" because both rects
shift together when `<main>` scrolls. This is **correct at the moment `recompute` runs**. However,
`recompute` is only wired to a `ResizeObserver` on the content element. A `ResizeObserver` fires
on element *size* changes, not scroll position changes. When the user scrolls the main pane,
`recompute` is not called, so `anchorYMap` values remain from the last resize. But those values
are viewport-relative at the time they were computed. After scrolling by `delta` pixels, the
computed `anchorY` values are off by `delta` relative to the new scroll position, so all bubbles
drift by the scroll delta relative to their anchors.

Concretely: create a comment near the bottom of the plan, then scroll up. The bubble stays at
`layoutItem.top` (computed when the page was at its initial scroll position) while the anchor
text has moved to a different visual position.

**Fix:** Add a `scroll` event listener on `mainRef.current` inside the same `useEffect`:

```tsx
const scroller = el   // mainRef.current captured at effect entry
scroller.addEventListener('scroll', recompute, { passive: true })
return () => {
  ro.disconnect()
  scroller.removeEventListener('scroll', recompute)
}
```

---

### WR-02: `onCancel` in `AnnotationForm` is not memoized — click-outside listener is torn down and re-added on every parent render

**File:** `ui/src/reviewer-v2/AnnotationForm.tsx:27-37` and `ui/src/reviewer-v2/ContentPane.tsx:169-173`

`AnnotationForm.useEffect` has `[onCancel]` as its dependency array. `onCancel` is
`handleFormCancel`, a plain function declaration in `ContentPane` (not wrapped in `useCallback`).
Every render of `ContentPane` creates a new `handleFormCancel` reference, causing the effect to
schedule a cleanup + re-register on every parent render. During the teardown window between
`removeEventListener` and `addEventListener`, a mousedown event is not covered by the listener.
This window is theoretically short but it fires on *every* `ContentPane` render (e.g., every
hover state change in `PlanContent` bubbles up and re-renders `ContentPane`).

**Fix:** Wrap `handleFormCancel` in `useCallback`:

```tsx
const handleFormCancel = useCallback(() => {
  setFormState(null)
  latestFormValueRef.current = ''
  resetTextSelection()
}, [resetTextSelection])
```

---

### WR-03: `GutterIcon.test.ts` uses a CWD-relative path for `readFileSync` — breaks when tests run from any directory other than `ui/`

**File:** `ui/src/reviewer-v2/GutterIcon.test.ts:6`

```ts
const source = readFileSync('src/reviewer-v2/GutterIcon.tsx', 'utf8')
```

All other test files in this directory use `resolve(__dirname, './Component.tsx')`, which is
directory-independent. This file uses a CWD-relative path that resolves against the process
working directory. Running `npm test` from the repo root or using `--prefix ui` from CI will
throw `ENOENT` and fail all source-contract assertions in this file.

**Fix:**

```ts
import { resolve } from 'path'
const source = readFileSync(resolve(__dirname, './GutterIcon.tsx'), 'utf-8')
```

---

### WR-04: `focusedCommentId` not cleared when a focused annotation is deleted

**File:** `ui/src/reviewer-v2/ReviewerV2Shell.tsx:124`

Same root cause as CR-03. `onRemove={removeAnnotation}` does not clear `focusedCommentId`.
If `focusedCommentId === id` when a delete fires, the id is stale in state. In the current code
this is benign because `CommentPane` gates rendering on `layout.find`, which will return
`undefined` for a deleted annotation. But it is a state invariant violation: after a delete,
`focusedCommentId` can name a non-existent annotation indefinitely. Combined with CR-03's fix,
the corrected `onRemove` handler should clear both:

```tsx
onRemove={(id) => {
  if (editingId === id) setEditingId(null)
  if (focusedCommentId === id) setFocusedCommentId(null)
  removeAnnotation(id)
}}
```

(This is the same fix as CR-03; adding here as a separate warning because the `focusedCommentId`
cleanup is also a required cleanup independent of the editing-state issue.)

---

### WR-05: `AnnotationForm` and `SelectionToolbar` have no viewport bottom-edge clamp

**File:** `ui/src/reviewer-v2/ContentPane.tsx:140-141` and `ui/src/reviewer-v2/SelectionToolbar.tsx:62`

Both popups use `position: fixed` and compute `top = lastRect.bottom + 6`. A left-edge clamp
exists (`Math.min(..., window.innerWidth - 280)`), but there is no bottom-edge clamp. When the
user selects text in the lower portion of the viewport, the form or toolbar renders below the
viewport fold and the "Post Comment" / "Comment" buttons are not visible or clickable.

**Fix:**

```ts
// ContentPane.tsx handleAction (~line 140)
const FORM_HEIGHT_ESTIMATE = 140  // textarea 64 + buttons 36 + padding ~40
const formTop = Math.min(
  (lastRect?.bottom ?? 0) + 6,
  window.innerHeight - FORM_HEIGHT_ESTIMATE - 8,
)
```

Apply the analogous clamp in `SelectionToolbar.tsx` for the toolbar height.

---

### WR-06: `useSectionAnnotationCounts` captures `planRef.current` outside `useMemo` — stale container if plan HTML is replaced

**File:** `ui/src/reviewer-v2/hooks/useSectionAnnotationCounts.ts:59-63`

```ts
const container = planRef.current      // captured at render time
return useMemo(() => {
  if (!container ...) return new Map()
  return computeSectionAnnotationCounts(container, ...)
}, [sections, annotations, container])
```

`planRef` is a stable `RefObject`. Its identity never changes, so including it in the dependency
array has no effect. `container` is read at render time and correctly transitions from `null`
(pre-mount) to the DOM node (post-mount). However, if `planHtml` changes (new plan loaded), React
unmounts and remounts the `MarkdownView` subtree, replacing `planRef.current` with a new DOM
node. The old `container` reference in the enclosing render's closure still points to the
detached node. `getElementCharOffset` walks the detached subtree, returning offsets based on the
old DOM, which may differ from the new DOM if the plan text changed. `useMemo` only re-runs when
`sections` or `annotations` change; if neither changes simultaneously, the stale-container path
persists until the next annotation action.

**Fix:** Move the `planRef.current` read inside the `useMemo` callback:

```ts
return useMemo(() => {
  const container = planRef.current
  if (!container || sections.length === 0) return new Map()
  return computeSectionAnnotationCounts(container, sections, annotations)
  // planRef intentionally excluded from deps: RefObject identity is stable;
  // recomputes are driven by sections/annotations changes.
}, [sections, annotations, planRef])
```

---

## Info

### IN-01: `EXPANDED_HEIGHT_ESTIMATE = 160` magic constant declared inline in render body with a deferred TODO

**File:** `ui/src/reviewer-v2/CommentPane.tsx:93`

```tsx
const EXPANDED_HEIGHT_ESTIMATE = 160 // temporary until Phase 21 layout measurement
```

Phase 21 is the current phase. The sibling constant `COMPACT_HEIGHT` is a named export from
`useCommentLayout.ts`. Having `EXPANDED_HEIGHT_ESTIMATE` inline in the render body means it
cannot be shared with `computeCommentLayout`. An incorrect height estimate causes layout gaps or
overlaps in the comment pane.

**Fix:** Export `EXPANDED_HEIGHT_ESTIMATE` from `useCommentLayout.ts` alongside `COMPACT_HEIGHT`,
import it in `CommentPane.tsx`, and remove the "temporary" comment or replace it with a concrete
follow-up reference.

---

### IN-02: Phase 21 test suite relies entirely on source-text string assertions — no behavioral coverage for the new edit/delete flow

**File:** `ui/src/reviewer-v2/CommentBubble.test.ts`, `CommentPane.test.ts`, `ReviewerV2Shell.test.ts`

The Phase 21 tests (describe blocks labeled "Phase 21") check that specific strings exist in the
source file. They do not render components or assert on callback invocations. Per `CLAUDE.md`
test coverage requirements, `onEdit` dispatch, the sticky-vs-absolute positioning conditional,
and `editAnnotation`/`removeAnnotation` wiring are all business logic that require behavioral
assertions. CR-02 (missing `onMouseDown` on "Save Changes") is not caught by any existing test —
the source still contains all the required strings even with the bug present.

**Fix:** Add at minimum:
1. A `@testing-library/react` render test for `CommentBubble` that clicks "Save Changes" and
   asserts `onEdit` is called with the textarea value.
2. A render test that confirms `onFocus` is NOT called when "Save Changes" is clicked (verifying
   the `stopPropagation` + `preventDefault` guards work together).

---

### IN-03: `useTextSelection` `useLayoutEffect` runs after every render with no dependency array

**File:** `ui/src/reviewer-v2/hooks/useTextSelection.ts:235-248`

The `useLayoutEffect` has no dependency array and therefore runs after every render of any
component using the hook. Each invocation calls `rangeFromOffsets`, which performs a full
text-node walk of the plan DOM. The `storedOffsets.current` null-check on line 237 short-circuits
when no selection is active, making this effectively free in the common case. Flagged for
awareness: if a large plan is rendered and many components trigger re-renders (hover states,
annotation list updates), the walk fires on every one of them when a selection is active.

The design is intentional (documented comment at line 229: "re-create Range from stored offsets");
the absence of a dependency array is correct because the effect must run on every render to keep
the CSS highlight in sync. No immediate fix required, but worth noting for profiling if jank
occurs on large plans.

---

_Reviewed: 2026-05-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
