---
status: diagnosed
phase: 21-comment-actions
source: [21-VERIFICATION.md]
started: 2026-05-22T14:45:00Z
updated: 2026-05-22T14:50:00Z
---

## Current Test

Completed — 4 failures found.

## Tests

### 1. Comment pill flow (select → Comment → textarea → submit → bubble)
expected: Popover appears, typing + Cmd+Enter creates a bubble
result: passed

### 2. Delete / Replace quick actions
expected: Delete textarea opens pre-filled; Replace uses orange theme
result: failed — Delete should bypass the textarea entirely and directly create a delete bubble in the comment column. Replace popover must use the orange/replace color theme.

### 3. Predefined-actions menu
expected: Clicking a predefined action opens textarea pre-filled with that label
result: failed — Predefined actions should behave like Delete: no popup, create a comment bubble directly on the sidebar without opening any textarea.

### 4. Gutter-icon paragraph selection
expected: Hover paragraph, click +, entire paragraph selected and action tray appears
result: failed — Text is selected correctly but the action tray does not appear after gutter-icon click.

### 5. Auto-submit on conflict (D-03)
expected: Opening a second annotation form auto-submits the first
result: failed — Auto-submit on conflict does not work.

### 6. Edit flow (pencil → textarea → Cmd+Enter / Escape)
expected: Pencil reopens textarea with existing text; Cmd+Enter saves; Escape discards
result: passed

### 7. Delete flow (× → immediate removal)
expected: Clicking × removes bubble immediately with no confirmation
result: passed

### 8. Section count badges
expected: Badges appear/increment/disappear as annotations are added/removed
result: passed

### 9. Escape clears edit mode globally
expected: Escape key clears any active edit state
result: passed

## Summary

total: 9
passed: 5
issues: 4
pending: 0
skipped: 0
blocked: 0

## Gaps

- status: failed
  test: "2. Delete quick action"
  detail: "Delete should directly create a bubble in the comment column without opening a textarea popup. Replace popover should use the orange/replace color theme."

- status: failed
  test: "3. Predefined actions"
  detail: "Predefined actions should behave like delete: no popup, create a comment bubble directly on the sidebar."

- status: failed
  test: "4. Gutter-icon action tray"
  detail: "Gutter icon click selects text but does not display the action tray."

- status: failed
  test: "5. Auto-submit on conflict (D-03)"
  detail: "Opening a second annotation form does not auto-submit the first open form."
