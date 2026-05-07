---
status: partial
phase: 14-offline-banner-button-relabeling
source: [14-VERIFICATION.md]
started: 2026-05-07T09:05:00.000Z
updated: 2026-05-07T09:05:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Offline Banner Appearance
expected: Amber banner with exact copy "Cannot connect to the plan reviewer binary" and "Your annotations are still saved" appears between PageHeader and content after ~15s with DevTools offline (or immediately when binary stops)
result: [pending]

### 2. Banner Dismissal on Recovery
expected: Banner disappears immediately (no transition) on first successful ping after toggling back online
result: [pending]

### 3. Theme Toggle While Offline
expected: Banner uses dark amber (#f59e0b bg, #0f1117 text) in dark mode and light amber (#d97706 bg, #0f172a text) in light mode — correctly switches when user toggles theme while offline
result: [pending]

### 4. Keyboard Tab Order
expected: Banner element (role="status") is not in the tab stop sequence — does not intercept keyboard navigation
result: [pending]

### 5. All appState Values Visible
expected: Banner is visible in loading, error, reviewing, and confirmed states simultaneously when offline — it is NOT inside any appState conditional branch
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
