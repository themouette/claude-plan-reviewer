---
phase: 21-comment-actions
reviewed: 2026-05-22T10:00:00Z
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
  critical: 2
  warning: 7
  info: 3
  total: 12
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-05-22T10:00:00Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Phase 21 adds comment edit/remove actions, wires `editingId` through `CommentPane` and `ReviewerV2Shell`, introduces sticky/absolute bubble positioning for the editing bubble, and adds `annotationCounts` badges to `OutlinePane`. The end-to-end prop-wiring chain is correct, and the CSS Custom Highlight API usage is consistent. `markdownRenderer.ts` already applies DOMPurify sanitization (so the XSS concern from a prior pass is resolved).

Two critical issues remain: the "Save Changes" button in `CommentBubble` is missing the `onMouseDown preventDefault` guard that all other action buttons carry, allowing the article's `onClick` to fire before the save commits; and annotations newly added to the list are silently invisible until the `ResizeObserver` fires its first callback, because `CommentPane` filters them out of layout until `anchorYMap` is populated. Seven warnings cover state cleanup gaps when annotations are deleted, fragile form positioning, accessibility gaps on the article element, a redundant ref in a `useMemo` dependency array, and non-null assertion patterns. Three info items cover a magic constant, test coverage depth, and an unbounded `useLayoutEffect`.

---

## Critical Issues

### CR-01: "Save Changes" button missing `onMouseDown preventDefault` — article `onClick` fires before save commits

**File:** `ui/src/reviewer-v2/CommentBubble.tsx:257-273`

**Issue:** Every other action button in this component (Discard Changes, Edit pencil, Delete ×) carries `onMouseDown={(e) => e.preventDefault()}` to prevent the `mousedown` event from propagating to the `<article>` and triggering `onClick` (which calls `onFocus` to toggle the focused state) before the button's own `click` fires. The "Save Changes" button has no `onMouseDown` handler at all:

```tsx
// line 257 — missing onMouseDown
<button
  type="button"
  onClick={(e) => { e.stopPropagation(); onEdit(textareaRef.current?.value ?? '') }}
```

In browsers, `mousedown` fires before `click`. Because `<article>` has `onClick={onClick}` and no `onMouseDown stopPropagation`, a mousedown on "Save Changes" propagates to `<article>`, calling `onClick()` which toggles `focusedCommentId` (potentially setting it to null) before the button's own `click` handler fires and calls `onEdit(...)`. Result: the save fires on a now-unfocused annotation, and the edit mode may close erroneously.

**Fix:** Add `onMouseDown={(e) => e.preventDefault()}` to the "Save Changes" button, matching the established pattern:

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

### CR-02: Newly added annotations are silently invisible until `ResizeObserver` fires — can prevent sticky edit wrapper from rendering

**File:** `ui/src/reviewer-v2/CommentPane.tsx:96-113`

**Issue:** The `layoutItems` array is built from annotations that have an entry in `anchorYMap`:

```tsx
// line 96-105
const layoutItems = annotations
  .filter((ann) => anchorYMap.has(ann.id))
  ...
```

`anchorYMap` is populated by a `useEffect` that runs asynchronously after each render. When a new annotation is added, the render that displays it fires before the effect has run, so the new annotation's id is absent from `anchorYMap`. The annotation is filtered out of `layoutItems`, and `layout.find((l) => l.id === ann.id)` on line 112 returns `undefined`, causing line 113 to return `null` for that annotation's slot. The bubble is invisible for one render cycle (normally brief), but:

1. If `setEditingId` were called in the same event batch that calls `addAnnotation` (e.g. a future "add and immediately open edit" feature), the sticky-position wrapper would never render because `layoutItem` is null on the first render.
2. If a `ResizeObserver` callback is slow (large plan, slow machine), the visibility gap extends.

The pattern `anchorYMap.has(ann.id)` as a gate is overly strict. A fallback `anchorY = 0` is safe and keeps the bubble in the DOM from the first render.

**Fix:**

```tsx
// Replace lines 96-105 in CommentPane.tsx
const layoutItems = annotations.map((ann) => {
  const isExpanded = focusedCommentId === ann.id
  return {
    id: ann.id,
    anchorY: anchorYMap.get(ann.id) ?? 0,  // 0 is a safe fallback for new annotations
    isExpanded,
    height: isExpanded ? EXPANDED_HEIGHT_ESTIMATE : COMPACT_HEIGHT,
  }
})
```

Remove the null guard on line 113 — `layout.find` will always find the item since all annotations are now in `layoutItems`.

---

## Warnings

### WR-01: `editingId` is not cleared when the annotation being edited is deleted

**File:** `ui/src/reviewer-v2/ReviewerV2Shell.tsx:124`

