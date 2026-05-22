---
phase: 21-comment-actions
reviewed: 2026-05-22T00:00:00Z
depth: standard
files_reviewed: 19
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
findings:
  critical: 3
  warning: 7
  info: 3
  total: 13
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-05-22T00:00:00Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Phase 21 adds comment edit/remove actions, wires `editingId` through `CommentPane` and `ReviewerV2Shell`, introduces sticky/absolute bubble positioning for the editing bubble, and adds the `annotationCounts` badge to `OutlinePane`. The architecture is coherent and the prop-wiring chain is correct end-to-end.

Three critical issues were found: a raw server-supplied HTML injection via `dangerouslySetInnerHTML` with no sanitization layer, a stale-closure bug in `CommentPane`'s `ResizeObserver` effect that causes silently incorrect bubble positions after annotations are added or removed, and a missing `onMouseDown stopPropagation` on the "Save Changes" button that can trigger the article `onClick` unexpectedly. Seven warnings cover logic gaps in state cleanup, missing keyboard accessibility on icon buttons, edge-case null-deref risks, and test fragility.

---

## Critical Issues

### CR-01: `dangerouslySetInnerHTML` injects server-supplied plan Markdown as raw HTML with no sanitization

**File:** `ui/src/reviewer-v2/PlanContent.tsx:15`

**Issue:** `MarkdownView` renders `planHtml` via `dangerouslySetInnerHTML={{ __html: planHtml }}`. The HTML originates from `renderMarkdown(data.plan_md)` where `data.plan_md` comes from the `/api/plan` fetch. Although the server uses `comrak`, the client applies zero sanitization before injecting. If the Rust binary ever forwards a plan file whose Markdown contains raw HTML blocks (which comrak passes through by default when `unsafe` rendering is on) or if a future config change enables comrak's `unsafe` mode, arbitrary `<script>`, `<iframe>`, or event-handler attributes reach the DOM.

