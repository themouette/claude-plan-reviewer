---
phase: 22-submit-clipboard
plan: "04"
subsystem: reviewer-v2
tags:
  - reviewer-v2
  - wiring
  - offline-banner
  - cleanup
dependency_graph:
  requires:
    - 22-01 (offlineLabels.ts with OFFLINE_BANNER_LINE_1/LINE_2)
    - 22-03 (SubmitControls.tsx with annotations + connectivity props contract)
  provides:
    - ReviewerV2Shell with SubmitControls mounted in header right slot
    - ReviewerV2Shell with OfflineBanner mounted between header and body when offline
    - ReviewerV2.tsx cleaned of phantom void hook calls (tech debt resolved)
    - index.css .submit-btn transition rule
  affects:
    - /v2 route — full submit flow now user-observable
    - SUBMIT-01 gate logic (approve/feedback disable conditions) now wired end-to-end
    - SUBMIT-02 clipboard fallback path reachable from UI
tech_stack:
  added: []
  patterns:
    - Inline sub-component (OfflineBanner) defined after default export — mirrors App.tsx pattern
    - Conditional render between layout siblings (header, banner, body)
    - justifyContent space-between to split header label and controls
key_files:
  created: []
  modified:
    - ui/src/reviewer-v2/ReviewerV2.tsx
    - ui/src/reviewer-v2/ReviewerV2Shell.tsx
    - ui/src/reviewer-v2/ReviewerV2Shell.test.ts
    - ui/src/index.css
decisions:
  - ReviewerV2.tsx is now a 4-line clean pass-through; useHeartbeat and useAnnotations both moved to Shell where they belong
  - OfflineBanner defined as local function after default export (not a separate file) — matches App.tsx co-location pattern, keeps Phase 22 additions self-contained
  - index.css .submit-btn rule added as a no-op safety net (buttons use inline styles for hover/disabled — CSS rule is dormant but satisfies UI-SPEC contract without modifying SubmitControls.tsx)
metrics:
  duration: "~3 minutes"
  completed: "2026-05-22"
  tasks_completed: 2
  tasks_total: 3
  files_modified: 4
---

# Phase 22 Plan 04: Shell Wiring + OfflineBanner + Cleanup Summary

Phase 22 end-to-end wiring: SubmitControls mounted in reviewer header right slot + OfflineBanner on connectivity transition + ReviewerV2.tsx phantom hooks removed.

## What Was Built

**Task 1 — ReviewerV2.tsx cleaned (commit 35450e8):**
Removed the two phantom void hook calls (`void useHeartbeat()` and `void useAnnotations()`) and their now-unnecessary imports. These were temporary stubs from Phase 17 that created a second, void-discarded invocation of hooks already owned by ReviewerV2Shell. The file is now a 4-line pass-through: highlight.js import, Shell import, default export function, return statement. File size: 164 bytes (well under the 300-byte clean pass-through target).

**Task 2 — ReviewerV2Shell.tsx wired + test extended + index.css updated (commit af4d073):**
- Added `useHeartbeat` import and call, capturing the `ConnectivityStatus` return value into `const connectivity`.
- Added `SubmitControls` import and mounted it in the header right slot — header now uses `justifyContent: 'space-between'` to push the "Reviewer v2" label left and SubmitControls right.
- Added imports for `OFFLINE_BANNER_LINE_1` and `OFFLINE_BANNER_LINE_2` from `./offlineLabels`.
- Added inline `function OfflineBanner()` sub-component after the default export, mirroring the App.tsx pattern (role="status", banner-bg/text tokens, two text lines from constants).
- Added conditional render `{connectivity === 'offline' && <OfflineBanner />}` between `</header>` and the 3-column body div.
- Extended `ReviewerV2Shell.test.ts` with a new `describe('ReviewerV2Shell Phase 22 wiring', ...)` block (12 source-contract assertions); all 37 tests in the file pass.
- Appended `.submit-btn { transition: background 0.1s ease, opacity 0.1s ease; }` to `ui/src/index.css` per UI-SPEC §CSS Changes.

**Task 3 — Human verification checkpoint (awaiting):**
The full submit flow (gates 1-9) requires live dev server and Rust backend verification. Returned as checkpoint.

## Verification Results

- `cd ui && npx vitest run` — 378 tests across 24 test files: ALL PASS
- `cd ui && npm run lint` — exit 0 (5 pre-existing warnings in App.tsx and useSectionAnnotationCounts.ts, unrelated to Phase 22)
- `cd ui && npx tsc --noEmit` — exit 0, no TypeScript errors
- Acceptance criteria grep checks — all pass (see task acceptance criteria in PLAN.md)

## Deviations from Plan

None — plan executed exactly as written.

Both tasks followed the plan's action steps without requiring any auto-fixes, structural changes, or deviation triggers.

## Known Stubs

None. All Phase 22 components are wired end-to-end. The `.submit-btn` CSS rule is dormant (SubmitControls uses inline styles) but this is intentional per UI-SPEC §CSS Changes and plan task 2 action step 8 — not a stub.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 35450e8 | refactor(22-04): strip ReviewerV2.tsx to clean pass-through (Pitfalls 1+2) |
| Task 2 | af4d073 | feat(22-04): wire SubmitControls + OfflineBanner into ReviewerV2Shell |

## Checkpoint Status

Task 3 (human verification of live gates 1-9) is a `checkpoint:human-verify` gate. The automated implementation is complete. Human must verify the full submit flow against gates 1-9 in the dev environment before Phase 22 can be marked complete.

## Self-Check: PASSED

All created/modified files confirmed present. Both task commits verified in git log.

| Check | Result |
|-------|--------|
| ReviewerV2.tsx exists | FOUND |
| ReviewerV2Shell.tsx exists | FOUND |
| ReviewerV2Shell.test.ts exists | FOUND |
| index.css exists | FOUND |
| 22-04-SUMMARY.md exists | FOUND |
| Commit 35450e8 (Task 1) | FOUND |
| Commit af4d073 (Task 2) | FOUND |