**Issue:** `onRemove={removeAnnotation}` passes the raw dispatch directly. If the annotation currently in `editingId` is deleted (the Delete button is visible when `isFocused && !isEditing`, so this requires first clicking out of edit mode and then clicking Delete, or a keyboard shortcut path), `editingId` retains the deleted annotation's id. On the next render, `CommentPane` renders a sticky wrapper (`position: 'sticky', top: 16`) for the deleted annotation (which has no `layoutItem`, so it renders `null` at line 113). The sticky wrapper itself does not render in the current code because it's also gated on `layout.find`. But if CR-02's fix is applied (removing that null gate), the sticky wrapper will render indefinitely for the ghost id — an empty sticky element pinned to the top of the comment pane.

**Fix:**

```tsx
onRemove={(id) => {
  if (editingId === id) setEditingId(null)
  removeAnnotation(id)
}}
```

---

### WR-02: `focusedCommentId` is not cleared when the focused annotation is deleted

**File:** `ui/src/reviewer-v2/ReviewerV2Shell.tsx:124`

**Issue:** Same category as WR-01. When an annotation is removed, `focusedCommentId` may still reference its id. In the current layout, this is benign because the annotation is absent from `layout`, so no bubble renders with `isFocused={true}`. However, `ContentPane`'s hover-highlight effect (`useEffect` at line 68) closes over `annotations` and will attempt to call `rangeFromOffsets` using the deleted annotation's offsets if a concurrent `hoveredCommentId` matches. `hoveredCommentId` is cleared on mouse-leave, but `focusedCommentId` is not. Architecturally, stale IDs in state are a defect.

**Fix:**

```tsx
onRemove={(id) => {
  if (editingId === id) setEditingId(null)
  if (focusedCommentId === id) setFocusedCommentId(null)
  removeAnnotation(id)
}}
```

---

### WR-03: `AnnotationForm` and `SelectionToolbar` have no viewport bottom-edge clamp

**File:** `ui/src/reviewer-v2/ContentPane.tsx:140-141`

**Issue:** `formTop` is computed as `(lastRect?.bottom ?? 0) + 6`. When the selected text is near the bottom of the viewport, `formTop + formHeight` can exceed `window.innerHeight`, clipping the form off-screen. The left-edge clamp exists (`Math.min(..., window.innerWidth - 280)`), but there is no bottom-edge clamp. The same issue exists in `SelectionToolbar.tsx:62` (`top = lastRect.bottom + 6` with no bottom guard). For a `position: fixed` popup this means the bottom half — including the "Post Comment" button — can be invisible if the user selects text in the lower portion of the viewport.

**Fix:**

```typescript
// ContentPane.tsx handleAction
const FORM_HEIGHT_ESTIMATE = 140  // 64 textarea + 36 buttons + 40 padding
const formTop = Math.min(
  (lastRect?.bottom ?? 0) + 6,
  window.innerHeight - FORM_HEIGHT_ESTIMATE - 8,
)
```

Apply the same pattern in `SelectionToolbar.tsx`.

---

### WR-04: `<article>` in `CommentBubble` is not keyboard-focusable — icon buttons unreachable by keyboard

**File:** `ui/src/reviewer-v2/CommentBubble.tsx:95-101`

**Issue:** The `<article>` element is not in the tab order (no `tabIndex`, and `<article>` is not inherently focusable). Clicking it with a mouse sets `focusedCommentId` via `onClick`, revealing the Edit and Delete icon buttons. A keyboard user cannot reach those buttons because they cannot click the article to expand it, and tabbing through the page will skip the article entirely. The icon buttons are conditionally rendered only when `isFocused`, so they are also absent from the tab order when unfocused.

**Fix:** Add `tabIndex={0}` to the `<article>` element and wire an `onKeyDown` handler for Enter/Space to call `onClick()`:

```tsx
<article
  tabIndex={0}
  role="button"
  aria-label={ariaLabel}
  aria-expanded={isFocused ? 'true' : 'false'}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() }
  }}
  ...
>
```

---

### WR-05: `useSectionAnnotationCounts` includes `planRef` in `useMemo` dependency array — stable ref never triggers recalculation

**File:** `ui/src/reviewer-v2/hooks/useSectionAnnotationCounts.ts:61`

**Issue:** `planRef` is a `RefObject` — a stable object whose identity is constant across all renders. Including it in the `useMemo` dependency array (`[sections, annotations, planRef]`) has no effect: the memo will never re-run solely because `planRef.current` changed (e.g., went from `null` to the mounted DOM node). The early-return guard `if (!container …) return new Map()` can permanently return an empty map if `sections` and `annotations` happen to be populated at mount time before `planRef.current` is set. In practice, `sections` starts as `[]` (populated asynchronously after the plan loads), so this race does not occur today — but the dependency array is misleading and the comment in the code does not explain the exclusion.

**Fix:** Remove `planRef` from the dependency array and add a comment:

```typescript
return useMemo(() => {
  const container = planRef.current
  if (!container || sections.length === 0) return new Map()
  return computeSectionAnnotationCounts(container, sections, annotations)
  // planRef is intentionally excluded: RefObject identity is stable; re-runs
  // are triggered by sections/annotations changes, which always follow plan mount.
}, [sections, annotations])
```

---

