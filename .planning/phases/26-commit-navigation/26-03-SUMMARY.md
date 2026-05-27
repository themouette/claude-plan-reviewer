---
phase: 26-commit-navigation
plan: "03"
subsystem: frontend
tags: [tdd, typescript, react, commit-navigation, ui-integration]
dependency_graph:
  requires:
    - ui/src/code-review/types.ts#Commit              # from 26-01
    - ui/src/code-review/hooks/useCommits.ts           # from 26-01
    - ui/src/code-review/CommitDrawer.tsx              # from 26-02
    - ui/src/code-review/DiffPane.tsx#viewMode         # from 26-02
  provides:
    - ui/src/code-review/AppToolbar.tsx#commitsOpen    # Commits toggle button
    - ui/src/code-review/hooks/useDiff.ts#DiffFetchSelector  # selector-driven fetching
    - ui/src/code-review/hooks/useDiff.ts#fetchCommitDiffOnce
    - ui/src/code-review/hooks/useDiff.ts#fetchFilteredBranchDiff
    - ui/src/code-review/CodeReviewApp.tsx#drawerOpen  # all 4 commit state vars
  affects:
    - ui/src/code-review/AppToolbar.test.ts
    - ui/src/code-review/hooks/useDiff.test.ts
    - ui/src/code-review/CodeReviewApp.test.ts
tech_stack:
  added: []
  patterns:
    - selector-key-string (stable string key for useEffect deps from discriminated union)
    - tdd-source-text (source-text assertions; no @testing-library/react needed)
    - setTimeout-0-deferral (avoids react-hooks/set-state-in-effect in seeding effect)
    - keyboard-effect-stale-closure-fix (full deps array [viewMode, activeCommitSha, commits])
    - dispatch-helper (inline async dispatch picks pure function based on selector.mode)
key_files:
  created: []
  modified:
    - ui/src/code-review/AppToolbar.tsx
    - ui/src/code-review/AppToolbar.test.ts
    - ui/src/code-review/hooks/useDiff.ts
    - ui/src/code-review/hooks/useDiff.test.ts
    - ui/src/code-review/CodeReviewApp.tsx
    - ui/src/code-review/CodeReviewApp.test.ts
decisions:
  - "useDiff selector key is a stable string (mode:sha or mode:sorted-shas) to avoid object identity comparison in useEffect deps"
  - "dispatch() is an inline async helper inside useDiff — avoids hoisting selector into useCallback deps awkwardly"
  - "eslint-disable-next-line react-hooks/exhaustive-deps on two useEffect calls (selectorKey captures all selector state; commits.length captures seed trigger)"
  - "checkedCommitShas seeded via setTimeout(0) matching existing activeIndex reset pattern"
  - "aside gains position: relative so CommitDrawer (position: absolute) anchors inside it — Pitfall 3 mitigation"
metrics:
  duration: "7 minutes"
  completed: "2026-05-24T15:07:28Z"
  tasks_completed: 3
  tasks_total: 4
  files_created: 0
  files_modified: 6
---

# Phase 26 Plan 03: Integration — AppToolbar + useDiff Selector + CodeReviewApp Wiring Summary

**One-liner:** AppToolbar extended with Commits toggle button; useDiff extended with DiffFetchSelector (branch/commit/branch-union) + fetchCommitDiffOnce + fetchFilteredBranchDiff; CodeReviewApp wired with all 4 commit state vars, CommitDrawer, keyboard handler, and mode-aware diff fetching (DIFF-05 client-side union).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | AppToolbar Commits button failing assertions | 33c38ea | AppToolbar.test.ts |
| 1 (GREEN) | AppToolbar Commits toggle button implementation | 1cbdb02 | AppToolbar.tsx |
| 2 (RED) | useDiff fetchCommitDiffOnce + fetchFilteredBranchDiff failing tests | 0fd1c5b | useDiff.test.ts |
| 2 (GREEN) | useDiff extended with selector pattern + pure functions | 9a48ecf | useDiff.ts |
| 3 (RED) | CodeReviewApp Phase 26 wiring failing assertions | 9197abe | CodeReviewApp.test.ts |
| 3 (GREEN) | CodeReviewApp wired with drawer + keyboard + DIFF-05 union | adb3514 | CodeReviewApp.tsx |
| 4 | Human verification checkpoint — AWAITING | — | — |

## Test Output (GREEN)

### AppToolbar.test.ts
```
 Test Files  1 passed (1)
      Tests  17 passed (17)  (11 existing + 6 new)
```

### useDiff.test.ts
```
 Test Files  1 passed (1)
      Tests  13 passed (13)  (6 existing + 7 new)
```

### CodeReviewApp.test.ts
```
 Test Files  1 passed (1)
      Tests  32 passed (32)  (18 existing + 14 new)
```

### Full code-review suite
```
 Test Files  7 passed (7)
      Tests  114 passed (114)
```

### TypeScript
```
npx tsc --noEmit — exits 0, no errors
```

