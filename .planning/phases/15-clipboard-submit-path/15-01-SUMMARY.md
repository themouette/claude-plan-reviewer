---
phase: 15-clipboard-submit-path
plan: "01"
subsystem: frontend-utils
tags:
  - tdd
  - typescript
  - clipboard
  - serialization
dependency_graph:
  requires:
    - ui/src/utils/serializeAnnotations.ts
    - ui/src/types.ts
    - ui/src/utils/connectivity.ts
  provides:
    - buildClipboardPayload exported pure function
    - ClipboardDecision type
  affects:
    - 15-02 (App.tsx clipboard handler will call buildClipboardPayload)
tech_stack:
  added: []
  patterns:
    - Pure function isolation for deterministic Vitest testing
    - TDD RED/GREEN/REFACTOR cycle
    - JSON.stringify compact output (no spacing) matching Rust build_opencode_output
key_files:
  created: []
  modified:
    - ui/src/utils/offlineLabels.ts
    - ui/src/utils/offlineLabels.test.ts
decisions:
  - buildClipboardPayload delegates to serializeAnnotations for deny path — no duplication, single responsibility
  - ClipboardDecision type exported alongside function — enables typed callers in App.tsx (Phase 15-02)
  - message key always present for deny (even empty string) — matches Rust server JSON format exactly
metrics:
  duration: "~6 minutes"
  completed: "2026-05-07T16:11:39Z"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 2
---

# Phase 15 Plan 01: buildClipboardPayload Pure Function Summary

**One-liner:** Pure `buildClipboardPayload` function in `offlineLabels.ts` serializing annotation state to compact JSON matching Rust `build_opencode_output` format, tested with 5 Vitest assertions covering both allow and deny paths.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Add failing tests for buildClipboardPayload | 5fccf7c | ui/src/utils/offlineLabels.test.ts |
| 1 (GREEN) | Implement buildClipboardPayload | 23d3935 | ui/src/utils/offlineLabels.ts |

## TDD Gate Compliance

- RED gate commit: `5fccf7c` — `test(15-01): add failing tests for buildClipboardPayload (RED)`
- GREEN gate commit: `23d3935` — `feat(15-01): implement buildClipboardPayload pure function (GREEN)`
- REFACTOR gate: Not needed — function is minimal, no duplication found

## Implementation Notes

`buildClipboardPayload` added to `offlineLabels.ts` (after all existing exports):

- `ClipboardDecision = 'allow' | 'deny'` type exported
- For `allow`: returns `JSON.stringify({ behavior: 'allow' })` → `'{"behavior":"allow"}'`
- For `deny`: calls `serializeAnnotations(denyText, overallComment, annotations)` then returns `JSON.stringify({ behavior: 'deny', message })` — the `message` key is always present, even as an empty string when all inputs are empty
- This mirrors exactly what `build_opencode_output` in Rust produces (STATE.md locked decision)

## Test Results

All 44 tests pass (15 pre-existing + 5 new for `buildClipboardPayload` + 24 other module tests):

- Test 16: `allow` with no annotations returns `'{"behavior":"allow"}'`
- Test 17: `deny` with denyText returns JSON with `behavior='deny'` and non-empty `message`
- Test 18: `allow` ignores all annotation state (even if populated)
- Test 19: `deny` with feedback parses to `{ behavior: 'deny', message: stringContaining(feedback) }`
- Test 20: `deny` with all empty inputs returns valid JSON with empty string `message`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — `buildClipboardPayload` is a complete pure function with no placeholder code.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The function is a pure TypeScript utility with no I/O. T-15-01 (Information Disclosure) accepted per plan threat model — clipboard content is user-authored annotation feedback only.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| ui/src/utils/offlineLabels.ts | FOUND |
| ui/src/utils/offlineLabels.test.ts | FOUND |
| .planning/phases/15-clipboard-submit-path/15-01-SUMMARY.md | FOUND |
| Commit 5fccf7c (RED - failing tests) | FOUND |
| Commit 23d3935 (GREEN - implementation) | FOUND |
| npm test exits 0, 44/44 tests pass | PASSED |
