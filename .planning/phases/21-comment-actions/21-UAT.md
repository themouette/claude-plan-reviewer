---
status: complete
phase: 21-comment-actions
source: 21-01-SUMMARY.md, 21-02-SUMMARY.md, 21-03-SUMMARY.md, 21-04-SUMMARY.md, 21-06-SUMMARY.md, 21-07-SUMMARY.md
started: 2026-05-22T20:40:00Z
updated: 2026-05-22T20:50:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Add annotation via text selection
expected: Select text in the plan → selection toolbar appears with action pills → click "Comment" → popup form opens → type and submit → bubble appears in comment pane anchored to the selection.
result: pass

### 2. Add annotation via gutter icon
expected: Hover over a paragraph in the plan → a gutter icon (✚ or similar) appears on the left edge → click it → the whole paragraph is selected and the annotation form opens → submit → bubble appears anchored to the paragraph.
result: pass

### 3. Delete annotation type (direct, no form)
expected: Select text → click the "Delete" pill in the selection toolbar → a delete annotation bubble is created immediately in the comment pane, with no popup form appearing.
result: pass

### 4. Comment bubble focused view shows edit and delete buttons
expected: Click a comment bubble to focus it → the bubble expands to show the full comment text, a type badge, and two icon buttons: ✎ (edit) and × (delete) in the top-right area.
result: pass

### 5. Enter edit mode via edit button
expected: Focus a bubble then click the ✎ button → the comment text is replaced by a textarea pre-filled with the current comment. "Save Changes" and "Discard Changes" buttons appear below.
result: pass

### 6. Enter edit mode via double-click
expected: Double-click directly on a comment bubble (anywhere on it, not just the button) → the bubble immediately enters edit mode with the textarea, same as clicking ✎.
result: pass

### 7. Save edited comment
expected: While in edit mode, change the textarea content and click "Save Changes" (or press Cmd+Enter) → the bubble exits edit mode and the updated comment text is shown.
result: pass

### 8. Discard edit
expected: While in edit mode, click "Discard Changes" (or press Escape) → the bubble exits edit mode and the original comment text is restored unchanged.
result: pass

### 9. Delete annotation via × button
expected: Focus a bubble and click the × button → the bubble is removed from the comment pane immediately.
result: pass

### 10. Outline pane shows per-section annotation counts
expected: After adding annotations to different sections, the outline pane entries show a count badge next to each section that has annotations. Sections with no annotations show no badge (or zero).
result: pass

### 11. Escape clears focus and edit mode
expected: With a bubble focused (or in edit mode), press Escape → the bubble loses focus and any edit mode is exited. The comment pane returns to its idle state.
result: pass

## Summary

total: 11
passed: 11
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

