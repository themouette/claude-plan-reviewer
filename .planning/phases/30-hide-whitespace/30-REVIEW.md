---
phase: 30-hide-whitespace
reviewed: 2026-05-30T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - ui/src/code-review/AppToolbar.test.ts
  - ui/src/code-review/AppToolbar.tsx
  - ui/src/code-review/CodeReviewApp.tsx
  - ui/src/code-review/DiffPane.test.ts
  - ui/src/code-review/DiffPane.tsx
findings:
  critical: 1
  warning: 3
  info: 1
  total: 5
status: issues_found
---

# Phase 30: Code Review Report

**Reviewed:** 2026-05-30T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

This phase adds a "Hide Whitespace" toggle button to the toolbar and threads `hideWhitespace` through `AppToolbar` → `DiffPane` → `FileDiffRenderer` → `parseDiffFromFile({ ignoreWhitespace })`. The core feature implementation is correct: the prop is properly declared, wired, and consumed. The `useMemo` dependency array includes `hideWhitespace`, so the diff re-parses on toggle.

One critical bug exists: `onReviewSent` was introduced in a prior phase and is declared as a required prop in `AppToolbarProps`, but is never destructured from props and never called inside `AppToolbar`. The parent passes `() => {}` as a silent no-op, meaning post-submit hooks (e.g., clearing comment state, navigating away) never fire. Three warnings cover stale pending-comment state across diff changes, test methodology brittleness, and an `ann.side` vs `anchor.side` inconsistency.

## Critical Issues

### CR-01: `onReviewSent` prop declared required but never called — post-submit side-effects silently dropped

**File:** `ui/src/code-review/AppToolbar.tsx:22`

**Issue:** `onReviewSent: () => void` is listed in `AppToolbarProps` as a **required** prop (no `?`). It is not destructured from the function arguments (lines 28–43) and is never invoked in the component body. In `CodeReviewApp.tsx:261`, the parent passes `() => {}` — a deliberate no-op stub — meaning any caller-side cleanup intended by this callback (clearing comments, setting a "sent" page-level state, etc.) is permanently silently skipped. If future code in `CodeReviewApp` ever wires a real implementation, it still will not be called because the consumer does not call it.

**Fix:** Either remove the prop entirely if it is truly not needed, or destructure and call it at the appropriate transition point:

```tsx
// AppToolbar.tsx — add to destructuring
export default function AppToolbar({
  ...
  onReviewSent,   // ← add
}: AppToolbarProps): React.JSX.Element {

  // inside handleSend, after successful submission:
  async function handleSend(message?: string) {
    ...
    if (res.ok || res.status === 409) {
      setSubmitState('confirmed')
      onReviewSent()   // ← call the prop
      return
    }
  }
```

If the callback is genuinely not needed yet, remove it from the interface and the `CodeReviewApp` call site to avoid misleading future maintainers.

## Warnings

### WR-01: Stale `pendingLineAnchor` and `pendingFileComment` survive diff-selector changes

**File:** `ui/src/code-review/DiffPane.tsx:270-271`

**Issue:** `pendingLineAnchor` and `pendingFileComment` are `useState` values local to `DiffPane`. They are never reset when the `files` prop changes (e.g., after the user switches commits or the selector changes). If a user opens a line-comment form on file A in commit X, then navigates to commit Y, the pending anchor survives. Because `pendingLineAnchor.file` may match a filename that also exists in the new diff (same path, different content), the anchor silently attaches an annotation at a line number that belongs to the old diff. The submitted comment will have an incorrect `lineNumber` relative to the new diff's content.

`DiffPane.tsx` has no `useEffect` at all; resetting on `files` changes is completely absent.

**Fix:** Add a `useEffect` that clears both pending states whenever the files list identity changes:

```tsx
// DiffPane.tsx — inside DiffPane function body
useEffect(() => {
  setPendingLineAnchor(null)
  setPendingFileComment(null)
}, [files])
```

Because `files` is a new array reference on every refetch, this fires exactly when the diff content changes.

### WR-02: `ann.side` used instead of `anchor.side` when calling `onAddLineComment`

**File:** `ui/src/code-review/DiffPane.tsx:132`

**Issue:** Inside `renderAnnotation`, when the pending form is submitted, the `side` argument passed to `onAddLineComment` is `ann.side` — where `ann` is the `DiffLineAnnotation` object from the pierre library's render callback. The annotation's `side` was populated from `pendingLineAnchor.side` at annotation-build time (line 70), so the values are equal under normal conditions. However `ann` is a library-controlled render parameter: the library may reclassify the side for rendering purposes (e.g., in split view, it maps annotations to the appropriate column). If the library ever normalises or remaps `ann.side` differently from the original `AnnotationSide` used to create the annotation, the recorded comment side will silently mismatch the intended side. Using `anchor.side` is unambiguous and was captured for exactly this purpose.

**Fix:**
```tsx
// DiffPane.tsx line 132 — replace ann.side with anchor.side
onAddLineComment?.(file.filename, anchor.lineNumber, anchor.side, text, anchor.endLineNumber)
```

### WR-03: Source-text tests are brittle substitutes for behavioral tests

**File:** `ui/src/code-review/AppToolbar.test.ts:7`, `ui/src/code-review/DiffPane.test.ts:7`

**Issue:** Both test files read the component's raw `.tsx` source as a string and assert that specific string literals are present (e.g., `expect(source).toContain("'Hide Whitespace'")`, `expect(source).toContain('ignoreWhitespace: hideWhitespace')`). This pattern verifies source text, not runtime behaviour. The tests will pass even if:
- The logic is dead code (inside an unreachable branch).
- The prop is threaded but the value is always hardcoded to `false`.
- Refactors rename variables (e.g., `ignoreWhitespace: hw` where `hw = hideWhitespace`) without changing behaviour.

For Phase 30 specifically, there is no test that mounts the component and verifies the rendered diff actually changes when `hideWhitespace` flips. The `onHideWhitespaceToggle` callback is never exercised in a rendered component test.

**Fix:** At minimum, add one integration-style test using `@testing-library/react` that:
1. Renders `AppToolbar` with `hideWhitespace={false}` and verifies the button label is "Hide Whitespace".
2. Simulates a click and verifies `onHideWhitespaceToggle` was called.

For `DiffPane`, add a test that passes `hideWhitespace={true}` and verifies `parseDiffFromFile` is called with `{ ignoreWhitespace: true }` (via a spy/mock).

## Info

### IN-01: `hideWhitespace` button inserted between "Expand All" and "Expand Files/Collapse Files", breaking visual grouping

**File:** `ui/src/code-review/AppToolbar.tsx:305-324`

**Issue:** The new "Hide Whitespace / Show Whitespace" button is placed between the "Expand All/Collapse/Loading" button (line 282) and the "Expand Files/Collapse Files" button (line 326). The two expand/collapse controls are thematically paired (both control visibility/context of diff content), while the whitespace toggle affects rendering. Inserting the whitespace button between them may confuse users about which controls are related. This is a UX layout concern rather than a functionality bug.

**Fix:** Consider moving the "Hide Whitespace" button to appear immediately after the diff-style toggle group (Unified/Side-by-side) since it is a rendering option, grouping it with other rendering controls. Alternatively, add a visual separator (`border-right: 1px solid var(--color-border)`) between conceptual groups.

---

_Reviewed: 2026-05-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
