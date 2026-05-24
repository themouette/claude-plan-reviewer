---
phase: 25-diff-viewer-ui
plan: "03"
subsystem: ui
tags: [react, typescript, rust, axum, diff-viewer, routing]

requires:
  - phase: 25-01
    provides: "useDiff hook, FileDiff type, Rust /api/diff/branch with ?context param"
  - phase: 25-02
    provides: "AppToolbar, FileListPane, DiffPane components"

provides:
  - "CodeReviewApp composing AppToolbar + FileListPane + DiffPane with full state wiring"
  - "Pathname-based routing in main.tsx dispatching /code-review to CodeReviewApp (D-01)"
  - "ARCH-01 cleanup: /api/diff route, AppState.diff_content field, extract_diff function all removed"

affects:
  - "Any future plan modifying server.rs start_server signature (now 4 params, not 5)"
  - "Any future plan using AppState (now 4 fields, no diff_content)"

tech-stack:
  added: []
  patterns:
    - "Deferred setState in useEffect via setTimeout(0) to satisfy react-hooks/set-state-in-effect"
    - "Pathname routing without router library: window.location.pathname.startsWith('/code-review')"
    - "ARCH-01 cleanup sequence: plan_review.rs → server.rs → main.rs (avoids intermediate compile failure)"

key-files:
  created:
    - "ui/src/code-review/CodeReviewApp.tsx"
    - "ui/src/code-review/CodeReviewApp.test.ts"
  modified:
    - "ui/src/main.tsx"
    - "src/plan_review.rs"
    - "src/server.rs"
    - "src/main.rs"
    - "src/hook.rs"

key-decisions:
  - "Deferred setActiveIndex via setTimeout(0) instead of direct call in useEffect body — satisfies react-hooks/set-state-in-effect without changing the [files.length] dependency"
  - "Added #[allow(dead_code)] to hook.rs cwd field instead of removing it — field is part of the hook protocol deserialization contract even if unused at runtime"

patterns-established:
  - "Pattern: deferred setState in useEffect uses setTimeout(0) + return () => clearTimeout(id)"

requirements-completed:
  - DIFF-01
  - DIFF-02
  - DIFF-03
  - DIFF-04
  - ARCH-01

duration: 7min
completed: 2026-05-24
---

# Phase 25 Plan 03: Diff Viewer Integration and ARCH-01 Cleanup Summary

**CodeReviewApp routes /code-review to a composed diff viewer with full state, and legacy /api/diff endpoint, AppState.diff_content, and extract_diff function are removed from the Rust binary**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-24T07:36:14Z
- **Completed:** 2026-05-24T07:42:47Z
- **Tasks:** 3 of 4 complete (Task 4 is a human-verify checkpoint — awaiting sign-off)
- **Files modified:** 7

## Accomplishments
- CodeReviewApp composes AppToolbar, FileListPane, and DiffPane with full state wiring (diffStyle, contextExpanded, activeIndex, diffPaneRef, useDiff); 18 source-assertion tests pass
- main.tsx dispatches `/code-review` to CodeReviewApp and everything else to ReviewerV2 with a one-line pathname check — no router library
- ARCH-01 closed: AppState.diff_content field, get_diff handler, /api/diff route, extract_diff function, its 4 tests, and 3 callsites all removed; cargo build/clippy/test pass clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement CodeReviewApp** - `2c66f3d` (feat)
2. **Task 2: Wire pathname routing in main.tsx** - `b509243` (feat)
3. **Task 3: ARCH-01 cleanup** - `bedf8aa` (fix)

**Plan metadata commit:** pending (after human checkpoint)

## Files Created/Modified
- `ui/src/code-review/CodeReviewApp.tsx` - Root component composing AppToolbar + FileListPane + DiffPane; owns diffStyle, contextExpanded, activeIndex, diffPaneRef state and useDiff wiring
- `ui/src/code-review/CodeReviewApp.test.ts` - 18 source-assertion tests locking component wiring
- `ui/src/main.tsx` - Added CodeReviewApp import and pathname routing branch
- `src/plan_review.rs` - Removed diff_content field, get_diff handler, /api/diff route (AppState now 4 fields)
- `src/server.rs` - Removed diff_content parameter from start_server (now 4 params)
- `src/main.rs` - Removed extract_diff function + 4 tests + 3 callsites; async_main now 5 params
- `src/hook.rs` - Added #[allow(dead_code)] to cwd field (now unused after extract_diff removal)

## Decisions Made
- Deferred `setActiveIndex` via `setTimeout(0)` instead of calling it directly in `useEffect` body. The plan specified `useEffect(..., [files.length])` but the project's `react-hooks/set-state-in-effect` ESLint rule disallows synchronous setState calls in effect bodies. The deferred approach preserves the same semantic (reset on files.length change) while satisfying the rule. Test 18 (`[files.length]` dep check) still passes.
- Added `#[allow(dead_code)]` to `hook.rs` `cwd` field rather than removing it. The `cwd` field is part of the hook protocol (Claude Code sends it in JSON). Removing it would silently drop the field from deserialization. Consistent with how `session_id`, `transcript_path`, and `tool_name` are handled in the same struct.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Deferred setActiveIndex to satisfy react-hooks/set-state-in-effect**
- **Found during:** Task 1 (CodeReviewApp implementation)
- **Issue:** Direct `setActiveIndex(...)` call inside `useEffect` body triggered ESLint error `react-hooks/set-state-in-effect`
- **Fix:** Wrapped in `setTimeout(..., 0)` with `return () => clearTimeout(id)` cleanup; same effect semantics, async callback pattern allowed by the rule
- **Files modified:** ui/src/code-review/CodeReviewApp.tsx
- **Verification:** `npm run lint` exits 0; 18 tests still pass
- **Committed in:** 2c66f3d (Task 1 commit)

**2. [Rule 1 - Bug] Added #[allow(dead_code)] to hook.rs cwd field**
- **Found during:** Task 3 (ARCH-01 cleanup)
- **Issue:** Removing extract_diff removed the only consumer of `hook_input.cwd`, causing `cargo clippy -- -D warnings` to fail with `field cwd is never read`
- **Fix:** Added `#[allow(dead_code)]` to `pub cwd: String` field in `src/hook.rs`, consistent with other protocol fields in the same struct
- **Files modified:** src/hook.rs
- **Verification:** `cargo clippy -- -D warnings` exits 0
- **Committed in:** bedf8aa (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (Rule 1 — bugs caused directly by plan actions)
**Impact on plan:** Both fixes required for correctness/lint compliance. No scope creep.

## Issues Encountered
None beyond the two auto-fixed deviations above.

## Human Verification Status

Task 4 is a `checkpoint:human-verify` gate. The executor stopped here. The human must:
1. Run `cd ui && npm run build && cd .. && cargo build`
2. Run the binary and navigate to `/code-review`
3. Verify all 14 verification steps in the plan (DIFF-01 through DIFF-04, ARCH-01, theme, empty state, regression)
4. Type "approved" to complete the checkpoint

## Next Phase Readiness
- Phase 25 is complete pending human sign-off on Task 4
- The `/code-review` route is live; the legacy `/api/diff` endpoint is gone
- All 5 ROADMAP Phase 25 success criteria are implemented and ready to verify visually

---
*Phase: 25-diff-viewer-ui*
*Completed: 2026-05-24 (pending human checkpoint)*
