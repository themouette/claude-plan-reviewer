---
status: complete
phase: 20-comment-pane
source: 20-01-SUMMARY.md, 20-02-SUMMARY.md, 20-03-SUMMARY.md
started: 2026-05-21T00:00:00Z
updated: 2026-05-21T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Comment sidebar empty state
expected: Open the reviewer UI. Before adding any annotations, the right sidebar shows "No comments yet" and "Select text or hover a paragraph to add a comment." — no bubbles, no errors.
result: pass

### 2. Add a comment by selecting text
expected: Select a word or phrase in the plan content. A toolbar should appear near the selection with annotation type buttons (comment, delete, replace). Clicking one should dismiss the toolbar and create a new bubble in the right sidebar.
result: pass

### 3. Comment bubble aligns with anchor text
expected: The bubble in the sidebar appears at the same vertical position as the selected text. If you added two annotations at different heights in the document, the bubbles are in the same vertical order and roughly aligned with their respective anchors.
result: pass

### 4. Bubble hover highlights anchor text
expected: Move the cursor over a comment bubble in the sidebar. The corresponding anchor text in the plan content becomes visually highlighted (background color change from the CSS Highlight API). Moving off the bubble clears the highlight.
result: pass

### 5. Anchor text hover highlights bubble
expected: Move the cursor over annotated text in the plan (text that was selected for a comment). The corresponding comment bubble in the sidebar becomes visually highlighted (border or background change). Moving off the annotated text clears the highlight.
result: pass

### 6. Comments stay aligned when scrolling
expected: After adding at least one comment, scroll the main content up and down. The comment bubble should stay aligned with its anchor text at every scroll position — it should not drift down or up relative to the annotated text.
result: pass

### 7. Expand and collapse a comment bubble
expected: Click a comment bubble — it should expand to show more content and get a visible focus ring. Click it again (or press Escape) and it should collapse back to the compact 2-line preview.
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
