---
status: partial
phase: 21-comment-actions
source: [21-VERIFICATION.md]
started: 2026-05-22T14:45:00Z
updated: 2026-05-22T14:45:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. All nine behavioral flows from Plan 04 Task 3

expected: All 9 steps described in 21-04-PLAN.md Task 3 pass without any failure in a running browser
result: [pending]

Steps to run (`cd ui && npm run dev` alongside `cargo run -- review fixtures/sample-plan.md`):
1. Comment pill flow — select text, click Comment, verify popover, type text, Cmd+Enter, verify bubble appears
2. Delete / Replace pre-fill — verify textarea opens with correct prefill text
3. Predefined-actions menu — open "more" menu, click a label, verify textarea pre-fill
4. Gutter-icon paragraph selection — hover paragraph, click +, verify entire paragraph selected and toolbar appears
5. Auto-submit on conflict (D-03) — open form, start a second without submitting, verify first auto-submits
6. Edit flow — focus bubble, click pencil, verify inline edit textarea; test Cmd+Enter save and Escape discard
7. Delete flow — focus bubble, click ×, verify immediate removal with no confirmation dialog
8. Section count badges — verify count badge appears/increments/disappears correctly
9. Escape clears edit mode globally

### 2. QUICK_ACTIONS label conflict: "search internet" vs "Search the web"

expected: Confirm whether `'search internet'` (implemented) or `'Search the web'` (REQUIREMENTS.md/ROADMAP) is the accepted label — or fix the label to match requirements
result: [pending]

Context: UI-SPEC.md intentionally maps "Search the web" → `"search internet"`. REQUIREMENTS.md COMMENT-04 and ROADMAP success criteria say "Search the web". A product decision is required.

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
