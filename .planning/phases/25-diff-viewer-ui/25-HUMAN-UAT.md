---
status: partial
phase: 25-diff-viewer-ui
source: [25-VERIFICATION.md]
started: 2026-05-24T00:00:00Z
updated: 2026-05-24T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. /code-review route renders file list + diff pane
expected: Navigating to /code-review shows a 240px file list sidebar on the left and a diff pane on the right
result: [pending]

### 2. Unified/Side-by-side toggle
expected: Clicking "Side-by-side" instantly re-renders all diffs in side-by-side layout — no network request
result: [pending]

### 3. File click scrolls to file
expected: Clicking a file in the left list scrolls the diff pane to that file with a smooth scroll; active file gets blue left border
result: [pending]

### 4. Per-hunk expansion
expected: Clicking a `...` separator expands exactly 20 context lines
result: [pending]

### 5. Expand All / Collapse cycle
expected: "Expand All" shows "Loading..." label, fetches with ?context=999, then shows "Collapse"; "Collapse" refetches with default context
result: [pending]

### 6. ARCH-01 — no legacy /api/diff
expected: DevTools Network tab shows no /api/diff request; curl /api/diff returns HTML (SPA fallback), not JSON
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
