---
phase: 27-inline-comments
fixed_at: 2026-05-25T14:53:00Z
review_path: .planning/phases/27-inline-comments/27-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 27: Code Review Fix Report

**Fixed at:** 2026-05-25T14:53:00Z
**Source review:** .planning/phases/27-inline-comments/27-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, WR-01, WR-02, WR-03, WR-04)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: File-level comment form is permanently invisible when the file is collapsed

**Files modified:** `ui/src/code-review/DiffPane.tsx`
**Commit:** 062e036
**Applied fix:** Two complementary fixes inside the `files.map()` callback:
1. A local `handleToggleFile()` wrapper replaces the direct `onToggleFile?.(file.filename)` calls in the file header `onClick` and `onKeyDown` handlers. When the user collapses an expanded file, the wrapper clears `pendingFileComment` if it matches that file, preventing a stale form from appearing unexpectedly on the next expand.
2. The `+ Comment` button `onClick` now checks `isCollapsed` and calls `onToggleFile?.(file.filename)` before `setPendingFileComment(file.filename)`, so the file auto-expands and the `HunkCommentForm` renders immediately instead of being swallowed by the `!isCollapsed` gate.

### WR-01: HunkCommentForm submits empty comments with no validation

**Files modified:** `ui/src/code-review/HunkCommentForm.tsx`
**Commit:** 6ef25ae
**Applied fix:** `handleSubmit` now trims the textarea value and returns early if the result is empty, covering both the button-click and Cmd+Enter keyboard submission paths.

### WR-02: Dead `reloadFocused` state declared, toggled, and voided

**Files modified:** `ui/src/code-review/DiffPane.tsx`
**Commit:** 8d20104
**Applied fix:** Removed the `useState(false)` declaration for `reloadFocused`, the `void reloadFocused` suppression line, and the `setReloadFocused(true)` / `setReloadFocused(false)` calls from the Reload Diff button's `onFocus` / `onBlur` handlers. The focus ring continues to work correctly via the existing imperative `e.currentTarget.style.outline` mutations.

### WR-03: File-level comments array filtered twice per render

**Files modified:** `ui/src/code-review/DiffPane.tsx`
**Commit:** eac2f6b
**Applied fix:** Added `const fileComments = comments.filter(...)` immediately after `const isCollapsed` inside the `files.map()` callback. The length guard and the `.map()` inside JSX both now use `fileComments`, eliminating the redundant second filter pass.

### WR-04: File header div[role="button"] missing aria-label and aria-expanded

**Files modified:** `ui/src/code-review/DiffPane.tsx`
**Commit:** 522291c
**Applied fix:** Added `aria-label={\`${isCollapsed ? 'Expand' : 'Collapse'} ${file.filename}\`}` and `aria-expanded={!isCollapsed}` to the file header `div[role="button"]`, consistent with the `FileListPane` directory toggle pattern.

---

_Fixed: 2026-05-25T14:53:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
