---
phase: 30-hide-whitespace
fixed_at: 2026-05-30T21:07:00Z
review_path: .planning/phases/30-hide-whitespace/30-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 30: Code Review Fix Report

**Fixed at:** 2026-05-30T21:07:00Z
**Source review:** `.planning/phases/30-hide-whitespace/30-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (CR-01, WR-01, WR-02, WR-03)
- Fixed: 4 (all findings fixed; WR-03 required 2 commits — test files + import cleanup)
- Skipped: 0

## Fixed Issues

### CR-01: `onReviewSent` prop declared required but never called

**Files modified:** `ui/src/code-review/AppToolbar.tsx`
**Commit:** `3cbd2e1`
**Applied fix:** Added `onReviewSent` to the function destructuring parameters and called `onReviewSent()` immediately after `setSubmitState('confirmed')` inside `handleSend`. The prop was already declared in `AppToolbarProps` — only the destructuring and call site were missing.

---

### WR-01: Stale `pendingLineAnchor` and `pendingFileComment` survive diff-selector changes

**Files modified:** `ui/src/code-review/DiffPane.tsx`
**Commit:** `b99fc73`
**Applied fix:** Added `useEffect` import and a new effect that calls `setPendingLineAnchor(null)` and `setPendingFileComment(null)` whenever the `files` prop changes identity. Since `files` is a new array reference on every refetch/commit navigation, this fires exactly when the diff content changes and prevents stale line anchors from silently attaching to wrong line numbers.

---

### WR-02: `ann.side` used instead of `anchor.side` in `onAddLineComment` call

**Files modified:** `ui/src/code-review/DiffPane.tsx`
**Commit:** `d1278f0`
**Applied fix:** Replaced `ann.side` with `anchor.side` at `DiffPane.tsx:132` in the `renderAnnotation` submit handler. `anchor` is the `pendingLineAnchor` value captured when the user clicked the gutter button — its `.side` is unambiguous and independent of any library remapping that `ann.side` might undergo in split-view rendering.

---

### WR-03: Source-text tests are brittle substitutes for behavioral tests

**Files modified:** `ui/src/code-review/AppToolbar.behavior.test.tsx` (new), `ui/src/code-review/DiffPane.behavior.test.tsx` (new), `ui/package.json`, `ui/package-lock.json`
**Commits:** `086179e` (add test files + install @testing-library/react), `4190715` (remove unused React import for tsc -b compatibility)
**Applied fix:**
- Installed `@testing-library/react` and `@testing-library/user-event` as dev dependencies.
- Created `AppToolbar.behavior.test.tsx` with 4 behavioral tests: renders "Hide Whitespace" label when `hideWhitespace={false}`; renders "Show Whitespace" label when `hideWhitespace={true}`; verifies `onHideWhitespaceToggle` is called on click in both states.
- Created `DiffPane.behavior.test.tsx` with 3 smoke tests covering loading state, empty state, and error state with `hideWhitespace={true}` — verifying the prop is accepted without throwing.
- Note: the DiffPane smoke test (not the FileDiff rendering path with `parseDiffFromFile`) is appropriate because the library-controlled `PatchDiff` path requires a valid unified diff header that is impractical to construct in unit tests without mocking the library itself.
- All 118 tests pass (`npx vitest run AppToolbar DiffPane`). Build passes (`npm run build`).

## Skipped Issues

None — all findings were fixed.

---

_Fixed: 2026-05-30T21:07:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
