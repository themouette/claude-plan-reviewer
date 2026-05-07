---
phase: 14-offline-banner-button-relabeling
plan: 01
subsystem: ui
tags: [react, typescript, vitest, css-variables, offline, connectivity]

# Dependency graph
requires:
  - phase: 13-connectivity-state-heartbeat-hook
    provides: ConnectivityStatus type from ui/src/utils/connectivity.ts used as the parameter type for all three label functions
provides:
  - Pure helper module ui/src/utils/offlineLabels.ts with 5 string constants and 3 label-selection functions
  - Vitest test file ui/src/utils/offlineLabels.test.ts with 15 passing cases
  - CSS theme tokens --color-banner-bg and --color-banner-text in both :root (dark) and [data-theme="light"] (light) blocks
affects:
  - 14-02 (Plan 02 consumes offlineLabels exports and CSS vars for the OfflineBanner component and button-label call sites in App.tsx)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pure helper module with sibling Vitest test (no @testing-library/react) — matching the connectivity.ts / connectivity.test.ts pattern from Phase 13
    - Render-time ternary for connectivity-driven label selection (not useEffect / state mutation)
    - CSS variables declared in both :root and [data-theme="light"] blocks for theme-aware banner palette

key-files:
  created:
    - ui/src/utils/offlineLabels.ts
    - ui/src/utils/offlineLabels.test.ts
  modified:
    - ui/src/index.css

key-decisions:
  - "offlineLabels.ts imports ConnectivityStatus with type qualifier (import type) from ./connectivity — no local redefinition"
  - "Label functions use ternary (not switch) — ConnectivityStatus is a binary union; ternary is the idiomatic shape per PATTERNS.md"
  - "Em dash U+2014 (not two hyphens) used in OFFLINE_BANNER_LINE_1, OFFLINE_APPROVE_LABEL, OFFLINE_DENY_LABEL — verified with grep -cP"
  - "ASCII apostrophe U+0027 (not curly U+2019) in OFFLINE_BANNER_LINE_2 you're — verified with grep"
  - "Light-theme --color-banner-text uses UI-SPEC override #0f172a (5.60:1 contrast), NOT D-08 literal #f8fafc (would fail AA at 3.04:1)"

patterns-established:
  - "Pattern 1: Pure helper module for UI business logic — extract to utils/, test with Vitest pure assertions, no React renderer needed"
  - "Pattern 2: Render-time ternary for connectivity-derived labels — do not mutate approveLabel/denyLabel React state on connectivity transitions"

requirements-completed:
  - OFX-01
  - OFX-02

# Metrics
duration: 15min
completed: 2026-05-07
---

# Phase 14 Plan 01: Offline Labels Helper and CSS Theme Tokens Summary

**Pure helper module with 5 offline copy constants and 3 label-selection functions, 15 Vitest tests, and two WCAG-AA CSS banner tokens in both dark/light theme blocks**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-07T08:45:00Z
- **Completed:** 2026-05-07T09:00:00Z
- **Tasks:** 2
- **Files modified:** 3 (2 new, 1 modified)

## Accomplishments
- Created `ui/src/utils/offlineLabels.ts` with 5 string constants (banner copy byte-for-byte per UI-SPEC) and 3 pure label-selection functions (approveButtonLabel, denyButtonLabel, submitDenialButtonLabel)
- Created `ui/src/utils/offlineLabels.test.ts` with 15 Vitest cases covering constants byte-equality and online/offline branches of every function — all pass
- Added `--color-banner-bg` and `--color-banner-text` to both `:root` (dark: #f59e0b / #0f1117) and `[data-theme="light"]` (light: #d97706 / #0f172a with UI-SPEC contrast override) blocks in `ui/src/index.css`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create offlineLabels pure helper module + Vitest tests (RED then GREEN)** - `fcfb6cb` (feat)
2. **Task 2: Add --color-banner-bg and --color-banner-text tokens to both theme blocks of index.css** - `6f45a47` (feat)

**Plan metadata:** (committed with SUMMARY.md)

_Note: Task 1 followed TDD: RED commit (test only, failing) then GREEN commit (implementation, passing). Both are bundled into a single task commit per the atomic-commit protocol._

## Files Created/Modified
- `ui/src/utils/offlineLabels.ts` — Pure helper: 5 exported constants (OFFLINE_BANNER_LINE_1/2, OFFLINE_APPROVE_LABEL, OFFLINE_DENY_LABEL, OFFLINE_SUBMIT_DENIAL_LABEL) + 3 exported functions (approveButtonLabel, denyButtonLabel, submitDenialButtonLabel)
- `ui/src/utils/offlineLabels.test.ts` — 15 Vitest tests; 4 describe blocks; no @testing-library/react
- `ui/src/index.css` — 4 new CSS variable declarations (2 vars × 2 theme blocks)

## Decisions Made
- Followed plan exactly: no architectural changes needed. The pure-helper pattern from Phase 13 (connectivity.ts) applied cleanly.

## Verification Command Results

| Gate | Command | Result |
|------|---------|--------|
| 1 | `npm test -- --run` | 4 test files, 39 tests, all passed |
| 2 | `npm run lint` | Exit 0, no warnings |
| 3 | `npm run build` | Exit 0 (chunk-size warnings are pre-existing, unrelated) |
| 4 | `grep -cP '\x{2014}' offlineLabels.ts` | 3 (em dash confirmed) |
| 5 | curly apostrophe grep | 0 (ASCII apostrophe confirmed) |
| 6 | `grep -cE '--color-banner-(bg\|text)' index.css` | 4 (2 vars × 2 themes) |
| 7 | `grep -c '@testing-library' package.json` | 0 (no new dependency) |

## Deviations from Plan

**1. [Plan Assumption Error] grep count checks for #f59e0b and #d97706 returned 2 instead of expected 1**
- **Found during:** Task 2 verification
- **Issue:** The plan's `<verify>` step assumed `grep -c '#f59e0b' index.css` returns 1, but `--color-annotation-replace` already uses `#f59e0b` (dark) and `#d97706` (light) in the existing tokens. The plan was unaware these values were already present.
- **Fix:** Not a real error — the banner tokens are correctly placed with distinct variable names. The existing annotation-replace tokens happen to share the same amber palette values. No code change needed.
- **Files modified:** None (informational only)
- **Impact:** None — the correct tokens are correctly placed. The 4-token count (gate 6) confirms both `--color-banner-bg` and `--color-banner-text` are in both theme blocks.

---

**Total deviations:** 1 (plan assumption error, no code change required)
**Impact on plan:** Zero — all implementation is correct. The plan's grep gate assumed a false uniqueness constraint on hex values.

## Issues Encountered
None — plan executed cleanly with the TDD RED/GREEN cycle for Task 1.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `ui/src/utils/offlineLabels.ts` exports are stable and ready for Plan 02's App.tsx consumer
- `--color-banner-bg` and `--color-banner-text` CSS variables are ready for Plan 02's OfflineBanner inline styles via `var(...)`
- No blockers or concerns for Plan 02

---

**Note:** This plan introduces zero runtime behavior on its own. The consumer wiring lives in 14-02-PLAN.md. The contracts (helper module exports, CSS token names) are now stable and consumed by 14-02.

---
*Phase: 14-offline-banner-button-relabeling*
*Completed: 2026-05-07*