### Lint
```
npm run lint -- --max-warnings 0 — exits 0, no warnings
```

### Release build
```
cargo build --release — Finished release profile in ~51s
```

## Checkpoint Status

**Task 4 is a `checkpoint:human-verify` gate.** Autonomous code tasks (1–3) are complete and committed. The release build embeds the updated UI. Manual smoke testing is required to confirm all 8 checks pass across COMMIT-01, COMMIT-02, COMMIT-03, COMMIT-04, DIFF-05, D-13 orthogonality, and visual styling.

**User resume signal:** The user must type "approved" (or describe failures) after completing all 8 verification checks listed in Task 4.

## Deviations from Plan

None — plan executed exactly as written. The `useDiff` selector key pattern using a computed string (`branch:`, `commit:{sha}`, `branch-union:{sorted-shas}`) matches the plan spec. The `eslint-disable-next-line` comments on two `useEffect` calls were necessary because the linter cannot infer that `selectorKey` encodes all selector state and `commits.length` encodes the seed trigger — these are intentional, documented exceptions consistent with the existing pattern in the codebase.

## TDD Gate Compliance

- Task 1 RED gate: 33c38ea (`test(26-03): add failing AppToolbar Commits button assertions (RED)`) — 5 failed | 12 passed
- Task 1 GREEN gate: 1cbdb02 (`feat(26-03): add Commits toggle to AppToolbar`) — 17 passed
- Task 2 RED gate: 0fd1c5b (`test(26-03): add failing useDiff fetchCommitDiffOnce + fetchFilteredBranchDiff tests (RED)`) — 7 failed | 6 passed
- Task 2 GREEN gate: 9a48ecf (`feat(26-03): extend useDiff with per-commit and union fetching`) — 13 passed
- Task 3 RED gate: 9197abe (`test(26-03): add failing CodeReviewApp Phase 26 wiring assertions (RED)`) — 13 failed | 19 passed
- Task 3 GREEN gate: adb3514 (`feat(26-03): wire CodeReviewApp with commit drawer + keyboard + DIFF-05 union`) — 32 passed

## Threat Surface Scan

T-26-03-D2 mitigated: `return () => window.removeEventListener('keydown', handleKeyDown)` cleanup is present in the keyboard useEffect. Deps array `[viewMode, activeCommitSha, commits]` matches plan spec to prevent stale closure (Pitfall 2).

T-26-03-D1 accepted: DIFF-05 union triggers parallel /api/diff/commit/{sha} fetches. COMMIT_LIMIT in Rust caps at 500 — within capacity for a single-user local tool.

No new endpoints, auth paths, or file access patterns introduced beyond what Phase 24 shipped.

## Known Stubs

None. All commit state is wired to live API calls (useCommits → /api/commits, fetchCommitDiffOnce → /api/diff/commit/{sha}, fetchFilteredBranchDiff → N×/api/diff/commit/{sha}). No hardcoded empty values flow to rendering.

## Self-Check: PASSED

- [x] `ui/src/code-review/AppToolbar.tsx` — contains `commitsOpen: boolean`, `onCommitsToggle:`, `'Commits'`, `makeFocusHandlers('commits')`, `commitsOpen ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'`, no `reviewer-v2/`
- [x] `ui/src/code-review/AppToolbar.test.ts` — 17 assertions (11 existing + 6 new)
- [x] `ui/src/code-review/hooks/useDiff.ts` — contains `export type DiffFetchSelector`, `export async function fetchCommitDiffOnce`, `export async function fetchFilteredBranchDiff`, `Promise.all`, `/api/diff/commit/`, `'fetch failed'`, `'network error'`
- [x] `ui/src/code-review/hooks/useDiff.test.ts` — 13 assertions (6 existing + 7 new)
- [x] `ui/src/code-review/CodeReviewApp.tsx` — contains all required identifiers: `CommitDrawer`, `useCommits`, `drawerOpen`, `viewMode`, `activeCommitSha`, `checkedCommitShas`, `position: 'relative'`, `{drawerOpen &&`, `<CommitDrawer`, `commitsOpen={drawerOpen}`, `onCommitsToggle={`, `viewMode={viewMode}`, `activeCommitSha={activeCommitSha}`, `commits={commits}`, `'ArrowLeft'`, `'ArrowRight'`, no `'ArrowUp'`, no `'ArrowDown'`, `viewMode !== 'commit'`, `idx > 0`, `idx < commits.length - 1`, `setTimeout(`, `setCheckedCommitShas(commits.map`
- [x] `ui/src/code-review/CodeReviewApp.test.ts` — 32 assertions (18 existing + 14 new)
- [x] All 7 test files: 114 tests passed
- [x] `npx tsc --noEmit` exits 0
- [x] `npm run lint -- --max-warnings 0` exits 0
- [x] `cargo build --release` exits 0
- [x] Commits 33c38ea, 1cbdb02, 0fd1c5b, 9a48ecf, 9197abe, adb3514 all exist in git log
