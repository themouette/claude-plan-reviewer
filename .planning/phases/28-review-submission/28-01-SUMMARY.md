---
phase: 28-review-submission
plan: 01
subsystem: ui
tags: [react, typescript, eslint, heartbeat, connectivity, shared-modules]

# Dependency graph
requires:
  - phase: 22-submit-clipboard
    provides: "connectivity.ts and useHeartbeat.ts in reviewer-v2/"
provides:
  - "ui/src/shared/ directory with connectivity.ts, useHeartbeat.ts and their tests"
  - "All reviewer-v2 consumers updated to import from ../shared/"
  - "ESLint rule for reviewer-v2/** permits ../shared/** via regex pattern"
affects:
  - 28-02-PLAN
  - 28-03-PLAN
  - code-review imports of heartbeat infrastructure

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ESLint no-restricted-imports with regex field for relative path exemptions (extglob doesn't work with ignore package)"
    - "ui/src/shared/ as the canonical location for cross-subtree shared hooks/utilities"

key-files:
  created:
    - "ui/src/shared/connectivity.ts (moved verbatim from reviewer-v2/)"
    - "ui/src/shared/connectivity.test.ts (moved verbatim from reviewer-v2/)"
    - "ui/src/shared/useHeartbeat.ts (moved verbatim from reviewer-v2/)"
    - "ui/src/shared/useHeartbeat.test.ts (moved verbatim from reviewer-v2/)"
  modified:
    - "ui/src/reviewer-v2/ReviewerV2Shell.tsx (import path update)"
    - "ui/src/reviewer-v2/ReviewerV2Shell.test.ts (assertion updated)"
    - "ui/src/reviewer-v2/SubmitControls.tsx (import path update)"
    - "ui/src/reviewer-v2/SubmitControls.test.ts (ARCH-01 assertion updated)"
    - "ui/src/reviewer-v2/offlineLabels.ts (import path update)"
    - "ui/eslint.config.js (ESLint rule relaxed for ../shared/**)"

key-decisions:
  - "Used regex pattern in ESLint no-restricted-imports instead of glob (extglob pattern ../!(shared)/** is not supported by the ignore package used by ESLint)"
  - "SubmitControls.test.ts ARCH-01 assertion updated to allow ../shared/ imports (was a source-level assertion that pinned old import path)"

patterns-established:
  - "ESLint regex pattern for cross-subtree import allowance: regex: '^\\\\.\\\\./(?!shared(/|$))' bans ../ but permits ../shared/ and ../shared/**"
  - "git mv preserves rename tracking (R lines in git status) for all four files"

requirements-completed: []

# Metrics
duration: 30min
completed: 2026-05-25
---

# Phase 28 Plan 01: Move connectivity + useHeartbeat to ui/src/shared/

**Four heartbeat/connectivity files moved from reviewer-v2/ to a new ui/src/shared/ directory, with all reviewer-v2 consumers updated and ESLint rule relaxed via regex to permit ../shared/ imports**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-05-25T20:25:00Z
- **Completed:** 2026-05-25T20:55:00Z
- **Tasks:** 2
- **Files modified:** 10 (4 moved, 6 import-updated)

## Accomplishments

- Created `ui/src/shared/` directory with 4 files moved verbatim from reviewer-v2/ (git rename preserved)
- Updated all 3 reviewer-v2 source consumers (ReviewerV2Shell.tsx, SubmitControls.tsx, offlineLabels.ts) to import from `../shared/`
- Updated ReviewerV2Shell.test.ts import-path assertion from `./useHeartbeat` to `../shared/useHeartbeat`
- Updated ESLint rule from glob group to regex pattern, correctly permitting `../shared/**` while blocking other `../**` imports
- All 335 tests pass; lint clean; cargo clippy clean

## Task Commits

1. **Task 1: Move files to shared/** - `5718748` (refactor)
2. **Task 2: Update imports + ESLint rule** - `ef6d282` (refactor)

## Files Created/Modified

- `ui/src/shared/connectivity.ts` — ConnectivityStatus, HeartbeatState, HeartbeatEvent, initialHeartbeatState, nextHeartbeatState (moved verbatim from reviewer-v2/)
- `ui/src/shared/connectivity.test.ts` — Vitest tests for nextHeartbeatState (moved verbatim)
- `ui/src/shared/useHeartbeat.ts` — useHeartbeat hook + runHeartbeatTick test export (moved verbatim from reviewer-v2/)
- `ui/src/shared/useHeartbeat.test.ts` — Vitest tests for runHeartbeatTick (moved verbatim)
- `ui/src/reviewer-v2/ReviewerV2Shell.tsx` — import path only: `./useHeartbeat` → `../shared/useHeartbeat`
- `ui/src/reviewer-v2/ReviewerV2Shell.test.ts` — assertion regex updated to `../shared/useHeartbeat`
- `ui/src/reviewer-v2/SubmitControls.tsx` — import path only: `./connectivity` → `../shared/connectivity`
- `ui/src/reviewer-v2/SubmitControls.test.ts` — ARCH-01 assertion updated to allow `../shared/` imports
- `ui/src/reviewer-v2/offlineLabels.ts` — import path only: `./connectivity` → `../shared/connectivity`
- `ui/eslint.config.js` — reviewer-v2 no-restricted-imports rule changed from group glob to regex

## Decisions Made

**ESLint pattern choice:** The plan spec suggested `group: ['../!(shared)/**', '../!(shared)']` as the extglob pattern, with a fallback to `group: ['../**', '!../shared/**']`. Neither works — the `ignore` package (used internally by ESLint's no-restricted-imports rule) does not support extglob negation patterns for relative paths. Instead, used the `regex` field: `regex: '^\\.\\./(?!shared(/|$))'` which is a lookahead negative assertion and correctly allows `../shared/` while banning all other `../` imports. Verified with the ignore package via Node.js before committing.

**SubmitControls.test.ts ARCH-01 update:** The test `"imports nothing from outside reviewer-v2 (ARCH-01)"` used a simple regex `/from ['"]\.\.\//` that would now fail since `SubmitControls.tsx` imports from `../shared/connectivity`. Updated to extract all `../` imports and filter out `../shared/` — only non-shared cross-subtree imports cause failure. This preserves the ARCH-01 spirit while allowing the legitimate shared/ exception.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SubmitControls.test.ts ARCH-01 assertion broken by import path change**
- **Found during:** Task 2 (tests run after import updates)
- **Issue:** `SubmitControls.test.ts` line 35 asserts `expect(source).not.toMatch(/from ['"]\.\.\//)`  which fails because the new `from '../shared/connectivity'` import matches the regex
- **Fix:** Updated the assertion to filter out `../shared/` imports — only non-shared cross-subtree imports cause failure
- **Files modified:** `ui/src/reviewer-v2/SubmitControls.test.ts`
- **Verification:** 335 tests pass, including the updated ARCH-01 test
- **Committed in:** ef6d282 (Task 2 commit)

**2. [Rule 1 - Bug] ESLint extglob pattern had no effect (did not catch ../types or allow ../shared/)**
- **Found during:** Task 2 (lint verification)
- **Issue:** The plan-specified `group: ['../!(shared)/**', '../!(shared)']` extglob patterns produce 0 matches with the `ignore` package — neither banning violations nor allowing ../shared/
- **Fix:** Used `regex: '^\\.\\./(?!shared(/|$))'` which reliably matches ../anything but not ../shared/ or ../shared/anything
- **Files modified:** `ui/eslint.config.js`
- **Verification:** Lint passes; existing `eslint-disable-next-line` in useSectionAnnotationCounts.ts correctly suppresses the now-active rule for intra-subtree hooks/ imports
- **Committed in:** ef6d282 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — pre-existing test and ESLint configuration corrections)
**Impact on plan:** Both auto-fixes necessary for correctness; no scope creep.

## Issues Encountered

- The worktree lacked `ui/node_modules/` — resolved by creating a symlink to the main repo's `ui/node_modules/` for the duration of execution (symlink is gitignored)
- ESLint extglob pattern `../!(shared)/**` does not work with the `ignore` npm package (used internally by ESLint) — worked around with a regex pattern as documented above

## ESLint Rule Committed (for Plan 28-03 reference)

The final reviewer-v2 rule in `ui/eslint.config.js`:

```javascript
{
  files: ['src/reviewer-v2/**'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            regex: '^\\.\\./(?!shared(/|$))',
            message:
              'reviewer-v2/ files must not import from outside the subtree ' +
              '(exception: ../shared/** is allowed). ' +
              'Copy the utility into reviewer-v2/utils/ or reviewer-v2/hooks/ if you need it locally.',
          },
        ],
      },
    ],
  },
},
```

The `code-review/**` rule block was NOT modified — it already allows `../**` so it already permits `../shared/**`.

## Next Phase Readiness

- `ui/src/shared/connectivity.ts` and `ui/src/shared/useHeartbeat.ts` are available for import by both `reviewer-v2/` and `code-review/`
- Plan 28-02 can create `CodeReviewSubmitPopover.tsx` and `buildCodeReviewPayload.ts` in `code-review/`
- Plan 28-03 can import `useHeartbeat` from `'../shared/useHeartbeat'` in `CodeReviewApp.tsx` without ESLint violation

---
*Phase: 28-review-submission*
*Completed: 2026-05-25*

## Self-Check: PASSED

All created files exist on disk. Both task commits verified in git history.
