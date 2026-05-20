---
status: partial
phase: 18-content-pane
source: [18-VERIFICATION.md]
started: 2026-05-20T11:00:00Z
updated: 2026-05-20T11:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. GFM rendering visible at /v2
expected: Heading, table, checkboxes, strikethrough, and syntax-highlighted code all render correctly in the browser
result: [pending]

### 2. Paragraph hover affordance
expected: Subtle background appears on hovered paragraph and the `+` icon shows at the right edge
result: [pending]

### 3. Selection toolbar and hover suppression
expected: Toolbar appears fixed to selection end; paragraph background disappears while text is selected
result: [pending]

### 4. Character-offset serialization
expected: React DevTools shows `offsets={{ start: N, end: N }}` on the SelectionToolbar when text is selected
result: [pending]

### 5. More expander with 6 quick actions
expected: The 6-item dropdown appears in the correct order when the More button is clicked
result: [pending]

### 6. Selection clears after pill click
expected: Toolbar disappears, selection clears, no annotation persisted (Phase 18 stub behavior)
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