This is a local-only tool, so the threat is lower than a public app, but the plan content is supplied externally (the user's file system or a Claude Code hook payload), and a malicious plan file could exfiltrate the session or hijack the approval decision.

**Fix:** Add a client-side sanitization step in `renderMarkdown` using DOMPurify (already available in most browser environments) before returning the HTML string:

```typescript
// ui/src/reviewer-v2/utils/markdownRenderer.ts (add at the bottom of renderMarkdown)
import DOMPurify from 'dompurify'

export function renderMarkdown(md: string): string {
  const rawHtml = /* existing comrak output from /api/plan */ md  // placeholder
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','ul','ol','li',
                   'code','pre','blockquote','table','thead','tbody',
                   'tr','th','td','strong','em','a','hr','br',
                   'input','details','summary','del','s'],
    ALLOWED_ATTR: ['href','id','class','type','checked','disabled'],
  })
}
```

Alternatively, verify and enforce that the Rust server always renders with comrak's `unsafe = false` and add a review-time integration test that confirms script tags do not appear in the rendered output.

---

### CR-02: Stale closure in `CommentPane` `ResizeObserver` effect — bubble positions freeze after annotation list changes

**File:** `ui/src/reviewer-v2/CommentPane.tsx:34-64`

**Issue:** The `useEffect` closes over `annotations` at the time the effect runs. The `recompute` function defined inside the effect references this closed-over `annotations` value. The effect dependency array is `[mainRef, planRef, annotations]`, which is correct for re-running the effect — but the `ResizeObserver` callback (`ro.observe(content)`) keeps calling `recompute` indefinitely until `disconnect()`. If a resize fires after the effect re-ran (because `annotations` changed), the old `ResizeObserver` has already been disconnected and a new one was set up for the new `annotations`. That part is safe.

The actual bug is subtler: within a single effect invocation, `recompute` is called synchronously at setup (`recompute()` on line 59), and also by the `ResizeObserver`. Both calls use the correct `annotations` from that render. However, `anchorYMap` is set via `setAnchorYMap(map)` (line 54), which is asynchronous — the new Map is not available until the next render. Between a `setAnchorYMap` call and the next render, a rapid second resize fires and calls `recompute` again with the same `annotations`. This is harmless for correctness but means each resize fires two renders unnecessarily.

The genuine correctness bug: the `layoutItems` filter on line 96 does `.filter((ann) => anchorYMap.has(ann.id))`. When `annotations` grows (a new annotation is added), the new annotation is not yet in `anchorYMap` (the effect re-runs asynchronously after the render that added it). Until the effect runs and `setAnchorYMap` resolves, the new annotation is silently dropped from layout — it renders `null` (line 113) and is invisible. This is a one-frame gap normally, but on slow machines or after a large resize it can persist.

More importantly: if a user immediately edits the bubble that was just added (before the ResizeObserver fires), `CommentPane` renders `null` for it at line 113, so the bubble disappears even though `editingId === ann.id` would otherwise make it sticky-positioned.

**Fix:** Compute `anchorY` eagerly at annotation-add time (e.g. in `ReviewerV2Shell.onEdit`) and store it alongside the annotation, OR change the filter to allow rendering with a fallback `anchorY = 0` while the map is being populated:

```typescript
// Replace the filter+map block:
const layoutItems = annotations.map((ann) => {
  const isExpanded = focusedCommentId === ann.id
  return {
    id: ann.id,
    anchorY: anchorYMap.get(ann.id) ?? 0,   // fallback: top of pane
    isExpanded,
    height: isExpanded ? EXPANDED_HEIGHT_ESTIMATE : COMPACT_HEIGHT,
  }
})
```

And on line 112–113 remove the early `null` return, replacing it with a no-op if the layout item is a fallback (anchorY = 0 is valid for newly added items).

---

### CR-03: Missing `onMouseDown` on "Save Changes" button lets article `onClick` fire before the save commits

**File:** `ui/src/reviewer-v2/CommentBubble.tsx:257-273`

**Issue:** The "Discard Changes" button (line 241) correctly has `onMouseDown={(e) => e.preventDefault()}` to prevent the article's `onClick` from firing when the button is clicked. The "Save Changes" button (line 257) does **not** have `onMouseDown` at all:

```tsx
<button
  type="button"
  onClick={(e) => { e.stopPropagation(); onEdit(textareaRef.current?.value ?? '') }}
  // ← no onMouseDown handler
```

In React, `mousedown` fires before `click`. Because `article` has `onClick={onClick}` and no `onMouseDown` guard, a `mousedown` on the "Save Changes" button will propagate to the `article`, firing `onClick` (which calls `onFocus` to toggle the focused state) before the button's own `onClick` fires. This means:
1. The annotation can be unfocused (`focusedCommentId` set to null) mid-click.
2. When `onClick` on the button fires and calls `onEdit(...)`, the parent's state may have already toggled.

The `e.stopPropagation()` on the button's `onClick` only prevents the `click` event from reaching the article — `mousedown` has already propagated.

**Fix:** Add `onMouseDown={(e) => e.preventDefault()}` to the "Save Changes" button, matching the pattern already used on "Discard Changes" and on both buttons in `AnnotationForm`:

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

## Warnings

### WR-01: `editingId` is not cleared when the annotation being edited is removed

**File:** `ui/src/reviewer-v2/ReviewerV2Shell.tsx:116-123`

**Issue:** `onRemove={removeAnnotation}` directly dispatches the `remove` action without first checking if `editingId === id`. If a user somehow triggers remove while the same annotation is in edit mode (possible if the edit buttons remain in the DOM during a keyboard shortcut path or a future refactor), `editingId` stays set to the deleted annotation's id, and `CommentPane` will render a sticky wrapper for an annotation that no longer exists in the `annotations` array — producing a permanently pinned empty space at the top of the comment pane.

**Fix:**

```tsx
onRemove={(id) => {
  if (editingId === id) setEditingId(null)
  removeAnnotation(id)
}}
```

---

### WR-02: `focusedCommentId` is not cleared when the focused annotation is removed

**File:** `ui/src/reviewer-v2/ReviewerV2Shell.tsx:116-123`

**Issue:** Same category as WR-01. `removeAnnotation(id)` does not clear `focusedCommentId` when the removed annotation is the focused one. The deleted annotation's CommentBubble will receive `isFocused={true}` on the render that removes it (React batches state updates in event handlers in React 18+, so the CommentPane re-renders after both state changes are applied — but only if `setFocusedCommentId` is called). Without the clear, `focusedCommentId` points to a ghost id, and any future annotation that happens to receive the same UUID (extremely unlikely with `crypto.randomUUID` but architecturally incorrect) would start focused.

**Fix:** Clear `focusedCommentId` alongside `editingId` in `onRemove`.

---

### WR-03: `AnnotationForm` positioned with `position: fixed` but coordinates computed from `getBoundingClientRect` without viewport-overflow guard on the top edge

**File:** `ui/src/reviewer-v2/ContentPane.tsx:108-109`

**Issue:** `formTop` is computed as `(lastRect?.bottom ?? 0) + 6`. When the selected text is near the bottom of the viewport and `formTop + formHeight` exceeds `window.innerHeight`, the form is clipped. There is already a guard for the left edge (`Math.min(..., window.innerWidth - 280)`). There is no guard for the bottom edge — the form can be partially or fully off-screen when the user selects text in the lower ~150px of the viewport. `formTop` can also be negative if `lastRect.bottom` is 0 (the fallback `?? 0` maps to `top: 6`, which is fine, but `lastRect` being zero means the range was not visible).

**Fix:**

```typescript
const FORM_HEIGHT_ESTIMATE = 130  // textarea minHeight 64 + buttons 36 + padding
const formTop = Math.min(
  (lastRect?.bottom ?? 0) + 6,
  window.innerHeight - FORM_HEIGHT_ESTIMATE - 8,
)
```

---

### WR-04: Icon buttons in `CommentBubble` are not keyboard-reachable when `isFocused` but focus management is imperative and fragile

**File:** `ui/src/reviewer-v2/CommentBubble.tsx:180-234`

**Issue:** The edit (pencil) and delete (×) icon buttons only appear when `isFocused && !isEditing`. The buttons have `onFocus` / `onBlur` handlers that imperatively set inline `style.outline`. This is fine for visual feedback, but there is no `tabIndex` management: when the bubble transitions from unfocused to focused (by clicking it), keyboard focus stays on whatever element was previously focused. A keyboard user pressing Tab will not predictably land on the Edit or Delete buttons unless they happen to tab into the article. The `article` element is not inherently focusable either (no `tabIndex` attribute), so clicking it with a mouse does not move keyboard focus into it.

**Fix:** Add `tabIndex={0}` to the `<article>` element and add `onKeyDown` handling for Enter/Space to toggle the focused state, consistent with the click handler:

```tsx
<article
  tabIndex={0}
  aria-label={ariaLabel}
  aria-expanded={isFocused ? 'true' : 'false'}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
  ...
>
```

---

### WR-05: `useSectionAnnotationCounts` `useMemo` dependency on `planRef` is a no-op and masks a stale-ref bug

**File:** `ui/src/reviewer-v2/hooks/useSectionAnnotationCounts.ts:57-62`

**Issue:** `planRef` (a `RefObject`) is included in the `useMemo` dependency array. `RefObject` is a stable object whose identity never changes — `planRef === planRef` across every render. This means the memoization never re-runs solely because `planRef.current` changed (e.g. after the plan DOM mounts). If `sections` and `annotations` haven't changed but `planRef.current` just became non-null (first mount), `useMemo` will return an empty `Map` (the early-return path on line 59: `if (!container …) return new Map()`) and never recalculate, because `planRef` identity is stable.

In practice this is usually harmless because `sections` changes (from `[]` to the real sections) after the plan loads, which re-runs the memo. But it is a latent bug: if `sections` were provided as a prop at mount time and `planRef.current` were null at that point, the counts would be permanently empty.

**Fix:** Remove `planRef` from the dependency array and replace it with a `container` variable resolved outside `useMemo`, or use a state variable that tracks when the ref is populated:

```typescript
// Option: remove planRef from deps (the ref object identity is stable anyway)
return useMemo(() => {
  const container = planRef.current
  if (!container || sections.length === 0) return new Map()
  return computeSectionAnnotationCounts(container, sections, annotations)
}, [sections, annotations])  // planRef intentionally omitted — stable ref object
```

Add a comment explaining why `planRef` is excluded from the dep array to satisfy the exhaustive-deps lint rule.

---

### WR-06: `OutlinePane` annotation count badge uses non-null assertion `annotationCounts!.get(section.id)` after optional-chaining guard

**File:** `ui/src/reviewer-v2/OutlinePane.tsx:96` and `114`

**Issue:** Line 94 guards with `(annotationCounts?.get(section.id) ?? 0) > 0` — so the badge only renders when `annotationCounts` is defined AND the count is positive. Inside the badge, lines 96 and 114 use `annotationCounts!.get(section.id)` (non-null assertion). This is technically safe given the outer guard, but the non-null assertion is fragile: if the condition at line 94 is ever refactored to use a local variable, the inner assertions become dangerously wrong with no TypeScript compile error. The `aria-label` on line 96 in particular will produce `"undefined comments"` if the assertion fires falsely.

**Fix:** Use optional chaining or extract to a local variable:

```tsx
{(() => {
  const count = annotationCounts?.get(section.id) ?? 0
  if (count === 0) return null
  return (
    <span aria-label={`${count} comments`} style={{ ... }}>
      {count}
    </span>
  )
})()}
```

---

### WR-07: `CommentPane` renders `null` for annotations not yet in `anchorYMap` but those annotations still consume a DOM slot in the parent array (incomplete rendering)

**File:** `ui/src/reviewer-v2/CommentPane.tsx:111-135`

**Issue:** Related to CR-02 but distinct in impact: on the first render after an annotation is added, `anchorYMap` does not contain the new annotation's id (the `useEffect` re-runs asynchronously). The `annotations.map` at line 111 calls `layout.find((l) => l.id === ann.id)` which returns `undefined` for the new annotation (since it was filtered out of `layoutItems` on line 96). Line 113 then returns `null`.

The wrapping `div` with `style={{ position: 'relative', minHeight: '100%' }}` has no height contribution from these `null` children. This is functionally correct — the bubble appears on the next render — but combined with the sticky-position feature added in Phase 21, if the new annotation has `editingId === ann.id` set in the same render (theoretically possible if `setEditingId` is called synchronously after `addAnnotation` in a future feature), the sticky wrapper never renders.

**Fix:** See CR-02 fix (use fallback `anchorY = 0`).

---

## Info

### IN-01: `EXPANDED_HEIGHT_ESTIMATE = 160` magic constant should be a named export near `COMPACT_HEIGHT`

**File:** `ui/src/reviewer-v2/CommentPane.tsx:93`

**Issue:** `const EXPANDED_HEIGHT_ESTIMATE = 160` is declared inside the render function body with a comment acknowledging it is temporary. `COMPACT_HEIGHT` is a named export from `useCommentLayout`. The expanded height estimate is a layout parameter that should live alongside its compact counterpart, not inline in the component.

**Fix:** Export `EXPANDED_HEIGHT_ESTIMATE` from `useCommentLayout.ts` alongside `COMPACT_HEIGHT`, and import it in `CommentPane.tsx`. Remove the inline comment about "temporary until Phase 21" as Phase 21 is now the current phase.

---

### IN-02: Test suite relies exclusively on source-text string matching rather than behavioral assertions

**File:** `ui/src/reviewer-v2/CommentBubble.test.ts`, `ui/src/reviewer-v2/CommentPane.test.ts`, `ui/src/reviewer-v2/ReviewerV2Shell.test.ts`, `ui/src/reviewer-v2/AnnotationForm.test.ts`

**Issue:** The entire Phase 21 test suite uses `readFileSync` source inspection (`expect(source).toContain(...)`) rather than rendering components and asserting on DOM state or callback invocations. This approach:

1. Does not test that `onEdit(ann.id, newComment)` is actually called with the correct arguments when the Save Changes button is clicked.
2. Does not test that `editingId === ann.id` renders the sticky wrapper (vs. absolute wrapper).
3. Does not test that removing an annotation while it is being edited clears `editingId`.
4. Passes even if the code compiles but throws a runtime error.

The project's `CLAUDE.md` test coverage requirements state: business logic functions with non-trivial return values, data transformations, and route handlers require at least one behavioral test. The `onEdit` callback dispatch and sticky-vs-absolute rendering logic are business logic.

**Fix:** Add at least one `@testing-library/react` render test for `CommentPane` that mounts with a non-null `editingId` and asserts the correct wrapper `position` style is applied. Add one test for `ReviewerV2Shell` that fires `onRemove` and asserts `editingId` is cleared.

---

### IN-03: `useTextSelection` `useLayoutEffect` runs after every render with no dependency array

**File:** `ui/src/reviewer-v2/hooks/useTextSelection.ts:235-247`

**Issue:** The `useLayoutEffect` on line 235 has no dependency array (neither `[]` nor `[deps]`). It runs after every single render. For a tool that has multiple panes, annotations, and hover state, there are many renders per second during interaction. Each run calls `rangeFromOffsets`, which traverses the entire plan DOM text tree (O(N) in text node count). For a large plan, this is a non-trivial traversal on every render.

This is a known intentional design choice (the comment on line 229 explains the need to re-create the Range after React reconciliation), but there is no guard beyond `isDraggingRef` and a `storedOffsets` null check. Adding a stable dependency — specifically `selectedText` state — would reduce the number of no-op runs:

**Fix:**

```typescript
useLayoutEffect(() => {
  if (isDraggingRef.current) return
  if (!storedOffsets.current || !containerRef.current) return
  const range = rangeFromOffsets(
    containerRef.current,
    storedOffsets.current.start,
    storedOffsets.current.end,
  )
  if (range) {
    currentRange.current = range
    applyHighlight(range)
  }
  // No dep array intentionally omitted here — this IS by design (see comment above).
  // At minimum guard on selectedText to skip when no selection is active.
})
```

Note: this is Info rather than Warning because the current code is intentional and functionally correct; the risk is performance degradation on very large plans, which is out of v1 scope per the review instructions.

---

_Reviewed: 2026-05-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
