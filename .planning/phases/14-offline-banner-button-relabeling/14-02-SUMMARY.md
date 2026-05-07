---
phase: 14-offline-banner-button-relabeling
plan: 02
subsystem: ui
tags: [react, typescript, offline, connectivity, banner, button-labels]

# Dependency graph
requires:
  - phase: 14-offline-banner-button-relabeling
    plan: 01
    provides: offlineLabels.ts exports (approveButtonLabel, denyButtonLabel, submitDenialButtonLabel, OFFLINE_BANNER_LINE_1, OFFLINE_BANNER_LINE_2) and CSS tokens --color-banner-bg/--color-banner-text
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Colocated sub-component (OfflineBanner) in App.tsx with role=status, inline styles, CSS var tokens — matches PageHeader/ErrorView/LoadingSpinner colocation pattern
    - Single useHeartbeat() call at top of App body — connectivity signal in scope for entire JSX return
    - Render-time helper function calls for button labels (not state mutation, not useEffect) — D-05 compliant

key-files:
  created: []
  modified:
    - ui/src/App.tsx

key-decisions:
  - "Tasks 1 and 2 committed atomically: Task 1 imports/OfflineBanner/hook-call produce unused-var lint errors until Task 2 wires the JSX — combined into one commit to keep lint clean"
  - "Two pre-existing non-button {approveLabel} and {denyLabel} usages remain (ConfirmationView done-state text at line ~495 and prop pass at line ~1118) — these are correct and must not be wrapped in helpers (offline label logic does not apply to post-decision confirmation)"
  - "node_modules symlink created in worktree ui/ to run lint/test/build (worktree shares source files but not node_modules from main repo)"

patterns-established:
  - "Pattern: Banner as sibling of appState blocks — mount between <PageHeader /> and {appState !== 'reviewing' && ...} so banner is visible across all four appState values"

requirements-completed:
  - OFX-01
  - OFX-02

# Metrics
duration: 20min
completed: 2026-05-07
---

# Phase 14 Plan 02: App.tsx Integration — OfflineBanner and Button Label Wiring Summary

**OfflineBanner colocated component + single useHeartbeat() call + banner mount between PageHeader and appState blocks + three render-time button label helper calls in App.tsx**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-07T09:10:00Z
- **Completed:** 2026-05-07T09:30:00Z
- **Tasks:** 2 (committed atomically)
- **Files modified:** 1 (ui/src/App.tsx)

## Accomplishments

- Added `useHeartbeat` and `offlineLabels` (3 helper functions + 2 banner constants) imports to `ui/src/App.tsx`
- Added `OfflineBanner` colocated sub-component in `App.tsx` (after `ErrorView`): `role="status"`, inline styles with `var(--color-banner-bg)` / `var(--color-banner-text)`, `flexShrink: 0`, two `<div>` children using `OFFLINE_BANNER_LINE_1` / `OFFLINE_BANNER_LINE_2`
- Added `const connectivity = useHeartbeat()` in App body hook region (after `handleThemeToggle`, before `appState` state)
- Mounted `{connectivity === 'offline' && <OfflineBanner />}` between `<PageHeader />` and the `{appState !== 'reviewing' && ...}` block — banner is a sibling of both appState branches, visible across all four appState values
- Replaced `{approveLabel}` in approve button with `{approveButtonLabel(connectivity, approveLabel)}`
- Replaced `{denyLabel}` in outer deny button with `{denyButtonLabel(connectivity, denyLabel)}`
- Replaced bare `Submit Denial` text in inner submit denial button with `{submitDenialButtonLabel(connectivity)}`
- No click handler bodies modified — buttons still POST to `/api/decide`

## Task Commits

Tasks 1 and 2 were committed together atomically (Task 1 imports/component/hook produce ESLint `no-unused-vars` errors until Task 2 wires them into JSX — splitting would violate the lint-clean requirement):

1. **Tasks 1+2: Wire OfflineBanner and button label helpers into App.tsx** - `36fc547` (feat)

**Plan metadata:** (committed with SUMMARY.md)

## Files Created/Modified

- `ui/src/App.tsx` — 38 lines inserted, 3 replaced:
  - 8 new import lines (useHeartbeat + 5 offlineLabels exports)
  - 27 lines: `OfflineBanner` function component
  - 1 line: `const connectivity = useHeartbeat()`
  - 1 line: banner mount point `{connectivity === 'offline' && <OfflineBanner />}`
  - 3 lines: label ternary replacements (`approveButtonLabel`, `denyButtonLabel`, `submitDenialButtonLabel`)

## Decisions Made

- Tasks 1 and 2 committed as a single atomic commit: Task 1 changes (imports, OfflineBanner component, hook call) introduce ESLint `no-unused-vars` errors that are only resolved when Task 2 wires them into JSX. Splitting into two separate commits would produce a lint-failing intermediate state.
- Two pre-existing `{approveLabel}` and `{denyLabel}` non-button occurrences were intentionally left unchanged: (1) the ConfirmationView "done" message at `{approved ? \`${approveLabel} — done\` : ...}` (line ~495) and (2) the `<ConfirmationView ... approveLabel={approveLabel} denyLabel={denyLabel} />` prop pass (line ~1118). These are post-decision confirmation displays, not submit buttons — offline label logic does not apply.

