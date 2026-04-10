---
status: partial
phase: 04-add-subcommands-install-uninstall-update-install-and-uninsta
source: [04-VERIFICATION.md]
started: 2026-04-10T00:00:00Z
updated: 2026-04-10T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Interactive TUI picker
expected: Running `plan-reviewer install` with no args in an interactive terminal shows a dialoguer::MultiSelect picker with all 3 integrations, correct pre-selection, and renders to stderr without polluting stdout
result: [pending]

### 2. Live update download
expected: Running `plan-reviewer update` against a real GitHub release shows a progress bar, replaces the binary in-place, and deletes the cache file on success
result: [pending]

### 3. Update --check with live GitHub
expected: Running `plan-reviewer update --check` prints current version, latest version, and a changelog URL in the correct format
result: [pending]

### 4. Update --version pinning
expected: Running `plan-reviewer update --version v0.1.0` pins the download to the specified release tag
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