### WR-06: `OutlinePane` uses non-null assertion `annotationCounts!.get(section.id)` inside a conditional that already guards for nullability

**File:** `ui/src/reviewer-v2/OutlinePane.tsx:96` and `114`

**Issue:** Line 94 guards with `(annotationCounts?.get(section.id) ?? 0) > 0`. Inside that branch, lines 96 and 114 use `annotationCounts!.get(section.id)` (non-null assertion). If `annotationCounts` is defined and the count is positive, this is correct. However, the non-null assertion bypasses TypeScript's type safety for refactoring scenarios: if the outer guard is changed, the inner assertion silently becomes unsafe. The `aria-label` on line 96 would produce `"undefined comments"` if the assertion ever fires falsely.

**Fix:** Extract count to a local variable:

```tsx
{(() => {
  const count = annotationCounts?.get(section.id) ?? 0
  if (count === 0) return null
  return (
    <span
      aria-label={`${count} comments`}
      style={{ ... }}
    >
      {count}
    </span>
  )
})()}
```

---

### WR-07: `GutterIcon.test.ts` uses a CWD-relative path for `readFileSync` — breaks when tests run from outside `ui/`

**File:** `ui/src/reviewer-v2/GutterIcon.test.ts:6`

**Issue:** All other test files use `resolve(__dirname, './Component.tsx')` for source inspection, which is robust regardless of working directory. `GutterIcon.test.ts` uses:

```typescript
const source = readFileSync('src/reviewer-v2/GutterIcon.tsx', 'utf8')
```

This is a CWD-relative path. It works when vitest is invoked from `ui/`, but will throw `ENOENT` if tests are run from the project root or from any other directory (e.g., a CI job that uses `npm test --prefix ui` from the root). The `/// <reference types="node" />` triple-slash directive is present, so the intent is correct — only the path construction is inconsistent.

**Fix:**

```typescript
import { resolve } from 'path'
const source = readFileSync(resolve(__dirname, './GutterIcon.tsx'), 'utf-8')
```

---

## Info

### IN-01: `EXPANDED_HEIGHT_ESTIMATE = 160` magic constant declared inline in render body

**File:** `ui/src/reviewer-v2/CommentPane.tsx:93`

**Issue:** `const EXPANDED_HEIGHT_ESTIMATE = 160` is declared inside the component function body with a comment noting it is "temporary until Phase 21 layout measurement." Phase 21 is the current phase. The sibling constant `COMPACT_HEIGHT` is a named export from `useCommentLayout.ts`. Having the expanded height estimate inline in the render body means it cannot be shared with `useCommentLayout.ts`, which already encodes the compact height for gap calculations.

**Fix:** Export `EXPANDED_HEIGHT_ESTIMATE` from `useCommentLayout.ts` alongside `COMPACT_HEIGHT`, import it in `CommentPane.tsx`, and remove the "temporary" comment.

---

### IN-02: Phase 21 test suite uses only source-text string assertions — no behavioral coverage for the new edit/delete flow

**File:** `ui/src/reviewer-v2/CommentBubble.test.ts`, `ui/src/reviewer-v2/CommentPane.test.ts`, `ui/src/reviewer-v2/ReviewerV2Shell.test.ts`

**Issue:** The entire Phase 21 test suite for the edit/delete feature inspects source text (`expect(source).toContain(...)`) rather than rendering components and asserting on DOM state or callback invocations. Per `CLAUDE.md` test coverage requirements, the `onEdit` callback dispatch path, the sticky vs. absolute positioning logic, and the `editAnnotation`/`removeAnnotation` dispatch wiring are all business logic that require at least one behavioral assertion.

The source-text tests verify the correct *code was written*, but they do not verify it *executes correctly*. Specifically: CR-01 (missing `onMouseDown` on "Save Changes") would not be caught by any existing test — the source still contains `onEdit`, `stopPropagation`, and `Save Changes` strings.

**Fix:** Add at minimum:
1. A `@testing-library/react` render test for `CommentBubble` that clicks "Save Changes" and asserts `onEdit` is called with the textarea's value.
2. A render test for `CommentPane` that passes `editingId` and asserts the wrapper uses `position: sticky`.

---

### IN-03: `useTextSelection` `useLayoutEffect` runs on every render (no dependency array)

**File:** `ui/src/reviewer-v2/hooks/useTextSelection.ts:235-247`

**Issue:** The `useLayoutEffect` at line 235 has no dependency array, so it runs after every render of any component that uses this hook. Each invocation calls `rangeFromOffsets`, which performs a full text-node walk of the plan DOM (O(N) in text node count). For a large plan, this walk fires on every hover state change, every annotation list update, and every click. The comment at line 229 explains the intentional design, but the `storedOffsets.current` null-check (`if (!storedOffsets.current ...`) on line 237 already provides a short-circuit when no selection is active. Adding `selectedText` as a dependency would avoid running the walk on renders that cannot have changed the stored offsets.

This is intentional design and functionally correct; flagged only because the walk cost grows linearly with plan size.

---

_Reviewed: 2026-05-22T10:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
