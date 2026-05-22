---
phase: 22-submit-clipboard
plan: "01"
subsystem: reviewer-v2/offline
tags:
  - reviewer-v2
  - offline
  - banner-copy
  - tdd
dependency_graph:
  requires: []
  provides:
    - "OFFLINE_BANNER_LINE_1 constant in ui/src/reviewer-v2/offlineLabels.ts"
    - "OFFLINE_BANNER_LINE_2 constant in ui/src/reviewer-v2/offlineLabels.ts"
  affects:
    - "ui/src/reviewer-v2/offlineLabels.ts (consumers — Plan 04 OfflineBanner)"
tech_stack:
  added: []
  patterns:
    - "v2-subtree copy pattern: mirror constants from utils/ into reviewer-v2/ to satisfy ARCH-01 no-restricted-imports"
key_files:
  created: []
  modified:
    - "ui/src/reviewer-v2/offlineLabels.ts"
    - "ui/src/reviewer-v2/offlineLabels.test.ts"
decisions:
  - "OFFLINE_BANNER_LINE_2 uses UI-SPEC value ('Clipboard submit is available.') not the v0.5 banner value — shorter, action-focused copy for v2"
  - "Constants placed at top of file (after imports, before ClipboardDecision type) per plan action spec"
metrics:
  duration: "~2 minutes"
  completed: "2026-05-22T21:11:14Z"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 2
requirements_addressed:
  - SUBMIT-02
---

# Phase 22 Plan 01: Banner Constants for v2 OfflineBanner — Summary

Added `OFFLINE_BANNER_LINE_1` and `OFFLINE_BANNER_LINE_2` string constants to `ui/src/reviewer-v2/offlineLabels.ts` so that the v2 `OfflineBanner` (Plan 04) can import from within the `reviewer-v2/` subtree without violating ARCH-01.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Add failing banner constant tests | 7725272 | ui/src/reviewer-v2/offlineLabels.test.ts |
| 1 (GREEN) | Add OFFLINE_BANNER_LINE_1 and OFFLINE_BANNER_LINE_2 constants | b5dff08 | ui/src/reviewer-v2/offlineLabels.ts |

## What Was Built

Two exported string constants added to `ui/src/reviewer-v2/offlineLabels.ts`:

- `OFFLINE_BANNER_LINE_1 = 'Server connection lost — working offline.'` — matches the existing `utils/offlineLabels.ts` v0.5 banner spelling exactly (U+2014 em-dash, trailing period)
- `OFFLINE_BANNER_LINE_2 = 'Clipboard submit is available.'` — v2-specific copy per UI-SPEC line 338 (shorter, action-focused vs. v0.5 instructional copy)

Existing exports (`ClipboardDecision`, `buildClipboardPayload`, `shouldUseClipboard`) are untouched.

Test file extended with a `describe('banner constants (v2 copy)', ...)` block asserting the exact string values. All 6 tests pass (2 new + 4 regression guards).

## TDD Gate Compliance

- RED commit: `7725272` — `test(22-01): add failing tests for OFFLINE_BANNER_LINE_1 and OFFLINE_BANNER_LINE_2 constants`
- GREEN commit: `b5dff08` — `feat(22-01): add OFFLINE_BANNER_LINE_1 and OFFLINE_BANNER_LINE_2 to v2 offlineLabels`
- REFACTOR: not needed — constants are single-line literals with no complexity

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — both constants are fully wired static string literals. No consumers wired yet (Plan 04 will import them); this is intentional per plan design.

## Verification Results

- `cd ui && vitest run reviewer-v2/offlineLabels` — 6 tests pass (2 new constants + 4 pre-existing)
- `eslint src/reviewer-v2/offlineLabels.ts` — zero errors (no new imports, only string literal exports)
- TypeScript compile implicit via Vitest — no errors

## Self-Check: PASSED

| Item | Status |
|------|--------|
| ui/src/reviewer-v2/offlineLabels.ts | FOUND |
| ui/src/reviewer-v2/offlineLabels.test.ts | FOUND |
| .planning/phases/22-submit-clipboard/22-01-SUMMARY.md | FOUND |
| commit 7725272 (RED) | FOUND |
| commit b5dff08 (GREEN) | FOUND |