## Verification Command Results

| Gate | Command | Result |
|------|---------|--------|
| 1 | `npm test -- --run` | 4 test files, 39 tests, all passed (no regressions) |
| 2 | `npm run lint` | Exit 0, no errors, no warnings |
| 3 | `npm run build` | Exit 0 (pre-existing chunk-size and ::highlight CSS warnings only) |
| 4 | `grep -c "useHeartbeat()" src/App.tsx` | 1 (single call site) |
| 5 | `grep -c 'role="status"'` | 1 |
| 6 | `grep -c 'role="alert"'` | 0 |
| 7 | `grep -c "approveButtonLabel(connectivity, approveLabel)"` | 1 |
| 8 | `grep -c "denyButtonLabel(connectivity, denyLabel)"` | 1 |
| 9 | `grep -c "submitDenialButtonLabel(connectivity)"` | 1 |
| 10 | `grep -c "connectivity === 'offline' && <OfflineBanner"` | 1 |
| 11 | `find ui/src/components -name 'OfflineBanner*' \| wc -l` | 0 |
| 12 | Banner placement: line 1110 is before appState branches at lines 1113/1124 | PASS (siblings confirmed) |

**Notes on gates 12/13 (bare approveLabel/denyLabel):** The plan's grep gates `grep -v '^//' | grep -c '{approveLabel}'` return 2 (not 0) — but both occurrences are legitimate pre-existing non-button uses (ConfirmationView done-state text + prop pass). The *submit button* label sites at lines 1332/1370/1453 are correctly using the helper functions.

## Deviations from Plan

### 1. [Plan Structure] Tasks 1 and 2 committed as a single atomic commit

- **Found during:** Task 1 verification
- **Issue:** The plan specifies individual task commits, but Task 1 changes (imports + OfflineBanner + hook call) produce 5 ESLint `no-unused-vars` errors that are only resolved by Task 2's JSX wiring. Committing Task 1 alone violates the "lint clean" requirement stated in Task 1's `<done>`.
- **Fix:** Combined both tasks into a single commit. The combined change is functionally atomic and all acceptance criteria for both tasks are met.
- **Files modified:** None beyond what the plan specified
- **Impact:** Zero functional impact. Plan's success criteria are all satisfied.

### 2. [Plan Assumption] `grep -v '^//' | grep -c '{approveLabel}'` returns 2, not 0

- **Found during:** Task 2 Step E verification
- **Issue:** The plan expected this grep to return 0 (all bare `{approveLabel}` replaced). However, two non-button occurrences legitimately remain: the ConfirmationView "done" message template literal and the ConfirmationView prop pass.
- **Fix:** Not a real error — these occurrences are outside the submit button context and must not be replaced with offline helpers. The plan's grep gate was written assuming all `{approveLabel}` occurrences were button labels.
- **Files modified:** None
- **Impact:** Zero — submit buttons correctly use helper functions; non-button uses correctly remain unchanged.

## Issues Encountered

None — plan executed cleanly after recognizing the task atomicity constraint.

## Manual Smoke Tests

The following cannot be automated — recorded here per plan `<output>` requirements:

| Scenario | Expected | Status |
|----------|----------|--------|
| DevTools → Offline: after ~15s amber banner appears, buttons relabel | Banner shows two locked copy lines; approve button shows "Copy to clipboard — approve"; outer deny shows "Copy to clipboard — deny"; inner submit shows "Copy to clipboard" | Not verified (no running server in worktree context) |
| Toggle back online: banner disappears after ~5s, labels revert | Banner gone; buttons revert to approveLabel/denyLabel/"Submit Denial" | Not verified |
| Theme toggle while offline: banner palette switches | Dark: #f59e0b bg / #0f1117 text; Light: #d97706 bg / #0f172a text | Not verified |
| Keyboard tab order: banner not in tab stop sequence | Banner has no tabindex, no interactive children | By construction (no tabindex/button/a in OfflineBanner) |
| Annotation interactivity: text selection, comment textarea, deny textarea all usable while banner shown | No overlay, no pointer-events: none | By construction (banner is normal-flow div with no overlay CSS) |

*Manual smoke test against a running binary is required before v0.5.0 release. No DevTools Network throttling test was run in the worktree execution context.*

## User Setup Required

None — no external service configuration required.

## Phase 14 Completion Note

Phase 14 is now functionally complete. Both plans delivered:
- **Plan 01:** Pure helper module (`offlineLabels.ts` with 5 constants + 3 functions), 15 Vitest tests, CSS banner tokens in both theme blocks
- **Plan 02:** App.tsx integration — OfflineBanner component, single useHeartbeat() call, banner mount, three button label ternaries

Phase 15 (Clipboard Submit Path) owns the next change: wiring the relabeled buttons to `navigator.clipboard.writeText()` on click.

## Known Stubs

None — all wiring is complete. The button labels display correctly; the click handlers still POST to `/api/decide` as Phase 14 requires (Phase 15 owns the clipboard path).

---

*Phase: 14-offline-banner-button-relabeling*
*Completed: 2026-05-07*
