---
status: partial
phase: 07-opencode-integration
source: [07-VERIFICATION.md]
started: 2026-04-10T23:15:00Z
updated: 2026-04-10T23:15:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Opencode browser launch

expected: Browser tab opens at http://127.0.0.1:<port> showing the plan rendered in the review UI; URL printed to stderr
result: [pending]

**Steps:**
1. Run `plan-reviewer install opencode` in a shell
2. Start an opencode AI session and trigger a plan that invokes the `submit_plan` tool
3. Verify a browser tab opens with plan content and approve/deny controls

### 2. Approve in live opencode session

expected: opencode receives the decision; JS plugin returns "Plan APPROVED by reviewer." to opencode; session continues
result: [pending]

**Steps:**
1. With browser review UI open (from test 1), click Approve
2. Verify opencode receives the allow decision and continues execution

### 3. Deny with message in live opencode session

expected: opencode receives the denial; JS plugin returns "Plan DENIED by reviewer. Feedback: <message>" to opencode
result: [pending]

**Steps:**
1. With browser review UI open (from test 1), click Deny and enter a message
2. Verify opencode receives the deny decision with the feedback message

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
