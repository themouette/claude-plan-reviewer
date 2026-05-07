---
phase: 15-clipboard-submit-path
plan: "02"
subsystem: ui
tags: [react, typescript, clipboard, offline, vitest]

# Dependency graph
requires:
  - phase: 15-01
    provides: buildClipboardPayload, ConnectivityStatus, offlineLabels exports
provides:
  - shouldUseClipboard pure helper (offline routing gate)
  - ClipboardConfirmationView sub-component (no auto-close)
  - Offline branch in approve/deny handlers using synchronous clipboard.writeText
  - AppState extended with 'clipboard_confirmed' variant
affects:
  - Phase 16 (slash command fallback — may reference clipboard_confirmed state)
  - Any future phase that adds keyboard shortcuts or submit paths

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Offline-first branch guard: check shouldUseClipboard(connectivity) before any await — preserves transient activation for navigator.clipboard.writeText"
    - "ClipboardConfirmationView omits window.close() — offline users must keep tab open to copy"

key-files:
  created: []
  modified:
    - ui/src/utils/offlineLabels.ts
    - ui/src/utils/offlineLabels.test.ts
    - ui/src/App.tsx

key-decisions:
  - "navigator.clipboard.writeText called synchronously (no await before it) in both approve and deny offline branches — STATE.md locked decision to preserve transient activation in Safari and Firefox"
  - "ClipboardConfirmationView has no window.close() — users must manually close after pasting"
  - "connectivity added to useCallback deps array for approve handler to avoid stale closure"

patterns-established:
  - "Offline branch guard pattern: if (shouldUseClipboard(connectivity)) { clipboardCall; setState; return } — used in both approve and deny"
  - "Clipboard failure is silenced (.catch(() => {})) — appState transitions to clipboard_confirmed regardless so user sees confirmation"

requirements-completed: [CLB-01, CLB-02]

# Metrics
duration: 15min
completed: 2026-05-07
---

# Phase 15 Plan 02: Clipboard Submit Path Summary

**Offline approve/deny handlers now write JSON to clipboard synchronously and show ClipboardConfirmationView instead of POSTing to /api/decide**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-07T18:14:00Z
- **Completed:** 2026-05-07T18:17:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added `shouldUseClipboard(status: ConnectivityStatus): boolean` pure helper to `offlineLabels.ts` with 2 Vitest tests (Tests 21-22)
- Extended `AppState` type with `'clipboard_confirmed'` variant in App.tsx
- Added `ClipboardConfirmationView` sub-component showing "Copied to clipboard — paste into Claude" with no `window.close()` call
- Modified `approve()` handler: offline branch calls `navigator.clipboard.writeText` synchronously as first statement, then sets state to `clipboard_confirmed`
- Modified `deny()` handler: same pattern with deny payload via `buildClipboardPayload`
- Routed `appState === 'clipboard_confirmed'` to `ClipboardConfirmationView` in the render tree
- All 44 tests pass (42 existing + 2 new)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add shouldUseClipboard pure helper and Vitest coverage** - `6ef4d8f` (feat)
2. **Task 2: Extend AppState, add ClipboardConfirmationView, wire offline branch** - `3467f6a` (feat)

## Files Created/Modified
- `ui/src/utils/offlineLabels.ts` - Added `shouldUseClipboard(status: ConnectivityStatus): boolean` export
- `ui/src/utils/offlineLabels.test.ts` - Added Tests 21-22 for `shouldUseClipboard`
- `ui/src/App.tsx` - Extended AppState, added ClipboardConfirmationView, wired offline branches in approve/deny handlers, added render routing

## Decisions Made
- `connectivity` was added to the `useCallback` deps array for `approve` — required to avoid stale closure where the offline branch would read the wrong status after connectivity changes
- Clipboard failure is silenced (`.catch(() => {})`) — appState still transitions so user sees the confirmation screen regardless; they can copy manually if needed

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Clipboard submit path is fully wired; offline users who click Approve or Submit Denial will have their decision on the clipboard and see a clear "paste into Claude" instruction
- Phase 16 (slash command fallback) can proceed independently
- Manual smoke test still pending (documented in STATE.md): paste clipboard JSON into Claude and confirm Claude parses it correctly

---
*Phase: 15-clipboard-submit-path*
*Completed: 2026-05-07*
